import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function FileUpload({ chatId }) {

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const storageRef = ref(storage, `files/${chatId}/${Date.now()}_${file.name}`);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db, "chats", chatId, "messages"), {
      type: "file",
      fileUrl: url,
      fileName: file.name,
      senderId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      seenBy: [auth.currentUser.uid]
    });
  };

  return (
    <label style={{ cursor: "pointer", fontSize: "20px" }}>
  📎
  <input
    type="file"
    onChange={handleFile}
    style={{ display: "none" }}
  />
</label>
  );
}