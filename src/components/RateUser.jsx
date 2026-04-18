import { useState } from "react";
import { db, auth } from "../firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  getDoc
} from "firebase/firestore";
import { sendNotification } from "../utils/sendNotification";

export default function RateUser({ toUserId, roomID, onClose, onSuccess }) {

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const submitReview = async () => {
    try {

      if(!toUserId){
        alert("User not found");
        return;
      }
      if(!auth.currentUser){
        alert("Login required");
        return;
      }
      // SAVE REVIEW
      await addDoc(collection(db, "reviews"), {
        fromUser: auth.currentUser.uid,
        toUser: toUserId,
        rating,
        comment,
        roomID,
        createdAt: serverTimestamp()
      });

      // GET OLD DATA
      const userRef = doc(db, "users", toUserId);
      const userSnap = await getDoc(userRef);

      let oldTotal = 0;
      let oldCount = 0;

      if (userSnap.exists()) {
        oldTotal = userSnap.data().ratingSum || 0;
        oldCount = userSnap.data().totalReviews || 0;
      }

      // CALCULATE NEW AVG
      const newTotal = oldTotal + rating;
      const newCount = oldCount + 1;
      const avgRating = newTotal / newCount;

      // UPDATE USER
      await updateDoc(userRef, {
        totalReviews: increment(1),
        ratingSum: newTotal,
        rating: avgRating
      });

      // Send notification to rated user
      await sendNotification(
        toUserId,
        `You received a ${rating}⭐ review!`,
        "review",
        "New Review"
      );

      alert("Review submitted ⭐");

      if (onSuccess) {
        onSuccess();
      } else {
        onClose?.();
      }

    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="rating-box">

      <h3>Rate User</h3>

      <div className="stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} onClick={() => setRating(star)}>
            {rating >= star ? "⭐" : "☆"}
          </span>
        ))}
      </div>

      <br />

      <textarea
        placeholder="Write review"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <br />

      

      <button onClick={submitReview}>
        Submit
      </button>

      <br /><br />

      <button onClick={onClose}>
        Close
      </button>

    </div>
  );
}
