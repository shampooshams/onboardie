import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { inReaderLanguage, type LiveContentResult } from "./live-content.functions";
import { langFrom, type Lang } from "./i18n/translate";
import type { Sections } from "./notion-publish.server";

const KEYS = ["overview", "plan", "faq", "tools", "contacts", "facts"] as const;

function normalize(raw: Record<string, unknown>): Sections {
  const sections = {} as Sections;
  for (const key of KEYS) {
    const value = raw[key];
    sections[key] = Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
  }
  return sections;
}

function validate(input: unknown): { roleContentId: string; lang: Lang } {
  const data = input as { roleContentId?: unknown; lang?: unknown };
  if (typeof data?.roleContentId !== "string" || !data.roleContentId.trim())
    throw new Error("roleContentId is required");
  return { roleContentId: data.roleContentId.trim(), lang: langFrom(data.lang) };
}

/**
 * Manager preview: reads one published role record by id, scoped to the
 * manager's own company. Never used for real new-hire content resolution.
 */
export const getPreviewContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<LiveContentResult> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId)
        return { ok: true, role: null, sections: null, updatedAt: null, isMockup: false };

      const { data: row, error } = await context.supabase
        .from("role_content")
        .select("role, sections, updated_at")
        .eq("id", data.roleContentId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      if (!row) return { ok: true, role: null, sections: null, updatedAt: null, isMockup: false };

      const localized = await inReaderLanguage(
        context.supabase,
        data.roleContentId,
        normalize((row.sections ?? {}) as Record<string, unknown>),
        data.lang,
      );
      return { ok: true, role: row.role, ...localized, updatedAt: row.updated_at, isMockup: false };
    } catch (error) {
      console.error("Reading preview role content failed", error);
      return { ok: false, error: "notion" };
    }
  });
