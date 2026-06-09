import { FunctionTool } from "@google/adk";
import { z } from "zod";

export async function fetchMarkdown(url: string): Promise<string> {
  const res = await fetch("http://localhost:11235/crawl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: [url],
      browser_config: {
        headless: true,
        user_agent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        extra_args: [], // Pass empty array if required by stricter validator types
      },
      crawler_config: {
        cache_mode: "bypass",
        excluded_tags: ["nav", "footer", "header", "script", "style"],
        markdown_generator: {
          type: "DefaultMarkdownGenerator", // Explicit strategy typing hint for the API parser
          params: {
            content_filter: {
              type: "PruningContentFilter",
              params: {
                threshold: 0.2,            // Relaxed density threshold to prevent empty results
                threshold_type: "fixed",
                min_word_threshold: 5,
              }
            }
          }
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Crawl4AI error: ${res.status}`);

  const data = await res.json();
  
  // Direct extraction path adhering to CrawlResult structural layout
  if (data.success && data.results && data.results.length > 0) {
    const result = data.results[0];
    return result.markdown?.fit_markdown || result.markdown?.raw_markdown || "";
  }
  
  return "";
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
    const callCount = (context?.state.get("crawlCallCount") as number) ?? 0;
    if (callCount >= 5) {
      return { error: "Max crawl calls reached for this run", markdown: "" };
    }
    context?.state.set("crawlCallCount", callCount + 1);

    try {
      const markdown = await fetchMarkdown(url);
      return { url, markdown };
    } catch (err) {
      return { url, error: String(err), markdown: "" };
    }
  },
});