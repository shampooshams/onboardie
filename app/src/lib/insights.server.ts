import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const TOPICS = ["Tools", "Process", "Contacts", "Role Expectations", "Other"] as const;
export type Topic = (typeof TOPICS)[number];

/** Asks the AI to bucket a question into one fixed topic. Never throws. */
export async function classifyQuestion(question: string): Promise<Topic | null> {
  try {
    const { aiConfig } = await import("./ai-gateway.server");
    const { endpoint, apiKey, model } = aiConfig();
    if (!apiKey || !model) return null;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `Classify the new hire's onboarding question into exactly one category: ${TOPICS.join(", ")}. The question may be in English or German. Reply with the category name only, exactly as written above in English, nothing else.`,
          },
          { role: "user", content: question },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content?.trim().toLowerCase() ?? "";
    return TOPICS.find((t) => raw.includes(t.toLowerCase())) ?? "Other";
  } catch (error) {
    console.error("Question classification failed", error);
    return null;
  }
}

/**
 * Stores a classified question for manager-only insights, scoped to the company.
 * Stored anonymously — no link to the new hire who asked. Never throws.
 */
export async function logQuestion(question: string, companyId: string | null) {
  try {
    const topic = await classifyQuestion(question);
    if (!topic) return;
    const { error } = await supabaseAdmin
      .from("coach_questions")
      .insert({ question: question.slice(0, 500), topic, company_id: companyId });
    if (error) console.error("Storing coach question failed", error);
  } catch (error) {
    console.error("Storing coach question failed", error);
  }
}

export type TopicCount = { topic: string; count: number; questions: string[] };

/** Aggregates question topics for the current calendar month for one company. */
export async function getTopicCounts(
  companyId: string | null,
): Promise<{ counts: TopicCount[]; total: number }> {
  if (!companyId) return { counts: [], total: 0 };
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabaseAdmin
    .from("coach_questions")
    .select("topic, question, created_at")
    .eq("company_id", companyId)
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = map.get(row.topic) ?? [];
    list.push(row.question);
    map.set(row.topic, list);
  }
  const counts = [...map.entries()]
    .map(([topic, questions]) => ({ topic, count: questions.length, questions }))
    .sort((a, b) => b.count - a.count);
  return { counts, total: counts.reduce((sum, c) => sum + c.count, 0) };
}

export type CompanyUpdate = {
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  updatedAt: string;
};

export async function readCompanyUpdate(companyId: string | null): Promise<CompanyUpdate | null> {
  if (!companyId) return null;
  const { data, error } = await supabaseAdmin
    .from("company_update")
    .select("title, image_url, link_url, updated_at")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    title: data.title,
    imageUrl: data.image_url,
    linkUrl: data.link_url,
    updatedAt: data.updated_at,
  };
}

export async function writeCompanyUpdate(
  companyId: string,
  input: { title: string; imageUrl: string | null; linkUrl: string | null },
) {
  const { data: existing } = await supabaseAdmin
    .from("company_update")
    .select("id")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = {
    title: input.title,
    image_url: input.imageUrl,
    link_url: input.linkUrl,
    company_id: companyId,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await supabaseAdmin.from("company_update").update(row).eq("id", existing.id)
    : await supabaseAdmin.from("company_update").insert(row);
  if (error) throw error;
}
