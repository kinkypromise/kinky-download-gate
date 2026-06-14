/**
 * Single Gate operations
 * PATCH /api/admin/gates/[id] -- toggle isActive
 * DELETE /api/admin/gates/[id] -- delete gate + file
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { resolve } from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage/downloads";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const gate = await prisma.gate.update({
    where: { id },
    data: { isActive: typeof body.isActive === "boolean" ? body.isActive : undefined },
  });
  return NextResponse.json(gate);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await prisma.gate.findUnique({ where: { id } });
  if (!gate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.gate.delete({ where: { id } });

  try {
    await unlink(resolve(STORAGE_DIR, gate.fileName));
  } catch {
    // File may already be gone
  }

  return NextResponse.json({ success: true });
}
