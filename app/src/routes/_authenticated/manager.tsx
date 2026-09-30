import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { listRoles } from "@/lib/publish.functions";
import { AppLayout } from "@/components/app-layout";
import { QuestionTopicsCard } from "@/components/question-topics-card";
import { CompanyUpdateEditor } from "@/components/company-update-editor";
import { InviteCodeCard } from "@/components/invite-code-card";

export const Route = createFileRoute("/_authenticated/manager")({
  head: () => ({
    meta: [
      { title: "Manager Dashboard — Onboardie" },
      { name: "description", content: "See onboarding progress and manage role content." },
      { property: "og:title", content: "Manager Dashboard — Onboardie" },
      { property: "og:description", content: "See onboarding progress and manage role content." },
    ],
  }),
  component: ManagerDashboard,
});

const HIRES = [
  { name: "Alex Weber", role: "Sales Development Representative", day: 14, phase: "Learn & observe" },
  { name: "Marie Schulz", role: "Sales Development Representative", day: 42, phase: "Contribute" },
  { name: "David Klein", role: "Account Executive", day: 68, phase: "Own it" },
];

function ManagerDashboard() {
  const fetchRoles = useServerFn(listRoles);
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["published-roles"],
    queryFn: () => fetchRoles(),
    staleTime: 0,
  });
  const companyRoles = rolesData?.ok ? rolesData.roles : [];
  const mockupRoles = rolesData?.ok ? rolesData.mockups : [];

  return (
    <AppLayout>
      <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Manager Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Track onboarding across your team and keep role content up to date.
          </p>
        </div>
        <Link
          to="/upload-content"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Upload className="h-4 w-4" />
          Upload Role Content
        </Link>
      </header>

      <InviteCodeCard />

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-1">Roles</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Your own roles are visible only to your company. Mockup roles are Onboardie examples,
          shared with every account.
        </p>
        {rolesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading roles...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {companyRoles.length === 0 && (
              <div className="rounded-2xl bg-card border border-dashed border-border p-5 shadow-sm">
                <h3 className="font-semibold text-sm">No roles of your own yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Upload your first role to get started — the mockup roles are there as examples.
                </p>
                <Link
                  to="/upload-content"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Upload className="h-4 w-4" />
                  Upload Role Content
                </Link>
              </div>
            )}
            {companyRoles.map((r) => (
              <Link
                key={r.role}
                to="/review-approve"
                search={{ role: r.role, source: "company" }}
                className="rounded-2xl bg-card border border-border p-5 shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">{r.role}</h3>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                    <CheckCircle2 className="h-3 w-3" />
                    Live
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Your company's content</p>
              </Link>
            ))}
            {mockupRoles.map((r) => (
              <Link
                key={r.role}
                to="/review-approve"
                search={{ role: r.role, source: "mockup" }}
                className="rounded-2xl bg-card border border-border p-5 shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">{r.role}</h3>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    Mockup role
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Example content · view only</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10 grid gap-4 md:grid-cols-2">
        <QuestionTopicsCard />
        <CompanyUpdateEditor />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">New hires onboarding (demo data)</h2>
        <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {HIRES.map((h) => {
              const pct = Math.round((h.day / 90) * 100);
              return (
                <div key={h.name} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3 md:w-64">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {h.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{h.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{h.role}</div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">
                        Day {h.day} of 90 · {h.phase}
                      </span>
                      <span className="text-xs font-medium">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
