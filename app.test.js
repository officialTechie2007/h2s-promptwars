const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_PROMPT_LENGTH,
  normalizePrompt,
  pickOfficialSources,
  buildAnswerPayload,
  applyRateLimit,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS
} = require("./app-core");

test("normalizePrompt rejects empty prompts", () => {
  const result = normalizePrompt("   ");
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 400);
});

test("normalizePrompt rejects oversized prompts", () => {
  const result = normalizePrompt("a".repeat(MAX_PROMPT_LENGTH + 1));
  assert.equal(result.ok, false);
  assert.match(result.error, /too long/i);
});

test("pickOfficialSources matches registration-related queries", () => {
  const sources = pickOfficialSources("How do I register and update my voter ID address?");
  assert.ok(sources.some((source) => source.id === "vsp"));
});

test("buildAnswerPayload includes answer and sources", () => {
  const payload = buildAnswerPayload("Find my polling booth", "Use the official search portal.");
  assert.equal(payload.steps[0].content, "Use the official search portal.");
  assert.ok(payload.sources.length >= 1);
  assert.equal(typeof payload.meta.officialSourceCount, "number");
});

test("applyRateLimit blocks after the configured limit", () => {
  const store = new Map();
  const now = 1_000;

  for (let index = 0; index < RATE_LIMIT_MAX_REQUESTS; index += 1) {
    const result = applyRateLimit(store, "tester", now);
    assert.equal(result.allowed, true);
  }

  const blocked = applyRateLimit(store, "tester", now);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test("applyRateLimit resets after the time window", () => {
  const store = new Map();
  const now = 2_000;

  for (let index = 0; index < RATE_LIMIT_MAX_REQUESTS; index += 1) {
    applyRateLimit(store, "tester", now);
  }

  const afterWindow = applyRateLimit(store, "tester", now + RATE_LIMIT_WINDOW_MS + 1);
  assert.equal(afterWindow.allowed, true);
});
