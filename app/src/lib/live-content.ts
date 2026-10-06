import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLiveContent, type LiveContentResult } from "./live-content.functions";
import { getPreviewContent } from "./preview.functions";
import { usePreviewRole } from "./preview";
import { useProfile } from "./profile";
import type { MessageKey } from "./i18n/translate";

export const NOT_PROVIDED = "Not provided — add manually";

export type LiveSections = {
  overview: string[];
  plan: string[];
  faq: string[];
  tools: string[];
  contacts: string[];
};

/** Fetches the published role content that new-hire pages render. */
export function useLiveContent() {
  const fetchLive = useServerFn(getLiveContent);
  const fetchPreview = useServerFn(getPreviewContent);
  // The hire's own job title decides which role content the server returns, so it
  // must be part of the cache key — otherwise a role change in Settings keeps
  // serving the previous role's cached content.
  const { loading: profileLoading, profile } = useProfile();
  const roleTitle = (profile?.role_title ?? "").trim().toLowerCase();
  // Manager preview only: a specific published role record replaces the lookup.
  // Real new hires never have this set, so their resolution is untouched.
  const { preview } = usePreviewRole();
  const previewId = preview?.id ?? null;
  const query = useQuery<LiveContentResult>({
    queryKey: previewId ? ["preview-content", previewId] : ["live-content", roleTitle],
    queryFn: () =>
      previewId ? fetchPreview({ data: { roleContentId: previewId } }) : fetchLive(),
    staleTime: previewId ? 0 : 60_000,
    enabled: previewId ? true : !profileLoading,
  });

  const data = query.data;
  const ok = data?.ok === true;
  const sections: LiveSections | null =
    ok && data.sections ? (data.sections as LiveSections) : null;

  return {
    isLoading: (previewId ? false : profileLoading) || query.isLoading,
    failed: data?.ok === false,
    isPreview: !!previewId,
    previewRoleId: previewId,
    role: ok ? data.role : null,
    updatedAt: ok ? data.updatedAt : null,
    sections,
    lines: (key: keyof LiveSections) => clean(sections?.[key]),
  };
}


/** Drops placeholder/empty lines so pages can show a real empty state instead. */
export function clean(items?: string[]): string[] {
  return (items ?? [])
    .map((i) => i.trim())
    .filter((i) => i.length > 0 && i.toLowerCase() !== NOT_PROVIDED.toLowerCase());
}

const DASH = /\s+[—–-]\s+/;

/** Splits a "Label — detail" line into its two halves. */
export function splitLine(line: string): { label: string; detail: string } {
  const match = DASH.exec(line);
  if (!match) return { label: line.trim(), detail: "" };
  return {
    label: line.slice(0, match.index).trim(),
    detail: line.slice(match.index + match[0].length).trim(),
  };
}

/** Extra fields appended to a line as "| Key: value" pairs. */
export type LineMeta = {
  department: string;
  email: string;
  phone: string;
  expert: string;
  link: string;
};

const META_KEYS: Record<string, keyof LineMeta> = {
  department: "department",
  team: "department",
  email: "email",
  "e-mail": "email",
  mail: "email",
  phone: "phone",
  tel: "phone",
  telephone: "phone",
  expert: "expert",
  owner: "expert",
  contact: "expert",
  "who to ask": "expert",
  link: "link",
  url: "link",
};

const EMPTY_META: LineMeta = { department: "", email: "", phone: "", expert: "", link: "" };

/**
 * Splits a line into its "Label — detail" halves plus any trailing
 * "| Email: … | Phone: …" style metadata. Missing fields stay empty so older
 * published content keeps rendering unchanged.
 */
export function parseEntry(line: string): { label: string; detail: string; meta: LineMeta } {
  const parts = line.split("|");
  const meta: LineMeta = { ...EMPTY_META };
  const rest: string[] = [];

  for (const [index, part] of parts.entries()) {
    const match = /^\s*([\w\s-]{2,12}?)\s*:\s*(.+)$/.exec(part);
    const key = match ? META_KEYS[match[1].trim().toLowerCase()] : undefined;
    if (index > 0 && match && key) {
      const value = match[2].trim();
      if (value && !/^(n\/?a|none|unknown|not provided)$/i.test(value)) meta[key] = value;
    } else {
      rest.push(part);
    }
  }

  const { label, detail } = splitLine(rest.join("|").trim());
  const fallbackEmail = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(detail);
  if (!meta.email && fallbackEmail) meta.email = fallbackEmail[0];
  return { label, detail, meta };
}

/** Merges duplicate entries that describe the same tool or person. */
export function dedupeEntries<T extends { label: string; detail: string; meta: LineMeta }>(
  entries: T[],
): T[] {
  const byKey = new Map<string, T>();
  for (const entry of entries) {
    const key = entry.label.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...entry });
      continue;
    }
    if (entry.detail && !existing.detail.toLowerCase().includes(entry.detail.toLowerCase())) {
      existing.detail = existing.detail ? `${existing.detail} ${entry.detail}` : entry.detail;
    }
    for (const field of Object.keys(EMPTY_META) as (keyof LineMeta)[]) {
      if (!existing.meta[field] && entry.meta[field]) existing.meta[field] = entry.meta[field];
    }
  }
  return [...byKey.values()];
}

export type QaItem = { q: string; a: string; topic?: string };

/**
 * Splits a "[Topic] Question? — Answer" line, tolerating a missing dash. The
 * topic is the heading the source document filed the question under.
 */
export function splitQa(raw: string): QaItem {
  const tagged = /^\s*\[([^\]]{1,80})\]\s*(.+)$/.exec(raw);
  const topic = tagged?.[1].trim() || undefined;
  const line = tagged ? tagged[2] : raw;
  const { label, detail } = splitLine(line);
  if (detail) return { q: label, a: detail, topic };
  const idx = line.indexOf("?");
  if (idx > 0) return { q: line.slice(0, idx + 1).trim(), a: line.slice(idx + 1).trim(), topic };
  return { q: line.trim(), a: "", topic };
}

export type PlanPhase = { title: string; tasks: string[] };

const PHASE_ORDER = ["Week 1", "Week 2", "Week 3", "Week 4", "Month 1", "Month 2", "Month 3"];

/** German phase words, so "Woche 1:" lands in the same phase as "Week 1:". */
const PHASE_WORDS: Record<string, string> = { woche: "week", monat: "month", tag: "day" };

/**
 * Groups "Week 1: task" style plan lines into ordered phases. Phase titles stay
 * English ("Week 1") because ticked-task progress is saved under them; pages
 * translate them for display.
 */
export function groupPlan(lines: string[]): PlanPhase[] {
  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const match =
      /^((?:week|woche|month|monat)\s*\d+|(?:day|tag)\s*\d+[^:]*)\s*[:\-–—]\s*(.+)$/i.exec(
        line.trim(),
      );
    const title = match
      ? titleCase(match[1].replace(/^(woche|monat|tag)/i, (w) => PHASE_WORDS[w.toLowerCase()]!))
      : "Other focus areas";
    // The plan covers the first 90 days; drop goals the notes set for later.
    if (beyondNinetyDays(title)) continue;
    const task = match ? match[2].trim() : line.trim();
    if (!task || task.toLowerCase().startsWith(NOT_PROVIDED.toLowerCase().slice(0, 13))) continue;
    const list = groups.get(title) ?? [];
    list.push(task);
    groups.set(title, list);
  }
  return [...groups.entries()]
    .map(([title, tasks]) => ({ title, tasks }))
    .filter((p) => p.tasks.length > 0)
    .sort((a, b) => rank(a.title) - rank(b.title));
}

function beyondNinetyDays(title: string) {
  const m = /^(week|month|day)\s*(\d+)/i.exec(title);
  if (!m) return false;
  const n = Number(m[2]);
  const unit = m[1].toLowerCase();
  return unit === "month" ? n > 3 : unit === "week" ? n > 13 : n > 90;
}

function rank(title: string) {
  const i = PHASE_ORDER.indexOf(title);
  return i === -1 ? 99 : i;
}

function titleCase(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(week|month|day)/i, (m) => m[0].toUpperCase() + m.slice(1).toLowerCase());
}

/** Initials for a contact name, used in avatar bubbles. */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** One themed cluster of things a tool is used for. */
export type ToolGroup = { name: string; items: string[] };

/** A tool card: one entry per product with every distinct function it serves. */
export type ToolEntry = { label: string; groups: ToolGroup[]; functions: string[]; meta: LineMeta };

/** Known products, their logo domain and canonical display name. */
const TOOL_DOMAINS: Record<string, { domain: string; name: string }> = {
  asana: { domain: "asana.com", name: "Asana" },
  sharepoint: { domain: "sharepoint.com", name: "SharePoint" },
  descript: { domain: "descript.com", name: "Descript" },
  canva: { domain: "canva.com", name: "Canva" },
  slack: { domain: "slack.com", name: "Slack" },
  notion: { domain: "notion.so", name: "Notion" },
  hubspot: { domain: "hubspot.com", name: "HubSpot" },
  salesforce: { domain: "salesforce.com", name: "Salesforce" },
  pipedrive: { domain: "pipedrive.com", name: "Pipedrive" },
  outlook: { domain: "outlook.com", name: "Outlook" },
  "microsoft teams": { domain: "microsoft.com", name: "Microsoft Teams" },
  teams: { domain: "microsoft.com", name: "Microsoft Teams" },
  onedrive: { domain: "onedrive.com", name: "OneDrive" },
  excel: { domain: "microsoft.com", name: "Excel" },
  powerpoint: { domain: "microsoft.com", name: "PowerPoint" },
  zoom: { domain: "zoom.us", name: "Zoom" },
  "sales navigator": { domain: "linkedin.com", name: "LinkedIn Sales Navigator" },
  linkedin: { domain: "linkedin.com", name: "LinkedIn" },
  twitter: { domain: "x.com", name: "X" },
  "x (twitter)": { domain: "x.com", name: "X" },
  buffer: { domain: "buffer.com", name: "Buffer" },
  hootsuite: { domain: "hootsuite.com", name: "Hootsuite" },
  later: { domain: "later.com", name: "Later" },
  sprout: { domain: "sproutsocial.com", name: "Sprout Social" },
  mailchimp: { domain: "mailchimp.com", name: "Mailchimp" },
  youtube: { domain: "youtube.com", name: "YouTube" },
  instagram: { domain: "instagram.com", name: "Instagram" },
  tiktok: { domain: "tiktok.com", name: "TikTok" },
  gmail: { domain: "google.com", name: "Gmail" },
  "google calendar": { domain: "google.com", name: "Google Calendar" },
  "google drive": { domain: "google.com", name: "Google Drive" },
  "google analytics": { domain: "google.com", name: "Google Analytics" },
  "google sheets": { domain: "google.com", name: "Google Sheets" },
  "google meet": { domain: "google.com", name: "Google Meet" },
  jira: { domain: "atlassian.com", name: "Jira" },
  confluence: { domain: "atlassian.com", name: "Confluence" },
  trello: { domain: "trello.com", name: "Trello" },
  figma: { domain: "figma.com", name: "Figma" },
  miro: { domain: "miro.com", name: "Miro" },
  zendesk: { domain: "zendesk.com", name: "Zendesk" },
  intercom: { domain: "intercom.com", name: "Intercom" },
  datev: { domain: "datev.de", name: "DATEV" },
  sap: { domain: "sap.com", name: "SAP" },
  personio: { domain: "personio.de", name: "Personio" },
  docusign: { domain: "docusign.com", name: "DocuSign" },
  loom: { domain: "loom.com", name: "Loom" },
  apollo: { domain: "apollo.io", name: "Apollo" },
  lemlist: { domain: "lemlist.com", name: "lemlist" },
  outreach: { domain: "outreach.io", name: "Outreach" },
  cognism: { domain: "cognism.com", name: "Cognism" },
  clay: { domain: "clay.com", name: "Clay" },
  dropbox: { domain: "dropbox.com", name: "Dropbox" },
  stripe: { domain: "stripe.com", name: "Stripe" },
  wordpress: { domain: "wordpress.com", name: "WordPress" },
  webflow: { domain: "webflow.com", name: "Webflow" },
};

/** Longest names first so "google drive" wins over "google". */
const TOOL_NAMES = Object.keys(TOOL_DOMAINS).sort((a, b) => b.length - a.length);

/**
 * Finds the product a line is about, even when the label carries extra words
 * ("Asana — Design Production Timeline" or "Best-Performing Posts board (Asana)").
 * Returns the canonical product name plus the leftover words, which describe
 * which part of that product the line is about.
 */
/** Standalone "X" (the platform) written as its own word, e.g. "LinkedIn & X". */
const X_TOKEN = /(^|[\s(/&,+])X([\s)/&,.:]|$)/;

/**
 * Finds every product a line is about, so "LinkedIn & X — post daily" becomes
 * one card per platform. Also returns the leftover words of the label, which
 * describe which part of that product the line is about.
 */
function identifyTools(label: string, detail: string): { names: string[]; residual: string } {
  let haystack = `${label} ${detail}`.toLowerCase();
  const names: string[] = [];
  const raw: string[] = [];

  for (const name of TOOL_NAMES) {
    const word = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (!word.test(haystack)) continue;
    const canonical = TOOL_DOMAINS[name].name;
    if (!names.includes(canonical)) names.push(canonical);
    raw.push(name);
    haystack = haystack.replace(new RegExp(word.source, "gi"), " ");
  }
  if (X_TOKEN.test(`${label} ${detail}`) && !names.includes("X")) {
    names.push("X");
    raw.push("x");
  }

  if (names.length === 0) return { names: [label.trim()], residual: "" };

  let residual = label;
  for (const name of raw) {
    residual = residual.replace(
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
      " ",
    );
  }
  residual = residual
    .replace(/[()\[\]]/g, " ")
    .replace(/\s+(and|&|\+)\s+/gi, " ")
    .replace(/^[\s\-–—:,/|&+]+|[\s\-–—:,/|&+]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { names, residual };
}

/** Sentence-cases a bullet so every function line starts capitalised. */
function sentenceCase(text: string): string {
  const clean = text.trim();
  if (!clean) return clean;
  return clean[0].toUpperCase() + clean.slice(1);
}

/** Title-cases a section name ("social media" → "Social Media"). */
function titleCaseWords(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) =>
      word.length <= 2 && word === word.toUpperCase()
        ? word
        : word[0].toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/** Curated copy that overrides whatever the source notes said. */
const TOOL_DESCRIPTIONS: Record<string, string> = {
  descript: "Edit podcast subtitles.",
};

/** Groups duplicate tool lines (e.g. several "Asana" rows) into one card. */
export function mergeTools(lines: string[]): ToolEntry[] {
  const byKey = new Map<string, ToolEntry>();

  for (const line of lines) {
    const { label, detail, meta } = parseEntry(line);
    if (!label) continue;
    const { names, residual } = identifyTools(label, detail);
    const pieces = detail
      .split(/\s*(?:;|\u2022|\n)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const name of names) {
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const entry =
        byKey.get(key) ??
        ({ label: name, groups: [], functions: [], meta: { ...EMPTY_META } } as ToolEntry);
      byKey.set(key, entry);

      const addTo = (groupName: string, raw: string) => {
        const text = sentenceCase(raw);
        const title = groupName ? titleCaseWords(groupName) : "";
        let group = entry.groups.find((g) => g.name.toLowerCase() === title.toLowerCase());
        if (!group) {
          group = { name: title, items: [] };
          entry.groups.push(group);
        }
        const fingerprint = text.toLowerCase().replace(/\s+/g, " ");
        if (!group.items.some((i) => i.toLowerCase().replace(/\s+/g, " ") === fingerprint)) {
          group.items.push(text);
        }
        if (!entry.functions.some((f) => f.toLowerCase().replace(/\s+/g, " ") === fingerprint)) {
          entry.functions.push(text);
        }
      };

      for (const piece of pieces) {
        // "Social media: Best-Performing Posts board tracks…" becomes a themed group.
        const area = /^([A-Za-z][\w &/'-]{2,28}?)\s*:\s*(.+)$/.exec(piece);
        if (area) addTo(area[1].trim(), area[2].trim());
        else addTo(residual, piece);
      }
      for (const field of Object.keys(EMPTY_META) as (keyof LineMeta)[]) {
        if (!entry.meta[field] && meta[field]) entry.meta[field] = meta[field];
      }
    }
  }

  // Drop groups that ended up with no items but keep their name as a bullet.
  for (const [key, entry] of byKey.entries()) {
    const override = TOOL_DESCRIPTIONS[key];
    if (override) {
      entry.groups = [{ name: "", items: [override] }];
      entry.functions = [override];
      continue;
    }
    entry.groups = entry.groups.filter((g) => g.items.length > 0 || g.name);
    for (const g of entry.groups) {
      if (g.items.length === 0 && g.name) {
        g.items.push(sentenceCase(g.name));
        g.name = "";
      }
    }
    if (entry.groups.length === 1) entry.groups[0].name = entry.groups[0].name || "";
  }

  return [...byKey.values()];
}

/**
 * Explicit product marks for tools whose domain lookup returns the wrong logo
 * (e.g. sharepoint.com resolves to the generic Microsoft/Windows mark).
 */
const LOGO_OVERRIDES: Record<string, string[]> = {
  sharepoint: [
    "https://img.icons8.com/color/144/microsoft-sharepoint-2019.png",
    "https://upload.wikimedia.org/wikipedia/commons/e/e1/Microsoft_Office_SharePoint_%282019%E2%80%93present%29.svg",
  ],
  x: ["https://img.icons8.com/ios-filled/100/000000/twitterx.png"],
  descript: ["https://logo.clearbit.com/descript.com"],
};

/** Logo URL candidates for a tool, tried in order by the UI. */
export function toolLogos(label: string, link?: string): string[] {
  const domains: string[] = [];
  const key = label.toLowerCase();
  const overrideKey = key.replace(/[^a-z0-9]+/g, "");
  const overrides = LOGO_OVERRIDES[overrideKey] ?? [];
  const found = TOOL_NAMES.find((name) => new RegExp(`\\b${name}\\b`, "i").test(key));
  if (found) domains.push(TOOL_DOMAINS[found].domain);
  if (link) {
    const host = /^(?:https?:\/\/)?([^/\s]+)/i.exec(link.trim())?.[1];
    if (host?.includes(".")) domains.push(host.replace(/^www\./, ""));
  }
  return [
    ...overrides,
    ...domains.flatMap((d) => [
      `https://logo.clearbit.com/${d}`,
      `https://www.google.com/s2/favicons?domain=${d}&sz=128`,
    ]),
  ];
}

/** Splits "role (extra note)" into a short role plus a smaller side note. */
export function splitNote(text: string): { main: string; note: string } {
  const match = /^([^(]+)\(([^)]*)\)\s*(.*)$/.exec(text.trim());
  if (!match) return { main: text.trim(), note: "" };
  const note = [match[2].trim(), match[3].trim()].filter(Boolean).join(" ");
  return { main: match[1].trim().replace(/[,;:\-–—]+$/, ""), note };
}

/** Trims a long line down to its first one or two sentences. */
export function shorten(text: string, maxChars = 110): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (stop > 40) return cut.slice(0, stop + 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 40 ? space : maxChars).trim()}…`;
}


/** FAQ topic buckets so questions can be grouped instead of one long list. */
export const FAQ_CATEGORIES = [
  { id: "tooling", label: "faqcat.tooling", keywords: ["crm", "tool", "software", "system", "login", "access", "account", "dashboard", "template", "asana", "slack", "notion", "hubspot", "zugang", "konto", "anmeld", "vorlage"] },
  { id: "scheduling", label: "faqcat.scheduling", keywords: ["meeting", "calendar", "schedule", "deadline", "hours", "holiday", "vacation", "leave", "sick", "standup", "when", "time off", "termin", "kalender", "frist", "stunden", "urlaub", "krank", "wann", "arbeitszeit", "besprechung"] },
  { id: "process", label: "faqcat.process", keywords: ["process", "workflow", "step", "how do i", "policy", "approve", "report", "log", "pipeline", "qualif", "escalat", "handover", "prozess", "ablauf", "schritt", "wie kann ich", "wie mache ich", "richtlinie", "freigabe", "genehmig", "bericht", "eskalat", "übergabe"] },
  { id: "people", label: "faqcat.people", keywords: ["who", "contact", "manager", "team", "buddy", "mentor", "ask", "wer ist", "an wen", "kontakt", "ansprech", "führungskraft", "vorgesetzt", "kolleg"] },
  { id: "expectations", label: "faqcat.expectations", keywords: ["expect", "target", "goal", "kpi", "quota", "success", "review", "probation", "responsib", "erwart", "ziel", "erfolg", "probezeit", "verantwort", "quote"] },
] as const satisfies readonly { id: string; label: MessageKey; keywords: readonly string[] }[];

/** A group shows `title` (a heading from the document) or else the translated `label`. */
export type FaqGroup = { id: string; label: MessageKey; title?: string; items: QaItem[] };

/**
 * Groups Q&A pairs. Questions the document filed under a heading stay under
 * that heading, in document order; untagged ones (older content) are bucketed
 * by keyword, keeping an "Other questions" catch-all.
 */
export function groupFaqs(items: QaItem[]): FaqGroup[] {
  const topics = new Map<string, FaqGroup>();
  for (const item of items) {
    if (!item.topic) continue;
    const id = `topic:${item.topic.toLowerCase()}`;
    const group = topics.get(id) ?? { id, label: "faqcat.other", title: item.topic, items: [] };
    group.items.push(item);
    topics.set(id, group);
  }

  const groups = new Map<string, FaqGroup>();
  const push = (id: string, label: MessageKey, item: QaItem) => {
    const group = groups.get(id) ?? { id, label, items: [] };
    group.items.push(item);
    groups.set(id, group);
  };
  for (const item of items) {
    if (item.topic) continue;
    const haystack = `${item.q} ${item.a}`.toLowerCase();
    const match = FAQ_CATEGORIES.find((c) => c.keywords.some((k) => haystack.includes(k)));
    if (match) push(match.id, match.label, item);
    else push("other", "faqcat.other", item);
  }
  const order = [...FAQ_CATEGORIES.map((c) => c.id), "other"];
  return [
    ...topics.values(),
    ...[...groups.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
  ];
}

/**
 * Example questions for the AI Coach, taken from this role's own Q&A content.
 * Picks one question per topic group first, so the spread covers different
 * areas of the role instead of repeating one section.
 */
export function exampleQuestions(faqLines: string[], limit = 4): string[] {
  const groups = groupFaqs(faqLines.map(splitQa));
  const picked: string[] = [];
  let round = 0;
  while (picked.length < limit) {
    const before = picked.length;
    for (const group of groups) {
      const item = group.items[round];
      const question = item?.q.trim();
      if (question && question.length > 8 && !picked.includes(question)) picked.push(question);
      if (picked.length >= limit) break;
    }
    if (picked.length === before) break;
    round += 1;
  }
  return picked;
}
