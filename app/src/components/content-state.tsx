import { Loader2, FileQuestion, AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label ?? t("state.loading")}
    </div>
  );
}

export function EmptyState({ section }: { section: string }) {
  const { t } = useT();
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center shadow-sm">
      <FileQuestion className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{t("state.emptyTitle", { section })}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("state.emptyBody")}</p>
    </div>
  );
}

export function ErrorState() {
  const { t } = useT();
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive shadow-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{t("state.error")}</span>
    </div>
  );
}
