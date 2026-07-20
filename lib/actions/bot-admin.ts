"use server";

import { getAdminSession } from "@/lib/auth/session";
import { createAnonServerClient } from "@/lib/supabase/server";

async function requireSession() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function listBotThreadsAction() {
  const session = await requireSession();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_bot_admin_list_threads", {
    p_token: session.token,
  });
  return data;
}

/** Open threads awaiting a staff reply (new / unread for admin). */
export async function countBotUnreadAction(): Promise<number> {
  try {
    const session = await requireSession();
    const supabase = createAnonServerClient();
    const { data } = await supabase.rpc("website_bot_admin_unread_count", {
      p_token: session.token,
    });
    if (!data?.ok) return 0;
    return Number(data.count) || 0;
  } catch {
    return 0;
  }
}

export async function getBotThreadAdminAction(threadId: number) {
  const session = await requireSession();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_bot_admin_get_thread", {
    p_token: session.token,
    p_thread_id: threadId,
  });
  return data;
}

export async function replyBotThreadAction(threadId: number, body: string) {
  try {
    const session = await requireSession();
    const supabase = createAnonServerClient();
    const trimmed = String(body || "").trim();
    if (!trimmed) {
      return { ok: false, error: "Reply required" };
    }
    const { data, error } = await supabase.rpc("website_bot_admin_reply", {
      p_token: session.token,
      p_thread_id: Number(threadId),
      p_body: trimmed,
    });
    if (error) {
      console.error("bot admin reply", error);
      return {
        ok: false,
        error: error.message || "Could not send reply. Please try again.",
      };
    }
    if (!data?.ok) {
      return {
        ok: false,
        error: data?.error || "Could not send reply. Please try again.",
      };
    }
    return data;
  } catch (e) {
    console.error("bot admin reply failed", e);
    return {
      ok: false,
      error:
        e instanceof Error && e.message === "Unauthorized"
          ? "Session expired — please sign in again."
          : e instanceof Error
            ? e.message
            : "Could not send reply.",
    };
  }
}

export async function listBotFaqsAdminAction() {
  const session = await requireSession();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_bot_admin_list_faqs", {
    p_token: session.token,
  });
  return data;
}

export async function saveBotFaqsAdminAction(
  faqs: Array<{
    question: string;
    answer: string;
    sort_order?: number;
    is_active?: boolean;
  }>,
) {
  const session = await requireSession();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_bot_admin_save_faqs", {
    p_token: session.token,
    p_faqs: faqs,
  });
  return data;
}
