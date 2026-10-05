// Shared AI caller with real diagnostics and bounded retries.
// Talks to any OpenAI-compatible Chat Completions endpoint (OpenAI, Anthropic,
// Google Gemini, OpenRouter, ...), configured through AI_BASE_URL / AI_API_KEY / AI_MODEL.
// Every failure is classified and persisted so a recurrence is diagnosable
// instead of collapsing into a single generic user-facing message.

import { translate, type Lang } from "./i18n/translate";

export type AiFailureReason =
  | "config" // key missing in the running server
  | "auth" // gateway rejected the key
  | "credits" // out of credits or blocked by workspace policy
  | "busy" // rate limited or upstream failure, retried and still failing
  | "too_long" // request rejected as too large for the model
  | "empty" // gateway answered but returned no usable text
  | "network" // request never completed
  | "unknown";

export type AiCallResult =
  | { ok: true; text: string }
  | { ok: false; reason: AiFailureReason; status?: number; detail?: string };

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const MAX_ATTEMPTS = 3;

/** Reads the provider settings from the environment; undefined fields mean "not configured". */
export function aiConfig() {
  const baseUrl = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return {
    endpoint: `${baseUrl}/chat/completions`,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
  };
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function classify(status: number, body: string): AiFailureReason {
  if (status === 401) return "auth";
  if (status === 404 && /model/i.test(body)) return "config";
  if (status === 402 || status === 403) return "credits";
  if (status === 429) return "busy";
  if (status >= 500) return "busy";
  if (status === 400 && /token|too long|too large|context|length/i.test(body)) return "too_long";
  return "unknown";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Records a failure for later diagnosis. Never throws — diagnostics must never
 * be able to break the feature they are instrumenting.
 */
export async function recordAiFailure(entry: {
  feature: string;
  reason: AiFailureReason;
  status?: number;
  detail?: string;
  contentLength?: number;
}) {
  const line = `[ai-failure] feature=${entry.feature} reason=${entry.reason} status=${
    entry.status ?? "-"
  } length=${entry.contentLength ?? "-"} detail=${(entry.detail ?? "").slice(0, 500)}`;
  console.error(line);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_failure_log").insert({
      feature: entry.feature,
      reason: entry.reason,
      status_code: entry.status ?? null,
      detail: (entry.detail ?? "").slice(0, 2000) || null,
      content_length: entry.contentLength ?? null,
    });
  } catch (error) {
    console.error("[ai-failure] could not persist diagnostics", error);
  }
}

/**
 * Calls the gateway, retrying only transient failures (429/5xx) with backoff.
 * Terminal failures return immediately with their real cause.
 */
export async function callChatCompletion(options: {
  feature: string;
  messages: ChatMessage[];
  jsonObject?: boolean;
  maxCompletionTokens?: number;
  contentLength?: number;
}): Promise<AiCallResult> {
  const { endpoint, apiKey, model } = aiConfig();
  if (!apiKey || !model) {
    await recordAiFailure({
      feature: options.feature,
      reason: "config",
      detail: `${!apiKey ? "AI_API_KEY" : "AI_MODEL"} is not available in the running server`,
      contentLength: options.contentLength,
    });
    return { ok: false, reason: "config" };
  }

  let last: { reason: AiFailureReason; status?: number; detail?: string } = { reason: "unknown" };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          ...(options.jsonObject ? { response_format: { type: "json_object" } } : {}),
          ...(options.maxCompletionTokens
            ? { max_completion_tokens: options.maxCompletionTokens }
            : {}),
          messages: options.messages,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        const reason = classify(response.status, body);
        last = { reason, status: response.status, detail: body.slice(0, 1000) };

        if (reason === "busy" && attempt < MAX_ATTEMPTS) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 600 * 2 ** (attempt - 1) + Math.floor(Math.random() * 400);
          await sleep(waitMs);
          continue;
        }
        break;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      };
      const choice = payload.choices?.[0];
      const text = choice?.message?.content?.trim();
      if (!text) {
        last = {
          reason: "empty",
          status: 200,
          detail: `finish_reason=${choice?.finish_reason ?? "unknown"}`,
        };
        break;
      }
      return { ok: true, text };
    } catch (error) {
      last = { reason: "network", detail: error instanceof Error ? error.message : String(error) };
      if (attempt < MAX_ATTEMPTS) {
        await sleep(600 * 2 ** (attempt - 1));
        continue;
      }
    }
  }

  await recordAiFailure({
    feature: options.feature,
    reason: last.reason,
    status: last.status,
    detail: last.detail,
    contentLength: options.contentLength,
  });
  return { ok: false, reason: last.reason, status: last.status, detail: last.detail };
}

/** Plain-language message for a failure cause, safe to show a user, in their language. */
export function aiFailureMessage(reason: AiFailureReason, lang: Lang = "en"): string {
  switch (reason) {
    case "busy":
      return translate(lang, "ai.busy");
    case "credits":
      return translate(lang, "ai.credits");
    case "auth":
    case "config":
      return translate(lang, "ai.config");
    case "too_long":
      return translate(lang, "ai.tooLong");
    case "network":
      return translate(lang, "ai.network");
    case "empty":
      return translate(lang, "ai.empty");
    default:
      return translate(lang, "ai.unknown");
  }
}
