import { createHash, randomBytes, randomInt } from "crypto";
import { db } from "@/lib/db";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Stores a hashed one-time token and returns the plain value to send by email. */
export async function issueToken(email: string, type: "verify" | "reset" | "otp" | "portal", ttlMinutes: number, plain = newToken()) {
  await db.authToken.updateMany({ where: { email, type, usedAt: null }, data: { usedAt: new Date() } });
  await db.authToken.create({ data: { email, type, tokenHash: sha256(plain), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) } });
  return plain;
}

/** Marks the token used and returns true when it was valid. */
export async function consumeToken(email: string, type: "verify" | "reset" | "otp" | "portal", plain: string) {
  const row = await db.authToken.findFirst({ where: { email, type, tokenHash: sha256(plain), usedAt: null, expiresAt: { gt: new Date() } } });
  if (!row) return false;
  await db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return true;
}
