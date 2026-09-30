import type { SupabaseClient } from "@supabase/supabase-js";

/** Reads the signed-in user's company id. Every content read/write is scoped by it. */
export async function companyIdFor(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.company_id as string | null) ?? null;
}

export async function isManager(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).some((r) => (r as { role: string }).role === "manager");
}
