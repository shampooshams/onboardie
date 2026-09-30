/**
 * Working-day helpers for the onboarding tracker: weekends and German public
 * holidays never count towards a new hire's onboarding day number.
 */

/** Gauss / Meeus algorithm for Easter Sunday in the Gregorian calendar. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const holidayCache = new Map<number, Map<string, string>>();

/** Public holidays in Bavaria (Munich) for a given year, keyed by YYYY-MM-DD. */
export function germanHolidays(year: number): Map<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const map = new Map<string, string>([
    [`${year}-01-01`, "Neujahr"],
    [`${year}-01-06`, "Heilige Drei Könige"],
    [`${year}-05-01`, "Tag der Arbeit"],
    [`${year}-08-15`, "Mariä Himmelfahrt"],
    [`${year}-10-03`, "Tag der Deutschen Einheit"],
    [`${year}-11-01`, "Allerheiligen"],
    [`${year}-12-25`, "1. Weihnachtstag"],
    [`${year}-12-26`, "2. Weihnachtstag"],
    [isoDay(addDays(easter, -2)), "Karfreitag"],
    [isoDay(addDays(easter, 1)), "Ostermontag"],
    [isoDay(addDays(easter, 39)), "Christi Himmelfahrt"],
    [isoDay(addDays(easter, 50)), "Pfingstmontag"],
    [isoDay(addDays(easter, 60)), "Fronleichnam"],
  ]);
  holidayCache.set(year, map);
  return map;
}

/** True when the date is Mon–Fri and not a German public holiday. */
export function isWorkingDay(date: Date): boolean {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !germanHolidays(date.getUTCFullYear()).has(isoDay(date));
}

export function holidayName(date: Date): string | null {
  return germanHolidays(date.getUTCFullYear()).get(isoDay(date)) ?? null;
}

/** Working days elapsed from start through today, inclusive of both ends. */
export function workingDaysBetween(start: Date, end: Date): number {
  if (end < start) return 0;
  let count = 0;
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    if (isWorkingDay(cursor)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

/** The date that is `workingDays` working days after (and including) start. */
export function startDateFor(workingDaysElapsed: number, today = new Date()): Date {
  let cursor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  let counted = isWorkingDay(cursor) ? 1 : 0;
  while (counted < workingDaysElapsed) {
    cursor = addDays(cursor, -1);
    if (isWorkingDay(cursor)) counted += 1;
  }
  return cursor;
}

export type CalendarCell = {
  date: Date;
  iso: string;
  day: number;
  working: boolean;
  holiday: string | null;
  isToday: boolean;
  /** A counted onboarding working day already behind the new hire. */
  completed: boolean;
  /** Within the onboarding window but still ahead. */
  upcoming: boolean;
};

/**
 * Builds a Monday-first month grid, marking which weekdays already counted
 * towards the onboarding day number (streak style).
 */
export function monthGrid(month: Date, start: Date, today: Date): (CalendarCell | null)[] {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const leading = (first.getUTCDay() + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const todayIso = isoDay(today);

  const cells: (CalendarCell | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    const iso = isoDay(date);
    const working = isWorkingDay(date);
    cells.push({
      date,
      iso,
      day,
      working,
      holiday: holidayName(date),
      isToday: iso === todayIso,
      completed: working && date >= start && iso <= todayIso,
      upcoming: working && iso > todayIso,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
