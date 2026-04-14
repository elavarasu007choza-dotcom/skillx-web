import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./GlobalRequestToast.css";

export default function GlobalRequestToast() {
  const [uid, setUid] = useState(null);
  const [queue, setQueue] = useState([]);
  const [activeToast, setActiveToast] = useState("");

  const skillIdsRef = useRef(new Set());
  const connIdsRef = useRef(new Set());
  const openIdsRef = useRef(new Set());

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      skillIdsRef.current = new Set();
      connIdsRef.current = new Set();
      openIdsRef.current = new Set();
      setQueue([]);
      setActiveToast("");
    });
  }, []);

  useEffect(() => {
    if (!activeToast && queue.length > 0) {
      setActiveToast(queue[0]);
      const timer = setTimeout(() => {
        setActiveToast("");
        setQueue((prev) => prev.slice(1));
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [queue, activeToast]);

  const enqueue = (text) => {
    setQueue((prev) => [...prev, text]);
  };

  const queries = useMemo(() => {
    if (!uid) return null;
    return {
      skill: query(
        collection(db, "skillRequests"),
        where("receiverId", "==", uid),
        where("status", "==", "pending")
      ),
      conn: query(
        collection(db, "connectionRequests"),
        where("receiverId", "==", uid),
        where("status", "==", "pending")
      ),
      openAccepted: query(
        collection(db, "openRequests"),
        where("createdBy", "==", uid),
        where("status", "==", "accepted")
      ),
    };
  }, [uid]);

  useEffect(() => {
    if (!queries) return;

    let skillReady = false;
    let connReady = false;
    let openReady = false;

    const unsubSkill = onSnapshot(queries.skill, (snap) => {
      const currentIds = new Set(snap.docs.map((d) => d.id));

      if (skillReady) {
        snap.docs.forEach((d) => {
          if (!skillIdsRef.current.has(d.id)) {
            const data = d.data();
            enqueue(`🔥 New skill request from ${data.senderName || "a user"}`);
          }
        });
      } else {
        skillReady = true;
      }

      skillIdsRef.current = currentIds;
    });

    const unsubConn = onSnapshot(queries.conn, (snap) => {
      const currentIds = new Set(snap.docs.map((d) => d.id));

      if (connReady) {
        snap.docs.forEach((d) => {
          if (!connIdsRef.current.has(d.id)) {
            const data = d.data();
            enqueue(`🤝 New connection request from ${data.senderName || "a user"}`);
          }
        });
      } else {
        connReady = true;
      }

      connIdsRef.current = currentIds;
    });

    const unsubOpenAccepted = onSnapshot(queries.openAccepted, (snap) => {
      const currentIds = new Set(snap.docs.map((d) => d.id));

      if (openReady) {
        snap.docs.forEach((d) => {
          if (!openIdsRef.current.has(d.id)) {
            const data = d.data();
            enqueue(`✅ Your request "${data.skill || "skill"}" got accepted`);
          }
        });
      } else {
        openReady = true;
      }

      openIdsRef.current = currentIds;
    });

    return () => {
      unsubSkill();
      unsubConn();
      unsubOpenAccepted();
    };
  }, [queries]);

  if (!activeToast) return null;

  return <div className="global-toast">{activeToast}</div>;
}
