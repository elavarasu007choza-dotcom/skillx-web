import { useState } from "react";
import "./MySkills.css";
import BackButton from "../components/BackButton";

function MySkills() {
  const [skill, setSkill] = useState("");
  const [skills, setSkills] = useState(
    JSON.parse(localStorage.getItem("skills")) || []
  );

  const addSkill = () => {
    if (!skill) return;

    const updated = [...skills, skill];
    setSkills(updated);
    localStorage.setItem("skills", JSON.stringify(updated));
    setSkill("");
  };

  return (
    <div className="page-wrapper">
      <BackButton />
      <h2 className="page-title">My Skills</h2>
      <p className="page-sub">
        Add and manage the skills you can teach
      </p>

      {/* ADD SKILL */}
      <div className="skill-add">
        <input
          type="text"
          placeholder="Enter a skill (eg: Java, UI/UX)"
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
        />
        <button onClick={addSkill}>Add Skill</button>
      </div>

      {/* SKILL LIST */}
      <div className="skill-list">
        {skills.length === 0 && (
          <p className="empty">No skills added yet</p>
        )}

        {skills.map((s, index) => (
          <div className="skill-card" key={index}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MySkills;
