const NOTION_API_URL = "https://api.notion.com";
const NOTION_VERSION = "2022-06-28";

/** Notion is optional: without NOTION_API_KEY the shared mockup roles are simply absent. */
export function isNotionConfigured() {
  return !!process.env.NOTION_API_KEY;
}

type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

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
  return response.json() as Promise<Record<string, unknown>>;
}

function richText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => (part as { plain_text?: string }).plain_text ?? "")
    .join("")
    .trim();
}

function blockToText(block: NotionBlock): string {
  const payload = block[block.type] as Record<string, unknown> | undefined;
  if (!payload) return "";
  const text = richText(payload.rich_text);
  switch (block.type) {
    case "heading_1":
      return text && `\n# ${text}`;
    case "heading_2":
      return text && `\n## ${text}`;
    case "heading_3":
      return text && `\n### ${text}`;
    case "bulleted_list_item":
    case "numbered_list_item":
      return text && `- ${text}`;
    case "to_do":
      return text && `- [ ] ${text}`;
    case "child_page":
      return `\n## ${(payload.title as string) ?? ""}`;
    default:
      return text;
  }
}

async function readBlocks(blockId: string, depth: number): Promise<string> {
  if (depth > 3) return "";
  const lines: string[] = [];
  let cursor: string | undefined;
  do {
    const query = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
    const data = (await notionFetch(`/v1/blocks/${blockId}/children${query}`)) as {
      results?: NotionBlock[];
      has_more?: boolean;
      next_cursor?: string | null;
    };
    for (const block of data.results ?? []) {
      const text = blockToText(block);
      if (text) lines.push(text);
      if (block.has_children) {
        const nested = await readBlocks(block.id, depth + 1);
        if (nested) lines.push(nested);
      }
    }
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return lines.join("\n");
}

let cache: { content: string; at: number } | undefined;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Fetches the role content (Role Overview, FAQs, Tools, Who to Contact) shared with the integration. */
export async function getRoleContent(): Promise<string> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.content;

  const search = (await notionFetch("/v1/search", {
    method: "POST",
    body: JSON.stringify({ page_size: 50, filter: { property: "object", value: "page" } }),
  })) as { results?: Array<{ id: string; properties?: Record<string, { title?: unknown }> }> };

  const pages = search.results ?? [];
  if (pages.length === 0) throw new Error("No Notion pages shared with the integration");

  const sections = await Promise.all(
    pages.map(async (page) => {
      const title = richText(page.properties?.title?.title) || "Untitled";
      const body = await readBlocks(page.id, 0);
      return body ? `# ${title}\n${body}` : "";
    }),
  );

  const content = sections.filter(Boolean).join("\n\n---\n\n").slice(0, 60_000);
  if (!content.trim()) throw new Error("Notion pages contained no readable content");

  cache = { content, at: Date.now() };
  return content;
}

/** Drops the cached role content so freshly published Notion edits are picked up. */
export function clearRoleContentCache() {
  cache = undefined;
}
