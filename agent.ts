import { Agent, FunctionTool } from "@google/adk";
import { z } from "zod";

const getCurrentDate = new FunctionTool({
  name: "get_current_date",
  description: "Returns today's date. Always call this tool first to know the current date before answering questions about events.",
  parameters: z.object({}),
  execute: async (_params, context) => {
    const date = new Date().toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (context) {
      context.state.set("date", date);
      context.state.set("userQuery", context.userContent ?? "");
    }

    return { date };
  },
});

const agent = new Agent({
  name: "event_researcher",
  model: "gemini-2.5-flash",
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
  tools: [getCurrentDate],
});

export default agent;
