import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const SYSTEM_PROMPT = `You are an onboarding coach for new hires at a company, currently supporting a Sales Development Representative. Your job is to help with specific tasks related to their role — CRM usage, outreach emails, processes, and knowing who to contact. Only answer using the Notion content provided to you — do not use general knowledge or make anything up. If the provided content doesn't cover the question, say so clearly and suggest they check with their manager, rather than guessing. Be direct, practical, and friendly. Keep answers concise and immediately usable.`;

export default defineTool({
  name: "ask_onboarding_coach",
  title: "Ask the onboarding coach",
  description:
    "Ask a question about the Sales Development Representative onboarding (CRM usage, processes, outreach, who to contact). Answers are grounded only in the published role content.",
  inputSchema: {
    question: z.string().min(1).describe("The new hire's question."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ question }) => {
    let roleContent: string;
    try {
      const { getRoleContent } = await import("@/lib/notion.server");
      roleContent = await getRoleContent();
    } catch (error) {
      console.error("MCP ask_onboarding_coach: role content failed", error);
      return {
        content: [
          {
            type: "text",
            text: "I'm having trouble accessing role content right now — please try again shortly.",
          },
        ],
        isError: true,
      };
    }

    try {
      const { aiConfig } = await import("@/lib/ai-gateway.server");
      const { endpoint, apiKey, model } = aiConfig();
      if (!apiKey || !model) throw new Error("AI_API_KEY / AI_MODEL are not configured");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "system",
              content: `Notion content for the Sales Development Representative role:\n\n${roleContent}`,
            },
            { role: "user", content: question },
          ],
        }),
      });

      if (!response.ok) {
        console.error(`MCP coach gateway failed [${response.status}]: ${await response.text()}`);
        return {
          content: [{ type: "text", text: "Something went wrong — please try again." }],
          isError: true,
        };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return {
          content: [{ type: "text", text: "Something went wrong — please try again." }],
          isError: true,
        };
      }

      return { content: [{ type: "text", text }], structuredContent: { answer: text } };
    } catch (error) {
      console.error("MCP ask_onboarding_coach failed", error);
      return {
        content: [{ type: "text", text: "Something went wrong — please try again." }],
        isError: true,
      };
    }
  },
});
