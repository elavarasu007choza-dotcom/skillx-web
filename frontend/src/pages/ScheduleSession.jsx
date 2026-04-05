import { useState } from "react";
import { db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { sendNotification } from "../utils/sendNotification";
export default function ScheduleSession() {

  const { userId } = useParams();
  const navigate = useNavigate();
  const otherUserId = userId;

  const [date,setDate] = useState("");
  const [time,setTime] = useState("");
  const [skill,setSkill] = useState("");

  const scheduleSession = async () => {

    if(!date || !time) return alert("Select date and time");

    await addDoc(collection(db,"sessions"),{
      teacherId: auth.currentUser.uid,
      learnerId: userId,
      skill,
      date,
      time,
      status:"pending",
      createdAt:serverTimestamp()
    });

    await sendNotification(
otherUserId,

"📅 Session scheduled",
"session"
);

    alert("Session Request Sent");

    navigate("/my-sessions");
  };

  return (

    <div style={{padding:"30px"}}>

      <h2>📅 Schedule Session</h2>

      <br/>

      <input
        placeholder="Skill"
        value={skill}
        onChange={(e)=>setSkill(e.target.value)}
      />

      <br/><br/>

      <input
        type="date"
        value={date}
        onChange={(e)=>setDate(e.target.value)}
      />

      <br/><br/>

      <input
        type="time"
        value={time}
        onChange={(e)=>setTime(e.target.value)}
      />

      <br/><br/>

      <button onClick={scheduleSession}>
        Schedule Session
      </button>

    </div>

  );
}