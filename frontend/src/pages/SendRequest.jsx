import { useEffect, useState, useMemo } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./SendRequest.css";
import { deleteDoc } from "firebase/firestore";

function SendRequest() {
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "requests", id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };
  const [users, setUsers] = useState([]);
  const [skillMap, setSkillMap] = useState({});
  const [messageMap, setMessageMap] = useState({});
  const [myRequests, setMyRequests] = useState([]);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  /* 🔹 Load users */
  useEffect(() => {
    if (!auth.currentUser) return;

    const loadUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      setUsers(
        snap.docs
          .filter((d) => d.id !== auth.currentUser.uid)
          .map((d) => ({ uid: d.id, ...d.data() }))
      );
    };

    loadUsers();
  }, []);

  /* 🔹 Load requests */
  useEffect(() => {
    if (!auth.currentUser) return;

    const loadMyRequests = async () => {
      const q = query(
        collection(db, "requests"),
        where("from", "==", auth.currentUser.uid)
      );

      const snap = await getDocs(q);
      setMyRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    loadMyRequests();
  }, []);

  /* 🔹 Filter */
  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      u.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  /* 🔹 Check pending */
  const isPending = (uid) =>
    myRequests.some((r) => r.to === uid && r.status === "pending");

  /* 🔹 Send Request */
  const handleSend = async (userId) => {
    const skill = skillMap[userId] || "";
    const message = messageMap[userId] || "";

    if (!skill.trim()) {
      alert("Enter skill");
      return;
    }

    await addDoc(collection(db, "skillRequests"), {
      senderId: auth.currentUser.uid,
      receiverId: userId,
      senderName: auth.currentUser.displayName || "User",
      senderPhoto: auth.currentUser.photoURL || "",
      skill,
      message,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    alert("Request Sent ✅");
  };

  /* ❌ Cancel */
  const cancelRequest = async (id) => {
    await updateDoc(doc(db, "requests", id), {
      status: "cancelled",
    });
  };

  return (
    <div className="send-page">

      {/* 🔍 SEARCH */}
      <input
        className="search-bar"
        placeholder="🔍 Search user..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* 🔥 MAIN LAYOUT */}
      <div className="main-layout">

        {/* 👤 USERS GRID */}
        <div className="users-section">
          <div className="users-grid">
            {filteredUsers.map((u) => (
              <div
                key={u.uid}
                className="user-card"
                onClick={() => navigate(`/user/${u.uid}`)}


              >

                {/* PROFILE IMAGE */}
                <img
                  src={
                    u.photoURL ||
                    `https://ui-avatars.com/api/?name=${u.name || "User"}`
                  }
                  style={{
                    width: "70px",
                    height: "70px",
                    borderRadius: "50%",
                    marginBottom: "10px"
                  }}
                  alt="profile"
                />

                {/* NAME */}
                <h4 style={{ margin: "5px 0" }}>{u.name}</h4>

                {/* RATING */}
                <p style={{ margin: 0, fontSize: "12px" }}>
                  ⭐ {u.rating || 0}
                </p>

                <br />

                {/* INPUTS */}
                <input
                  placeholder="Skill"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setSkillMap({ ...skillMap, [u.uid]: e.target.value })
                  }
                  style={{ width: "100%", marginBottom: "5px" }}
                />

                <input
                  placeholder="Message"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setMessageMap({ ...messageMap, [u.uid]: e.target.value })
                  }
                  style={{ width: "100%", marginBottom: "5px" }}
                />

                {/* BUTTON */}
                {isPending(u.uid) ? (
                  <button disabled style={{ background: "orange" }}>
                    ⏳ Pending
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSend(u.uid);
                    }}
                  >
                    Connect
                  </button>
                )}

              </div>
            ))}
          </div>
        </div>

        {/* 📌 MY REQUESTS (RIGHT SMALL BOX) */}
        <div className="request-panel">
          <h3>My Requests</h3>

          {myRequests.map((r) => (
            <div key={r.id} className="request-card">

              <div className="request-top">
                <h4 className="request-name">{r.toName || "User"}</h4>
                <span className={`status ${r.status}`}>
                  {r.status}
                </span>
              </div>

              <p className="request-skill">{r.skill}</p>

              <div className="request-actions">
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(r.id)}
                >
                  Cancel
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SendRequest;