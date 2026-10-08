import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readableStoredAnswer } from "./coach-reply";

export type ChatHistoryMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  sources: string[];
};

export type ChatHistoryResult = { ok: true; messages: ChatHistoryMessage[] } | { ok: false };

/** How many recent messages are shown when the coach page opens. */
const HISTORY_LIMIT = 100;

/**
 * The signed-in person's saved coach conversation, oldest first. Returns an
 * empty history (never an error screen) when the table hasn't been set up yet.
 */
export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatHistoryResult> => {
    try {
      const { data, error } = await context.supabase
        .from("coach_messages" as never)
        .select("id, role, text, sources")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        role: string;
        text: string;
        sources: unknown;
      }>;
      return {
        ok: true,
        messages: rows.reverse().map((r) => ({
          id: r.id,
          role: r.role === "user" ? "user" : "coach",
          text: r.role === "user" ? r.text : readableStoredAnswer(r.text),
          sources: Array.isArray(r.sources) ? r.sources.map(String) : [],
        })),
      };
    } catch (error) {
      console.error("Loading chat history failed", error);
      return { ok: false };
    }
  });

/** Starts a fresh conversation by deleting the person's saved messages. */
export const clearChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    try {
      const { error } = await context.supabase
        .from("coach_messages" as never)
        .delete()
        .eq("user_id", context.userId);
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      console.error("Clearing chat history failed", error);
      return { ok: false };
    }
  });
