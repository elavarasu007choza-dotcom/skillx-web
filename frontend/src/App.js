import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VideoCall from "./components/VideoCall";
import IncomingCallNotifier from "./components/IncomingCallNotifier";
import SessionReminder from "./components/SessionReminder";
import WebRTCCall from "./pages/WebRTCCall";
import CallHistory from "./pages/CallHistory";
import { initNotificationSounds } from "./utils/notificationSound";

import Dashboard from "./pages/Dashboard";
import Notifications from "./pages/Notifications";
import MySkills from "./pages/MySkills";
import Requests from "./pages/Requests";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import NotificationSettings from "./pages/NotificationSettings";
import SendRequest from "./pages/SendRequest";
import OpenRequests from "./pages/OpenRequests";
import OpenRequestsList from "./pages/OpenRequestsList";
import Certificate from "./pages/Certificate";
import UserProfile from "./pages/UserProfile";
import ProtectedRoute from "./pages/ProtectedRoute";
import PublicRoute from "./pages/PublicRoute";
import ScheduleSession from "./pages/ScheduleSession";
import MySessions from "./pages/MySessions";

function App() {
// Initialize notification sounds on app load
useEffect(() => {
initNotificationSounds();
}, []);

return (
<Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
<SessionReminder />
<IncomingCallNotifier />
<Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/video-call/:roomID" element={<VideoCall />} />
        {/* <Route path="/webrtc/:roomID" element={<WebRTCCall />} /> */}
        <Route path="/call-history" element={<ProtectedRoute><CallHistory /></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/notification-settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
        <Route path="/skills" element={<ProtectedRoute><MySkills /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="/send-request" element={<ProtectedRoute><SendRequest /></ProtectedRoute>} />
        <Route path="/post-open-request" element={<ProtectedRoute><OpenRequests /></ProtectedRoute>} />
         <Route path="/open-requests" element={<ProtectedRoute><OpenRequestsList /></ProtectedRoute>} />
         <Route path="/schedule/:userId"element={<ProtectedRoute><ScheduleSession /></ProtectedRoute>}/>
         <Route path="/my-sessions" element={<ProtectedRoute><MySessions /></ProtectedRoute>} />
           <Route path="/certificate" element={<ProtectedRoute><Certificate /></ProtectedRoute>} />
        <Route path="/user/:uid" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/messages/:userId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
