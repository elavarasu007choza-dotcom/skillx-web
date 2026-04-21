const admin = require("firebase-admin");

const USER_ALLOWED_ACTIONS = new Set([
  "send_request",
  "send_message",
]);

const DEVELOPER_ONLY_ACTIONS = new Set([
  "admin_delete_user",
  "admin_set_role",
]);

const normalizeText = (value = "") => String(value || "").trim();

function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin environment variables");
  }

  return { projectId, clientEmail, privateKey };
}

function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = getServiceAccount();
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function findTargetUser(db, actorUid, rawTarget) {
  const target = normalizeText(rawTarget).toLowerCase();
  if (!target) return null;

  const usersSnap = await db.collection("users").get();
  let matched = null;

  usersSnap.forEach((docSnap) => {
    if (matched) return;
    if (docSnap.id === actorUid) return;

    const data = docSnap.data() || {};
    const name = normalizeText(data.name).toLowerCase();
    const email = normalizeText(data.email).toLowerCase();

    if (name === target || name.includes(target) || email === target) {
      matched = { id: docSnap.id, ...data };
    }
  });

  return matched;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const app = getAdminApp();
    const db = app.firestore();

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing auth token" });
    }

    const decoded = await app.auth().verifyIdToken(token);
    const actorUid = decoded.uid;

    const action = normalizeText(req.body?.action);
    const targetUserHint = normalizeText(req.body?.targetUser);
    const message = normalizeText(req.body?.message);

    if (!action) {
      return res.status(400).json({ ok: false, error: "Missing action" });
    }

    if (!USER_ALLOWED_ACTIONS.has(action) && !DEVELOPER_ONLY_ACTIONS.has(action)) {
      return res.status(403).json({ ok: false, error: "Action is not allowed" });
    }

    const actorSnap = await db.collection("users").doc(actorUid).get();
    const actorData = actorSnap.data() || {};
    const actorRole = normalizeText(actorData.role || "user").toLowerCase();

    if (DEVELOPER_ONLY_ACTIONS.has(action) && actorRole !== "developer") {
      return res.status(403).json({ ok: false, error: "Developer role required" });
    }

    const auditRef = db.collection("aiActionLogs").doc();
    await auditRef.set({
      action,
      actorUid,
      actorRole,
      targetUserHint,
      message,
      source: "dashboard-chatbot",
      status: "started",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const targetUser = await findTargetUser(db, actorUid, targetUserHint);
    if (!targetUser) {
      await auditRef.update({
        status: "failed",
        error: "target-user-not-found",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(404).json({ ok: false, error: "Target user not found" });
    }

    if (action === "send_request") {
      const skill = normalizeText(req.body?.skill || "general");

      await db.collection("skillRequests").add({
        senderId: actorUid,
        receiverId: targetUser.id,
        senderName: normalizeText(actorData.name || actorData.email || "User"),
        senderPhoto: normalizeText(actorData.photoURL || ""),
        skill,
        message: message || "Let's connect for skill exchange",
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection("notifications").add({
        userId: targetUser.id,
        message: `📨 New skill request from ${normalizeText(actorData.name || "User")}`,
        type: "request",
        title: "AI Assisted Request",
        metadata: { action, actorUid },
        seen: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (action === "send_message") {
      const chatId = [actorUid, targetUser.id].sort().join("_");

      await db.collection("chats").doc(chatId).set(
        {
          users: [actorUid, targetUser.id],
          lastMessage: message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await db.collection("chats").doc(chatId).collection("messages").add({
        text: message,
        senderId: actorUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        seenBy: [actorUid],
      });

      await db.collection("notifications").add({
        userId: targetUser.id,
        message: `💬 New message from ${normalizeText(actorData.name || "User")}`,
        type: "message",
        title: "AI Assisted Message",
        metadata: { action, actorUid },
        seen: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await auditRef.update({
      status: "success",
      targetUid: targetUser.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      ok: true,
      action,
      target: {
        uid: targetUser.id,
        name: normalizeText(targetUser.name || targetUser.email || "User"),
      },
    });
  } catch (error) {
    console.error("ai-agent-action error", error);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
};
