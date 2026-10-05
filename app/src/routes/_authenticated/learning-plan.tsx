import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { EmptyState, ErrorState, LoadingState } from "@/components/content-state";
import { groupPlan, useLiveContent } from "@/lib/live-content";
import { loadPlanDone, savePlanDone } from "@/lib/plan-progress";
import { useProfile } from "@/lib/profile";
import { useT } from "@/lib/i18n";
import { phaseLabel } from "@/lib/i18n/phase";

export const Route = createFileRoute("/_authenticated/learning-plan")({
  head: () => ({
    meta: [
      { title: "Learning Plan — Onboardie" },
      { name: "description", content: "Your 90-day onboarding roadmap." },
      { property: "og:title", content: "Learning Plan — Onboardie" },
      { property: "og:description", content: "Your 90-day onboarding roadmap." },
    ],
  }),
  component: LearningPlanPage,
});


function LearningPlanPage() {
  const { t } = useT();
  const live = useLiveContent();
  const phases = useMemo(() => groupPlan(live.lines("plan")), [live.sections]);
  const { profile } = useProfile();
  const userId = profile?.id ?? null;

  // In preview mode ticks live in a session-only, role-scoped store; a real
  // hire's own progress keeps using their user-scoped store.
  const scope = { isPreview: live.isPreview, previewRoleId: live.previewRoleId, userId };
  const [done, setDone] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!userId && !live.isPreview) return;
    setDone(loadPlanDone({ isPreview: live.isPreview, previewRoleId: live.previewRoleId, userId }));
    setHydrated(true);
  }, [live.isPreview, live.previewRoleId, userId]);

  useEffect(() => {
    if (!hydrated) return;
    savePlanDone(scope, done);
  }, [done, hydrated, live.isPreview, live.previewRoleId, userId]);


  function toggle(key: string) {
    setDone((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const allTasks = phases.flatMap((p) => p.tasks.map((task) => `${p.title}::${task}`));
  const doneCount = allTasks.filter((k) => done.includes(k)).length;
  const pct = allTasks.length ? Math.round((doneCount / allTasks.length) * 100) : 0;

  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("nav.plan")}</h1>
        <p className="mt-2 text-muted-foreground">
          {live.role ? t("plan.subtitleAs", { role: live.role }) : t("plan.subtitle")}
        </p>
      </header>

      {live.isLoading && <LoadingState label={t("plan.loading")} />}
      {live.failed && <ErrorState />}
      {!live.isLoading && !live.failed && phases.length === 0 && (
        <EmptyState section={t("plan.empty")} />
      )}

      {phases.length > 0 && (
        <>
          <section className="mb-10 rounded-2xl bg-card border border-border p-6 shadow-sm">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-sm font-medium">{t("plan.overall")}</span>
              <span className="text-sm text-muted-foreground">
                {t("plan.progress", { done: doneCount, total: allTasks.length, pct })}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </section>

          <div className="space-y-6">
            {phases.map((phase) => {
              const keys = phase.tasks.map((task) => `${phase.title}::${task}`);
              const phaseDone = keys.filter((k) => done.includes(k)).length;
              return (
                <section
                  key={phase.title}
                  className="rounded-2xl bg-card border border-border p-6 shadow-sm"
                >
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-lg font-semibold">{phaseLabel(phase.title, t)}</h2>
                    <span className="text-xs font-medium text-muted-foreground">
                      {phaseDone}/{phase.tasks.length}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {phase.tasks.map((task, i) => {
                      const key = keys[i];
                      const isDone = done.includes(key);
                      return (
                        <li key={key + i}>
                          <button
                            type="button"
                            onClick={() => toggle(key)}
                            className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted/60 transition-colors"
                          >
                            <span
                              className={
                                "mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors " +
                                (isDone
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-border")
                              }
                            >
                              {isDone && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <span
                              className={
                                isDone ? "text-muted-foreground line-through" : "text-foreground"
                              }
                            >
                              {task}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </AppLayout>
  );
}
