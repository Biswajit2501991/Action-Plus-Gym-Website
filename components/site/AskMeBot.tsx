"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Bot, MessageSquareText, X } from "lucide-react";
import {
  getBotThreadAction,
  listBotFaqsAction,
  submitBotEnquiryAction,
  type BotFaq,
  type BotMessage,
} from "@/lib/actions/bot";

const TOKEN_KEY = "apg_ask_me_token";
const BUBBLE_KEY = "apg_ask_me_bubble_seen";

type LocalLine =
  | { id: string; kind: "bot" | "user" | "system"; body: string }
  | { id: string; kind: "server"; message: BotMessage };

export function AskMeBot() {
  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [faqs, setFaqs] = useState<BotFaq[]>([]);
  const [lines, setLines] = useState<LocalLine[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [token, setToken] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    mobile: "",
    email: "",
    message: "",
    website: "",
  });
  const [lookupMobile, setLookupMobile] = useState("");

  const greeting = useMemo(
    () =>
      ({
        id: "greet",
        kind: "bot" as const,
        body: "Hello — I’m the Action Plus Gym assistant. Pick a question below, or submit your own query and our team will reply here.",
      }),
    [],
  );

  const persistToken = useCallback((value: string) => {
    setToken(value);
    try {
      localStorage.setItem(TOKEN_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const loadThread = useCallback(
    async (opts: { publicToken?: string; mobile?: string }) => {
      const result = await getBotThreadAction(opts);
      if (!result.ok) return result;
      persistToken(result.thread.public_token);
      setLines([
        greeting,
        ...result.messages.map((m) => ({
          id: `m-${m.id}`,
          kind: "server" as const,
          message: m,
        })),
      ]);
      return result;
    },
    [greeting, persistToken],
  );

  useEffect(() => {
    try {
      const seen = sessionStorage.getItem(BUBBLE_KEY);
      if (!seen) {
        const t = window.setTimeout(() => setShowBubble(true), 1200);
        return () => window.clearTimeout(t);
      }
    } catch {
      setShowBubble(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listBotFaqsAction();
      if (!cancelled) setFaqs(list);
      try {
        const saved = localStorage.getItem(TOKEN_KEY) || "";
        if (saved && !cancelled) {
          setToken(saved);
          await loadThread({ publicToken: saved });
        } else if (!cancelled) {
          setLines([greeting]);
        }
      } catch {
        if (!cancelled) setLines([greeting]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [greeting, loadThread]);

  useEffect(() => {
    if (!open || !token) return;
    const id = window.setInterval(() => {
      void loadThread({ publicToken: token });
    }, 12_000);
    return () => window.clearInterval(id);
  }, [open, token, loadThread]);

  function dismissBubble() {
    setShowBubble(false);
    try {
      sessionStorage.setItem(BUBBLE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function openChat() {
    dismissBubble();
    setOpen(true);
  }

  function pickFaq(faq: BotFaq) {
    setError(null);
    setLines((prev) => [
      ...prev,
      { id: `u-${faq.id}-${Date.now()}`, kind: "user", body: faq.question },
      { id: `b-${faq.id}-${Date.now()}`, kind: "bot", body: faq.answer },
      {
        id: `s-${Date.now()}`,
        kind: "system",
        body: "Still need help? Submit your query below — Action Plus Gym will reply in this chat.",
      },
    ]);
    setShowForm(true);
  }

  function submitEnquiry() {
    setError(null);
    startTransition(async () => {
      const result = await submitBotEnquiryAction({
        ...form,
        publicToken: token || "",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      persistToken(result.publicToken);
      setForm((f) => ({ ...f, message: "" }));
      setShowForm(false);
      setLines((prev) => [
        ...prev,
        {
          id: `ok-${Date.now()}`,
          kind: "system",
          body: "Thank you. Your query was sent to Action Plus Gym. Replies will appear in this chat.",
        },
      ]);
      await loadThread({ publicToken: result.publicToken });
    });
  }

  function lookupByMobile() {
    setError(null);
    startTransition(async () => {
      const result = await loadThread({ mobile: lookupMobile });
      if (!result || !("ok" in result) || !result.ok) {
        setError(
          result && "error" in result
            ? result.error
            : "No conversation found for that mobile.",
        );
        return;
      }
      setShowLookup(false);
      setLookupMobile("");
    });
  }

  return (
    <div className="fixed bottom-[13.5rem] right-5 z-[45] flex flex-col items-end gap-2 md:bottom-[13.5rem]">
      {showBubble && !open ? (
        <button
          type="button"
          onClick={openChat}
          className="animate-in fade-in slide-in-from-bottom-2 max-w-[14rem] rounded-2xl border border-gold/40 bg-charcoal/95 px-4 py-3 text-left text-sm text-white shadow-xl shadow-black/40"
        >
          <span className="font-semibold text-gold">Ask Me :)</span>
          <span className="mt-1 block text-xs text-white/70">
            Hours, membership, trials — tap to chat
          </span>
        </button>
      ) : null}

      {open ? (
        <div className="flex h-[min(70vh,34rem)] w-[min(100vw-1.5rem,22rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-gold/20 to-transparent px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full gold-gradient text-black">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Ask Me</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80">
                  Action Plus Gym
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {lines.map((line) => {
              if (line.kind === "server") {
                const m = line.message;
                const staff = m.sender === "staff";
                const customer = m.sender === "customer";
                return (
                  <div
                    key={line.id}
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                      staff
                        ? "bg-gold/15 text-gold-soft"
                        : customer
                          ? "ml-auto bg-white/10 text-white"
                          : "bg-white/5 text-white/85"
                    }`}
                  >
                    <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted">
                      {staff
                        ? m.staff_name || "Action Plus Gym"
                        : customer
                          ? "You"
                          : "Ask Me"}
                    </p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                );
              }
              if (line.kind === "user") {
                return (
                  <div
                    key={line.id}
                    className="ml-auto max-w-[90%] rounded-2xl bg-white/10 px-3 py-2 text-sm text-white"
                  >
                    {line.body}
                  </div>
                );
              }
              if (line.kind === "system") {
                return (
                  <p key={line.id} className="text-center text-[11px] text-muted">
                    {line.body}
                  </p>
                );
              }
              return (
                <div
                  key={line.id}
                  className="max-w-[90%] rounded-2xl border border-white/10 bg-charcoal/80 px-3 py-2 text-sm text-white/90"
                >
                  <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-gold">
                    Ask Me
                  </p>
                  {line.body}
                </div>
              );
            })}

            {faqs.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {faqs.map((faq) => (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => pickFaq(faq)}
                    className="rounded-full border border-gold/30 bg-gold/5 px-3 py-1.5 text-left text-xs text-gold hover:bg-gold/15"
                  >
                    {faq.question}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-white/10 p-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm((v) => !v);
                  setShowLookup(false);
                }}
                className="flex-1 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 hover:border-gold/40 hover:text-gold"
              >
                Submit your query
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLookup((v) => !v);
                  setShowForm(false);
                }}
                className="rounded-full border border-white/15 px-3 py-2 text-xs text-muted hover:text-white"
              >
                Find replies
              </button>
            </div>

            {showLookup ? (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-black/40 p-3">
                <input
                  value={lookupMobile}
                  onChange={(e) => setLookupMobile(e.target.value)}
                  placeholder="Mobile used when you enquired"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold/40"
                />
                <button
                  type="button"
                  disabled={pending || lookupMobile.trim().length < 6}
                  onClick={lookupByMobile}
                  className="w-full rounded-full gold-gradient py-2 text-xs font-semibold text-black disabled:opacity-50"
                >
                  {pending ? "Looking…" : "Load my conversation"}
                </button>
              </div>
            ) : null}

            {showForm ? (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-black/40 p-3">
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Full name"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold/40"
                />
                <input
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  placeholder="Mobile"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold/40"
                />
                <input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email (optional)"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold/40"
                />
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Your query…"
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold/40"
                />
                <input
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={submitEnquiry}
                  className="w-full rounded-full gold-gradient py-2.5 text-xs font-semibold text-black disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Send query"}
                </button>
              </div>
            ) : null}

            {error ? <p className="text-xs text-red-300">{error}</p> : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openChat())}
        className="flex h-14 w-14 items-center justify-center rounded-full gold-gradient text-black shadow-lg shadow-gold/20"
        aria-label={open ? "Close Ask Me" : "Open Ask Me"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquareText className="h-5 w-5" />}
      </button>
    </div>
  );
}
