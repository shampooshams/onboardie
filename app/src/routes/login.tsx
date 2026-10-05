import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/lib/i18n";
import { authErrorKey } from "@/lib/i18n/auth-errors";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    next: safeNext(search.next),
  }),
  head: () => ({
    meta: [
      { title: "Log in — Onboardie" },
      {
        name: "description",
        content:
          "Log in to Onboardie with your email and password to reach your onboarding coach, learning plan and role content.",
      },
      { property: "og:title", content: "Log in — Onboardie" },
      {
        property: "og:description",
        content: "Log in to Onboardie, your AI onboarding coach.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { next } = Route.useSearch();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setBusy(false);
      const key = authErrorKey(signInError.message);
      return setError(key ? t(key) : signInError.message);
    }
    // Land people in the portal that matches their role.
    let destination = next;
    if (destination === "/" && data.user) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      if ((roleRows ?? []).some((r) => r.role === "manager")) destination = "/manager";
    }
    setBusy(false);
    window.location.href = destination;
  }


  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{t("auth.loginTitle")}</h1>
          <LanguageSwitch />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {t("auth.loginButton")}
          </Button>
        </form>


        <Link
          to="/signup"
          search={{ next }}
          className="mt-6 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("auth.toSignup")}
        </Link>
      </div>
    </main>
  );
}
