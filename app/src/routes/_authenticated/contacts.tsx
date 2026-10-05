import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Mail, Phone, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useT } from "@/lib/i18n";
import { EmptyState, ErrorState, LoadingState } from "@/components/content-state";
import { dedupeEntries, initials, parseEntry, splitNote, useLiveContent } from "@/lib/live-content";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Who to Contact — Onboardie" },
      { name: "description", content: "The people who can help you succeed." },
      { property: "og:title", content: "Who to Contact — Onboardie" },
      { property: "og:description", content: "The people who can help you succeed." },
    ],
  }),
  component: ContactsPage,
});

/** Internal filter values; their labels are translated when shown. */
const OTHER = "Other";
const ALL = "All";

/** One contact detail row: icon + value, or a muted placeholder when missing. */
function DetailRow({
  icon,
  value,
  href,
}: {
  icon: React.ReactNode;
  value: string;
  href?: string;
}) {
  const { t } = useT();
  const content = (
    <>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className={value ? "break-all" : "italic text-muted-foreground/70"}>
        {value || t("contacts.missing")}
      </span>
    </>
  );
  if (value && href) {
    return (
      <a href={href} className="inline-flex items-center gap-2 text-primary hover:underline">
        {content}
      </a>
    );
  }
  return <span className="inline-flex items-center gap-2 text-foreground/80">{content}</span>;
}

function ContactsPage() {
  const { t } = useT();
  const live = useLiveContent();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(ALL);
  const deptLabel = (d: string) =>
    d === ALL ? t("contacts.all") : d === OTHER ? t("contacts.other") : d;

  const contacts = useMemo(
    () => dedupeEntries(live.lines("contacts").map((line) => parseEntry(line))),
    [live.sections],
  );

  const departments = useMemo(() => {
    const names = new Set<string>();
    for (const c of contacts) names.add(c.meta.department || OTHER);
    const list = [...names].filter((n) => n !== OTHER).sort((a, b) => a.localeCompare(b));
    if (names.has(OTHER)) list.push(OTHER);
    return list;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      const dept = c.meta.department || OTHER;
      if (department !== ALL && dept !== department) return false;
      if (!q) return true;
      return [c.label, c.detail, dept, c.meta.email, c.meta.phone]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [contacts, query, department]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const c of filtered) {
      const dept = c.meta.department || OTHER;
      map.set(dept, [...(map.get(dept) ?? []), c]);
    }
    return [...map.entries()].sort((a, b) =>
      a[0] === OTHER ? 1 : b[0] === OTHER ? -1 : a[0].localeCompare(b[0]),
    );
  }, [filtered]);

  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("nav.contacts")}</h1>
        <p className="mt-2 text-muted-foreground">{t("contacts.subtitle")}</p>
      </header>

      {live.isLoading && <LoadingState label={t("contacts.loading")} />}
      {live.failed && <ErrorState />}

      {!live.isLoading && !live.failed && contacts.length === 0 && (
        <EmptyState section={t("contacts.empty")} />
      )}

      {contacts.length > 0 && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("contacts.search")}
              className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {departments.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {[ALL, ...departments].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDepartment(d)}
                  className={
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors " +
                    (department === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40")
                  }
                >
                  {deptLabel(d)}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-8">
            {grouped.map(([dept, people]) => (
              <section key={dept}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {deptLabel(dept)}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {people.map((c, i) => (
                    <article
                      key={c.label + i}
                      className="rounded-2xl bg-card border border-border p-5 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                          {initials(c.label) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold">{c.label}</h3>
                          {c.detail &&
                            (() => {
                              const { main, note } = splitNote(c.detail);
                              return (
                                <>
                                  {main && (
                                    <p className="mt-1 text-sm text-muted-foreground">{main}</p>
                                  )}
                                  {note && (
                                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground/70">
                                      {note}
                                    </p>
                                  )}
                                </>
                              );
                            })()}

                          <div className="mt-3 flex flex-col gap-1.5 text-sm">
                            <DetailRow
                              icon={<Building2 className="h-3.5 w-3.5" />}
                              value={c.meta.department}
                            />
                            <DetailRow
                              icon={<Mail className="h-3.5 w-3.5" />}
                              value={c.meta.email}
                              href={`mailto:${c.meta.email}`}
                            />
                            <DetailRow
                              icon={<Phone className="h-3.5 w-3.5" />}
                              value={c.meta.phone}
                              href={`tel:${c.meta.phone.replace(/\s+/g, "")}`}
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">
                {t("contacts.noMatch")}
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
