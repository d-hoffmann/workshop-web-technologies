# Workshop — Google ADK Agents

A multi-step workshop for building AI agents with **Google ADK**, a self-hosted MCP server, and Crawl4AI, deployed with Docker Compose.

## Structure

| Path | Purpose |
|---|---|
| `agent.ts` | Reference ADK agent (default export from `@google/adk`) |
| `docs/` | Docsify documentation site (served via nginx on port 8080) |
| `exercises/01-*` … `05-*` | Workshop exercise directories — mostly empty placeholders (`.gitkeep`) |
| `mcp-server/` | MCP server (src/index.ts is a placeholder) |
| `crawl4ai/` | Crawl4AI service (port 11235) with Docker Compose |
| `.opencode/` | OpenCode config: custom agent (`google-adk-dev`), commit skill & command |

## Commands

All commands are defined in root `package.json` and use `npx adk`:

| Command | What it runs |
|---|---|
| `npm start` | `npx adk run agent.ts` |
| `npm run dev` | `npx adk web` (launch ADK dev UI) |
| `npm run api` | `npx adk api_server` |
| `npm run deploy` | `npx adk deploy` |
| `npm install` | Installs `@google/adk`, `@google/adk-devtools`, `typescript` |

## Setup

```bash
cp .env.sample .env   # then fill in GEMINI_API_KEY
npm install
```

## Services (Docker Compose)

Start individually from each directory, or compose multi-service:

| Service | Port | Dir |
|---|---|---|
| Workshop docs | 8080 | `docs/` |
| MCP server | 3100 | `mcp-server/` |
| Crawl4AI | 11235 | `crawl4ai/` |

## Key conventions

- TypeScript with `NodeNext` module resolution — use `.js` extensions in relative imports
- ADK agents: `import { Agent } from "@google/adk"`; callable tools via `FunctionTool` with Zod
- Root `agent.ts` is the canonical example (weather + currency tools)
- Default model: `gemini-2.5-flash`
- `.env` is gitignored; `.env.sample` is the template
- Commits follow conventional commits (see `.opencode/skills/commit/`)

## Agent instructions

`opencode.json` sets `default_agent` to `google-adk-dev`. The `.opencode/agents/google-adk-dev.md` file contains ADK API reference, scaffold commands, and best practices — consult it when writing or modifying agents.
