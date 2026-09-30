import { useCallback, useEffect, useState } from "react";

/**
 * Manager-only "Preview as New Hire" state.
 *
 * Kept entirely client-side (session storage) and keyed to a specific
 * role_content record id, so it never influences how a real new hire's content
 * is resolved — that stays driven by their own profile role title.
 */
const KEY = "onboardie:preview-role";
const EVENT = "onboardie:preview-role-changed";

export type PreviewRole = { id: string; role: string };

function read(): PreviewRole | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreviewRole;
    return parsed?.id && parsed?.role ? parsed : null;
  } catch {
    return null;
  }
}

export function usePreviewRole() {
  const [preview, setPreview] = useState<PreviewRole | null>(null);

  useEffect(() => {
    setPreview(read());
    const sync = () => setPreview(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const start = useCallback((value: PreviewRole) => {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* storage may be unavailable */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const stop = useCallback(() => {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* storage may be unavailable */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { preview, start, stop };
}

/** Reads the preview role outside React (safe during SSR). */
export function currentPreviewRole(): PreviewRole | null {
  if (typeof window === "undefined") return null;
  return read();
}

/**
 * Hypothetical start date a manager can set while previewing. Session-only and
 * keyed to the previewed role record, so it never touches profile data.
 */
const START_KEY = "onboardie:preview-start-date";
const START_EVENT = "onboardie:preview-start-date-changed";

function startKey(id: string) {
  return `${START_KEY}:${id}`;
}

export function usePreviewStartDate(previewRoleId: string | null | undefined) {
  const [startDate, setStartDate] = useState("");

  useEffect(() => {
    if (!previewRoleId) {
      setStartDate("");
      return;
    }
    const sync = () => {
      try {
        setStartDate(window.sessionStorage.getItem(startKey(previewRoleId)) ?? "");
      } catch {
        setStartDate("");
      }
    };
    sync();
    window.addEventListener(START_EVENT, sync);
    return () => window.removeEventListener(START_EVENT, sync);
  }, [previewRoleId]);

  const save = useCallback(
    (value: string) => {
      if (!previewRoleId) return;
      try {
        if (value) window.sessionStorage.setItem(startKey(previewRoleId), value);
        else window.sessionStorage.removeItem(startKey(previewRoleId));
      } catch {
        /* storage may be unavailable */
      }
      window.dispatchEvent(new Event(START_EVENT));
    },
    [previewRoleId],
  );

  return { startDate, save };
}
