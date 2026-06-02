import { Agent, FunctionTool } from "@google/adk";
import { z } from "zod";

// ─── Step 1 ──────────────────────────────────────────────────────────────────
// Run `npm run dev` and open http://localhost:8080
// Ask: "What events are happening in Cologne this weekend?"
// The agent won't know today's date yet — that's what Step 2 fixes.

// ─── Step 2 ──────────────────────────────────────────────────────────────────
// TODO: Create a FunctionTool called "get_current_date"
//       - parameters: z.object({})   ← no inputs needed
//       - return { date: string }
//       - format the date in German (hint: toLocaleDateString("de-DE", {...}))

// const getCurrentDate = new FunctionTool({ ... });

const agent = new Agent({
  name: "event_researcher",
  model: "gemini-2.5-flash",
  // TODO: Update the instruction to tell the agent it helps find local events
  //       and that it should always call get_current_date first.
  instruction: "You are a helpful AI assistant.",
  // TODO: Register your tool here
  // tools: [getCurrentDate],
});

export default agent;
