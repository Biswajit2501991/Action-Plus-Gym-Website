import { NextResponse } from "next/server";

/** Public VAPID key for Web Push subscribe (safe to expose). */
export async function GET() {
  const key = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        error: "web-push-not-configured",
        message: "Set WEB_PUSH_VAPID_PUBLIC_KEY on the website service.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, publicKey: key });
}
