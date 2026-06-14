/**
 * Edge-compatible session token verification using WebCrypto API.
 * Used by middleware.ts (Edge runtime) — MUST NOT import Node.js modules.
 */

function getSessionSecret(): string {
  const v = process.env["SESSION_SECRET"];
  if (!v) throw new Error("Missing SESSION_SECRET");
  return v;
}

function base64urlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function verifySessionTokenEdge(token: string): Promise<{ role: string; exp: number } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  let payloadJson: string;
  try {
    payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
  } catch {
    return null;
  }

  let payload: { role?: string; exp: number };
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  if (!payload.exp || typeof payload.exp !== "number") return null;
  if (Date.now() > payload.exp) return null;

  const secret = getSessionSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // HMAC over base64url-encoded payload string, matching signSessionToken
  const payloadBytes = encoder.encode(payloadB64);
  const sigBytes = base64urlDecode(sigB64);

  const valid = await crypto.subtle.verify("HMAC", key, sigBytes as BufferSource, payloadBytes);
  if (!valid) return null;

  return { role: payload.role ?? "admin", exp: payload.exp };
}
