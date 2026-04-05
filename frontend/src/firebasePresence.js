import { auth, rtdb } from "./firebase";
import { ref, onDisconnect, set } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

export function setupPresence() {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;

    const userStatusRef = ref(rtdb, `presence/${user.uid}`);

    // ONLINE
    set(userStatusRef, {
      online: true,
      lastSeen: Date.now(),
    });

    // OFFLINE (tab close / crash / net off)
    onDisconnect(userStatusRef).set({
      online: false,
      lastSeen: Date.now(),
    });
  });
}
