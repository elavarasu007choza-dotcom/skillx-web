import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function BackButton() {
  const navigate = useNavigate();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <button
      onClick={() => navigate(-1)}
      className="back-btn"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      title="Go back to previous page"
    >
      <span style={{ fontSize: isHovering ? "18px" : "16px", transition: "font-size 0.2s" }}>←</span>
      Back
    </button>
  );
}
