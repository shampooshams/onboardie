/**
 * Learning-plan tick state.
 *
 * Real new hires keep their progress in localStorage under their own user id
 * (unchanged behaviour). Manager previews use a separate, session-only store
 * keyed to the previewed role record, so a preview never reads or writes any
 * real new hire's progress.
 */
export type PlanScope = { isPreview: boolean; previewRoleId?: string | null; userId?: string | null };

function target(scope: PlanScope): { store: Storage; key: string } | null {
  if (typeof window === "undefined") return null;
  if (scope.isPreview) {
    if (!scope.previewRoleId) return null;
    return { store: window.sessionStorage, key: `onboardie:preview-plan-done:${scope.previewRoleId}` };
  }
  if (!scope.userId) return null;
  return { store: window.localStorage, key: `moveforward:learning-plan-done:${scope.userId}` };
}

export function loadPlanDone(scope: PlanScope): string[] {
  const t = target(scope);
  if (!t) return [];
  try {
    const raw = t.store.getItem(t.key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function savePlanDone(scope: PlanScope, done: string[]): void {
  const t = target(scope);
  if (!t) return;
  try {
    t.store.setItem(t.key, JSON.stringify(done));
  } catch {
    // storage unavailable — progress simply won't persist
  }
}
