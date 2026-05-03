const GEMINI_MODEL = "gemini-2.5-flash";

function getJsonFetcher(customFetch) {
  return customFetch || fetch;
}

async function askGeminiWithKey(apiKey, prompt, customFetch) {
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to your environment before starting the server.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const fetcher = getJsonFetcher(customFetch);

  const geminiResponse = await fetcher(endpoint, {
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
      data?.error?.message || "Gemini request failed. Please check your API key and request.";
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

async function fetchGoogleCivicContext(question, customFetch) {
  const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
  const address = process.env.DEFAULT_VOTER_ADDRESS;

  if (!apiKey || !address) {
    return null;
  }

  const shouldLookup = /booth|polling|vote|constituency|where/i.test(question);
  if (!shouldLookup) {
    return null;
  }

  const endpoint = new URL("https://www.googleapis.com/civicinfo/v2/voterinfo");
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("address", address);

  const fetcher = getJsonFetcher(customFetch);
  const civicResponse = await fetcher(endpoint, { method: "GET" });

  if (!civicResponse.ok) {
    return null;
  }

  const data = await civicResponse.json();
  const location = data?.pollingLocations?.[0];

  if (!location) {
    return null;
  }

  return {
    source: "Google Civic Information API",
    electionName: data?.election?.name || null,
    pollingLocation: {
      address: [
        location.address?.locationName,
        location.address?.line1,
        location.address?.line2,
        location.address?.city,
        location.address?.state,
        location.address?.zip
      ]
        .filter(Boolean)
        .join(", ")
    }
  };
}

module.exports = {
  askGeminiWithKey,
  fetchGoogleCivicContext
};
