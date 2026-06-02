# Welcome

This workshop guides you through building a **live Event Research Agent** with Google ADK — step by step, from a single-file chatbot to a multi-agent system that searches the web, scrapes live event pages, and connects to an MCP server.

## What you'll build

```
User: "Find techno events in Cologne this weekend"
         │
         ▼
  ┌──────────────────┐
  │  EventResearcher │  ← Main orchestrator agent
  │  (your agent)    │
  └──┬───────────────┘
     │  session.state carries data between agents
     │
  ┌──▼──────────┐    ┌───────────────┐
  │ SearchAgent │    │  CrawlAgent   │
  │ 1 DE query  │───►│ Crawl4AI      │
  │ 2 EN queries│    │ /crawl endpoint│
  │ GoogleSearch│    └───────┬───────┘
  └─────────────┘            │
                             ▼
                    ┌─────────────────┐
                    │  Summarise &    │
                    │  Present Events │
                    └─────────────────┘
```

Then you'll connect a second agent to an **MCP server** to play a short interactive fiction game — seeing how MCP tools are discovered automatically at runtime.

---

## Workshop modules

| # | Exercise | Concepts |
|---|----------|----------|
| 1 | [Hello Agent & Date Tool](docs/02-hello-agent.md) | `Agent`, system prompts, `FunctionTool`, Zod, dev UI |
| 2 | [Session State](docs/03-session-state.md) | `ToolContext`, `context.state`, shared memory |
| 3 | [Multi-Agent Pipeline](docs/04-multi-agent.md) | `AgentTool`, sub-agents, Google Search, Crawl4AI |
| 4 | [MCP Game](docs/05-mcp-game.md) | MCP protocol, `MCPToolset`, tool discovery |

---

## Prerequisites

- **Node.js 18+** — `node --version`
- **Docker & Docker Compose** — for Crawl4AI and the MCP server
- **A Gemini API key** — get one free at [aistudio.google.com](https://aistudio.google.com)

---

## Quick start

```bash
# 1. Clone & install
git clone <repo-url>
cd workshop-opencode
cp .env.sample .env      # add your GEMINI_API_KEY
npm install

# 2. Start Crawl4AI (needed for Exercise 03)
cd crawl4ai && docker compose up -d

# 3. Start the dev UI for any exercise
cd exercises/01-hello-agent
npx adk web
```

Open [http://localhost:8080](http://localhost:8080) → start coding!
