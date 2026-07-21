import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function randomOtp6(): string {
  const n = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  return String(n).padStart(6, "0");
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pin, hash);
  } catch {
    return false;
  }
}

export function hashOtp(code: string, salt: string): string {
  return sha256(`${salt}:${code}`);
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
