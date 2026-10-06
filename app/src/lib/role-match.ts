/**
 * How a new hire's job title is matched to a published role. Shared by the
 * new-hire pages, the AI coach and the manager's team overview, so they all
 * agree on who sees which content.
 */

/** Case, spaces and punctuation don't count: "HR-Specialist" equals "hr specialist". */
export function normalizeRole(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Loose match: equal, or one contains the other ("Senior HR Specialist" finds "HR Specialist"). */
export function roleMatches(role: string, jobTitle: string): boolean {
  const a = normalizeRole(role);
  const b = normalizeRole(jobTitle);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** The item whose role fits the job title best: an exact match first, then a loose one. */
export function findRoleFor<T>(
  items: T[],
  jobTitle: string,
  roleOf: (item: T) => string,
): T | undefined {
  const title = normalizeRole(jobTitle);
  if (!title) return undefined;
  return (
    items.find((item) => normalizeRole(roleOf(item)) === title) ??
    items.find((item) => roleMatches(roleOf(item), jobTitle))
  );
}
