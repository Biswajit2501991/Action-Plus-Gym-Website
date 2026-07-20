"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Bell, Bot, MessageSquareText, X } from "lucide-react";
import {
  getBotThreadAction,
  listBotFaqsAction,
  submitBotEnquiryAction,
  type BotFaq,
  type BotMessage,
} from "@/lib/actions/bot";
import { playStaffReplyChime, previewWords } from "@/lib/bot-notify";

const TOKEN_KEY = "apg_ask_me_token";
const LAST_READ_STAFF_KEY = "apg_ask_me_last_read_staff";
const PREVIEW_COUNT_KEY = "apg_ask_me_reply_preview_count";
const BUBBLE_SHOW_MS = 3_000;
const BUBBLE_HIDE_MS = 10_000;
const REPLY_PREVIEW_MS = 6_000;
const MAX_REPLY_PREVIEWS = 2;

type LocalLine =
  | { id: string; kind: "bot" | "user" | "system"; body: string }
  | { id: string; kind: "server"; message: BotMessage };

function readInt(key: string, fallback = 0) {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeInt(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function latestStaffMessage(messages: BotMessage[]): BotMessage | null {
  let latest: BotMessage | null = null;
  for (const m of messages) {
    if (m.sender !== "staff") continue;
    if (!latest || m.id > latest.id) latest = m;
  }
  return latest;
}

export function AskMeBot() {
  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [replyPreview, setReplyPreview] = useState<string | null>(null);
  const [hasUnreadReply, setHasUnreadReply] = useState(false);
  const [faqs, setFaqs] = useState<BotFaq[]>([]);
  const [askedFaqIds, setAskedFaqIds] = useState<number[]>([]);
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

  const openRef = useRef(false);
  const baselineStaffIdRef = useRef<number | null>(null);
  const previewTimerRef = useRef(0);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

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

  const markStaffRead = useCallback((staffId: number) => {
    if (staffId <= 0) return;
    writeInt(LAST_READ_STAFF_KEY, staffId);
    setHasUnreadReply(false);
  }, []);

  const handleNewStaffReply = useCallback((msg: BotMessage) => {
    playStaffReplyChime();

    const previewCount = readInt(PREVIEW_COUNT_KEY, 0);
    if (previewCount < MAX_REPLY_PREVIEWS && !openRef.current) {
      setReplyPreview(previewWords(msg.body));
      writeInt(PREVIEW_COUNT_KEY, previewCount + 1);
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = window.setTimeout(() => {
        setReplyPreview(null);
      }, REPLY_PREVIEW_MS);
    }

    if (!openRef.current) {
      setHasUnreadReply(true);
    } else {
      markStaffRead(msg.id);
    }
  }, [markStaffRead]);

  const applyMessages = useCallback(
    (messages: BotMessage[]) => {
      setLines([
        greeting,
        ...messages.map((m) => ({
          id: `m-${m.id}`,
          kind: "server" as const,
          message: m,
        })),
      ]);

      const latest = latestStaffMessage(messages);
      const latestId = latest?.id ?? 0;
      const lastRead = readInt(LAST_READ_STAFF_KEY, 0);

      if (baselineStaffIdRef.current === null) {
        baselineStaffIdRef.current = latestId;
        setHasUnreadReply(latestId > lastRead);
        return;
      }

      if (latest && latestId > baselineStaffIdRef.current) {
        baselineStaffIdRef.current = latestId;
        handleNewStaffReply(latest);
        return;
      }

      setHasUnreadReply(latestId > lastRead && !openRef.current);
    },
    [greeting, handleNewStaffReply],
  );

  const loadThread = useCallback(
    async (opts: { publicToken?: string; mobile?: string }) => {
      const result = await getBotThreadAction(opts);
      if (!result.ok) return result;
      persistToken(result.thread.public_token);
      applyMessages(result.messages);
      return result;
    },
    [applyMessages, persistToken],
  );

  // Default Ask Me bubble cycle (paused while open or while reply preview is showing).
  useEffect(() => {
    if (open || replyPreview) {
      setShowBubble(false);
      return;
    }
    let cancelled = false;
    let timer = 0;

    const show = () => {
      if (cancelled) return;
      setShowBubble(true);
      timer = window.setTimeout(hide, BUBBLE_SHOW_MS);
    };
    const hide = () => {
      if (cancelled) return;
      setShowBubble(false);
      timer = window.setTimeout(show, BUBBLE_HIDE_MS);
    };

    show();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, replyPreview]);

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

  // Poll for staff replies whether chat is open or closed (needs a saved token).
  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      void loadThread({ publicToken: token });
    }, 12_000);
    return () => window.clearInterval(id);
  }, [token, loadThread]);

  useEffect(() => {
    if (!showForm && !showLookup) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector("[data-ask-me-scroll]");
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
    return () => window.clearTimeout(t);
  }, [showForm, showLookup]);

  useEffect(() => {
    return () => window.clearTimeout(previewTimerRef.current);
  }, []);

  function openChat() {
    setShowBubble(false);
    setReplyPreview(null);
    setOpen(true);
    const latestId = baselineStaffIdRef.current ?? 0;
    markStaffRead(latestId);
  }

  function pickFaq(faq: BotFaq) {
    setError(null);
    setShowForm(false);
    setShowLookup(false);
    setAskedFaqIds((prev) => (prev.includes(faq.id) ? prev : [...prev, faq.id]));
    setLines((prev) => [
      ...prev,
      { id: `u-${faq.id}-${Date.now()}`, kind: "user", body: faq.question },
      { id: `b-${faq.id}-${Date.now()}`, kind: "bot", body: faq.answer },
      {
        id: `s-${Date.now()}`,
        kind: "system",
        body: "Still need help? Tap Submit your query — Action Plus Gym will reply in this chat.",
      },
    ]);
  }

  function submitEnquiry() {
    setError(null);
    const fullName = form.fullName.trim();
    const mobile = form.mobile.trim();
    const email = form.email.trim();
    const message = form.message.trim();
    if (fullName.length < 2) {
      setError("Enter your full name (at least 2 characters).");
      return;
    }
    if (mobile.replace(/[\s\-()]/g, "").length < 6) {
      setError("Enter a valid mobile number.");
      return;
    }
    if (message.length < 2) {
      setError("Enter your query.");
      return;
    }
    startTransition(async () => {
      const result = await submitBotEnquiryAction({
        fullName,
        mobile,
        email,
        message,
        website: form.website,
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

  const formExpanded = showForm || showLookup;

  return (
    <div className="relative flex flex-col items-end">
      {replyPreview && !open ? (
        <button
          type="button"
          onClick={openChat}
          className="absolute bottom-[calc(100%+0.75rem)] right-0 z-10 w-[min(14rem,calc(100vw-5.5rem))] rounded-2xl border border-gold/50 bg-charcoal/95 px-4 py-3 text-left text-sm text-white shadow-xl shadow-black/40"
        >
          <span className="flex items-center gap-1.5 font-semibold text-gold">
            <Bell className="h-3.5 w-3.5" />
            New reply
          </span>
          <span className="mt-1 block text-xs text-white/80">{replyPreview}</span>
        </button>
      ) : null}

      {showBubble && !open && !replyPreview ? (
        <button
          type="button"
          onClick={openChat}
          className="absolute bottom-[calc(100%+0.75rem)] right-0 z-10 w-[min(14rem,calc(100vw-5.5rem))] rounded-2xl border border-gold/40 bg-charcoal/95 px-4 py-3 text-left text-sm text-white shadow-xl shadow-black/40"
        >
          <span className="font-semibold text-gold">Ask Me :)</span>
          <span className="mt-1 block text-xs text-white/70">
            Hours, membership, trials — tap to chat
          </span>
        </button>
      ) : null}

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close Ask Me"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-[2px] md:bg-black/30"
          />
          <div
            className={`absolute bottom-[calc(100%+0.75rem)] right-0 z-[60] flex w-[min(calc(100vw-1.75rem),22rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-2xl shadow-black/60 ${
              formExpanded
                ? "max-h-[min(calc(100dvh-12rem),34rem)]"
                : "max-h-[min(calc(100dvh-13.5rem),28rem)]"
            }`}
            role="dialog"
            aria-label="Ask Me chat"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-gradient-to-r from-gold/20 to-transparent px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full gold-gradient text-black sm:h-9 sm:w-9">
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

            <div
              data-ask-me-scroll
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 sm:py-3"
            >
              <div className="space-y-2.5 sm:space-y-3">
                {lines.map((line) => {
                  if (line.kind === "server") {
                    const m = line.message;
                    const staff = m.sender === "staff";
                    const customer = m.sender === "customer";
                    return (
                      <div
                        key={line.id}
                        className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
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
                        className="ml-auto max-w-[92%] rounded-2xl bg-white/10 px-3 py-2 text-sm text-white"
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
                      className="max-w-[92%] rounded-2xl border border-white/10 bg-charcoal/80 px-3 py-2 text-sm text-white/90"
                    >
                      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-gold">
                        Ask Me
                      </p>
                      {line.body}
                    </div>
                  );
                })}

                {faqs.length && !formExpanded ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5 sm:gap-2">
                    {faqs.map((faq) => {
                      const asked = askedFaqIds.includes(faq.id);
                      return (
                        <button
                          key={faq.id}
                          type="button"
                          onClick={() => pickFaq(faq)}
                          className={`rounded-full border px-2.5 py-1.5 text-left text-[11px] leading-snug sm:px-3 sm:text-xs ${
                            asked
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                              : "border-gold/30 bg-gold/5 text-gold hover:bg-gold/15"
                          }`}
                        >
                          {asked ? "✓ " : ""}
                          {faq.question}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 space-y-2 border-t border-white/10 pt-3 pb-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm((v) => !v);
                      setShowLookup(false);
                    }}
                    className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold ${
                      showForm
                        ? "border-gold/50 bg-gold/15 text-gold"
                        : "border-white/15 text-white/85 hover:border-gold/40 hover:text-gold"
                    }`}
                  >
                    Submit your query
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLookup((v) => !v);
                      setShowForm(false);
                    }}
                    className={`rounded-full border px-3 py-2 text-xs ${
                      showLookup
                        ? "border-gold/50 bg-gold/15 text-gold"
                        : "border-white/15 text-muted hover:text-white"
                    }`}
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
                      className="w-full rounded-full gold-gradient py-2.5 text-xs font-semibold text-black disabled:opacity-50"
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
                      rows={2}
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
                      className="w-full rounded-full gold-gradient py-3 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      {pending ? "Sending…" : "Send query"}
                    </button>
                  </div>
                ) : null}

                {error ? <p className="pb-1 text-xs text-red-300">{error}</p> : null}
              </div>
            </div>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openChat())}
        className="relative z-[61] flex h-12 w-12 shrink-0 items-center justify-center rounded-full gold-gradient text-black shadow-lg"
        aria-label={
          open
            ? "Close Ask Me"
            : hasUnreadReply
              ? "Open Ask Me — new reply"
              : "Open Ask Me"
        }
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageSquareText className="h-5 w-5" />
        )}
        {hasUnreadReply && !open ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-[#080808]">
            <Bell className="h-2.5 w-2.5" aria-hidden />
          </span>
        ) : null}
      </button>
    </div>
  );
}
