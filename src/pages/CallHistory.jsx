import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  deleteDoc,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import BackButton from "../components/BackButton";

export default function CallHistory() {
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const q = query(
      collection(db, "callHistory"),
      where("participants", "array-contains", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })).filter((item) => !(item.hiddenFor || []).includes(auth.currentUser.uid));
      setCalls(list);
    });

    return () => unsub();
  }, []);

  const formatTime = (sec) => {
    if (!sec || sec === 0) return "N/A";
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const deleteHistoryItem = async (id) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const ok = window.confirm("Delete this call history entry?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "callHistory", id));
    } catch (err) {
      try {
        await updateDoc(doc(db, "callHistory", id), {
          hiddenFor: arrayUnion(uid),
        });
      } catch (fallbackErr) {
        console.error("Delete failed", fallbackErr);
        alert("Unable to delete call history now");
        return;
      }
    }

    setCalls((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div style={{ padding: "20px" }}>
      <BackButton />
      <h2>Call History</h2>

      {calls.length === 0 && <p>No calls yet</p>}

      {calls.map((c) => (
        <div
          key={c.id}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginTop: "10px",
            borderRadius: "10px",
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={() => deleteHistoryItem(c.id)}
            title="Delete call history"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#be123c",
              borderRadius: "8px",
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            🗑️
          </button>
          <p>📞 Type: {c.type || "video"}</p>
          <p>📊 Status: {c.status}</p>
          <p>⏱ Duration: {formatTime(c.duration)}</p>
          <p>
            📅 {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : "N/A"}
          </p>
        </div>
      ))}
    </div>
  );
}
