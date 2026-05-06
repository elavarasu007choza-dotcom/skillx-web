import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./OpenRequestsList.css";
import BackButton from "../components/BackButton";
import { sendNotification } from "../utils/sendNotification";

function OpenRequestsList() {
  const user = auth.currentUser;
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);

  const [suggestedUsers, setSuggestedUsers] = useState([]);

  const deleteRequest = async (id) => {
    try {
      await deleteDoc(doc(db, "openRequests", id));
    } catch (err) {
      console.error(err);
    }
  };


  const [userSkills, setUserSkills] = useState([]);

  /* ===============================
     🔹 LOAD USER SKILLS
     =============================== */
  useEffect(() => {
    if (!user) return;

    const loadUserSkills = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setUserSkills(
          (snap.data().learnSkills || []).map((s) => s.toLowerCase())
        );
      }
    };

    loadUserSkills();
  }, [user]);

  useEffect(() => {
    if (!user || userSkills.length === 0) return;

    const q = query(collection(db, "users"));

    const unsub = onSnapshot(q, (snap) => {
      const allUsers = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 🔥 AI LOGIC (Profile + Rating)
      const filtered = allUsers.filter((u) => {
        return (
          u.id !== user.uid &&

          // 🔥 skill match
          u.teachSkills?.some((s) =>
            userSkills.some((skill) =>
            s.name?.toLowerCase().includes(skill.toLowerCase())
          ) 
        )&&

          // 🔥 rating filter
          (u.rating || 0) >= 3
        );
      });

      setSuggestedUsers(filtered);
    });

    return () => unsub();
  }, [user, userSkills]);

  /* ===============================
     🔹 LOAD OPEN REQUESTS
     =============================== */
  useEffect(() => {
    const q = query(
      collection(db, "openRequests"),
      where("status", "==", "open"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setRequests(data);
    });


    return () => unsub();
  }, []);

  const getMutualMatches = () => {
    return requests.filter((r1) => {
      return requests.some((r2) => {
        if (r1.createdBy === r2.createdBy) return false;

        const r1Need = r1.skill;
        const r1Skills = r1.mySkills || [];

        const r2Need = r2.skill;
        const r2Skills = r2.mySkills || [];

        return (
          r2Skills.includes(r1Need) &&  // other can teach me
          r1Skills.includes(r2Need)    // I can teach other
        );
      });
    });
  };

  /* ===============================
     🔹 ACCEPT REQUEST
     =============================== */
  const acceptRequest = async (req) => {
    if (!user) {
      alert("Login required");
      return;
    }

    if (req.createdBy === user.uid) {
      alert("You cannot accept your own request");
      return;
    }

    await updateDoc(doc(db, "openRequests", req.id), {
      status: "accepted",
      acceptedBy: user.uid,
    });

    await sendNotification(
      req.createdBy,
      `Your open request "${req.skill}" was accepted!`,
      "match",
      "Open Request Accepted"
    );

    navigate("/messages");
  };


  return (
    <div className="openreq-container">
      <BackButton />

      {/* 🔹 LEFT SIDE – OPEN REQUESTS */}
      <div className="left">
        <h2>Open Requests</h2>

        <div className="open-requests-scroll">
          {requests.length === 0 && (
            <p>No open requests available</p>
          )}

          {requests.map((r) => {

            return (
              <div
                key={r.id}

                className="card request-entry clickable-card"
                onClick={() => navigate(`/user/${r.createdBy}`)}
              >


              {/* 🔹 PROFILE */}
              <div className="request-owner-row">
                <img
                  className="request-owner-img"
                  src={
                    r.photoURL ||
                    `https://ui-avatars.com/api/?name=${r.name || "User"}`
                  }
                  alt={r.name || "User"}
                />

                <p className="request-owner-name"><b>{r.name || "User"}</b></p>
              </div>

              {/* 🔹 SKILL */}
              <p><b>📘 Skill Need: {r.skill}</b></p>
              {/* 🔹 DESCRIPTION */}
              <p>{r.description || "-"}</p>
              {/* 🔹 MY SKILLS */}
              {r.mySkills && r.mySkills.length > 0 && (
                <p>🎯 I can teach: {r.mySkills.join(", ")}</p>
              )}

              {r.createdBy === user?.uid ? (
                <button
                  className="small-btn close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRequest(r.id);
                  }}
                >
                  Delete
                </button>
              ) : (
                <button
                  className="small-btn accept-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    acceptRequest(r);
                  }}
                >
                  Accept
                </button>
              )}



              {/* 🔥 TAG CHIPS UI */}
              {Array.isArray(r.tags) && r.tags.length > 0 && (
                <div className="tags">
                  {r.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="tag"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <p>
                Status:{" "}
                {r.status === "open" ? "🟢 Open" : "🟡 Accepted"}
              </p>

              {r.createdBy === user?.uid ? (
                <p><b>Your request</b></p>
              ) : null
              }

                <hr className="request-divider" />
              </div>
            );
          })}
        </div>
      </div>

      {/* 🔹 RIGHT SIDE – AI STATS + SUGGESTIONS */}
      <div className="right">

        <div className="panel">
          <h3>Stats</h3>
          <p>
            <b>Total Open Requests:</b> {requests.length}
          </p>
        </div>

        <div className="panel ai-suggestions-panel">
          <h3>🤖 AI Suggested Users</h3>

          <div className="ai-suggestions-scroll">
            {suggestedUsers.length === 0 && (
              <p>No suggestions yet</p>
            )}

            {suggestedUsers.map((u) => (
              <div
                key={u.id}
                className="suggest clickable-card"
                onClick={() => navigate(`/user/${u.id}`)}
              >
                <img
                  className="request-owner-img"
                  src={
                    u.photoURL ||
                    `https://ui-avatars.com/api/?name=${u.name || "User"}`
                  }
                  alt={u.name || "User"}
                />

                <p><b>{u.name}</b></p>

                <p>⭐ Rating: {u.rating || 0}</p>

                <p>
                  🎯 Can teach:{" "}
                  {u.teachSkills?.map((s) => s.name).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel mutual-matches-panel">
          <h3>🔥 Mutual Matches</h3>

          <div className="mutual-matches-scroll">
            {getMutualMatches()
              .filter((r) => r.createdBy !== user?.uid)
              .map((r) => (
                <div
                  key={r.id}
                  className="suggest clickable-card"
                  onClick={() => navigate(`/user/${r.createdBy}`)}
                >
                  <div className="request-owner-row">
                    <img
                      className="request-owner-img"
                      src={
                        r.photoURL ||
                        `https://ui-avatars.com/api/?name=${r.name || "User"}`
                      }
                      alt={r.name || "User"}
                    />

                    <p className="request-owner-name"><b>{r.name || "User"}</b></p>
                  </div>

                  <p><b>🤝 Skill Matched: {r.skill}</b></p>
                  <p>🔥 Mutual exchange is possible</p>

                  <button
                    className="small-btn accept-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      acceptRequest(r);
                    }}
                  >
                    Accept
                  </button>
                </div>
              ))}

            {getMutualMatches().filter((r) => r.createdBy !== user?.uid).length === 0 && (
              <p>No mutual matches yet</p>
            )}
          </div>
        </div>

        <div className="panel info-panel">
          <h3>Status Info</h3>
          <p>🟢 Open – Anyone can accept</p>
          <p>🟡 Accepted – Collaboration started</p>
        </div>

        <div className="panel info-panel">
          <h3>Tips</h3>
          <ul>
            <li>Accept only one request at a time</li>
            <li>You cannot accept your own request</li>
          </ul>
        </div>
      </div>
    </div >
  );
}

export default OpenRequestsList;
