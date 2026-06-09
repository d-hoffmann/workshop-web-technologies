# Module 3 — Search Agent

## Concepts

- `FunctionTool` for external REST APIs — calling Tavily from a tool
- `outputSchema` — enforcing a JSON structure on an agent's response
- `outputKey` — auto-saving an agent's structured response to session state
- `{placeholder}` injection — how ADK substitutes session state into instructions
- `AgentTool` — wrapping a subagent so an orchestrator can call it like a tool
- Named exports — keeping subagents importable while wiring them into the orchestrator

---

## Subagents & the orchestrator pattern

The search agent you build in this module is not a standalone agent — it is a **subagent** (also called a *specialist*). It is called by a higher-level **orchestrator** agent, which in this workshop is `agent.ts`.

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
Orchestrator (agent.ts)
    │
    │  writes → state["city"], state["genre"], state["dateHint"]
    │
    └── AgentTool → SearchAgent
            │  reads ← state["city"], state["genre"], state["dateHint"]
            │  calls tavily_search
            └── writes → state["searchResults"]   (via outputKey)
```

> **The `description` is the contract.** The orchestrator never sees the subagent's instruction — only its `name` and `description`. Write the description so it clearly answers: *"what does this agent do and when should I call it?"*

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

**This is why subagents must be driven by an orchestrator** — if session state is empty, the LLM receives the literal placeholder strings `{city}`, `{genre}`, etc. instead of real values. In this module you wire `SearchAgent` directly into `agent.ts` so it always runs with the correct state.

> **Optional placeholders:** Use `{key?}` if a key might not exist. ADK substitutes it with an empty string when missing. Required placeholders (no `?`) throw a runtime error if the key is absent — fail fast rather than silently passing garbage to the LLM.

---

## Named exports and `AgentTool`

ADK's web UI (`npm run dev`) serves the **`default` export** of the entry file — `agent.ts` in this workshop. Subagents live in separate files and are exposed as **named exports** so the orchestrator can import them:

```typescript
// agents/search.ts
export const searchAgent = new LlmAgent({ ... });   // named export

// agent.ts
import { searchAgent } from "./agents/search.js";
const orchestrator = new LlmAgent({
  tools: [new AgentTool({ agent: searchAgent })],
});
export default orchestrator;                         // default export — served by npm run dev
```

The orchestrator remains the single entry point. Testing `SearchAgent` means testing `agent.ts` — the orchestrator runs the full pipeline for you.

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
  model: "gemini-3.1-flash-lite"
  outputSchema: mySchema,   // ← enforces JSON structure
  outputKey: "myResults",   // ← auto-saves to state["myResults"]
  instruction: "...",
});
```

This is **not** a prompt hint — the schema is passed to Gemini's API as `responseSchema`, which constrains decoding at the token level. The model physically cannot produce output that violates the schema.

### `outputKey` — free state write

When `outputKey` is set, ADK writes the agent's final response directly to `session.state[outputKey]` — no tool context or extra code needed.

---

## The `outputSchema` + silent failure risk

Controlled generation is reliable, but there is one failure mode to understand: **if your instruction and schema are misaligned**, the model can produce a schema-conformant response that is semantically wrong (e.g., empty arrays, placeholder strings). It won't loop — but it will silently return bad data.

**Protections:**

| Risk | Protection |
|------|------------|
| Model produces empty array | Add `minItems: 1` to schema; validate after reading |
| Instruction doesn't mention schema fields | Mirror the schema field names in the instruction |

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
import { LlmAgent } from "@google/adk";
import { Schema, Type } from "@google/genai";
import { tavilyTool } from "../tools/tavilyTool.js";

const searchResultSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      url:     { type: Type.STRING, description: "Source URL" },
      title:   { type: Type.STRING, description: "Page title" },
      snippet: { type: Type.STRING, description: "Short content excerpt" },
      score:   { type: Type.NUMBER, description: "Relevance score 0–1" },
    },
    required: ["url", "title", "snippet", "score"],
  },
};

export const searchAgent = new LlmAgent({
  name: "SearchAgent",
  model: "gemini-3.1-flash-lite",
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
```

> **Why one query?** Multiple queries multiply API credit usage and make the pipeline harder to trace. One well-crafted query is usually sufficient; participants can experiment with more once the pipeline works.

---

## Wiring `SearchAgent` into `agent.ts`

Once `SearchAgent` exists, add it to the orchestrator in `agent.ts`:

```typescript
// agent.ts
import { LlmAgent, AgentTool, FunctionTool } from "@google/adk";
import { z } from "zod";
import { searchAgent } from "./agents/search.js";

const getCurrentDate = new FunctionTool({ /* same as before */ });

const agent = new LlmAgent({
  name: "EventResearcher",
  model: "gemini-3.1-flash-lite",
  instruction: `
    You are an event research assistant.

    On every new conversation:
    1. Call get_current_date to capture today's date and the user's query in state.
    2. Extract from the user's message:
       - city (REQUIRED — ask if missing)
       - genre (optional, use "" if not specified)
       - dateHint (REQUIRED — ask if missing)
       Write these to session state immediately.
    3. Only proceed once you have both city and a date.
    4. Call SearchAgent to find relevant event URLs.
    5. Report the search results back to the user — list each title and URL.
  `,
  tools: [
    getCurrentDate,
    new AgentTool({ agent: searchAgent }),
  ],
});

export default agent;
```

Run `npm run dev` and send a message — the orchestrator handles constraint extraction, then delegates search to `SearchAgent`. You can watch both agents in the **Events** tab.

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

Create `agents/search.ts`:

1. Import `LlmAgent` from `@google/adk`
2. Import `Schema` and `Type` from `@google/genai`
3. Import `tavilyTool` from `../tools/tavilyTool.js`
4. Define `searchResultSchema` — an array of objects with `url`, `title`, `snippet`, `score`, all required
5. Export `searchAgent` as a named `const` with:
   - `model: "gemini-3.1-flash-lite"`
   - `tools: [tavilyTool]`
   - `outputSchema: searchResultSchema`
   - `outputKey: "searchResults"`
   - An instruction that reads `{city}`, `{genre}`, `{dateHint}`, `{date}` from state and generates a single English query

---

### Step 6 — Wire `SearchAgent` into `agent.ts`

Open `agent.ts`:

1. Import `AgentTool` from `@google/adk`
2. Import `searchAgent` from `./agents/search.js`
3. Add `new AgentTool({ agent: searchAgent })` to the `tools` array
4. Update the instruction to add step 4: *"Call SearchAgent to find relevant event URLs"* and step 5: *"Report the search results — list each title and URL"*

**Validate with Zod (optional but recommended):**

```typescript
import { z } from "zod";

const SearchResultSchema = z.array(z.object({
  url:     z.string().url(),
  title:   z.string(),
  snippet: z.string(),
  score:   z.number(),
}));

// After SearchAgent runs, in a follow-up tool or instruction:
const raw = context.state["searchResults"];
const parsed = SearchResultSchema.safeParse(raw);
if (!parsed.success) {
  console.error("SearchAgent returned invalid data:", parsed.error);
}
```

---

### ✅ Done when…

Run `npm run dev` and ask: *"Find techno events in Cologne this weekend"*

- The **Events** tab shows `get_current_date`, then a `SearchAgent` invocation containing a `tavily_search` tool call
- The **State** tab shows `date`, `city`, `genre`, `dateHint`, and `searchResults`
- `searchResults` is a JSON array of 5 objects, each with `url`, `title`, `snippet`, and `score`
- The orchestrator's final reply lists the search results

---

→ Next: [Module 4 — Crawl Agent](pages/05-crawl-agent.md)
