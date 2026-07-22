import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";

export type PortalAuthMethod = "whatsapp_staff" | "auto_identity";

export async function getPortalAuthMethod(): Promise<PortalAuthMethod> {
  const svc = createServiceRoleClient();
  if (!svc.ok) return "whatsapp_staff";
  const { data } = await svc.client
    .from("member_portal_settings")
    .select("auth_method")
    .eq("gym_id", portalGymId())
    .maybeSingle();
  return data?.auth_method === "auto_identity" ? "auto_identity" : "whatsapp_staff";
}
