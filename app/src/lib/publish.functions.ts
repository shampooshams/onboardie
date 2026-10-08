import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StructuredContent } from "./structure.functions";

const KEYS = ["overview", "plan", "faq", "tools", "contacts", "facts"] as const;

export type RoleSource = "company" | "mockup";

export type PublishResult = { ok: true } | { ok: false; error: "notion" | "no_company" | "not_manager" };
export type LoadRoleResult =
  | { ok: true; sections: StructuredContent | null }
  | { ok: false; error: "notion" };
export type PublishedRole = {
  role: string;
  updatedAt: string;
  source: RoleSource;
  /** role_content record id — only present for the company's own roles. */
  id?: string;
};
export type ListRolesResult =
  | { ok: true; roles: PublishedRole[]; mockups: PublishedRole[] }
  | { ok: false; error: "notion" };

function normalizeSections(raw: Record<string, unknown>): StructuredContent {
  const sections = {} as StructuredContent;
  for (const key of KEYS) {
    const value = raw[key];
    sections[key] = Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
  }
  return sections;
}

function validatePublish(input: unknown): {
  role: string;
  sections: StructuredContent;
  source: string;
} {
  const data = input as { role?: unknown; sections?: unknown; source?: unknown };
  const role =
    typeof data?.role === "string" && data.role.trim() ? data.role.trim() : "New hire role";
  return {
    role,
    sections: normalizeSections((data?.sections ?? {}) as Record<string, unknown>),
    source: typeof data?.source === "string" ? data.source.slice(0, 300_000) : "",
  };
}

function validateRole(input: unknown): { role: string; source: RoleSource } {
  const data = input as { role?: unknown; source?: unknown };
  if (typeof data?.role !== "string" || !data.role.trim()) throw new Error("role is required");
  return { role: data.role.trim(), source: data.source === "mockup" ? "mockup" : "company" };
}

/** Saves role content for the signed-in manager's own company. Mockup roles are never overwritten. */
export const publishRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validatePublish)
  .handler(async ({ data, context }): Promise<PublishResult> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId) return { ok: false, error: "no_company" };

      // The original notes are stored under a reserved "raw" key for the coach.
      // Editing a published role without a new upload keeps the notes it had.
      let raw = data.source;
      if (!raw.trim()) {
        const { data: existing } = await context.supabase
          .from("role_content")
          .select("sections")
          .eq("company_id", companyId)
          .eq("role", data.role)
          .maybeSingle();
        const previous = (existing?.sections as { raw?: unknown } | null)?.raw;
        raw = typeof previous === "string" ? previous : "";
      }

      const { error } = await context.supabase.from("role_content").upsert(
        {
          company_id: companyId,
          role: data.role,
          sections: (raw ? { ...data.sections, raw } : data.sections) as unknown as never,
          created_by: context.userId,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "company_id,role" },
      );
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      console.error("Saving role content failed", error);
      return { ok: false, error: "notion" };
    }
  });

export type DeleteRoleResult = { ok: true } | { ok: false; error: "not_manager" | "db" };

/**
 * Manager-only: removes one of the company's published roles (and any pending
 * draft for it). New hires with that job title then see no role content until
 * it is uploaded again.
 */
export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = input as { id?: unknown };
    if (typeof data?.id !== "string" || !data.id.trim()) throw new Error("id is required");
    return { id: data.id.trim() };
  })
  .handler(async ({ data, context }): Promise<DeleteRoleResult> => {
    try {
      const { companyIdFor, isManager } = await import("./company.server");
      const [companyId, manager] = await Promise.all([
        companyIdFor(context.supabase, context.userId),
        isManager(context.supabase, context.userId),
      ]);
      if (!manager || !companyId) return { ok: false, error: "not_manager" };

      const { data: removed, error } = await context.supabase
        .from("role_content")
        .delete()
        .eq("id", data.id)
        .eq("company_id", companyId)
        .select("role");
      if (error) throw error;

      const role = (removed?.[0] as { role?: string } | undefined)?.role;
      if (role) {
        await context.supabase
          .from("role_drafts")
          .delete()
          .eq("company_id", companyId)
          .eq("role", role);
      }
      return { ok: true };
    } catch (error) {
      console.error("Deleting role failed", error);
      return { ok: false, error: "db" };
    }
  });

/** Reads back one role: either the company's own content, or a read-only mockup role. */
export const loadPublishedRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRole)
  .handler(async ({ data, context }): Promise<LoadRoleResult> => {
    try {
      if (data.source === "mockup") {
        const { readRoleContent } = await import("./notion-publish.server");
        const sections = await readRoleContent(data.role);
        return { ok: true, sections: sections as StructuredContent | null };
      }
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId) return { ok: true, sections: null };
      const { data: row, error } = await context.supabase
        .from("role_content")
        .select("sections")
        .eq("company_id", companyId)
        .eq("role", data.role)
        .maybeSingle();
      if (error) throw error;
      if (!row) return { ok: true, sections: null };
      return {
        ok: true,
        sections: normalizeSections((row.sections ?? {}) as Record<string, unknown>),
      };
    } catch (error) {
      console.error("Reading role content failed", error);
      return { ok: false, error: "notion" };
    }
  });

/** Lists the company's own roles plus the shared, read-only mockup roles. */
export const listRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListRolesResult> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);

      let roles: PublishedRole[] = [];
      if (companyId) {
        const { data, error } = await context.supabase
          .from("role_content")
          .select("id, role, updated_at")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        roles = (data ?? []).map((r) => ({
          id: r.id,
          role: r.role,
          updatedAt: r.updated_at,
          source: "company" as const,
        }));
      }

      let mockups: PublishedRole[] = [];
      try {
        const { listPublishedRoles } = await import("./notion-publish.server");
        mockups = (await listPublishedRoles()).map((r) => ({ ...r, source: "mockup" as const }));
      } catch (error) {
        console.error("Listing mockup roles failed", error);
      }

      return { ok: true, roles, mockups };
    } catch (error) {
      console.error("Listing roles failed", error);
      return { ok: false, error: "notion" };
    }
  });
