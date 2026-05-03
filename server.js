const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  normalizePrompt,
  buildAssistantPrompt,
  buildAnswerPayload,
  createSecurityHeaders,
  createCorsHeaders,
  applyRateLimit,
  getClientIdentifier
} = require("./app-core");
const { askGeminiWithKey, fetchGoogleCivicContext } = require("./gemini-service");

const PORT = Number(process.env.PORT || 8080);
const HOST = "127.0.0.1";
const ROOT_DIR = __dirname;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const rateLimitStore = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...createSecurityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    ...createCorsHeaders()
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[extension] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { error: "File not found." });
        return;
      }

      sendJson(response, 500, { error: "Unable to read the requested file." });
      return;
    }

    response.writeHead(200, { "Content-Type": mimeType });
    response.end(content);
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: "Missing request URL." });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  const pathname = url.pathname;

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      ...createSecurityHeaders(),
      ...createCorsHeaders(request.headers.origin || "")
    });
    response.end();
    return;
  }

  if (pathname === "/ask" && request.method === "POST") {
    try {
      if (
        request.headers["content-type"] &&
        !request.headers["content-type"].includes("application/json")
      ) {
        sendJson(response, 415, { error: "Content-Type must be application/json." });
        return;
      }

      const clientId = getClientIdentifier(request);
      const rateLimit = applyRateLimit(rateLimitStore, clientId);

      if (!rateLimit.allowed) {
        response.writeHead(429, {
          ...createSecurityHeaders(),
          ...createCorsHeaders(request.headers.origin || ""),
          "Content-Type": "application/json; charset=utf-8",
          "Retry-After": String(rateLimit.retryAfterSeconds)
        });
        response.end(JSON.stringify({ error: "Too many requests. Please try again shortly." }));
        return;
      }

      const rawBody = await readRequestBody(request);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const normalized = normalizePrompt(body?.prompt);

      if (!normalized.ok) {
        sendJson(response, normalized.statusCode, { error: normalized.error });
        return;
      }

      const question = normalized.prompt;
      const assistantPrompt = buildAssistantPrompt(question);
      const answer = await askGeminiWithKey(GEMINI_API_KEY, assistantPrompt);
      const civicContext = await fetchGoogleCivicContext(question);

      sendJson(response, 200, buildAnswerPayload(question, answer, { civicContext }));
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? "Invalid JSON body."
          : error instanceof Error
            ? error.message
            : "Unknown server error.";

      sendJson(response, 500, { error: message });
    }
    return;
  }

  const normalizedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const requestedFile = path.normalize(path.join(ROOT_DIR, normalizedPath));

  if (!requestedFile.startsWith(ROOT_DIR)) {
    sendJson(response, 403, { error: "Forbidden path." });
    return;
  }

  response.setHeader("Cache-Control", pathname === "/" ? "no-store" : "public, max-age=600");
  Object.entries(createSecurityHeaders()).forEach(([header, value]) => {
    response.setHeader(header, value);
  });
  sendFile(response, requestedFile);
});

server.listen(PORT, HOST, () => {
  console.log(`CivicPath is running at http://${HOST}:${PORT}`);
});
