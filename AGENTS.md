# Workshop — Google ADK Agents

A multi-step workshop for building AI agents with **Google ADK**, a self-hosted MCP server, and Crawl4AI, deployed with Docker Compose.

## Structure

| Path | Purpose |
|---|---|
| `agent.ts` | Reference ADK agent — canonical example with `FunctionTool` + Zod |
| `docs/` | Docsify site (nginx, port 8080); content lives in `docs/pages/` |
| `mcp-server/` | MCP server — not yet scaffolded in the repo |
| `crawl4ai/` | Crawl4AI service (port 11235) with Docker Compose |
| `.opencode/` | OpenCode config: custom agent (`google-adk-dev`), commit skill & command |

`docs/docs/` is a stale duplicate of `docs/pages/` — do not edit it, it is not served.

## Commands

Package manager is **pnpm** (lockfile is `pnpm-lock.yaml`). Use `pnpm` not `npm`.

| Command | What it runs |
|---|---|
| `pnpm start` | `npx adk run agent.ts` |
| `pnpm dev` | `npx adk web --reload` (ADK dev UI) |
| `pnpm api` | `npx adk api_server` |
| `pnpm install` | Installs deps |


## Setup

```bash
cp .env.sample .env   # fill in GEMINI_API_KEY and TAVILY_API_KEY
pnpm install
```

Both `GEMINI_API_KEY` and `TAVILY_API_KEY` are required (search agent exercises need Tavily).

## Services (Docker Compose)

Start from each service directory:

| Service | Port | Dir |
|---|---|---|
| Workshop docs | 8080 | `docs/` |
| MCP server | 3100 | `mcp-server/` |
| Crawl4AI | 11235 | `crawl4ai/` |

## Key conventions

- TypeScript with `NodeNext` module resolution — **use `.js` extensions in relative imports**
- `tsconfig.json` only includes root-level `*.ts` files (`"include": ["*.ts"]`); exercise files need their own tsconfig or to be added
- ADK agents: `import { Agent, FunctionTool } from "@google/adk"`; tools use Zod schemas
- Default model: `gemini-3.1-flash-lite`
- `.env` is gitignored; `.env.sample` is the template
- Commits follow conventional commits (see `.opencode/skills/commit/`)

## Docs site (`docs/`)

> **Docs use `npm run <script>`, not `pnpm`.** The workshop participants who follow the docs may not have pnpm installed. All command references inside `docs/pages/` must use `npm run dev`, `npm run start`, etc. The project itself uses pnpm (lockfile is `pnpm-lock.yaml`) and AGENTS.md/the dev tooling uses pnpm — but never write `pnpm` into the docs content under `docs/pages/`.

- All CDN script/link tags must use `https://` — protocol-relative `//` URLs break on Firefox/HTTP
- Content is in `docs/pages/`; `_sidebar.md` and `index.html` reference `pages/xx.md` paths
- `docs/docs/` is an unreferenced stale copy — safe to delete
- `docs/pages/07-mcp-game.md` exists but is not linked in `_sidebar.md`

## Agent instructions

`opencode.json` sets `default_agent` to `google-adk-dev`. The `.opencode/agents/google-adk-dev.md` file contains ADK API reference, scaffold commands, and best practices — consult it when writing or modifying agents.

`opencode.json` also configures an `adk-docs` MCP server (via `uvx`/`mcpdoc`) that serves live ADK documentation — available as a tool in OpenCode sessions.
