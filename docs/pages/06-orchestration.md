# Module 5 — Orchestration & Final Answer

## Concepts

- Orchestrator as synthesiser — reading sub-agent output from state and producing the final user-facing response
- Full pipeline assembly — connecting all modules into one end-to-end flow

---

## The orchestrator's final job

By the end of Module 4 you have a pipeline that:

1. Writes `date`, `userQuery`, `city`, `genre`, `dateHint` to state
2. Calls `SearchAgent` → writes `searchResults` to state
3. Calls `CrawlAgent` → writes `crawledEvents` to state

The orchestrator has **one job left**: read `state["crawledEvents"]` and turn the structured array of event objects into a clear, human-readable summary for the user.

This is the **synthesiser** role — the orchestrator does not search or crawl. It delegates those tasks to specialists and then combines the results into a final response:

```
CrawlAgent writes → state["crawledEvents"]   (structured JSON array)
                              │
                              ▼
                       Orchestrator reads
                              │
                              ▼
              "Here are the events I found: ..."   (prose summary to user)
```

---

## Why explicit "stop" matters

Without a clear stopping instruction, an LLM agent may loop — re-calling tools it already called, or generating intermediate tool calls to "double-check" results. Instructing the orchestrator to stop after summarising is important:

```typescript
instruction: `
  ...
  6. Once CrawlAgent returns its results, do NOT call any more tools.
     Write a short plain-text summary of the found events directly to
     the user and stop. This is your final response.
`,
```

The phrase **"do NOT call any more tools"** combined with **"this is your final response"** is the minimal reliable pattern for halting the agent.

---

## The complete `agent.ts`

Here is the final orchestrator, combining everything from Modules 1–4 with the closing summarisation step:

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
    6. Once CrawlAgent returns its results, do NOT call any more tools.
       Write a short plain-text summary of the found events directly to
       the user and stop. This is your final response.
       Format each event as: name — venue — time — price.
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
    └── reads state["crawledEvents"], summarises → user   ← you add this now
```

---

## Exercise

> **Stuck?** Check out the solution branch: `git checkout solution/05-orchestration`

### Step 8 — Add the final summary step to `agent.ts`

Open `agent.ts` (the version you finished at the end of Module 4 — it already has `SearchAgent` and `CrawlAgent` wired in).

The orchestrator instruction currently ends at step 5 ("Call CrawlAgent"). Add step 6:

1. After step 5 in the instruction, add:
   ```
   6. Once CrawlAgent returns its results, do NOT call any more tools.
      Write a short plain-text summary of the found events directly to
      the user and stop. This is your final response.
      Format each event as: name — venue — time — price.
   ```
2. Run the full pipeline and verify the agent produces a formatted event list.

That is the only code change. The wiring from Modules 3 and 4 is already complete.

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
4. Final orchestrator response with a formatted event list

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
