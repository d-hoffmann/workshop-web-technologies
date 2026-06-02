# Module 2 — Session State

## Why agents need memory

Each time a tool runs, it gets a fresh function call — it has no inherent memory of previous calls. But a multi-agent pipeline needs shared data: the search agent needs to know the user's query, the crawl agent needs the list of URLs the search agent found.

**Session state** is ADK's answer: a key-value store attached to the current conversation that any tool or sub-agent can read from and write to.

```
Tool A  ──writes──►  session.state["key"]  ──reads──►  Tool B / Sub-Agent
```

---

## ToolContext

When a `FunctionTool` needs to access session state, add a second parameter to `execute`:

```typescript
const myTool = new FunctionTool({
  name: "my_tool",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }, context) => {   // ← context is the second arg
    // Write to session state
    context.state["userQuery"] = query;

    // Read from session state
    const savedDate = context.state["date"] as string;

    return { result: "done" };
  },
});
```

> **Types:** Session state values are typed as `unknown` — cast them when you read (`as string`, `as string[]`, etc.).

---

## What to store

For our pipeline we need two values available to sub-agents:

| Key | Value | Written by |
|-----|-------|------------|
| `"date"` | Formatted German date string | `get_current_date` tool |
| `"userQuery"` | The user's original message | `get_current_date` tool |
| `"searchResults"` | Array of URLs from Google | Search sub-agent (Exercise 03) |
| `"crawledPages"` | Array of `{url, markdown}` | Crawl sub-agent (Exercise 03) |

---

## Inspecting state in the dev UI

After adding state writes:

1. Start the agent with `npx adk web`
2. Send a message: *"Find techno events in Cologne this weekend"*
3. Click the **State** tab in the dev UI
4. You should see `date` and `userQuery` appear with their values

This live state inspector is invaluable for debugging multi-agent flows — you can see exactly what each sub-agent will read before it runs.

---

## Exercise

> **Stuck?** Check out the solution branch: `git checkout solution/02-session-state`

### Step 3 — Write to session state inside a tool

Open `agent.ts`. The `getCurrentDate` tool is already there from Exercise 01.

**TODO:** Add a second parameter `context` to `execute` and write two values to session state:

```typescript
execute: async (_params, context) => {
  const date = new Date().toLocaleDateString("de-DE", { ... });

  // Write to session state — sub-agents will read these later
  context.state["date"] = date;
  context.state["userQuery"] = context.userContent ?? "";

  return { date };
},
```

> **Note:** `context.userContent` contains the user's latest message. You can use it to capture their original query alongside the date.

---

### Verify in the dev UI

After making the change:

1. Run `npm run dev` and ask: *"Find techno events in Cologne this weekend"*
2. In the dev UI, open the **State** tab after the tool runs
3. You should see `date` and `userQuery` appear in the session state panel

---

### ✅ Done when…

- The **State** tab shows `date` and `userQuery` after the first message
- The agent still answers normally

---

→ Next: [Module 3 — Multi-Agent Pipeline](04-multi-agent.md)
