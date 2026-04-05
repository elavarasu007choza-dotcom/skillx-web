import { NavLink, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import "./Sidebar.css";

export default function Sidebar() {
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [name, setName] = useState("My Profile");
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const ref = doc(db, "users", auth.currentUser.uid);

    // 🔥 REALTIME LISTENER
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProfilePhoto(snap.data().photoURL || null);
        setName(snap.data()?.name || "My Profile");
      }
    });

    return () => unsubscribe();
  }, []);

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=2563eb&color=ffffff`;

  return (
    <aside className="sidebar">
      {/* LOGO */}
      <div
        className="sidebar-logo"
        onClick={() => navigate("/dashboard")}
      >
        ⚡ SkillX
      </div>

      {/* MENU */}
      <nav className="sidebar-menu">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        <NavLink to="/send-request">Send Request</NavLink>
        <NavLink to="/post-open-request">Post Open Request</NavLink>
        <NavLink to="/open-requests">Open Requests List</NavLink>
        <NavLink to="/requests">Incoming Requests</NavLink>
        <NavLink to="/messages">Messages</NavLink>
      </nav>

      {/* 🔵 BOTTOM PROFILE – REALTIME */}
      <div
        className="sidebar-profile"
        onClick={() => navigate("/profile")}
      >
        <img
          src={profilePhoto || avatarFallback}
          alt="profile"
        />
        <div>
          <div className="profile-name">{name}</div>
          <div className="profile-link">View Profile</div>
        </div>
      </div>
    </aside>
  );
}
