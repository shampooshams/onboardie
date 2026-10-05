import { useT, type Lang } from "@/lib/i18n";

const OPTIONS: { value: Lang; label: string; name: string }[] = [
  { value: "en", label: "EN", name: "English" },
  { value: "de", label: "DE", name: "Deutsch" },
];

/** EN | DE toggle. `tone="dark"` is for the navy sidebar. */
export function LanguageSwitch({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { lang, setLang, t } = useT();
  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={
        "inline-flex rounded-lg p-0.5 text-xs font-medium " +
        (tone === "dark" ? "bg-sidebar-accent/40" : "border border-border bg-card")
      }
    >
      {OPTIONS.map((option) => {
        const active = option.value === lang;
        return (
          <button
            key={option.value}
            type="button"
            lang={option.value}
            title={option.name}
            aria-pressed={active}
            onClick={() => setLang(option.value)}
            className={
              "rounded-md px-2.5 py-1 transition-colors " +
              (active
                ? tone === "dark"
                  ? "bg-sidebar-foreground text-sidebar"
                  : "bg-foreground text-background"
                : tone === "dark"
                  ? "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  : "text-muted-foreground hover:text-foreground")
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
