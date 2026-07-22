import { NextResponse } from "next/server";
import { getPortalAuthMethod } from "@/lib/member-portal/portal-auth-settings";

/** Public: which member-portal onboarding method the gym owner selected. */
export async function GET() {
  const authMethod = await getPortalAuthMethod();
  return NextResponse.json({
    ok: true,
    authMethod,
  });
}
