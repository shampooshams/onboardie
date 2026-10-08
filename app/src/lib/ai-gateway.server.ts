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
  | { ok: false; reason: AiFailureReason; status?: number; detail?: string; hint?: string };

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
  // Gemini answers a bad or missing key with 400 instead of 401.
  if (status === 400 && /api key|authorization header/i.test(body)) return "auth";
  // Either the model name or AI_BASE_URL is wrong; setupHint says which.
  if (status === 404) return "config";
  if (status === 402 || status === 403) return "credits";
  if (status === 429) return "busy";
  if (status >= 500) return "busy";
  if (status === 400 && /token|too long|too large|context|length/i.test(body)) return "too_long";
  return "unknown";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The provider's own error text, e.g. "Invalid Anthropic API Key". Never contains the key. */
function providerMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as unknown;
    const first = (Array.isArray(parsed) ? parsed[0] : parsed) as {
      error?: { message?: unknown } | string;
      message?: unknown;
    };
    const message =
      typeof first?.error === "string"
        ? first.error
        : (first?.error?.message ?? first?.message);
    return typeof message === "string" ? message.slice(0, 160) : "";
  } catch {
    return "";
  }
}

/**
 * Says which setting to fix for a configuration failure, naming environment
 * variables and the provider host only — never the key itself. Shown to the
 * user so whoever runs the deployment can fix it without reading logs.
 */
function setupHint(reason: AiFailureReason, status: number | undefined, body: string): string | undefined {
  const { endpoint, model } = aiConfig();
  const host = new URL(endpoint).host;
  const baseUnset = !process.env.AI_BASE_URL;
  const fromProvider = providerMessage(body);
  const said = fromProvider ? ` Provider said: "${fromProvider}"` : "";
  if (baseUnset && reason !== "busy") {
    return `AI_BASE_URL is not set, so requests go to OpenAI (${host}), which refused them (HTTP ${status}). If your key is from another provider, set AI_BASE_URL to its address and redeploy.${said}`;
  }
  if (reason === "auth") {
    return `${host} rejected AI_API_KEY (HTTP ${status}). Check that the key belongs to this provider and has no extra spaces, then redeploy.${said}`;
  }
  if (reason === "config" && status === 404) {
    return /model/i.test(body)
      ? `${host} has no model called "${model}". Check AI_MODEL, then redeploy.${said}`
      : `Nothing was found at ${endpoint}. Check AI_BASE_URL (it should end before /chat/completions), then redeploy.`;
  }
  return undefined;
}

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
  /** A full response_format (e.g. a json_schema the provider must follow); wins over jsonObject. */
  responseFormat?: Record<string, unknown>;
  maxCompletionTokens?: number;
  contentLength?: number;
}): Promise<AiCallResult> {
  const { endpoint, apiKey, model } = aiConfig();
  if (!apiKey || !model) {
    const missing = [
      ...(!apiKey ? ["AI_API_KEY"] : []),
      ...(!model ? ["AI_MODEL"] : []),
      ...(!process.env.AI_BASE_URL ? ["AI_BASE_URL"] : []),
    ];
    const hint = `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set on the server. Add ${missing.length === 1 ? "it" : "them"} to the hosting provider's environment variables (Production) and redeploy.`;
    await recordAiFailure({
      feature: options.feature,
      reason: "config",
      detail: hint,
      contentLength: options.contentLength,
    });
    return { ok: false, reason: "config", hint };
  }

  let last: { reason: AiFailureReason; status?: number; detail?: string; hint?: string } = {
    reason: "unknown",
  };

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
          ...(options.responseFormat
            ? { response_format: options.responseFormat }
            : options.jsonObject
              ? { response_format: { type: "json_object" } }
              : {}),
          ...(options.maxCompletionTokens
            ? { max_completion_tokens: options.maxCompletionTokens }
            : {}),
          messages: options.messages,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        const reason = classify(response.status, body);
        last = {
          reason,
          status: response.status,
          detail: body.slice(0, 1000),
          hint: setupHint(reason, response.status, body),
        };

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
    detail: last.hint ? `${last.hint} | ${last.detail ?? ""}` : last.detail,
    contentLength: options.contentLength,
  });
  return {
    ok: false,
    reason: last.reason,
    status: last.status,
    detail: last.detail,
    hint: last.hint,
  };
}

/**
 * Plain-language message for a failure, in the user's language. Setup failures
 * also carry the technical hint (which setting to fix), which stays in English
 * because it names environment variables.
 */
export function aiFailureMessage(reason: AiFailureReason, lang: Lang = "en", hint?: string): string {
  const message = baseFailureMessage(reason, lang);
  return hint ? `${message} ${translate(lang, "ai.detail", { detail: hint })}` : message;
}

function baseFailureMessage(reason: AiFailureReason, lang: Lang): string {
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

export type WebSource = { title: string; url: string };

export type GroundedResult =
  | {
      ok: true;
      text: string;
      sources: WebSource[];
      /** Google's Search Suggestions html; must be shown unmodified next to the answer. */
      suggestionsHtml: string;
      queries: string[];
    }
  | { ok: false; reason: AiFailureReason | "unsupported"; detail?: string };

/**
 * Asks Gemini with Google Search grounding, so the answer comes with the web
 * pages it used. Only available when AI_BASE_URL points at Google's Gemini API
 * (its OpenAI-compatible endpoint doesn't return the sources); any other
 * provider gets { ok: false, reason: "unsupported" }.
 */
export async function callGroundedSearch(options: {
  feature: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<GroundedResult> {
  const { apiKey, model } = aiConfig();
  const base = (process.env.AI_BASE_URL || "").replace(/\/+$/, "");
  if (!apiKey || !model || !/generativelanguage\.googleapis\.com/.test(base)) {
    return { ok: false, reason: "unsupported" };
  }
  const nativeBase = base.replace(/\/openai$/, "");
  const endpoint = `${nativeBase}/models/${encodeURIComponent(model)}:generateContent`;

  let last: { reason: AiFailureReason; detail?: string } = { reason: "unknown" };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.system }] },
          contents: options.messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          tools: [{ google_search: {} }],
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        last = { reason: classify(response.status, body), detail: body.slice(0, 1000) };
        if (last.reason === "busy" && attempt < 2) {
          await sleep(800);
          continue;
        }
        break;
      }
      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          groundingMetadata?: {
            webSearchQueries?: string[];
            searchEntryPoint?: { renderedContent?: string };
            groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
          };
        }>;
      };
      const candidate = payload.candidates?.[0];
      const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      if (!text) {
        last = { reason: "empty" };
        break;
      }
      const meta = candidate?.groundingMetadata;
      const seen = new Set<string>();
      const sources: WebSource[] = [];
      for (const chunk of meta?.groundingChunks ?? []) {
        const url = chunk.web?.uri;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        sources.push({ title: chunk.web?.title || new URL(url).hostname, url });
      }
      return {
        ok: true,
        text,
        sources: sources.slice(0, 6),
        suggestionsHtml: meta?.searchEntryPoint?.renderedContent ?? "",
        queries: meta?.webSearchQueries ?? [],
      };
    } catch (error) {
      last = { reason: "network", detail: error instanceof Error ? error.message : String(error) };
    }
  }
  await recordAiFailure({ feature: options.feature, reason: last.reason, detail: last.detail });
  return { ok: false, reason: last.reason, detail: last.detail };
}
