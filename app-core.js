const MAX_PROMPT_LENGTH = 1200;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const OFFICIAL_SOURCES = [
  {
    id: "eci",
    label: "Election Commission of India",
    url: "https://www.eci.gov.in/",
    keywords: ["election", "schedule", "candidate", "notification", "commission", "result"]
  },
  {
    id: "vsp",
    label: "Voters' Services Portal",
    url: "https://voters.eci.gov.in/en",
    keywords: ["register", "registration", "correction", "address", "epic", "voter id", "document"]
  },
  {
    id: "electoral-search",
    label: "Electoral Search",
    url: "https://www.electoralsearch.eci.gov.in/Voter",
    keywords: ["name", "roll", "booth", "polling", "constituency", "search", "where do i vote"]
  },
  {
    id: "service-voter",
    label: "Service Voter Portal",
    url: "https://svp.eci.gov.in/",
    keywords: ["service voter", "army", "navy", "air force", "defence", "postal ballot"]
  }
];

function normalizePrompt(input) {
  const prompt = typeof input === "string" ? input.trim() : "";

  if (!prompt) {
    return { ok: false, statusCode: 400, error: "Prompt is required." };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      ok: false,
      statusCode: 400,
      error: `Prompt is too long. Keep it under ${MAX_PROMPT_LENGTH} characters.`
    };
  }

  return { ok: true, prompt };
}

function buildAssistantPrompt(question) {
  return [
    "You are CivicPath, an expert AI assistant for Indian elections.",
    "Answer clearly and helpfully.",
    "Prefer concise guidance with practical next steps.",
    "When helpful, reference official election resources in a neutral tone.",
    "",
    `Question: ${question}`
  ].join("\n");
}

function pickOfficialSources(question) {
  const lowered = question.toLowerCase();
  const matches = OFFICIAL_SOURCES.filter((source) =>
    source.keywords.some((keyword) => lowered.includes(keyword))
  );

  return (matches.length ? matches : OFFICIAL_SOURCES.slice(0, 2)).map(({ id, label, url }) => ({
    id,
    label,
    url
  }));
}

function buildAnswerPayload(question, answer, extras = {}) {
  return {
    steps: [{ title: "AI Answer", content: answer }],
    sources: pickOfficialSources(question),
    meta: {
      officialSourceCount: pickOfficialSources(question).length,
      civicContextUsed: Boolean(extras.civicContext)
    },
    ...(extras.civicContext ? { civicContext: extras.civicContext } : {})
  };
}

function createSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin"
  };
}

function createCorsHeaders(origin = "") {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const allowAll = allowedOrigins.length === 0;
  const isAllowedOrigin = allowAll || (origin && allowedOrigins.includes(origin));

  return {
    "Access-Control-Allow-Origin": isAllowedOrigin ? (origin || "*") : "null",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };
}

function applyRateLimit(store, key, now = Date.now()) {
  const existing = store.get(key);

  if (!existing || now - existing.windowStart >= RATE_LIMIT_WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - existing.windowStart)) / 1000)
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - existing.count };
}

function getClientIdentifier(requestLike) {
  const forwarded = requestLike?.headers?.["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return (
    requestLike?.socket?.remoteAddress ||
    requestLike?.connection?.remoteAddress ||
    "anonymous"
  );
}

module.exports = {
  MAX_PROMPT_LENGTH,
  OFFICIAL_SOURCES,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  normalizePrompt,
  buildAssistantPrompt,
  pickOfficialSources,
  buildAnswerPayload,
  createSecurityHeaders,
  createCorsHeaders,
  applyRateLimit,
  getClientIdentifier
};
