const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const OPENAI_KEY = defineSecret("OPENAI_KEY");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

/* ==============================
🔥 AUTO TAG GENERATION FUNCTION
============================== */
exports.generateTagsRetro = onDocumentCreated("openRequests/{requestId}", async (event) => {
  const snap = event.data;
  if (!snap || !snap.data()) return;
  const data = snap.data();
  const text = `${data.skill || ""} ${data.description || ""}`.toLowerCase();
  const tags = [];

  if (text.includes("react")) tags.push("frontend");
  if (text.includes("html") || text.includes("css")) tags.push("frontend");
  if (text.includes("java")) tags.push("backend");
  if (text.includes("python")) tags.push("backend");
  if (text.includes("sql") || text.includes("mongo")) tags.push("database");
  if (text.includes("ai") || text.includes("ml")) tags.push("data");

  await snap.ref.update({
    tags: [...new Set(tags)],
  });

  return null;
});

/* ==============================
📤 FILE UPLOAD FUNCTION
============================== */
exports.uploadChatFile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const { fileBase64, fileName, fileType, chatId } = data;

  if (!fileBase64 || !fileName || !chatId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }

  try {
    const bucket = admin.storage().bucket();
    const fileSizeBytes = Math.ceil((fileBase64.length * 3) / 4);
    const maxSize = 10 * 1024 * 1024;
    if (fileSizeBytes > maxSize) {
      throw new functions.https.HttpsError("invalid-argument", "File too large (max 10MB)");
    }

    const timestamp = Date.now();
    const filePath = `chat-files/${chatId}/${timestamp}_${fileName}`;
    const fileBuffer = Buffer.from(fileBase64, "base64");

    const file = bucket.file(filePath);
    await file.save(fileBuffer, {
      metadata: {
        contentType: fileType || "application/octet-stream",
      },
    });

    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });

    return { success: true, fileUrl: signedUrl, fileName };
  } catch (error) {
    console.error("File upload error:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to upload file"
    );
  }
});

/* ==============================
🤖 SEMANTIC ANALYSIS FUNCTION
============================== */
exports.semanticAnalysis = onRequest({ secrets: [OPENAI_KEY] }, async (req, res) => {
  const { description } = req.body;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Extract skill keywords from this: ${description}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY.value()}`,
        },
      }
    );

    res.json({
      result: response.data.choices[0].message.content,
    });
  } catch (error) {
    res.status(500).send("AI Error");
  }
});

/* ==============================
🤖 SECURE AI ACTION EXECUTOR
============================== */
const USER_ALLOWED_ACTIONS = new Set([
  "send_request",
  "send_message",
]);

const DEVELOPER_ONLY_ACTIONS = new Set([
  "admin_delete_user",
  "admin_set_role",
]);

const normalizeText = (value = "") => String(value || "").trim();

const findTargetUser = async (actorUid, rawTarget) => {
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
};

exports.aiAgentAction = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const actorUid = context.auth.uid;
  const action = normalizeText(data?.action);
  const targetUserHint = normalizeText(data?.targetUser);
  const message = normalizeText(data?.message);

  if (!action) {
    throw new functions.https.HttpsError("invalid-argument", "Missing action");
  }

  // Website-only guard: reject anything outside allowlist.
  if (!USER_ALLOWED_ACTIONS.has(action) && !DEVELOPER_ONLY_ACTIONS.has(action)) {
    throw new functions.https.HttpsError("permission-denied", "Action is not allowed");
  }

  const actorSnap = await db.collection("users").doc(actorUid).get();
  const actorData = actorSnap.data() || {};
  const actorRole = normalizeText(actorData.role || "user").toLowerCase();

  if (DEVELOPER_ONLY_ACTIONS.has(action) && actorRole !== "developer") {
    throw new functions.https.HttpsError("permission-denied", "Developer role required");
  }

  const auditRef = db.collection("aiActionLogs").doc();
  const baseAudit = {
    action,
    actorUid,
    actorRole,
    targetUserHint,
    message,
    source: "dashboard-chatbot",
    status: "started",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await auditRef.set(baseAudit);

  try {
    const targetUser = await findTargetUser(actorUid, targetUserHint);
    if (!targetUser) {
      await auditRef.update({
        status: "failed",
        error: "target-user-not-found",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new functions.https.HttpsError("not-found", "Target user not found");
    }

    if (action === "send_request") {
      const skill = normalizeText(data?.skill || "general");

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

    return {
      ok: true,
      action,
      target: {
        uid: targetUser.id,
        name: normalizeText(targetUser.name || targetUser.email || "User"),
      },
    };
  } catch (error) {
    if (!(error instanceof functions.https.HttpsError)) {
      await auditRef.update({
        status: "failed",
        error: normalizeText(error?.message || "unknown-error"),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new functions.https.HttpsError("internal", "Action execution failed");
    }
    throw error;
  }
});
