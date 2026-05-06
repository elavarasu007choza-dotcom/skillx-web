import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from?.pathname || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [popup, setPopup] = useState({ open: false, message: "", type: "error" });
  const popupTimerRef = useRef(null);

  const showPopup = (message, type = "error") => {
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
    }

    setPopup({ open: true, message, type });

    popupTimerRef.current = setTimeout(() => {
      setPopup((prev) => ({ ...prev, open: false }));
    }, 3200);
  };

  const resolvePostLoginTarget = useCallback(async (user) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
      });

      return { path: "/profile", state: { startEdit: true } };
    }

    return { path: redirectPath };
  }, [redirectPath]);

  useEffect(() => {
    let isMounted = true;

    const processGoogleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);

        if (!result?.user || !isMounted) {
          return;
        }

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

        const target = await resolvePostLoginTarget(result.user);
        navigate(target.path, { replace: true, state: target.state });
      } catch (err) {
        if (!isMounted) {
          return;
        }

        if (err?.code !== "auth/no-auth-event") {
          console.error("Google redirect login error:", err);
          showPopup("Google login failed. Please try again.");
        }
      }
    };

    processGoogleRedirectResult();

    return () => {
      isMounted = false;
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
    };
  }, [navigate, resolvePostLoginTarget]);

  // 🔐 Email Login
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      showPopup("Enter email and password");
      return;
    }

    try {
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      const target = await resolvePostLoginTarget(result.user);
      navigate(target.path, { replace: true, state: target.state });
    } catch (err) {
      showPopup("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // 🌐 Google Login
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
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

      const target = await resolvePostLoginTarget(result.user);
      navigate(target.path, { replace: true, state: target.state });
    } catch (err) {
      console.error("Google login error:", err);

      if (err?.code === "auth/popup-blocked") {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithRedirect(auth, provider);
        return;
      }

      if (err?.code === "auth/unauthorized-domain") {
        showPopup("This domain is not authorized in Firebase. Please contact support.");
        return;
      }

      if (err?.code === "auth/operation-not-allowed") {
        showPopup("Google login is disabled in Firebase Authentication settings.");
        return;
      }

      if (err?.code === "auth/cancelled-popup-request" || err?.code === "auth/popup-closed-by-user") {
        showPopup("Google login was cancelled.", "info");
        return;
      }

      showPopup("Google login failed. Please try again.");
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
      {popup.open && (
        <div className={`auth-popup ${popup.type}`} role="alert" aria-live="assertive">
          <div className="auth-popup-icon">!</div>
          <div className="auth-popup-msg">{popup.message}</div>
          <button
            type="button"
            className="auth-popup-close"
            onClick={() => setPopup((prev) => ({ ...prev, open: false }))}
            aria-label="Close notification"
          >
            x
          </button>
        </div>
      )}
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
          <button className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
            <span className="google-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
                />
                <path
                  fill="#34A853"
                  d="M3.6 7.4l3.2 2.3C7.6 7.9 9.6 6.5 12 6.5c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 8.4 2.5 5.3 4.5 3.6 7.4z"
                />
                <path
                  fill="#FBBC05"
                  d="M12 21.5c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.5-1.9.9-3.4.9-3.9 0-5.3-2.6-5.5-3.9l-3.2 2.5C5.1 19.3 8.3 21.5 12 21.5z"
                />
                <path
                  fill="#4285F4"
                  d="M21.1 14.2c.1-.4.1-.8.1-1.3s0-.9-.1-1.3H12v3.9h5.5c-.3 1.2-1.1 2.2-2.1 3l2.9 2.4c1.7-1.6 2.8-4 2.8-6.7z"
                />
              </svg>
            </span>
            <span>{loading ? "Please wait..." : "Continue with Google"}</span>
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
