"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { GYM_ID } from "@/lib/config";
import { createAnonServerClient } from "@/lib/supabase/server";

const rateMap = new Map<string, number>();

function rateLimit(key: string, windowMs = 60_000) {
  const now = Date.now();
  const last = rateMap.get(key) ?? 0;
  if (now - last < windowMs) return false;
  rateMap.set(key, now);
  return true;
}

export type BotFaq = {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
};

export type BotMessage = {
  id: number;
  sender: "customer" | "staff" | "bot";
  body: string;
  staff_name?: string | null;
  created_at: string;
};

export type BotThread = {
  id: number;
  public_token: string;
  customer_name: string;
  mobile: string;
  email?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function listBotFaqsAction(): Promise<BotFaq[]> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("website_bot_list_faqs", {
    p_gym_id: GYM_ID,
  });
  if (error || !data?.ok) {
    console.error("bot faqs", error);
    return [];
  }
  return (data.faqs ?? []) as BotFaq[];
}

const enquirySchema = z.object({
  fullName: z.string().min(2).max(120),
  mobile: z.string().min(6).max(30),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().min(2).max(2000),
  publicToken: z.string().uuid().optional().or(z.literal("")),
  website: z.string().optional(),
});

export async function submitBotEnquiryAction(
  input: z.infer<typeof enquirySchema>,
): Promise<{ ok: true; publicToken: string } | { ok: false; error: string }> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check your details and try again." };
  }
  if (parsed.data.website) return { ok: true, publicToken: randomUUID() };

  const key = `bot:${parsed.data.mobile}`;
  if (!rateLimit(key)) {
    return { ok: false, error: "Please wait a moment before submitting again." };
  }

  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("website_bot_submit_enquiry", {
    p_gym_id: GYM_ID,
    p_full_name: parsed.data.fullName,
    p_mobile: parsed.data.mobile,
    p_message: parsed.data.message,
    p_email: parsed.data.email || null,
    p_public_token: parsed.data.publicToken || null,
  });

  if (error) {
    console.error("bot submit", error);
    return { ok: false, error: "Unable to submit right now. Please call us." };
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error || "Unable to submit." };
  }
  return { ok: true, publicToken: String(data.public_token) };
}

export async function getBotThreadAction(opts: {
  publicToken?: string;
  mobile?: string;
}): Promise<
  | { ok: true; thread: BotThread; messages: BotMessage[] }
  | { ok: false; error: string }
> {
  const token = opts.publicToken?.trim() || null;
  const mobile = opts.mobile?.trim() || null;
  if (!token && !mobile) {
    return { ok: false, error: "Missing conversation." };
  }

  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("website_bot_get_thread", {
    p_gym_id: GYM_ID,
    p_public_token: token,
    p_mobile: mobile,
  });

  if (error) {
    console.error("bot get thread", error);
    return { ok: false, error: "Unable to load conversation." };
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error || "Conversation not found." };
  }
  return {
    ok: true,
    thread: data.thread as BotThread,
    messages: (data.messages ?? []) as BotMessage[],
  };
}
