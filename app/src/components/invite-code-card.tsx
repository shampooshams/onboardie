import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, Check, Copy } from "lucide-react";
import { getCompanyInfo, type CompanyInfo } from "@/lib/company.functions";
import { useT } from "@/lib/i18n";

/**
 * Small banner showing the manager's company invite code so it can be shared
 * with new hires without a Settings page.
 */
export function InviteCodeCard() {
  const fetchInfo = useServerFn(getCompanyInfo);
  const [copied, setCopied] = useState(false);
  const { t } = useT();
  const { data } = useQuery({
    queryKey: ["company-info"],
    queryFn: () => fetchInfo(),
    staleTime: 0,
  });
  const info: CompanyInfo | null = data && data.ok ? data : null;
  if (!info?.inviteCode) return null;

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">
              {t("invite.title")}
              {info.companyName ? ` — ${info.companyName}` : ""}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("invite.body")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <code className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-semibold tracking-wider">
            {info.inviteCode}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(info.inviteCode ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? t("invite.copied") : t("invite.copy")}
          </button>
        </div>
      </div>
    </section>
  );
}
