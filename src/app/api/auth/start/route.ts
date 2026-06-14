/**
 * Start OAuth 2.1 + PKCE Flow
 * POST /api/auth/start  -- form submission from gate page
 * Returns 303 See Other redirect to SoundCloud authorize URL.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  encryptFlowCookie,
} from "@/lib/crypto";

const MAX_COMMENT_LENGTH = 280;
const COMMENT_CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

function getClientId(): string {
  const v = process.env.SC_CLIENT_ID;
  if (!v) throw new Error("Missing SC_CLIENT_ID");
  return v;
}

function getRedirectUri(): string {
  const v = process.env.SC_REDIRECT_URI;
  if (!v) throw new Error("Missing SC_REDIRECT_URI");
  return v;
}

function getBaseUrl(): string {
  return process.env.BASE_URL ?? "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const gateId = formData.get("gateId");
  const comment = formData.get("comment");

  if (typeof gateId !== "string" || !gateId) {
    return NextResponse.json({ error: "Missing gateId" }, { status: 400 });
  }

  const rawComment = typeof comment === "string" ? comment : "";
  const cleanedComment = rawComment.replace(COMMENT_CONTROL_CHARS, "").trim();

  if (cleanedComment.length < 1 || cleanedComment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.redirect(
      new URL(`/gate/${encodeURIComponent(gateId)}?status=error&reason=invalid_comment`, getBaseUrl()),
      { status: 303 }
    );
  }

  // Validate gate exists and is active before building PKCE
  const { prisma } = await import("@/lib/prisma");
  const gate = await prisma.gate.findUnique({ where: { id: gateId } });
  if (!gate || !gate.isActive) {
    return NextResponse.redirect(
      new URL(`/gate/${encodeURIComponent(gateId)}?status=error&reason=gate_inactive`, getBaseUrl()),
      { status: 303 }
    );
  }

  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const state = generateState();

  const cookie = encryptFlowCookie({
    verifier,
    state,
    gateId,
    comment: cleanedComment,
    exp: Date.now() + 10 * 60 * 1000,
  });

  const authUrl = new URL("https://secure.soundcloud.com/authorize");
  authUrl.searchParams.set("client_id", getClientId());
  authUrl.searchParams.set("redirect_uri", getRedirectUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString(), { status: 303 });
  response.cookies.set("sc_flow", cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
