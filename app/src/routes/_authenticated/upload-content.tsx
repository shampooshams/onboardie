import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Upload, Sparkles, FileText, Loader2, AlertTriangle, X, CheckCircle2, Save } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { ACCEPTED_FILE_TYPES, ExtractionError, extractFileText } from "@/lib/extract-file-text";
import { structureContent } from "@/lib/structure.functions";
import { saveStructuredDraft } from "@/lib/structured-draft";
import { saveCompanyDocs } from "@/lib/company-docs.functions";
import { loadRoleDraft, saveRawRoleDraft, saveRoleDraft } from "@/lib/drafts.functions";
import { useT } from "@/lib/i18n";

type Scope = "role" | "company";
type UploadedFile = { name: string; text: string; scope: Scope };

export const Route = createFileRoute("/_authenticated/upload-content")({
  validateSearch: (search: Record<string, unknown>): { draft?: string } =>
    typeof search.draft === "string" ? { draft: search.draft } : {},
  head: () => ({
    meta: [
      { title: "Upload Role Content — Onboardie" },
      { name: "description", content: "Paste or upload your onboarding notes and we'll structure them." },
      { property: "og:title", content: "Upload Role Content — Onboardie" },
      {
        property: "og:description",
        content: "Paste or upload your onboarding notes and we'll structure them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadContentPage,
});

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

function UploadContentPage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { draft: draftParam } = Route.useSearch();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roleInputRef = useRef<HTMLInputElement>(null);
  const [roleError, setRoleError] = useState(false);
  const runStructure = useServerFn(structureContent);
  const runSaveDraft = useServerFn(saveRoleDraft);
  const runSaveRawDraft = useServerFn(saveRawRoleDraft);
  const runLoadDraft = useServerFn(loadRoleDraft);
  const runSaveCompanyDocs = useServerFn(saveCompanyDocs);

  // Resuming an unstructured draft picked from Review & Approve.
  useEffect(() => {
    if (!draftParam) return;
    let active = true;
    void (async () => {
      try {
        const result = await runLoadDraft({ data: { id: draftParam } });
        if (!active || !result.ok || !result.draft) return;
        setRole(result.draft.role);
        if (result.draft.raw) setContent(result.draft.raw);
      } catch {
        // leave the empty form in place
      }
    })();
    return () => {
      active = false;
    };
  }, [draftParam, runLoadDraft]);

  /** Everything the manager added — pasted text plus every uploaded file, each labelled. */
  function combinedContent(): string {
    const blocks: string[] = [];
    if (content.trim()) blocks.push(`--- Pasted notes ---\n${content.trim()}`);
    for (const file of files) {
      const label = file.scope === "company" ? "company-wide document" : "role-specific document";
      blocks.push(`--- ${file.name} (${label}) ---\n${file.text}`);
    }
    return blocks.join("\n\n");
  }

  function requireRole(): boolean {
    if (role.trim().length > 0) return true;
    setRoleError(true);
    roleInputRef.current?.focus();
    roleInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  /** Company-wide files are stored once for the whole company so the coach can reuse them. */
  async function storeCompanyWide() {
    const docs = files
      .filter((f) => f.scope === "company")
      .map((f) => ({ title: f.name, content: f.text }));
    if (docs.length === 0) return;
    try {
      await runSaveCompanyDocs({ data: { docs } });
    } catch (error) {
      console.error("Storing company-wide documents failed", error);
    }
  }

  async function handleSaveDraft() {
    setStructureError(null);
    setDraftSaved(false);
    if (!requireRole()) return;
    setRoleError(false);
    setSavingDraft(true);
    try {
      await storeCompanyWide();
      const saved = await runSaveRawDraft({ data: { role, content: combinedContent() } });
      if (!saved.ok) {
        setStructureError(
          saved.error === "no_company" ? t("upload.noCompany") : t("upload.draftFailed"),
        );
        return;
      }
      setDraftSaved(true);
      setTimeout(() => navigate({ to: "/review-approve", search: {} }), 800);
    } catch {
      setStructureError(t("upload.draftOffline"));
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleFiles(list: File[]) {
    setFileError(null);
    setExtracting(true);
    for (const file of list) {
      try {
        const text = await extractFileText(file);
        setFiles((previous) => [
          ...previous.filter((f) => f.name !== file.name),
          { name: file.name, text, scope: "role" },
        ]);
      } catch (error) {
        setFileError(
          error instanceof ExtractionError
            ? `${file.name}: ${t(error.key, error.vars)}`
            : `${file.name}: ${t("upload.fileFailed")}`,
        );
      }
    }
    setExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStructureError(null);
    if (!requireRole()) return;
    setRoleError(false);
    setSubmitting(true);
    try {
      await storeCompanyWide();
      const result = await runStructure({ data: { role, content: combinedContent(), lang } });
      if (!result.ok) {
        setStructureError(result.message);
        return;
      }
      saveStructuredDraft({ role, sections: result.sections, structuredAt: new Date().toISOString() });
      const saved = await runSaveDraft({ data: { role, sections: result.sections, raw: combinedContent() } });
      if (saved.ok && saved.id) navigate({ to: "/review-approve", search: { draft: saved.id } });
      else navigate({ to: "/review-approve" });
    } catch (error) {
      console.error("Structuring failed", error);
      setStructureError(t("upload.structureOffline"));
    } finally {
      setSubmitting(false);
    }
  }

  const totalWords = words(combinedContent());
  const hasMaterial = combinedContent().trim().length > 0;

  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("nav.upload")}</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">{t("upload.intro")}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl bg-card border border-border p-6 shadow-sm">
          <label className="block text-sm font-medium mb-2">
            {t("upload.role")} <span className="text-destructive">*</span>
          </label>
          <input
            ref={roleInputRef}
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              if (e.target.value.trim()) setRoleError(false);
            }}
            className={
              "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors " +
              (roleError ? "border-destructive" : "border-border focus:border-primary/50")
            }
            placeholder={t("upload.rolePlaceholder")}
          />
          <p
            className={
              "mt-2 text-xs " + (roleError ? "text-destructive font-medium" : "text-muted-foreground")
            }
          >
            {roleError ? t("upload.roleMissing") : t("upload.roleHint")}
          </p>
        </div>

        {/* File upload */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = Array.from(e.dataTransfer.files ?? []);
            if (dropped.length > 0) void handleFiles(dropped);
          }}
          className={
            "rounded-2xl bg-card border p-6 shadow-sm transition-colors " +
            (dragging ? "border-primary bg-primary/5" : "border-border")
          }
        >
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {extracting ? t("upload.reading") : t("upload.uploadFiles")}
            </button>
            <p className="text-sm text-muted-foreground">
              {t("upload.fileTypes")}{" "}
              <span className="font-medium">{t("upload.pasteBelow")}</span>
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length > 0) void handleFiles(picked);
            }}
          />

          {files.length > 0 && (
            <ul className="mt-4 space-y-2">
              {files.map((file) => (
                <li
                  key={file.name}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("upload.words", { n: words(file.text) })}
                  </span>
                  <select
                    aria-label={t("upload.scopeFor", { name: file.name })}
                    value={file.scope}
                    onChange={(e) =>
                      setFiles((previous) =>
                        previous.map((f) =>
                          f.name === file.name ? { ...f, scope: e.target.value as Scope } : f,
                        ),
                      )
                    }
                    className="ml-auto rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  >
                    <option value="role">{t("upload.roleSpecific")}</option>
                    <option value="company">{t("upload.companyWide")}</option>
                  </select>
                  <button
                    type="button"
                    aria-label={t("upload.remove", { name: file.name })}
                    onClick={() => setFiles((previous) => previous.filter((f) => f.name !== file.name))}
                    className="rounded p-1 hover:bg-primary/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {files.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{t("upload.scopeHint")}</p>
          )}

          {fileError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{fileError}</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-primary" />
              {t("upload.material")}
            </div>
            <span className="text-xs text-muted-foreground">
              {t("upload.totalWords", { n: totalWords })}
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder={t("upload.textPlaceholder")}
            className="w-full resize-y bg-transparent px-5 py-4 text-sm outline-none placeholder:text-muted-foreground min-h-[280px]"
          />
        </div>

        {structureError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{structureError}</span>
          </div>
        )}

        {draftSaved && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>{t("upload.draftSaved")}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {t("upload.nothingPublished")}
            <br />
            {t("upload.draftWhere")}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={savingDraft || submitting || extracting || !hasMaterial}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingDraft ? t("upload.savingDraft") : t("upload.saveDraft")}
            </button>
            <button
              type="submit"
              disabled={submitting || savingDraft || extracting || !hasMaterial}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              {submitting ? t("upload.structuring") : t("upload.structure")}
            </button>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
