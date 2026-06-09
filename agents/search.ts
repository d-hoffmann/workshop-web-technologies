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

Generate exactly ONE English search query combining city, genre, and date.
Call tavily_search with that query.
Return the results wrapped in an object with a "results" key.

Output ONLY the JSON object { "results": [...] } — no explanation, no extra text.
  `,
  tools: [tavilyTool],
  outputSchema: searchResultSchema,
  outputKey: "searchResults",
});
