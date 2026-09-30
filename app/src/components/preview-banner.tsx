import { useNavigate } from "@tanstack/react-router";
import { Eye, X } from "lucide-react";
import { usePreviewRole } from "@/lib/preview";

/**
 * Shown while a manager is viewing the New Hire pages as a specific published
 * role. Purely a display state — no separate account involved.
 */
export function PreviewBanner() {
  const { preview, stop } = usePreviewRole();
  const navigate = useNavigate();
  if (!preview) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-manager/40 bg-manager/10 px-4 py-3 text-sm">
      <span className="flex items-center gap-2 font-medium text-manager">
        <Eye className="h-4 w-4" />
        Previewing as a new hire
      </span>
      <span className="text-muted-foreground">
        Showing live content for <strong className="text-foreground">{preview.role}</strong>
      </span>
      <button
        type="button"
        onClick={() => {
          stop();
          void navigate({ to: "/manage-content" });
        }}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-manager/50 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Exit preview
      </button>
    </div>
  );
}
