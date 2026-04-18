import { useEffect, useRef, useState } from "react";
import { auth, db } from "../firebase";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { useParams } from "react-router-dom";
import "./Profile.css";
import { useNavigate } from "react-router-dom";
import BackButton from "../components/BackButton";

const getEnv = (key, fallback) => {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value : fallback;
};

/* 🔥 Reputation Badge */
function ReputationBadge({ score }) {
  let badge = "New User";

  if (score >= 4.5) badge = "🏆 Trusted Mentor";
  else if (score >= 4) badge = "⭐ Good Mentor";
  else if (score >= 3) badge = "👍 Beginner";

  return <p><b>Badge:</b> {badge}</p>;
}
const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", getEnv("REACT_APP_CLOUDINARY_UPLOAD_PRESET", "skillx_files"));

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${getEnv("REACT_APP_CLOUDINARY_CLOUD_NAME", "dyvfflwuo")}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();
    return data.secure_url;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
  }
};

export default function Profile() {
  const navigate =useNavigate();
  const handleShareProfile = async () => {
    const profileUid = uid || auth.currentUser?.uid;
    if (!profileUid) return;

    const shareUrl = `${window.location.origin}/user/${profileUid}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile.name || "SkillX User"} on SkillX`,
          text: "Check out this SkillX profile",
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setToast("Profile link copied ✅");
        setTimeout(() => setToast(""), 2500);
      } else {
        window.prompt("Copy profile link:", shareUrl);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Share failed", err);
      }
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = await uploadToCloudinary(file);

    setProfile({ ...profile, coverURL: url });

    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      { coverURL: url },
      { merge: true }
    );
  };

  


  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);
  const { uid } = useParams();
  const [toast, setToast] = useState("");

  const isOwnProfile = !uid;

  const [profile, setProfile] = useState({
    name: "",
    age: "",
    gender: "",
    profession: "",
    language: "",
    skills: "",
    photoURL: "",
    coverURL: "",

    bio: "",
    teachSkills: [],
    learnSkills: [],
    location: "",
    github: "",
    linkedin: "",
    level: "",
    hobbies: "",

    rating: 0,
    totalReviews: 0,
  });

  const canGetCertificate =
    (profile.sessionsCompleted || 0) >= 1 &&
    (profile.rating || 0) >= 3 &&
    (profile.totalReviews || 0) >= 1;
  const [skillLevel, setSkillLevel] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [learnInput, setLearnInput] = useState("");
  const [teachInput, setTeachInput] = useState("");
  const [teachLevel, setTeachLevel] = useState("");
  const bioRef = useRef(null);



  /* 🔥 SAFE SKILL FORMAT */
  const formatSkills = (skills) => {
    if (!skills) return [];
    if (Array.isArray(skills)) return skills;
    return skills.split(",");
  };

  /* LOAD PROFILE */
  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = uid || auth.currentUser.uid;

    const unsub = onSnapshot(doc(db, "users", userId), (snap) => {
      if (snap.exists()) {
        setProfile((prev) => ({ ...prev, ...snap.data() }));
      }
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!bioRef.current) return;
    bioRef.current.style.height = "auto";
    bioRef.current.style.height = `${bioRef.current.scrollHeight}px`;
  }, [profile.bio, editMode]);

  useEffect(() => {
    const profileUid = uid || profile.uid || auth.currentUser?.uid;
    if (!profileUid) return;

    let sentAccepted = [];
    let receivedAccepted = [];

    const updateCount = () => {
      const connectedUserIds = new Set();

      sentAccepted.forEach((item) => {
        if (item?.receiverId && item.receiverId !== profileUid) {
          connectedUserIds.add(item.receiverId);
        }
      });

      receivedAccepted.forEach((item) => {
        if (item?.senderId && item.senderId !== profileUid) {
          connectedUserIds.add(item.senderId);
        }
      });

      setConnectionCount(connectedUserIds.size);
    };

    const sentQuery = query(
      collection(db, "connectionRequests"),
      where("status", "==", "accepted"),
      where("senderId", "==", profileUid)
    );

    const receivedQuery = query(
      collection(db, "connectionRequests"),
      where("status", "==", "accepted"),
      where("receiverId", "==", profileUid)
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
  }, [uid, profile.uid]);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleBioChange = (e) => {
    handleChange(e);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  /* PHOTO UPLOAD */
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = await uploadToCloudinary(file);

    setProfile({
      ...profile,
      photoURL: url,
    });

    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      { photoURL: url },
      { merge: true }
    );
  };


  const addSkill = () => {
    if (!skillInput || !skillLevel) return;

    const updated = [
      ...(profile.teachSkills || []),
      { name: skillInput, level: skillLevel }
    ];

    setProfile({
      ...profile,
      teachSkills: updated
    });

    setSkillInput("");
    setSkillLevel("");
  };

  const removeSkill = (index) => {
    const updated = [...profile.teachSkills];
    updated.splice(index, 1);

    setProfile({
      ...profile,
      teachSkills: updated
    });
  };

  const addTeachSkill = () => {
    if (!teachInput || !teachLevel) return;

    setProfile({
      ...profile,
      teachSkills: [
        ...(profile.teachSkills || []),
        { name: teachInput, level: teachLevel }
      ]
    });

    setTeachInput("");
    setTeachLevel("");
  };

  const removeTeachSkill = (index) => {
    const updated = [...profile.teachSkills];
    updated.splice(index, 1);

    setProfile({
      ...profile,
      teachSkills: updated
    });
  };

  const addLearnSkill = () => {
    if (!learnInput) return;

    setProfile({
      ...profile,
      learnSkills: [...(profile.learnSkills || []), learnInput]
    });

    setLearnInput("");
  };

  const removeLearnSkill = (index) => {
    const updated = [...profile.learnSkills];
    updated.splice(index, 1);

    setProfile({
      ...profile,
      learnSkills: updated
    });
  };

  /* SAVE PROFILE */
  const handleSave = async () => {
    if (!auth.currentUser) return;

    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        ...profile,

        /* 🔥 STORE AS ARRAY */
        teachSkills: formatSkills(profile.teachSkills),
        learnSkills: formatSkills(profile.learnSkills),

        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
      },
      { merge: true }
    );

    setToast("Profile updated ✅");
    setTimeout(() => setToast(""), 3000);
    setEditMode(false);
  };

  const fields = [
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
    "teachSkills"
  ];
  const filled = fields.filter((f) => {
    if (Array.isArray(profile[f])) return profile[f].length > 0;
    return profile[f];
  }).length;

  const completion = Math.round((filled / fields.length) * 100);

  if (loading) return <div className="profile-loading">Loading...</div>;

  return (
    <div className="profile-page">
      <BackButton />
      {toast && <div className="toast">{toast}</div>}

      {/* 🔷 COVER */}
      <div
        className="profile-cover"
        style={{
          backgroundImage: profile.coverURL
            ? `url(${profile.coverURL})`
            : "linear-gradient(90deg, #2563eb, #38bdf8)",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        {editMode && (

          <label className="cover-upload-btn">
            Change Cover
            <input type="file" onChange={handleCoverUpload} hidden />
          </label>

        )}
      </div>

      {/* 🔷 HEADER */}
      <div className="profile-header-card">
        <div className="profile-header-actions">
          <button
            className="profile-top-btn share-btn icon-btn"
            onClick={handleShareProfile}
            title="Share Profile"
            aria-label="Share Profile"
          >
            ↗
          </button>
          {isOwnProfile && (
            <button
              className="profile-top-btn icon-btn"
              onClick={() => setEditMode(!editMode)}
              title={editMode ? "Cancel Edit" : "Edit Profile"}
              aria-label={editMode ? "Cancel Edit" : "Edit Profile"}
            >
              {editMode ? "✕" : "✎"}
            </button>
          )}
        </div>
        <div className="profile-header">

          <img
            src={
              profile.photoURL ||
              `https://ui-avatars.com/api/?name=${profile.name || "User"}`
            }
            alt="profile"

          />
          {editMode && (
            <label className="upload-btn">
              Change Photo
              <input type="file" onChange={handlePhotoUpload} hidden />
            </label>
          )}



          <div className="profile-info">
            <h2>{profile.name}</h2>
            <p>{profile.profession}</p>

            <p>⭐ {profile.rating || 0} | 💬 {profile.totalReviews || 0}</p>
            <p> Sessions completed: {profile.sessionsCompleted || 0}</p>
            <p>🤝 Connections: {connectionCount}</p>
            {canGetCertificate && (
              <button onClick={() => navigate("/certificate")}>
                🎓 Get Certificate
              </button>
            )}
            <ReputationBadge score={profile.rating || 0} />
          </div>

        </div>
      </div>

      {/* 🔷 COMPLETION */}
      <div className="completion-box">
        <div>Profile Completion: <b>{completion}%</b></div>
        <div className="completion-bar">
          <div
            className="completion-fill"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      {/* 🔷 ABOUT */}
      <div className="profile-card">
        <h3>About</h3>

        <textarea
          ref={bioRef}
          className="bio-textarea"
          name="bio"
          placeholder="Tell about yourself..."
          value={profile.bio}
          onChange={handleBioChange}
          disabled={!editMode}
        />

        <div className="profile-form">
          <input name="name" value={profile.name} onChange={handleChange} disabled={!editMode} />
          <input name="age" value={profile.age} onChange={handleChange} disabled={!editMode} />

          <select name="gender" value={profile.gender} onChange={handleChange} disabled={!editMode}>
            <option value="">Gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>

          <input name="profession" value={profile.profession} onChange={handleChange} disabled={!editMode} />
          <input
            name="language"
            placeholder="Languages Known"
            value={profile.language}
            onChange={handleChange}
            disabled={!editMode}
          />

          <select
            name="level"
            value={profile.level}
            onChange={handleChange}
            disabled={!editMode}
          >
            <option value="">Experience Level</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Expert</option>
          </select>
        </div>
      </div>

      {/* 🔷 SKILLS */}
      <div className="profile-card">
        <h3>Skills</h3>

        <div style={{ display: "flex", gap: "10px" }}></div>
        <input
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          disabled={!editMode}
          placeholder="Add skill..."
        />

        <select
          value={skillLevel}
          onChange={(e) => setSkillLevel(e.target.value)}
          disabled={!editMode}
        >
          <option value="">Level</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>

        {editMode && <button onClick={addSkill}>+</button>}


        {/* 🔥 SAFE SKILL CHIPS */}
        <div className="skill-chips">
          {formatSkills(profile.teachSkills).map((s, i) => (
            <span key={i} className="skill-chip">
              {s.name} ({s.level})

              {editMode && (
                <button onClick={() => removeSkill(i)}>❌</button>
              )}
            </span>
          ))}
        </div>
        <h3>I Can Teach</h3>
        {/* same input + chips for teachSkills */}
        <input
          value={teachInput}
          onChange={(e) => setTeachInput(e.target.value)}
          disabled={!editMode}
          placeholder="Skill I can teach..."
        />
        <select
          value={teachLevel}
          onChange={(e) => setTeachLevel(e.target.value)}
          disabled={!editMode}
        >
          <option value="">Level</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>

        {editMode && <button onClick={addTeachSkill}>+</button>}

        <div className="skill-chips">
          {(profile.teachSkills || []).map((s, i) => (
            <span key={i} className="skill-chip">
              {s.name} ({s.level})

              {editMode && (
                <button onClick={() => removeTeachSkill(i)}>❌</button>
              )}
            </span>
          ))}
        </div>


        <h3>I Want To Learn</h3>



        <input
          value={learnInput}
          onChange={(e) => setLearnInput(e.target.value)}
          disabled={!editMode}
          placeholder="Skill to learn..."
        />

        {editMode && <button onClick={addLearnSkill}>+</button>}

        <div className="skill-chips">
          {formatSkills(profile.learnSkills).map((s, i) => (
            <span key={i} className="skill-chip">
              {s}
              {editMode && (
                <button onClick={() => removeLearnSkill(i)}>❌</button>
              )}
            </span>
          ))}
        </div>


      </div>

      {/* 🔷 EXTRA DETAILS */}
      <div className="profile-card">
        <h3>Details</h3>

        {/* EDIT MODE */}
        {editMode ? (
          <>
            <input
              name="location"
              placeholder="Location"
              value={profile.location}
              onChange={handleChange}
            />

            <input
              name="github"
              placeholder="GitHub URL"
              value={profile.github}
              onChange={handleChange}
            />

            <input
              name="linkedin"
              placeholder="LinkedIn URL"
              value={profile.linkedin}
              onChange={handleChange}
            />
          </>
        ) : (
          <>
            <p>📍 {profile.location}</p>

            <p>
              GitHub:{" "}
              <a href={profile.github} target="_blank" rel="noreferrer">
                {profile.github}
              </a>
            </p>

            <p>
              LinkedIn:{" "}
              <a href={profile.linkedin} target="_blank" rel="noreferrer">
                {profile.linkedin}
              </a>
            </p>
          </>
        )}



        <input name="hobbies" placeholder="Hobbies" value={profile.hobbies} onChange={handleChange} disabled={!editMode} />
      </div>

      {/* 🔷 SAVE */}
      {editMode && (
        <button onClick={handleSave}>
          Save Profile
        </button>
      )}

    </div>
  );
}
