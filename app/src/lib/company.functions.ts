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
