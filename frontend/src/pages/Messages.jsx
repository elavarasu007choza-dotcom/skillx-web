import { useEffect, useMemo, useState, useRef } from "react";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  deleteDoc
} from "firebase/firestore";
import { getDatabase, ref, onValue } from "firebase/database";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./Messages.css";
import { sendNotification } from "../utils/sendNotification";
import FileUpload from "../components/FileUpload";
import FilePreview from "../components/FilePreview";

export default function Messages() {
  const QUICK_EXCHANGE_TEXT = "Shall we exchange our skill ?";

  const [currentUser, setCurrentUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [liveChat, setLiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [presenceMap, setPresenceMap] = useState({});
  const [usersMap, setUsersMap] = useState({});
  const [unreadMap, setUnreadMap] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);

  const [handledCallId, setHandledCallId] = useState(null);

  const typingTimeout = useRef(null);
  const lastMsgCount = useRef(0);

  const sendAudio = useRef(null);
  const receiveAudio = useRef(null);
  const chatBodyRef = useRef(null);
  const routeInitRef = useRef("");

  const isRecentPresence = (value, windowMs = 120000) => {
    if (!value) return false;
    const ts = typeof value === "number"
      ? value
      : value?.toDate
        ? value.toDate().getTime()
        : new Date(value).getTime();

    if (Number.isNaN(ts)) return false;
    return Date.now() - ts <= windowMs;
  };

  const rtdb = getDatabase();
  const location = useLocation();
  const routeChatId = useMemo(() => location.state?.chatId || "", [location.state]);
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams();

  useEffect(() => {
    if (!currentUser || !routeUserId || routeUserId === currentUser.uid) return;

    const ensureChat = async () => {
      const chatId = [currentUser.uid, routeUserId].sort().join("_");

      if (routeInitRef.current === chatId) return;
      routeInitRef.current = chatId;

      await setDoc(
        doc(db, "chats", chatId),
        {
          users: [currentUser.uid, routeUserId],
          lastMessage: "",
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSelectedChat({
        id: chatId,
        users: [currentUser.uid, routeUserId],
        otherUid: routeUserId,
        otherName: "User",
        otherOnline: false,
        otherLastSeen: null,
      });
    };

    ensureChat();
  }, [currentUser, routeUserId]);

  useEffect(() => {
    if (!selectedChat?.otherUid) return;
    const freshName = usersMap[selectedChat.otherUid]?.name;
    if (!freshName || freshName === selectedChat.otherName) return;

    setSelectedChat((prev) => (prev ? { ...prev, otherName: freshName } : prev));
  }, [usersMap, selectedChat]);

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
          const livePresence = presenceMap[otherUid];
          const fallbackUser = usersMap[otherUid] || {};
          const onlineFromPresence =
            livePresence?.online === true && isRecentPresence(livePresence?.lastSeen, 180000);
          const onlineFromFallback =
            fallbackUser?.online === true && isRecentPresence(fallbackUser?.lastSeen, 180000);

          return {
            id: d.id,
            key,
            ...data,
            otherUid,
            otherName: usersMap[otherUid]?.name || "User",
            otherOnline: onlineFromPresence || onlineFromFallback,
            otherLastSeen: livePresence?.lastSeen || fallbackUser?.lastSeen || null,
            updatedAtRaw: data.updatedAt || null,
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

      if (list.length === 0) {
        setSelectedChat(null);
        return;
      }

      if (routeChatId) {
        const routeMatch = list.find((c) => c.id === routeChatId);
        if (routeMatch && selectedChat?.id !== routeMatch.id) {
          setSelectedChat(routeMatch);
          return;
        }
      }

      const activeInList = selectedChat && list.some((c) => c.id === selectedChat.id);
      if (!activeInList) {
        setSelectedChat(list[0]);
      }

    });

  }, [currentUser, presenceMap, usersMap, routeChatId, selectedChat]);

  useEffect(() => {
    if (!currentUser || chats.length === 0) {
      setUnreadMap({});
      return;
    }

    const uid = currentUser.uid;

    const unsubs = chats.map((chat) => {
      const q = query(
        collection(db, "chats", chat.id, "messages"),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      return onSnapshot(q, (snap) => {
        const latest = snap.docs[0]?.data();
        const unread = Boolean(
          latest &&
          latest.senderId !== uid &&
          !latest.seenBy?.includes(uid) &&
          !latest.hiddenFor?.includes(uid)
        );

        setUnreadMap((prev) => ({ ...prev, [chat.id]: unread }));
      });
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [currentUser, chats]);

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

      const msgs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => !m.hiddenFor?.includes(currentUser.uid));

      if (msgs.length > lastMsgCount.current && lastMsgCount.current !== 0) {

        const last = msgs[msgs.length - 1];

        if (last.senderId !== currentUser.uid) {
          receiveAudio.current?.play().catch(() => { });
        }

      }

      lastMsgCount.current = msgs.length;
      setMessages(msgs);

      setTimeout(() => {
        if (chatBodyRef.current) {
          chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
      }, 100);

      msgs.forEach(async (msg) => {

        if (
          msg.senderId !== currentUser.uid &&
          !msg.seenBy?.includes(currentUser.uid)
        ) {

          await updateDoc(
            doc(db, "chats", selectedChat.id, "messages", msg.id),
            {
              seenBy: arrayUnion(currentUser.uid),
              [`seenAt.${currentUser.uid}`]: serverTimestamp()
            }
          );

        }

      });

    });

  }, [selectedChat, currentUser]);

  /* 📞 CALL FEATURE START */

  const requestCall = async (type) => {

    if (!selectedChat) return;

    const roomID = "room_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

    const callerName = usersMap[currentUser?.uid]?.name || currentUser?.email || "User";
    const receiverId = selectedChat.otherUid || selectedChat?.uid;

    await addDoc(collection(db, "calls"), {
      caller: currentUser.uid,
      callerName: callerName,

      receiver: receiverId,
      receiverName :selectedChat.otherName || selectedChat?.name ||"User",

      roomID,
      type,
      status: "ringing",
      createdAt: serverTimestamp(),
    });

    await sendNotification(
      receiverId,
      `📞 ${callerName} is calling you (${type})`,
      "call",
      "Incoming Call"
    );

    /* Updated request message */
    await addDoc(collection(db, "chats", selectedChat.id, "messages"), {
      text: `📹 ${type} Call Requested — waiting for response`,
      senderId: currentUser.uid,
      createdAt: serverTimestamp(),
      seenBy: [currentUser.uid]
    });

  };

  /* Receiver side call popup is handled globally via IncomingCallNotifier */

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

        if (data.status === "accepted") {

          setHandledCallId(callDoc.id);

          deleteDoc(doc(db, "calls", callDoc.id));

          const resolvedType = String(data.type || "Video").toLowerCase();
          navigate(`/video-call/${data.roomID}?User=${data.receiver}&name=${data.receiverName}&type=${resolvedType}`);

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
              text: `📞 Missed ${data.type} Call`,
              senderId: currentUser.uid,
              createdAt: serverTimestamp(),
              seenBy: [currentUser.uid],
              callType: data.type,
              callStatus: "missed"
            });
          }

        }

      });

    });

    return () => unsub();

  }, [currentUser, navigate, handledCallId, selectedChat]);

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

  const sendMessage = async (customText = "") => {
    const outgoingText = (customText || text).trim();

    if (!selectedChat || !currentUser) return;
    
    // Require either text or file
    if (!outgoingText && !uploadedFile) return;

    const messageData = {
      senderId: currentUser.uid,
      createdAt: serverTimestamp(),
      seenBy: [currentUser.uid]
    };

    // Add text if present
    if (outgoingText) {
      messageData.text = outgoingText;
    }

    // Add file if present
    if (uploadedFile) {
      messageData.type = "file";
      messageData.fileUrl = uploadedFile.fileUrl;
      messageData.fileName = uploadedFile.fileName;
      messageData.fileType = uploadedFile.fileType;
    }

    await addDoc(collection(db, "chats", selectedChat.id, "messages"), messageData);

    await updateDoc(doc(db, "chats", selectedChat.id), {
      lastMessage: outgoingText || `📎 ${uploadedFile?.fileName || "File"}`,
      updatedAt: serverTimestamp(),
      [`typing.${currentUser.uid}`]: false
    });

    sendAudio.current?.play().catch(() => { });

    setText("");
    setUploadedFile(null);

  };

  const handleMessageKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSendClick = () => {
    sendMessage();
  };

  const deleteMessage = async (messageId, senderId) => {
    if (!selectedChat || !currentUser) return;

    const isMine = senderId === currentUser.uid;
    const ok = window.confirm(isMine ? "Delete this message?" : "Delete this message for you?");
    if (!ok) return;

    try {
      if (isMine) {
        await deleteDoc(doc(db, "chats", selectedChat.id, "messages", messageId));
      } else {
        await updateDoc(doc(db, "chats", selectedChat.id, "messages", messageId), {
          hiddenFor: arrayUnion(currentUser.uid),
        });
      }
    } catch (err) {
      if (isMine) {
        await updateDoc(doc(db, "chats", selectedChat.id, "messages", messageId), {
          hiddenFor: arrayUnion(currentUser.uid),
        });
      } else {
        console.error("Delete message failed", err);
      }
    }

    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const toDateValue = (value) => {
    if (!value) return null;
    if (typeof value === "number") return new Date(value);
    if (value?.toDate) return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatRelative = (date) => {
    if (!date) return "just now";
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day ago`;
  };

  const formatLastSeen = (value) => {
    const date = toDateValue(value);
    if (!date) return "last seen unavailable";
    return `last seen ${formatRelative(date)}`;
  };

  const formatMessageTime = (value) => {
    const date = toDateValue(value);
    if (!date) return "";

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatRecordingTime = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatChatListTime = (value) => {
    const date = toDateValue(value);
    if (!date) return "";

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDateHeader = (value) => {
    const date = toDateValue(value);
    if (!date) return "";

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a, b) =>
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear();

    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, yesterday)) return "Yesterday";

    return date.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const activeChat = chats.find((c) => c.id === selectedChat?.id) || selectedChat;
  const showQuickExchangePrompt = Boolean(activeChat && messages.length === 0);
  const otherUid = activeChat?.otherUid;
  const livePresence = otherUid ? presenceMap[otherUid] || {} : {};
  const isOtherOnline = Boolean(
    (livePresence?.online === true && isRecentPresence(livePresence?.lastSeen, 180000)) || activeChat?.otherOnline
  );
  const otherLastSeen = livePresence.lastSeen ?? activeChat?.otherLastSeen;
  const isTyping = liveChat?.typing?.[otherUid];

  return (

    <div className="messages-layout">

      <aside className="chat-list">

        <h3>Chats</h3>

        {chats.map((chat) => {
          return (
            <div
              key={chat.id}
              className={`chat-item ${selectedChat?.id === chat.id ? "active" : ""}`}
              onClick={() => setSelectedChat(chat)}
            >

                <div className="avatar-wrapper">
                  {usersMap[chat.otherUid]?.photoURL ? (
                    <img
                      src={usersMap[chat.otherUid].photoURL}
                      alt={chat.otherName}
                      className="avatar avatar-img"
                    />
                  ) : (
                    <div className="avatar">{chat.otherName?.[0] || "U"}</div>
                  )}
                  {chat.otherOnline && <span className="online-dot" />}
                  {unreadMap[chat.id] && <span className="chat-unread-dot" />}
                </div>

              <div className="chat-meta">
                <div className="chat-meta-row">
                  <p className="chat-name">{chat.otherName}</p>
                  <span className="chat-time">{formatChatListTime(chat.updatedAtRaw || chat.updatedAt)}</span>
                </div>
                <span className={`chat-presence ${chat.otherOnline ? "online" : "offline"}`}>
                  {chat.otherOnline ? "Online" : "Offline"}
                </span>
              </div>



            </div>
          );
        })}

      </aside>

      <section className="chat-window">

        {!activeChat ? (

          <div className="empty-state">
            Select a chat to start messaging 💬
          </div>

        ) : (

          <>

            <div className="chat-header">
              <div className="chat-header-main">
                <strong 
                  onClick={() => navigate(`/user/${activeChat.otherUid}`)}
                  style={{ cursor: "pointer" }}
                  title="View profile"
                >
                  {activeChat.otherName}
                </strong>
                <span className={`header-presence ${isOtherOnline ? "online" : "offline"}`}>
                  <span className={`header-dot ${isOtherOnline ? "online" : "offline"}`} />
                  {isTyping
                    ? "typing..."
                    : isOtherOnline
                      ? "Online"
                      : formatLastSeen(otherLastSeen)}
                </span>
              </div>

              <div className="chat-header-actions">
                <button className="chat-action-btn" onClick={() => requestCall("Video")}>🎥</button>
                <button className="chat-action-btn" onClick={() => requestCall("Audio")}>📞</button>

                <button className="chat-action-btn" onClick={() => navigate("/schedule/" + activeChat.otherUid)}>
                  📅 Schedule
                </button>
                <button className="chat-action-btn" onClick={() => navigate("/call-history")}>📞 History</button>
              </div>

            </div>

            <div className="chat-body" ref={chatBodyRef}>

              {messages.map((m, index) => {
                const prev = messages[index - 1];
                const currentHeader = formatDateHeader(m.createdAt);
                const prevHeader = prev ? formatDateHeader(prev.createdAt) : null;
                const showDateHeader = index === 0 || currentHeader !== prevHeader;

                return (
                <div key={m.id} className="message-row">
                  {showDateHeader && currentHeader && (
                    <div className="date-separator">{currentHeader}</div>
                  )}

                  <div
                    className={`message-wrap ${m.senderId === currentUser.uid ? "mine" : "theirs"}`}
                  >
                    <div
                      className={
                        m.senderId === currentUser.uid ? "sent" : "received"
                      }
                    >

                    {m.callStatus === "missed" ? (
                      <>
                        <span>
                          {m.senderId === currentUser.uid ? "📤 Missed" : "📥 Missed"} {m.callType || "Video"} Call
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
                        <FilePreview fileUrl={m.fileUrl} fileName={m.fileName} fileType={m.fileType} />
                      ) : m.type === "voice" ? (
                        <div className="voice-msg">
                          <span className="voice-label">🎤 Voice</span>
                          <audio controls src={m.voiceUrl} preload="metadata" />
                          <span className="voice-duration">
                            {formatRecordingTime(m.duration || 0)}
                          </span>
                        </div>
                      ) : (
                        m.text
                      )
                    )}

                      <button
                        className="msg-delete-btn"
                        onClick={() => deleteMessage(m.id, m.senderId)}
                        title={m.senderId === currentUser.uid ? "Delete message" : "Delete for me"}
                        type="button"
                      >
                        🗑
                      </button>
                    </div>

                    {m.senderId === currentUser.uid && (
                      <div className="msg-status">
                        {formatMessageTime(m.createdAt)}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}

            </div>

            {showQuickExchangePrompt && (
              <div className="quick-exchange-wrap">
                <button
                  className="quick-exchange-btn"
                  type="button"
                  onClick={() => sendMessage(QUICK_EXCHANGE_TEXT)}
                >
                  {QUICK_EXCHANGE_TEXT}
                </button>
              </div>
            )}

            {uploadedFile && (
              <div style={{
                padding: "12px",
                backgroundColor: "#e8f5e9",
                borderRadius: "8px",
                marginBottom: "12px",
                border: "2px solid #4caf50",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                fontSize: "14px",
                fontWeight: "500"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                  {uploadedFile.fileType?.startsWith("image/") ? (
                    <img 
                      src={uploadedFile.fileUrl} 
                      alt={uploadedFile.fileName}
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "6px",
                        objectFit: "cover",
                        border: "1px solid #ccc"
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "6px",
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px"
                    }}>
                      📎
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: "bold", wordBreak: "break-word" }}>✅ {uploadedFile.fileName}</div>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                      {uploadedFile.fileType?.split("/")?.[1] || "File"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setUploadedFile(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#d32f2f",
                    fontSize: "20px",
                    padding: "4px 8px",
                    flexShrink: 0
                  }}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="chat-input">
              <FileUpload chatId={selectedChat.id} onFileUpload={setUploadedFile} />
              <input
                value={text}
                onChange={onTextChange}
                onKeyDown={handleMessageKeyDown}
                placeholder="Type a message..."
              />
              <button onClick={handleSendClick}>
                Send
              </button>
            </div>
          </>

        )}

      </section>

    </div>

  );

}
