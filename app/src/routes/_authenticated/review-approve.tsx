import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Info,
  Loader2,
  AlertTriangle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { loadStructuredDraft, saveStructuredDraft } from "@/lib/structured-draft";
import { publishRole, loadPublishedRole } from "@/lib/publish.functions";
import { deleteRoleDraft, listRoleDrafts, loadRoleDraft } from "@/lib/drafts.functions";
import { useServerFn } from "@tanstack/react-start";
import { useT, type MessageKey } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/review-approve")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { role?: string; source?: "company" | "mockup"; draft?: string } => ({
    ...(typeof search.role === "string" ? { role: search.role } : {}),
    ...(typeof search.draft === "string" ? { draft: search.draft } : {}),
    ...(search.source === "mockup" || search.source === "company"
      ? { source: search.source as "company" | "mockup" }
      : {}),
  }),

  head: () => ({
    meta: [
      { title: "Review & Approve — Onboardie" },
      { name: "description", content: "Review and approve structured role content." },
      { property: "og:title", content: "Review & Approve — Onboardie" },
      { property: "og:description", content: "Review and approve structured role content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewApprovePage,
});

type Section = {
  id: "overview" | "plan" | "faq" | "tools" | "contacts";
  /** Translation keys; the items themselves are role content and stay as written. */
  title: MessageKey;
  description: MessageKey;
  items: string[];
};

const INITIAL: Section[] = [
  {
    id: "overview",
    title: "section.overview",
    description: "section.overviewDesc",
    items: [
      "SDRs run outbound prospecting into DACH mid-market accounts.",
      "Success at 30 days: onboarded on CRM & playbook, first 3 discovery meetings booked.",
      "Success at 90 days: 100% of qualified-meeting quota, owns 50-account target list.",
    ],
  },
  {
    id: "plan",
    title: "section.plan",
    description: "section.planDesc",
    items: [
      "Week 1: CRM access, ICP training, shadow 3 outreach calls.",
      "Week 2: read outbound playbook, draft first 5 email sequences.",
      "Month 1: book first 3 discovery meetings, log all leads with source.",
      "Month 2: 60% of qualified-meeting quota, own 50-account target list.",
      "Month 3: 100% of quota, present territory plan to sales team.",
    ],
  },
  {
    id: "faq",
    title: "section.faq",
    description: "section.faqDesc",
    items: [
      "What counts as a qualified lead? — ICP fit + confirmed pain + decision-maker on a discovery call.",
      "How many outbound touches per day? — 60 personalized touches across email, LinkedIn, and phone.",
      "When do I hand a lead to an AE? — After a successful discovery call with BANT confirmed.",
    ],
  },
  {
    id: "tools",
    title: "section.tools",
    description: "section.toolsDesc",
    items: [
      "HubSpot CRM — pipeline, leads, activities.",
      "LinkedIn Sales Navigator — prospecting and account research.",
      "Gong — call recordings and coaching.",
      "Slack — #sales-team, #handoff, #wins channels.",
    ],
  },
  {
    id: "contacts",
    title: "section.contacts",
    description: "section.contactsDesc",
    items: [
      "Julia Hoffmann — Sales Manager (coaching, escalations).",
      "Markus Braun — Sales Engineer (product & technical).",
      "Sophia Klein — Senior Account Executive (deal strategy).",
      "Nina Vogel — Deal Desk (pricing & contracts).",
    ],
  },
];

const DEFAULT_ROLE = "Sales Development Representative";

function formatDate(
  iso: string,
  t: ReturnType<typeof useT>["t"],
  locale: string,
) {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? t("review.today", {
        time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
      })
    : date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function ReviewApprovePage() {
  const { role: roleParam, source: sourceParam, draft: draftParam } = Route.useSearch();
  const showOverview = !roleParam && !draftParam;
  return showOverview ? <PendingList /> : <ReviewDetail />;
}

/** Overview of every role that still needs the manager's approval. */
function PendingList() {
  const { t, locale } = useT();
  const fetchDrafts = useServerFn(listRoleDrafts);
  const removeDraft = useServerFn(deleteRoleDraft);
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["role-drafts"],
    queryFn: () => fetchDrafts(),
    staleTime: 0,
  });

  const drafts = data?.ok ? data.drafts : [];
  const failed = data && !data.ok;

  async function handleDelete(role: string, id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const result = await removeDraft({ data: { role } });
      if (!result.ok) {
        setDeleteError(t("review.deleteFailed"));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["role-drafts"] });
    } catch {
      setDeleteError(t("review.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }
  

  return (
    <AppLayout>
      <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("nav.review")}</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">{t("review.listIntro")}</p>
        </div>
        <Link
          to="/upload-content"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Upload className="h-4 w-4" />
          {t("review.uploadNew")}
        </Link>
      </header>

      {failed && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{t("review.listFailed")}</span>
        </div>
      )}

      {deleteError && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{deleteError}</span>
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("review.loadingList")}
          </div>
        ) : drafts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-semibold">{t("review.nothing")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("review.nothingBody")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="p-5 flex flex-col md:flex-row md:items-center gap-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{d.role}</h3>
                    {d.isRaw ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                        <FileText className="h-3 w-3" />
                        {t("review.statusRaw")}
                      </span>
                    ) : d.isRevision ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.62_0.15_45)]/10 text-[oklch(0.62_0.15_45)] px-2 py-0.5 text-xs font-medium">
                        <RefreshCw className="h-3 w-3" />
                        {t("review.statusRevised")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                        <Pencil className="h-3 w-3" />
                        {t("review.statusDraft")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(d.isRaw ? "review.lastSaved" : "review.lastStructured", {
                      date: formatDate(d.updatedAt, t, locale),
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline">
                    <Link
                      to={d.isRaw ? "/upload-content" : "/review-approve"}
                      search={{ draft: d.id }}
                    >
                      {d.isRaw ? t("review.resume") : t("review.review")}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  {d.isRaw && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingId === d.id}
                        >
                          {deletingId === d.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          {t("review.delete")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("review.deleteTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("review.deleteBody", { role: d.role })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("review.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void handleDelete(d.role, d.id)}
                          >
                            {t("review.deleteDraft")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function ReviewDetail() {
  const { t } = useT();
  const navigate = useNavigate();
  const { role: roleParam, source: sourceParam, draft: draftParam } = Route.useSearch();
  const [sections, setSections] = useState<Section[]>(INITIAL);
  const [role, setRole] = useState<string>(roleParam ?? DEFAULT_ROLE);
  const [loadingLive, setLoadingLive] = useState(Boolean(roleParam || draftParam));
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const runPublish = useServerFn(publishRole);
  const runLoad = useServerFn(loadPublishedRole);
  const runLoadDraft = useServerFn(loadRoleDraft);
  const runDeleteDraft = useServerFn(deleteRoleDraft);

  // A specific pending draft chosen from the overview list.
  useEffect(() => {
    if (!draftParam) return;
    let active = true;
    void (async () => {
      try {
        const result = await runLoadDraft({ data: { id: draftParam } });
        if (!active || !result.ok || !result.draft) return;
        setRole(result.draft.role);
        setSections((prev) =>
          prev.map((s) => {
            const items = result.draft!.sections[s.id];
            return items && items.length > 0 ? { ...s, items } : { ...s, items: [] };
          }),
        );
      } catch {
        // keep whatever is already on screen
      } finally {
        if (active) setLoadingLive(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [draftParam, runLoadDraft]);

  // Editing existing live content: pull it from the connected knowledge base.
  useEffect(() => {
    if (!roleParam || draftParam) return;
    let active = true;
    void (async () => {
      try {
        const result = await runLoad({ data: { role: roleParam, source: sourceParam ?? "company" } });
        if (!active) return;
        if (result.ok && result.sections) {
          setSections((prev) =>
            prev.map((s) => {
              const items = result.sections![s.id];
              return items && items.length > 0 ? { ...s, items } : s;
            }),
          );
        }
      } catch {
        // fall back to the defaults already on screen
      } finally {
        if (active) setLoadingLive(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [roleParam, draftParam, sourceParam, runLoad]);

  // New content coming out of the structuring step.
  useEffect(() => {
    if (roleParam || draftParam) return;
    const draft = loadStructuredDraft();
    if (!draft) return;
    setRole(draft.role);
    setSections((prev) =>
      prev.map((s) => {
        const items = draft.sections[s.id];
        return items && items.length > 0 ? { ...s, items } : s;
      }),
    );
  }, [roleParam, draftParam]);

  function updateItem(sectionId: string, index: number, value: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, items: s.items.map((it, i) => (i === index ? value : it)) },
      ),
    );
  }

  function addItem(sectionId: string) {
    setSections((prev) =>
      prev.map((s) => (s.id !== sectionId ? s : { ...s, items: [...s.items, ""] })),
    );
  }

  function removeItem(sectionId: string, index: number) {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId ? s : { ...s, items: s.items.filter((_, i) => i !== index) },
      ),
    );
  }

  function currentSections() {
    return {
      overview: sections.find((s) => s.id === "overview")?.items ?? [],
      plan: sections.find((s) => s.id === "plan")?.items ?? [],
      faq: sections.find((s) => s.id === "faq")?.items ?? [],
      tools: sections.find((s) => s.id === "tools")?.items ?? [],
      contacts: sections.find((s) => s.id === "contacts")?.items ?? [],
    };
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    const payload = { role, sections: currentSections() };
    // Keep edits recoverable even if publishing fails.
    saveStructuredDraft({ ...payload, structuredAt: new Date().toISOString() });
    try {
      const result = await runPublish({ data: payload });
      if (!result.ok) {
        setPublishError(
          result.error === "not_manager"
            ? t("review.notManager")
            : result.error === "no_company"
              ? t("upload.noCompany")
              : t("review.publishFailed"),
        );
        return;
      }
      // Approved content leaves the review list and lives on Manage Content.
      if (!isMockup) await runDeleteDraft({ data: { role } });
      setPublished(true);
      setTimeout(() => navigate({ to: "/manage-content" }), 1200);
    } catch {
      setPublishError(t("review.publishFailed"));
    } finally {
      setPublishing(false);
    }
  }

  const isMockup = sourceParam === "mockup";

  return (
    <AppLayout>
      <header className="mb-8">
        <Link
          to="/review-approve"
          search={{}}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          {t("review.backToList")}
        </Link>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("nav.review")}</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          {isMockup
            ? t("review.introMockup")
            : roleParam
              ? t("review.introLive")
              : t("review.introNew")}
        </p>
      </header>

      <div className="mb-6 flex items-start gap-3 rounded-xl bg-primary/10 border border-primary/20 p-4">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground/80">{withBold(t("review.visibility", { role: "\u0000" }), role)}</p>
      </div>


      {loadingLive && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("review.loadingLive")}
        </div>
      )}

      <div className="space-y-5">
        {sections.map((s) => {
          const editing = editingSection === s.id;
          return (
            <section key={s.id} className="rounded-2xl bg-card border border-border p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{t(s.title)}</h2>
                  <p className="text-sm text-muted-foreground">{t(s.description)}</p>
                </div>
                <button
                  type="button"
                  aria-label={
                    editing
                      ? t("review.doneEditing", { section: t(s.title) })
                      : t("review.editSection", { section: t(s.title) })
                  }
                  onClick={() => setEditingSection(editing ? null : s.id)}
                  className={
                    "shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors " +
                    (editing
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40")
                  }
                >
                  {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  {editing ? t("review.done") : t("review.edit")}
                </button>
              </div>

              {editing ? (
                <>
                  <div className="space-y-2">
                    {s.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <textarea
                          value={item}
                          onChange={(e) => updateItem(s.id, i, e.target.value)}
                          rows={2}
                          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                        />
                        <button
                          type="button"
                          aria-label={t("review.removeLine")}
                          onClick={() => removeItem(s.id, i)}
                          className="mt-1 rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addItem(s.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary/40 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("review.addLine")}
                  </button>
                </>
              ) : (
                <ul className="space-y-2.5">
                  {s.items.filter((i) => i.trim()).length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      {t("review.emptySection")}
                    </li>
                  )}
                  {s.items
                    .filter((i) => i.trim())
                    .map((item, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>


      {publishError && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{publishError}</span>
        </div>
      )}

      {published && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>{t("review.published")}</span>
        </div>
      )}

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/upload-content" })}
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:border-primary/40 transition-colors"
        >
          {t("review.backToUpload")}
        </button>
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={publishing || published}
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
        >
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {publishing ? t("review.publishing") : t("review.approve")}
        </button>
      </div>
    </AppLayout>
  );
}

/** Shows a translated sentence with the role name (marked by \u0000) in medium weight. */
function withBold(sentence: string, role: string) {
  const [before, after = ""] = sentence.split("\u0000");
  return (
    <>
      {before}
      <span className="font-medium">{role}</span>
      {after}
    </>
  );
}
