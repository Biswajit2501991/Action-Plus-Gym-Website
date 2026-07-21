import { createHmac, timingSafeEqual } from "crypto";
import { memberJwtSecret, MEMBER_ACCESS_TTL_SEC } from "@/lib/member-portal/config";

export type MemberAccessClaims = {
  typ: "member_access";
  mid: string; // member_uuid
  did: string; // device_id
  sid: string; // session id
  gid: string; // gym_id
  exp: number;
  iat: number;
};

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const s = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(s, "base64");
}

export function signMemberAccess(
  claims: Omit<MemberAccessClaims, "typ" | "iat" | "exp"> & {
    ttlSec?: number;
  },
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (claims.ttlSec ?? MEMBER_ACCESS_TTL_SEC);
  const payload: MemberAccessClaims = {
    typ: "member_access",
    mid: claims.mid,
    did: claims.did,
    sid: claims.sid,
    gid: claims.gid,
    iat,
    exp,
  };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", memberJwtSecret()).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

export function verifyMemberAccess(token: string): MemberAccessClaims | null {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const data = `${header}.${body}`;
    const expected = createHmac("sha256", memberJwtSecret()).update(data).digest();
    const actual = fromB64url(sig);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as MemberAccessClaims;
    if (payload.typ !== "member_access") return null;
    if (!payload.mid || !payload.did || !payload.sid || !payload.gid) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
