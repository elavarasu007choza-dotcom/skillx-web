import { useState } from "react";
import { db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { sendNotification } from "../utils/sendNotification";
import BackButton from "../components/BackButton";
import "./ScheduleSession.css";

export default function ScheduleSession() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [skill, setSkill] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const scheduleSession = async () => {
    if (!date || !time || !skill.trim()) {
      alert("Please fill skill, date and time");
      return;
    }

    if (!auth.currentUser?.uid) {
      alert("Please login again");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "scheduledSessions"), {
        teacherId: auth.currentUser.uid,
        learnerId: userId,
        skill: skill.trim(),
        note: note.trim(),
        scheduledDate: new Date(`${date}T${time}`),
        status: "scheduled",
        createdAt: serverTimestamp(),
        participants: [auth.currentUser.uid, userId],
      });

      await sendNotification(
        userId,
        `Session scheduled for ${skill.trim()} on ${date} at ${time}`,
        "session",
        "Session Scheduled"
      );

      alert("Session scheduled successfully");
      navigate("/my-sessions");
    } catch (error) {
      console.error("Schedule session error", error);
      alert("Unable to schedule session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="schedule-page">
      <BackButton />
      <div className="schedule-card">
        <h2>Schedule Session</h2>
        <p className="schedule-subtitle">
          Plan a focused session with your connection and lock your calendar.
        </p>

        <div className="schedule-grid">
          <label>
            Skill
            <input
              placeholder="Example: React, Java, UI/UX"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
            />
          </label>

          <label>
            Date
            <input
              type="date"
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <label>
            Time
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>

          <label className="full-row">
            Session note (optional)
            <textarea
              rows="3"
              placeholder="Add context, goals, or agenda for this session"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>

        <div className="schedule-meta">
          <span className="meta-pill">Participant: {userId?.slice(0, 8)}...</span>
          <span className="meta-pill">Status: Scheduled</span>
        </div>

        <button onClick={scheduleSession} disabled={loading}>
          {loading ? "Scheduling..." : "Schedule Session"}
        </button>
      </div>
    </div>
  );
}
