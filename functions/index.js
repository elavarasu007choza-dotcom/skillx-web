const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const OPENAI_KEY = defineSecret("OPENAI_KEY");

admin.initializeApp();
const db = admin.firestore();

/* ==============================
   🔥 AUTO TAG GENERATION FUNCTION
   ============================== */
exports.generateTagsRetro = functions.firestore
  .document("openRequests/{requestId}")
  .onCreate(async (snap, context) => {
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
const axios = require("axios");

exports.semanticAnalysis = functions
  .runWith({ secrets: [OPENAI_KEY] })
  .https.onRequest(async (req, res) => {

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
