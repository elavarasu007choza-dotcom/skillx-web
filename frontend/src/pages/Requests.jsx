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
import BackButton from "../components/BackButton";

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const navigate = useNavigate();
  const user = auth.currentUser;


  const [skillRequests, setSkillRequests] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.forEach((item) => {
        map[item.id] = item.data();
      });
      setUsersMap(map);
    });

    return () => unsub();
  }, []);

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
        })).filter((req) => req.status !== "accepted")
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
      setRequests(data.filter((req) => req.status !== "accepted"));
    });

    return () => unsub();
  }, [user]);

  // ✅ ACCEPT REQUEST
  const acceptRequest = async (id, senderId) => {
    try {
      await updateDoc(doc(db, "connectionRequests", id), {
        status: "accepted",
      });
      navigate(`/messages/${senderId}`);
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
    navigate("/messages");
  };

  const rejectSkill = async (id) => {
    await deleteDoc(doc(db, "skillRequests", id));
    navigate("/messages");
  };

  return (
    <div className="requests-page">
      <BackButton />
      <div className="requests-header">
        <h1>Incoming Requests</h1>
        <p>Accept and manage your new connections and skill requests.</p>
      </div>

      <div className="requests-grid">

      {/* LEFT SIDE → Connection Requests */}
      <div className="left">
        <h2>📥 Connection Requests</h2>

        <div className="requests-list-scroll">

          {requests.length === 0 && <p>No requests</p>}

          {requests.map((r) => {
            const profile = usersMap[r.senderId] || {};
            const senderName = profile.name || r.senderName || "User";
            const senderPhoto =
              profile.photoURL ||
              r.senderPhoto ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}`;

            return (
              <div
                key={r.id}
                className="request-card"
                onClick={() => navigate(`/user/${r.senderId}`)}
              >
                <div className="request-user">
                  <img src={senderPhoto} alt={senderName} />

                  <div>
                    <h4>{senderName}</h4>
                    <p>🤝 Connection request</p>
                  </div>
                </div>

                <div
                  className="request-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button onClick={() => acceptRequest(r.id, r.senderId)}>
                    ✅ Accept
                  </button>
                  <button onClick={() => rejectRequest(r.id)}>
                    ❌ Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🔥 MIDDLE SIDE → Skill Requests (YOU WANT THIS) */}
      <div className="middle">
        <h2>📘 Incoming Skill Requests</h2>

        <div className="requests-list-scroll">

          {skillRequests.length === 0 && <p>No skill requests</p>}

          {skillRequests.map((r) => {
            const profile = usersMap[r.senderId] || {};
            const senderName = profile.name || r.senderName || "User";
            const senderPhoto =
              profile.photoURL ||
              r.senderPhoto ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}`;

            return (
              <div
                key={r.id}
                className="request-card"
                onClick={() => navigate(`/user/${r.senderId}`)}
              >
                <div className="request-user">
                  <img src={senderPhoto} alt={senderName} />

                  <div>
                    <h4>{senderName}</h4>
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
            );
          })}
        </div>
      </div>

      </div>

    </div>
  )};
