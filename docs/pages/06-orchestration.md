# Module 5 — Orchestration

## Concepts

- `AgentTool` — wrapping a sub-agent so the orchestrator can call it like a tool
- Orchestrator pattern — one coordinator, multiple specialists
- Project file structure — one file per agent, shared tools directory
- Zod validation on state reads — catching schema mismatches early
- Full pipeline wiring — connecting all modules into the final agent

---

## Orchestrator vs Specialist

In a multi-agent system, agents have distinct roles:

| Role | Responsibility |
|------|---------------|
| **Orchestrator** | Understands the user goal, extracts constraints, decides which specialists to invoke and when, produces the final user-facing response |
| **Specialist** | Does one thing well — search, crawl, format — writes its output to a dedicated state key |

The orchestrator never does search or crawling itself. It delegates and synthesises.

---

## `AgentTool`

`AgentTool` wraps an `LlmAgent` so the orchestrator can call it exactly like a `FunctionTool`. The orchestrator's LLM reads the sub-agent's `description` to decide when to invoke it:

```typescript
import { LlmAgent, AgentTool } from "@google/adk";
import { searchAgent } from "./agents/search.js";
import { crawlAgent } from "./agents/crawl.js";

const orchestrator = new LlmAgent({
  tools: [
    getCurrentDate,
    new AgentTool({ agent: searchAgent }),
    new AgentTool({ agent: crawlAgent }),
  ],
});
```

> **Write the `description` carefully.** The orchestrator's LLM uses `searchAgent.description` to decide *when* to call it — the same way it uses `FunctionTool.description`. A vague description leads to the wrong agent being called at the wrong time.

### State sharing with `AgentTool`

When the orchestrator calls a sub-agent via `AgentTool`, they share the **same session state**. Keys written by the orchestrator's tools are immediately readable by the sub-agent (via `{key}` injection), and keys written by the sub-agent (via `outputKey`) are immediately readable by the orchestrator after the call returns.

---

## Project file structure

Rather than one large `agent.ts`, split the code into logical files:

```
agent.ts                    ← orchestrator (default export)
agents/
  search.ts                 ← SearchAgent
  crawl.ts                  ← CrawlAgent
tools/
  tavilyTool.ts             ← Tavily FunctionTool + helper
  crawlTool.ts              ← crawl_page FunctionTool + fetchMarkdown helper (bonus)
```

> **`NodeNext` imports:** TypeScript is configured with `moduleResolution: NodeNext`. Always use `.js` extensions in relative imports — e.g., `import { searchAgent } from "./agents/search.js"` — even though the source files are `.ts`.

---

## Validating state reads with Zod

After a sub-agent writes to state via `outputKey`, validate before the orchestrator uses the data:

```typescript
import { z } from "zod";

const EventSchema = z.object({
  name:        z.string(),
  location:    z.string(),
  description: z.string(),
  time:        z.string(),
  price:       z.string(),
  url:         z.string(),
});

const CrawledEventsSchema = z.array(EventSchema);

// In the orchestrator instruction or a post-processing tool:
const raw = context.state.get("crawledEvents");
const result = CrawledEventsSchema.safeParse(raw);

if (!result.success) {
  // Log and degrade gracefully rather than crashing
  console.error("CrawlAgent returned unexpected data:", result.error.flatten());
  return { events: [] };
}

const events = result.data;
```

---

## The full `agent.ts`

```typescript
// agent.ts
import { LlmAgent, AgentTool, FunctionTool } from "@google/adk";
import { z } from "zod";
import { searchAgent } from "./agents/search.js";
import { crawlAgent } from "./agents/crawl.js";

const getCurrentDate = new FunctionTool({
  name: "get_current_date",
  description: "Returns today's date and captures the user's query in session state.",
  parameters: z.object({}),
  execute: async (_params, context) => {
    const date = new Date().toLocaleDateString("de-DE", {
      weekday: "long",
      year:    "numeric",
      month:   "long",
      day:     "numeric",
    });
    context.state.set("date",      date);
    context.state.set("userQuery", context.userContent ?? "");
    return { date };
  },
});

const agent = new LlmAgent({
  name: "EventResearcher",
  model: "gemini-3.1-flash-lite",
  description: "An event research assistant that finds live events based on user constraints.",
  instruction: `
    You are an event research assistant. Your goal is to find events matching
    the user's city, genre preference, and date.

    On every new conversation:
    1. Call get_current_date first to capture today's date and the user's query.
    2. Extract from the user's message:
       - city: the city they want events in (REQUIRED — ask if not provided)
       - genre: music genre or event type (optional — use "" if not specified)
       - dateHint: when they want to go (REQUIRED — ask if not provided)
       Write these to session state immediately.
    3. Only proceed once you have both city and a date.
    4. Call SearchAgent to find relevant event URLs.
     5. Call CrawlAgent to extract structured event details from those pages.
     6. Once CrawlAgent returns its results, do NOT call any more tools. Write a short plain-text summary of the found events directly to the user and stop. This is your final response.
  `,
  tools: [
    getCurrentDate,
    new AgentTool({ agent: searchAgent }),
    new AgentTool({ agent: crawlAgent }),
  ],
});

export default agent;
```

---

## Full data flow

```
User message
    │
    ▼
Orchestrator
    ├── get_current_date ──► state["date"], state["userQuery"]
    ├── extracts ──────────► state["city"], state["genre"], state["dateHint"]
    │
    ├── AgentTool → SearchAgent
    │       ├── reads {city}, {genre}, {dateHint}, {date} from state
    │       ├── calls tavily_search (1 query, top 5 results)
    │       └── outputKey ──────────► state["searchResults"]
    │
    ├── AgentTool → CrawlAgent
    │       ├── beforeAgentCallback pre-fetches markdown for all 5 URLs
    │       │   └── writes ─────────► state["prefetchedMarkdown"]
    │       ├── LLM extracts event fields from prefetched markdown
    │       ├── (bonus) optionally calls crawl_page (max 5 extra calls total)
    │       └── outputKey ──────────► state["crawledEvents"]
    │
    └── reads state["crawledEvents"], summarises → user
```

---

## Exercise

> **Stuck?** Check out the solution branch: `git checkout solution/05-orchestration`

### Step 8 — Wire `agent.ts`

Open `agent.ts` (the root file you've been building since Module 1).

1. Import `AgentTool` from `@google/adk`
2. Import `searchAgent` from `./agents/search.js`
3. Import `crawlAgent` from `./agents/crawl.js`
4. Add both to the orchestrator's `tools` array wrapped in `new AgentTool({ agent: ... })`
5. Update the orchestrator instruction to match the pattern above — it should:
   - Call `get_current_date` first
   - Extract and write `city`, `genre`, `dateHint` to state
   - Ask for missing required values before searching
   - Delegate to `SearchAgent`, then `CrawlAgent`
   - Read `crawledEvents` from state and summarise

**Hint — model:**

```typescript
model: "gemini-3.1-flash-lite",   // orchestrator needs reasoning; use 2.5-flash
```

---

### Test the full pipeline

Start the dev UI:

```bash
npm run dev
```

Ask: *"Find techno events in Cologne this friday"*

In the **Events** tab you should see:
1. `get_current_date` tool call
2. `SearchAgent` invocation (with `tavily_search` inside)
3. `CrawlAgent` invocation (with `beforeAgentCallback` activity)
4. Final orchestrator response with a structured event list

In the **State** tab you should see all pipeline keys: `date`, `userQuery`, `city`, `genre`, `dateHint`, `searchResults`, `prefetchedMarkdown`, `crawledEvents`.

---

### Try edge cases

| Query | Expected behaviour |
|-------|--------------------|
| *"Find events"* | Agent asks for city and date |
| *"Find events in Berlin"* | Agent asks for date |
| *"Find jazz events in Vienna next Friday"* | Full pipeline runs without questions |
| *"Find events in a city with no results"* | Agent reports no events found honestly |

---

### ✅ Done when…

- The full pipeline runs end-to-end from a single user message
- All state keys appear in the State tab
- The agent asks follow-up questions for missing city or date
- The final response lists events with name, venue, time, price, and description

---


