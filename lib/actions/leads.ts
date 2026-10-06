"use server";

import { z } from "zod";
import { GYM_ID } from "@/lib/config";
import { findMembersByMobile } from "@/lib/member-portal/members";
import { leadMobileError, normalizeMobile } from "@/lib/member-portal/phone";
import { LEAD_DUPLICATE_ERROR, leadFillError, leadSpamError } from "@/lib/site/lead-guard";
import { hasRecentEnquiry } from "@/lib/site/recent-enquiry";
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
  startedAt: z.number().optional(),
  confirm: z.boolean().optional(),
});

/** Join Now / Free Trial / Contact — skip saving when mobile already belongs to a member. */
const MEMBER_CHECK_SOURCES = new Set([
  "website",
  "website_trial",
  "website_contact",
]);

const ALREADY_MEMBER_NOTE =
  "You are already a member. Please contact the gym for your membership update or any queries.";

const rateMap = new Map<string, number>();

function rateLimit(key: string, windowMs = 60_000) {
  const now = Date.now();
  const last = rateMap.get(key) ?? 0;
  if (now - last < windowMs) return false;
  rateMap.set(key, now);
  return true;
}

export type LeadResult =
  | { ok: true; confirmWhatsApp?: boolean; mobile?: string }
  | { ok: false; error: string }
  | { ok: false; alreadyMember: true; note: string };

/** Newsletter never returns alreadyMember — keep a narrow type for Footer. */
export type NewsletterResult = { ok: true } | { ok: false; error: string };

export async function submitLead(input: z.infer<typeof leadSchema>): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check your details and try again." };
  }

  if (parsed.data.website) {
    return { ok: true };
  }

  const needsRealMobile = MEMBER_CHECK_SOURCES.has(parsed.data.source);
  const mobile = needsRealMobile ? normalizeMobile(parsed.data.mobile) : parsed.data.mobile;
  if (needsRealMobile) {
    const mobileError = leadMobileError(parsed.data.mobile);
    if (mobileError) return { ok: false, error: mobileError };
    const spamError = leadSpamError([
      parsed.data.fullName,
      parsed.data.message,
      parsed.data.interestPlan,
      parsed.data.goal,
    ]);
    if (spamError) return { ok: false, error: spamError };
    const fillError = leadFillError(parsed.data.startedAt);
    if (fillError) return { ok: false, error: fillError };
  }

  const key = `${mobile}:${parsed.data.source}`;
  if (parsed.data.confirm && !rateLimit(key)) {
    return { ok: false, error: "Please wait a moment before submitting again." };
  }

  // Existing members: show a note and do not create a website lead/visitor row.
  if (needsRealMobile) {
    try {
      const listed = await findMembersByMobile(mobile);
      if (listed.ok && listed.members.length > 0) {
        return { ok: false, alreadyMember: true, note: ALREADY_MEMBER_NOTE };
      }
      // Lookup failure → fall through and save (do not block genuine new leads).
    } catch (err) {
      console.error("lead member-mobile check", err);
    }
  }

  if (needsRealMobile && !parsed.data.confirm) {
    return { ok: true, confirmWhatsApp: true, mobile };
  }

  if (needsRealMobile && (await hasRecentEnquiry(mobile, parsed.data.message || ""))) {
    return { ok: false, error: LEAD_DUPLICATE_ERROR };
  }

  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("website_create_visitor", {
    p_gym_id: GYM_ID,
    p_full_name: parsed.data.fullName,
    p_email: parsed.data.email || "",
    p_mobile: mobile,
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

  return needsRealMobile ? { ok: true, confirmWhatsApp: true, mobile } : { ok: true };
}

export async function submitNewsletter(email: string): Promise<NewsletterResult> {
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
