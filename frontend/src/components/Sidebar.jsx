import { NavLink, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore";
import { useEffect, useState } from "react";
import "./Sidebar.css";

export default function Sidebar({ isOpen }) {
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [name, setName] = useState("My Profile");
  const [incomingReqCount, setIncomingReqCount] = useState(0);
  const [openReqCount, setOpenReqCount] = useState(0);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const ref = doc(db, "users", auth.currentUser.uid);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProfilePhoto(snap.data().photoURL || null);
        setName(snap.data()?.name || "My Profile");
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    let connCount = 0;
    let skillCount = 0;

    const connReqs = query(
      collection(db, "connectionRequests"),
      where("receiverId", "==", auth.currentUser.uid)
    );

    const skillReqs = query(
      collection(db, "skillRequests"),
      where("receiverId", "==", auth.currentUser.uid)
    );

    const unsubConn = onSnapshot(connReqs, (snap) => {
      connCount = snap.docs.filter((d) => {
        const status = d.data().status;
        return !status || status === "pending";
      }).length;
      setIncomingReqCount(connCount + skillCount);
    });

    const unsubSkill = onSnapshot(skillReqs, (snap) => {
      skillCount = snap.docs.filter((d) => {
        const status = d.data().status;
        return !status || status === "pending";
      }).length;
      setIncomingReqCount(connCount + skillCount);
    });

    return () => {
      unsubConn();
      unsubSkill();
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "openRequests"),
      where("status", "==", "open")
    );

    const unsub = onSnapshot(q, (snap) => {
      const count = snap.docs.filter((d) => d.data().createdBy !== auth.currentUser.uid).length;
      setOpenReqCount(count);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const uid = auth.currentUser.uid;
    const chatsQuery = query(
      collection(db, "chats"),
      where("users", "array-contains", uid)
    );

    let latestUnsubs = [];

    const unsubChats = onSnapshot(chatsQuery, (snap) => {
      latestUnsubs.forEach((u) => u());
      latestUnsubs = [];

      if (snap.empty) {
        setUnreadChatsCount(0);
        return;
      }

      const unreadByChat = {};

      snap.docs.forEach((chatDoc) => {
        const lastMessageQuery = query(
          collection(db, "chats", chatDoc.id, "messages"),
          orderBy("createdAt", "desc"),
          limit(1)
        );

        const unsubLast = onSnapshot(lastMessageQuery, (msgSnap) => {
          const latest = msgSnap.docs[0]?.data();

          unreadByChat[chatDoc.id] = Boolean(
            latest &&
            latest.senderId !== uid &&
            !latest.seenBy?.includes(uid) &&
            !latest.hiddenFor?.includes(uid)
          );

          const unreadCount = Object.values(unreadByChat).filter(Boolean).length;
          setUnreadChatsCount(unreadCount);
        });

        latestUnsubs.push(unsubLast);
      });
    });

    return () => {
      unsubChats();
      latestUnsubs.forEach((u) => u());
    };
  }, []);

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=2563eb&color=ffffff`;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div
        className="sidebar-logo"
        onClick={() => navigate("/dashboard")}
      >
        ⚡ SkillX
      </div>

      <nav className="sidebar-menu">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        <NavLink to="/send-request">Send Request</NavLink>
        <NavLink to="/post-open-request">Post Open Request</NavLink>
        <NavLink to="/open-requests">
          Open Requests List
          {openReqCount > 0 && <span className="req-dot"></span>}
        </NavLink>
        <NavLink to="/requests">
          Incoming Requests
          {incomingReqCount > 0 && <span className="req-dot"></span>}
        </NavLink>
        <NavLink to="/messages">
          Messages
          {unreadChatsCount > 0 && <span className="req-dot"></span>}
        </NavLink>
      </nav>

      <div
        className="sidebar-profile"
        onClick={() => navigate("/profile")}
      >
        <img
          src={profilePhoto || avatarFallback}
          alt="profile"
        />
        <div>
          <div className="profile-name">{name}</div>
          <div className="profile-link">View Profile</div>
        </div>
      </div>
    </aside>
  );
}
