/**
 * Public settings endpoint for the unauthenticated gate page.
 * Exposes ONLY display fields — never adminPasswordHash, isConfigured, or .env secrets.
 */
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    artistName: settings.artistName,
    labelName: settings.labelName,
    instagramUrl: settings.instagramUrl,
    spotifyUrl: settings.spotifyUrl,
    accentColor: settings.accentColor,
    bpm: settings.bpm,
    logoUrl: settings.logoUrl,
    consentText: settings.consentText,
    privacyText: settings.privacyText,
  });
}
