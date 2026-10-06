import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Sections } from "./notion-publish.server";
import { findRoleFor } from "./role-match";

export type LiveContentResult =
  | {
      ok: true;
      role: string | null;
      sections: Sections | null;
      updatedAt: string | null;
      isMockup: boolean;
    }
  | { ok: false; error: "notion" };

const KEYS = ["overview", "plan", "faq", "tools", "contacts"] as const;

function normalize(raw: Record<string, unknown>): Sections {
  const sections = {} as Sections;
  for (const key of KEYS) {
    const value = raw[key];
    sections[key] = Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
  }
  return sections;
}

/**
 * Reads the role content this user should see: their own company's most recent role,
 * falling back to the shared mockup role so demos still work.
 */
export const getLiveContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LiveContentResult> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);

      // The hire's own job title decides which role content they see, so a newly
      // uploaded role for a different job never replaces theirs.
      const { data: profileRow } = await context.supabase
        .from("profiles")
        .select("role_title")
        .eq("id", context.userId)
        .maybeSingle();
      const roleTitle = (profileRow?.role_title ?? "").trim();

      if (companyId) {
        const { data, error } = await context.supabase
          .from("role_content")
          .select("role, sections, updated_at")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        const rows = data ?? [];
        // Only the hire's own role may be shown. Without a title match we must not
        // fall back to another role's content — that reads as "stuck on the old role".
        const match = roleTitle
          ? findRoleFor(rows, roleTitle, (r) => r.role)
          : rows[0];
        if (match) {
          return {
            ok: true,
            role: match.role,
            sections: normalize((match.sections ?? {}) as Record<string, unknown>),
            updatedAt: match.updated_at,
            isMockup: false,
          };
        }
      }

      const { listPublishedRoles, readRoleContent } = await import("./notion-publish.server");
      const roles = await listPublishedRoles();
      if (roles.length === 0)
        return { ok: true, role: roleTitle || null, sections: null, updatedAt: null, isMockup: false };
      const sorted = [...roles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const chosen = roleTitle ? findRoleFor(sorted, roleTitle, (r) => r.role) : sorted[0];
      if (!chosen)
        return { ok: true, role: roleTitle || null, sections: null, updatedAt: null, isMockup: false };
      const sections = await readRoleContent(chosen.role);
      return {
        ok: true,
        role: chosen.role,
        sections,
        updatedAt: chosen.updatedAt,
        isMockup: true,
      };
    } catch (error) {
      console.error("Reading live role content failed", error);
      return { ok: false, error: "notion" };
    }
  });
