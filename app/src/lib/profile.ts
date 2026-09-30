import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "new_hire" | "manager";

export type Profile = {
  id: string;
  full_name: string;
  role_title: string;
  email: string | null;
  start_date: string | null;
};

export type ProfileState = {
  loading: boolean;
  signedIn: boolean;
  profile: Profile | null;
  role: AppRole | null;
  reload: () => Promise<void>;
};

export function useProfile(): ProfileState {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setSignedIn(false);
      setProfile(null);
      setRole(null);
      setLoading(false);
      return;
    }
    setSignedIn(true);

    const [{ data: profileRow }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role_title, email, start_date")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    setProfile(
      profileRow
        ? (profileRow as Profile)
        : {
            id: user.id,
            full_name: (user.user_metadata?.full_name as string) ?? "",
            role_title: (user.user_metadata?.role_title as string) ?? "",
            email: user.email ?? null,
            start_date: null,
          },
    );

    const roles = (roleRows ?? []).map((r) => r.role as AppRole);
    setRole(roles.includes("manager") ? "manager" : roles[0] ?? "new_hire");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  return { loading, signedIn, profile, role, reload: load };
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}
