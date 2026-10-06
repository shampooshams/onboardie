import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { listRoles } from "@/lib/publish.functions";
import { AppLayout } from "@/components/app-layout";
import { QuestionTopicsCard } from "@/components/question-topics-card";
import { CompanyUpdateEditor } from "@/components/company-update-editor";
import { InviteCodeCard } from "@/components/invite-code-card";
import { TeamCard } from "@/components/team-card";
import { useT } from "@/lib/i18n";

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

function ManagerDashboard() {
  const { t } = useT();
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
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("nav.manager")}</h1>
          <p className="mt-2 text-muted-foreground">{t("mgr.subtitle")}</p>
        </div>
        <Link
          to="/upload-content"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Upload className="h-4 w-4" />
          {t("nav.upload")}
        </Link>
      </header>

      <InviteCodeCard />

      <TeamCard />

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-1">{t("mgr.roles")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t("mgr.rolesHint")}</p>
        {rolesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("mgr.loadingRoles")}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {companyRoles.length === 0 && (
              <div className="rounded-2xl bg-card border border-dashed border-border p-5 shadow-sm">
                <h3 className="font-semibold text-sm">{t("mgr.noRoles")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t("mgr.noRolesBody")}</p>
                <Link
                  to="/upload-content"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Upload className="h-4 w-4" />
                  {t("nav.upload")}
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
                    {t("mgr.live")}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{t("mgr.companyContent")}</p>
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
                    {t("mgr.mockupRole")}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{t("mgr.exampleContent")}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10 grid gap-4 md:grid-cols-2">
        <QuestionTopicsCard />
        <CompanyUpdateEditor />
      </section>
    </AppLayout>
  );
}
