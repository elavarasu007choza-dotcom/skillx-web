import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function DragDropZone({ chatId }) {

  const [drag,setDrag] = useState(false);

  const handleUpload = async (file) => {
    const storageRef = ref(storage, `files/${chatId}/${Date.now()}_${file.name}`);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db,"chats",chatId,"messages"),{
      type:"file",
      fileUrl:url,
      fileName:file.name,
      senderId:auth.currentUser.uid,
      createdAt:serverTimestamp(),
      seenBy:[auth.currentUser.uid]
    });
  };

  return (
    <div
      onDragOver={(e)=>{e.preventDefault(); setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={(e)=>{
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files[0];
        if(file) handleUpload(file);
      }}
      style={{
        border: drag ? "2px dashed blue" : "2px dashed gray",
        padding: "20px",
        textAlign: "center",
        marginBottom: "10px"
      }}
    >
      Drag & Drop File Here 📂
    </div>
  );
}