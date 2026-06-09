# Welcome

This workshop guides you through building a **live Event Research Agent** with Google ADK — step by step, from a single-file chatbot to a full multi-agent pipeline that searches the web and scrapes live event pages.

## What you'll build

```
User: "Find techno events in Cologne this friday"
         │
         ▼
  ┌─────────────────────┐
  │   EventResearcher   │  ← Orchestrator: extracts city/genre/date,
  │   gemini-2.5-flash  │    delegates, summarises results
  └──┬──────────────────┘
     │  session.state carries data between agents
     │
  ┌──▼──────────────────┐
  │    SearchAgent      │  Tavily API — 1 English query, 10 results,
  │ gemini-3.1-flash-   │  top 5 by score → structured JSON in state
  │       lite          │
  └──┬──────────────────┘
     │  state["searchResults"]
     │
  ┌──▼──────────────────┐
  │    CrawlAgent       │  Crawl4AI (headless browser) — fit_markdown
  │ gemini-3.1-flash-   │  pre-fetched via beforeAgentCallback,
  │       lite          │  structured event extraction with outputSchema
  └──┬──────────────────┘
     │  state["crawledEvents"]
     │
  ┌──▼──────────────────┐
  │    Orchestrator     │  Reads structured events, produces final
  │    summarises       │  human-readable summary for the user
  └─────────────────────┘
```

---

## Workshop modules

| # | Module | Concepts |
|---|--------|----------|
| 1 | [Hello Agent & Date Tool](pages/02-hello-agent.md) | `LlmAgent`, system prompts, `FunctionTool`, Zod, dev UI |
| 2 | [Session State & Constraints](pages/03-session-state.md) | `ToolContext`, `context.state`, state injection `{key}`, scoping |
| 3 | [Search Agent](pages/04-search-agent.md) | Tavily API, `outputSchema`, `gemini-3.1-flash-lite`, structured output |
| 4 | [Crawl Agent](pages/05-crawl-agent.md) | Crawl4AI, `beforeAgentCallback`, prompt injection, `fit_markdown` |
| 5 | [Orchestration](pages/06-orchestration.md) | `AgentTool`, multi-file structure, full pipeline wiring |

---

## Session state — the pipeline's data bus

Agents communicate through shared session state. Each agent reads what it needs and writes its own results:

| Key | Written by | Read by |
|-----|-----------|---------|
| `date` | `get_current_date` tool | SearchAgent |
| `userQuery` | `get_current_date` tool | SearchAgent |
| `city` | Orchestrator | SearchAgent |
| `genre` | Orchestrator | SearchAgent |
| `dateHint` | Orchestrator | SearchAgent |
| `searchResults` | SearchAgent | CrawlAgent |
| `crawledEvents` | CrawlAgent | Orchestrator |

---

## Prerequisites

- **Node.js 18+** — `node --version`
- **Docker & Docker Compose** — for Crawl4AI
- **A Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com)
- **A Tavily API key** — free at [app.tavily.com](https://app.tavily.com) (1 000 credits/month)

---

## Quick start

```bash
# 1. Clone & install
git clone <repo-url>
cd workshop-opencode
cp .env.sample .env      # fill in GEMINI_API_KEY and TAVILY_API_KEY
npm install

# 2. Start the docs site (these pages — served by nginx via Docker)
cd docs && docker compose up -d

# 3. Start Crawl4AI (needed for Module 4)
cd crawl4ai && docker compose up -d

# 4. Launch the ADK dev UI
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) → start with [Module 1](pages/02-hello-agent.md)!
