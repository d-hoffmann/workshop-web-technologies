import { FunctionTool } from "@google/adk";
import { z } from "zod";

export async function fetchFitMarkdown(url: string): Promise<string> {
  const res = await fetch("http://localhost:11235/crawl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: [url],
      crawler_config: {
        cache_mode: "bypass",
        excluded_tags: ["nav", "footer", "header", "script", "style"],
      },
      browser_config: {
        headless: true,
        user_agent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        stealth_mode: true,
      },
      markdown_generator: {
        content_filter: {
          type: "PruningContentFilter",
          threshold: 0.48,
          threshold_type: "dynamic",
          min_word_threshold: 5,
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Crawl4AI error: ${res.status}`);

  const data = await res.json();
  return data.results?.[0]?.markdown?.fit_markdown ?? "";
}

export const crawlTool = new FunctionTool({
  name: "crawl_page",
  description:
    "Fetches a single web page and returns its content as clean markdown. " +
    "Only call this if the pre-fetched content for a URL is insufficient.",
  parameters: z.object({
    url: z.string().url().describe("The URL to crawl"),
  }),
  execute: async ({ url }, context) => {
    // Hard cap: max 5 extra crawl calls per agent run
    const callCount = (context.state["crawlCallCount"] as number) ?? 0;
    if (callCount >= 5) {
      return { error: "Max crawl calls reached for this run", markdown: "" };
    }
    context.state["crawlCallCount"] = callCount + 1;

    try {
      const markdown = await fetchFitMarkdown(url);
      return { url, markdown };
    } catch (err) {
      return { url, error: String(err), markdown: "" };
    }
  },
});
