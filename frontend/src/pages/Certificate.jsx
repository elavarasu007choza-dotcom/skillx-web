import React, { useRef, useEffect, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import BackButton from "../components/BackButton";

export default function Certificate() {
  const certRef = useRef();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (snap.exists()) setProfile(snap.data());
    };
    fetchProfile();
  }, []);

  if (!profile) return <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>;

  const getBadge = () => {
    if (!profile) return { text: "Beginner", icon: "🎓" };
    if (profile.rating >= 4.5) return { text: "Top Mentor", icon: "🏆" };
    if (profile.rating >= 4) return { text: "Expert", icon: "⭐" };
    if (profile.rating >= 3) return { text: "Skilled", icon: "👍" };
    return { text: "Beginner", icon: "🎓" };
  };

  const getBadgeColor = () => {
    if (!profile) return "#e2e8f0";
    if (profile.rating >= 4.5) return "#fbbf24";
    if (profile.rating >= 4) return "#34d399";
    if (profile.rating >= 3) return "#60a5fa";
    return "#e2e8f0";
  };

  const getAllBadges = () => {
    const badges = [];
    if ((profile.rating || 0) >= 4.5) badges.push({ icon: "🏆", name: "Top Mentor" });
    if ((profile.rating || 0) >= 4) badges.push({ icon: "⭐", name: "Expert" });
    if ((profile.sessionsCompleted || 0) >= 5) badges.push({ icon: "🔥", name: "5+ Sessions" });
    if ((profile.sessionsCompleted || 0) >= 10) badges.push({ icon: "💎", name: "10+ Sessions" });
    if ((profile.totalReviews || 0) >= 3) badges.push({ icon: "📝", name: "3+ Reviews" });
    if (!profile.rating || profile.rating < 3) badges.push({ icon: "🌱", name: "Newcomer" });
    return badges;
  };

  const badge = getBadge();
  const allBadges = getAllBadges();
  const currentYear = new Date().getFullYear();

  const downloadPDF = async () => {
    const canvas = await html2canvas(certRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: null
    });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("landscape", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${profile.name}_certificate.pdf`);
  };

  return (
    <div style={{ padding: "20px", background: "#f1f5f9", minHeight: "100vh" }}>
      <BackButton />
      
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <button 
          onClick={downloadPDF}
          style={{
            padding: "12px 30px",
            fontSize: "16px",
            fontWeight: "600",
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            color: "white",
            border: "none",
            borderRadius: "25px",
            cursor: "pointer",
            boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
            transition: "all 0.3s ease"
          }}
        >
          📥 Download Certificate
        </button>
      </div>

      <div 
        ref={certRef}
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "50px",
          textAlign: "center",
          background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%)",
          color: "white",
          borderRadius: "0",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)"
        }}
      >
        {/* Corner Decorations */}
        <div style={{ position: "absolute", top: "20px", left: "20px", fontSize: "40px", opacity: 0.3 }}>✦</div>
        <div style={{ position: "absolute", top: "20px", right: "20px", fontSize: "40px", opacity: 0.3 }}>✦</div>
        <div style={{ position: "absolute", bottom: "20px", left: "20px", fontSize: "40px", opacity: 0.3 }}>✦</div>
        <div style={{ position: "absolute", bottom: "20px", right: "20px", fontSize: "40px", opacity: 0.3 }}>✦</div>

        {/* Border Design */}
        <div style={{
          position: "absolute",
          inset: "15px",
          border: "3px solid gold",
          borderRadius: "0",
          pointerEvents: "none"
        }}></div>
        <div style={{
          position: "absolute",
          inset: "22px",
          border: "1px solid rgba(255, 215, 0, 0.5)",
          borderRadius: "0",
          pointerEvents: "none"
        }}></div>

        {/* Header */}
        <div style={{ marginBottom: "30px" }}>
          <div style={{ 
            fontSize: "14px", 
            letterSpacing: "4px", 
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.7)",
            marginBottom: "10px"
          }}>
            Certificate of Excellence
          </div>
          <h1 style={{ 
            fontSize: "48px", 
            fontWeight: "700",
            margin: "0",
            background: "linear-gradient(135deg, #ffd700, #ffed4a, #ffd700)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "none"
          }}>
            🏆 Certificate of Completion
          </h1>
        </div>

        {/* Main Content */}
        <div style={{ marginBottom: "30px" }}>
          <p style={{ 
            fontSize: "14px", 
            color: "rgba(255, 255, 255, 0.7)",
            marginBottom: "10px"
          }}>
            This is to certify that
          </p>
          
          <h2 style={{ 
            fontSize: "42px", 
            fontWeight: "700",
            margin: "10px 0",
            color: "#ffffff",
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)"
          }}>
            {profile.name}
          </h2>
          
          <p style={{ 
            fontSize: "16px", 
            color: "rgba(255, 255, 255, 0.8)",
            marginTop: "15px"
          }}>
            has successfully completed skill exchange sessions on
          </p>
          
          <h3 style={{ 
            fontSize: "28px", 
            fontWeight: "600",
            margin: "10px 0",
            color: "#ffd700"
          }}>
            Skill Exchange Platform
          </h3>
        </div>

        {/* Badge & Stats */}
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          gap: "40px",
          marginBottom: "30px",
          flexWrap: "wrap"
        }}>
          <div style={{
            background: getBadgeColor(),
            color: "#1e3a5f",
            padding: "15px 30px",
            borderRadius: "10px",
            fontSize: "20px",
            fontWeight: "700"
          }}>
            {badge.icon} {badge.text}
          </div>
          
          <div style={{ display: "flex", gap: "20px" }}>
            <div>
              <div style={{ fontSize: "24px", fontWeight: "700" }}>⭐ {profile.rating?.toFixed(1) || "0.0"}</div>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>Rating</div>
            </div>
            <div>
              <div style={{ fontSize: "24px", fontWeight: "700" }}>💬 {profile.totalReviews || 0}</div>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>Reviews</div>
            </div>
            <div>
              <div style={{ fontSize: "24px", fontWeight: "700" }}>🎓 {profile.sessionsCompleted || 0}</div>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>Sessions</div>
            </div>
          </div>
        </div>

        {/* Badges Earned */}
        <div style={{ 
          marginBottom: "30px",
          padding: "20px",
          background: "rgba(255, 255, 255, 0.1)",
          borderRadius: "15px",
          maxWidth: "500px",
          margin: "0 auto 30px"
        }}>
          <div style={{ 
            fontSize: "14px", 
            letterSpacing: "2px",
            marginBottom: "15px",
            color: "rgba(255, 215, 0, 0.9)"
          }}>
            🏅 BADGES EARNED
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "15px", flexWrap: "wrap" }}>
            {allBadges.map((badge, index) => (
              <div key={index} style={{
                background: "rgba(255, 255, 255, 0.2)",
                padding: "8px 15px",
                borderRadius: "20px",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}>
                <span>{badge.icon}</span>
                <span>{badge.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "flex-end",
          marginTop: "30px",
          paddingTop: "20px",
          borderTop: "1px solid rgba(255, 215, 0, 0.3)"
        }}>
          {/* Date */}
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)", marginBottom: "5px" }}>
              Date of Issue
            </div>
            <div style={{ fontSize: "18px", fontWeight: "600" }}>
              {new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>

          {/* Platform Logo */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "5px" }}>🎯</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#ffd700" }}>
              SkillX
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.6)" }}>
              skill exchange platform
            </div>
          </div>

          {/* Signature */}
          <div style={{ textAlign: "right" }}>
            <div style={{ 
              fontSize: "24px", 
              fontFamily: "Brush Script MT, cursive",
              marginBottom: "5px",
              color: "#ffd700"
            }}>
              Admin
            </div>
            <div style={{ 
              fontSize: "12px", 
              color: "rgba(255, 255, 255, 0.6)",
              borderTop: "2px solid #ffd700",
              paddingTop: "5px",
              display: "inline-block",
              minWidth: "120px"
            }}>
              Authorized Signature
            </div>
          </div>
        </div>

        {/* Certificate ID */}
        <div style={{ 
          marginTop: "20px",
          fontSize: "10px",
          color: "rgba(255, 255, 255, 0.4)"
        }}>
          Certificate ID: SKILLX-{currentYear}-{profile.uid?.slice(0, 8).toUpperCase() || "XXXXX"}
        </div>
      </div>
    </div>
  );
}
