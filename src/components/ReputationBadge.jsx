export default function ReputationBadge({score}){

  let badge = "New User";

  if(score >= 4.5) badge = "🏆 Trusted Mentor";
  else if(score >= 4) badge = "⭐ Good Mentor";
  else if(score >= 3) badge = "👍 Beginner";

  return(
    <p>{badge}</p>
  );
}