import type { StructuredContent } from "./structure.functions";

const KEY = "moveforward:structured-content";

export type StructuredDraft = {
  role: string;
  sections: StructuredContent;
  structuredAt: string;
};

export function saveStructuredDraft(draft: StructuredDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // ignore storage failures — Review & Approve falls back to its defaults
  }
}

export function loadStructuredDraft(): StructuredDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StructuredDraft) : null;
  } catch {
    return null;
  }
}
