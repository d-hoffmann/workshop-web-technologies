# Module 1 — Hello Agent & Date Tool

## Concepts

- `Agent` (alias: `LlmAgent`) — the core ADK building block
- System prompts — how you give an agent its personality and rules
- `FunctionTool` — wrapping a TypeScript function as an agent-callable tool
- Zod schemas — typing tool parameters so the LLM knows what to send
- `npx adk web` — the ADK developer UI for testing agents interactively

---

## The Agent

An ADK agent is just a configuration object exported as default:

```typescript
import { Agent } from "@google/adk";

const agent = new Agent({
  name: "my_agent",
  model: "gemini-3.1-flash-lite",
  instruction: "You are a helpful assistant.",
});

export default agent;
```

Run it with `npx adk web` and open [localhost:8080](http://localhost:8080).

---

## Function Tools

Tools let the agent call your code. The LLM decides *when* to call a tool based on its description.

```typescript
import { FunctionTool } from "@google/adk";
import { z } from "zod";

const getCurrentDate = new FunctionTool({
  name: "get_current_date",
  description: "Returns today's date. Call this to know the current date.",
  parameters: z.object({}),          // no inputs needed
  execute: async () => {
    return {
      date: new Date().toLocaleDateString("de-DE", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };
  },
});

const agent = new Agent({
  tools: [getCurrentDate],
  // ...
});
```

> **Why Zod?** ADK converts the Zod schema to a JSON Schema that the LLM uses to construct valid tool call arguments. Always describe each parameter — it directly affects how well the model uses the tool.

---

## Dev UI walkthrough

After running `npx adk web`:

| Tab | What it shows |
|-----|--------------|
| **Chat** | Send messages to your agent |
| **Events** | Every LLM call, tool invocation, and response — with full payloads |
| **State** | Session state values (relevant from Exercise 02) |

Watch the **Events** tab while you chat. You'll see exactly when the model decides to call `get_current_date` and what it receives back.

---

## Exercise

> **Stuck?** Check out the solution branch: `git checkout solution/01-hello-agent`

### Step 1 — Run the starter agent

The `agent.ts` in the repo root is already runnable. Start the dev UI:

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) and ask the agent:

> *"What events are happening in Cologne this weekend?"*

Notice: it doesn't know today's date. Let's fix that.

---

### Step 2 — Add a `getCurrentDate` tool

Open `agent.ts` and follow the `TODO` comments to:

1. Create a `FunctionTool` called `get_current_date`
2. Return today's date formatted for a German user
3. Register the tool on the agent
4. Update the system prompt to reflect the agent's purpose

**Hint — FunctionTool shape:**

```typescript
const myTool = new FunctionTool({
  name: "tool_name",
  description: "What this tool does.",
  parameters: z.object({
    // define inputs with Zod — use z.object({}) for no params
  }),
  execute: async (params) => {
    return { result: "..." };
  },
});
```

**Hint — formatting a German date:**

```typescript
new Date().toLocaleDateString("de-DE", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
```

---

### ✅ Done when…

- You ask *"What's today's date?"* and the agent answers correctly
- The agent introduces itself as an event research assistant
- You can see the tool call in the dev UI's **Events** tab

---

→ Next: [Module 2 — Session State](03-session-state.md)
