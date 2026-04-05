import { useEffect } from "react";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import SessionReminder from "../components/SessionReminder";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";


export default function Dashboard() {
  const navigate = useNavigate();
  const [callHistory, setCallHistory] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [stats, setStats] = useState({
    skills: 0,
    incoming: 0,
    open: 0,
    matches: 0,
  });
  const [chartData, setChartData] = useState([
    { day: "Mon", calls: 2 },
    { day: "Tue", calls: 5 },
    { day: "Wed", calls: 3 },
    { day: "Thu", calls: 6 },
    { day: "Fri", calls: 4 },
  ]);

  const timeAgo = (timestamp) => {
    if (!timestamp) return "";

    const now = new Date();
    const past = timestamp.toDate();
    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + " mins ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " hrs ago";
    return Math.floor(diff / 86400) + " days ago";
  };

  const [toast, setToast] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  /* ---------------- ONLINE / LAST SEEN ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);

    updateDoc(userRef, {
      online: true,
      lastSeen: serverTimestamp(),
    });

    const handleOffline = async () => {
      await updateDoc(userRef, {
        online: false,
        lastSeen: serverTimestamp(),
      });
    };

    window.addEventListener("beforeunload", handleOffline);

    return () => {
      handleOffline();
      window.removeEventListener("beforeunload", handleOffline);
    };
  }, []);

  /* ---------------- INCOMING CALL ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "calls"),
      where("receiver", "==", auth.currentUser.uid),
      where("status", "==", "ringing")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {

        const callDoc = snapshot.docs[0];
        const data = callDoc.data();
        if (data.status === "ringing") {
          setToast("📞 Incoming Call...");
        }
        const accept = window.confirm(
          `📞 Incoming call from ${data.caller}. Accept?`
        );

        if (accept) {
          updateDoc(doc(db, "calls", callDoc.id), {
            status: "accepted",
          });
          navigate(`/video-call/${data.roomID}`);
        } else {
          updateDoc(doc(db, "calls", callDoc.id), {
            status: "rejected",
          });
        }
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.forEach(doc => {
        map[doc.id] = doc.data().name || "User";
      });
      setUserMap(map);
    });

    return () => unsub();
  }, []);

  /* ---------------- CALL HISTORY (REALTIME) ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, "callHistory"),
   
      orderBy("createdAt","desc")
    );
    

    const unsub = onSnapshot(q, (snap) => {
      setCallHistory(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(call =>
          call.caller === auth.currentUser.uid ||
          call.receiver === auth.currentUser.uid
        )
        
      );
    });

    return () => unsub();
  }, []);

  /* ---------------- DASHBOARD REALTIME STATS ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;

    /* ---------------- MY SKILLS ---------------- */
    const userRef = doc(db, "users", uid);

    const unsubUser = onSnapshot(userRef, (docSnap) => {
      const data = docSnap.data();
      setStats((prev) => ({
        ...prev,
        skills: data?.skills?.length || 0,
      }));
    });

    /* ---------------- INCOMING REQUESTS ---------------- */
    const incomingQuery = query(
      collection(db, "requests"),
      where("receiver", "==", uid),
      where("status", "==", "pending")
    );

    const unsubIncoming = onSnapshot(incomingQuery, (snap) => {
      setStats((prev) => ({
        ...prev,
        incoming: snap.size,
      }));
    });

    /* ---------------- OPEN REQUESTS ---------------- */
    const openQuery = query(
      collection(db, "requests"),
      where("status", "==", "open")
    );

    const unsubOpen = onSnapshot(openQuery, (snap) => {
      setStats((prev) => ({
        ...prev,
        open: snap.size,
      }));
    });

    /* ---------------- ACTIVE MATCHES ---------------- */
    const matchQuery = query(
      collection(db, "requests"),
      where("status", "==", "accepted"),
      where("participants", "array-contains", uid)
    );

    const unsubMatches = onSnapshot(matchQuery, (snap) => {
      setStats((prev) => ({
        ...prev,
        matches: snap.size,
      }));
    });

    return () => {
      unsubUser();
      unsubIncoming();
      unsubOpen();
      unsubMatches();
    };
  }, []);

  /* ---------------- LIVE ACTIVITY ---------------- */
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "requests"));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => doc.data());
      setActivities(data.slice(0, 5));
    });

    return () => unsub();
  }, []);

  /* ---------------- ONLINE USERS ---------------- */
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "users"), where("online", "==", true));

    const unsub = onSnapshot(q, (snap) => {
      setOnlineUsers(
        snap.docs.map(d => d.data().name || "User")
      );
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      setToast("🔥 New Request Received!");
    }, 3000);
  }, []);

  useEffect(() => {
    if (stats.skills > 0) {
      setSuggestions([
        "Learn Node.js",
        "Explore MongoDB",
        "Connect with similar users",
      ]);
    }
  }, [stats]);


  const logout = async () => {
    if (auth.currentUser) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        online: false,
        lastSeen: serverTimestamp(),
      });
    }
    await signOut(auth);
    window.location.href = "/login";
  };


  /* ---------------- BUTTON ACTIONS ---------------- */
  const handleStartConnect = () => {
    navigate("/send-request");
  };

  return (
    <div className="dashboard-page">
      
    <div className="dashboard-layout">
      <SessionReminder />
      <Sidebar />

      <div className="dashboard-main">

        {/* {false && profile.photoURL &&<img src={Profile.photoURL}/>} */}
        {/* TOPBAR */}
        <div className="topbar">
          <button onClick={() => navigate("/notifications")}>🔔</button>
          <button onClick={() => navigate("/my-sessions")}>
            📅 My Sessions
          </button>
          <button className="logout-Btn" onClick={logout}> 
            Logout
          </button>
        </div>

        <div className="dashboard-content">
          <h1>Dashboard</h1>
          <p className="subtitle">Realtime Skill Exchange Platform</p>

          {/* STATS */}
          <div className="stats">
            <div className="card">⭐ <h2>{stats.skills}</h2><p>My Skills</p></div>
            <div className="card">📩 <h2>{stats.incoming}</h2><p>Incoming Requests</p></div>
            <div className="card">📂 <h2>{stats.open}</h2><p>Open Requests</p></div>
            <div className="card">⚡ <h2>{stats.matches}</h2><p>Active Matches</p></div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="welcome-box">
            <h3>Welcome 👋 {auth.currentUser?.email}</h3>
            <p>Start connecting and explore realtime collaboration 🚀</p>

            <div className="actions">
              <button onClick={handleStartConnect}>🤝 Start Connect</button>
              <button onClick={() => navigate("/send-request")}>➕ Create Request</button>
              <button>🔍 Find Matches</button>
              <button onClick={() => navigate("/webrtc/demo")}>✏️ Whiteboard</button>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="grid">

            {/* LEFT SIDE */}
            <div className="left">
              <div className="panel">
                <h3>🤖 Recommended</h3>
                <p>• Learn Node.js</p>
                <p>• 2 Matching Requests</p>
                <p>• Connect with Arun</p>
              </div>

              <div className="panel">
                <h3>🏆 Level 4</h3>
                <p>Points: 250</p>
                <p>Badges: 🔥 🎯 🥇</p>
              </div>

              <div className="panel">
                <h3>🤖 AI Suggestions</h3>
                {suggestions.map((s, i) => (
                  <p key={i}>• {s}</p>
                ))}
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="right">
              <div className="panel">
                <h3>🔥 Live Activity</h3>
                {activities.map((item, i) => (
                  <p key={i}>
                    {item.sender || "User"} created request
                  </p>
                ))}
              </div>

              <div className="panel">
                <h3>📞 Recent Calls</h3>
                {callHistory.length === 0 ? (
                  <p>No calls yet</p>
                ) : (
                  callHistory.map(call => (
                    <p key={call.id}>
                      {call.caller === auth.currentUser.uid
                        ? "You"
                        : userMap[call.caller] || "User"}
                      {" - "} -
                      {timeAgo(call.createdAt)}
                    </p>
                  ))
                )}
              </div>

              <div className="panel">
                <h3>🟢 Online Users</h3>
                {onlineUsers.map((user, i) => (
                  <p key={i}>{user}</p>
                ))}
              </div>
            </div>

          </div>

          {/* GRAPH */}
          <div className="graph">
            <h3>📈 Activity Overview</h3>

            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="calls" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {toast && (
          <div className="toast">
            {toast}
          </div>
        )}

        {/* FLOAT CHAT */}
        <div className="chat-btn">💬</div>
</div>

      </div>
    </div>

  );
}