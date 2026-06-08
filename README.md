# Building Agents with Google ADK — Workshop

A hands-on workshop for building AI agents with **Google ADK**, Tavily search, and Crawl4AI — from a single-file chatbot to a full multi-agent event research pipeline.

## Repository structure

```
workshop-opencode/
├── agent.ts              ← your working file for all exercises
├── agents/               ← sub-agents (created during exercises)
├── tools/                ← shared FunctionTools (created during exercises)
├── .env.sample           ← copy to .env and fill in API keys
├── package.json          ← npm scripts: dev, start, api, deploy
├── tsconfig.json
│
├── docs/                 ← workshop documentation site (Docsify + nginx)
│   ├── compose.yml       ← starts the docs site on http://localhost:8080
│   ├── index.html        ← Docsify app shell
│   ├── _sidebar.md       ← navigation
│   └── pages/            ← one markdown file per module
│
├── crawl4ai/             ← Crawl4AI headless browser service
│   └── compose.yml       ← starts on http://localhost:11235
│
└── mcp-server/           ← MCP server (text-adventure game, bonus)
    └── compose.yml       ← starts on http://localhost:3100
```

## Services

| Service | URL | Start command |
|---------|-----|---------------|
| **Workshop docs** | http://localhost:8080 | `cd docs && docker compose up -d` |
| **Crawl4AI** | http://localhost:11235 | `cd crawl4ai && docker compose up -d` |
| **MCP server** (bonus) | http://localhost:3100 | `cd mcp-server && npm run dev` |
| **ADK dev UI** | http://localhost:8000 | `npm run dev` |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure API keys
cp .env.sample .env
# Edit .env — add GEMINI_API_KEY and TAVILY_API_KEY

# 3. Start the docs site
cd docs && docker compose up -d

# 4. Start Crawl4AI (needed from Module 4 onwards)
cd crawl4ai && docker compose up -d
```

**Get your API keys:**
- Gemini: [aistudio.google.com](https://aistudio.google.com) — free
- Tavily: [app.tavily.com](https://app.tavily.com) — free

## Running the agent

```bash
npm run dev     # ADK dev UI at http://localhost:8000
npm start       # run in terminal (no UI)
```


## Workshop modules

| # | Module | File(s) |
|---|--------|---------|
| 1 | Hello Agent & Tools | `agent.ts` |
| 2 | Session State & Constraints | `agent.ts` |
| 3 | Search Agent | `agents/search.ts`, `tools/tavilyTool.ts` |
| 4 | Crawl Agent | `agents/crawl.ts`, `tools/crawlTool.ts` |
| 5 | Orchestration | `agent.ts` (wiring all sub-agents) |

Solution branches: `git checkout solution/0N-name`
