/**
 * Public Gate info (no auth required)
 * GET /api/gates/[id]
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await prisma.gate.findUnique({ where: { id } });
  if (!gate || !gate.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: gate.id,
    title: gate.title,
    scTrackUrn: gate.scTrackUrn,
    scTrackUrl: gate.scTrackUrl,
  });
}
