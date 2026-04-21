import React, { useEffect, useMemo, useRef, useState } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { addDoc, collection, query, where, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import RateUser from "./RateUser";
import Whiteboard from "./Whiteboard";
import { createPortal } from "react-dom";
import CodeEditor from "./CodeEditor";

const VideoCall = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const zpRef = useRef(null);
  const hasJoined = useRef(false);
  const callStartTime = useRef(null);
  const user = auth.currentUser;

  const [showRating, setShowRating] = useState(false);
  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [targetUserId, setTargetUserId] = useState(null);
  const [roomIDState, setRoomIDState] = useState(null);

  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [isEditorMinimized, setIsEditorMinimized] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const callType = useMemo(() => {
    const typeParam = new URLSearchParams(window.location.search).get("type");
    return typeParam === "audio" ? "audio" : "video";
  }, []);

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    const sessionKey = "zego_join_" + window.location.pathname;
    
    if (!isReady || !containerRef.current || !auth.currentUser) return;
    if (sessionStorage.getItem(sessionKey)) return;
    if (hasJoined.current) return;

    sessionStorage.setItem(sessionKey, "true");
    hasJoined.current = true;

    const roomFromURL = window.location.pathname.split("/video-call/")[1];
    const roomID = roomFromURL || "SkillExchangeRoom";
    setRoomIDState(roomID);

    const userID = auth.currentUser?.uid || Date.now().toString();
    const userName = auth.currentUser?.email || "User_" + userID;

    const params = new URLSearchParams(window.location.search);
    const remoteUserId = params.get("User");
    const remoteUserName = params.get("name");
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      719135717,
      "3afe9c9f03987b9da0999aeefba1b151",
      roomID,
      userID,
      userName
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zpRef.current = zp;
    callStartTime.current = Date.now();

    zp.joinRoom({
      container: containerRef.current,

      sharedLinks: [
        {
          name: "Copy Link",
          url: window.location.href,
        },
      ],

      scenario: {
        mode: ZegoUIKitPrebuilt.OneONoneCall,
      },



      onLeaveRoom: async () => {
        const duration = callStartTime.current 
          ? Math.floor((Date.now() - callStartTime.current) / 1000) 
          : 0;
        
        try {
          await addDoc(collection(db, "callHistory"), {
            caller: auth.currentUser?.uid,
            callerName: auth.currentUser?.email,
            receiver: remoteUserId,
            receiverName: remoteUserName,

            participants: [auth.currentUser?.uid, remoteUserId],
            roomID: roomID,
            status: "completed",
            duration: duration,
            type: callType,
            createdAt: new Date(),
          });

          // CHECK ALREADY RATED
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
            const duration = callStartTime.current 
              ? Math.floor((Date.now() - callStartTime.current) / 1000) 
              : 0;
            await addDoc(collection(db, "callHistory"), {
              caller: auth.currentUser?.uid,
              callerName: auth.currentUser?.email,
              receiver: remoteUserId,
              receiverName: remoteUserName,
              participants: [auth.currentUser?.uid, remoteUserId],
              roomID: roomID,
              status: "completed",
              duration: duration,
              type: callType,
              createdAt: new Date(),
            });
            navigate("/messages", { replace: true });
          }

        } catch (err) {
          console.error("Error saving call history:", err);
        }
      },
    });

    return () => {
      if (zpRef.current) {
        zpRef.current.destroy();
        zpRef.current = null;
      }
    };
  }, [isReady, navigate, callType]);

  

  const markCompleted = async () => {
    if (!user?.uid) return;
    
    const userRef = doc(db, "users", user.uid);

    await updateDoc(userRef, {
      sessionsCompleted: increment(1),
    });

    setShowCompletePopup(false);
    navigate("/messages", { replace: true });
  };

  // TAB CLOSE SAFETY
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const duration = callStartTime.current 
        ? Math.floor((Date.now() - callStartTime.current) / 1000) 
        : 0;
      
      try {
        await addDoc(collection(db, "callHistory"), {
          caller: auth.currentUser?.uid,
          callerName: auth.currentUser?.email,
          participants: [auth.currentUser?.uid],
          status: "abandoned",
          duration: duration,
          type: callType,
          createdAt: new Date(),
        });
      } catch (err) {
        console.error("Error in beforeunload handler:", err);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [callType]);

  return (
    <>
      <div
        ref={containerRef}

        style={{ width: "100%", height: "100vh" }}
      />

      <button
        onClick={() => setShowEditor(true)}
        title="Open Code Editor"
        aria-label="Open Code Editor"
        style={{
          position: "fixed",
          bottom: "20px",
          left: "110px",
          zIndex: 999999,
          width: "48px",
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          fontWeight: "700",
          background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
          color: "white",
          borderRadius: "14px",
          border: "none",
          boxShadow: "0 8px 18px rgba(37,99,235,0.32)",
          cursor: "pointer"
        }}
      >
        &lt;/&gt;
      </button>

      <button
        onClick={() => {
          setShowWhiteboard(prev => !prev);
        }}
        title="Open Whiteboard"
        aria-label="Open Whiteboard"
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          zIndex: 999999,
          width: "48px",
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "#fff",
          borderRadius: "14px",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 8px 18px rgba(15,23,42,0.32)"
        }}
      >
        📝
      </button>

      {/* ⭐ RATING POPUP */}
      {showRating && (
        <div className="rating-popup">
          <RateUser
            toUserId={targetUserId}
            roomID={roomIDState}
            onClose={() => {
              setShowRating(false);
              navigate("/messages", { replace: true });
            }}
            onSuccess={() =>{
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
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={markCompleted}>Yes</button>
              <button onClick={() => setShowCompletePopup(false)}>No</button>
            </div>
          </div>
        </div>
      )}

      {showEditor && !isEditorMinimized && createPortal(
        <div
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            zIndex: 999999,
            background: "#1e1e1e"
          }}
        >

          {/* Minimize */}
          <button
            onClick={() => setIsEditorMinimized(true)}
            style={{
              position: "absolute",
              top: 10,
              right: 100

            }}
          >
            _
          </button>

          {/* Close */}
          <button
            onClick={() => {
              setShowEditor(false);
              setIsEditorMinimized(false);
            }}
            style={{
              position: "absolute", top: 10, right: 20
            }}
          >
            ❌
          </button>

          <CodeEditor />

        </div>,
        document.body
      )}

      {showWhiteboard && !isMinimized && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 999999,
            background: "#fff"
          }}
        >
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              position: "absolute",
              top: "10px",
              right: "120px",
              zIndex: 1000000,
              padding: "6px 12px",
              background: "orange",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Minimize _
          </button>

          {/* CLOSE BUTTON  */}

          <button
            onClick={() => setShowWhiteboard(false)}
            style={{
              position: "absolute",
              top: "10px",
              right: "20px",
              zIndex: 1000000,
              padding: "8px 15px",
              background: "red",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Close ❌
          </button>

          <Whiteboard />
        </div>,
        document.body
      )
      }

      {isEditorMinimized && (
        <button
          onClick={() => setIsEditorMinimized(false)}
          style={{
            position: "fixed",
            bottom: "80px",
            right: "20px",
            zIndex: 999999
          }}
        >
          Open Editor
        </button>
      )}

      {isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "210px",
            zIndex: 999999,
            padding: "10px 15px",
            background: "black",
            color: "white",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          Open Whiteboard
        </button>
      )}

    </>

  );
};

export default VideoCall;
