import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import "./OpenRequest.css";
import { deleteDoc ,getDoc} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import BackButton from "../components/BackButton";
import { sendNotification } from "../utils/sendNotification";

function OpenRequests() {
  const user = auth.currentUser;
const navigate = useNavigate();
  // 🔹 LEFT SIDE STATES
  const [skill, setSkill] = useState("");
  const [description, setDescription] = useState("");
  const [mySkills, setMySkills] = useState("");
  // 🔹 MY OPEN REQUESTS
  const [myRequests, setMyRequests] = useState([]);

  // 🆕 ALL OPEN REQUESTS
  const [allOpenRequests, setAllOpenRequests] = useState([]);

  /* ===============================
     🆕 AUTO TAG GENERATOR (NEW FEATURE)
     =============================== */
  const generateTags = (skillText = "", descText = "") => {
    const text = (skillText + " " + descText).toLowerCase();
    const tags = [];

    // 🔹 Frontend
    if (text.includes("react")) tags.push("react", "frontend");
    if (text.includes("html")) tags.push("html", "frontend");
    if (text.includes("css")) tags.push("css", "frontend");
    if (text.includes("javascript")) tags.push("javascript", "frontend");

    // 🔹 Backend
    if (text.includes("java")) tags.push("java", "backend");
    if (text.includes("python")) tags.push("python", "backend");
    if (text.includes("node")) tags.push("node", "backend");
    if (text.includes("api")) tags.push("backend");

    // 🔹 Database
    if (text.includes("sql")) tags.push("database");
    if (text.includes("mysql")) tags.push("database");
    if (text.includes("mongo")) tags.push("mongodb", "database");

    // 🔹 Data / AI
    if (text.includes("ml") || text.includes("machine learning"))
      tags.push("ml", "data");
    if (text.includes("ai")) tags.push("ai", "data");
    if (text.includes("data")) tags.push("data");

    // 🔹 Remove duplicates
    return [...new Set(tags)];
  };

  /* ===============================
     🔹 LOAD MY OPEN REQUESTS
     =============================== */
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "openRequests"),
      where("createdBy", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setMyRequests(data);
    });

    return () => unsub();
  }, [user]);

  /* ===============================
     🆕 LOAD ALL OPEN REQUESTS
     =============================== */
  useEffect(() => {
    const q = query(
      collection(db, "openRequests"),
      where("status", "==", "open")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAllOpenRequests(data);
    });

    return () => unsub();
  }, []);

  /* ===============================
     🔹 POST OPEN REQUEST
     =============================== */
  const handlePost = async () => {
    
    if (!user) return alert("Login required");
    if (!skill.trim()) return alert("Enter skill");

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    await addDoc(collection(db, "openRequests"), {
      skill: skill.trim().toLowerCase(),
      description: description.trim(),
      tags: generateTags(skill, description), // 🔥// AUTO TAGS ADDED
      mySkills: mySkills.toLowerCase().split(",").map((s) =>
        s.trim()),

      status: "open",
      createdBy: user.uid,

      name: userData?.name || user.email,
      photoURL: userData?.photoURL || "",

      createdAt: serverTimestamp(),
    });

    setSkill("");
    setDescription("");
  };

  /* ===============================
     ❌ CLOSE REQUEST (MY REQUEST)
     =============================== */
  const closeRequest = async (id) => {
    await updateDoc(doc(db, "openRequests", id), {
      status: "closed",
    });
  };

  const deleteRequest = async (id) => {
    await deleteDoc(doc(db, "openRequests", id));
  };
  /* ===============================
     ✅ ACCEPT REQUEST (OTHER USERS)
     =============================== */
  const acceptRequest = async (req) => {
    if (!user) return;

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
    <div className="open-page">
      <BackButton />
      <div className="open-layout">

        {/* =================================
          🔹 LEFT SIDE – POST OPEN REQUEST
         ================================= */}
        <div className="card left-panel">
          <h2>Post Open Request</h2>

          <input
            className="input"
            placeholder="Skill"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          />



          <textarea
            className="input"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="input"
            placeholder="My Skills (java, react)"
            value={mySkills}
            onChange={(e) => setMySkills(e.target.value)}
          />


          <button className="btn" onClick={handlePost}>
            🚀 Post Request
          </button>




          <h4>ℹ️ How Open Requests Work</h4>
          <ul className="info-list">
            <li>Post an open skill request</li>
            <li>Other users can accept it</li>
            <li>Once accepted, collaboration starts</li>
            <li>You can close it anytime</li>
          </ul>
        </div>



        {/* =================================
          🔹 MIDDLE – ALL OPEN REQUESTS
         ================================= */}
        <div className="card middle-panel">
          <h2>Community Requests</h2>

          <div className="community-requests-scroll">
            {allOpenRequests.length === 0 && (
              <p>No open requests available</p>
            )}

            {allOpenRequests.map((r) => (
              <div key={r.id} className="request-card clickable-card"
                onClick={() => navigate(`/user/${r.createdBy}`)}
              >

                <div className="request-owner-row">
                  <img
                    className="request-owner-img"
                    src={r.photoURL || `https://ui-avatars.com/api/?name=${r.name}`
                    }
                    alt={r.name || "User"}
                  />
                  <p className="request-owner-name"><b>{r.name || "User"}</b></p>
                </div>

                <p><b>📘 Skill Need: {r.skill}</b></p>
                <p>{r.description}</p>
                {r.mySkills && r.mySkills.length > 0 && (
                  <p>🎯 I can teach: {r.mySkills.join(", ")}</p>
                )}

                {r.createdBy !== user?.uid && (
                  <button
                    className="small-btn accept-btn"
                    onClick={() => acceptRequest(r)}
                  >
                    Accept
                  </button>
                )}

                {r.createdBy === user?.uid && (
                  <button
                    className="small-btn close-btn"
                    onClick={() => deleteRequest(r.id)}
                  >
                    Delete
                  </button>
                )}

              </div>
            ))}
          </div>
        </div>


        {/* =================================
          🔹 RIGHT – MY OPEN REQUESTS
         ================================= */}
        <div className="card right-panel">
          <h2>My Requests</h2>

          <div className="my-requests-scroll">
            {myRequests.length === 0 && (
              <p>No open requests posted yet</p>
            )}

            {myRequests.map((r) => (
              <div key={r.id} className="request-card my-request-card">
                <p><b>{r.skill}</b></p>

                <span className={`status ${r.status}`}>
                  {r.status}
                </span>

                <div className="my-request-actions">
                  {r.status === "open" && (
                    <button
                      className="icon-btn close-icon"
                      onClick={() => closeRequest(r.id)}
                      title="Close Request"
                    >
                      ❌
                    </button>
                  )}
                  <button
                    className="icon-btn delete-icon"
                    onClick={() => deleteRequest(r.id)}
                    title="Delete Request"
                  >
                    🗑️
                  </button>
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpenRequests;
