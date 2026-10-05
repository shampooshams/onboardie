import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircleQuestion, ChevronDown } from "lucide-react";
import { getQuestionTopics, type TopicsResult } from "@/lib/insights.functions";
import { useT, type MessageKey } from "@/lib/i18n";

/** Manager-only: which topics new hires ask the AI Coach about this month. */
const SEGMENT_COLORS = [
  "var(--primary)",
  "var(--gold)",
  "var(--coral)",
  "var(--teal)",
  "var(--chart-2)",
];

export function QuestionTopicsCard() {
  const { t } = useT();
  const topicLabel = (topic: string) => {
    const key = `topic.${topic}` as MessageKey;
    const label = t(key);
    return label === key ? topic : label;
  };
  const fetchTopics = useServerFn(getQuestionTopics);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const { data, isLoading } = useQuery<TopicsResult>({
    queryKey: ["question-topics"],
    queryFn: () => fetchTopics(),
    staleTime: 30_000,
  });

  const counts = data?.ok ? data.counts : [];
  const total = data?.ok ? data.total : 0;

  // Donut geometry
  const size = 156;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = counts.reduce((a, c) => a + c.count, 0) || 1;

  let offsetAcc = 0;
  const segments = counts.map((c, i) => {
    const fraction = c.count / sum;
    const seg = {
      topic: c.topic,
      count: c.count,
      questions: c.questions ?? [],
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      dash: fraction * circumference,
      offset: offsetAcc,
      pct: Math.round(fraction * 100),
    };
    offsetAcc += fraction * circumference;
    return seg;
  });

  return (
    <section className="rounded-2xl bg-card border border-border p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <MessageCircleQuestion className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t("topics.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t(total === 1 ? "topics.subtitleOne" : "topics.subtitleMany", { n: total })}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {isLoading && <p className="text-sm text-muted-foreground">{t("topics.loading")}</p>}
        {!isLoading && data?.ok === false && (
          <p className="text-sm text-muted-foreground">{t("topics.error")}</p>
        )}
        {!isLoading && data?.ok && counts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("topics.empty")}</p>
        )}

        {segments.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative shrink-0" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90" role="img" aria-label={t("topics.chartLabel")}>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  strokeWidth={stroke}
                  stroke="var(--muted)"
                />
                {segments.map((s) => (
                  <circle
                    key={s.topic}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={stroke}
                    stroke={s.color}
                    strokeDasharray={`${Math.max(0, s.dash - 3)} ${circumference}`}
                    strokeDashoffset={-s.offset}
                    strokeLinecap="round"
                    className="cursor-pointer transition-opacity"
                    opacity={openTopic && openTopic !== s.topic ? 0.35 : 1}
                    onClick={() => setOpenTopic(openTopic === s.topic ? null : s.topic)}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold leading-none">{total}</span>
                <span className="text-[11px] text-muted-foreground mt-1">{t("topics.questions")}</span>
              </div>
            </div>

            <ul className="flex-1 w-full space-y-2">
              {segments.map((s) => {
                const open = openTopic === s.topic;
                return (
                  <li key={s.topic}>
                    <button
                      type="button"
                      onClick={() => setOpenTopic(open ? null : s.topic)}
                      aria-expanded={open}
                      className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-sm font-medium flex-1 truncate">{topicLabel(s.topic)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {s.count} · {s.pct}%
                      </span>
                      <ChevronDown
                        className={"h-3.5 w-3.5 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")}
                      />
                    </button>
                    {open && (
                      <ul className="mt-1 ml-5 space-y-1.5 border-l border-border pl-3">
                        {s.questions.length === 0 && (
                          <li className="text-xs text-muted-foreground">{t("topics.noneStored")}</li>
                        )}
                        {s.questions.map((q, i) => (
                          <li key={i} className="text-xs text-foreground/80 leading-relaxed">
                            &ldquo;{q}&rdquo;
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {segments.length > 0 && (
        <p className="mt-5 text-xs text-muted-foreground">{t("topics.footnote")}</p>
      )}
    </section>
  );
}
