import { FunctionTool } from "@google/adk";
import { z } from "zod";

export const tavilyTool = new FunctionTool({
  name: "tavily_search",
  description:
    "Search the web using Tavily. Returns title, URL, content snippet, and relevance score.",
  parameters: z.object({
    query: z.string().describe("The search query in English"),
  }),
  execute: async ({ query }) => {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: 10,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      return { error: `Tavily API error: ${res.status}`, results: [] };
    }

    const data = await res.json();

    // Take top 5 by score — deterministic, no LLM judgment needed
    const top5 = (data.results ?? [])
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5)
      .map((r: any) => ({
        url: r.url,
        title: r.title,
        snippet: r.content,
        score: r.score,
      }));

    return { results: top5 };
  },
});
