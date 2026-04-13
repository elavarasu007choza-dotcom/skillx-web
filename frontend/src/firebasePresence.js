import { auth, rtdb, db } from "./firebase";
import { ref, onDisconnect, set, onValue, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp as fsServerTimestamp } from "firebase/firestore";

let stopAuthWatcher = null;
let stopConnectedWatcher = null;
let lastUid = null;

export function setupPresence() {
  if (stopAuthWatcher) return stopAuthWatcher;

  stopAuthWatcher = onAuthStateChanged(auth, async (user) => {
    if (stopConnectedWatcher) {
      stopConnectedWatcher();
      stopConnectedWatcher = null;
    }

    if (!user) {
      if (lastUid) {
        try {
          await set(ref(rtdb, `presence/${lastUid}`), {
            online: false,
            lastSeen: serverTimestamp(),
          });

          await setDoc(
            doc(db, "users", lastUid),
            { online: false, lastSeen: fsServerTimestamp() },
            { merge: true }
          );
        } catch (err) {
          console.error("Presence logout update failed", err);
        }
      }
      lastUid = null;
      return;
    }

    lastUid = user.uid;
    const userStatusRef = ref(rtdb, `presence/${user.uid}`);
    const userDocRef = doc(db, "users", user.uid);
    const connectedRef = ref(rtdb, ".info/connected");

    const markOfflineFirestore = async () => {
      try {
        await setDoc(
          userDocRef,
          { online: false, lastSeen: fsServerTimestamp() },
          { merge: true }
        );
      } catch (err) {
        console.error("Firestore offline update failed", err);
      }
    };

    const handlePageHide = () => {
      markOfflineFirestore();
    };

    window.addEventListener("pagehide", handlePageHide);

    stopConnectedWatcher = onValue(connectedRef, async (snap) => {
      if (snap.val() !== true) return;

      try {
        await onDisconnect(userStatusRef).set({
          online: false,
          lastSeen: serverTimestamp(),
        });

        await set(userStatusRef, {
          online: true,
          lastSeen: serverTimestamp(),
        });

        await setDoc(
          userDocRef,
          { online: true, lastSeen: fsServerTimestamp() },
          { merge: true }
        );
      } catch (err) {
        console.error("Presence connected update failed", err);
      }
    });

    const prevStop = stopConnectedWatcher;
    stopConnectedWatcher = () => {
      prevStop?.();
      window.removeEventListener("pagehide", handlePageHide);
    };
  });

  return stopAuthWatcher;
}
