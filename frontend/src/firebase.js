import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";


// ✅ PRIMARY PROJECT (Existing - for Auth, Firestore, Realtime DB)
const firebaseConfig = {
  apiKey: "AIzaSyCf2I7VLal5dp0XSpuLm1EtOpJQnZMtEX0",
  authDomain: "skillx-platform-1b30d.firebaseapp.com",
  projectId: "skillx-platform-1b30d",
  storageBucket: "skillx-platform-1b30d.firebasestorage.app",
  messagingSenderId: "642070584554",
  appId: "1:642070584554:web:533afb72cd9d4f9e998b93"
};

// ✅ SECONDARY PROJECT (New - for File Storage/Uploads)
const firebaseConfigStorage = {
  apiKey: "AIzaSyDLTotQgAcjoaYObISrM6VCr0lu_MzWgSk",
  authDomain: "skillx-app-96d24.firebaseapp.com",
  projectId: "skillx-app-96d24",
  storageBucket: "skillx-app-96d24.firebasestorage.app",
  messagingSenderId: "141592113686",
  appId: "1:141592113686:web:126916893682578880fb37"
};

const app = initializeApp(firebaseConfig);
const storageApp = initializeApp(firebaseConfigStorage, "storageApp");

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Auth persistence setup failed", err);
});
export const db = getFirestore(app);
export const storage = getStorage(storageApp); // Use new project for storage

/* ✅ Realtime DB (Presence ONLY) */
export const rtdb = getDatabase(app);
