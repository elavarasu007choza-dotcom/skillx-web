import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

export default function CallPage() {
  const { roomID } = useParams();

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const pc = useRef(null);
  const localStream = useRef(null);

  const [status, setStatus] = useState("Connecting...");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const servers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  };

  useEffect(() => {
    startCall();
    return () => pc.current?.close();
  }, []);

  const startCall = async () => {
    pc.current = new RTCPeerConnection(servers);

    // 🎥 GET MEDIA
    localStream.current = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localVideo.current.srcObject = localStream.current;
    localVideo.current.muted = true;

    localStream.current.getTracks().forEach((track) => {
      pc.current.addTrack(track, localStream.current);
    });

    // 📺 REMOTE STREAM
    pc.current.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
      setStatus("Connected");
    };

    const roomRef = doc(db, "webrtcRooms", roomID);
    const roomSnap = await getDoc(roomRef);
    const isCaller = !roomSnap.exists();

    // ICE
    pc.current.onicecandidate = async (e) => {
      if (e.candidate) {
        await setDoc(
          roomRef,
          {
            [isCaller ? "callerCandidates" : "calleeCandidates"]:
              arrayUnion(JSON.stringify(e.candidate)),
          },
          { merge: true }
        );
      }
    };

    // LISTEN ICE
    onSnapshot(roomRef, (snap) => {
      const data = snap.data();
      if (!data) return;

      const candidates = isCaller
        ? data.calleeCandidates
        : data.callerCandidates;

      candidates?.forEach((c) => {
        pc.current
          .addIceCandidate(new RTCIceCandidate(JSON.parse(c)))
          .catch(() => {});
      });
    });

    // CALLER
    if (isCaller) {
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);

      await setDoc(roomRef, {
        offer,
        callerCandidates: [],
        calleeCandidates: [],
      });

      onSnapshot(roomRef, (snap) => {
        const data = snap.data();
        if (data?.answer) {
          pc.current.setRemoteDescription(data.answer);
        }
      });
    } else {
      const data = roomSnap.data();

      await pc.current.setRemoteDescription(data.offer);

      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);

      await updateDoc(roomRef, { answer });
    }
  };

  // 🎤 MIC
  const toggleMic = () => {
    localStream.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicOn(!micOn);
  };

  // 📷 CAM
  const toggleCamera = () => {
    localStream.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCamOn(!camOn);
  };

  // 🖥 SCREEN SHARE
  const shareScreen = async () => {
    const screen = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });

    const sender = pc.current
      .getSenders()
      .find((s) => s.track.kind === "video");

    sender.replaceTrack(screen.getTracks()[0]);

    screen.getTracks()[0].onended = () => {
      sender.replaceTrack(localStream.current.getVideoTracks()[0]);
    };
  };

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h2>Video Call</h2>
      <p>{status}</p>

      <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
        <video ref={localVideo} autoPlay muted width={300} />
        <video ref={remoteVideo} autoPlay width={300} />
      </div>

      <br />

      <button onClick={toggleMic}>
        {micOn ? "Mute" : "Unmute"}
      </button>

      <button onClick={toggleCamera}>
        {camOn ? "Camera Off" : "Camera On"}
      </button>

      <button onClick={shareScreen}>
        Share Screen
      </button>
    </div>
  );
}