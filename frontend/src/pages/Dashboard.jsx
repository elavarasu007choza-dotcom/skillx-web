import { useEffect, useRef } from "react";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { auth, db, rtdb } from "../firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { onValue, ref as rtdbRef } from "firebase/database";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import SessionReminder from "../components/SessionReminder";
import { playSound } from "../utils/notificationSound";


export default function Dashboard() {
  const navigate = useNavigate();
  const BOT_WELCOME = "Hi! I am your SkillX AI assistant. Ask me about requests, matches, sessions, and next steps.";
  const [callHistory, setCallHistory] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [userStatusMap, setUserStatusMap] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    skills: 0,
    incoming: 0,
    open: 0,
    matches: 0,
  });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const uid = auth.currentUser.uid;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const toDateVal = (value) => {
      if (!value) return null;
      if (value?.toDate) return value.toDate();
      if (value instanceof Date) return value;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const dayKey = (date) => {
      const d = startOfDay(date);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };

    const buildBase = () => {
      const rows = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const normalized = startOfDay(date);
        rows.push({
          key: dayKey(normalized),
          day: dayNames[normalized.getDay()],
          sessions: 0,
          calls: 0,
          connections: 0,
          requests: 0,
          ratings: 0,
        });
      }
      return rows;
    };

    let sessionsData = [];
    let callsData = [];
    let connInData = [];
    let connOutData = [];
    let skillInData = [];
    let skillOutData = [];
    let openReqData = [];
    let ratingsData = [];

    const recomputeOverview = () => {
      const base = buildBase();
      const map = Object.fromEntries(base.map((row) => [row.key, row]));

      const addEvents = (items, bucket, extractor) => {
        items.forEach((item) => {
          const dt = toDateVal(extractor(item));
          if (!dt) return;
          const row = map[dayKey(dt)];
          if (!row) return;
          row[bucket] += 1;
        });
      };

      addEvents(sessionsData, "sessions", (x) => x.scheduledDate || x.createdAt);
      addEvents(callsData, "calls", (x) => x.createdAt);
      addEvents(connInData, "connections", (x) => x.createdAt);
      addEvents(connOutData, "connections", (x) => x.createdAt);
      addEvents(skillInData, "requests", (x) => x.createdAt);
      addEvents(skillOutData, "requests", (x) => x.createdAt);
      addEvents(openReqData, "requests", (x) => x.createdAt);
      addEvents(ratingsData, "ratings", (x) => x.createdAt);

      setChartData(base.map(({ key, ...rest }) => rest));
    };

    const unsubSessions = onSnapshot(
      query(collection(db, "scheduledSessions"), where("participants", "array-contains", uid)),
      (snap) => {
        sessionsData = snap.docs
          .map((d) => d.data())
          .filter((s) => s.status !== "cancelled");
        recomputeOverview();
      }
    );

    const unsubCalls = onSnapshot(
      query(collection(db, "callHistory"), where("participants", "array-contains", uid)),
      (snap) => {
        callsData = snap.docs.map((d) => d.data());
        recomputeOverview();
      }
    );

    const unsubConnIn = onSnapshot(
      query(
        collection(db, "connectionRequests"),
        where("receiverId", "==", uid),
        where("status", "==", "accepted")
      ),
      (snap) => {
        connInData = snap.docs.map((d) => d.data());
        recomputeOverview();
      }
    );

    const unsubConnOut = onSnapshot(
      query(
        collection(db, "connectionRequests"),
        where("senderId", "==", uid),
        where("status", "==", "accepted")
      ),
      (snap) => {
        connOutData = snap.docs.map((d) => d.data());
        recomputeOverview();
      }
    );

    const unsubSkillIn = onSnapshot(
      query(collection(db, "skillRequests"), where("receiverId", "==", uid)),
      (snap) => {
        skillInData = snap.docs.map((d) => d.data());
        recomputeOverview();
      }
    );

    const unsubSkillOut = onSnapshot(
      query(collection(db, "skillRequests"), where("senderId", "==", uid)),
      (snap) => {
        skillOutData = snap.docs.map((d) => d.data());
        recomputeOverview();
      }
    );

    const unsubOpenMine = onSnapshot(
      query(collection(db, "openRequests"), where("createdBy", "==", uid)),
      (snap) => {
        openReqData = snap.docs.map((d) => d.data());
        recomputeOverview();
      }
    );

    const unsubRatings = onSnapshot(
      query(collection(db, "reviews"), where("toUser", "==", uid)),
      (snap) => {
        ratingsData = snap.docs.map((d) => d.data());
        recomputeOverview();
      }
    );

    return () => {
      unsubSessions();
      unsubCalls();
      unsubConnIn();
      unsubConnOut();
      unsubSkillIn();
      unsubSkillOut();
      unsubOpenMine();
      unsubRatings();
    };
  }, []);

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

  const [suggestions, setSuggestions] = useState([]);
  const [mySkills, setMySkills] = useState([]);
  const [learnSkills, setLearnSkills] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [topMatchUser, setTopMatchUser] = useState("");
  const [gamification, setGamification] = useState({ level: 1, points: 0, badges: [] });
  const [notifCount, setNotifCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [topUsers, setTopUsers] = useState([]);
  const [mostActiveUsers, setMostActiveUsers] = useState([]);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [liveUsersCount, setLiveUsersCount] = useState(0);
  const [allUsers, setAllUsers] = useState([]);
  const [dashboardToast, setDashboardToast] = useState("");
  const [isAiBotOpen, setIsAiBotOpen] = useState(false);
  const [botInput, setBotInput] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [botMessages, setBotMessages] = useState([
    { id: 1, role: "bot", text: BOT_WELCOME }
  ]);
  const botScrollRef = useRef(null);
  const toastTimerRef = useRef(null);
  const notifReadyRef = useRef(false);

  useEffect(() => {
    if (!isAiBotOpen || !botScrollRef.current) return;
    botScrollRef.current.scrollTop = botScrollRef.current.scrollHeight;
  }, [botMessages, isAiBotOpen]);
  /* ---------------- NOTIFICATION COUNT (REALTIME) ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid),
      where("seen", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifCount(snap.size);

      if (!notifReadyRef.current) {
        notifReadyRef.current = true;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const data = change.doc.data();
        if (!data?.message) return;

        playSound(data.type || "notification");

        const icon = data.type === "message" ? "💬" : "🔔";
        setDashboardToast(`${icon} ${data.message}`);
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setDashboardToast(""), 3000);
      });
    });

    return () => {
      unsub();
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  /* ---------------- SCHEDULED SESSIONS COUNT ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "scheduledSessions"),
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      const count = snap.docs.filter((d) => {
        const data = d.data();
        const sessionDate = data.scheduledDate?.toDate?.();
        return sessionDate && sessionDate >= now;
      }).length;
      setScheduledCount(count);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      const statusMap = {};
      const users = [];
      setTotalUsersCount(snap.size);
      snap.forEach(doc => {
        const data = doc.data();
        map[doc.id] = data.name || "User";
        statusMap[doc.id] = {
          online: data.online,
          lastSeen: data.lastSeen,
        };
        users.push({ id: doc.id, ...data });
      });
      setUserMap(map);
      setUserStatusMap(statusMap);
      setAllUsers(users);
    });

    return () => unsub();
  }, []);

  /* ---------------- CALL HISTORY (REALTIME) ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, "callHistory")
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
        .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
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
        skills: (data?.teachSkills?.length || 0),
      }));
    });

    /* ---------------- INCOMING REQUESTS (skillRequests) ---------------- */
    const incomingQuery = query(
      collection(db, "skillRequests"),
      where("receiverId", "==", uid),
      where("status", "==", "pending")
    );

    const unsubIncoming = onSnapshot(incomingQuery, (snap) => {
      setStats((prev) => ({
        ...prev,
        incoming: snap.size,
      }));
    });

    /* ---------------- OPEN REQUESTS (openRequests) ---------------- */
    const openQuery = query(
      collection(db, "openRequests"),
      where("status", "==", "open")
    );

    const unsubOpen = onSnapshot(openQuery, (snap) => {
      setStats((prev) => ({
        ...prev,
        open: snap.size,
      }));
    });

    /* ---------------- ACTIVE MATCHES (Mutual Matches) ---------------- */
    const allOpenQuery = query(
      collection(db, "openRequests"),
      where("status", "==", "open")
    );

    const unsubMatches = onSnapshot(allOpenQuery, (snap) => {
      const allRequests = snap.docs.map((d) => ({
        id: d.id,
        createdBy: d.data().createdBy,
        skill: d.data().skill,
        mySkills: d.data().mySkills || [],
      }));

      const myRequests = allRequests.filter((r) => r.createdBy === uid);

      let matchCount = 0;
      let matchedUserIds = [];
      myRequests.forEach((myReq) => {
        allRequests.forEach((otherReq) => {
          if (otherReq.createdBy === uid) return;
          if (
            otherReq.mySkills.includes(myReq.skill) &&
            myReq.mySkills.includes(otherReq.skill)
          ) {
            matchCount++;
            if (!matchedUserIds.includes(otherReq.createdBy)) {
              matchedUserIds.push(otherReq.createdBy);
            }
          }
        });
      });

      setStats((prev) => ({
        ...prev,
        matches: matchCount,
      }));
      setMatchCount(matchCount);

      /* Find top-rated match user */
      if (matchedUserIds.length > 0) {
        const usersRef = collection(db, "users");
        getDocs(usersRef).then((usersSnap) => {
          const allUsers = usersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          const matchedUsers = allUsers.filter((u) =>
            matchedUserIds.includes(u.id)
          );
          matchedUsers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          if (matchedUsers.length > 0) {
            setTopMatchUser(matchedUsers[0].name || "User");
          }
        });
      } else {
        setTopMatchUser("");
      }
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
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const activitiesData = [];
    let unsub1, unsub2, unsub3;

    const loadActivities = async () => {
      unsub1 = onSnapshot(query(collection(db, "openRequests"), orderBy("createdAt", "desc")), (snap) => {
        snap.docs.slice(0, 3).forEach(d => {
          const data = d.data();
          if (data.createdBy !== uid) {
            activitiesData.push({
              id: d.id,
              type: "request",
              message: `${data.name || "Someone"} created a ${data.skill || "skill"} request`,
              time: data.createdAt
            });
          }
        });
        setActivities([...activitiesData].sort((a, b) => (b.time?.toDate?.() || 0) - (a.time?.toDate?.() || 0)).slice(0, 5));
      });

      unsub2 = onSnapshot(query(collection(db, "skillRequests"), orderBy("createdAt", "desc")), (snap) => {
        snap.docs.slice(0, 3).forEach(d => {
          const data = d.data();
          if (data.senderId !== uid) {
            activitiesData.push({
              id: d.id,
              type: "skill",
              message: `${data.senderName || "Someone"} sent a skill request`,
              time: data.createdAt
            });
          } else {
            activitiesData.push({
              id: d.id,
              type: "match",
              message: `Match found with ${data.receiverId ? "user" : "someone"}!`,
              time: data.createdAt
            });
          }
        });
        setActivities([...activitiesData].sort((a, b) => (b.time?.toDate?.() || 0) - (a.time?.toDate?.() || 0)).slice(0, 5));
      });

      unsub3 = onSnapshot(query(collection(db, "reviews"), where("toUser", "==", uid), orderBy("createdAt", "desc")), (snap) => {
        snap.docs.slice(0, 2).forEach(d => {
          const data = d.data();
          activitiesData.push({
            id: d.id,
            type: "rating",
            message: `You got ${data.rating} ⭐ rating from ${data.fromName || "someone"}`,
            time: data.createdAt
          });
        });
        setActivities([...activitiesData].sort((a, b) => (b.time?.toDate?.() || 0) - (a.time?.toDate?.() || 0)).slice(0, 5));
      });

      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if ((userData.sessionsCompleted || 0) >= 1 && (userData.rating || 0) >= 3 && (userData.totalReviews || 0) >= 1) {
          activitiesData.push({
            id: "cert",
            type: "certificate",
            message: `🎓 Certification unlocked! You earned a certificate`,
            time: new Date()
          });
        }
        if ((userData.sessionsCompleted || 0) >= 5) {
          activitiesData.push({
            id: "milestone",
            type: "milestone",
            message: `🔥 Milestone: You've completed 5+ sessions!`,
            time: new Date()
          });
        }
        if ((userData.rating || 0) >= 4.5) {
          activitiesData.push({
            id: "top",
            type: "achievement",
            message: `🏆 You're a Top Mentor with 4.5+ rating!`,
            time: new Date()
          });
        }
      }
      setActivities([...activitiesData].sort((a, b) => (b.time?.toDate?.() || 0) - (a.time?.toDate?.() || 0)).slice(0, 5));
    };

    loadActivities();

    return () => {
      unsub1?.();
      unsub2?.();
      unsub3?.();
    };
  }, []);

  /* ---------------- ONLINE USERS ---------------- */
  const [onlineUids, setOnlineUids] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const isRecentTs = (value, windowMs = 180000) => {
    if (!value) return false;
    const ts = value?.toDate
      ? value.toDate().getTime()
      : typeof value === "number"
        ? value
        : new Date(value).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts <= windowMs;
  };

  useEffect(() => {
    const presenceRef = rtdbRef(rtdb, "presence");

    const unsub = onValue(presenceRef, (snap) => {
      const data = snap.val() || {};
      const activeUids = Object.entries(data)
        .filter(([, status]) => status?.online === true)
        .map(([uid]) => uid);

      setOnlineUids(activeUids);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const fallbackUids = Object.entries(userStatusMap)
      .filter(([, meta]) => meta?.online && isRecentTs(meta?.lastSeen))
      .map(([uid]) => uid);

    const mergedUids = [...new Set([...onlineUids, ...fallbackUids])];
    const othersUids = mergedUids.filter((uid) => uid !== auth.currentUser?.uid);

    setLiveUsersCount(mergedUids.length);
    setOnlineUsers(othersUids.map((uid) => userMap[uid]).filter(Boolean));
  }, [onlineUids, userMap, userStatusMap]);

  /* ---------------- TOP USERS (LEADERBOARD) ---------------- */
  useEffect(() => {
    const q = query(collection(db, "users"));

    const unsub = onSnapshot(q, (snap) => {
      const allUsers = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      const sortedByRating = [...allUsers]
        .filter(u => (u.rating || 0) > 0)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 5);
      setTopUsers(sortedByRating);

      const sortedByActivity = [...allUsers]
        .filter(u => (u.sessionsCompleted || 0) > 0)
        .sort((a, b) => (b.sessionsCompleted || 0) - (a.sessionsCompleted || 0))
        .slice(0, 5);
      setMostActiveUsers(sortedByActivity);
    });

    return () => unsub();
  }, []);

  /* ---------------- AI SUGGESTIONS (REALTIME) ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      const teachSkills = (data?.teachSkills || []).map((s) =>
        typeof s === "string" ? s.toLowerCase() : (s.name || "").toLowerCase()
      );
      const learnSkills = (data?.learnSkills || []).map((s) =>
        typeof s === "string" ? s.toLowerCase() : (s.name || "").toLowerCase()
      );
      const sessionsCompleted = data?.sessionsCompleted || 0;

      const skillMap = {
        java: ["spring boot", "microservices", "backend"],
        javascript: ["react", "node.js", "typescript"],
        react: ["next.js", "redux", "tailwind css"],
        python: ["django", "flask", "machine learning"],
        "node.js": ["express.js", "mongodb", "rest api"],
        html: ["css", "responsive design", "tailwind css"],
        css: ["sass", "tailwind css", "animations"],
        mongodb: ["mongoose", "firebase", "postgresql"],
        sql: ["postgresql", "database design", "mysql"],
        flutter: ["dart", "firebase", "mobile ui"],
        firebase: ["cloud functions", "firestore", "authentication"],
        git: ["github actions", "ci/cd", "version control"],
        "machine learning": ["tensorflow", "pytorch", "data science"],
        ai: ["prompt engineering", "llm", "nlp"],
      };

      const trendingSkills = [
        "ai & prompt engineering",
        "next.js",
        "tailwind css",
        "typescript",
        "docker",
      ];

      const suggestions = [];

      /* Line 1: Related skills based on user's skills */
      let relatedSuggestion = null;
      for (const skill of teachSkills) {
        for (const [key, related] of Object.entries(skillMap)) {
          if (skill.includes(key) || key.includes(skill)) {
            const unlearned = related.filter(
              (r) =>
                !teachSkills.some((ts) => ts.includes(r)) &&
                !learnSkills.some((ls) => ls.includes(r))
            );
            if (unlearned.length > 0) {
              relatedSuggestion = `Learn ${unlearned[0]}`;
              break;
            }
          }
        }
        if (relatedSuggestion) break;
      }

      if (!relatedSuggestion && teachSkills.length > 0) {
        relatedSuggestion = `Master ${teachSkills[0]} advanced concepts`;
      }

      if (!relatedSuggestion) {
        relatedSuggestion = `Learn ${trendingSkills[0]}`;
      }

      suggestions.push(relatedSuggestion);

      /* Line 2: Explore trending / new skills */
      const unlearnedTrending = trendingSkills.filter(
        (t) =>
          !teachSkills.some((ts) => ts.includes(t)) &&
          !learnSkills.some((ls) => ls.includes(t))
      );

      if (unlearnedTrending.length > 0) {
        suggestions.push(`Explore ${unlearnedTrending[0]}`);
      } else {
        suggestions.push("Explore cross-discipline skills");
      }

      /* Line 3: Activity-based suggestion */
      if (sessionsCompleted === 0) {
        suggestions.push("Start your first session 🚀");
      } else if (sessionsCompleted < 3) {
        suggestions.push("Connect with similar users");
      } else {
        suggestions.push("Share your knowledge with beginners");
      }

      setSuggestions(suggestions);
    });

    return () => unsub();
  }, []);

  /* ---------------- MY SKILLS (REALTIME) ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const skills = data?.teachSkills || [];
        const learn = data?.learnSkills || [];
        setMySkills(Array.isArray(skills) ? skills : []);
        setLearnSkills(Array.isArray(learn) ? learn : []);

        /* Gamification calculation */
        const sessionsCompleted = data?.sessionsCompleted || 0;
        const rating = data?.rating || 0;
        const totalReviews = data?.totalReviews || 0;

        let points = 0;
        points += sessionsCompleted * 50;
        points += totalReviews * 20;
        if (rating >= 4) points += 100;
        else if (rating >= 3) points += 50;

        let level = 1;
        if (points >= 500) level = 5;
        else if (points >= 350) level = 4;
        else if (points >= 200) level = 3;
        else if (points >= 100) level = 2;

        const badges = [];
        if (sessionsCompleted >= 1) badges.push("🎯");
        if (rating >= 4) badges.push("🏆");
        if (totalReviews >= 3) badges.push("⭐");
        if (sessionsCompleted >= 5) badges.push("🔥");
        if (rating >= 4.5) badges.push("🥇");
        if (badges.length === 0) badges.push("🌱");

        setGamification({ level, points, badges });
      }
    });

    return () => unsub();
  }, []);


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

  const getAiReply = (message) => {
    const text = message.toLowerCase();

    if (text.includes("request") || text.includes("incoming")) {
      return `You currently have ${stats.incoming} incoming request${stats.incoming === 1 ? "" : "s"}. Open Incoming Requests to accept or reject quickly.`;
    }

    if (text.includes("match") || text.includes("connect")) {
      if (stats.matches > 0) {
        return `Great news! You have ${stats.matches} active match${stats.matches === 1 ? "" : "es"}${topMatchUser ? ` and a strong match with ${topMatchUser}` : ""}. Try Open Requests to connect now.`;
      }
      return "No active matches yet. Post an open request and add clear teach/learn skills to improve matching.";
    }

    if (text.includes("session") || text.includes("schedule")) {
      return `You have ${scheduledCount} upcoming session${scheduledCount === 1 ? "" : "s"}. Use My Sessions from top bar to track and prepare.`;
    }

    if (text.includes("skill")) {
      if (mySkills.length === 0) {
        return "You have not added skills yet. Add 2-3 teach skills in Profile to get better recommendations and requests.";
      }
      return `You currently list ${mySkills.length} skill${mySkills.length === 1 ? "" : "s"}. Keep them updated to improve visibility.`;
    }

    if (text.includes("notification") || text.includes("alert")) {
      return `You have ${notifCount} unread notification${notifCount === 1 ? "" : "s"}. Tap the bell icon in the top bar to view them.`;
    }

    if (text.includes("next") || text.includes("plan") || text.includes("what should i do")) {
      return suggestions.length > 0
        ? `Suggested next steps: ${suggestions.slice(0, 3).join(" | ")}`
        : "Start by posting an open request, then send at least one skill request to build momentum.";
    }

    return "I can help with requests, matches, sessions, skills, and notifications. Try asking: 'How many incoming requests?'";
  };

  const addBotOnlyMessage = (text) => {
    setBotMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.floor(Math.random() * 1000), role: "bot", text }
    ]);
  };

  const resolveUserByName = (rawName) => {
    const target = rawName.trim().toLowerCase();
    if (!target) return null;

    return allUsers.find((u) => {
      if (u.id === auth.currentUser?.uid) return false;
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name === target || name.includes(target) || email === target;
    }) || null;
  };

  const parseActionCommand = (message) => {
    const text = message.trim();

    const requestRegex = /(?:send|create)\s+(?:a\s+)?request\s+(?:to|for)\s+([^:]+?)(?:\s*:\s*(.+))?$/i;
    const requestMatch = text.match(requestRegex);
    if (requestMatch) {
      const userName = requestMatch[1]?.trim();
      const note = requestMatch[2]?.trim() || "Let's connect for skill exchange";
      return { type: "send_request", userName, message: note };
    }

    const messageRegex = /(?:send\s+)?message\s+(?:to|for)\s+([^:]+?)\s*:\s*(.+)$/i;
    const messageMatch = text.match(messageRegex);
    if (messageMatch) {
      const userName = messageMatch[1]?.trim();
      const body = messageMatch[2]?.trim();
      return { type: "send_message", userName, message: body };
    }

    return null;
  };

  const executePendingAction = async () => {
    if (!pendingAction || !auth.currentUser) {
      addBotOnlyMessage("No pending action found.");
      setPendingAction(null);
      return;
    }

    const targetUser = resolveUserByName(pendingAction.userName);
    if (!targetUser) {
      addBotOnlyMessage(`I could not find user '${pendingAction.userName}'. Please give exact name or email.`);
      setPendingAction(null);
      return;
    }

    try {
      const idToken = await auth.currentUser.getIdToken();

      const runAiAction = async (payload) => {
        const response = await fetch("/api/ai-agent-action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Action failed");
        }

        return data;
      };

      if (pendingAction.type === "send_request") {
        await runAiAction({
          action: "send_request",
          targetUser: pendingAction.userName,
          skill: mySkills?.[0]?.name || "general",
          message: pendingAction.message,
        });

        addBotOnlyMessage(`Done. Request sent to ${targetUser.name || targetUser.email || "user"}.`);
      }

      if (pendingAction.type === "send_message") {
        await runAiAction({
          action: "send_message",
          targetUser: pendingAction.userName,
          message: pendingAction.message,
        });

        addBotOnlyMessage(`Done. Message sent to ${targetUser.name || targetUser.email || "user"}.`);
      }
    } catch (err) {
      console.error("AI action execution failed", err);
      addBotOnlyMessage("Action failed due to a temporary issue. Please try again.");
    } finally {
      setPendingAction(null);
    }
  };

  const sendBotMessage = (message) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const normalized = trimmed.toLowerCase();

    if (pendingAction && (normalized === "confirm" || normalized === "yes")) {
      setBotMessages((prev) => [...prev, { id: Date.now(), role: "user", text: trimmed }]);
      executePendingAction();
      return;
    }

    if (pendingAction && (normalized === "cancel" || normalized === "no")) {
      setBotMessages((prev) => [
        ...prev,
        { id: Date.now(), role: "user", text: trimmed },
        { id: Date.now() + 1, role: "bot", text: "Action cancelled." }
      ]);
      setPendingAction(null);
      return;
    }

    const parsed = parseActionCommand(trimmed);
    if (parsed?.type) {
      const targetUser = resolveUserByName(parsed.userName);
      if (!targetUser) {
        setBotMessages((prev) => [
          ...prev,
          { id: Date.now(), role: "user", text: trimmed },
          { id: Date.now() + 1, role: "bot", text: `I could not find '${parsed.userName}'. Try exact user name or email.` }
        ]);
        return;
      }

      setPendingAction(parsed);
      const preview = parsed.type === "send_request"
        ? `I am ready to send a request to ${targetUser.name || targetUser.email}. Type 'confirm' to proceed or 'cancel'.`
        : `I am ready to send this message to ${targetUser.name || targetUser.email}. Type 'confirm' to proceed or 'cancel'.`;

      setBotMessages((prev) => [
        ...prev,
        { id: Date.now(), role: "user", text: trimmed },
        { id: Date.now() + 1, role: "bot", text: preview }
      ]);
      return;
    }

    setBotMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", text: trimmed },
      { id: Date.now() + 1, role: "bot", text: getAiReply(trimmed) }
    ]);
  };

  const handleBotSubmit = () => {
    if (!botInput.trim()) return;
    sendBotMessage(botInput);
    setBotInput("");
  };

  return (
    <div className="dashboard-page">
      
    <div className="dashboard-layout">
      <SessionReminder />
      <Sidebar isOpen={sidebarOpen} />

      <div className="dashboard-main">

        {/* {false && profile.photoURL &&<img src={Profile.photoURL}/>} */}
        {/* TOPBAR */}
        <div className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="notif-wrapper" onClick={() => navigate("/notifications")}>
            <button className="notif-btn">🔔</button>
            {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
          </div>
          <button
            className="notif-btn"
            title="Notification Settings"
            onClick={() => navigate("/notification-settings")}
          >
            ⚙️
          </button>
          <button onClick={() => navigate("/my-sessions")}>
            📅 My Sessions {scheduledCount > 0 && <span className="scheduled-badge">{scheduledCount}</span>}
          </button>
          <button className="logout-btn" onClick={logout}> 
            Logout
          </button>
        </div>

        <div className="dashboard-content">
          <h1>Dashboard</h1>
          <p className="subtitle">Realtime Skill Exchange Platform</p>
          {dashboardToast && <div className="dashboard-inline-toast">{dashboardToast}</div>}

          <div className="platform-cards">
            <div className="platform-mini-card total-users-card">
              <span className="mini-icon">👥</span>
              <div>
                <h4>{totalUsersCount}</h4>
                <p>Total Users</p>
              </div>
            </div>

            <div className="platform-mini-card live-users-card">
              <span className="mini-icon">🟢</span>
              <div>
                <h4>{liveUsersCount}</h4>
                <p>Live Users</p>
              </div>
            </div>
          </div>

          {/* STATS */}
          <div className="stats">
            <div className="card tone-skills">
              <span className="card-icon">⭐</span>
              <h2>{stats.skills}</h2>
              <p>My Skills</p>
            </div>
            <div className="card tone-requests">
              <span className="card-icon">📩</span>
              <h2>{stats.incoming}</h2>
              <p>Incoming Requests</p>
            </div>
            <div className="card tone-open">
              <span className="card-icon">📂</span>
              <h2>{stats.open}</h2>
              <p>Open Requests</p>
            </div>
            <div className="card tone-matches">
              <span className="card-icon">⚡</span>
              <h2>{stats.matches}</h2>
              <p>Active Matches</p>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="welcome-box">
            <h3>Welcome 👋 {auth.currentUser?.email}</h3>
            <p>Start connecting and explore realtime collaboration 🚀</p>

            <div className="actions">
              <button onClick={handleStartConnect}>🤝 Start Connect</button>
              <button onClick={() => navigate("/send-request")}>➕ Create Request</button>
              <button onClick={() => navigate("/open-requests")}>🔍 Find Matches</button>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="grid">

            {/* LEFT SIDE */}
            <div className="left">
              <div className="panel">
                <h3>🏅 Top Rated Users</h3>
                {topUsers.length === 0 ? (
                  <p>No top users yet</p>
                ) : (
                  topUsers.map((u, i) => (
                    <p key={u.id} className="list-row">
                      <span>{i + 1}. {u.name}</span>
                      <span>⭐ {u.rating?.toFixed(1) || 0}</span>
                    </p>
                  ))
                )}
              </div>

              <div className="panel">
                <h3>🔥 Most Active Users</h3>
                {mostActiveUsers.length === 0 ? (
                  <p>No active users yet</p>
                ) : (
                  mostActiveUsers.map((u, i) => (
                    <p key={u.id} className="list-row">
                      <span>{i + 1}. {u.name}</span>
                      <span>📚 {u.sessionsCompleted || 0}</span>
                    </p>
                  ))
                )}
              </div>

              <div className="panel">
                <h3>🤖 Recommended</h3>
                {learnSkills.length === 0 && matchCount === 0 && !topMatchUser && (
                  <p>No recommendations yet</p>
                )}
                {learnSkills.map((s, i) => (
                  <p key={`learn-${i}`}>• Learn {typeof s === "string" ? s : s.name}</p>
                ))}
                {matchCount > 0 && (
                  <p>• {matchCount} Matching Request{matchCount > 1 ? "s" : ""}</p>
                )}
                {topMatchUser && (
                  <p>• Connect with {topMatchUser}</p>
                )}
              </div>

              <div className="panel">
                <h3>🏆 Level {gamification.level}</h3>
                <p>Points: {gamification.points}</p>
                <p>Badges: {gamification.badges.join(" ")}</p>
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
                {activities.length === 0 ? (
                  <p>No recent activity</p>
                ) : (
                  activities.map((item, i) => (
                    <p key={item.id || i} className={`activity-item activity-${item.type || "request"}`}>
                      {item.message}
                    </p>
                  ))
                )}
              </div>

              <div className="panel">
                <h3>📞 Recent Calls</h3>
                {callHistory.length === 0 ? (
                  <p>No calls yet</p>
                ) : (
                  callHistory.slice(0, 5).map(call => {
                    const otherUid = call.caller === auth.currentUser.uid ? call.receiver : call.caller;
                    const otherName = userMap[otherUid] || "User";
                    return (
                      <p key={call.id} className="list-row">
                        <span>{otherName}</span>
                        <span>{timeAgo(call.createdAt)}</span>
                      </p>
                    );
                  })
                )}
              </div>

              <div className="panel">
                <h3>🟢 Online Users</h3>
                {onlineUsers.length === 0 ? (
                  <p>No users online right now</p>
                ) : (
                  onlineUsers.map((user, i) => (
                    <p key={i} className="online-user-row">{user}</p>
                  ))
                )}
              </div>

              <div className="panel">
                <h3>⭐ My Skills</h3>
                {mySkills.length === 0 ? (
                  <p>No skills added yet</p>
                ) : (
                  <div className="skill-chip-wrap">
                    {mySkills.map((s, i) => (
                      <span key={i} className="skill-chip-pill">
                        {s.name} ({s.level})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* GRAPH */}
          <div className="graph">
            <h3>📈 Activity Overview</h3>

            <div className="activity-mini-chart">
              {chartData.length === 0 ? (
                <p>No activity data yet.</p>
              ) : (
                chartData.map((row, index) => {
                  const dayTotal =
                    (row.sessions || 0) +
                    (row.calls || 0) +
                    (row.connections || 0) +
                    (row.requests || 0) +
                    (row.ratings || 0);

                  return (
                    <div key={`${row.day}-${index}`} className="activity-row">
                      <span className="activity-day">{row.day}</span>
                      <div className="activity-bars">
                        <span className="activity-pill sessions">S {row.sessions || 0}</span>
                        <span className="activity-pill calls">C {row.calls || 0}</span>
                        <span className="activity-pill connections">M {row.connections || 0}</span>
                        <span className="activity-pill requests">R {row.requests || 0}</span>
                        <span className="activity-pill ratings">★ {row.ratings || 0}</span>
                      </div>
                      <span className="activity-total">{dayTotal}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* FLOATING ACTIONS */}
        <div className="floating-actions">
          <button
            type="button"
            className="ai-chat-btn"
            onClick={() => setIsAiBotOpen((prev) => !prev)}
            title="AI Assistant"
          >
            🤖
          </button>

          <button
            type="button"
            className="chat-btn"
            onClick={() => navigate("/messages")}
            title="Messages"
          >
            💬
          </button>
        </div>

        {isAiBotOpen && (
          <div className="ai-chatbot">
            <div className="ai-chatbot-head">
              <strong>SkillX AI</strong>
              <button
                type="button"
                className="ai-chatbot-close"
                onClick={() => setIsAiBotOpen(false)}
                aria-label="Close AI assistant"
              >
                ×
              </button>
            </div>

            <div className="ai-chatbot-body" ref={botScrollRef}>
              {botMessages.map((msg) => (
                <div key={msg.id} className={`ai-msg ${msg.role === "user" ? "user" : "bot"}`}>
                  {msg.text}
                </div>
              ))}
            </div>

            <div className="ai-chatbot-quick">
              <button type="button" onClick={() => sendBotMessage("How many incoming requests?")}>Requests</button>
              <button type="button" onClick={() => sendBotMessage("Any match updates?")}>Matches</button>
              <button type="button" onClick={() => sendBotMessage("send request to vaishnavi: Can we connect to practice Java?")}>Auto Request</button>
              <button type="button" onClick={() => sendBotMessage("message to vaishnavi: Hi, shall we schedule a quick session?")}>Auto Message</button>
              <button type="button" onClick={() => sendBotMessage("What should I do next?")}>Next Step</button>
            </div>

            <div className="ai-chatbot-input">
              <input
                value={botInput}
                onChange={(e) => setBotInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBotSubmit()}
                placeholder="Ask about your dashboard..."
              />
              <button type="button" onClick={handleBotSubmit}>Send</button>
            </div>
          </div>
        )}
</div>

      </div>
    </div>

  );
}
