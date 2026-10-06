import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findRoleFor } from "./role-match";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  accountType: "manager" | "new_hire";
  jobTitle: string;
  startDate: string | null;
  joinedAt: string;
  /** The published role this person's job title maps to, or null when none does. */
  matchedRole: string | null;
};

export type TeamResult =
  { ok: true; members: TeamMember[]; roles: string[] } | { ok: false; error: "not_manager" | "db" };

/**
 * Manager-only: everyone who has signed up in the manager's company, and which
 * published role (if any) each person's job title maps to. Profiles are private
 * to their owner, so this reads them with the service role after checking that
 * the caller is a manager of that same company.
 */
export const getTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamResult> => {
    try {
      const { companyIdFor, isManager } = await import("./company.server");
      const [companyId, manager] = await Promise.all([
        companyIdFor(context.supabase, context.userId),
        isManager(context.supabase, context.userId),
      ]);
      if (!manager) return { ok: false, error: "not_manager" };
      if (!companyId) return { ok: true, members: [], roles: [] };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: profiles, error: profilesError }, { data: roleRows, error: rolesError }] =
        await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("id, full_name, email, role_title, start_date, created_at")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),
          supabaseAdmin
            .from("role_content")
            .select("role")
            .eq("company_id", companyId)
            .order("role"),
        ]);
      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const ids = (profiles ?? []).map((p) => p.id);
      const { data: accountRows, error: accountError } = ids.length
        ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [], error: null };
      if (accountError) throw accountError;
      const managers = new Set(
        (accountRows ?? []).filter((r) => r.role === "manager").map((r) => r.user_id),
      );

      const roles = (roleRows ?? []).map((r) => r.role);
      const members: TeamMember[] = (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name?.trim() || "",
        email: p.email ?? "",
        accountType: managers.has(p.id) ? "manager" : "new_hire",
        jobTitle: p.role_title?.trim() ?? "",
        startDate: p.start_date,
        joinedAt: p.created_at,
        matchedRole: p.role_title ? (findRoleFor(roles, p.role_title, (r) => r) ?? null) : null,
      }));
      // New hires first (they are who the overview is for), newest sign-ups on top.
      members.sort((a, b) =>
        a.accountType === b.accountType ? 0 : a.accountType === "new_hire" ? -1 : 1,
      );
      return { ok: true, members, roles };
    } catch (error) {
      console.error("Loading team failed", error);
      return { ok: false, error: "db" };
    }
  });
