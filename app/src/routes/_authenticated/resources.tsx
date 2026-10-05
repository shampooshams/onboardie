import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ExternalLink, Search, UserRound, Wrench } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useT } from "@/lib/i18n";
import { EmptyState, ErrorState, LoadingState } from "@/components/content-state";
import { mergeTools, toolLogos, useLiveContent, type ToolEntry } from "@/lib/live-content";

export const Route = createFileRoute("/_authenticated/resources")({
  head: () => ({
    meta: [
      { title: "Resources and Tools — Onboardie" },
      {
        name: "description",
        content: "Every tool and resource for your role, and how to use each one.",
      },
      { property: "og:title", content: "Resources and Tools — Onboardie" },
      {
        property: "og:description",
        content: "Every tool and resource for your role, and how to use each one.",
      },
    ],
  }),
  component: ResourcesPage,
});

/** Product logo, walking through logo sources before the initials fallback. */
function ToolLogo({ tool }: { tool: ToolEntry }) {
  const { t } = useT();
  const sources = useMemo(() => toolLogos(tool.label, tool.meta.link), [tool.label, tool.meta.link]);
  const [index, setIndex] = useState(0);
  const src = sources[index];

  return (
    <div className="h-12 w-12 rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
      {src ? (
        <img
          src={src}
          alt={t("res.logoAlt", { name: tool.label })}
          loading="lazy"
          className="h-8 w-8 object-contain"
          onError={() => setIndex((i) => i + 1)}
        />
      ) : tool.label ? (
        <span className="text-primary font-semibold text-sm">
          {tool.label.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <Wrench className="h-5 w-5 text-primary" />
      )}
    </div>
  );
}

function ResourcesPage() {
  const { t } = useT();
  const live = useLiveContent();
  const [query, setQuery] = useState("");

  const tools = useMemo(() => mergeTools(live.lines("tools")), [live.sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((tool) =>
      [tool.label, tool.functions.join(" "), tool.groups.map((g) => g.name).join(" "), tool.meta.expert]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [tools, query]);

  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("nav.resources")}</h1>
        <p className="mt-2 text-muted-foreground">
          {live.role ? t("res.subtitleAs", { role: live.role }) : t("res.subtitle")}
        </p>
      </header>

      {live.isLoading && <LoadingState label={t("res.loading")} />}
      {live.failed && <ErrorState />}

      {!live.isLoading && !live.failed && tools.length === 0 && (
        <EmptyState section={t("res.empty")} />
      )}

      {tools.length > 0 && (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("res.search")}
              className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((tool, i) => (
              <article
                key={tool.label + i}
                className="rounded-2xl bg-card border border-border p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <ToolLogo tool={tool} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{tool.label}</h3>
                    {tool.groups.length > 0 && (
                      <>
                        <h4 className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("res.useFor")}
                        </h4>
                        <div className="mt-2 space-y-3">
                          {tool.groups.map((g, gi) => (
                            <div key={gi}>
                              {g.name && (
                                <div className="text-xs font-semibold text-foreground/90">
                                  {g.name}
                                </div>
                              )}
                              <ul className={"space-y-1.5 " + (g.name ? "mt-1.5" : "")}>
                                {g.items.map((fn, j) => (
                                  <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                                    <span>{fn}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {(tool.meta.expert || tool.meta.link) && (
                      <div className="mt-3 flex flex-col gap-1.5 text-sm">
                        {tool.meta.expert && (
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <UserRound className="h-3.5 w-3.5 shrink-0" />
                            {t("res.ask", { name: tool.meta.expert })}
                          </span>
                        )}
                        {tool.meta.link && (
                          <a
                            href={tool.meta.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-primary hover:underline break-all"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            {t("res.open")}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-12">
                {t("res.noMatch", { query })}
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
