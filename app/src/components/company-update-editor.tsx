import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  getCompanyUpdate,
  saveCompanyUpdate,
  type CompanyUpdateResult,
} from "@/lib/insights.functions";

/** Manager-side editor for the single Company Update banner new hires see. */
export function CompanyUpdateEditor() {
  const { t } = useT();
  const fetchUpdate = useServerFn(getCompanyUpdate);
  const save = useServerFn(saveCompanyUpdate);
  const queryClient = useQueryClient();
  const { data } = useQuery<CompanyUpdateResult>({
    queryKey: ["company-update"],
    queryFn: () => fetchUpdate(),
    staleTime: 60_000,
  });

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (data?.ok && data.update) {
      setTitle(data.update.title);
      setImageUrl(data.update.imageUrl ?? "");
      setLinkUrl(data.update.linkUrl ?? "");
    }
  }, [data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setStatus("saving");
    const result = await save({ data: { title, imageUrl, linkUrl } });
    setStatus(result.ok ? "saved" : "error");
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ["company-update"] });
  }

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors";

  return (
    <section className="rounded-2xl bg-card border border-border p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{t("update.editorTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("update.editorBody")}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <div>
          <label htmlFor="cu-title" className="text-xs font-medium text-muted-foreground">
            {t("update.titleLabel")}
          </label>
          <input
            id="cu-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("update.titlePlaceholder")}
            className={field + " mt-1"}
          />
        </div>
        <div>
          <label htmlFor="cu-image" className="text-xs font-medium text-muted-foreground">
            {t("update.imageLabel")}
          </label>
          <input
            id="cu-image"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className={field + " mt-1"}
          />
        </div>
        <div>
          <label htmlFor="cu-link" className="text-xs font-medium text-muted-foreground">
            {t("update.linkLabel")}
          </label>
          <input
            id="cu-link"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className={field + " mt-1"}
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || status === "saving"}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {status === "saving" ? t("update.saving") : t("update.save")}
          </button>
          {status === "saved" && <span className="text-xs text-primary">{t("update.saved")}</span>}
          {status === "error" && (
            <span className="text-xs text-destructive">{t("update.failed")}</span>
          )}
        </div>
      </form>
    </section>
  );
}
