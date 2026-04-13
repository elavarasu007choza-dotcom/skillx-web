import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getDoc } from "firebase/firestore";
import BackButton from "../components/BackButton";

export default function MySessions() {
  const [sessions, setSessions] = useState([]);
  const [usersMap, setUsersMap] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setUsersMap(map);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "scheduledSessions"),
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      setSessions(list);
    });

    return () => unsub();
  }, []);

  const cancelSession = async (id) => {
    if (!window.confirm("Cancel this session?")) return;
    await updateDoc(doc(db, "scheduledSessions", id), { status: "cancelled" });
    alert("Session Cancelled");
  };

  const deleteSession = async (id) => {
    if (!window.confirm("Delete this session?")) return;
    await deleteDoc(doc(db, "scheduledSessions", id));
    alert("Session Deleted");
  };

  const formatSessionTime = (session) => {
    if (session.scheduledDate) {
      return session.scheduledDate.toDate().toLocaleString();
    }
    if (session.date && session.time) {
      return `${session.date} at ${session.time}`;
    }
    return "No date set";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "scheduled": return "#3b82f6";
      case "completed": return "#22c55e";
      case "cancelled": return "#ef4444";
      default: return "#6b7280";
    }
  };

  return (
    <div style={{ padding: "30px", background: "#f1f5f9", minHeight: "100vh" }}>
      <BackButton />
      <h2 style={{ marginBottom: "20px" }}>📅 My Sessions</h2>

      {sessions.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "40px",
          background: "white",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <p style={{ fontSize: "18px", color: "#64748b" }}>No sessions scheduled</p>
        </div>
      )}

      {sessions.map((s) => {
        const otherUserId = s.teacherId === auth.currentUser.uid ? s.learnerId : s.teacherId;
        const otherUser = usersMap[otherUserId];
        const otherName = otherUser?.name || "User";

        return (
          <div key={s.id} style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            marginBottom: "15px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "15px"
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <img
                  src={otherUser?.photoURL || `https://ui-avatars.com/api/?name=${otherName}`}
                  alt={otherName}
                  style={{ width: "40px", height: "40px", borderRadius: "50%" }}
                />
                <div>
                  <h4 style={{ margin: 0 }}>{otherName}</h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    {s.skill || "Skill Exchange"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "20px", fontSize: "13px", color: "#475569" }}>
                <span>📅 {formatSessionTime(s)}</span>
                <span style={{
                  color: getStatusColor(s.status),
                  fontWeight: "600",
                  textTransform: "capitalize"
                }}>
                  ● {s.status || "scheduled"}
                </span>
              </div>
            </div>

            {s.status === "scheduled" && (
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => cancelSession(s.id)}
                  style={{
                    padding: "8px 16px",
                    background: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "13px"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteSession(s.id)}
                  style={{
                    padding: "8px 16px",
                    background: "#6b7280",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "13px"
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
