/**
 * Setup-Script: Ermittelt die eigene SoundCloud User-URN via einmaligem PKCE-Flow.
 */
import crypto from "crypto";
import readline from "readline";
import "dotenv/config";

const SC_CLIENT_ID = process.env.SC_CLIENT_ID!;
const SC_CLIENT_SECRET = process.env["SC_CLIENT_SECRET"]!;
const SC_REDIRECT_URI = process.env.SC_REDIRECT_URI!;

if (!SC_CLIENT_ID || !SC_CLIENT_SECRET || !SC_REDIRECT_URI) {
  console.error("Missing env vars: SC_CLIENT_ID, SC_CLIENT_SECRET, SC_REDIRECT_URI");
  process.exit(1);
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url").replace(/=+$/, "");
}

function generatePKCE() {
  const verifier = base64url(crypto.randomBytes(64));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(32));
  return { verifier, challenge, state };
}

const { verifier, challenge, state } = generatePKCE();

const authUrl = new URL("https://secure.soundcloud.com/authorize");
authUrl.searchParams.set("client_id", SC_CLIENT_ID);
authUrl.searchParams.set("redirect_uri", SC_REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("code_challenge", challenge);
authUrl.searchParams.set("code_challenge_method", "S256");
authUrl.searchParams.set("state", state);

console.log("\n=== ESCA Download Gate -- URN Resolver ===\n");
console.log("1. Oeffne folgende URL im Browser und logge dich bei SoundCloud ein:");
console.log("\n   " + authUrl.toString() + "\n");
console.log("2. Nach dem Redirect kopiere den code aus der URL und fuege ihn hier ein.\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Code: ", async (code) => {
  rl.close();
  const trimmed = code.trim();
  if (!trimmed) {
    console.error("Kein Code eingegeben. Abbruch.");
    process.exit(1);
  }

  try {
    const tokenRes = await fetch("https://secure.soundcloud.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: trimmed,
        redirect_uri: SC_REDIRECT_URI,
        client_id: SC_CLIENT_ID,
        client_secret: SC_CLIENT_SECRET,
        code_verifier: verifier,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("Token exchange failed:", tokenRes.status, body);
      process.exit(1);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const accessToken = tokenData.access_token;

    const meRes = await fetch("https://api.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    if (!meRes.ok) {
      const body = await meRes.text();
      console.error("GET /me failed:", meRes.status, body);
      process.exit(1);
    }

    const me = (await meRes.json()) as {
      urn: string;
      username: string;
      permalink_url: string;
    };
    console.log("\n=== Erfolg ===");
    console.log("Username:", me.username);
    console.log("Permalink:", me.permalink_url);
    console.log("URN:", me.urn);
    console.log("\nTrage folgenden Wert in deine .env ein:");
    console.log(`SC_ARTIST_URN="${me.urn}"\n`);
  } catch (err) {
    console.error("Fehler:", err);
    process.exit(1);
  }
});
