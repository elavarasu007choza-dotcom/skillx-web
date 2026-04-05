import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";


const firebaseConfig = {
  apiKey: "AIzaSyCf2I7VLal5dp0XSpuLm1EtOpJQnZMtEX0",
  authDomain: "skillx-platform-1b30d.firebaseapp.com",
  projectId: "skillx-platform-1b30d",
  storageBucket: "skillx-platform-1b30d.firebasestorage.app",
  messagingSenderId: "642070584554",
  appId: "1:642070584554:web:533afb72cd9d4f9e998b93",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* ✅ Realtime DB (Presence ONLY) */
export const rtdb = getDatabase(app);
