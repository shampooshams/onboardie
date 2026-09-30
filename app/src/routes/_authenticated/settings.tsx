import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Check, Copy, Building2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { getCompanyInfo, joinCompanyByCode } from "@/lib/company.functions";
import { usePreviewRole, usePreviewStartDate } from "@/lib/preview";
import { useProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Onboardie" },
      { name: "description", content: "Manage your profile details." },
      { property: "og:title", content: "Settings — Onboardie" },
      { property: "og:description", content: "Manage your profile details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { loading, signedIn, profile, role, reload } = useProfile();
  const { preview } = usePreviewRole();
  const isPreview = Boolean(preview);
  const { startDate: previewStart, save: savePreviewStart } = usePreviewStartDate(preview?.id);
  const queryClient = useQueryClient();

  
  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPreview) {
      setFullName(profile?.full_name ?? "");
      setRoleTitle(preview?.role ?? "");
      setStartDate(previewStart);
      return;
    }
    if (!profile) return;
    setFullName(profile.full_name);
    setRoleTitle(profile.role_title);
    setStartDate(profile.start_date ?? "");
  }, [isPreview, preview?.role, previewStart, profile]);

  async function handleSave() {
    // Preview: the hypothetical start date is stored only for this preview
    // session and never written to any profile.
    if (isPreview) {
      savePreviewStart(startDate);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return;
    }
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: saveError } = await supabase.from("profiles").upsert({
      id: profile.id,
      full_name: fullName,
      role_title: roleTitle,
      email: profile.email,
      start_date: startDate === "" ? null : startDate,
    });
    setSaving(false);
    if (saveError) {
      setError("We couldn't save your changes — please try again.");
      return;
    }
    setSaved(true);
    // A new role title means every content page must refetch, not reuse cache.
    await queryClient.invalidateQueries({ queryKey: ["live-content"] });
    await reload();
    setTimeout(() => setSaved(false), 3000);
  }


  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          {isPreview
            ? "Preview mode — set a start date to see how the 90-day journey would look."
            : "Your profile details."}
        </p>
      </header>

      <section className="mb-6 rounded-2xl bg-card border border-border p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Profile</h2>
          {role && !isPreview && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {role === "manager" ? "Manager account" : "New hire account"}
            </span>
          )}
        </div>

        {loading && !isPreview ? (
          <p className="text-sm text-muted-foreground">Loading your profile…</p>
        ) : !signedIn ? (
          <p className="text-sm text-muted-foreground">
            You're not signed in.{" "}
            <a href="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </a>{" "}
            to manage your profile.
          </p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
               <Field label="Full name" value={fullName} onChange={setFullName} readOnly={isPreview} />
               <Field label="Role" value={roleTitle} onChange={setRoleTitle} readOnly={isPreview} />
               <Field label="Start date" type="date" value={startDate} onChange={setStartDate} />
               <Field label="Email" value={profile?.email ?? ""} readOnly />
            </div>

             <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-sm text-primary">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
             </div>
          </>
        )}
      </section>

      {!isPreview && signedIn && <CompanyCard />}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </AppLayout>
  );
}

/**
 * Company grouping. Entering an invite code moves this account into that company,
 * whatever its email domain. Without a code, email-domain grouping stays in charge.
 */
function CompanyCard() {
  const fetchInfo = useServerFn(getCompanyInfo);
  const join = useServerFn(joinCompanyByCode);
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["company-info"],
    queryFn: () => fetchInfo(),
    staleTime: 0,
  });
  const info = data?.ok ? data : null;

  async function handleJoin() {
    setMessage(null);
    setFailed(null);
    if (!code.trim()) return;
    setJoining(true);
    const result = await join({ data: { code } });
    setJoining(false);
    if (!result.ok) {
      setFailed(
        result.error === "not_found"
          ? "That code doesn't match any company — check it with whoever shared it."
          : "We couldn't join that company right now — please try again.",
      );
      return;
    }
    setCode("");
    setMessage(`You're now part of ${result.companyName}.`);
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ["live-content"] });
    await queryClient.invalidateQueries({ queryKey: ["published-roles"] });
  }

  return (
    <section className="mb-6 rounded-2xl bg-card border border-border p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Company / Invite Code</h2>
      </div>

      {info?.companyName && (
        <p className="mb-4 text-sm text-muted-foreground">
          You're currently in <span className="font-medium text-foreground">{info.companyName}</span>.
        </p>
      )}

      {info?.inviteCode && (
        <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Your company invite code — share it with your team so they join your company, whatever
            their email address.
          </p>
          <div className="flex items-center gap-3">
            <code className="rounded-lg bg-background border border-border px-3 py-2 text-sm font-semibold tracking-wider">
              {info.inviteCode}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(info.inviteCode ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <label htmlFor="invite-code" className="block text-xs font-medium text-muted-foreground mb-1.5">
        Join a company with an invite code
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ONB-XXXXXX"
          className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void handleJoin()}
          disabled={joining || code.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:border-primary/40 disabled:opacity-40 transition-colors"
        >
          {joining && <Loader2 className="h-4 w-4 animate-spin" />}
          {joining ? "Joining…" : "Join company"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Leave this empty to stay grouped by your email address, as before.
      </p>
      {message && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary">
          <Check className="h-4 w-4" /> {message}
        </p>
      )}
      {failed && <p className="mt-3 text-sm text-destructive">{failed}</p>}
    </section>
  );
}


function Field({
  label,
  value,
  onChange,
  readOnly,
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  type?: string;
}) {
  const id = "field-" + label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={
          "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary " +
          (readOnly ? "bg-muted/40 text-muted-foreground" : "bg-background")
        }
      />
    </div>
  );
}
