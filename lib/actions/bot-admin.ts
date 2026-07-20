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
  const session = await requireSession();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_bot_admin_reply", {
    p_token: session.token,
    p_thread_id: threadId,
    p_body: body,
  });
  return data;
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
