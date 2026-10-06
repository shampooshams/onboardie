import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, Users } from "lucide-react";
import { getTeam, type TeamMember } from "@/lib/team.functions";
import { useT } from "@/lib/i18n";
import { workingDaysSinceStart } from "@/lib/working-days";
import { initialsOf } from "@/lib/profile";

/**
 * Manager Dashboard: everyone who has signed up in the company, their job title,
 * and whether that title maps to published content. People without a match see
 * empty pages, so they are flagged.
 */
export function TeamCard() {
  const { t, locale } = useT();
  const fetchTeam = useServerFn(getTeam);
  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
    staleTime: 0,
  });

  const members = data?.ok ? data.members : [];
  const hires = members.filter((m) => m.accountType === "new_hire");
  const unmatched = hires.filter((m) => !m.matchedRole).length;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  function progress(member: TeamMember) {
    if (member.accountType !== "new_hire") return t("team.notApplicable");
    if (!member.startDate) return t("team.noStart");
    const start = new Date(`${member.startDate}T00:00:00`);
    if (start > new Date()) return t("team.notStarted", { date: formatDate(member.startDate) });
    const day = workingDaysSinceStart(member.startDate);
    const phase = t(day <= 30 ? "dash.stage1" : day <= 60 ? "dash.stage2" : "dash.stage3");
    return t("team.dayOf", { day, phase });
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t("team.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("team.subtitle")}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("team.loading")}
          </div>
        ) : data && !data.ok ? (
          <p className="p-5 text-sm text-muted-foreground">
            {data.error === "not_manager" ? t("team.notManager") : t("team.error")}
          </p>
        ) : members.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t("team.empty")}</p>
        ) : (
          <>
            <div className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
              {t("team.summary", { people: members.length, hires: hires.length, unmatched })}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">{t("team.colPerson")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("team.colJobTitle")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("team.colContent")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("team.colProgress")}</th>
                    <th className="px-5 py-2.5 font-medium">{t("team.colJoined")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m) => (
                    <tr key={m.id} className="align-top">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initialsOf(m.name || m.email) || "?"}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{m.name || m.email}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {m.name ? m.email : ""}
                              {m.name && m.email ? " · " : ""}
                              {m.accountType === "manager" ? t("team.manager") : t("team.newHire")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {m.jobTitle || (
                          <span className="text-muted-foreground">{t("team.noTitle")}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {m.accountType === "manager" ? (
                          <span className="text-muted-foreground">{t("team.notApplicable")}</span>
                        ) : m.matchedRole ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            {t("team.matched", { role: m.matchedRole })}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: "var(--coral-soft)",
                              color: "var(--foreground)",
                            }}
                          >
                            <AlertTriangle
                              className="h-3 w-3 shrink-0"
                              style={{ color: "var(--coral)" }}
                            />
                            {t("team.noMatch")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {progress(m)}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(m.joinedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unmatched > 0 && (
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                {t("team.mismatchHint")}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
