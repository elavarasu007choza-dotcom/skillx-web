import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export const sendNotification = async (userId, message, type, titleOrOptions) => {
  const options =
    typeof titleOrOptions === "string"
      ? { title: titleOrOptions }
      : (titleOrOptions || {});

  await addDoc(collection(db, "notifications"), {
    userId,
    message,
    type,
    title: options.title || "SkillX",
    metadata: options.metadata || null,
    seen: false,
    createdAt: serverTimestamp()
  });
};
