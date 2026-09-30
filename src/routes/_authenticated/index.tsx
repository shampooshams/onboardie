import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  BookOpen,
  Users,
  HelpCircle,
  Wrench,
  ArrowRight,
  Check,
  CircleDot,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { CompanyUpdateBanner } from "@/components/company-update-banner";
import { OnboardingCalendar } from "@/components/onboarding-calendar";
import { groupPlan, shorten, useLiveContent } from "@/lib/live-content";
import { loadPlanDone } from "@/lib/plan-progress";
import { usePreviewStartDate } from "@/lib/preview";
import { useProfile } from "@/lib/profile";
import { workingDaysBetween } from "@/lib/working-days";


export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Your Onboarding Dashboard — Onboardie" },
      { name: "description", content: "Your personal onboarding dashboard." },
      { property: "og:title", content: "Your Onboarding Dashboard — Onboardie" },
      { property: "og:description", content: "Your personal onboarding dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

/** Working days completed since the hire's start date; 0 until a start date exists. */
function workingDaysSinceStart(startDate: string | null | undefined): number {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return 0;
  const [y, m, d] = startDate.split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, d!));
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (today < start) return 0;
  return Math.max(0, Math.min(90, workingDaysBetween(start, today)));
}

const cards = [
  {
    to: "/ai-coach",
    title: "Chat with Your AI Coach",
    desc: "Ask anything, anytime. Your personal onboarding guide.",
    icon: Sparkles,
    bg: "var(--primary-soft)",
    fg: "var(--primary)",
  },
  {
    to: "/learning-plan",
    title: "Learning Plan",
    desc: "Your step-by-step path for the first 90 days.",
    icon: BookOpen,
    bg: "var(--gold-soft)",
    fg: "var(--gold)",
  },
  {
    to: "/resources",
    title: "Resources and Tools",
    desc: "Every tool you'll use, and how to use it.",
    icon: Wrench,
    bg: "var(--teal-soft)",
    fg: "var(--teal)",
  },
  {
    to: "/contacts",
    title: "Who to Contact",
    desc: "Meet the people who can help you succeed.",
    icon: Users,
    bg: "var(--coral-soft)",
    fg: "var(--coral)",
  },
  {
    to: "/role-overview",
    title: "Role Overview & Q&A",
    desc: "Understand your role, expectations, and answers.",
    icon: HelpCircle,
    bg: "var(--primary-soft)",
    fg: "var(--primary)",
  },
] as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}


function Dashboard() {
  const live = useLiveContent();
  const { profile } = useProfile();
  const [greetingText, setGreetingText] = useState("Good morning");
  useEffect(() => setGreetingText(greeting()), []);
  // Previews simulate a hypothetical start date; real hires use their own.
  const { startDate: previewStart } = usePreviewStartDate(live.previewRoleId);
  const effectiveStart = live.isPreview ? previewStart || null : profile?.start_date ?? null;
  const day = workingDaysSinceStart(effectiveStart);
  const name = profile?.full_name?.trim() || "there";
  // While previewing, the badge must show the previewed role — not the manager's
  // own registered role. A real new hire always sees their own role title.
  const role = live.isPreview
    ? live.role?.trim() || ""
    : profile?.role_title?.trim() || live.role || "";

  // Accomplished / next steps come from the ticked items in the learning plan.
  const userId = profile?.id ?? null;
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    setDone(
      loadPlanDone({ isPreview: live.isPreview, previewRoleId: live.previewRoleId, userId }),
    );
  }, [live.isPreview, live.previewRoleId, userId]);

  const { accomplished, next } = useMemo(() => {
    const tasks = groupPlan(live.lines("plan")).flatMap((p) =>
      p.tasks.map((t) => ({ key: `${p.title}::${t}`, phase: p.title, task: t })),
    );
    return {
      accomplished: tasks.filter((t) => done.includes(t.key)).slice(-4),
      next: tasks.filter((t) => !done.includes(t.key)).slice(0, 4),
    };
  }, [live.sections, done]);

  const stages = [
    { label: "30 days", target: 30, sub: "Learn & observe" },
    { label: "60 days", target: 60, sub: "Contribute" },
    { label: "90 days", target: 90, sub: "Own it" },
  ];
  const progressPct = Math.min(100, (day / 90) * 100);
  const currentStageIndex = day <= 30 ? 0 : day <= 60 ? 1 : 2;


  return (
    <AppLayout>
      {/* Company update */}
      <CompanyUpdateBanner />

      {/* Welcome */}
      <header className="mb-10 flex items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Welcome to your AI Onboarding Tool, {name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {greetingText} — everything you need for your first 90 days lives here.
          </p>
          {role && (
            <div className="mt-3">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {role}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="mb-12 grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
      {/* 30/60/90 tracker */}
      <section className="lg:col-span-7 rounded-2xl bg-card p-6 md:p-8 shadow-sm border border-border">

        <div className="flex items-center gap-5 mb-8">
          {/* radial day progress */}
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="11" stroke="var(--muted)" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="11"
                stroke="var(--primary)"
                strokeLinecap="round"
                strokeDasharray={`${(progressPct / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold leading-none">{day}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">working days</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Your 30/60/90 journey</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {effectiveStart
                ? `Working day ${day} of 90 · Week ${Math.floor(day / 5) + 1} · ${Math.round(progressPct)}% complete`
                : "Add your start date in Settings to track your 90 days"}
            </p>
            <span className="mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: "var(--gold-soft)", color: "var(--foreground)" }}>
              Learn &amp; observe phase
            </span>
          </div>
        </div>

        <div className="relative">
          {/* track */}
          <div className="absolute left-0 right-0 top-4 h-1.5 rounded-full bg-muted" />
          {/* fill */}
          <div
            className="absolute left-0 top-4 h-1.5 rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
          {/* nodes */}
          <div className="relative flex justify-between">
            {stages.map((s, i) => {
              const done = day >= s.target;
              const active = i === currentStageIndex;
              return (
                <div key={s.label} className="flex flex-col items-center text-center w-1/3">
                  <div
                    className={
                      "z-10 h-9 w-9 rounded-full flex items-center justify-center border-2 " +
                      (done
                        ? "bg-primary border-primary text-primary-foreground"
                        : active
                          ? "bg-card border-primary text-primary"
                          : "bg-card border-border text-muted-foreground")
                    }
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-semibold">{s.target}</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <div
                      className={
                        "text-sm font-medium " + (active ? "text-foreground" : "text-muted-foreground")
                      }
                    >
                      {s.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          You're in your <span className="font-medium text-foreground">Learn & observe</span> phase.
          Focus on meeting your team and completing intro modules.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border pt-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What you've accomplished
            </h3>
            <ul className="mt-3 space-y-2">
              {accomplished.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nothing ticked off yet — start with Week 1 in your learning plan.
                </li>
              )}
              {accomplished.map((item) => (
                <li key={item.key} className="flex gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="text-foreground/85">{shorten(item.task, 90)}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{item.phase}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Next steps
            </h3>
            <ul className="mt-3 space-y-2">
              {next.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  You're all caught up — nice work.
                </li>
              )}
              {next.map((item) => (
                <li key={item.key} className="flex gap-2.5 text-sm">
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="text-foreground/85">{shorten(item.task, 90)}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{item.phase}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link
              to="/learning-plan"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open your learning plan
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <div className="lg:col-span-3">
        <OnboardingCalendar workingDaysElapsed={day} startDate={effectiveStart} />
      </div>
      </div>



      {/* Quick access */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Quick access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map(({ to, title, desc, icon: Icon, bg, fg }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-2xl bg-card border border-border p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40 transition-all"
            >
              <div className="flex items-start gap-4">
                <div
                  className="h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: bg, color: fg }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
