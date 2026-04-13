const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const OPENAI_KEY = defineSecret("OPENAI_KEY");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

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
