import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import SessionCard from "../components/SessionCard";
import { deleteDoc, doc } from "firebase/firestore";

export default function MySessions(){

  const [sessions,setSessions] = useState([]);

  useEffect(()=>{

    if(!auth.currentUser) return;

    const q = query(
      collection(db,"sessions"),
      where("teacherId","==",auth.currentUser.uid)
    );
    
    const cancelSession = async (id) => {
    if(!window.confirm("Cancel this session?")) return;
  await deleteDoc(doc(db,"sessions",id));

  alert("Session Cancelled");

};

    const unsub = onSnapshot(q,(snap)=>{

      const list = snap.docs.map((d)=>({
        id:d.id,
        ...d.data()
      }));

      setSessions(list);

    });

    return ()=>unsub();

  },[]);

  return(

    <div style={{padding:"30px"}}>

      <h2>📅 My Sessions</h2>

      <br/>

      {sessions.length === 0 && <p>No sessions scheduled</p>}

      {sessions.map((s)=>(
        <SessionCard key={s.id} session={s}/>
      ))}

    </div>

  );

}