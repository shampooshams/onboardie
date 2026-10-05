import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";

export function Placeholder({ title, description }: { title: string; description: string }) {
  const { t } = useT();
  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        {t("placeholder.back")}
      </Link>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted-foreground max-w-xl">{description}</p>
      <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
        {t("placeholder.wip")}
      </div>
    </div>
  );
}
