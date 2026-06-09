# Module 6 — MCP & the Interactive Fiction Game

## What is MCP?

**Model Context Protocol** (MCP) is an open standard by Anthropic that lets AI agents connect to *tool servers* over a defined protocol — similar to how a browser connects to any HTTP server, regardless of who built it.

Without MCP, every tool is hardcoded into your agent. With MCP:

```
Agent  ←──MCP protocol──►  MCP Server  (any tools, any language, any team)
```

The agent **discovers** available tools at runtime. You can swap, extend, or share MCP servers without changing the agent code.

---

## The MCP protocol

An MCP server exposes three things:

| Primitive | Description |
|-----------|-------------|
| **Tools** | Callable functions (like `FunctionTool`, but defined server-side) |
| **Resources** | Data the agent can read (files, DB rows, API responses) |
| **Prompts** | Prompt templates the server provides |

Transport options: **stdio** (subprocess), **HTTP/SSE** (network), **WebSocket**.

---

## MCPToolset in ADK

`MCPToolset` connects to an MCP server and exposes all its tools to your agent automatically:

```typescript
import { Agent, MCPToolset } from "@google/adk";

const mcpTools = new MCPToolset({
  type: "StdioConnectionParams",    // start server as a subprocess
  serverParams: {
    command: "node",
    args: ["../../mcp-server/dist/index.js"],
  },
});

const agent = new Agent({
  tools: [mcpTools],                // all MCP tools are now available
  instruction: "Use the available tools to play the game.",
});
```

> **No tool definitions needed.** The agent calls `list_tools` on the MCP server at startup and receives the tool schemas automatically.

---

## The game server

The local MCP server in `mcp-server/` implements a short text-adventure game. It exposes tools like:

| Tool | Description |
|------|-------------|
| `look_around` | Describe the current room |
| `move` | Move to an adjacent room |
| `pick_up` | Pick up an item |
| `use_item` | Use an item from inventory |
| `check_inventory` | List items you're carrying |

Your agent will narrate the story and ask the player what to do next — the LLM handles all the language; the MCP server handles all the game logic.

---

## Starting the server

```bash
cd mcp-server
npm install
npm run dev
```

Then from the repo root:

```bash
npm run dev
```

Tell the agent: *"Start the game"* — and explore!

---

## Exercise

> **Stuck?** Check out the solution branch: `git checkout solution/06-mcp-game`

### Before you start

Start the MCP server:

```bash
cd mcp-server
npm install
npm run dev
```

The server starts on **port 3100**. Verify it's running:

```bash
curl http://localhost:3100/health
```

---

### Step — Connect to the MCP server

Open `agent.ts` and replace the orchestrator with a standalone game agent using `MCPToolset`:

```typescript
import { Agent, MCPToolset } from "@google/adk";

const mcpTools = new MCPToolset({
  type: "StdioConnectionParams",
  serverParams: {
    command: "node",
    args: ["mcp-server/dist/index.js"],
  },
});

const agent = new Agent({
  name: "GameAgent",
  model: "gemini-3.1-flash-lite",
  instruction: `
    You are playing an interactive text-adventure game.
    Use the available MCP tools to explore the world, pick up items,
    and solve puzzles. Describe each action vividly to the user.
    Ask the user what they want to do next.
  `,
  tools: [mcpTools],
});

export default agent;
```

---

### Play the game

```bash
npm run dev
```

Tell the agent: *"Start the game"* and follow the prompts.

> Notice how the agent discovers the game tools automatically — you never had to define them. That's the power of MCP.

---

### ✅ Done when…

- The agent lists available game actions (look around, move, pick up, etc.)
- You complete at least one puzzle or reach a new room
- You can see MCP tool calls in the dev UI **Events** tab

---

## What you built

| Module | What you learned |
|--------|-----------------|
| 1 | Agents, tools, the ADK dev UI |
| 2 | Session state — how agents share data, state injection, scoping |
| 3 | Structured output with Tavily and `outputSchema` |
| 4 | Headless browser scraping, `beforeAgentCallback`, prompt injection defence |
| 5 | Multi-agent orchestration with `AgentTool`, full pipeline wiring |
| 6 | MCP — tool discovery without hardcoding |

**Where to go next:**
- Add more sources to the research pipeline (RSS feeds, ticketing APIs like Ticketmaster)
- Build your own MCP server for a domain you care about
- Deploy with `npx adk deploy cloud_run`
- Explore ADK callbacks for logging, guardrails, and observability
- Add `user:` scoped state to remember a user's city and genre preferences across sessions
