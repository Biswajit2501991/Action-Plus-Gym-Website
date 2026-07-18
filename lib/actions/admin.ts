"use server";

import { redirect } from "next/navigation";
import { GYM_ID } from "@/lib/config";
import {
  clearAdminCookie,
  getAdminSession,
  isOwnerRole,
  setAdminCookie,
} from "@/lib/auth/session";
import { createAnonServerClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") || "").trim();
  const password = String(formData.get("password") || "");

  if (!login || !password) {
    return { ok: false as const, error: "Enter username and password." };
  }

  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("website_authenticate_staff", {
    p_login: login,
    p_password: password,
    p_gym_id: GYM_ID,
  });

  if (error) {
    console.error(error);
    return { ok: false as const, error: "Login unavailable. Try again." };
  }

  if (!data?.ok || !data.token) {
    return { ok: false as const, error: data?.error || "Invalid credentials." };
  }

  await setAdminCookie(data.token);
  redirect("/admin");
}

export async function logoutAction() {
  const session = await getAdminSession();
  if (session?.token) {
    const supabase = createAnonServerClient();
    await supabase.rpc("website_logout", { p_token: session.token });
  }
  await clearAdminCookie();
  redirect("/admin/login");
}

async function requireSession() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

async function requireOwner() {
  const session = await requireSession();
  if (!isOwnerRole(session.staff_role)) throw new Error("Forbidden");
  return session;
}

export async function saveSettingsAction(payload: Record<string, unknown>) {
  const session = await requireOwner();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_save_settings", {
    p_token: session.token,
    p_payload: payload,
  });
  return data;
}

export async function setSectionAction(sectionKey: string, enabled: boolean) {
  const session = await requireOwner();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_set_section", {
    p_token: session.token,
    p_section_key: sectionKey,
    p_enabled: enabled,
  });
  return data;
}

export async function savePopupAction(payload: Record<string, unknown>) {
  const session = await requireOwner();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_save_popup", {
    p_token: session.token,
    p_payload: payload,
  });
  return data;
}

export async function replaceCollectionAction(
  table: string,
  rows: unknown[],
) {
  const session = await requireOwner();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_replace_collection", {
    p_token: session.token,
    p_table: table,
    p_rows: rows,
  });
  return data;
}

export async function saveReviewsAction(payload: Record<string, unknown>) {
  const session = await requireOwner();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_save_reviews", {
    p_token: session.token,
    p_payload: payload,
  });
  return data;
}

export async function listLeadsAction() {
  const session = await requireSession();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_list_leads", {
    p_token: session.token,
  });
  return data;
}

export async function updateLeadAction(
  leadId: number,
  status: string,
  notes: string,
) {
  const session = await requireSession();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_update_lead", {
    p_token: session.token,
    p_lead_id: leadId,
    p_status: status,
    p_notes: notes,
  });
  return data;
}

export async function overviewAction() {
  const session = await requireSession();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_overview", {
    p_token: session.token,
  });
  return data;
}
