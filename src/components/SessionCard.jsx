import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";


export default function SessionCard({ session }) {
        const cancelSession = async (id) => {
        await deleteDoc(doc(db,"sessions",id));
        alert("Session Cancelled");

};
  return (

    <div
      style={{
        padding:"15px",
        borderRadius:"8px",
        background:"#f1f5f9",
        marginBottom:"10px"
      }}
    >

      <p><b>Skill:</b> {session.skill}</p>

      <p><b>Date:</b> {session.date}</p>

      <p><b>Time:</b> {session.time}</p>

      <p><b>Status:</b> {session.status}</p>
    <button onClick={()=>cancelSession(session.id)}>
❌ Cancel Session
</button>

    </div>

  );

}