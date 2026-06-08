# Setup

Get your environment ready before the first exercise.

## 1. Install dependencies

```bash
node --version   # needs 18+
npm install
```

## 2. Configure your API keys

```bash
cp .env.sample .env
```

Open `.env` and fill in both keys:

```
GEMINI_API_KEY=your_gemini_key_here
TAVILY_API_KEY=your_tavily_key_here
```

**Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com).

**Tavily API key** — free at [app.tavily.com](https://app.tavily.com).
Sign up, go to **API Keys**, and copy your key (starts with `tvly-`).
The free tier gives you **1 000 search credits per month** — more than enough for this workshop.

> **Note on model IDs:** This workshop uses `gemini-2.5-flash` for the orchestrator and `gemini-3.1-flash-lite` for sub-agents. Check [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) for the exact current model string if you get a "model not found" error — preview model IDs sometimes include a date suffix.

## 3. Start Crawl4AI (for Module 4)

```bash
cd crawl4ai
docker compose up -d
```

Verify it's running:

```bash
curl http://localhost:11235/health
# → {"status":"ok"}
```

## 4. Start the MCP server (for Module 6)

```bash
cd mcp-server
npm install
npm run dev
```

## Running the agent

From the repo root:

```bash
npm run dev       # launches the ADK dev UI at http://localhost:8080
npm start         # runs the agent in the terminal (no UI)
```

> **Tip:** The dev UI runs on port 8080 — the same port as the docs site if you're running it locally. Stop the docs container before running `npm run dev`, or change the ADK UI port with `npx adk web --port 3000`.
