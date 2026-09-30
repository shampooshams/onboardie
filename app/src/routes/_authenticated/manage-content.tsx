import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Upload, CheckCircle2, Loader2, AlertTriangle, Sparkles, Eye } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { listRoles } from "@/lib/publish.functions";
import { usePreviewRole } from "@/lib/preview";

export const Route = createFileRoute("/_authenticated/manage-content")({
  head: () => ({
    meta: [
      { title: "Manage Content — Onboardie" },
      { name: "description", content: "Manage published role content." },
      { property: "og:title", content: "Manage Content — Onboardie" },
      { property: "og:description", content: "Manage published role content." },
    ],
  }),
  component: ManageContentPage,
});

function formatDate(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `today, ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    : date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function ManageContentPage() {
  const fetchRoles = useServerFn(listRoles);
  const navigate = useNavigate();
  const { start: startPreview } = usePreviewRole();
  const { data, isLoading } = useQuery({
    queryKey: ["published-roles"],
    queryFn: () => fetchRoles(),
    staleTime: 0,
  });

  const roles = data?.ok ? data.roles : [];
  const mockups = data?.ok ? data.mockups : [];
  const failed = data && !data.ok;

  return (
    <AppLayout>
      <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Manage Content</h1>
          <p className="mt-2 text-muted-foreground">
            Published role content that new hires can see today.
          </p>
        </div>
        <Link
          to="/upload-content"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Upload className="h-4 w-4" />
          Upload new role
        </Link>
      </header>

      {failed && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>We couldn't load your published content right now — please try again shortly.</span>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Your company's roles</h2>
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading roles...
          </div>
        ) : roles.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              You haven't added any roles yet. The mockup roles below are examples from Onboardie —
              upload your first role to get started. Only your own company can see what you upload.
            </p>
            <Link
              to="/upload-content"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              <Upload className="h-4 w-4" />
              Upload Role Content
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {roles.map((r) => (
              <div key={r.role} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{r.role}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      Live
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Last updated {formatDate(r.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.id && (
                    <button
                      type="button"
                      onClick={() => {
                        startPreview({ id: r.id!, role: r.role });
                        void navigate({ to: "/" });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-manager/40 bg-manager/10 px-3 py-2 text-sm font-medium text-manager hover:border-manager/60 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview as new hire
                    </button>
                  )}
                  <Link
                    to="/review-approve"
                    search={{ role: r.role, source: "company" }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mockups.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-10 mb-1">Mockup roles</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Example content from Onboardie, shared with every account so you can see how a finished
            role looks. Open one to use it as a starting point — saving keeps a copy under your own
            company and never changes the example.
          </p>
          <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden divide-y divide-border">
            {mockups.map((r) => (
              <div key={r.role} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{r.role}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                      <Sparkles className="h-3 w-3" />
                      Mockup role
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Example content · view only</p>
                </div>
                <Link
                  to="/review-approve"
                  search={{ role: r.role, source: "mockup" }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}
