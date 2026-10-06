import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CompanyInfo = {
  ok: true;
  companyName: string | null;
  inviteCode: string | null;
  isManager: boolean;
};

export type CompanyInfoResult = CompanyInfo | { ok: false };
export type JoinResult =
  | { ok: true; companyName: string }
  | { ok: false; error: "not_found" | "db" };

/** The caller's own company name plus its invite code (used by managers to share it). */
export const getCompanyInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyInfoResult> => {
    try {
      const { isManager } = await import("./company.server");
      const [{ data, error }, manager] = await Promise.all([
        context.supabase.rpc("my_company_invite"),
        isManager(context.supabase, context.userId),
      ]);
      if (error) throw error;
      const row = (data ?? [])[0];
      return {
        ok: true,
        companyName: row?.company_name ?? null,
        inviteCode: row?.invite_code ?? null,
        isManager: manager,
      };
    } catch (error) {
      console.error("Reading company info failed", error);
      return { ok: false };
    }
  });

/** Regroups the signed-in account into the company that owns the given invite code. */
export const joinCompanyByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = input as { code?: unknown };
    if (typeof data?.code !== "string" || !data.code.trim()) throw new Error("code is required");
    return { code: data.code.trim() };
  })
  .handler(async ({ data, context }): Promise<JoinResult> => {
    try {
      const { data: rows, error } = await context.supabase.rpc("join_company_by_code", {
        _code: data.code,
      });
      if (error) throw error;
      const row = (rows ?? [])[0];
      if (!row) return { ok: false, error: "not_found" };
      return { ok: true, companyName: row.company_name ?? "your company" };
    } catch (error) {
      console.error("Joining company by code failed", error);
      return { ok: false, error: "db" };
    }
  });

export type InviteLookupResult =
  | { ok: true; companyName: string; roles: string[] }
  | { ok: false; error: "not_found" | "db" };

/**
 * Sign-up helper: the company name and published role names behind an invite
 * code, so a new hire can confirm the company and pick their role. Works before
 * sign-in; codes are random (one in ~10⁹), so a code is the permission to see this.
 */
export const lookupInviteCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const data = input as { code?: unknown };
    const code = typeof data?.code === "string" ? data.code.replace(/\s+/g, "").toUpperCase() : "";
    if (!/^ONB-[A-Z0-9]{6}$/.test(code)) throw new Error("invalid invite code");
    return { code };
  })
  .handler(async ({ data }): Promise<InviteLookupResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: company, error } = await supabaseAdmin
        .from("companies")
        .select("id, name")
        .eq("invite_code", data.code)
        .maybeSingle();
      if (error) throw error;
      if (!company) return { ok: false, error: "not_found" };
      const { data: rows, error: rolesError } = await supabaseAdmin
        .from("role_content")
        .select("role")
        .eq("company_id", company.id)
        .order("role");
      if (rolesError) throw rolesError;
      return { ok: true, companyName: company.name, roles: (rows ?? []).map((r) => r.role) };
    } catch (error) {
      console.error("Looking up invite code failed", error);
      return { ok: false, error: "db" };
    }
  });

/** Published role names in the caller's own company, for the role picker in Settings. */
export const listCompanyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; roles: string[] } | { ok: false }> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId) return { ok: true, roles: [] };
      const { data, error } = await context.supabase
        .from("role_content")
        .select("role")
        .eq("company_id", companyId)
        .order("role");
      if (error) throw error;
      return { ok: true, roles: (data ?? []).map((r) => r.role) };
    } catch (error) {
      console.error("Listing company roles failed", error);
      return { ok: false };
    }
  });
