import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_role_content",
  title: "Get onboarding role content",
  description:
    "Fetch the published onboarding content for the Sales Development Representative role (Role Overview, FAQs, Tools & How to Use Them, Who to Contact) as markdown.",
  inputSchema: {
    section: z
      .string()
      .optional()
      .describe(
        "Optional case-insensitive filter, e.g. 'FAQ', 'Tools', 'Who to Contact'. Omit to get everything.",
      ),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ section }) => {
    try {
      const { getRoleContent } = await import("@/lib/notion.server");
      const content = await getRoleContent();

      if (!section?.trim()) {
        return { content: [{ type: "text", text: content }] };
      }

      const needle = section.trim().toLowerCase();
      const matched = content
        .split("\n\n---\n\n")
        .filter((part) => part.toLowerCase().includes(needle));

      return {
        content: [
          {
            type: "text",
            text: matched.length
              ? matched.join("\n\n---\n\n")
              : `No section matching "${section}" was found in the published role content.`,
          },
        ],
      };
    } catch (error) {
      console.error("MCP get_role_content failed", error);
      return {
        content: [
          {
            type: "text",
            text: "Unable to load role content right now. Please try again shortly.",
          },
        ],
        isError: true,
      };
    }
  },
});
