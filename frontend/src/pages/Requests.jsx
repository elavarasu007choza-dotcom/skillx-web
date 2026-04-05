import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./Requests.css";

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();
  const user = auth.currentUser;


  const [skillRequests, setSkillRequests] = useState([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "skillRequests"),
      where("receiverId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setSkillRequests(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });

    return () => unsub();
  }, [user]);


  // 🔥 FETCH INCOMING REQUESTS
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "connectionRequests"),
      where("receiverId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRequests(data);
    });

    return () => unsub();
  }, [user]);

  // ✅ ACCEPT REQUEST
  const acceptRequest = async (id) => {
    try {
      await updateDoc(doc(db, "connectionRequests", id), {
        status: "accepted",
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ❌ REJECT REQUEST
  const rejectRequest = async (id) => {
    try {
      await deleteDoc(doc(db, "connectionRequests", id));
    } catch (err) {
      console.error(err);
    }
  };

  const acceptSkill = async (id) => {
    await updateDoc(doc(db, "skillRequests", id), {
      status: "accepted",
    });
  };

  const rejectSkill = async (id) => {
    await deleteDoc(doc(db, "skillRequests", id));
  };

  return (
    <div className="requests-page">

      {/* LEFT SIDE → Connection Requests */}
      <div className="left">
        <h2>📥 Connection Requests</h2>

        {requests.length === 0 && <p>No requests</p>}

        {requests.map((r) => (
          <div
            key={r.id}
            className="request-card"
            onClick={() => navigate(`/user/${r.senderId}`)}
          >
            <div className="request-user">
              <img
                src={
                  r.senderPhoto ||
                  `https://ui-avatars.com/api/?name=${r.senderName}`
                }
                alt=""
              />

              <div>
                <h4>{r.senderName}</h4>
                <p>🤝 Connection request</p>
              </div>
            </div>

            <div
              className="request-actions"
              onClick={(e) => e.stopPropagation()}
            >
              {r.status === "pending" ? (
                <>
                  <button onClick={() => acceptRequest(r.id)}>
                    ✅ Accept
                  </button>
                  <button onClick={() => rejectRequest(r.id)}>
                    ❌ Reject
                  </button>
                </>
              ) : (
                <span>✅ Connected</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 🔥 MIDDLE SIDE → Skill Requests (YOU WANT THIS) */}
      <div className="middle">
        <h2>📤 Sent Skill Requests</h2>

        {skillRequests.length === 0 && <p>No skill requests</p>}

        {skillRequests.map((r) => (
          <div
            key={r.id}
            className="request-card"
            onClick={() => navigate(`/user/${r.senderId}`)}
          >
            <div className="request-user">
              <img
                src={
                  r.senderPhoto ||
                  `https://ui-avatars.com/api/?name=${r.senderName}`
                }
                alt=""
              />

              <div>
                <h4>{r.senderName}</h4>
                <p><b>Skill:</b> {r.skill}</p>
                <p><b>Message:</b> {r.message}</p>
              </div>
            </div>

            <div
              className="request-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => acceptSkill(r.id)}>
                ✅ Accept
              </button>

              <button onClick={() => rejectSkill(r.id)}>
                ❌ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
      

    </div>
  )};