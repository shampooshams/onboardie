import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const OTHER = "__other__";

/**
 * Job-title field that offers the company's published roles as a list, so a
 * new hire's title matches a role exactly. "My role isn't listed" falls back
 * to free text. Without published roles it is a plain text field.
 */
export function RolePicker({
  id,
  roles,
  value,
  onChange,
  placeholder,
  required,
  className = "",
}: {
  id: string;
  roles: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const listed = roles.includes(value);
  const [typing, setTyping] = useState(!listed && value.trim() !== "");

  // A value loaded later (e.g. the saved profile) decides which mode to show.
  useEffect(() => {
    if (roles.includes(value)) setTyping(false);
    else if (value.trim()) setTyping(true);
  }, [roles, value]);

  const input = (
    <input
      id={typing && roles.length > 0 ? `${id}-custom` : id}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      placeholder={roles.length > 0 ? t("rolePicker.typePlaceholder") : placeholder}
      className={className}
    />
  );
  if (roles.length === 0) return input;

  return (
    <div className="space-y-2">
      <select
        id={id}
        required={required && !typing}
        value={typing ? OTHER : listed ? value : ""}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setTyping(true);
            onChange("");
          } else {
            setTyping(false);
            onChange(e.target.value);
          }
        }}
        className={className}
      >
        <option value="" disabled>
          {t("rolePicker.choose")}
        </option>
        {roles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
        <option value={OTHER}>{t("rolePicker.other")}</option>
      </select>
      {typing && input}
      <p className="text-xs text-muted-foreground">
        {typing ? t("rolePicker.otherHint") : t("rolePicker.hint")}
      </p>
    </div>
  );
}
