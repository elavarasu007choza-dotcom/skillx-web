import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="lp">
      {/* Top Nav */}
      <header className="lp-nav">
        <div className="lp-brand">SkillX</div>
        <nav className="lp-nav-actions">
          <button className="lp-link" onClick={() => navigate("/login")}>
            Login
          </button>
          <button className="lp-btn primary" onClick={() => navigate("/signup")}>
            Get Started
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-left">
          <h1>
            Exchange skills. <br />
            <span>Grow together.</span>
          </h1>
          <p>
            A modern peer-to-peer platform to learn and teach skills with
            confidence. Clean, secure, and built for real collaboration.
          </p>

          <div className="lp-cta">
  <button
    className="lp-btn primary big"
    onClick={() => navigate("/login")}
  >
    Start Learning
  </button>

  <button
    className="lp-btn secondary big"
    onClick={() => navigate("/login")}
  >
    I already have an account
  </button>
</div>

        </div>

        {/* Visual */}
        <div className="lp-hero-right">
          <div className="hero-glass">
            <div className="hero-dots">
              <span className="d blue" />
              <span className="d green" />
              <span className="d purple" />
            </div>
            <h3>Smart Skill Exchange</h3>
            <p>Teach what you know • Learn what you love</p>

            <div className="mini-cards">
              <div className="mini">Java</div>
              <div className="mini">UI / UX</div>
              <div className="mini">Data</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="lp-features">
        <div className="feature-card">
          <h4>Peer Learning</h4>
          <p>Connect directly with people who share real skills.</p>
        </div>
        <div className="feature-card">
          <h4>Simple & Secure</h4>
          <p>Focused UX with safe session handling.</p>
        </div>
        <div className="feature-card">
          <h4>Built for Growth</h4>
          <p>Learn, teach, and build together.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        © {new Date().getFullYear()} SkillX • Built with ❤️
      </footer>
    </div>
  );
}

export default LandingPage;
