import { Agent, AgentTool, FunctionTool } from "@google/adk";
import { z } from "zod";
import { searchAgent } from "./agents/search.js";
import { crawlAgent } from "./agents/crawl.js";

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

const setConstraints = new FunctionTool({
  name: "set_constraints",
  description: "Save the user's event constraints (city, genre, dateHint) to session state so subagents can read them.",
  parameters: z.object({
    city:     z.string().describe("City where the user wants to find events"),
    genre:    z.string().describe("Music genre or event type, empty string if not specified"),
    dateHint: z.string().describe("When the user wants to attend, e.g. 'this weekend', 'next Friday'"),
  }),
  execute: async ({ city, genre, dateHint }, context) => {
    if (context) {
      context.state.set("city", city);
      context.state.set("genre", genre);
      context.state.set("dateHint", dateHint);
    }
    return { city, genre, dateHint };
  },
});

const agent = new Agent({
  name: "event_researcher",
  model: "gemini-2.5-flash",
  instruction: `
You are an event research assistant.

On every new conversation:
1. Call get_current_date to capture today's date and the user's query in state.
2. From the user's message, extract:
   - city: the city they want events in (REQUIRED — ask if missing)
   - genre: music genre or event type (optional, use "" if not specified)
   - dateHint: when they want to attend (REQUIRED — ask if missing)
3. Only proceed once you have both a city and a date hint.
4. Call set_constraints with city, genre, and dateHint to save them to session state.
5. Call SearchAgent to find relevant event URLs.
6. Call CrawlAgent to extract structured event details from those pages.
7. Read session state key "crawledEvents" and present the results to the user.
   For each event, show: name, venue, date/time, price, and a short description.
   If no events were found or all fields are "NA", say so honestly.
`,
  tools: [
    getCurrentDate,
    setConstraints,
    new AgentTool({ agent: searchAgent }),
    new AgentTool({ agent: crawlAgent }),
  ],
});

export default agent;
