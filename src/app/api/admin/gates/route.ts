/**
 * Admin Gate CRUD
 * GET  /api/admin/gates  -- list all gates
 * POST /api/admin/gates  -- create new gate with upload
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, extname, sep } from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage/downloads";
const MAX_UPLOAD_BYTES = 220 * 1024 * 1024;

function validateAudioFile(buffer: Buffer, ext: string): boolean {
  const lower = ext.toLowerCase();
  if (lower === ".wav") {
    const container = buffer.subarray(0, 4).toString("ascii");
    const waveMarker = buffer.subarray(8, 12).toString("ascii");
    return (container === "RIFF" || container === "RF64") && waveMarker === "WAVE";
  }
  if (lower === ".mp3") {
    const sig = buffer.slice(0, 3).toString("hex");
    return sig.startsWith("494433") || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  }
  return false;
}

function cleanText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSafeOriginalFileName(fileName: string): boolean {
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

export async function GET() {
  const gates = await prisma.gate.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(gates);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const title = cleanText(formData.get("title"));
    const scTrackUrl = cleanText(formData.get("scTrackUrl"));
    const scTrackUrn = cleanText(formData.get("scTrackUrn"));
    const file = formData.get("file") as File | null;

    if (!title || !scTrackUrl || !scTrackUrn || !file) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!scTrackUrn.startsWith("soundcloud:tracks:")) {
      return NextResponse.json({ error: "SoundCloud Track URN must start with soundcloud:tracks:" }, { status: 400 });
    }

    if (file.size < 12) {
      return NextResponse.json({ error: "Audio file is empty or incomplete" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Audio file is too large. Maximum upload size is 220 MB." }, { status: 413 });
    }

    const originalFileName = file.name.trim();
    if (!isSafeOriginalFileName(originalFileName)) {
      return NextResponse.json({ error: "Invalid audio file name" }, { status: 400 });
    }

    const ext = extname(originalFileName).toLowerCase();
    if (ext !== ".wav" && ext !== ".mp3") {
      return NextResponse.json({ error: "Only WAV or MP3 files are allowed" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!validateAudioFile(buffer, ext)) {
      return NextResponse.json({ error: "Invalid audio file. WAV files must be RIFF/RF64 WAVE; MP3 files must have an MP3 frame or ID3 header." }, { status: 400 });
    }

    const fileName = originalFileName;
    const storagePath = resolve(STORAGE_DIR);
    if (!existsSync(storagePath)) {
      await mkdir(storagePath, { recursive: true });
    }

    const finalPath = resolve(storagePath, fileName);
    if (!finalPath.startsWith(storagePath + sep)) {
      return NextResponse.json({ error: "Invalid audio file name" }, { status: 400 });
    }
    if (existsSync(finalPath)) {
      return NextResponse.json({ error: "An audio file with this name already exists. Please delete the existing gate first or choose a different file name." }, { status: 409 });
    }

    await writeFile(finalPath, buffer);

    const gate = await prisma.gate.create({
      data: {
        title,
        scTrackUrl,
        scTrackUrn,
        fileName,
        fileSizeBytes: buffer.length,
        isActive: true,
      },
    });

    return NextResponse.json(gate, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
