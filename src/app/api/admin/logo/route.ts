/**
 * Admin logo upload API
 * POST /api/admin/logo
 * Accepts a single image file (JPEG/PNG/WebP/SVG), validates magic bytes,
 * stores it under STORAGE_DIR/logos, and returns the public URL path.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { extname, resolve, sep } from "path";
import { randomUUID } from "crypto";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage/downloads";
const LOGOS_DIR = resolve(STORAGE_DIR, "logos");
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);

function cleanFileName(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSafeFileName(fileName: string): boolean {
  return (
    fileName.length > 0 &&
    fileName.length <= 180 &&
    fileName !== "." &&
    fileName !== ".." &&
    !fileName.includes("/") &&
    !fileName.includes("\\") &&
    !/[\x00-\x1F\x7F]/.test(fileName)
  );
}

function validateImageHeader(header: Buffer, ext: string): boolean {
  if (ext === ".svg") {
    const text = header.toString("utf-8").trim().toLowerCase();
    return text.includes("<svg") || text.startsWith("<?xml");
  }
  const sig = header.subarray(0, 12).toString("hex");
  if (ext === ".png") return sig.startsWith("89504e47");
  if (ext === ".jpg" || ext === ".jpeg") {
    return sig.startsWith("ffd8ff");
  }
  if (ext === ".webp") {
    const riff = header.subarray(0, 4).toString("ascii");
    const webp = header.subarray(8, 12).toString("ascii");
    return riff === "RIFF" && webp === "WEBP";
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("logo") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No logo file provided" }, { status: 400 });
    }

    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be smaller than 2 MB" }, { status: 413 });
    }

    const originalName = cleanFileName(formData.get("fileName") || file.name);
    if (!isSafeFileName(originalName)) {
      return NextResponse.json({ error: "Invalid logo file name" }, { status: 400 });
    }

    const ext = extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, WebP, and SVG logos are allowed" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 12) {
      return NextResponse.json({ error: "Logo file is too small or empty" }, { status: 400 });
    }

    if (!validateImageHeader(buffer, ext)) {
      return NextResponse.json({ error: "Invalid image file" }, { status: 400 });
    }

    await mkdir(LOGOS_DIR, { recursive: true });

    const baseName = originalName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const uniqueName = `${baseName}_${randomUUID().slice(0, 8)}${ext}`;
    const finalPath = resolve(LOGOS_DIR, uniqueName);

    if (!finalPath.startsWith(LOGOS_DIR + sep)) {
      return NextResponse.json({ error: "Invalid logo path" }, { status: 400 });
    }

    await writeFile(finalPath, buffer);

    const publicUrl = `/storage/logos/${uniqueName}`;

    await prisma.settings.update({
      where: { id: 1 },
      data: { logoUrl: publicUrl },
    });

    return NextResponse.json({ logoUrl: publicUrl });
  } catch (err) {
    console.error("Logo upload error:", err);
    return NextResponse.json({ error: "Logo upload failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const oldUrl = settings?.logoUrl;

    await prisma.settings.update({
      where: { id: 1 },
      data: { logoUrl: "" },
    });

    if (oldUrl && oldUrl.startsWith("/storage/logos/")) {
      const fileName = oldUrl.replace("/storage/logos/", "");
      const oldPath = resolve(LOGOS_DIR, fileName);
      if (oldPath.startsWith(LOGOS_DIR + sep)) {
        await rm(oldPath, { force: true });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Logo delete error:", err);
    return NextResponse.json({ error: "Failed to remove logo" }, { status: 500 });
  }
}
