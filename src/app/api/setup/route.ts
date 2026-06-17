/**
 * First-run setup API
 * POST /api/setup
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/crypto";
import { invalidateSettings } from "@/lib/settings";
import { writePortToEnvLocal } from "@/lib/env-port";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  let body: {
    password?: string;
    artistName?: string;
    labelName?: string;
    instagramUrl?: string;
    spotifyUrl?: string;
    accentColor?: string;
    bpm?: number;
    port?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing?.isConfigured) {
    return NextResponse.json({ error: "Setup has already been completed" }, { status: 409 });
  }

  const password = body.password;
  if (!password || typeof password !== "string" || password.length < 10) {
    return NextResponse.json({ error: "Admin password must be at least 10 characters" }, { status: 400 });
  }

  const artistName = typeof body.artistName === "string" && body.artistName.trim().length > 0
    ? body.artistName.trim()
    : "Your Artist Name";
  const labelName = typeof body.labelName === "string" ? body.labelName.trim() : "";
  const instagramUrl = typeof body.instagramUrl === "string" ? body.instagramUrl.trim() : "";
  const spotifyUrl = typeof body.spotifyUrl === "string" ? body.spotifyUrl.trim() : "";
  const accentColor = typeof body.accentColor === "string" ? body.accentColor.trim() : "#f22e8c";
  const bpm = typeof body.bpm === "number" ? body.bpm : 160;
  const port = typeof body.port === "number" ? body.port : 3000;

  if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
    return NextResponse.json({ error: "Accent color must be a 6-digit hex code" }, { status: 400 });
  }
  if (bpm < 60 || bpm > 220) {
    return NextResponse.json({ error: "BPM must be between 60 and 220" }, { status: 400 });
  }
  if (port < 1024 || port > 65535) {
    return NextResponse.json({ error: "Port must be between 1024 and 65535" }, { status: 400 });
  }
  if (instagramUrl && !instagramUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Instagram URL must start with https://" }, { status: 400 });
  }
  if (spotifyUrl && !spotifyUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Spotify URL must start with https://" }, { status: 400 });
  }

  const adminPasswordHash = await bcrypt.hash(password, 12);

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      artistName,
      labelName,
      instagramUrl,
      spotifyUrl,
      accentColor,
      bpm,
      port,
      consentText: `By unlocking, you will follow ${artistName} on SoundCloud, like and repost this track, and post your comment.`,
      privacyText: `We only use your SoundCloud login to follow ${artistName} and like, repost, and comment on this track — nothing else. No email access. No newsletter. No stored fan profile.`,
      adminPasswordHash,
      isConfigured: true,
    },
    create: {
      id: 1,
      artistName,
      labelName,
      instagramUrl,
      spotifyUrl,
      accentColor,
      bpm,
      port,
      consentText: `By unlocking, you will follow ${artistName} on SoundCloud, like and repost this track, and post your comment.`,
      privacyText: `We only use your SoundCloud login to follow ${artistName} and like, repost, and comment on this track — nothing else. No email access. No newsletter. No stored fan profile.`,
      adminPasswordHash,
      isConfigured: true,
    },
  });

  try {
    await writePortToEnvLocal(port);
  } catch {
    // Non-fatal: the port is already saved in the database; the user can set PORT manually.
  }

  invalidateSettings();

  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const token = signSessionToken(exp);

  const cookieStore = await cookies();
  cookieStore.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
