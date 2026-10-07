import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StructuredContent } from "./structure.functions";

const KEYS = ["overview", "plan", "faq", "tools", "contacts", "facts"] as const;

export type RoleDraft = {
  id: string;
  role: string;
  isRevision: boolean;
  /** Raw material saved before AI structuring has been run. */
  isRaw: boolean;
  updatedAt: string;
};

export type ListDraftsResult = { ok: true; drafts: RoleDraft[] } | { ok: false };
export type SaveDraftResult = { ok: true; id: string } | { ok: false; error: "no_company" | "db" };
export type LoadDraftResult =
  | { ok: true; draft: (RoleDraft & { sections: StructuredContent; raw: string }) | null }
  | { ok: false };

function normalizeSections(raw: Record<string, unknown>): StructuredContent {
  const sections = {} as StructuredContent;
  for (const key of KEYS) {
    const value = raw[key];
    sections[key] = Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
  }
  return sections;
}

/** Raw material is stored alongside the sections under a reserved "raw" key. */
function rawOf(sections: unknown): string {
  const value = (sections as { raw?: unknown } | null)?.raw;
  return typeof value === "string" ? value : "";
}

function isRawOnly(sections: unknown): boolean {
  const normalized = normalizeSections((sections ?? {}) as Record<string, unknown>);
  const hasStructured = KEYS.some((k) => normalized[k].length > 0);
  return !hasStructured && rawOf(sections).trim().length > 0;
}

function validateSave(input: unknown): { role: string; sections: StructuredContent } {
  const data = input as { role?: unknown; sections?: unknown };
  if (typeof data?.role !== "string" || !data.role.trim()) throw new Error("role is required");
  return {
    role: data.role.trim(),
    sections: normalizeSections((data?.sections ?? {}) as Record<string, unknown>),
  };
}

function validateId(input: unknown): { id: string } {
  const data = input as { id?: unknown };
  if (typeof data?.id !== "string" || !data.id.trim()) throw new Error("id is required");
  return { id: data.id.trim() };
}

/** Stores raw pasted/uploaded material so the manager can structure it later. */
export const saveRawRoleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = input as { role?: unknown; content?: unknown };
    if (typeof data?.role !== "string" || !data.role.trim()) throw new Error("role is required");
    if (typeof data?.content !== "string" || !data.content.trim())
      throw new Error("content is required");
    return { role: data.role.trim(), content: data.content };
  })
  .handler(async ({ data, context }): Promise<SaveDraftResult> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId) return { ok: false, error: "no_company" };

      const { data: row, error } = await context.supabase
        .from("role_drafts")
        .upsert(
          {
            company_id: companyId,
            role: data.role,
            sections: { raw: data.content } as unknown as never,
            is_revision: false,
            created_by: context.userId,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "company_id,role" },
        )
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { ok: true, id: (row?.id as string) ?? "" };
    } catch (error) {
      console.error("Saving raw role draft failed", error);
      return { ok: false, error: "db" };
    }
  });

/** Stores structured content that still needs a manager's approval. */
export const saveRoleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSave)
  .handler(async ({ data, context }): Promise<SaveDraftResult> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId) return { ok: false, error: "no_company" };

      // A draft for an already-published role is a pending revision.
      const { data: published } = await context.supabase
        .from("role_content")
        .select("role")
        .eq("company_id", companyId)
        .eq("role", data.role)
        .maybeSingle();

      const { data: row, error } = await context.supabase
        .from("role_drafts")
        .upsert(
          {
            company_id: companyId,
            role: data.role,
            sections: data.sections as unknown as never,
            is_revision: Boolean(published),
            created_by: context.userId,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "company_id,role" },
        )
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { ok: true, id: (row?.id as string) ?? "" };
    } catch (error) {
      console.error("Saving role draft failed", error);
      return { ok: false, error: "db" };
    }
  });

/** Every role for this company that still needs review. */
export const listRoleDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListDraftsResult> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId) return { ok: true, drafts: [] };
      const { data, error } = await context.supabase
        .from("role_drafts")
        .select("id, role, is_revision, updated_at, sections")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return {
        ok: true,
        drafts: (data ?? []).map((d) => ({
          id: d.id,
          role: d.role,
          isRevision: d.is_revision,
          isRaw: isRawOnly(d.sections),
          updatedAt: d.updated_at,
        })),
      };
    } catch (error) {
      console.error("Listing role drafts failed", error);
      return { ok: false };
    }
  });

export const loadRoleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateId)
  .handler(async ({ data, context }): Promise<LoadDraftResult> => {
    try {
      const { data: row, error } = await context.supabase
        .from("role_drafts")
        .select("id, role, is_revision, updated_at, sections")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw error;
      if (!row) return { ok: true, draft: null };
      return {
        ok: true,
        draft: {
          id: row.id,
          role: row.role,
          isRevision: row.is_revision,
          isRaw: isRawOnly(row.sections),
          updatedAt: row.updated_at,
          sections: normalizeSections((row.sections ?? {}) as Record<string, unknown>),
          raw: rawOf(row.sections),
        },
      };
    } catch (error) {
      console.error("Loading role draft failed", error);
      return { ok: false };
    }
  });

/** Called after a successful publish so the role leaves the review list. */
export const deleteRoleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = input as { role?: unknown };
    if (typeof data?.role !== "string" || !data.role.trim()) throw new Error("role is required");
    return { role: data.role.trim() };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId) return { ok: true };
      const { error } = await context.supabase
        .from("role_drafts")
        .delete()
        .eq("company_id", companyId)
        .eq("role", data.role);
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      console.error("Deleting role draft failed", error);
      return { ok: false };
    }
  });
