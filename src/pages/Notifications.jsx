import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, deleteDoc } from "firebase/firestore";
import "./Notifications.css";
import BackButton from "../components/BackButton";

export default function Notifications() {
  const [list, setList] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, []);

  const markAsRead = async (id) => {
    await updateDoc(doc(db, "notifications", id), { seen: true });
  };

  const markAllRead = async () => {
    const unread = list.filter((n) => !n.seen);
    for (const n of unread) {
      await updateDoc(doc(db, "notifications", n.id), { seen: true });
    }
  };

  const deleteNotification = async (id) => {
    await deleteDoc(doc(db, "notifications", id));
  };

  const timeAgo = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const past = timestamp.toDate();
    const diff = Math.floor((now - past) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  };

  const getIcon = (type) => {
    switch (type) {
      case "call": return "📞";
      case "request": return "📨";
      case "match": return "🤝";
      case "session": return "📅";
      case "review": return "⭐";
      case "certificate": return "🎓";
      case "connection": return "🔗";
      default: return "🔔";
    }
  };

  return (
    <div className="notif-page">
      <BackButton />
      <div className="notif-header">
        <h2>🔔 Notifications</h2>
        {list.some((n) => !n.seen) && (
          <button className="mark-all-btn" onClick={markAllRead}>Mark all as read</button>
        )}
      </div>

      {list.length === 0 && (
        <div className="notif-empty">No notifications yet</div>
      )}

      {list.map((n) => (
        <div
          key={n.id}
          className={`notif-item type-${n.type || "default"} ${!n.seen ? "unread" : ""}`}
          onClick={() => markAsRead(n.id)}
        >
          <div className="notif-icon">{getIcon(n.type)}</div>
          <div className="notif-content">
            {n.title && <p className="notif-title">{n.title}</p>}
            <p className="notif-message">{n.message}</p>
            <span className="notif-time">{timeAgo(n.createdAt)}</span>
          </div>
          {!n.seen && <span className="notif-dot" />}
          {n.type === "session" && (
            <button
              className="notif-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                deleteNotification(n.id);
              }}
              title="Delete session notification"
              aria-label="Delete session notification"
            >
              🗑️
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
