# CivicPath

Single-root JavaScript version of the project.

## Run

```bash
GEMINI_API_KEY=your_key_here npm start
```

Then open [http://localhost:8080](http://localhost:8080).

If you open `index.html` from another dev server such as Live Server on port `5500/5501`, keep the Node server running as well because the chatbot API lives on port `8080`.

## Structure

- `index.html` - UI
- `style.css` - styling
- `script.js` - client-side behavior
- `server.js` - JavaScript server and `/ask` endpoint
