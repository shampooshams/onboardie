import type { MessageKey } from "./en";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/**
 * Plan phases are stored and keyed in English ("Week 1", "Month 2"), because
 * ticked-task progress is saved under those names. This only changes how a
 * phase is shown.
 */
export function phaseLabel(title: string, t: T): string {
  const match = /^(week|month|day)\s*(\d+)(.*)$/i.exec(title.trim());
  if (match) {
    const kind = match[1].toLowerCase() as "week" | "month" | "day";
    const rest = match[3] ?? "";
    return `${t(`phase.${kind}`, { n: match[2] })}${rest}`;
  }
  if (title === "Other focus areas") return t("phase.other");
  return title;
}
