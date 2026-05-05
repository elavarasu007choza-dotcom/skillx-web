import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { sendNotification } from "../utils/sendNotification";

export default function SessionReminder() {
  const [lastNotifications, setLastNotifications] = useState({});

  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;

    const unsub = onSnapshot(
      query(collection(db, "scheduledSessions"), where("participants", "array-contains", uid)),
      async (snap) => {
        const now = new Date();

        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const sessionId = docSnap.id;

          if (data.status === "cancelled" || data.status === "completed") continue;

          let sessionTime;
          if (data.scheduledDate) {
            sessionTime = data.scheduledDate.toDate();
          } else if (data.date && data.time) {
            // Handle time format like "14:30" or "2:30 PM"
            const timePart = data.time.includes(" ") 
              ? data.time 
              : data.time.length <= 5 
                ? `${data.date}T${data.time}:00` 
                : `${data.date}T${data.time}`;
            sessionTime = new Date(timePart);
          } else {
            continue;
          }

          // Validate sessionTime is a valid date
          if (isNaN(sessionTime.getTime())) {
            console.warn("Invalid session time for session:", sessionId, data);
            continue;
          }

          const diff = Math.floor((sessionTime - now) / 60000);
          const notifyKey = `${sessionId}-${diff}`;

          // Trigger notifications at 30, 10, 5, and 0 minutes before session
          if ((diff === 30 || diff === 10 || diff === 5 || diff === 0) &&
              lastNotifications[notifyKey] !== true) {

            const otherUserId = data.teacherId === uid ? data.learnerId : data.teacherId;

            const teacherSnap = await getDoc(doc(db, "users", data.teacherId));
            const teacherName = teacherSnap.exists() ? teacherSnap.data().name : "User";

            let message = "";
            let icon = "";

            if (diff === 30) {
              message = `Session in 30 minutes with ${teacherName}`;
              icon = "🔔";
            } else if (diff === 10) {
              message = `Session in 10 minutes with ${teacherName}`;
              icon = "⏰";
            } else if (diff === 5) {
              message = `Session starting in 5 minutes with ${teacherName}!`;
              icon = "🔥";
            } else if (diff === 0) {
              message = `Session starting NOW with ${teacherName}!`;
              icon = "📢";
            }

            if (message) {
              // Send in-app notification to current user
              sendNotification(uid, `${icon} ${message}`, "session");

              // Browser alert
              alert(`${icon} ${message}`);

              // Browser notification
              if (Notification.permission === "granted") {
                new Notification(`SkillX Session Reminder`, {
                  body: message,
                  icon: "/favicon.ico"
                });
              } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                  if (permission === "granted") {
                    new Notification(`SkillX Session Reminder`, {
                      body: message,
                      icon: "/favicon.ico"
                    });
                  }
                });
              }

              setLastNotifications(prev => ({ ...prev, [notifyKey]: true }));

              // Notify other user if they're online (via in-app notification)
              if (diff <= 10) {
                sendNotification(otherUserId, `${icon} ${message}`, "session");
                setLastNotifications(prev => ({ ...prev, [notifyKey + "-other"]: true }));
              }
            }
          }

          // Auto-complete sessions that ended more than 60 minutes ago
          if (diff < -60 && data.status !== "completed") {
            try {
              await updateDoc(doc(db, "scheduledSessions", sessionId), {
                status: "completed"
              });
            } catch (e) {
              console.error("Session status update error:", e);
            }
          }
        }
      }
    );

    return () => unsub();
  }, [lastNotifications]);

  return null;
}
