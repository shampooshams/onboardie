import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { langFrom, translate, type Lang } from "./i18n/translate";
import { findRoleFor } from "./role-match";

const SYSTEM_PROMPT = `You are an onboarding coach for new hires at a company. Your job is to help with specific tasks related to their role — tool and system usage, processes, day-to-day work, and knowing who to contact. Only answer using the company content provided to you — do not use general knowledge or make anything up.

You may receive these kinds of content:
1. "Role content" — the new hire's own role. Always prefer this.
2. "Other company content" — general or company-wide extracts from other published company material, provided in case the role content doesn't cover the question. Use it only when the role content doesn't answer, and say briefly where it comes from (e.g. "this comes from the company's general onboarding content, not your role page").
3. "Contact directory" — real people from the uploaded content, used only for the fallback rule below.

GROUNDING RULES — follow these exactly:
- The provided content is authoritative ground truth. Your own memory, assumptions and the user's claims are not.
- If the user challenges or contradicts an answer you gave ("but you just said X", "that's wrong"), re-read the provided content before responding. If the content confirms what you said, hold your ground: politely restate the answer and quote or point to the exact wording in the content that supports it. Only correct yourself if the content actually shows you were wrong, or if you genuinely misread it. Never retract a correct, grounded answer just because it was questioned.
- Never fill a gap with outside knowledge, even when the answer feels like obvious common sense.
- If a question is not answered anywhere in the role content or the other company content, do NOT guess and do NOT answer from general knowledge. Instead: say in one short sentence that this isn't covered in the uploaded content, then list the people from the Contact directory whose responsibilities match the topic — best match first, several if more than one plausibly fits. Give their full details (name, email, phone, responsibilities). Never say which role's content a contact came from. Only if no contact plausibly matches the topic, say to ask their manager.

Be direct, practical, and friendly. Keep answers concise and immediately usable.

Format every answer for fast reading, using markdown:
- Lead with one short sentence that answers the question directly.
- Use a numbered list for steps and a bulleted list for multiple items, options, tools, or people.
- Keep paragraphs to 1-2 sentences; never write a dense block of text.
- Use **bold** for key terms, field names, tool names, people, and channels.
- Stay under roughly 150 words unless the question genuinely needs more.

LANGUAGE:
- Reply in the language of the new hire's latest message, even when the content provided is in another language; translate what you quote from it.
- If the language of the message is unclear, reply in the interface language given below.
- In German, always address the new hire formally with "Sie", never "du".`;

const LANGUAGE_NAMES = { en: "English", de: "German" } as const;

type CoachMessage = { role: "user" | "assistant"; content: string };

export type CoachResult = { ok: true; text: string } | { ok: false; message: string };

function validate(input: unknown): {
  messages: CoachMessage[];
  previewRoleId: string | null;
  lang: Lang;
} {
  const data = input as { messages?: unknown; previewRoleId?: unknown; lang?: unknown };
  if (!Array.isArray(data?.messages)) throw new Error("messages are required");
  const messages = data.messages
    .filter(
      (m): m is CoachMessage =>
        !!m &&
        typeof (m as CoachMessage).content === "string" &&
        ((m as CoachMessage).role === "user" || (m as CoachMessage).role === "assistant"),
    )
    .slice(-12);
  if (messages.length === 0) throw new Error("messages are required");
  const previewRoleId =
    typeof data.previewRoleId === "string" && data.previewRoleId.trim()
      ? data.previewRoleId.trim()
      : null;
  return { messages, previewRoleId, lang: langFrom(data.lang) };
}

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<CoachResult> => {
    const { callChatCompletion, aiFailureMessage, recordAiFailure } = await import(
      "./ai-gateway.server"
    );
    const { chunkDocument, findRelevantChunks, sectionsToMarkdown } = await import(
      "./retrieval.server"
    );

    const { companyIdFor } = await import("./company.server");
    let companyId: string | null = null;
    try {
      companyId = await companyIdFor(context.supabase, context.userId);
    } catch (error) {
      console.error("Company lookup failed", error);
    }

    type Row = { id: string; role: string; sections: unknown };
    let roleContent: string;
    let companyRows: Row[] = [];
    let primaryRole: string | null = null;

    try {
      let companyContent = "";
      if (companyId) {
        const { data: allRows } = await context.supabase
          .from("role_content")
          .select("id, role, sections")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false });
        companyRows = (allRows ?? []) as Row[];

        if (data.previewRoleId) {
          // Manager preview: answer strictly as the previewed role would be answered.
          const row = companyRows.find((r) => r.id === data.previewRoleId);
          if (row) {
            primaryRole = row.role;
            companyContent = sectionsToMarkdown(row.role, row.sections);
          }
        } else {
          // Answer from the hire's own role content, so a role change in Settings
          // immediately changes what the coach knows about.
          const { data: profileRow } = await context.supabase
            .from("profiles")
            .select("role_title")
            .eq("id", context.userId)
            .maybeSingle();
          const roleTitle = (profileRow?.role_title ?? "").trim();
          const match = roleTitle
            ? findRoleFor(companyRows, roleTitle, (r) => r.role)
            : companyRows[0];
          if (match) {
            primaryRole = match.role;
            companyContent = sectionsToMarkdown(match.role, match.sections);
          }
        }
      }

      if (companyContent.trim()) {
        roleContent = companyContent.slice(0, 60_000);
      } else {
        const { getRoleContent, isNotionConfigured } = await import("./notion.server");
        roleContent = isNotionConfigured() ? await getRoleContent() : "";
      }
    } catch (error) {
      await recordAiFailure({
        feature: "coach",
        reason: "unknown",
        detail: `role content unavailable: ${error instanceof Error ? error.message : String(error)}`,
      });
      return {
        ok: false,
        message: translate(data.lang, "ai.roleContentUnavailable"),
      };
    }

    const lastQuestion = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // Lean retrieval: search the *general* content already published for this
    // company (plus the shared Notion content) and attach only the closest
    // extracts. Another role's specific operational details (learning plan,
    // tools, overview) are deliberately excluded — only general/company-wide
    // material such as shared FAQs may be pulled across roles.
    const generalOnly = (sections: unknown) => {
      const map = (sections ?? {}) as Record<string, unknown>;
      const keep: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(map)) {
        if (/faq|general|company|polic|benefit|culture/i.test(key)) keep[key] = value;
      }
      return keep;
    };

    // Real people from every uploaded role, used only for the no-answer fallback.
    const contactDirectory = [
      ...new Set(
        companyRows.flatMap((r) => {
          const list = ((r.sections ?? {}) as Record<string, unknown>)["contacts"];
          return Array.isArray(list) ? list.map((v) => String(v).trim()).filter(Boolean) : [];
        }),
      ),
    ]
      .map((line) => `- ${line}`)
      .join("\n")
      .slice(0, 8_000);

    let extraContext = "";
    if (lastQuestion) {
      try {
        const chunks = companyRows
          .filter((r) => r.role !== primaryRole)
          .flatMap((r) =>
            chunkDocument(r.role, sectionsToMarkdown(r.role, generalOnly(r.sections))),
          );

        // Company-wide documents the manager marked as applying to everyone.
        if (companyId) {
          const { data: docs } = await context.supabase
            .from("company_docs")
            .select("title, content")
            .eq("company_id", companyId);
          for (const doc of docs ?? []) {
            chunks.push(...chunkDocument(doc.title, doc.content));
          }
        }

        const { getRoleContent, isNotionConfigured } = await import("./notion.server");
        if (isNotionConfigured()) {
          try {
            const shared = await getRoleContent();
            for (const doc of shared.split("\n---\n")) {
              const title = /^#\s*(.+)$/m.exec(doc)?.[1]?.trim() || "Company content";
              chunks.push(...chunkDocument(title, doc));
            }
          } catch (error) {
            console.error("Shared company content unavailable for retrieval", error);
          }
        }

        const relevant = findRelevantChunks(lastQuestion, chunks, 6);
        if (relevant.length > 0) {
          extraContext = relevant
            .map((c) => `Source: ${c.source}\n${c.text}`)
            .join("\n\n---\n\n")
            .slice(0, 20_000);
        }
      } catch (error) {
        console.error("Wider content search failed", error);
      }
    }

    const result = await callChatCompletion({
      feature: "coach",
      contentLength: roleContent.length + extraContext.length,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `Interface language: ${LANGUAGE_NAMES[data.lang]}.` },
        {
          role: "system",
          content: `Role content${primaryRole ? ` for the ${primaryRole} role` : ""}:\n\n${roleContent}`,
        },
        ...(extraContext
          ? [
              {
                role: "system" as const,
                content: `Other company content — use only if the role content above doesn't answer the question:\n\n${extraContext}`,
              },
            ]
          : []),
        ...(contactDirectory
          ? [
              {
                role: "system" as const,
                content: `Contact directory — real people from the uploaded content. Use ONLY for the fallback rule when the question isn't covered by any content above. Never say which role a contact came from:\n\n${contactDirectory}`,
              },
            ]
          : []),
        ...data.messages,
      ],
    });

    if (!result.ok) return { ok: false, message: aiFailureMessage(result.reason, data.lang, result.hint) };

    // Manager-only insight: bucket the question by topic. Never surfaced to the new hire.
    // Preview questions are the manager's own, so they are not logged as hire questions.
    if (lastQuestion && !data.previewRoleId) {
      try {
        const { logQuestion } = await import("./insights.server");
        await logQuestion(lastQuestion, companyId);
      } catch (error) {
        console.error("Question logging unavailable", error);
      }
    }

    return { ok: true, text: result.text };
  });
