import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export const sendNotification = async (userId,message,type) => {

  await addDoc(collection(db,"notifications"),{
    userId,
    message,
    type,
    seen:false,
    createdAt:serverTimestamp()
  });

};