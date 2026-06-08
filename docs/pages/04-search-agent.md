# Module 3 — Search Agent

## Concepts

- `FunctionTool` for external REST APIs — calling Tavily from a tool
- `outputSchema` — enforcing a JSON structure on an agent's response
- `outputKey` — auto-saving an agent's structured response to session state
- `{placeholder}` injection — how ADK substitutes session state into instructions
- Subagent testing — why subagents can't be tested directly and how to work around it
- `gemini-2.0-flash` — a fast, capable model well-suited for structured tasks

---

## Subagents & the orchestrator pattern

The search agent you build in this module is not a standalone agent — it is a **subagent** (also called a *specialist*). It will be called by a higher-level **orchestrator** agent in Module 5.

### Why split into subagents?

A single monolithic agent that searches, crawls, and formats output is hard to reason about and hard to reuse. Splitting by responsibility gives you:

- **Focused instructions** — each agent has one job, so its prompt is short and precise
- **Swappable parts** — you can replace `SearchAgent` with a different search backend without touching the crawl logic
- **Better observability** — each agent's tool calls and state writes are scoped and easy to trace in the dev UI

### How the orchestrator calls a subagent

In ADK, a subagent is exposed to the orchestrator via `AgentTool`. The orchestrator's LLM reads the subagent's `description` field to decide *when* to invoke it — exactly like a `FunctionTool`:

```typescript
import { LlmAgent, AgentTool } from "@google/adk";
import { searchAgent } from "./agents/search.js";

const orchestrator = new LlmAgent({
  // ...
  tools: [
    new AgentTool({ agent: searchAgent }),  // ← searchAgent becomes a callable tool
  ],
});
```

When the orchestrator calls `SearchAgent`:

1. A child `InvocationContext` is created — the subagent runs in its own turn
2. The subagent **reads** values the orchestrator already wrote to `session.state` (e.g. `{city}`, `{genre}`, `{dateHint}`)
3. The subagent calls `tavily_search`, formats the results, and writes them to `state["searchResults"]` via `outputKey`
4. Control returns to the orchestrator, which can now read `state["searchResults"]`

```
Orchestrator
    │
    │  writes → state["city"], state["genre"], state["dateHint"]
    │
    └── AgentTool → SearchAgent
            │  reads ← state["city"], state["genre"], state["dateHint"]
            │  calls tavily_search
            └── writes → state["searchResults"]   (via outputKey)
```

> **The `description` is the contract.** The orchestrator never sees the subagent's instruction — only its `name` and `description`. Write the description so it clearly answers: *"what does this agent do and when should I call it?"*

You will wire this in Module 5. Before then, you need a way to test `SearchAgent` in isolation — keep reading.

---

## `{placeholder}` injection

ADK substitutes `{key}` tokens in an agent's `instruction` string with the corresponding value from `session.state` before every LLM call. This is how subagents receive data that the orchestrator has already written:

```typescript
const searchAgent = new LlmAgent({
  instruction: `
    Search for {genre} events in {city} around {dateHint}.
  `,
});
```

When the orchestrator has written `state["city"] = "Cologne"` and `state["genre"] = "techno"`, the instruction the LLM actually sees is:

```
Search for techno events in Cologne around this weekend.
```

**This is why subagents can't be tested directly in the web UI.** If you export `searchAgent` as the default and start `pnpm dev`, session state is empty. ADK will still attempt the substitution, but the values are missing — the LLM receives the literal placeholder strings `{city}`, `{genre}`, etc. instead of real values, and the search query will be nonsense.

> **Optional placeholders:** Use `{key?}` if a key might not exist. ADK substitutes it with an empty string when missing. Required placeholders (no `?`) throw a runtime error if the key is absent — fail fast rather than silently passing garbage to the LLM.

---

## The `default` export and the dev UI

ADK's web UI (`pnpm dev`) and CLI (`pnpm start`) only serve the **`default` export** of the entry file you point them at. This is the single agent they load, display in the UI, and route messages to.

For a standalone agent file like `agent.ts`, the pattern is simple: create one agent and export it as `default`.

For a **subagent file**, the pattern is different. You export the subagent itself as a **named export** (so the orchestrator can import it in Module 5), and you export a **test harness** as the `default` export (so you can run the file in `pnpm dev` during development).

```typescript
// Named export — used by the orchestrator in Module 5
export const searchAgent = new LlmAgent({ ... });

// Default export — used by pnpm dev / pnpm start for standalone testing
export default new LlmAgent({
  name: "SearchTestHarness",
  tools: [
    getCurrentDate,
    new AgentTool({ agent: searchAgent }),  // ← calls the real agent
  ],
  instruction: `Collect city/genre/date from the user, then call SearchAgent.`,
});
```

The test harness is a thin orchestrator: it collects the inputs the user types, writes them to session state, and then delegates to `searchAgent` via `AgentTool`. The real `searchAgent` runs normally — it reads `{city}` etc. from state just as it will in production.

---

## Tavily Search API

[Tavily](https://tavily.com) is a search API built for AI agents. Unlike scraping Google directly, it returns clean, structured results with a **relevance score** per result — ideal for agents that need to rank or filter.

**Key properties of a Tavily result:**

```typescript
interface TavilyResult {
  title:   string;   // page title
  url:     string;   // source URL
  content: string;   // NLP-extracted snippet (not raw HTML)
  score:   number;   // relevance float, e.g. 0.923
}
```

A single `basic` search uses **1 credit** (1 000 free per month). We fetch 10 results per query and take the top 5 by score — deterministic, no extra LLM judgment needed.

---

## Structured output with `outputSchema`

By default, an `LlmAgent` produces free-form text. `outputSchema` tells ADK to use Gemini's **controlled generation** (constrained decoding) to force the output to match a JSON schema exactly:

```typescript
import { LlmAgent } from "@google/adk";
import { Schema, Type } from "@google/genai";

const mySchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      url:   { type: Type.STRING },
      title: { type: Type.STRING },
    },
    required: ["url", "title"],
  },
};

const agent = new LlmAgent({
  model: "gemini-3.1-flash-lite",
  outputSchema: mySchema,   // ← enforces JSON structure
  outputKey: "myResults",   // ← auto-saves to state["myResults"]
  instruction: "...",
});
```

This is **not** a prompt hint — the schema is passed to Gemini's API as `responseSchema`, which constrains decoding at the token level. The model physically cannot produce output that violates the schema.

### `outputKey` — free state write

When `outputKey` is set, ADK writes the agent's final response directly to `session.state[outputKey]` — no tool context or extra code needed.

---

## The `outputSchema` + loop risk

Controlled generation is reliable, but there is one failure mode to understand: **if your instruction and schema are misaligned**, the model can produce a schema-conformant response that is semantically wrong (e.g., empty arrays, placeholder strings). It won't loop — but it will silently return bad data.

**Protections:**

| Risk | Protection |
|------|------------|
| Model produces empty array | Add `minItems: 1` to schema; validate after reading |
| Instruction doesn't mention schema fields | Mirror the schema field names in the instruction |
| `outputSchema` combined with `tools` on unsupported models | `gemini-3.1-flash-lite` supports both — always verify in model release notes |

> **Read what you store.** After an agent writes to state via `outputKey`, always validate the result with Zod before the next agent reads it. This catches schema mismatches early and gives a clear error message instead of a silent downstream failure.

---

## The Tavily tool

```typescript
// tools/tavilyTool.ts
import { FunctionTool } from "@google/adk";
import { z } from "zod";

export const tavilyTool = new FunctionTool({
  name: "tavily_search",
  description: "Search the web using Tavily. Returns title, URL, content snippet, and relevance score.",
  parameters: z.object({
    query: z.string().describe("The search query in English"),
  }),
  execute: async ({ query }) => {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: 10,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      return { error: `Tavily API error: ${res.status}`, results: [] };
    }

    const data = await res.json();

    // Take top 5 by score — deterministic, no LLM judgment needed
    const top5 = (data.results ?? [])
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5)
      .map((r: any) => ({
        url:     r.url,
        title:   r.title,
        snippet: r.content,
        score:   r.score,
      }));

    return { results: top5 };
  },
});
```

---

## The Search Agent

```typescript
// agents/search.ts
import { LlmAgent, FunctionTool, AgentTool } from "@google/adk";
import { Schema, Type } from "@google/genai";
import { z } from "zod";
import { tavilyTool } from "../tools/tavilyTool.js";

const searchResultSchema: Schema = { /* ... as above ... */ };

// Named export — imported by the orchestrator in Module 5
export const searchAgent = new LlmAgent({
  name: "SearchAgent",
  model: "gemini-2.0-flash",
  description: "Searches the web for events matching the user's constraints and returns a structured list of URLs.",
  instruction: `
    You are a search specialist. Your only job is to find relevant event pages.

    Use the following constraints from session state:
    - City: {city}
    - Genre / event type: {genre}
    - Date hint: {dateHint}
    - Today's date: {date}

    Generate exactly ONE English search query combining city, genre, and date.
    Call tavily_search with that query.
    Return the results array exactly as received from the tool.

    Output ONLY the JSON array of results — no explanation, no extra text.
  `,
  tools: [tavilyTool],
  outputSchema: searchResultSchema,
  outputKey: "searchResults",
});

// Default export — test harness for pnpm dev / pnpm start
const getCurrentDate = new FunctionTool({
  name: "get_current_date",
  description: "Returns today's date and writes it to session state.",
  parameters: z.object({}),
  execute: async (_params, context) => {
    const date = new Date().toLocaleDateString("de-DE", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    context.state["date"] = date;
    return { date };
  },
});

export default new LlmAgent({
  name: "SearchTestHarness",
  model: "gemini-2.5-flash",
  description: "Dev-only wrapper for testing SearchAgent in isolation.",
  instruction: `
    You are a test harness for the SearchAgent subagent.

    On every message:
    1. Call get_current_date to write today's date to state.
    2. Extract from the user's message:
       - city (REQUIRED — ask if missing)
       - genre (use "" if not specified)
       - dateHint (REQUIRED — ask if missing)
       Write all three directly to session state.
    3. Only proceed once you have both city and a date hint.
    4. Call SearchAgent to run the search.
    5. Report back how many results were found and list their titles and URLs.
  `,
  tools: [
    getCurrentDate,
    new AgentTool({ agent: searchAgent }),
  ],
});
```

> **Why one query?** Multiple queries multiply API credit usage and make the pipeline harder to trace. One well-crafted query is usually sufficient; participants can experiment with more once the pipeline works.

---

## Exercise

> **Stuck?** Check out the solution branch: `git checkout solution/03-search-agent`

### Step 4 — Create the Tavily tool

Create `tools/tavilyTool.ts`:

1. `FunctionTool` named `tavily_search`
2. Single parameter: `query: z.string()`
3. POST to `https://api.tavily.com/search` with `Authorization: Bearer ${process.env.TAVILY_API_KEY}`
4. Request body: `{ query, max_results: 10, search_depth: "basic" }`
5. Sort results by `score` descending, return the top 5
6. Return `{ results: top5 }` — or `{ error: "...", results: [] }` on failure

**Hint — error handling:**

```typescript
if (!res.ok) {
  return { error: `Tavily API error: ${res.status}`, results: [] };
}
```

Always return a consistent shape from tools — the agent's LLM needs to handle both success and error without crashing.

---

### Step 5 — Create the Search Agent

Create `agents/search.ts` with two exports:

**Named export — `searchAgent`:**

1. Import `LlmAgent, FunctionTool, AgentTool` from `@google/adk` and `z` from `zod`
2. Import `tavilyTool` from `../tools/tavilyTool.js`
3. Define `searchResultSchema` using `Schema` and `Type` from `@google/genai`
4. Create and export `searchAgent` as a named `const` with:
   - `model: "gemini-2.0-flash"`
   - `tools: [tavilyTool]`
   - `outputSchema: searchResultSchema`
   - `outputKey: "searchResults"`
   - An instruction that reads `{city}`, `{genre}`, `{dateHint}`, `{date}` from state and generates a single English query

**Default export — test harness:**

5. Create a `get_current_date` `FunctionTool` (same as in `agent.ts`) that writes `date` to state
6. Add a `export default new LlmAgent(...)` — the `SearchTestHarness` — that:
   - Uses `model: "gemini-2.5-flash"`
   - Has `getCurrentDate` and `new AgentTool({ agent: searchAgent })` in its `tools` array
   - Has an instruction that collects `city`, `genre`, `dateHint` from the user, writes them to state, then calls `SearchAgent`

**Why two exports?** The named export is the real subagent — the orchestrator will import it in Module 5. The default export is a thin wrapper that lets you test the subagent in the dev UI right now, by acting as a minimal orchestrator that seeds the state values `SearchAgent` needs.

**Verify the schema:** After the harness calls `SearchAgent`, open the **State** tab in the dev UI. You should see `searchResults` as a JSON array with `url`, `title`, `snippet`, and `score` fields.

**Validate with Zod in the orchestrator (preview of Module 5):**

```typescript
import { z } from "zod";

const SearchResultSchema = z.array(z.object({
  url:     z.string().url(),
  title:   z.string(),
  snippet: z.string(),
  score:   z.number(),
}));

// In orchestrator, after SearchAgent runs:
const raw = context.state["searchResults"];
const parsed = SearchResultSchema.safeParse(raw);
if (!parsed.success) {
  console.error("SearchAgent returned invalid data:", parsed.error);
}
```

---

### ✅ Done when…

**To test:** point `pnpm dev` at the search agent file:

```bash
npx adk web agents/search.ts
```

Ask: *"Find techno events in Cologne this weekend"*

- The harness calls `get_current_date`, extracts `city`/`genre`/`dateHint`, writes them to state
- The harness calls `SearchAgent` via `AgentTool`
- The **State** tab shows `date`, `city`, `genre`, `dateHint`, and `searchResults`
- `searchResults` is a JSON array of 5 objects, each with `url`, `title`, `snippet`, and `score`
- The **Events** tab shows the `tavily_search` tool call nested inside the `SearchAgent` invocation

---

→ Next: [Module 4 — Crawl Agent](pages/05-crawl-agent.md)
