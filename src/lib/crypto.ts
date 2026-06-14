/**
 * Crypto utilities: PKCE, HMAC tokens, cookie encryption.
 * Node.js built-in only -- no external crypto deps.
 */
import crypto from "crypto";

function getSessionSecret(): string {
  const v = process.env["SESSION_SECRET"];
  if (!v) throw new Error("Missing SESSION_SECRET");
  return v;
}

function getDownloadSecret(): string {
  const v = process.env["DOWNLOAD_TOKEN_SECRET"];
  if (!v) throw new Error("Missing DOWNLOAD_TOKEN_SECRET");
  return v;
}

export function generateCodeVerifier(): string {
  return base64url(crypto.randomBytes(64));
}

export function generateCodeChallenge(verifier: string): string {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}

export function generateState(): string {
  return base64url(crypto.randomBytes(32));
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url").replace(/=+$/, "");
}

export function signDownloadToken(gateId: string, exp: number): string {
  const payload = JSON.stringify({ gateId, exp });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = hmac(getDownloadSecret(), payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyDownloadToken(token: string): { gateId: string; exp: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = hmac(getDownloadSecret(), payloadB64);
  if (!timingSafeCompare(sig, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as {
      gateId: string;
      exp: number;
    };
    if (typeof payload.gateId !== "string" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface FlowCookie {
  verifier: string;
  state: string;
  gateId: string;
  comment: string;
  exp: number;
}

export function encryptFlowCookie(data: FlowCookie): string {
  const payload = JSON.stringify(data);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    deriveKey(getSessionSecret(), "flow"),
    iv
  );
  let encrypted = cipher.update(payload, "utf-8", "base64url");
  encrypted += cipher.final("base64url");
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "base64url")]);
  return base64url(combined);
}

export function decryptFlowCookie(cookie: string): FlowCookie | null {
  try {
    const combined = Buffer.from(cookie, "base64url");
    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(16, 32);
    const encrypted = combined.subarray(32);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      deriveKey(getSessionSecret(), "flow"),
      iv
    );
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, undefined, "utf-8");
    decrypted += decipher.final("utf-8");
    const data = JSON.parse(decrypted) as FlowCookie;
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function signSessionToken(exp: number): string {
  const payload = JSON.stringify({ role: "admin", exp });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = hmac(getSessionSecret(), payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): { role: "admin"; exp: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = hmac(getSessionSecret(), payloadB64);
  if (!timingSafeCompare(sig, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as {
      role: "admin";
      exp: number;
    };
    if (payload.role !== "admin" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function hmac(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("base64url");
}

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function deriveKey(secret: string, context: string): Buffer {
  return crypto.createHmac("sha256", secret).update(`key-derivation:${context}`).digest();
}
