import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SaveCompanyDocsResult = { ok: true; saved: number } | { ok: false };

/**
 * Stores company-wide material (HR policies, shared handbooks) once for the whole
 * company, so the AI Coach can draw on it for every role — not just the role it
 * was uploaded with.
 */
export const saveCompanyDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = input as { docs?: unknown };
    const docs = Array.isArray(data?.docs) ? data.docs : [];
    const cleaned = docs
      .map((d) => {
        const doc = (d ?? {}) as { title?: unknown; content?: unknown };
        return {
          title: typeof doc.title === "string" && doc.title.trim() ? doc.title.trim() : "Company-wide document",
          content: typeof doc.content === "string" ? doc.content.slice(0, 200_000) : "",
        };
      })
      .filter((d) => d.content.trim().length > 0);
    return { docs: cleaned };
  })
  .handler(async ({ data, context }): Promise<SaveCompanyDocsResult> => {
    if (data.docs.length === 0) return { ok: true, saved: 0 };
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId) return { ok: false };

      for (const doc of data.docs) {
        // Re-uploading the same document replaces the previous copy instead of piling up.
        const { data: existing } = await context.supabase
          .from("company_docs")
          .select("id")
          .eq("company_id", companyId)
          .eq("title", doc.title)
          .maybeSingle();
        if (existing?.id) {
          const { error } = await context.supabase
            .from("company_docs")
            .update({ content: doc.content, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await context.supabase.from("company_docs").insert({
            company_id: companyId,
            title: doc.title,
            content: doc.content,
            created_by: context.userId,
          });
          if (error) throw error;
        }
      }
      return { ok: true, saved: data.docs.length };
    } catch (error) {
      console.error("Saving company-wide documents failed", error);
      return { ok: false };
    }
  });
