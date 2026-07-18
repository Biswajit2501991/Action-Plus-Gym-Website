import { cookies } from "next/headers";
import { ADMIN_COOKIE, GYM_ID } from "@/lib/config";
import { createAnonServerClient } from "@/lib/supabase/server";
import type { StaffSession } from "@/lib/types";

export async function getAdminSession(): Promise<StaffSession | null> {
  try {
    const jar = await cookies();
    const token = jar.get(ADMIN_COOKIE)?.value;
    if (!token) return null;

    const supabase = createAnonServerClient();
    const { data, error } = await supabase.rpc("website_session_staff", {
      p_token: token,
    });

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    return {
      id: row.staff_user_id,
      full_name: row.full_name,
      staff_login_id: row.staff_login_id,
      staff_role: row.staff_role,
      gym_id: row.gym_id ?? GYM_ID,
      token,
    };
  } catch (error) {
    console.error("getAdminSession failed", error);
    return null;
  }
}

export function isOwnerRole(role: string) {
  return role === "master_owner" || role === "branch_owner";
}

export async function setAdminCookie(token: string) {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}
