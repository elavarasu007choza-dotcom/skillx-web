import React, { useEffect, useRef, useState } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import RateUser from "./RateUser";
import Whiteboard from "./Whiteboard";
import { createPortal } from "react-dom";
import { Button } from "@excalidraw/excalidraw";
import CodeEditor from "./CodeEditor";
import { doc, updateDoc, increment } from "firebase/firestore";

const VideoCall = () => {
  const containerRef = useRef(null);
  const hasJoined = useRef(false);
  const user =auth.currentUser;

  const [showRating, setShowRating] = useState(false);
  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [targetUserId, setTargetUserId] = useState(null);
  const [roomIDState, setRoomIDState] = useState(null);

  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [isEditorMinimized, setIsEditorMinimized] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    if (hasJoined.current) return;
    hasJoined.current = true;


    const roomFromURL = window.location.pathname.split("/video-call/")[1];
    const roomID = roomFromURL || "SkillExchangeRoom";
    setRoomIDState(roomID);

    const userID = auth.currentUser?.uid || Date.now().toString();
    const userName = auth.currentUser?.email || "User_" + userID;

    const params = new URLSearchParams(window.location.search);
    const remoteUserId = params.get("User");
    const remoteUserName = params.get("name");

    console.log("Remote ID:", remoteUserId);

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      719135717,
      "3afe9c9f03987b9da0999aeefba1b151",
      roomID,
      userID,
      userName
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);

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
        try {
          await addDoc(collection(db, "callHistory"), {
            caller: auth.currentUser?.uid,
            callerName: auth.currentUser?.email,
            receiver: remoteUserId,
            receiverName: remoteUserName,

            participants: [auth.currentUser?.uid, remoteUserId],
            roomID: roomID,
            status: "completed",
            createdAt: new Date(),
          });

          // ✅ CHECK ALREADY RATED
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
            window.location.href = "/messages";
          }

        } catch (err) {
          console.log("Error saving call history:", err);
        }
      },
    });
  }, []);

  

  const markCompleted = async () => {
  const userRef = doc(db, "users", user.uid);

  await updateDoc(userRef, {
    sessionsCompleted: increment(1),
  });

  alert("Session Completed ✅");
  setShowCompletePopup(false);
};

  // TAB CLOSE SAFETY
  useEffect(() => {
    const handleBeforeUnload = async () => {
      try {
        await addDoc(collection(db, "callHistory"), {
          caller: auth.currentUser?.uid,
          callerName: auth.currentUser?.email,
          users: [auth.currentUser?.uid],
          status: "abandoned",
          time: new Date(),
        });
      } catch (err) {
        console.log(err);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}

        style={{ width: "100%", height: "100vh" }}
      />

      <button
        onClick={() => setShowEditor(true)}
        style={{
          position: "fixed",
          bottom: "20px",
          left: "180px",
          zIndex: 999999,
          padding: "10px",
          background: "blue",
          color: "white",
          borderRadius: "8px",
          border: "none"
        }}
      >
        Code Editor
      </button>

      <button
        onClick={() => {
          console.log("WHITEBOARD CLICKED");
          setShowWhiteboard(prev => !prev);
        }}
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20%",
          zIndex: 999999,
          padding: "10px 15px",
          background: "#000",
          color: "#fff",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer"
        }}
      >
        Whiteboard
      </button>

      {/* ⭐ RATING POPUP */}
      {showRating && (
        <div className="rating-popup">
          <RateUser
            toUserId={targetUserId}
            roomID={roomIDState}
            onClose={() => {
              setShowRating(false);
              
              
            }}
            onSuccess={() =>{
              setShowRating(false);
              setShowCompletePopup(true);

            }}
          />

        </div>
      )}

      {showCompletePopup && (
        <div className="popup">
          <h3>Session Completed?</h3>
          <button onClick={markCompleted}>Yes</button>
          
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