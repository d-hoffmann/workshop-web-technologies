import { LlmAgent, FunctionTool, AgentTool } from "@google/adk";
import { Schema, Type } from "@google/genai";
import { z } from "zod";
import { tavilyTool } from "../tools/tavilyTool.js";

const searchResultSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: "Source URL" },
      title: { type: Type.STRING, description: "Page title" },
      snippet: { type: Type.STRING, description: "Short content excerpt" },
      score: { type: Type.NUMBER, description: "Relevance score 0–1" },
    },
    required: ["url", "title", "snippet", "score"],
  },
};

export const searchAgent = new LlmAgent({
  name: "SearchAgent",
  model: "gemini-2.0-flash",
  description:
    "Searches the web for events matching the user's constraints and returns a structured list of URLs.",
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

// ---------------------------------------------------------------------------
// Standalone test harness
//
// ADK's web UI (pnpm dev) and CLI (pnpm start) only serve the **default
// export** of the entry file. Because SearchAgent is a subagent — it reads
// {city}, {genre}, {dateHint}, {date} from session state rather than from
// the user message — it cannot be tested directly: those state keys would be
// empty and the placeholders would render as literal "{city}" strings.
//
// This default export is a thin orchestrator that:
//   1. Accepts a plain natural-language request from the user
//   2. Extracts and writes city, genre, dateHint, and today's date to state
//   3. Delegates to SearchAgent via AgentTool — exactly as the real
//      orchestrator will in Module 5
//
// In Module 5 you will import `searchAgent` (the named export above) and wire
// it into the real orchestrator. This default export is dev-only scaffolding.
// ---------------------------------------------------------------------------

const getCurrentDate = new FunctionTool({
  name: "get_current_date",
  description: "Returns today's date and writes it to session state.",
  parameters: z.object({}),
  execute: async (_params, context) => {
    const date = new Date().toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
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
   - city: the city they want events in (REQUIRED — ask if missing)
   - genre: music genre or event type (use "" if not specified)
   - dateHint: when they want to attend (REQUIRED — ask if missing)
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
