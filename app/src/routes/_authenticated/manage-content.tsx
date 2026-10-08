import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Upload, CheckCircle2, Loader2, AlertTriangle, Sparkles, Eye, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { deleteRole, listRoles, type PublishedRole } from "@/lib/publish.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePreviewRole } from "@/lib/preview";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/manage-content")({
  head: () => ({
    meta: [
      { title: "Manage Content — Onboardie" },
      { name: "description", content: "Manage published role content." },
      { property: "og:title", content: "Manage Content — Onboardie" },
      { property: "og:description", content: "Manage published role content." },
    ],
  }),
  component: ManageContentPage,
});

function formatDate(iso: string, t: ReturnType<typeof useT>["t"], locale: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? t("review.today", {
        time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
      })
    : date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function ManageContentPage() {
  const { t, locale } = useT();
  const fetchRoles = useServerFn(listRoles);
  const navigate = useNavigate();
  const { preview, start: startPreview, stop: stopPreview } = usePreviewRole();
  const queryClient = useQueryClient();
  const runDelete = useServerFn(deleteRole);
  const [toDelete, setToDelete] = useState<PublishedRole | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!toDelete?.id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await runDelete({ data: { id: toDelete.id } });
      if (!result.ok) {
        setDeleteError(result.error === "not_manager" ? t("manage.deleteNotManager") : t("manage.deleteFailed"));
        return;
      }
      if (preview?.id === toDelete.id) stopPreview();
      setToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["published-roles"] });
      void queryClient.invalidateQueries({ queryKey: ["live-content"] });
    } catch {
      setDeleteError(t("manage.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }
  const { data, isLoading } = useQuery({
    queryKey: ["published-roles"],
    queryFn: () => fetchRoles(),
    staleTime: 0,
  });

  const roles = data?.ok ? data.roles : [];
  const mockups = data?.ok ? data.mockups : [];
  const failed = data && !data.ok;

  return (
    <AppLayout>
      <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("nav.manage")}</h1>
          <p className="mt-2 text-muted-foreground">{t("manage.subtitle")}</p>
        </div>
        <Link
          to="/upload-content"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Upload className="h-4 w-4" />
          {t("review.uploadNew")}
        </Link>
      </header>

      {failed && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{t("manage.failed")}</span>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">{t("manage.yourRoles")}</h2>
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("mgr.loadingRoles")}
          </div>
        ) : roles.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">{t("manage.noRoles")}</p>
            <Link
              to="/upload-content"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              <Upload className="h-4 w-4" />
              {t("nav.upload")}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {roles.map((r) => (
              <div key={r.role} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{r.role}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("mgr.live")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("manage.lastUpdated", { date: formatDate(r.updatedAt, t, locale) })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.id && (
                    <button
                      type="button"
                      onClick={() => {
                        startPreview({ id: r.id!, role: r.role });
                        void navigate({ to: "/" });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-manager/40 bg-manager/10 px-3 py-2 text-sm font-medium text-manager hover:border-manager/60 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {t("manage.preview")}
                    </button>
                  )}
                  <Link
                    to="/review-approve"
                    search={{ role: r.role, source: "company" }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("review.edit")}
                  </Link>
                  {r.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setToDelete(r);
                      }}
                      aria-label={t("manage.deleteRole", { role: r.role })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm font-medium text-destructive hover:border-destructive/60 hover:bg-destructive/5 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("manage.delete")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mockups.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-10 mb-1">{t("manage.mockups")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("manage.mockupsHint")}</p>
          <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden divide-y divide-border">
            {mockups.map((r) => (
              <div key={r.role} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{r.role}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                      <Sparkles className="h-3 w-3" />
                      {t("mgr.mockupRole")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{t("mgr.exampleContent")}</p>
                </div>
                <Link
                  to="/review-approve"
                  search={{ role: r.role, source: "mockup" }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {t("manage.view")}
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("manage.deleteTitle", { role: toDelete?.role ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("manage.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("manage.deleteCancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("manage.deleting") : t("manage.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
