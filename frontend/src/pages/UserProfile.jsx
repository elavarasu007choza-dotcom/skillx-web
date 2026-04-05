import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import "./UserProfile.css";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { query, where } from "firebase/firestore";




/* 🔥 Badge */
function ReputationBadge({ score }) {
  let badge = "New User";

  if (score >= 4.5) badge = "🏆 Trusted Mentor";
  else if (score >= 4) badge = "⭐ Good Mentor";
  else if (score >= 3) badge = "👍 Beginner";

  return <p><b>Badge:</b> {badge}</p>;
}

export default function UserProfile() {
  const { uid } = useParams();
  const [status, setStatus] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "connectionRequests"),
      where("senderId", "==", auth.currentUser.uid),
      where("receiverId", "==", uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setStatus(snap.docs[0].data().status);
      }
    });

    return () => unsub();
  }, [uid]);

  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const canGetCertificate =
    (profile.sessionsCompleted || 0) >= 1 &&
    (profile.rating || 0) >= 3 &&
    (profile.totalReviews || 0) >= 1;

  const sendRequest = async () => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users,auth.currentUser.uid");
    const snap = await getDoc(userRef);
    const userData = snap.data();

    await addDoc(collection(db, "connectionRequests"), {
      senderId: auth.currentUser.uid,
      receiverId: uid, // profile user id
      senderName: auth.currentUser.displayName || "User",
      senderPhoto: userData?.photoURL || "",
      status: "pending",
      createdAt: serverTimestamp(),
    });
  };


  /* 🔥 LIVE DATA */
  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = uid || auth.currentUser.uid;

    const unsub = onSnapshot(doc(db, "users", userId), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      }
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="userprofile-page">

      {/* 🔷 COVER */}
      <div
        className="cover"
        style={{
          backgroundImage: profile.coverURL
            ? `url(${profile.coverURL})`
            : "linear-gradient(90deg, #2563eb, #38bdf8)"
        }}
      />

      {/* 🔷 HEADER */}
      <div className="header-card">
        <div className="header">

          <img
            src={
              profile.photoURL ||
              `https://ui-avatars.com/api/?name=${profile.name || "User"}`
            }
            alt="profile"
          />

          <div>
            <h2>{profile.name}</h2>
            <p>{profile.profession}</p>

            <p>⭐ {profile.rating || 0} | 💬 {profile.totalReviews || 0}</p>
            <p>🎓 Sessions Completed: {profile.sessionsCompleted || 0}</p>
            {canGetCertificate && (
              <button onClick={() => navigate("/certificate")}>
                🎓 Get Certificate
              </button>
            )}
            <ReputationBadge score={profile.rating || 0} />

            {status === "pending" ? (
              <button className="connect-btn">⏳ Pending</button>
            ) : status === "accepted" ? (
              <button className="connect-btn done">✅ Connected</button>
            ) : (
              <button onClick={sendRequest} className="connect-btn">
                🔗 Connect
              </button>
            )}

            {status === "accepted" && (
              <button onClick={() => navigate(`/messages/${uid}`)}>
                💬 Message
              </button>
            )}


          </div>

        </div>
      </div>

      {/* 🔷 ABOUT */}
      <div className="card">
        <h3>About</h3>
        <p>{profile.bio}</p>

        <div className="grid">
          <p><b>Age:</b> {profile.age}</p>
          <p><b>Gender:</b> {profile.gender}</p>
          <p><b>Language:</b> {profile.language}</p>
          <p><b>Level:</b> {profile.level}</p>
        </div>
      </div>

      {/* 🔷 SKILLS */}
      <div className="card">
        <h3>I Can Teach</h3>
        <div className="chips">
          {(profile.teachSkills || []).map((s, i) => (
            <span key={i}>{s.name} ({s.level})</span>
          ))}
        </div>

        <h3>I Want To Learn</h3>
        <div className="chips">
          {(profile.learnSkills || []).map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      </div>

      {/* 🔷 DETAILS */}
      <div className="card">
        <h3>Details</h3>

        <p>📍 {profile.location}</p>

        <p>
          GitHub: <a href={profile.github} target="_blank">{profile.github}</a>
        </p>

        <p>
          LinkedIn: <a href={profile.linkedin} target="_blank">{profile.linkedin}</a>
        </p>

        <p>🎯 Hobbies: {profile.hobbies}</p>
      </div>

    </div>
  );
}