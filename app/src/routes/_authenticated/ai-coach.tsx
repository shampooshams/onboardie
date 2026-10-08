import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Send, ShieldCheck, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { askCoach } from "@/lib/coach.functions";
import { clearChatHistory, getChatHistory } from "@/lib/chat-history.functions";
import { exampleQuestions, useLiveContent } from "@/lib/live-content";
import { useProfile } from "@/lib/profile";
import { useT } from "@/lib/i18n";


export const Route = createFileRoute("/_authenticated/ai-coach")({
  head: () => ({
    meta: [
      { title: "Chat with Your AI Coach — Onboardie" },
      { name: "description", content: "Chat with your AI onboarding coach, verified by your manager." },
      { property: "og:title", content: "Chat with Your AI Coach — Onboardie" },
      { property: "og:description", content: "Chat with your AI onboarding coach, verified by your manager." },
    ],
  }),
  component: AiCoachPage,
});

/** Shown only until this role's own Q&A content loads. */
const FALLBACK_SUGGESTIONS = ["coach.fallback1", "coach.fallback2", "coach.fallback3"] as const;

/** `sources` are the verified passages from the company content a coach answer is based on. */
type Message = { id: string; role: "user" | "coach"; text: string; sources?: string[] };

function AiCoachPage() {
  const { t, lang } = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ask = useServerFn(askCoach);
  const live = useLiveContent();
  // Examples come from this role's own Q&A, spread across its topic groups.
  const suggestions = useMemo(() => {
    const fromRole = exampleQuestions(live.lines("faq"), 4);
    return fromRole.length >= 2 ? fromRole : FALLBACK_SUGGESTIONS.map((key) => t(key));
  }, [live.sections, t]);
  const { profile } = useProfile();
  const firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0] ?? "";

  // The saved conversation comes back when the page opens, on any device.
  // Manager previews are tests: they start empty and aren't saved.
  const queryClient = useQueryClient();
  const fetchHistory = useServerFn(getChatHistory);
  const clearHistory = useServerFn(clearChatHistory);
  const history = useQuery({
    queryKey: ["chat-history"],
    queryFn: () => fetchHistory(),
    enabled: !live.isPreview,
    refetchOnMount: "always",
  });
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || live.isPreview || history.isFetching || !history.data) return;
    restored.current = true;
    if (history.data.ok && history.data.messages.length > 0) {
      setMessages((current) => (current.length > 0 ? current : history.data.ok ? history.data.messages : []));
    }
  }, [history.data, history.isFetching, live.isPreview]);

  async function startNewChat() {
    if (!window.confirm(t("coach.newChatConfirm"))) return;
    setMessages([]);
    if (!live.isPreview) {
      await clearHistory();
      queryClient.removeQueries({ queryKey: ["chat-history"] });
    }
    inputRef.current?.focus();
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsTyping(true);

    let reply = t("coach.error");
    let sources: string[] = [];
    try {
      const result = await ask({
        data: {
          messages: history.map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.text,
          })),
          previewRoleId: live.previewRoleId,
          lang,
        },
      });
      reply = result.ok ? result.text : result.message;
      if (result.ok) sources = result.sources;
    } catch (error) {
      console.error(error);
    }

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "coach", text: reply, sources }]);
    setIsTyping(false);
    inputRef.current?.focus();
  }


  const showSuggestions = messages.length === 0 && !isTyping;

  return (
    <AppLayout>
      {/* Fills the screen below the phone top bar (3.5rem + 3rem padding) or the desktop padding. */}
      <div className="flex flex-col h-[calc(100dvh-6.5rem)] md:h-[calc(100dvh-6rem)]">
        {/* Header */}
        <header className="flex items-center gap-4 pb-6 border-b border-border">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{t("nav.coach")}</h1>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("coach.verified")}
            </div>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => void startNewChat()}
              disabled={isTyping}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground/80 hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("coach.newChat")}
            </button>
          )}
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-md mx-auto text-center pt-8">
              <h2 className="text-2xl font-semibold tracking-tight">
                {firstName ? t("coach.helloName", { name: firstName }) : t("coach.hello")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("coach.intro")}</p>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {isTyping && <TypingIndicator />}
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="pb-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground/80 hover:border-primary/50 hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="pb-2"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder={t("coach.placeholder")}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground max-h-40"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              aria-label={t("coach.send")}
              className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            {t("coach.disclaimer")}
          </p>
        </form>
      </div>
    </AppLayout>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm " +
          (isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border text-foreground rounded-bl-md")
        }
      >
        {isUser ? message.text : <FormattedAnswer text={message.text} />}
        {!isUser && message.sources && message.sources.length > 0 && (
          <Sources quotes={message.sources} />
        )}
      </div>
    </div>
  );
}

/** The exact passages from the uploaded content an answer is based on, so it can be checked. */
function Sources({ quotes }: { quotes: string[] }) {
  const { t } = useT();
  return (
    <details className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium">
        {t("coach.sources", { count: quotes.length })}
      </summary>
      <ul className="mt-2 space-y-1.5">
        {quotes.map((q, i) => (
          <li key={i} className="border-l-2 border-primary/40 pl-2 italic">
            „{q}“
          </li>
        ))}
      </ul>
    </details>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-card border border-border px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

/** Renders the coach's markdown-ish answer as paragraphs, lists, and bold terms. */
function FormattedAnswer({ text }: { text: string }) {
  const blocks: Array<{ type: "p" | "ul" | "ol"; lines: string[] }> = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const bullet = /^([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      const type = /^\d/.test(bullet[1]) ? "ol" : "ul";
      const last = blocks[blocks.length - 1];
      if (last && last.type === type) last.lines.push(bullet[2]);
      else blocks.push({ type, lines: [bullet[2]] });
      continue;
    }
    blocks.push({ type: "p", lines: [line.replace(/^#{1,6}\s*/, "")] });
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.type === "p") {
          return (
            <p key={i} className="leading-relaxed">
              <Inline text={block.lines[0]} />
            </p>
          );
        }
        const List = block.type === "ol" ? "ol" : "ul";
        return (
          <List
            key={i}
            className={
              "space-y-1 pl-5 " + (block.type === "ol" ? "list-decimal" : "list-disc")
            }
          >
            {block.lines.map((line, j) => (
              <li key={j} className="leading-relaxed">
                <Inline text={line} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

/** Turns **bold** and `code` markers into elements. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
