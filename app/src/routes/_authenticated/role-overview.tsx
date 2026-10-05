import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Compass, Sparkles, Target, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { EmptyState, ErrorState, LoadingState } from "@/components/content-state";
import { groupFaqs, splitQa, useLiveContent } from "@/lib/live-content";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/role-overview")({
  head: () => ({
    meta: [
      { title: "Role Overview & Q&A — Onboardie" },
      { name: "description", content: "Understand your role, expectations, and common answers." },
      { property: "og:title", content: "Role Overview & Q&A — Onboardie" },
      {
        property: "og:description",
        content: "Understand your role, expectations, and common answers.",
      },
    ],
  }),
  component: RoleOverviewPage,
});

const HIGHLIGHTS = [
  {
    id: "function",
    label: "role.coreFunction",
    icon: Compass,
    tone: "text-primary bg-primary/10",
    /** Labels the AI writes for this card, most explicit first (German as a fallback). */
    labels: ["core function", "core purpose", "role purpose", "what the role does", "kernfunktion", "kernaufgabe"],
    keywords: ["core function", "role exists", "responsib", "own the", "day-to-day", "verantwort", "aufgabe"],
  },
  {
    id: "impact",
    label: "role.impact",
    icon: Sparkles,
    tone: "text-[oklch(0.62_0.15_45)] bg-[oklch(0.62_0.15_45)]/10",
    labels: ["your impact", "impact", "value you add", "why it matters", "ihr beitrag", "ihre wirkung", "wirkung"],
    keywords: ["impact", "matters", "contribut", "value", "brand", "growth", "beitrag", "wirkung", "wert", "marke", "wachstum"],
  },
  {
    id: "success",
    label: "role.success",
    icon: TrendingUp,
    tone: "text-[oklch(0.68_0.11_205)] bg-[oklch(0.68_0.11_205)]/10",
    labels: ["what success looks like", "success", "how success is measured", "erfolg", "woran erfolg erkennbar ist"],
    keywords: ["success", "target", "goal", "kpi", "measur", "result", "expect", "erfolg", "ziel", "kennzahl", "ergebnis", "erwart"],
  },
] as const;

/** Reads "Label: text" lines the structuring prompt produces. */
function labelled(line: string): { key: string; text: string } | null {
  const match = /^\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\s&']{2,32}?)\s*[:—-]\s*(.+)$/.exec(line);
  if (!match) return null;
  return { key: match[1].trim().toLowerCase(), text: match[2].trim() };
}

/** Picks the best line per highlight card, without reusing a line twice. */
function buildHighlights(lines: string[]) {
  const used = new Set<number>();
  const pick = (test: (line: string) => boolean) => {
    const index = lines.findIndex((line, i) => !used.has(i) && test(line));
    if (index === -1) return null;
    used.add(index);
    return index;
  };

  const chosen = HIGHLIGHTS.map((h) => {
    let index = pick((line) => {
      const parsed = labelled(line);
      return !!parsed && h.labels.some((l) => parsed.key === l);
    });
    if (index === null) {
      index = pick((line) => h.keywords.some((k) => line.toLowerCase().includes(k)));
    }
    return { ...h, index };
  });

  // Fill any card that found no labelled/keyword match with the next longest
  // remaining line, so the layout never collapses on older published content.
  const spare = lines
    .map((line, i) => ({ line, i }))
    .filter(({ i, line }) => !used.has(i) && line.trim().length > 25)
    .sort((a, b) => b.line.length - a.line.length);

  return chosen
    .map((h) => {
      let index = h.index;
      if (index === null) {
        const next = spare.find(({ i }) => !used.has(i));
        if (next) {
          used.add(next.i);
          index = next.i;
        }
      }
      if (index === null) return { ...h, text: "", source: "" };
      const raw = lines[index];
      const parsed = labelled(raw);
      // Cards grow to fit — never cut the sentence short.
      return { ...h, text: (parsed ? parsed.text : raw).trim(), source: raw };
    })
    .filter((h) => h.text);
}

const SUMMARY_LABEL = /^(summary|zusammenfassung)\s*[:—-]\s*/i;

function RoleOverviewPage() {
  const { t } = useT();
  const live = useLiveContent();
  const overviewLines = live.lines("overview");
  const summaryIndex = overviewLines.findIndex((l) => SUMMARY_LABEL.test(l));
  const summary =
    summaryIndex === -1 ? "" : overviewLines[summaryIndex].replace(SUMMARY_LABEL, "");
  const details = overviewLines.filter((_, i) => i !== summaryIndex);

  const highlights = useMemo(() => buildHighlights(details), [live.sections]);
  /** Short note style: first sentence only, shown in full, max six bullets. */
  const rest = useMemo(
    () =>
      details
        .filter((line) => !highlights.some((h) => h.source === line))
        .map((line) => {
          const parsed = labelled(line);
          const text = parsed && parsed.text.length > 20 ? parsed.text : line;
          const firstSentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
          return firstSentence.trim().replace(/\.$/, "");
        })
        .filter((line) => line.length > 3)
        .slice(0, 6),
    [details, highlights],
  );

  const faqGroups = useMemo(
    () => groupFaqs(live.lines("faq").map(splitQa)),
    [live.sections],
  );
  const [open, setOpen] = useState<string | null>(null);

  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("nav.roleOverview")}</h1>
        <p className="mt-2 text-muted-foreground">
          {live.role ? t("role.subtitleAs", { role: live.role }) : t("role.subtitle")}
        </p>
      </header>

      {live.isLoading && <LoadingState label={t("role.loading")} />}
      {live.failed && <ErrorState />}

      {!live.isLoading && !live.failed && (
        <>
          <section className="mb-10">
            {details.length === 0 && !summary ? (
              <EmptyState section={t("role.emptyOverview")} />
            ) : (
              <div className="space-y-4">
                {summary && (
                  <div className="rounded-2xl bg-primary/10 border border-primary/20 p-6 md:p-7">
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                      <Target className="h-3.5 w-3.5" />
                      {t("role.nutshell")}
                    </span>
                    <p className="mt-3 text-base md:text-lg leading-relaxed font-medium text-foreground">
                      {summary}
                    </p>
                  </div>
                )}

                {highlights.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {highlights.map((h) => (
                      <article
                        key={h.id}
                        className="rounded-2xl bg-card border border-border p-5 shadow-sm"
                      >
                        <div
                          className={
                            "h-10 w-10 rounded-xl flex items-center justify-center " + h.tone
                          }
                        >
                          <h.icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t(h.label)}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{h.text}</p>
                      </article>
                    ))}
                  </div>
                )}

                {rest.length > 0 && (
                  <div className="rounded-2xl bg-card border border-border p-5 md:p-6 shadow-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("role.goodToKnow")}
                    </h3>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
                      {rest.map((line, i) => (
                        <div key={i} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4">{t("role.commonQuestions")}</h2>
            {faqGroups.length === 0 ? (
              <EmptyState section={t("role.emptyQuestions")} />
            ) : (
              <div className="space-y-7">
                {faqGroups.map((group) => (
                  <div key={group.id}>
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t(group.label)}
                      </h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((f, i) => {
                        const key = `${group.id}-${i}`;
                        const isOpen = open === key;
                        return (
                          <div
                            key={key}
                            className="rounded-xl bg-card border border-border overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => setOpen(isOpen ? null : key)}
                              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
                            >
                              <span className="text-sm font-medium">{f.q}</span>
                              <ChevronDown
                                className={
                                  "h-4 w-4 text-muted-foreground shrink-0 transition-transform " +
                                  (isOpen ? "rotate-180" : "")
                                }
                              />
                            </button>
                            {isOpen && f.a && (
                              <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                                {f.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AppLayout>
  );
}
