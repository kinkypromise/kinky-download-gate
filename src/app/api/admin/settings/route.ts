/**
 * Admin Settings API
 * GET /api/admin/settings — returns current settings (no password hash)
 * PATCH /api/admin/settings — updates branding fields and optionally admin password
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSettings, invalidateSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    artistName: settings.artistName,
    labelName: settings.labelName,
    instagramUrl: settings.instagramUrl,
    spotifyUrl: settings.spotifyUrl,
    accentColor: settings.accentColor,
    bpm: settings.bpm,
    consentText: settings.consentText,
    privacyText: settings.privacyText,
  });
}

export async function PATCH(req: NextRequest) {
  let body: {
    artistName?: string;
    labelName?: string;
    instagramUrl?: string;
    spotifyUrl?: string;
    accentColor?: string;
    bpm?: number;
    consentText?: string;
    privacyText?: string;
    newPassword?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const artistName = typeof body.artistName === "string" ? body.artistName.trim() : undefined;
  const labelName = typeof body.labelName === "string" ? body.labelName.trim() : undefined;
  const instagramUrl = typeof body.instagramUrl === "string" ? body.instagramUrl.trim() : undefined;
  const spotifyUrl = typeof body.spotifyUrl === "string" ? body.spotifyUrl.trim() : undefined;
  const accentColor = typeof body.accentColor === "string" ? body.accentColor.trim() : undefined;
  const bpm = typeof body.bpm === "number" ? body.bpm : undefined;
  const consentText = typeof body.consentText === "string" ? body.consentText.trim() : undefined;
  const privacyText = typeof body.privacyText === "string" ? body.privacyText.trim() : undefined;
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : undefined;

  if (artistName !== undefined && artistName.length === 0) {
    return NextResponse.json({ error: "Artist name is required" }, { status: 400 });
  }
  if (accentColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
    return NextResponse.json({ error: "Accent color must be a 6-digit hex code" }, { status: 400 });
  }
  if (bpm !== undefined && (bpm < 60 || bpm > 220)) {
    return NextResponse.json({ error: "BPM must be between 60 and 220" }, { status: 400 });
  }
  if (instagramUrl !== undefined && instagramUrl.length > 0 && !instagramUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Instagram URL must start with https://" }, { status: 400 });
  }
  if (spotifyUrl !== undefined && spotifyUrl.length > 0 && !spotifyUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Spotify URL must start with https://" }, { status: 400 });
  }
  if (newPassword !== undefined && newPassword.length > 0 && newPassword.length < 10) {
    return NextResponse.json({ error: "New password must be at least 10 characters" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (artistName !== undefined) data.artistName = artistName;
  if (labelName !== undefined) data.labelName = labelName;
  if (instagramUrl !== undefined) data.instagramUrl = instagramUrl;
  if (spotifyUrl !== undefined) data.spotifyUrl = spotifyUrl;
  if (accentColor !== undefined) data.accentColor = accentColor;
  if (bpm !== undefined) data.bpm = bpm;
  if (consentText !== undefined) data.consentText = consentText;
  if (privacyText !== undefined) data.privacyText = privacyText;
  if (newPassword !== undefined && newPassword.length > 0) {
    data.adminPasswordHash = await bcrypt.hash(newPassword, 12);
  }

  await prisma.settings.update({
    where: { id: 1 },
    data,
  });

  invalidateSettings();

  return NextResponse.json({ success: true });
}
