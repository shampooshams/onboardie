const NOTION_API_URL = "https://api.notion.com";
const NOTION_VERSION = "2022-06-28";

/** Notion is optional: without NOTION_API_KEY the shared mockup roles are simply absent. */
export function isNotionConfigured() {
  return !!process.env.NOTION_API_KEY;
}

export const SECTION_LABELS = {
  overview: "Role Overview",
  plan: "Learning Plan",
  faq: "FAQs",
  tools: "Tools & How to Use Them",
  contacts: "Who to Contact",
} as const;

export type SectionKey = keyof typeof SECTION_LABELS;
/** Key facts are company-only (the shared Notion mockups have no such page). */
export type Sections = Record<SectionKey, string[]> & { facts?: string[] };

export const SECTION_KEYS = Object.keys(SECTION_LABELS) as SectionKey[];

function headers() {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) throw new Error("NOTION_API_KEY is not configured");
  return {
    Authorization: `Bearer ${notionKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${NOTION_API_URL}${path}`, { ...init, headers: headers() });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Notion request failed [${response.status}]: ${body}`);
    throw new Error(`Notion request failed [${response.status}]`);
  }
  return (await response.json()) as Record<string, unknown>;
}

type SearchPage = {
  id: string;
  object?: string;
  last_edited_time?: string;
  parent?: { type?: string };
  properties?: Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
};


function pageTitle(page: SearchPage): string {
  for (const prop of Object.values(page.properties ?? {})) {
    if (prop?.type === "title" || prop?.title) {
      return (prop.title ?? []).map((t) => t.plain_text ?? "").join("").trim();
    }
  }
  return "";
}

async function searchPages(): Promise<Array<SearchPage & { title: string }>> {
  const data = (await notionFetch("/v1/search", {
    method: "POST",
    body: JSON.stringify({ page_size: 100, filter: { property: "object", value: "page" } }),
  })) as { results?: SearchPage[] };
  return (data.results ?? []).map((p) => ({ ...p, title: pageTitle(p) }));
}

function sectionPageTitle(role: string, key: SectionKey) {
  return `${role} — ${SECTION_LABELS[key]}`;
}

function toBlocks(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 90)
    .map((item) => ({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: item.slice(0, 1900) } }],
      },
    }));
}

async function clearPage(pageId: string) {
  const data = (await notionFetch(`/v1/blocks/${pageId}/children?page_size=100`)) as {
    results?: Array<{ id: string }>;
  };
  for (const block of data.results ?? []) {
    await notionFetch(`/v1/blocks/${block.id}`, { method: "DELETE" });
  }
}

/** Creates or replaces one Notion page per section for the given role. */
export async function publishRoleContent(role: string, sections: Sections) {
  const pages = await searchPages();
  const parent = pages.find(
    (p) => p.title && !SECTION_KEYS.some((k) => p.title === sectionPageTitle(role, k)),
  );
  if (!parent) throw new Error("No Notion page shared with the integration to publish into");

  for (const key of SECTION_KEYS) {
    const title = sectionPageTitle(role, key);
    const existing = pages.find((p) => p.title === title);
    const children = toBlocks(sections[key]);

    if (existing) {
      await clearPage(existing.id);
      if (children.length) {
        await notionFetch(`/v1/blocks/${existing.id}/children`, {
          method: "PATCH",
          body: JSON.stringify({ children }),
        });
      }
    } else {
      await notionFetch("/v1/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { page_id: parent.id },
          properties: {
            title: { title: [{ type: "text", text: { content: title } }] },
          },
          children,
        }),
      });
    }
  }
}

async function readBullets(pageId: string): Promise<string[]> {
  const lines: string[] = [];
  let cursor: string | undefined;
  do {
    const query = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
    const data = (await notionFetch(`/v1/blocks/${pageId}/children${query}`)) as {
      results?: Array<Record<string, unknown> & { type: string }>;
      has_more?: boolean;
      next_cursor?: string | null;
    };
    for (const block of data.results ?? []) {
      const payload = block[block.type] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
      const text = (payload?.rich_text ?? []).map((t) => t.plain_text ?? "").join("").trim();
      if (text) lines.push(text);
    }
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return lines;
}

/** Reads the currently published content for a role back out of Notion. */
export async function readRoleContent(role: string): Promise<Sections | null> {
  if (!isNotionConfigured()) return null;
  const pages = await searchPages();
  const result = {} as Sections;
  let found = false;
  for (const key of SECTION_KEYS) {
    const page = pages.find((p) => p.title === sectionPageTitle(role, key));
    if (!page) {
      result[key] = [];
      continue;
    }
    found = true;
    result[key] = await readBullets(page.id);
  }
  return found ? result : null;
}

/** Lists roles that currently have published section pages in Notion. */
export async function listPublishedRoles(): Promise<Array<{ role: string; updatedAt: string }>> {
  if (!isNotionConfigured()) return [];
  const pages = await searchPages();
  const byRole = new Map<string, string>();
  for (const page of pages) {
    for (const key of SECTION_KEYS) {
      const suffix = ` — ${SECTION_LABELS[key]}`;
      if (page.title.endsWith(suffix)) {
        const role = page.title.slice(0, -suffix.length).trim();
        if (!role) continue;
        const at = page.last_edited_time ?? new Date().toISOString();
        const prev = byRole.get(role);
        if (!prev || prev < at) byRole.set(role, at);
      }
    }
  }
  return [...byRole.entries()].map(([role, updatedAt]) => ({ role, updatedAt }));
}
