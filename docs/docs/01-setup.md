# Setup

Get your environment ready before the first exercise.

## 1. Install dependencies

```bash
node --version   # needs 18+
npm install
```

## 2. Configure your API key

```bash
cp .env.sample .env
```

Open `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_key_here
```

Get a free key at [aistudio.google.com](https://aistudio.google.com).

## 3. Start Crawl4AI (for Exercise 03)

```bash
cd crawl4ai
docker compose up -d
```

Verify it's running:

```bash
curl http://localhost:11235/health
# → {"status":"ok"}
```

## 4. Start the MCP server (for Exercise 04)

```bash
cd mcp-server
npm install
npm run dev
```

## Running an exercise

From any exercise folder:

```bash
npx adk web       # opens dev UI at http://localhost:8080
npx adk run agent.ts  # run in terminal (no UI)
```

> **Tip:** The `npm run dev` shortcut in the root `package.json` runs `npx adk web` from the repo root using the reference `agent.ts`. Inside each exercise, call `npx adk web` directly.
