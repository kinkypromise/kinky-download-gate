/**
 * OAuth callback handler
 * Sequentially: follow -> like -> repost -> comment (comment is best-effort)
 * One log event per action; never log tokens or comment text.
 */
import { NextRequest, NextResponse } from "next/server";
import { decryptFlowCookie, signDownloadToken } from "@/lib/crypto";
import { exchangeToken, getCurrentUser, followArtist, likeTrack, repostTrack, postComment } from "@/lib/sc-client";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

function getClientId(): string {
  const v = process.env.SC_CLIENT_ID;
  if (!v) throw new Error("Missing SC_CLIENT_ID");
  return v;
}

function getClientSecret(): string {
  const v = process.env.SC_CLIENT_SECRET;
  if (!v) throw new Error("Missing SC_CLIENT_SECRET");
  return v;
}

function getArtistUrn(): string {
  const v = process.env.SC_ARTIST_URN;
  if (!v) throw new Error("Missing SC_ARTIST_URN");
  if (!v.startsWith("soundcloud:users:")) {
    throw new Error(`SC_ARTIST_URN must start with soundcloud:users:, got: ${v}`);
  }
  return v;
}

function getRedirectUri(): string {
  const v = process.env.SC_REDIRECT_URI;
  if (!v) throw new Error("Missing SC_REDIRECT_URI");
  return v;
}

function getBaseUrl(): string {
  const v = process.env.BASE_URL;
  if (v) return v;
  // Fallback: derive from request if no explicit base URL is set
  return "http://localhost:3000";
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

function redirectWithClearedCookie(targetUrl: string | URL): NextResponse {
  const response = NextResponse.redirect(targetUrl);
  response.cookies.delete("sc_flow");
  return response;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimitResponse(`cb:${ip}`, 20, 5 * 60 * 1000);
  if (!rl.allowed) {
    log({ level: "warn", msg: "rate_limit", route: "/callback", ip });
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: rl.headers });
  }

  // Validate SoundCloud artist URN config BEFORE any external call
  let artistUrn: string;
  try {
    artistUrn = getArtistUrn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: "error", msg: "server_config_missing", route: "/callback", ip, error: message });
    return redirectWithClearedCookie(new URL("/?status=error&reason=server_config", getBaseUrl()));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const flowCookie = req.cookies.get("sc_flow")?.value;
  if (!flowCookie) {
    log({ level: "warn", msg: "missing_flow_cookie", route: "/callback", ip });
    return redirectWithClearedCookie(new URL("/?status=error&reason=missing_flow", getBaseUrl()));
  }

  const flow = decryptFlowCookie(flowCookie);
  if (!flow || flow.state !== state) {
    log({ level: "warn", msg: "invalid_flow", route: "/callback", ip });
    return redirectWithClearedCookie(new URL("/?status=error&reason=invalid_flow", getBaseUrl()));
  }

  if (errorParam) {
    log({ level: "warn", msg: "oauth_denied", route: "/callback", ip, gateId: flow.gateId });
    return redirectWithClearedCookie(new URL(`/gate/${flow.gateId}?status=error&reason=oauth_denied`, getBaseUrl()));
  }

  if (!code) {
    log({ level: "warn", msg: "missing_code", route: "/callback", ip, gateId: flow.gateId });
    return redirectWithClearedCookie(new URL(`/gate/${flow.gateId}?status=error&reason=missing_code`, getBaseUrl()));
  }

  // Load gate BEFORE token exchange
  const gate = await prisma.gate.findUnique({ where: { id: flow.gateId } });
  if (!gate || !gate.isActive) {
    log({ level: "warn", msg: "gate_not_found", route: "/callback", ip, gateId: flow.gateId });
    return redirectWithClearedCookie(new URL(`/gate/${flow.gateId}?status=error&reason=gate_inactive`, getBaseUrl()));
  }

  // Token exchange
  let accessToken: string;
  try {
    log({ level: "info", msg: "token_exchange_start", route: "/callback", ip, gateId: flow.gateId });
    const tokenRes = await exchangeToken({
      code,
      redirectUri: getRedirectUri(),
      clientId: getClientId(),
      clientSecret: getClientSecret(),
      codeVerifier: flow.verifier,
    });
    accessToken = tokenRes.access_token;
    log({ level: "info", msg: "token_exchange_ok", route: "/callback", ip, gateId: flow.gateId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: "error", msg: "token_exchange_failed", route: "/callback", ip, gateId: flow.gateId, error: message });
    return redirectWithClearedCookie(new URL(`/gate/${flow.gateId}?status=error&reason=token_exchange`, getBaseUrl()));
  }

  // Sequentially: follow -> like -> repost -> comment
  // One log event per action. Never log the access token or comment text.

  let currentUserUrn: string | undefined;
  try {
    const currentUser = await getCurrentUser(accessToken);
    currentUserUrn = currentUser.urn ?? (currentUser.id ? `soundcloud:users:${currentUser.id}` : undefined);
    log({
      level: "info",
      msg: "current_user_ok",
      route: "/callback",
      ip,
      gateId: flow.gateId,
      currentUserUrn,
      currentUserPermalink: currentUser.permalink,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: "error", msg: "current_user_failed", route: "/callback", ip, gateId: flow.gateId, error: message });
    return redirectWithClearedCookie(new URL(`/gate/${flow.gateId}?status=error&reason=api_error`, getBaseUrl()));
  }

  // 1. Follow
  if (currentUserUrn === artistUrn) {
    log({ level: "info", msg: "follow_skipped_self", route: "/callback", ip, gateId: flow.gateId, artistUrn });
  } else {
    try {
      await followArtist(accessToken, artistUrn);
      log({ level: "info", msg: "follow_ok", route: "/callback", ip, gateId: flow.gateId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log({ level: "error", msg: "follow_failed", route: "/callback", ip, gateId: flow.gateId, error: message, artistUrn, currentUserUrn });
      return redirectWithClearedCookie(new URL(`/gate/${flow.gateId}?status=error&reason=api_error`, getBaseUrl()));
    }
  }

  // 2. Like
  try {
    await likeTrack(accessToken, gate.scTrackUrn);
    log({ level: "info", msg: "like_ok", route: "/callback", ip, gateId: flow.gateId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: "error", msg: "like_failed", route: "/callback", ip, gateId: flow.gateId, error: message });
    return redirectWithClearedCookie(new URL(`/gate/${flow.gateId}?status=error&reason=api_error`, getBaseUrl()));
  }

  // 3. Repost
  try {
    await repostTrack(accessToken, gate.scTrackUrn);
    log({ level: "info", msg: "repost_ok", route: "/callback", ip, gateId: flow.gateId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: "error", msg: "repost_failed", route: "/callback", ip, gateId: flow.gateId, error: message });
    return redirectWithClearedCookie(new URL(`/gate/${flow.gateId}?status=error&reason=api_error`, getBaseUrl()));
  }

  // 4. Comment (best-effort: must not block unlock)
  try {
    await postComment(accessToken, gate.scTrackUrn, flow.comment);
    log({ level: "info", msg: "comment_ok", route: "/callback", ip, gateId: flow.gateId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: "warn", msg: "comment_best_effort_failed", route: "/callback", ip, gateId: flow.gateId, error: message });
  }

  // Success: increment unlock count, sign token, redirect
  let dlToken: string;
  try {
    await prisma.gate.update({
      where: { id: flow.gateId },
      data: { unlockCount: { increment: 1 } },
    });
    dlToken = signDownloadToken(flow.gateId, Date.now() + 15 * 60 * 1000);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: "error", msg: "unlock_finalize_failed", route: "/callback", ip, gateId: flow.gateId, error: message });
    return redirectWithClearedCookie(new URL(`/gate/${flow.gateId}?status=error&reason=server_config`, getBaseUrl()));
  }

  log({ level: "info", msg: "unlock_ok", route: "/callback", ip, gateId: flow.gateId });

  const redirectUrl = new URL(`/gate/${flow.gateId}`, getBaseUrl());
  redirectUrl.searchParams.set("status", "unlocked");
  redirectUrl.searchParams.set("dl", dlToken);

  return redirectWithClearedCookie(redirectUrl.toString());
}
