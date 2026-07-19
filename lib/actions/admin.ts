"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GYM_ID } from "@/lib/config";
import {
  clearAdminCookie,
  getAdminSession,
  isOwnerRole,
  setAdminCookie,
} from "@/lib/auth/session";
import { createAnonServerClient, createServerClient } from "@/lib/supabase/server";
import type { WebsiteMedia } from "@/lib/types";
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  WEBSITE_MEDIA_BUCKET,
  mediaKindFromMime,
  safeFileName,
} from "@/lib/media/constants";

function revalidatePublicSite() {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/contact");
}

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
  revalidatePublicSite();
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
  revalidatePublicSite();
  return data;
}

export async function savePopupAction(payload: Record<string, unknown>) {
  const session = await requireOwner();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_save_popup", {
    p_token: session.token,
    p_payload: payload,
  });
  revalidatePublicSite();
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
  revalidatePublicSite();
  return data;
}

export async function saveReviewsAction(payload: Record<string, unknown>) {
  const session = await requireOwner();
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("website_admin_save_reviews", {
    p_token: session.token,
    p_payload: payload,
  });
  revalidatePublicSite();
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

export async function listWebsiteMediaAction() {
  const session = await requireOwner();
  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("website_admin_list_media", {
    p_token: session.token,
  });
  if (error) return { ok: false as const, error: error.message, items: [] };
  return data as { ok: boolean; error?: string; items?: WebsiteMedia[] };
}

export async function uploadWebsiteMediaAction(formData: FormData) {
  const session = await requireOwner();
  const file = formData.get("file");
  const sectionTag = String(formData.get("section_tag") || "").trim();
  const altText = String(formData.get("alt_text") || "").trim();

  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false as const, error: "Choose a file to upload." };
  }

  const kind = mediaKindFromMime(file.type);
  if (!kind) {
    return {
      ok: false as const,
      error: "Only JPG, PNG, WebP, GIF, MP4, WebM, or MOV files are allowed.",
    };
  }

  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max) {
    return {
      ok: false as const,
      error:
        kind === "image"
          ? "Image must be under 10 MB."
          : "Video must be under 50 MB.",
    };
  }

  const gymId = session.gym_id || GYM_ID;
  const stamp = Date.now();
  const clean = safeFileName(file.name) || `${kind}-${stamp}`;
  const storagePath = `gyms/${gymId}/${kind}/${stamp}-${clean}`;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return {
      ok: false as const,
      error:
        "Uploads need SUPABASE_SERVICE_ROLE_KEY in Railway Variables (Supabase → Project Settings → API → service_role).",
    };
  }

  const supabase = createServerClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(WEBSITE_MEDIA_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("uploadWebsiteMediaAction storage", uploadError);
    return { ok: false as const, error: uploadError.message || "Upload failed." };
  }

  const { data: pub } = supabase.storage
    .from(WEBSITE_MEDIA_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = pub.publicUrl;
  const { data: row, error: insertError } = await supabase
    .from("website_media")
    .insert({
      gym_id: gymId,
      file_name: file.name,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: file.type,
      file_size: file.size,
      kind,
      section_tag: sectionTag,
      alt_text: altText,
      uploaded_by: session.staff_login_id || session.full_name || "",
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("uploadWebsiteMediaAction insert", insertError);
    await supabase.storage.from(WEBSITE_MEDIA_BUCKET).remove([storagePath]);
    return {
      ok: false as const,
      error: insertError.message || "Could not save media in database.",
    };
  }

  revalidatePublicSite();
  return { ok: true as const, item: row as WebsiteMedia };
}

export async function deleteWebsiteMediaAction(mediaId: number) {
  const session = await requireOwner();
  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("website_admin_delete_media", {
    p_token: session.token,
    p_media_id: mediaId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePublicSite();
  return data as { ok: boolean; error?: string };
}
