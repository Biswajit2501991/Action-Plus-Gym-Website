/**
 * Per-branch Member Portal soft gates (Website).
 * Missing row → allowed + inherit gym-wide sections.
 * Never rewrites members.portal_enabled.
 */

import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import {
  DEFAULT_PORTAL_SECTIONS,
  mergePortalSections,
  portalSectionsFromSettings,
  type PortalSections,
} from "@/lib/member-portal/portal-ui-config";

export const BRANCH_PORTAL_DISABLED_MESSAGE =
  "Member Portal is turned off for your branch. Contact the gym.";

type BranchRow = {
  portal_enabled?: boolean | null;
  portal_sections?: unknown;
};

export async function loadBranchPortalSettingsRow(
  gymCodeId: string | null | undefined,
): Promise<BranchRow | null> {
  const branchId = String(gymCodeId || "").trim();
  const gymId = portalGymId();
  if (!branchId || !gymId) return null;
  const svc = createServiceRoleClient();
  if (!svc.ok) return null;
  const { data, error } = await svc.client
    .from("member_portal_branch_settings")
    .select("portal_enabled, portal_sections")
    .eq("gym_id", gymId)
    .eq("gym_code_id", branchId)
    .maybeSingle();
  if (error) {
    const msg = String(error.message || "");
    // Table not deployed yet → treat as missing (fully allowed).
    if (/relation|does not exist|schema cache|Could not find/i.test(msg)) {
      return null;
    }
    console.error("[branch-portal] load failed", error.message);
    return null;
  }
  return (data as BranchRow) || null;
}

export function isBranchPortalAllowed(row: BranchRow | null | undefined): boolean {
  if (!row) return true;
  return row.portal_enabled !== false;
}

export function effectivePortalSections(
  gymWideSections: PortalSections,
  branchRow: BranchRow | null | undefined,
): PortalSections {
  const gymWide = mergePortalSections(gymWideSections, DEFAULT_PORTAL_SECTIONS);
  if (!branchRow || branchRow.portal_sections == null) return gymWide;
  return mergePortalSections(branchRow.portal_sections, gymWide);
}

/**
 * Soft gate for login / session. Missing branch or missing row → allowed.
 */
export async function assertBranchPortalAllowed(
  assignedGymCodeId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await loadBranchPortalSettingsRow(assignedGymCodeId);
  if (!isBranchPortalAllowed(row)) {
    return {
      ok: false,
      error: BRANCH_PORTAL_DISABLED_MESSAGE,
      status: 403,
    };
  }
  return { ok: true };
}

/**
 * Load gym-wide + branch override into effective portal sections for a member.
 */
export async function loadEffectivePortalSectionsForMember(input: {
  assignedGymCodeId?: string | null;
  portal_sections?: unknown;
  basic_workout_options?: unknown;
  exerciseTypes?: string[];
}): Promise<PortalSections> {
  const gymWide = portalSectionsFromSettings({
    portal_sections: input.portal_sections,
    basic_workout_options: input.basic_workout_options,
    exerciseTypes: input.exerciseTypes,
  });
  const branchRow = await loadBranchPortalSettingsRow(input.assignedGymCodeId);
  return effectivePortalSections(gymWide, branchRow);
}
