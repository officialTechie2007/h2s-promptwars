# CivicPath

Single-root JavaScript version of the project, with a Vercel-ready API route for Gemini.

## Local run

Create a local env file from the example:

```bash
cp .env.example .env.local
```

Add your Gemini key to `.env.local`, then start the local server:

```bash
source .env.local && npm start
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

If you open `index.html` from another dev server such as Live Server on port `5500/5501`, keep the Node server running as well because the chatbot API lives on port `8080`.

## Vercel deployment

The Gemini key stays server-side. Do not put it in `script.js`, `index.html`, or commit it to the repo.

1. Push this project to GitHub.
2. Import the repo into Vercel.
3. In Vercel, open `Project Settings -> Environment Variables`.
4. Add:
   `GEMINI_API_KEY` = your Gemini API key
5. Apply it to `Production`, `Preview`, and `Development` if you want it available everywhere.
6. Redeploy after saving the variable.

The frontend calls `/ask`, and `vercel.json` rewrites that path to the server-side function in `api/ask.js`, where the key is read with `process.env.GEMINI_API_KEY`.

## Improvements added for evaluation

- Automated tests with Node's built-in test runner: `npm test`
- Prompt validation and input length limits
- Security headers for the static server and Vercel function
- Basic request rate limiting for `/ask`
- Official source links returned with assistant answers
- Optional Google Civic Information API enrichment when `GOOGLE_CIVIC_API_KEY` and `DEFAULT_VOTER_ADDRESS` are configured

## Structure

- `index.html` - UI
- `style.css` - styling
- `script.js` - client-side behavior
- `server.js` - local Node server and `/ask` endpoint
- `app-core.js` - shared validation, source mapping, and security helpers
- `gemini-service.js` - Gemini and optional Google Civic integrations
- `app.test.js` - automated tests
- `api/ask.js` - Vercel serverless Gemini endpoint
- `vercel.json` - rewrite `/ask` to the Vercel API function
