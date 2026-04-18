import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import "./UserProfile.css";
import BackButton from "../components/BackButton";

function ReputationBadge({ score }) {
  let badge = "New User";

  if (score >= 4.5) badge = "Trusted Mentor";
  else if (score >= 4) badge = "Good Mentor";
  else if (score >= 3) badge = "Beginner";

  return (
    <p className="up-badge-row">
      <b>Badge:</b> {badge}
    </p>
  );
}

const formatSkills = (skills) => {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  if (typeof skills === "string") {
    return skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeTeachSkills = (skills) =>
  formatSkills(skills).map((item) =>
    typeof item === "string" ? { name: item, level: "" } : item
  );

const PROFILE_FIELDS = [
  "name",
  "age",
  "gender",
  "profession",
  "bio",
  "language",
  "level",
  "location",
  "github",
  "linkedin",
  "teachSkills",
];

export default function UserProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [outboundStatus, setOutboundStatus] = useState(null);
  const [inboundStatus, setInboundStatus] = useState(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [toast, setToast] = useState("");

  const completion = useMemo(() => {
    const filled = PROFILE_FIELDS.filter((f) => {
      if (Array.isArray(profile[f])) return profile[f].length > 0;
      return Boolean(profile[f]);
    }).length;

    return Math.round((filled / PROFILE_FIELDS.length) * 100);
  }, [profile]);

  useEffect(() => {
    if (!uid) return;

    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      }
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!auth.currentUser || !uid) return;

    const qOutbound = query(
      collection(db, "connectionRequests"),
      where("senderId", "==", auth.currentUser.uid),
      where("receiverId", "==", uid)
    );

    const qInbound = query(
      collection(db, "connectionRequests"),
      where("senderId", "==", uid),
      where("receiverId", "==", auth.currentUser.uid)
    );

    const unsubOutbound = onSnapshot(qOutbound, (snap) => {
      setOutboundStatus(snap.empty ? null : snap.docs[0].data().status || null);
    });

    const unsubInbound = onSnapshot(qInbound, (snap) => {
      setInboundStatus(snap.empty ? null : snap.docs[0].data().status || null);
    });

    return () => {
      unsubOutbound();
      unsubInbound();
    };
  }, [uid]);

  useEffect(() => {
    if (outboundStatus === "accepted" || inboundStatus === "accepted") {
      setStatus("accepted");
      return;
    }

    if (outboundStatus === "pending" || inboundStatus === "pending") {
      setStatus("pending");
      return;
    }

    setStatus(null);
  }, [outboundStatus, inboundStatus]);

  useEffect(() => {
    if (!uid) return;

    let sentAccepted = [];
    let receivedAccepted = [];

    const updateCount = () => {
      const connectedUserIds = new Set();

      sentAccepted.forEach((item) => {
        if (item?.receiverId && item.receiverId !== uid) {
          connectedUserIds.add(item.receiverId);
        }
      });

      receivedAccepted.forEach((item) => {
        if (item?.senderId && item.senderId !== uid) {
          connectedUserIds.add(item.senderId);
        }
      });

      setConnectionCount(connectedUserIds.size);
    };

    const sentQuery = query(
      collection(db, "connectionRequests"),
      where("status", "==", "accepted"),
      where("senderId", "==", uid)
    );

    const receivedQuery = query(
      collection(db, "connectionRequests"),
      where("status", "==", "accepted"),
      where("receiverId", "==", uid)
    );

    const unsubSent = onSnapshot(sentQuery, (snap) => {
      sentAccepted = snap.docs.map((d) => d.data());
      updateCount();
    });

    const unsubReceived = onSnapshot(receivedQuery, (snap) => {
      receivedAccepted = snap.docs.map((d) => d.data());
      updateCount();
    });

    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [uid]);

  const sendRequest = async () => {
    if (!auth.currentUser || !uid) return;
    if (status === "pending" || status === "accepted") return;

    const userRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userRef);
    const userData = snap.exists() ? snap.data() : {};

    await addDoc(collection(db, "connectionRequests"), {
      senderId: auth.currentUser.uid,
      receiverId: uid,
      senderName: userData?.name || auth.currentUser.displayName || "User",
      senderPhoto: userData?.photoURL || auth.currentUser.photoURL || "",
      status: "pending",
      createdAt: serverTimestamp(),
    });

    setToast("Connection request sent");
    setTimeout(() => setToast(""), 2500);
  };

  const handleShareProfile = async () => {
    if (!uid) return;

    const shareUrl = `${window.location.origin}/user/${uid}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile.name || "SkillX User"} on SkillX`,
          text: "Check out this SkillX profile",
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setToast("Profile link copied");
        setTimeout(() => setToast(""), 2500);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Share failed", err);
      }
    }
  };

  if (loading) return <div className="up-loading">Loading...</div>;

  return (
    <div className="userprofile-page">
      <BackButton />
      {toast && <div className="up-toast">{toast}</div>}

      <div
        className="up-cover"
        style={{
          backgroundImage: profile.coverURL
            ? `linear-gradient(120deg, rgba(2, 6, 23, 0.35), rgba(2, 6, 23, 0.15)), url(${profile.coverURL})`
            : "linear-gradient(135deg, #0ea5e9, #2563eb)",
        }}
      />

      <div className="up-hero-card">
        <div className="up-hero-actions">
          <button
            className="up-icon-btn"
            onClick={handleShareProfile}
            title="Share profile"
            aria-label="Share profile"
          >
            🔗
          </button>

          {status === "pending" ? (
            <button className="up-action-btn pending">Pending</button>
          ) : status === "accepted" ? (
            <button className="up-action-btn connected">Connected</button>
          ) : (
            <button onClick={sendRequest} className="up-action-btn connect">
              Connect
            </button>
          )}

          {status === "accepted" && (
            <button
              className="up-action-btn message"
              onClick={() => navigate(`/messages/${uid}`)}
            >
              Message
            </button>
          )}
        </div>

        <div className="up-hero-main">
          <img
            src={
              profile.photoURL ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "User")}`
            }
            alt={profile.name || "User"}
            className="up-avatar"
          />

          <div className="up-hero-content">
            <h2>{profile.name || "User"}</h2>
            <p className="up-subline">{profile.profession || "SkillX Member"}</p>

            <div className="up-metrics">
              <span>⭐ {profile.rating || 0}</span>
              <span>💬 {profile.totalReviews || 0} reviews</span>
              <span>📚 {profile.sessionsCompleted || 0} sessions</span>
              <span>🤝 {connectionCount} connections</span>
              <span>✅ {completion}% profile</span>
            </div>

            <ReputationBadge score={profile.rating || 0} />
          </div>
        </div>
      </div>

      <div className="up-card">
        <h3>About</h3>
        <p className="up-bio">{profile.bio || "No bio added yet."}</p>

        <div className="up-grid">
          <p><b>Age:</b> {profile.age || "-"}</p>
          <p><b>Gender:</b> {profile.gender || "-"}</p>
          <p><b>Language:</b> {profile.language || "-"}</p>
          <p><b>Level:</b> {profile.level || "-"}</p>
        </div>
      </div>

      <div className="up-card">
        <h3>Skills</h3>
        <div className="up-skill-columns">
          <div>
            <h4>I Can Teach</h4>
            <div className="up-chips">
              {normalizeTeachSkills(profile.teachSkills).length === 0 ? (
                <p className="up-empty">No teaching skills added</p>
              ) : (
                normalizeTeachSkills(profile.teachSkills).map((s, i) => (
                  <span key={`${s.name}-${i}`}>
                    {s.name}
                    {s.level ? ` (${s.level})` : ""}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <h4>I Want To Learn</h4>
            <div className="up-chips">
              {formatSkills(profile.learnSkills).length === 0 ? (
                <p className="up-empty">No learning goals added</p>
              ) : (
                formatSkills(profile.learnSkills).map((s, i) => (
                  <span key={`${s}-${i}`}>{typeof s === "string" ? s : s?.name}</span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="up-card">
        <h3>Details</h3>
        <p>📍 {profile.location || "-"}</p>
        <p>
          GitHub:{" "}
          {profile.github ? (
            <a href={profile.github} target="_blank" rel="noreferrer">
              {profile.github}
            </a>
          ) : (
            "-"
          )}
        </p>
        <p>
          LinkedIn:{" "}
          {profile.linkedin ? (
            <a href={profile.linkedin} target="_blank" rel="noreferrer">
              {profile.linkedin}
            </a>
          ) : (
            "-"
          )}
        </p>
        <p>🎯 Hobbies: {profile.hobbies || "-"}</p>
      </div>
    </div>
  );
}
