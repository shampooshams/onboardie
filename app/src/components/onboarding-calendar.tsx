import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { monthGrid, startDateFor } from "@/lib/working-days";
import { useT } from "@/lib/i18n";

/**
 * Compact Duolingo-style month calendar: weekdays only, every working day
 * already behind the new hire is filled in, and Bavarian public holidays are
 * flagged and never counted towards the onboarding day number.
 */
export function OnboardingCalendar({
  workingDaysElapsed,
  totalWorkingDays = 90,
  startDate,
}: {
  workingDaysElapsed: number;
  totalWorkingDays?: number;
  /** The hire's start date (YYYY-MM-DD), when we know it. */
  startDate?: string | null;
}) {
  const { t, locale } = useT();
  const weekdayLabels = t("cal.weekdays").split(",");
  const today = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);
  const start = useMemo(() => {
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const [y, m, d] = startDate.split("-").map(Number);
      return new Date(Date.UTC(y!, m! - 1, d!));
    }
    return startDateFor(workingDaysElapsed, today);
  }, [startDate, workingDaysElapsed, today]);
  const [offset, setOffset] = useState(0);

  const month = useMemo(
    () => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1)),
    [today, offset],
  );
  // Keep only the Monday–Friday columns of the Monday-first grid.
  const cells = useMemo(
    () => monthGrid(month, start, today).filter((_, i) => i % 7 < 5),
    [month, start, today],
  );

  const monthLabel = month.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const remaining = Math.max(0, totalWorkingDays - workingDaysElapsed);


  return (
    <aside className="rounded-2xl bg-card border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">{monthLabel}</h2>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={t("cal.prev")}
            onClick={() => setOffset((o) => o - 1)}
            className="h-6 w-6 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label={t("cal.next")}
            onClick={() => setOffset((o) => o + 1)}
            className="h-6 w-6 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div
        className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
        style={{ backgroundColor: "var(--gold-soft)" }}
      >
        <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--gold)" }} />
        <span className="text-xs font-semibold">{t("cal.daysIn", { n: workingDaysElapsed })}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {t("cal.toGo", { n: remaining })}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
        {weekdayLabels.map((d) => (
          <div key={d} className="py-0.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const base =
            "aspect-square rounded-md flex items-center justify-center text-[11px] transition-colors";
          const style = cell.completed
            ? "bg-primary text-primary-foreground font-semibold"
            : cell.holiday
              ? "text-muted-foreground"
              : "border border-dashed border-border text-muted-foreground";
          return (
            <div
              key={cell.iso}
              title={
                cell.holiday
                  ? t("cal.holidayTitle", { name: cell.holiday })
                  : cell.completed
                    ? t("cal.countedDay")
                    : t("cal.upcoming")
              }
              className={`${base} ${style} ${cell.isToday ? "ring-2 ring-offset-1 ring-primary" : ""}`}
              style={
                cell.holiday && !cell.completed
                  ? { backgroundColor: "var(--coral-soft)", color: "var(--coral)" }
                  : undefined
              }
            >
              {cell.day}
            </div>
          );
        })}
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-[4px] bg-primary" />
          {t("cal.legendCounted")}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-[4px] border border-dashed border-border" />
          {t("cal.upcoming")}
        </li>
        <li className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-[4px]"
            style={{ backgroundColor: "var(--coral-soft)", border: "1px solid var(--coral)" }}
          />
          {t("cal.legendHoliday")}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-[4px] ring-2 ring-primary" />
          {t("cal.today")}
        </li>
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t("cal.note")}
      </p>
    </aside>
  );
}
