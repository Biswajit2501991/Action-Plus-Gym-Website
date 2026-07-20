"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { GYM_ID } from "@/lib/config";
import { createAnonServerClient } from "@/lib/supabase/server";

const rateMap = new Map<string, number>();

function isRateLimited(key: string, windowMs: number) {
  const now = Date.now();
  const last = rateMap.get(key) ?? 0;
  return now - last < windowMs;
}

function markRateLimited(key: string) {
  rateMap.set(key, Date.now());
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const enquirySchema = z.object({
  fullName: z.string().min(2, "Enter your full name (at least 2 characters).").max(120),
  mobile: z.string().min(6, "Enter a valid mobile number.").max(30),
  email: z.union([
    z.literal(""),
    z.string().email("Enter a valid email, or leave it blank."),
  ]),
  message: z.string().min(2, "Enter your query.").max(2000),
  publicToken: z.union([z.literal(""), z.string().uuid()]),
  website: z.string().optional(),
});

function normalizeEnquiryInput(input: Record<string, unknown>) {
  const rawToken = String(input.publicToken ?? "").trim();
  return {
    fullName: String(input.fullName ?? "").trim(),
    mobile: String(input.mobile ?? "")
      .trim()
      .replace(/[\s\-()]/g, ""),
    email: String(input.email ?? "").trim(),
    message: String(input.message ?? "").trim(),
    // Drop stale/invalid localStorage tokens so they don't fail validation.
    publicToken: UUID_RE.test(rawToken) ? rawToken : "",
    website: String(input.website ?? ""),
  };
}

export async function submitBotEnquiryAction(
  input: Record<string, unknown>,
): Promise<{ ok: true; publicToken: string } | { ok: false; error: string }> {
  const parsed = enquirySchema.safeParse(normalizeEnquiryInput(input));
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return {
      ok: false,
      error: first || "Please check your details and try again.",
    };
  }
  if (parsed.data.website) return { ok: true, publicToken: randomUUID() };

  // Follow-ups on an existing chat are allowed more often than brand-new enquiries.
  // Only mark the rate limit AFTER a successful save so failed attempts can retry.
  const rateKey = parsed.data.publicToken
    ? `bot-followup:${parsed.data.publicToken}`
    : `bot:${parsed.data.mobile}`;
  const rateWindowMs = parsed.data.publicToken ? 8_000 : 20_000;
  if (isRateLimited(rateKey, rateWindowMs)) {
    return { ok: false, error: "Please wait a moment before submitting again." };
  }

  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("website_bot_submit_enquiry", {
    p_gym_id: GYM_ID,
    p_full_name: parsed.data.fullName,
    p_mobile: parsed.data.mobile,
    p_message: parsed.data.message,
    p_email: parsed.data.email || null,
    p_public_token: parsed.data.publicToken ? parsed.data.publicToken : null,
  });

  if (error) {
    console.error("bot submit", error);
    return { ok: false, error: "Unable to submit right now. Please call us." };
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error || "Unable to submit." };
  }
  markRateLimited(rateKey);
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
