# Module 2 — Session State & Constraints

## Concepts

- `ToolContext` — the second argument to a tool's `execute` function
- `context.state` — a shared key-value store for the whole conversation
- State injection — using `{key}` in an agent's instruction to read live state values
- State scoping — controlling who can read and write which keys
- Constraint extraction — the orchestrator derives city, genre, and date from the user's message

---

## Why agents need shared memory

Each tool call is stateless by default — it has no memory of previous calls. But a multi-agent pipeline needs to carry data forward: the crawl agent needs the URLs that the search agent found; the search agent needs the city the user mentioned.

**Session state** is ADK's answer: a key-value store attached to the current conversation that any tool or sub-agent can read from and write to.

```
Tool A  ──writes──►  session.state["key"]  ──reads──►  Sub-Agent B
```

---

## ToolContext

Add a second parameter `context` to a tool's `execute` function to access session state:

```typescript
const myTool = new FunctionTool({
  name: "my_tool",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }, context) => {
    // Write to state
    context.state.set("userQuery", query);

    // Read from state
    const savedDate = context.state.get("date") as string;

    return { result: "done" };
  },
});
```

> **Types:** State values are `unknown` — always cast when reading (`as string`, `as string[]`).

---

## State injection into agent prompts

Sub-agents read state via **`{key}` placeholders** in their `instruction` string. ADK substitutes these automatically before each LLM call:

```typescript
const searchAgent = new LlmAgent({
  instruction: `
    Search for {genre} events in {city} around {date}.
    The user's original query was: {userQuery}
  `,
  // ↑ {city}, {genre}, {date}, {userQuery} are replaced at runtime
  //   from session.state before the system prompt is sent to the LLM
});
```

This is how the orchestrator's extracted constraints reach specialist sub-agents — **no extra tool calls or API calls needed**, the values travel through state.

> **Optional keys:** Use `{key?}` if a key might not exist. Missing required keys throw an error at runtime.

> **Literal curly braces:** If your instruction contains JSON examples with `{` braces, use an `InstructionProvider` function instead of a string — ADK skips substitution for function-based instructions.

---

## State scoping

By default, all state keys are scoped to the current **session**. ADK supports three scopes via key prefixes:

| Prefix | Scope | Example use |
|--------|-------|-------------|
| *(none)* | Session — current conversation only | `"city"`, `"searchResults"` |
| `user:` | User — persists across sessions | `"user:preferences"` |
| `app:` | App — global across all users | `"app:featureFlags"` |

```typescript
// Persist user preference across sessions
context.state.set("user:preferredGenre", "techno");

// Read a global config value
const limit = context.state.get("app:maxResults") as number;
```

> **Convention:** Each agent should only **write** to its own keys. It may **read** from keys written by earlier agents in the pipeline. This prevents agents from corrupting each other's outputs and makes data flow explicit.

---

## Constraint extraction

Rather than creating a dedicated tool, the **orchestrator** handles constraint extraction directly in its system prompt. The LLM parses the user's message and returns the extracted constraints as its response:

```
User: "Find reggaeton events in Barcelona next Saturday"
         │
         ▼  Orchestrator identifies:
         ├── city     = "Barcelona"
         ├── genre    = "reggaeton"
         └── dateHint = "next Saturday"
              │
              ▼  Returns these in its reply; later sessions write them to state
```

If **city** or **date** cannot be determined from the message, the orchestrator asks the user before proceeding — no search query is generated without them.

---

## What to store

For our pipeline:

| Key | Value | Written by | Read by |
|-----|-------|-----------|---------|
| `date` | Formatted date string | `get_current_date` tool | SearchAgent |
| `userQuery` | Raw user message | `get_current_date` tool | SearchAgent |
| `city` | Extracted city | *(later session)* | SearchAgent |
| `genre` | Extracted genre (or `""`) | *(later session)* | SearchAgent |
| `dateHint` | Date hint from query | *(later session)* | SearchAgent |
| `searchResults` | `{url,title,snippet,score}[]` | SearchAgent | CrawlAgent |
| `crawledEvents` | `{name,location,…}[]` | CrawlAgent | Orchestrator |

---

## Exercise

> **Stuck?** Check out the solution branch: `git checkout solution/02-session-state`

### Step 3 — Write to state from a tool

Open `agent.ts`. The `getCurrentDate` tool is already there from Exercise 01.

**TODO:** Add a `context` parameter to `execute` and write `date` and `userQuery` to state:

```typescript
execute: async (_params, context) => {
  const date = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  context.state.set("date", date);
  context.state.set("userQuery", context.userContent ?? "");

  return { date };
},
```

Then update the agent's instruction so it:
1. Calls `get_current_date` on every first message
2. Extracts `city`, `genre`, and `dateHint` from the user's message and includes them in its reply
3. Asks the user before proceeding if `city` or a date hint is missing

**Hint — instruction shape:**

```typescript
instruction: `
  You are an event research assistant.

  On every new conversation:
  1. Call get_current_date to capture today's date and the user's query in state.
  2. From the user's message, identify:
     - city: the city they want events in (REQUIRED — ask if missing)
     - genre: music genre or event type (optional, use "" if not specified)
     - dateHint: when they want to attend (REQUIRED — ask if missing)
  3. Only proceed once you have both a city and a date hint.
  4. Summarise: city, genre, dateHint.
`,
```

---

### Verify in the dev UI

After making the change:

1. Run `npm run dev` and ask: *"Find techno events in Cologne this friday"*
2. Open the **State** tab in the dev UI
3. You should see `date` and `userQuery` appear

Try a vague query — *"Find some events"* — and confirm the agent asks for city and date before doing anything else.

---

### ✅ Done when…

- The **State** tab shows `date` and `userQuery` after the first message
- The agent's reply includes the extracted city, genre, and dateHint
- A vague message like *"Find events"* triggers a follow-up question for city/date
- The agent still answers normally for complete queries

---

→ Next: [Module 3 — Search Agent](pages/04-search-agent.md)
