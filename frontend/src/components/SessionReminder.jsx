import { useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { sendNotification } from "../utils/sendNotification";

export default function SessionReminder(){

useEffect(()=>{

const unsub = onSnapshot(collection(db,"sessions"),(snap)=>{

snap.docs.forEach((doc)=>{

const data = doc.data();

if(
data.teacherId !== auth.currentUser.uid &&
data.learnerId !== auth.currentUser.uid
) return;

const sessionTime = new Date(data.date+" "+data.time);
const now = new Date();

const diff = Math.floor((sessionTime - now)/60000);

if(diff === 30){

sendNotification(
auth.currentUser.uid,
"🔔 Session starting in 30 minutes",
"session"
);

}

if(diff === 10){

sendNotification(
auth.currentUser.uid,
"🔔 Session starting in 10 minutes",
"session"
);

}

if(diff === 0){

sendNotification(
auth.currentUser.uid,
"🔔 Session starting now",
"session"
);

}

});

});

return ()=>unsub();

},[]);

return null;

}