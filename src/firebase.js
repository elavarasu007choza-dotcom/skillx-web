import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const getEnv = (key, fallback) => {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value : fallback;
};


// ✅ PRIMARY PROJECT (Existing - for Auth, Firestore, Realtime DB)
const firebaseConfig = {
  apiKey: getEnv("REACT_APP_FIREBASE_API_KEY", "AIzaSyCf2I7VLal5dp0XSpuLm1EtOpJQnZMtEX0"),
  authDomain: getEnv("REACT_APP_FIREBASE_AUTH_DOMAIN", "skillx-platform-1b30d.firebaseapp.com"),
  projectId: getEnv("REACT_APP_FIREBASE_PROJECT_ID", "skillx-platform-1b30d"),
  storageBucket: getEnv("REACT_APP_FIREBASE_STORAGE_BUCKET", "skillx-platform-1b30d.firebasestorage.app"),
  messagingSenderId: getEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID", "642070584554"),
  appId: getEnv("REACT_APP_FIREBASE_APP_ID", "1:642070584554:web:533afb72cd9d4f9e998b93")
};

// ✅ SECONDARY PROJECT (New - for File Storage/Uploads)
const firebaseConfigStorage = {
  apiKey: getEnv("REACT_APP_FIREBASE_STORAGE_API_KEY", "AIzaSyDLTotQgAcjoaYObISrM6VCr0lu_MzWgSk"),
  authDomain: getEnv("REACT_APP_FIREBASE_STORAGE_AUTH_DOMAIN", "skillx-app-96d24.firebaseapp.com"),
  projectId: getEnv("REACT_APP_FIREBASE_STORAGE_PROJECT_ID", "skillx-app-96d24"),
  storageBucket: getEnv("REACT_APP_FIREBASE_STORAGE_BUCKET", "skillx-app-96d24.firebasestorage.app"),
  messagingSenderId: getEnv("REACT_APP_FIREBASE_STORAGE_MESSAGING_SENDER_ID", "141592113686"),
  appId: getEnv("REACT_APP_FIREBASE_STORAGE_APP_ID", "1:141592113686:web:126916893682578880fb37")
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
