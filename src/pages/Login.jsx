import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./Login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");

  // 🔐 Email Login
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Enter email & password");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      alert("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // 🌐 Google Login
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: result.user.uid,
          name: result.user.displayName || "Google User",
          email: result.user.email,
          photoURL: result.user.photoURL || null,
          createdAt: serverTimestamp(),
        });
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.log(err);
      alert("Google login failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔁 Forgot Password
  const handleForgotPassword = async () => {
    const userEmail = email.trim();

    if (!userEmail) {
      setInfoMsg("Please enter your email first");
      return;
    }

    try {
      setResetLoading(true);
      setInfoMsg("");
      await sendPasswordResetEmail(auth, userEmail);
      setInfoMsg("Password reset link sent to your email");
    } catch (err) {
      if (err?.code === "auth/user-not-found") {
        setInfoMsg("No account found with this email");
      } else if (err?.code === "auth/invalid-email") {
        setInfoMsg("Please enter a valid email");
      } else {
        setInfoMsg("Unable to send reset link right now");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        {/* LEFT SIDE */}
        <div className="login-left">
          <h1>SkillX</h1>
          <p className="tagline">Upgrade Your Skills</p>

          <div className="icons">
            <span className="icon-laptop">💻</span>
            <span className="icon-cap">🎓</span>
            <span className="icon-bolt">⚡</span>
          </div>

          <p className="bottom-text">Learn • Share • Grow</p>
        </div>

        {/* RIGHT SIDE */}
        <div className="login-box">
          <h2>Welcome Back</h2>

          <form onSubmit={handleLogin}>
            <label htmlFor="login-email" className="field-label">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="login-password" className="field-label">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>

            <button
              type="button"
              className="forgot-link"
              onClick={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading ? "Sending reset link..." : "Forgot password?"}
            </button>
          </form>

          {infoMsg && <p className="login-info-msg">{infoMsg}</p>}

          <p className="divider">or</p>

          {/* GOOGLE BUTTON */}
          <button className="google-btn" onClick={handleGoogleLogin}>
            🔵 Continue with Google
          </button>

          <p className="login-footer">
            New user?{" "}
            <span onClick={() => navigate("/signup")}>
              Create account
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
