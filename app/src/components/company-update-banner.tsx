import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { getCompanyUpdate, type CompanyUpdateResult } from "@/lib/insights.functions";
import { useT } from "@/lib/i18n";

/** Single manager-editable featured update shown to new hires. */
export function CompanyUpdateBanner() {
  const { t } = useT();
  const fetchUpdate = useServerFn(getCompanyUpdate);
  const { data } = useQuery<CompanyUpdateResult>({
    queryKey: ["company-update"],
    queryFn: () => fetchUpdate(),
    staleTime: 60_000,
  });

  const update = data?.ok ? data.update : null;
  if (!update) return null;

  const inner = (
    <div className="flex flex-col md:flex-row items-stretch">
      {update.imageUrl && (
        <div className="md:w-80 shrink-0 overflow-hidden bg-secondary">
          <img
            src={update.imageUrl}
            alt=""
            loading="lazy"
            className="h-48 md:h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className="flex-1 p-6 md:p-8 flex items-center gap-5 bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
          <Megaphone className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
            {t("update.badge")}
          </div>
          <h2 className="mt-2 text-xl md:text-2xl font-semibold leading-snug tracking-tight">
            {update.title}
          </h2>
        </div>
        {update.linkUrl && (
          <span className="h-10 w-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center transition-colors group-hover:bg-primary">
            <ArrowUpRight className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );

  const shell =
    "group block mb-8 overflow-hidden rounded-3xl border border-border shadow-md transition-shadow hover:shadow-lg";

  return update.linkUrl ? (
    <a href={update.linkUrl} target="_blank" rel="noreferrer" className={shell}>
      {inner}
    </a>
  ) : (
    <div className={shell}>{inner}</div>
  );
}
