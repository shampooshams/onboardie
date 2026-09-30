import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CompanyUpdate, TopicCount } from "./insights.server";

export type TopicsResult =
  | { ok: true; counts: TopicCount[]; total: number }
  | { ok: false };

export type CompanyUpdateResult =
  | { ok: true; update: CompanyUpdate | null }
  | { ok: false };

export const getQuestionTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TopicsResult> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      const { getTopicCounts } = await import("./insights.server");
      const { counts, total } = await getTopicCounts(companyId);
      return { ok: true, counts, total };
    } catch (error) {
      console.error("Loading question topics failed", error);
      return { ok: false };
    }
  });

export const getCompanyUpdate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyUpdateResult> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      const { readCompanyUpdate } = await import("./insights.server");
      return { ok: true, update: await readCompanyUpdate(companyId) };
    } catch (error) {
      console.error("Loading company update failed", error);
      return { ok: false };
    }
  });

function validateUpdate(input: unknown) {
  const data = input as { title?: unknown; imageUrl?: unknown; linkUrl?: unknown };
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  if (!title) throw new Error("A title is required");
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return { title: title.slice(0, 200), imageUrl: str(data.imageUrl), linkUrl: str(data.linkUrl) };
}

export const saveCompanyUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateUpdate)
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    try {
      const { companyIdFor } = await import("./company.server");
      const companyId = await companyIdFor(context.supabase, context.userId);
      if (!companyId) return { ok: false };
      const { writeCompanyUpdate } = await import("./insights.server");
      await writeCompanyUpdate(companyId, data);
      return { ok: true };
    } catch (error) {
      console.error("Saving company update failed", error);
      return { ok: false };
    }
  });
