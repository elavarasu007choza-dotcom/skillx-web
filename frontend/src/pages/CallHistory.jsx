import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";

export default function CallHistory() {
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "callHistory"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setCalls(list);
    });

    return () => unsub();
  }, []);

  const formatTime = (sec) => {
    if (!sec) return "00:00";
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>📞 Call History</h2>

      {calls.length === 0 && <p>No calls yet</p>}

      {calls.map((c) => (
        <div
          key={c.id}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginTop: "10px",
            borderRadius: "10px",
          }}
        >
          <p>📞 Type: {c.type}</p>
          <p>📊 Status: {c.status}</p>
          <p>⏱ Duration: {formatTime(c.duration)}</p>
          <p>
            📅 {c.createdAt?.toDate().toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}