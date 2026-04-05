import { useEffect, useState, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  deleteDoc
} from "firebase/firestore";
import { getDatabase, ref, onValue } from "firebase/database";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useLocation, useNavigate } from "react-router-dom";
import "./Messages.css";
import { sendNotification } from "../utils/sendNotification";
import FileUpload from "../components/FileUpload";
import FilePreview from "../components/FilePreview";
import RateUser from "../components/RateUser";

export default function Messages() {

  const [currentUser, setCurrentUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [liveChat, setLiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [callFilter, setCallFilter] = useState("all");
  const [presenceMap, setPresenceMap] = useState({});
  const [usersMap, setUsersMap] = useState({});

  const [handledCallId, setHandledCallId] = useState(null);

  const typingTimeout = useRef(null);
  const lastMsgCount = useRef(0);

  const sendAudio = useRef(null);
  const receiveAudio = useRef(null);

  /* NEW refs for future features */
  const callStartTime = useRef(null);

  const rtdb = getDatabase();
  const location = useLocation();
  const navigate = useNavigate();

  /* 🔐 AUTH */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  /* 👤 USERS */
  useEffect(() => {
    return onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => (map[d.id] = d.data()));
      setUsersMap(map);
    });
  }, []);

  /* 🔊 SOUNDS */
  useEffect(() => {
    sendAudio.current = new Audio("/sounds/send.mp3");
    receiveAudio.current = new Audio("/sounds/receive.mp3");
  }, []);

  /* 🟢 PRESENCE */
  useEffect(() => {
    const presenceRef = ref(rtdb, "presence");
    return onValue(presenceRef, (snap) => {
      setPresenceMap(snap.val() || {});
    });
  }, [rtdb]);

  /* 💬 CHAT LIST */
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("users", "array-contains", currentUser.uid)
    );

    return onSnapshot(q, (snap) => {

      const seen = new Set();

      let list = snap.docs
        .map((d) => {
          const data = d.data();
          const otherUid = data.users.find((u) => u !== currentUser.uid);
          const key = [...data.users].sort().join("_");

          return {
            id: d.id,
            key,
            ...data,
            otherUid,
            otherName: usersMap[otherUid]?.name || "User",
            otherOnline: presenceMap[otherUid]?.online || false,
            otherLastSeen: presenceMap[otherUid]?.lastSeen || null,
            updatedAt: data.updatedAt?.toMillis?.() || 0,
          };
        })
        .filter((chat) => {
          if (seen.has(chat.key)) return false;
          seen.add(chat.key);
          return true;
        });

      list.sort((a, b) => b.updatedAt - a.updatedAt);
      setChats(list);

      if (!selectedChat) {

        if (location.state?.chatId) {

          const match = list.find((c) => c.id === location.state.chatId);

          if (match) {
            setSelectedChat(match);
            return;
          }

        }

        if (list.length > 0) {
          setSelectedChat(list[0]);
        }

      }

    });

  }, [currentUser, presenceMap, usersMap, location, selectedChat]);

  /* ✍️ LIVE CHAT */
  useEffect(() => {
    if (!selectedChat) return;

    return onSnapshot(doc(db, "chats", selectedChat.id), (snap) => {
      setLiveChat({ id: snap.id, ...snap.data() });
    });

  }, [selectedChat]);

  /* 📩 MESSAGES */
  useEffect(() => {
    if (!selectedChat || !currentUser) return;

    const q = query(
      collection(db, "chats", selectedChat.id, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, async (snap) => {

      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (msgs.length > lastMsgCount.current && lastMsgCount.current !== 0) {

        const last = msgs[msgs.length - 1];

        if (last.senderId !== currentUser.uid) {
          receiveAudio.current?.play().catch(() => { });
        }

      }

      lastMsgCount.current = msgs.length;
      setMessages(msgs);

      msgs.forEach(async (msg) => {

        if (
          msg.senderId !== currentUser.uid &&
          !msg.seenBy?.includes(currentUser.uid)
        ) {

          await updateDoc(
            doc(db, "chats", selectedChat.id, "messages", msg.id),
            { seenBy: arrayUnion(currentUser.uid) }
          );

        }

      });

    });

  }, [selectedChat, currentUser]);

  /* 📞 CALL FEATURE START */

  const requestCall = async (type) => {

    if (!selectedChat) return;
    console.log("CHAT DATA:", selectedChat);

    const roomID = "room_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

    await addDoc(collection(db, "calls"), {
      caller: currentUser.uid,
      callerName : currentUser.email,

      receiver: selectedChat.otherUid || selectedChat?.uid,
      receiverName :selectedChat.otherName || selectedChat?.name ||"User",

      roomID,
      type,
      status: "permission",
      createdAt: serverTimestamp(),
    });

    await sendNotification(
      selectedChat.otherUid,
      "💬 New message from " + currentUser.uid,
      "message",
      "📞 Incoming call request",
      "call"
    );

    /* Updated request message */
    await addDoc(collection(db, "chats", selectedChat.id, "messages"), {
      text: `📹 ${type} Call Requested — waiting for response`,
      senderId: currentUser.uid,
      createdAt: serverTimestamp(),
      seenBy: [currentUser.uid]
    });

  };

  /* RECEIVER LISTENER */
  useEffect(() => {

    if (!currentUser) return;

    const q = query(
      collection(db, "calls"),
      where("receiver", "==", currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {

      snap.forEach((callDoc) => {

        if (handledCallId === callDoc.id) return;

        const data = callDoc.data();

        if (data.status === "permission") {

          const allow = window.confirm(
            `User wants to start ${data.type} call. Allow?`
          );

          if (allow) {

            updateDoc(doc(db, "calls", callDoc.id), {
              status: "ringing"
            });

          } else {

            /* Missed call message */
            if (selectedChat) {
              addDoc(collection(db, "chats", selectedChat.id, "messages"), {
                text: `📞 Missed Call`,
                senderId: data.caller,
                createdAt: serverTimestamp(),
                seenBy: [currentUser.uid]
              });
            }

            deleteDoc(doc(db, "calls", callDoc.id));

          }

        }

        if (data.status === "ringing") {


          const accept = window.confirm(
            `Incoming ${data.type} call. Accept?`
          );

          if (accept) {

            setHandledCallId(callDoc.id);

            updateDoc(doc(db, "calls", callDoc.id), {
              status: "accepted"
            });

            /* Call accepted message */
            if (selectedChat) {
              addDoc(collection(db, "chats", selectedChat.id, "messages"), {
                text: `✅ ${data.type} Call Accepted`,
                senderId: currentUser.uid,
                createdAt: serverTimestamp(),
                seenBy: [currentUser.uid]
              });
            }

            callStartTime.current = Date.now();

            deleteDoc(doc(db, "calls", callDoc.id));

            navigate(`/video-call/${data.roomID}?User=${data.caller}&name=${data.callerName}`);

          }

        }

      });

    });

    return () => unsub();

  }, [currentUser, navigate, handledCallId, selectedChat]);

  /* CALLER LISTENER */
  useEffect(() => {

    if (!currentUser) return;

    const q = query(
      collection(db, "calls"),
      where("caller", "==", currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {

      snap.forEach(async (callDoc) => {

        if (handledCallId === callDoc.id) return;

        const data = callDoc.data();
        console.log("FULL DATA:",data);

        if (data.status === "accepted") {

          setHandledCallId(callDoc.id);

          deleteDoc(doc(db, "calls", callDoc.id));

          navigate(`/video-call/${data.roomID}?User=${data.receiver}&name=${data.receiverName}`);

        }

        if (data.status === "rejected") {
          const chatId = [data.caller, data.receiver].sort().join("_");

          await addDoc(collection(db, "chats", chatId, "messages"), {
            text: `📞 Missed ${data.type} Call`,
            senderId: currentUser.uid,
            createdAt: serverTimestamp(),
            seenBy: [currentUser.uid],
            callType: data.type,
            callStatus: "missed"
          });

          setHandledCallId(callDoc.id);

          deleteDoc(doc(db, "calls", callDoc.id));

          if (selectedChat) {
            addDoc(collection(db, "chats", selectedChat.id, "messages"), {
              text: `📞 Missed Call`,
              senderId: currentUser.uid,
              createdAt: serverTimestamp(),
              seenBy: [currentUser.uid]
            });
          }

        }

      });

    });

    return () => unsub();

  }, [currentUser, navigate, handledCallId]);

  /* 📞 CALL FEATURE END */

  const onTextChange = async (e) => {

    setText(e.target.value);

    if (!selectedChat) return;

    await updateDoc(doc(db, "chats", selectedChat.id), {
      [`typing.${currentUser.uid}`]: true
    });

    clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(() => {
      updateDoc(doc(db, "chats", selectedChat.id), {
        [`typing.${currentUser.uid}`]: false
      });
    }, 1200);

  };

  const sendMessage = async () => {

    if (!text.trim()) return;

    await addDoc(collection(db, "chats", selectedChat.id, "messages"), {
      text,
      senderId: currentUser.uid,
      createdAt: serverTimestamp(),
      seenBy: [currentUser.uid]
    });

    await updateDoc(doc(db, "chats", selectedChat.id), {
      lastMessage: text,
      updatedAt: serverTimestamp(),
      [`typing.${currentUser.uid}`]: false
    });

    sendAudio.current?.play().catch(() => { });

    setText("");

  };

  const formatLastSeen = (ts) => {

    if (!ts) return "";

    const min = Math.floor((Date.now() - ts) / 60000);

    if (min < 1) return "last seen just now";
    if (min < 60) return `last seen ${min} min ago`;

    return "last seen earlier";

  };

  const otherUid = selectedChat?.otherUid;
  const isTyping = liveChat?.typing?.[otherUid];

  return (

    <div className="messages-layout">

      <aside className="chat-list">

        <h3>Chats</h3>

        {chats.map((chat) => (

          <div
            key={chat.id}
            className={`chat-item ${selectedChat?.id === chat.id ? "active" : ""}`}
            onClick={() => setSelectedChat(chat)}
          >

            <div className="avatar-wrapper">
              <div className="avatar">{chat.otherName[0]}</div>
              {chat.otherOnline && <span className="online-dot" />}
            </div>

            <p>{chat.otherName}</p>

          </div>

        ))}

      </aside>

      <section className="chat-window">

        {!selectedChat ? (

          <div className="empty-state">
            Select a chat to start messaging 💬
          </div>

        ) : (

          <>

            <div className="chat-header">

              <strong>{selectedChat.otherName}</strong>

              <button onClick={() => requestCall("Video")} style={{ marginLeft: 10 }}>🎥</button>
              <button onClick={() => requestCall("Audio")} style={{ marginLeft: 5 }}>📞</button>

              <button
                onClick={() => navigate("/schedule/" + selectedChat.otherUid)}>📅 Schedule</button>
              <button onClick={() => navigate("/call-history")}>📞 History</button>

              {isTyping
                ? " typing..."
                : selectedChat.otherOnline
                  ? " Online"
                  : formatLastSeen(selectedChat.otherLastSeen)}

            </div>

            <div className="chat-body">

              {messages.map((m) => (

                <div
                  key={m.id}
                  className={
                    m.senderId === currentUser.uid ? "sent" : "received"
                  }
                >

                  {m.callStatus === "missed" ? (
                    <>
                      <span>
                        {m.senderId === currentUser.uid ? "📤 Missed Call" : "📥 Missed Call"}
                      </span>

                      <button
                        style={{ marginLeft: 10 }}
                        onClick={() => requestCall(m.callType || "Video")}
                      >
                        🔁 Call Back
                      </button>
                    </>
                  ) : (
                    m.type === "file" ? (
                      <FilePreview fileUrl={m.fileUrl} fileName={m.fileName} />
                    ) : (
                      m.text
                    )
                  )}


                </div>

              ))}

            </div>

            <div className="chat-input">

              <input value={text} onChange={onTextChange} />

              <button onClick={sendMessage}>Send</button>

              <FileUpload chatId={selectedChat.id} />

            </div>
          </>

        )}

      </section>

    </div>

  );

}