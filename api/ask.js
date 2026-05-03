const {
  normalizePrompt,
  buildAssistantPrompt,
  buildAnswerPayload,
  createSecurityHeaders,
  createCorsHeaders,
  applyRateLimit,
  getClientIdentifier
} = require("../app-core");
const { askGeminiWithKey, fetchGoogleCivicContext } = require("../gemini-service");

const rateLimitStore = new Map();

module.exports = async function handler(req, res) {
  Object.entries({
    ...createSecurityHeaders(),
    ...createCorsHeaders(req.headers.origin || "")
  }).forEach(([header, value]) => {
    res.setHeader(header, value);
  });

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    if (req.headers["content-type"] && !req.headers["content-type"].includes("application/json")) {
      return res.status(415).json({ error: "Content-Type must be application/json." });
    }

    const rateLimit = applyRateLimit(rateLimitStore, getClientIdentifier(req));
    if (!rateLimit.allowed) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }

    const normalized = normalizePrompt(req.body?.prompt);
    if (!normalized.ok) {
      return res.status(normalized.statusCode).json({ error: normalized.error });
    }

    const question = normalized.prompt;
    const answer = await askGeminiWithKey(process.env.GEMINI_API_KEY, buildAssistantPrompt(question));
    const civicContext = await fetchGoogleCivicContext(question);

    return res.status(200).json(buildAnswerPayload(question, answer, { civicContext }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return res.status(500).json({ error: message });
  }
};
