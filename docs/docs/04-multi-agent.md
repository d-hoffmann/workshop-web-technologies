# Module 3 — Multi-Agent Pipeline

## Concepts

- `AgentTool` — wrapping an agent so another agent can call it as a tool
- Orchestrator pattern — one agent delegates; specialist agents do the work
- `GoogleSearchTool` — built-in ADK tool for Google Search
- Custom HTTP tools — calling external APIs (Crawl4AI) from a `FunctionTool`
- Session state as a data bus — agents communicate via shared state

---

## Orchestrator vs Specialist

In a multi-agent system, agents have roles:

| Role | Responsibility |
|------|---------------|
| **Orchestrator** | Understands the user goal, decides which specialists to call and when |
| **Specialist** | Does one thing well — does not need to understand the full goal |

ADK implements this with `AgentTool`: wrapping an `LlmAgent` so it can be called like any other tool.

```typescript
import { LlmAgent, AgentTool } from "@google/adk";

const specialist = new LlmAgent({
  name: "SpecialistAgent",
  description: "Does one specific task.",  // ← this is the tool description
  instruction: "Your detailed instructions...",
  tools: [/* specialist's own tools */],
});

const orchestrator = new LlmAgent({
  tools: [
    new AgentTool({ agent: specialist }),   // ← specialist becomes a tool
  ],
  instruction: "Delegate to SpecialistAgent when you need to ...",
});
```

> **Key insight:** The orchestrator's LLM reads `specialist.description` to decide *when* to call the specialist — the same way it reads `FunctionTool.description`. Write clear, specific descriptions.

---

## The Search Agent

The search agent generates multilingual queries and runs Google Search:

```typescript
import { LlmAgent, GoogleSearchTool } from "@google/adk";

const searchAgent = new LlmAgent({
  name: "SearchAgent",
  description: "Generates search queries and fetches Google results.",
  instruction: `
    Read "userQuery" and "date" from session state.
    Generate 1 German + 2 English search queries.
    Call google_search for each. Write all URLs to session.state["searchResults"].
  `,
  tools: [new GoogleSearchTool()],
});
```

---

## The Crawl Tool

The crawl tool calls the local Crawl4AI service — a headless browser API that returns clean markdown:

```typescript
const crawlTool = new FunctionTool({
  name: "crawl_page",
  description: "Fetches a web page and returns its content as markdown.",
  parameters: z.object({ url: z.string().url() }),
  execute: async ({ url }) => {
    const res = await fetch("http://localhost:11235/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [url],
        crawler_config: {
          cache_mode: "bypass",
          word_count_threshold: 10,
          excluded_tags: ["nav", "footer", "header", "script", "style"],
        },
      }),
    });
    const data = await res.json();
    return { url, markdown: data.results?.[0]?.markdown ?? "" };
  },
});
```

> **Why Crawl4AI?** Regular `fetch` returns raw HTML — unusable for an LLM. Crawl4AI runs a real browser (Playwright), handles JS-rendered pages, and returns structured markdown that fits in the context window.

---

## Data flow through session state

```
get_current_date  ──► state["date"], state["userQuery"]
                                  │
                                  ▼
SearchAgent  ──► google_search ──► state["searchResults"] = [url1, url2, ...]
                                  │
                                  ▼
CrawlAgent  ──► crawl_page ──► state["crawledPages"] = [{url, markdown}, ...]
                                  │
                                  ▼
Orchestrator  ──► summarise from state["crawledPages"]  ──► user
```

---

## Exercise

> **Stuck?** Check out the solution branch: `git checkout solution/03-multi-agent`

> Make sure the Crawl4AI service is running: `docker compose up` in the `crawl4ai/` directory.
> Health check: `curl http://localhost:11235/health`

### Step 4 — The Search Sub-Agent

Create a new file `agents/search.ts`. You'll create an `LlmAgent` that:

1. Receives the user query and date from session state (injected via its system prompt)
2. Generates **1 German** and **2 English** search queries about the topic
3. Calls `GoogleSearchTool` for each query
4. Writes the collected URLs to `context.state["searchResults"]`

**TODO in `agents/search.ts`:**

```typescript
import { LlmAgent, GoogleSearchTool } from "@google/adk";

export const searchAgent = new LlmAgent({
  name: "SearchAgent",
  model: "gemini-2.5-flash",
  description: "Generates search queries and fetches results from Google.",
  instruction: `
    You have access to today's date and the user's query in session state.
    Generate exactly 3 search queries: 1 in German, 2 in English.
    Use the google_search tool for each query.
    Collect all result URLs and store them in session state under "searchResults".
  `,
  tools: [new GoogleSearchTool()],
});
```

---

### Step 5 — The Crawl Tool & Crawl Sub-Agent

Create `tools/crawlTool.ts`. You'll create a `FunctionTool` that POSTs to the local Crawl4AI service.

**TODO in `tools/crawlTool.ts`:**

```typescript
execute: async ({ url }) => {
  const response = await fetch("http://localhost:11235/crawl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: [url],
      crawler_config: {
        cache_mode: "bypass",
        word_count_threshold: 10,
        excluded_tags: ["nav", "footer", "header", "script", "style"],
      },
    }),
  });
  const data = await response.json();
  return { markdown: data.results?.[0]?.markdown ?? "No content" };
},
```

Then create `agents/crawl.ts` with a sub-agent that reads `session.state["searchResults"]` and calls the crawl tool for each URL.

---

### Step 6 — Wire up the orchestrator

Open `agent.ts`. Use `AgentTool` to register the sub-agents as tools on the main agent:

```typescript
import { AgentTool } from "@google/adk";
import { searchAgent } from "./agents/search.js";
import { crawlAgent } from "./agents/crawl.js";

const agent = new LlmAgent({
  tools: [
    getCurrentDate,
    new AgentTool({ agent: searchAgent }),
    new AgentTool({ agent: crawlAgent }),
  ],
  instruction: `
    You are an event research assistant.
    1. Call get_current_date first and save the user query.
    2. Delegate to SearchAgent to find relevant URLs.
    3. Delegate to CrawlAgent to fetch page content.
    4. Summarise the events found and present them clearly.
  `,
});
```

---

### ✅ Done when…

- Ask: *"Find techno events in Cologne this weekend"*
- You see tool calls for `SearchAgent` and `CrawlAgent` in the Events tab
- The agent returns a structured list of events with dates and venues

---

→ Next: [Module 4 — MCP Game](05-mcp-game.md)
