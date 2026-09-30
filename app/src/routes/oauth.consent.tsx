import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthResult = {
  client?: { name?: string; client_id?: string; redirect_uris?: string[] } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthResult | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: Error | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search.authorization_id === "string" ? search.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { next: location.pathname + location.searchStr },
      });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  head: () => ({
    meta: [
      { title: "Authorize access — Onboardie" },
      {
        name: "description",
        content: "Approve or deny an app requesting access to your Onboardie onboarding content.",
      },
      { property: "og:title", content: "Authorize access — Onboardie" },
      {
        property: "og:description",
        content: "Approve or deny an app requesting access to your Onboardie account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="max-w-md text-sm text-destructive">
        Could not load this authorization request: {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
  component: Consent,
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an app";
  const scopes: string[] = String(details?.scope ?? "")
    .split(" ")
    .filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">
          Connect {clientName} to Onboardie
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This lets {clientName} use Onboardie as you — reading your onboarding role content and
          asking the onboarding coach on your behalf.
        </p>

        {details?.client?.redirect_uris?.[0] && (
          <p className="mt-3 break-all text-xs text-muted-foreground">
            Redirects to {details.client.redirect_uris[0]}
          </p>
        )}

        {scopes.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-foreground">
            {scopes.map((scope) => (
              <li key={scope}>
                {scope === "profile"
                  ? "Share your basic profile"
                  : scope === "email"
                    ? "Share your email address"
                    : scope === "openid"
                      ? "Confirm your identity"
                      : `Additional permission requested: ${scope}`}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          This does not bypass Onboardie&apos;s permissions or backend policies.
        </p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            Approve
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Cancel connection
          </Button>
        </div>
      </div>
    </main>
  );
}
