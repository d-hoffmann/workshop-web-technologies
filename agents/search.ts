import { LlmAgent } from "@google/adk";
import { Schema, Type } from "@google/genai";
import { tavilyTool } from "../tools/tavilyTool.js";

const searchResultSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    results: {
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
    },
  },
  required: ["results"],
};

export const searchAgent = new LlmAgent({
  name: "SearchAgent",
  model: "gemini-3.1-flash-lite",
  description:
    "Searches the web for events matching the user's constraints and returns a structured list of URLs.",
  instruction: `
You are a search specialist. Your only job is to find relevant event pages.

Use the following constraints from session state:
- City: {city}
- Genre / event type: {genre}
- Date hint: {dateHint}
- Today's date: {date}

Step 1 — Resolve the exact date:
  Today is {date} (ISO format YYYY-MM-DD).
  Convert {dateHint} to a concrete calendar date relative to today.
  Examples: if today is 2026-06-09 (Tuesday) and dateHint is "this Friday", the date is 2026-06-13.
  Use the resolved date (e.g. "June 13 2026") in the query — never use the raw dateHint phrase.

Step 2 — Build and execute the query:
  Generate exactly ONE English search query combining city, genre, and the resolved date.
  Example: "techno events Cologne June 13 2026"
  Call tavily_search with that query.

Step 3 — Return results:
  Include ALL results returned by the tool — do not drop or truncate any entries.
  Return the results wrapped in an object with a "results" key.

Output ONLY the JSON object { "results": [...] } — no explanation, no extra text.
  `,
  tools: [tavilyTool],
  outputSchema: searchResultSchema,
  outputKey: "searchResults",
});
