import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/lib/i18n";
import { authErrorKey } from "@/lib/i18n/auth-errors";
import { lookupInviteCode } from "@/lib/company.functions";
import { RolePicker } from "@/components/role-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Same look as the shadcn Input, for the role list and its free-text field. */
const FIELD_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm";

const INVITE_CODE = /^ONB-[A-Z0-9]{6}$/;

type InviteState =
  | { status: "idle" | "checking" | "not_found" }
  | { status: "found"; companyName: string; roles: string[] };

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
  const { t } = useT();
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
  const [invite, setInvite] = useState<InviteState>({ status: "idle" });
  const lookup = useServerFn(lookupInviteCode);

  // Once a complete code is typed, show which company it belongs to and offer
  // that company's published roles as the job-title list.
  useEffect(() => {
    const code = inviteCode.replace(/\s+/g, "");
    if (!INVITE_CODE.test(code)) {
      setInvite({ status: "idle" });
      return;
    }
    let active = true;
    setInvite({ status: "checking" });
    const timer = setTimeout(() => {
      lookup({ data: { code } })
        .then((result) => {
          if (!active) return;
          setInvite(
            result.ok
              ? { status: "found", companyName: result.companyName, roles: result.roles }
              : { status: result.error === "not_found" ? "not_found" : "idle" },
          );
        })
        .catch(() => active && setInvite({ status: "idle" }));
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [inviteCode, lookup]);

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
    if (signUpError) {
      const key = authErrorKey(signUpError.message);
      return setError(key ? t(key) : signUpError.message);
    }
    if (data.session) {
      window.location.href = appRole === "manager" ? "/manager" : "/";
      return;
    }
    return setMessage(t("auth.checkEmail"));
  }


  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{t("auth.signupTitle")}</h1>
          <LanguageSwitch />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("auth.fullName")}</Label>
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
            <Label>{t("auth.iAm")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "new_hire", label: t("auth.newHire") },
                  { value: "manager", label: t("auth.manager") },
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
            <Label htmlFor="inviteCode">{t("auth.inviteCode")}</Label>
            <Input
              id="inviteCode"
              placeholder="ONB-XXXXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            />
            {invite.status === "checking" && (
              <p className="text-xs text-muted-foreground">{t("invite.checking")}</p>
            )}
            {invite.status === "found" && (
              <p className="text-xs font-medium text-primary">
                {t("invite.joining", { company: invite.companyName })}
              </p>
            )}
            {invite.status === "not_found" && (
              <p className="text-xs text-destructive">{t("invite.notFound")}</p>
            )}
            {invite.status === "idle" && (
              <p className="text-xs text-muted-foreground">{t("auth.inviteHint")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleTitle">{t("auth.jobTitle")}</Label>
            <RolePicker
              id="roleTitle"
              required
              roles={appRole === "new_hire" && invite.status === "found" ? invite.roles : []}
              placeholder="Sales Development Representative"
              value={roleTitle}
              onChange={setRoleTitle}
              className={FIELD_CLASS}
            />
          </div>
          {appRole === "new_hire" && (
            <div className="space-y-2">
              <Label htmlFor="startDate">{t("auth.startDate")}</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("auth.startDateHint")}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
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
            {t("auth.signupButton")}
          </Button>
        </form>


        <Link
          to="/login"
          search={{ next }}
          className="mt-6 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("auth.toLogin")}
        </Link>
      </div>
    </main>
  );
}
