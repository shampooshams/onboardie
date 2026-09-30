import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const Route = createFileRoute("/signup")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    next: safeNext(search.next),
  }),
  head: () => ({
    meta: [
      { title: "Create your account — Onboardie" },
      {
        name: "description",
        content:
          "Sign up for Onboardie with your email address to get a personal onboarding coach, learning plan and role content.",
      },
      { property: "og:title", content: "Create your account — Onboardie" },
      {
        property: "og:description",
        content: "Create your Onboardie account and start onboarding.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { next } = Route.useSearch();
  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [appRole, setAppRole] = useState<"new_hire" | "manager">("new_hire");
  const [startDate, setStartDate] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + next,
        data: {
          full_name: fullName,
          role_title: roleTitle,
          app_role: appRole,
          invite_code: inviteCode.trim(),
          start_date: appRole === "new_hire" ? startDate : "",
        },
      },
    });
    setBusy(false);
    if (signUpError) return setError(signUpError.message);
    if (data.session) {
      window.location.href = appRole === "manager" ? "/manager" : "/";
      return;
    }
    return setMessage("Check your email to confirm your account, then log in.");
  }


  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access your onboarding coach and role content.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              required
              autoComplete="name"
              placeholder="Alex Weber"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleTitle">Job title</Label>
            <Input
              id="roleTitle"
              required
              placeholder="Sales Development Representative"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>I am a</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "new_hire", label: "New Hire" },
                  { value: "manager", label: "Manager" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={appRole === option.value}
                  onClick={() => setAppRole(option.value)}
                  className={
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors " +
                    (appRole === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {appRole === "new_hire" && (
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your first working day — we use it to count your 90 days.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="inviteCode">Company / Invite code (optional)</Label>
            <Input
              id="inviteCode"
              placeholder="ONB-XXXXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">
              Got a code from your manager? Enter it to join their company. Leave it empty to be
              grouped by your email address.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            Sign up
          </Button>
        </form>


        <Link
          to="/login"
          search={{ next }}
          className="mt-6 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Already have an account? Log in
        </Link>
      </div>
    </main>
  );
}
