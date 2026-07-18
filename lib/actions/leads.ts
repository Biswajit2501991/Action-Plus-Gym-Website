"use server";

import { z } from "zod";
import { GYM_ID } from "@/lib/config";
import { createAnonServerClient } from "@/lib/supabase/server";

const leadSchema = z.object({
  fullName: z.string().min(2).max(120),
  mobile: z.string().min(6).max(30),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().max(2000).optional(),
  interestPlan: z.string().max(120).optional(),
  goal: z.string().max(200).optional(),
  source: z.enum([
    "website",
    "website_trial",
    "website_contact",
    "website_newsletter",
  ]),
  website: z.string().optional(), // honeypot
});

const rateMap = new Map<string, number>();

function rateLimit(key: string, windowMs = 60_000) {
  const now = Date.now();
  const last = rateMap.get(key) ?? 0;
  if (now - last < windowMs) return false;
  rateMap.set(key, now);
  return true;
}

export type LeadResult = { ok: true } | { ok: false; error: string };

export async function submitLead(input: z.infer<typeof leadSchema>): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check your details and try again." };
  }

  if (parsed.data.website) {
    return { ok: true };
  }

  const key = `${parsed.data.mobile}:${parsed.data.source}`;
  if (!rateLimit(key)) {
    return { ok: false, error: "Please wait a moment before submitting again." };
  }

  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("website_create_visitor", {
    p_gym_id: GYM_ID,
    p_full_name: parsed.data.fullName,
    p_email: parsed.data.email || "",
    p_mobile: parsed.data.mobile,
    p_intake_source: parsed.data.source,
    p_notes: parsed.data.message || null,
    p_interest_plan: parsed.data.interestPlan || null,
    p_goal: parsed.data.goal || null,
  });

  if (error) {
    console.error("lead error", error);
    return { ok: false, error: "Unable to submit right now. Please call us." };
  }

  if (data && data.ok === false) {
    return { ok: false, error: data.error || "Unable to submit." };
  }

  return { ok: true };
}

export async function submitNewsletter(email: string): Promise<LeadResult> {
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (!rateLimit(`newsletter:${email}`, 120_000)) {
    return { ok: false, error: "Already submitted. Please wait." };
  }

  const supabase = createAnonServerClient();
  const { error } = await supabase.from("website_newsletter").insert({
    gym_id: GYM_ID,
    email: email.trim().toLowerCase(),
  });

  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: "Unable to subscribe right now." };
  }

  return { ok: true };
}
