import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({ next: safeNext(search.next) }),
  head: () => ({
    meta: [
      { title: "Signing you in — Onboardie" },
      { name: "description", content: "Completing sign-in to Onboardie." },
      { property: "og:title", content: "Signing you in — Onboardie" },
      { property: "og:description", content: "Completing sign-in to Onboardie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Callback,
});

function Callback() {
  const { next } = Route.useSearch();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        window.location.href = next;
        return;
      }
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) window.location.href = next;
      });
      setTimeout(() => {
        if (!cancelled) setFailed(true);
        sub.subscription.unsubscribe();
      }, 8000);
    }
    void go();
    return () => {
      cancelled = true;
    };
  }, [next]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">
        {failed ? "Sign-in did not complete. Please try again." : "Signing you in…"}
      </p>
    </main>
  );
}
