"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getBotThreadAdminAction,
  replyBotThreadAction,
  saveBotFaqsAdminAction,
} from "@/lib/actions/bot-admin";
import {
  AdminPageHeader,
  Field,
  SaveBar,
  TextInput,
  TextTextarea,
  Toggle,
} from "@/components/admin/form-ui";

type ThreadSummary = {
  id: number;
  customer_name: string;
  mobile: string;
  email?: string | null;
  status: string;
  last_message?: string | null;
  customer_message_count?: number;
  created_at: string;
  updated_at: string;
};

type FaqRow = {
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};

type ChatMsg = {
  id: number;
  sender: string;
  body: string;
  staff_name?: string | null;
  created_at: string;
};

export function MessagesBoard({
  initialThreads,
  initialFaqs,
}: {
  initialThreads: ThreadSummary[];
  initialFaqs: FaqRow[];
}) {
  const [tab, setTab] = useState<"inbox" | "faqs">("inbox");
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialThreads[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [reply, setReply] = useState("");
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<FaqRow[]>(() =>
    initialFaqs.length
      ? initialFaqs
      : [{ question: "", answer: "", sort_order: 0, is_active: true }],
  );

  const selected = useMemo(
    () => threads.find((t) => t.id === selectedId) || null,
    [threads, selectedId],
  );

  function openThread(id: number) {
    setSelectedId(id);
    setMsg(null);
    setLoadingThread(true);
    void (async () => {
      try {
        const data = await getBotThreadAdminAction(id);
        if (data?.ok) {
          setMessages((data.messages ?? []) as ChatMsg[]);
        }
      } finally {
        setLoadingThread(false);
      }
    })();
  }

  useEffect(() => {
    if (initialThreads[0]?.id != null) {
      openThread(initialThreads[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sendReply() {
    if (!selectedId || !reply.trim() || sending) return;
    const text = reply.trim();
    const threadId = selectedId;
    setMsg(null);
    setSending(true);
    void (async () => {
      try {
        const data = await replyBotThreadAction(threadId, text);
        if (!data?.ok) {
          setMsg(data?.error || "Could not send reply.");
          return;
        }
        setReply("");
        setMsg("Reply sent — customer will see it in Ask Me.");
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  status: "answered",
                  last_message: text.slice(0, 120),
                  updated_at: new Date().toISOString(),
                }
              : t,
          ),
        );
        const refreshed = await getBotThreadAdminAction(threadId);
        if (refreshed?.ok) setMessages((refreshed.messages ?? []) as ChatMsg[]);
      } catch (e) {
        setMsg(
          e instanceof Error ? e.message : "Could not send reply. Please try again.",
        );
      } finally {
        setSending(false);
      }
    })();
  }

  function saveFaqs() {
    setMsg(null);
    startTransition(async () => {
      const payload = faqs
        .filter((f) => f.question.trim() && f.answer.trim())
        .map((f, i) => ({
          question: f.question.trim(),
          answer: f.answer.trim(),
          sort_order: i,
          is_active: f.is_active !== false,
        }));
      const data = await saveBotFaqsAdminAction(payload);
      if (!data?.ok) {
        setMsg(data?.error || "Could not save questions.");
        return;
      }
      setMsg(`Saved ${data.count ?? payload.length} bot questions.`);
    });
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Messages"
        description="Customer Ask Me enquiries and bot auto-reply questions."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("inbox")}
          className={
            tab === "inbox"
              ? "rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black"
              : "rounded-full border border-white/15 px-4 py-2 text-sm text-muted hover:text-white"
          }
        >
          Inbox ({threads.filter((t) => t.status === "open").length} open)
        </button>
        <button
          type="button"
          onClick={() => setTab("faqs")}
          className={
            tab === "faqs"
              ? "rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black"
              : "rounded-full border border-white/15 px-4 py-2 text-sm text-muted hover:text-white"
          }
        >
          Bot questions
        </button>
      </div>

      {tab === "inbox" ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="max-h-[70vh] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-charcoal/40 p-3">
            {threads.length === 0 ? (
              <p className="p-3 text-sm text-muted">No customer messages yet.</p>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openThread(t.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    selectedId === t.id
                      ? "border-gold/50 bg-gold/10"
                      : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {t.customer_name}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        t.status === "open"
                          ? "bg-amber-500 text-black"
                          : t.status === "answered"
                            ? "bg-emerald-700 text-[#ecfdf5]"
                            : "bg-[color:var(--surface-mid)] text-muted"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{t.mobile}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-white/60">
                    {t.last_message || "—"}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="flex min-h-[70vh] flex-col rounded-2xl border border-white/10 bg-charcoal/40">
            {!selected ? (
              <p className="m-auto text-sm text-muted">Select a conversation.</p>
            ) : (
              <>
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="font-display text-xl text-white">
                    {selected.customer_name}
                  </p>
                  <p className="text-xs text-muted">
                    {selected.mobile}
                    {selected.email ? ` · ${selected.email}` : ""}
                  </p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {loadingThread && messages.length === 0 ? (
                    <p className="text-sm text-muted">Loading conversation…</p>
                  ) : null}
                  {messages.length === 0 && !loadingThread ? (
                    <p className="text-sm text-muted">
                      Open this conversation to load messages, or send a reply.
                    </p>
                  ) : null}
                  {messages.map((m) => {
                    const fromStaff = m.sender === "staff";
                    const fromBot = m.sender === "bot";
                    return (
                      <div
                        key={m.id}
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                          fromStaff
                            ? "ml-auto bg-gold/15 text-gold-soft"
                            : fromBot
                              ? "bg-white/5 text-white/80"
                              : "bg-white/10 text-white"
                        }`}
                      >
                        <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted">
                          {fromStaff
                            ? m.staff_name || "Action Plus Gym"
                            : fromBot
                              ? "Ask Me"
                              : "Customer"}
                        </p>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-2 text-[10px] text-muted">
                          {new Date(m.created_at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-white/10 p-4">
                  <Field label="Reply as Action Plus Gym">
                    <TextTextarea
                      rows={3}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Warm, clear reply the customer will see in Ask Me…"
                    />
                  </Field>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={sending || loadingThread || !reply.trim()}
                      onClick={sendReply}
                      className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      {sending ? "Sending…" : "Send reply"}
                    </button>
                    {msg ? (
                      <p
                        className={`text-sm ${
                          msg.startsWith("Reply sent")
                            ? "text-emerald-300"
                            : "text-red-300"
                        }`}
                      >
                        {msg}
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveFaqs();
          }}
        >
          <p className="text-sm text-muted">
            These questions appear as chips in the Ask Me chat. Answers show instantly
            when a visitor taps one.
          </p>
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="space-y-3 rounded-2xl border border-white/10 bg-charcoal/40 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-gold">
                  Question {index + 1}
                </p>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-white"
                  onClick={() =>
                    setFaqs((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
              <Field label="Question">
                <TextInput
                  value={faq.question}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, question: e.target.value } : row,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Auto-reply">
                <TextTextarea
                  rows={3}
                  value={faq.answer}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, answer: e.target.value } : row,
                      ),
                    )
                  }
                />
              </Field>
              <Toggle
                label="Active on website"
                hint="Hidden when off"
                checked={faq.is_active !== false}
                onChange={(next) =>
                  setFaqs((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, is_active: next } : row,
                    ),
                  )
                }
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setFaqs((prev) => [
                ...prev,
                {
                  question: "",
                  answer: "",
                  sort_order: prev.length,
                  is_active: true,
                },
              ])
            }
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:border-gold/40 hover:text-gold"
          >
            + Add question
          </button>
          <SaveBar pending={pending} message={msg} label="Save bot questions" />
        </form>
      )}
    </div>
  );
}
