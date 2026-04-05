import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import "./Login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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

  // 🌐 Google Login (NO firestore touch)
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.log(err);
      alert("Google login failed");
    }
  };

  return (
    <div className="login-page">
      
      {/* LEFT SIDE */}
      <div className="login-left">
        <h1>SkillX</h1>
        <p className="tagline">Upgrade Your Skills</p>

        <div className="icons">
          <span>💻</span>
          <span>🎓</span>
          <span>⚡</span>
        </div>

        <p className="bottom-text">Learn • Share • Grow</p>
      </div>

      {/* RIGHT SIDE */}
      <div className="login-box">
        <h2>Welcome Back</h2>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

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
  );
}

export default Login;