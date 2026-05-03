const GEMINI_MODEL = "gemini-2.5-flash";

async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to your Vercel project or local environment.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const geminiResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  const data = await geminiResponse.json();

  if (!geminiResponse.ok) {
    const message =
      data?.error?.message || "Gemini request failed. Please check the server-side environment variable.";
    throw new Error(message);
  }

  const text = (data?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const prompt = req.body?.prompt?.trim();

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const answer = await askGemini(prompt);

    return res.status(200).json({
      steps: [{ title: "AI Answer", content: answer }]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return res.status(500).json({ error: message });
  }
};
