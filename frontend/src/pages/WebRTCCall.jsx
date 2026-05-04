import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  increment,
} from "firebase/firestore";
import Whiteboard from "../components/Whiteboard";
import CodeEditor from "../components/CodeEditor";
import RateUser from "../components/RateUser";
import "./WebRTCCall.css";

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

export default function WebRTCCall() {
  const { roomID } = useParams();
  const navigate = useNavigate();

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const pc = useRef(null);
  const localStream = useRef(null);
  const screenStream = useRef(null);
  const callStartTime = useRef(null);
  const hasRecordedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const candidateCache = useRef(new Set());
  const hasStartedRef = useRef(false);
  const isClosingRef = useRef(false);
  const startTokenRef = useRef(0);
  const hasOfferedRef = useRef(false);
  const offerIdRef = useRef(null);
  const startInFlightRef = useRef(false);

  const [status, setStatus] = useState("Connecting...");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);

  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [isWhiteboardMinimized, setIsWhiteboardMinimized] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [isEditorMinimized, setIsEditorMinimized] = useState(false);

  const [showRating, setShowRating] = useState(false);
  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [targetUserId, setTargetUserId] = useState(null);
  const [roomIDState, setRoomIDState] = useState(null);
  const [remoteName, setRemoteName] = useState("");

  const callType = useMemo(() => {
    const typeParam = new URLSearchParams(window.location.search).get("type");
    return typeParam === "audio" ? "audio" : "video";
  }, []);

  const role = useMemo(() => {
    const roleParam = new URLSearchParams(window.location.search).get("role");
    return roleParam === "caller" || roleParam === "callee" ? roleParam : null;
  }, []);

  const remoteUserId = useMemo(() => {
    return new URLSearchParams(window.location.search).get("User");
  }, []);

  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get("name");
    if (name) setRemoteName(name);
  }, []);

  useEffect(() => {
    let isMounted = true;
    startTokenRef.current += 1;
    const startToken = startTokenRef.current;

    // This effect run should allow work again.
    isClosingRef.current = false;

    if (hasStartedRef.current) return () => {};
    hasStartedRef.current = true;

    const startCall = async () => {
      if (startInFlightRef.current) return;
      startInFlightRef.current = true;

      try {
        callStartTime.current = Date.now();
        setRoomIDState(roomID);

        candidateCache.current = new Set();

        pc.current = new RTCPeerConnection(servers);
        hasOfferedRef.current = false;

        pc.current.onconnectionstatechange = () => {
          const state = pc.current?.connectionState || "";
          if (state === "connected") setStatus("Connected");
          if (state === "failed") setStatus("Connection failed");
          if (state === "disconnected") setStatus("Disconnected");
        };

        pc.current.ontrack = (e) => {
          if (!isMounted) return;
          remoteVideo.current.srcObject = e.streams[0];
          setRemoteVideoReady(true);
        };

        const wantsVideo = callType === "video";

        try {
          localStream.current = await navigator.mediaDevices.getUserMedia({
            video: wantsVideo,
            audio: true,
          });
        } catch (err) {
          if (err?.name === "NotAllowedError") {
            setStatus("Camera or microphone permission denied");
          } else if (err?.name === "NotFoundError") {
            setStatus("No camera or microphone found");
          } else {
            setStatus("Unable to access camera or microphone");
          }
          console.error("getUserMedia error:", err);
          return;
        }

        if (
          startToken !== startTokenRef.current ||
          !pc.current ||
          pc.current.signalingState === "closed" ||
          isClosingRef.current
        ) {
          localStream.current.getTracks().forEach((t) => t.stop());
          return;
        }

        setCamOn(wantsVideo);

        try {
          if (
            startToken === startTokenRef.current &&
            pc.current &&
            pc.current.signalingState !== "closed" &&
            !isClosingRef.current
          ) {
            // Create transceivers in consistent order: audio, video, audio, video
            // This ensures m-lines don't change across offers
            const audioTrack = localStream.current.getAudioTracks()[0];
            const videoTrack = localStream.current.getVideoTracks()[0];

            if (audioTrack) {
              pc.current.addTransceiver(audioTrack, { streams: [localStream.current] });
            }
            if (videoTrack) {
              pc.current.addTransceiver(videoTrack, { streams: [localStream.current] });
            }
          }
        } catch (err) {
          console.error("Failed to add tracks:", err);
          localStream.current.getTracks().forEach((t) => t.stop());
          return;
        }

        if (localVideo.current && wantsVideo) {
          localVideo.current.srcObject = localStream.current;
          localVideo.current.muted = true;
        }

        if (
          startToken !== startTokenRef.current ||
          !pc.current ||
          pc.current.signalingState === "closed" ||
          isClosingRef.current
        ) {
          return;
        }

        const roomRef = doc(db, "webrtcRooms", roomID);
        const roomSnap = await getDoc(roomRef);
        const isCaller = role ? role === "caller" : !roomSnap.exists();

        if (isCaller) {
          setStatus("Calling...");
        }

        const createOfferId = () => {
          try {
            if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
          } catch (_) {
            // ignore
          }
          return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        };

        // If we are the caller, clear any stale room state so we never accidentally
        // apply an old answer/offer to a fresh RTCPeerConnection (common on hot reload).
        if (
          isCaller &&
          startToken === startTokenRef.current &&
          pc.current &&
          pc.current.signalingState !== "closed" &&
          !isClosingRef.current
        ) {
          offerIdRef.current = createOfferId();
          await setDoc(
            roomRef,
            {
              offerId: offerIdRef.current,
              callerCandidates: [],
              calleeCandidates: [],
              createdAt: serverTimestamp(),
            },
            { merge: false }
          );
        }

        pc.current.onicecandidate = async (e) => {
          if (!e.candidate) return;
          await setDoc(
            roomRef,
            {
              [isCaller ? "callerCandidates" : "calleeCandidates"]: arrayUnion(
                JSON.stringify(e.candidate)
              ),
            },
            { merge: true }
          );
        };

        const applyCandidates = (list) => {
          if (!list || !pc.current || pc.current.connectionState === "closed") return;
          list.forEach((raw) => {
            if (candidateCache.current.has(raw)) return;
            candidateCache.current.add(raw);
            try {
              pc.current
                .addIceCandidate(new RTCIceCandidate(JSON.parse(raw)))
                .catch(() => {});
            } catch (err) {
              console.warn("ICE candidate error:", err);
            }
          });
        };

        const unsubRoom = onSnapshot(roomRef, async (snap) => {
          try {
            const data = snap.data();
            if (
              !data ||
              !pc.current ||
              pc.current.signalingState === "closed" ||
              isClosingRef.current ||
              startToken !== startTokenRef.current
            ) {
              return;
            }

            if (data.endedAt && data.endedBy && data.endedBy !== auth.currentUser?.uid) {
              if (!hasEndedRef.current) {
                hasEndedRef.current = true;
                setStatus("Call ended");
                await recordCallHistory("completed");
                closeStreams();
                navigate("/messages", { replace: true });
              }
              return;
            }

            if (!pc.current.remoteDescription && data.offer && !isCaller) {
              await pc.current.setRemoteDescription(data.offer);
              const answer = await pc.current.createAnswer();
              if (pc.current.signalingState !== "closed" && startToken === startTokenRef.current) {
                await pc.current.setLocalDescription(answer);
              }
              if (startToken === startTokenRef.current) {
                await updateDoc(roomRef, {
                  answer,
                  answerForOfferId: data.offerId || null,
                });
              }
            }

            if (
              isCaller &&
              hasOfferedRef.current &&
              data.answer &&
              !pc.current.remoteDescription &&
              pc.current.signalingState !== "closed"
            ) {
              const expectedOfferId = offerIdRef.current;
              const actualOfferId = data.answerForOfferId || data.offerId || null;
              if (!expectedOfferId || actualOfferId !== expectedOfferId) return;
              await pc.current.setRemoteDescription(data.answer);
            }

            const candidates = isCaller ? data.calleeCandidates : data.callerCandidates;
            applyCandidates(candidates);
          } catch (err) {
            console.error("Snapshot handler error:", err);
          }
        });

        if (
          isCaller &&
          !hasOfferedRef.current &&
          pc.current?.signalingState === "stable" &&
          !isClosingRef.current &&
          startToken === startTokenRef.current
        ) {
          try {
            const offer = await pc.current.createOffer();
            if (pc.current.signalingState === "stable" && startToken === startTokenRef.current) {
              await pc.current.setLocalDescription(offer);
              hasOfferedRef.current = true;

              // Update the room doc cleared/created above.
              await updateDoc(roomRef, {
                offer,
                offerId: offerIdRef.current || null,
              });
            }
          } catch (err) {
            console.error("Offer creation error:", err);
          }
        }

        return () => unsubRoom();
      } catch (err) {
        console.error("WebRTC call error:", err);
        setStatus("Unable to start call");
      } finally {
        startInFlightRef.current = false;
      }
    };

    let cleanup = null;
    startCall().then((fn) => {
      cleanup = fn;
    });

    return () => {
      isMounted = false;
      isClosingRef.current = true;
      startTokenRef.current += 1;
      if (cleanup) cleanup();
      pc.current?.close();
      pc.current = null;
      hasStartedRef.current = false;
      startInFlightRef.current = false;
    };
  }, [callType, navigate, recordCallHistory, role, roomID]);

  const toggleMic = () => {
    localStream.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicOn((prev) => !prev);
  };

  const toggleCamera = () => {
    const tracks = localStream.current?.getVideoTracks() || [];
    if (tracks.length === 0) return;
    tracks.forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCamOn((prev) => !prev);
  };

  const shareScreen = async () => {
    if (
      !pc.current ||
      pc.current.connectionState === "closed" ||
      pc.current.signalingState === "closed" ||
      isClosingRef.current
    ) {
      return;
    }

    if (screenOn) {
      stopScreenShare();
      return;
    }

    try {
      screenStream.current = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      if (
        !pc.current ||
        pc.current.connectionState === "closed" ||
        pc.current.signalingState === "closed" ||
        isClosingRef.current
      ) {
        screenStream.current.getTracks().forEach((t) => t.stop());
        return;
      }

      const sender = pc.current
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");

      if (!sender) return;

      try {
        sender.replaceTrack(screenStream.current.getVideoTracks()[0]);
        setScreenOn(true);
      } catch (err) {
        console.warn("Screen share replaceTrack error:", err);
        screenStream.current.getTracks().forEach((t) => t.stop());
        screenStream.current = null;
        return;
      }

      screenStream.current.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  };

  const stopScreenShare = () => {
    if (
      !pc.current ||
      pc.current.connectionState === "closed" ||
      pc.current.signalingState === "closed" ||
      isClosingRef.current
    ) {
      screenStream.current?.getTracks().forEach((t) => t.stop());
      screenStream.current = null;
      setScreenOn(false);
      return;
    }

    const sender = pc.current
      ?.getSenders()
      .find((s) => s.track && s.track.kind === "video");

    const localVideoTrack = localStream.current?.getVideoTracks()?.[0];

    if (sender && localVideoTrack) {
      try {
        sender.replaceTrack(localVideoTrack);
      } catch (err) {
        console.warn("Stop screen share replaceTrack error:", err);
      }
    }

    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    setScreenOn(false);
  };

  const buildCallPayload = useCallback((statusValue) => {
    const duration = callStartTime.current
      ? Math.floor((Date.now() - callStartTime.current) / 1000)
      : 0;

    return {
      caller: auth.currentUser?.uid,
      callerName: auth.currentUser?.email,
      receiver: remoteUserId || null,
      receiverName: remoteName || null,
      participants: remoteUserId
        ? [auth.currentUser?.uid, remoteUserId]
        : [auth.currentUser?.uid],
      roomID,
      status: statusValue,
      duration,
      type: callType,
      createdAt: serverTimestamp(),
    };
  }, [callType, remoteName, remoteUserId, roomID]);

  const recordCallHistory = useCallback(async (statusValue) => {
    if (hasRecordedRef.current) return;
    hasRecordedRef.current = true;

    try {
      await addDoc(collection(db, "callHistory"), buildCallPayload(statusValue));
    } catch (err) {
      console.error("Error saving call history:", err);
    }
  }, [buildCallPayload]);

  const closeStreams = useCallback(() => {
    isClosingRef.current = true;
    localStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
    pc.current?.close();
  }, []);

  const handleLeave = async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    try {
      await updateDoc(doc(db, "webrtcRooms", roomID), {
        endedAt: serverTimestamp(),
        endedBy: auth.currentUser?.uid || null,
      });
    } catch (err) {
      console.warn("Failed to signal call end:", err);
    }

    await recordCallHistory("completed");
    closeStreams();

    if (!remoteUserId) {
      navigate("/messages", { replace: true });
      return;
    }

    const q = query(
      collection(db, "reviews"),
      where("fromUser", "==", auth.currentUser.uid),
      where("toUser", "==", remoteUserId),
      where("roomID", "==", roomID)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      setTargetUserId(remoteUserId);
      setRoomIDState(roomID);
      setShowRating(true);
    } else {
      navigate("/messages", { replace: true });
    }
  };

  const markCompleted = async () => {
    if (!auth.currentUser?.uid) return;
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      sessionsCompleted: increment(1),
    });

    setShowCompletePopup(false);
    navigate("/messages", { replace: true });
  };

  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (hasEndedRef.current) return;
      try {
        await updateDoc(doc(db, "webrtcRooms", roomID), {
          endedAt: serverTimestamp(),
          endedBy: auth.currentUser?.uid || null,
        });
      } catch (err) {
        console.warn("Failed to signal call end on unload:", err);
      }
      await recordCallHistory("abandoned");
      closeStreams();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [closeStreams, recordCallHistory, roomID]);

  return (
    <div className="webrtc-page">
      <header className="webrtc-header">
        <div>
          <h2>WebRTC Call</h2>
          <p>{status}</p>
        </div>
        <div className="webrtc-badges">
          <span className="webrtc-badge">
            {callType === "audio" ? "Audio" : "Video"} Call
          </span>
          {remoteName && <span className="webrtc-badge">With {remoteName}</span>}
        </div>
      </header>

      <div className="webrtc-stage">
        {role === "caller" && !remoteVideoReady && !hasEndedRef.current && (
          <div className="webrtc-calling-popup">
            <div className="webrtc-calling-card">
              <p className="webrtc-calling-title">Calling</p>
              <h3>{remoteName || "User"}</h3>
              <p className="webrtc-calling-subtitle">
                {callType === "audio" ? "Audio" : "Video"} call in progress...
              </p>
              <button className="webrtc-btn danger" onClick={handleLeave}>
                End Call
              </button>
            </div>
          </div>
        )}
        <div className="webrtc-remote">
          <video ref={remoteVideo} autoPlay playsInline />
          {!remoteVideoReady && (
            <div className="webrtc-placeholder">Waiting for peer...</div>
          )}
        </div>
        <div className={`webrtc-local ${camOn ? "" : "muted"}`}>
          <video ref={localVideo} autoPlay playsInline muted />
          {!camOn && <div className="webrtc-placeholder">Camera off</div>}
        </div>
      </div>

      <div className="webrtc-controls">
        <button className="webrtc-btn" onClick={toggleMic}>
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button className="webrtc-btn" onClick={toggleCamera} disabled={callType === "audio"}>
          {camOn ? "Camera Off" : "Camera On"}
        </button>
        <button className="webrtc-btn" onClick={shareScreen}>
          {screenOn ? "Stop Share" : "Share Screen"}
        </button>
        <button className="webrtc-btn" onClick={() => setShowWhiteboard(true)}>
          Whiteboard
        </button>
        <button className="webrtc-btn" onClick={() => setShowEditor(true)}>
          Code Editor
        </button>
        <button className="webrtc-btn danger" onClick={handleLeave}>
          End Call
        </button>
      </div>

      {showRating && (
        <div className="rating-popup">
          <RateUser
            toUserId={targetUserId}
            roomID={roomIDState}
            onClose={() => {
              setShowRating(false);
              navigate("/messages", { replace: true });
            }}
            onSuccess={() => {
              setShowRating(false);
              setShowCompletePopup(true);
            }}
          />
        </div>
      )}

      {showCompletePopup && (
        <div className="rating-popup">
          <div className="rating-box">
            <h3>Session Completed?</h3>
            <p>Did the session go well?</p>
            <div className="rating-actions">
              <button onClick={markCompleted}>Yes</button>
              <button onClick={() => setShowCompletePopup(false)}>No</button>
            </div>
          </div>
        </div>
      )}

      {showEditor && !isEditorMinimized && createPortal(
        <div className="webrtc-overlay webrtc-editor">
          <button className="overlay-btn" onClick={() => setIsEditorMinimized(true)}>
            _
          </button>
          <button
            className="overlay-btn close"
            onClick={() => {
              setShowEditor(false);
              setIsEditorMinimized(false);
            }}
          >
            ❌
          </button>
          <CodeEditor />
        </div>,
        document.body
      )}

      {showWhiteboard && !isWhiteboardMinimized && createPortal(
        <div className="webrtc-overlay webrtc-whiteboard">
          <button
            className="overlay-btn"
            onClick={() => setIsWhiteboardMinimized(true)}
          >
            Minimize _
          </button>
          <button
            className="overlay-btn close"
            onClick={() => setShowWhiteboard(false)}
          >
            Close ❌
          </button>
          <Whiteboard />
        </div>,
        document.body
      )}

      {isEditorMinimized && (
        <button
          className="webrtc-float"
          onClick={() => setIsEditorMinimized(false)}
        >
          Open Editor
        </button>
      )}

      {isWhiteboardMinimized && (
        <button
          className="webrtc-float"
          onClick={() => setIsWhiteboardMinimized(false)}
        >
          Open Whiteboard
        </button>
      )}
    </div>
  );
}