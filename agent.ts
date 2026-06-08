import { Agent, FunctionTool } from "@google/adk";
import { z } from "zod";

const getCurrentDate = new FunctionTool({
  name: "get_current_date",
  description: "Returns today's date. Always call this tool first to know the current date before answering questions about events.",
  parameters: z.object({}),
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
  name: "event_researcher",
  model: "gemini-2.5-flash",
  instruction:
    `You are a local events research assistant. You help users find events, activities, and things to do in their city.
    Always call get_current_date first before answering any question so you know today's date.`,
  tools: [getCurrentDate],
});

export default agent;
