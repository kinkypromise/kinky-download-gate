/**
 * Chunked admin audio uploads.
 * Keeps each request below nginx upload limits, then finalizes the gate record.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendFile, mkdir, open, rename, rm, stat } from "fs/promises";
import { existsSync } from "fs";
import { dirname, extname, resolve, sep } from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage/downloads";
const TMP_DIR = resolve(STORAGE_DIR, ".uploads");
const MAX_FILE_BYTES = 600 * 1024 * 1024;
const MAX_CHUNK_BYTES = 12 * 1024 * 1024;
const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseIntField(value: FormDataEntryValue | null): number {
  const n = Number(cleanText(value));
  return Number.isInteger(n) ? n : -1;
}

function safeUploadPath(uploadId: string): string | null {
  if (!UPLOAD_ID_RE.test(uploadId)) return null;
  const path = resolve(TMP_DIR, `${uploadId}.part`);
  return path.startsWith(TMP_DIR) ? path : null;
}

function safeExt(fileName: string): ".wav" | ".mp3" | null {
  const ext = extname(fileName).toLowerCase();
  return ext === ".wav" || ext === ".mp3" ? ext : null;
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

function validateAudioHeader(header: Buffer, ext: string): boolean {
  if (ext === ".wav") {
    const container = header.subarray(0, 4).toString("ascii");
    const waveMarker = header.subarray(8, 12).toString("ascii");
    return (container === "RIFF" || container === "RF64") && waveMarker === "WAVE";
  }

  if (ext === ".mp3") {
    const sig = header.subarray(0, 3).toString("hex");
    return sig.startsWith("494433") || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
  }

  return false;
}

async function readHeader(path: string): Promise<Buffer> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const action = cleanText(formData.get("action"));

    if (action === "chunk") {
      const uploadId = cleanText(formData.get("uploadId"));
      const chunkIndex = parseIntField(formData.get("chunkIndex"));
      const totalChunks = parseIntField(formData.get("totalChunks"));
      const fileName = cleanText(formData.get("fileName"));
      const file = formData.get("file") as File | null;
      const uploadPath = safeUploadPath(uploadId);

      if (!uploadPath || !file || !fileName || chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
        return NextResponse.json({ error: "Invalid upload chunk" }, { status: 400 });
      }

      if (!safeExt(fileName)) {
        return NextResponse.json({ error: "Only WAV or MP3 files are allowed" }, { status: 400 });
      }

      if (file.size <= 0 || file.size > MAX_CHUNK_BYTES) {
        return NextResponse.json({ error: "Upload chunk is too large" }, { status: 413 });
      }

      await mkdir(dirname(uploadPath), { recursive: true });
      if (chunkIndex === 0) {
        await rm(uploadPath, { force: true });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      await appendFile(uploadPath, buffer);
      const stats = await stat(uploadPath);

      if (stats.size > MAX_FILE_BYTES) {
        await rm(uploadPath, { force: true });
        return NextResponse.json({ error: "Audio file is too large. Maximum upload size is 600 MB." }, { status: 413 });
      }

      return NextResponse.json({ uploadId, receivedBytes: stats.size, complete: chunkIndex + 1 === totalChunks });
    }

    if (action === "finalize") {
      const uploadId = cleanText(formData.get("uploadId"));
      const title = cleanText(formData.get("title"));
      const scTrackUrl = cleanText(formData.get("scTrackUrl"));
      const scTrackUrn = cleanText(formData.get("scTrackUrn"));
      const originalFileName = cleanText(formData.get("fileName"));
      const expectedSize = parseIntField(formData.get("fileSize"));
      const uploadPath = safeUploadPath(uploadId);
      const ext = safeExt(originalFileName);

      if (!uploadPath || !title || !scTrackUrl || !scTrackUrn || !originalFileName || !ext) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }

      if (!scTrackUrn.startsWith("soundcloud:tracks:")) {
        return NextResponse.json({ error: "SoundCloud Track URN must start with soundcloud:tracks:" }, { status: 400 });
      }

      const uploaded = await stat(uploadPath).catch(() => null);
      if (!uploaded || uploaded.size < 12) {
        return NextResponse.json({ error: "Uploaded audio file is empty or incomplete" }, { status: 400 });
      }

      if (expectedSize > 0 && uploaded.size !== expectedSize) {
        return NextResponse.json({ error: "Uploaded audio file size does not match the selected file" }, { status: 400 });
      }

      if (uploaded.size > MAX_FILE_BYTES) {
        await rm(uploadPath, { force: true });
        return NextResponse.json({ error: "Audio file is too large. Maximum upload size is 600 MB." }, { status: 413 });
      }

      const header = await readHeader(uploadPath);
      if (!validateAudioHeader(header, ext)) {
        await rm(uploadPath, { force: true });
        return NextResponse.json({ error: "Invalid audio file. WAV files must be RIFF/RF64 WAVE; MP3 files must have an MP3 frame or ID3 header." }, { status: 400 });
      }

      const storagePath = resolve(STORAGE_DIR);
      if (!existsSync(storagePath)) {
        await mkdir(storagePath, { recursive: true });
      }

      if (!isSafeOriginalFileName(originalFileName)) {
        return NextResponse.json({ error: "Invalid audio file name" }, { status: 400 });
      }

      const fileName = originalFileName;
      const finalPath = resolve(storagePath, fileName);
      if (!finalPath.startsWith(storagePath + sep)) {
        return NextResponse.json({ error: "Invalid audio file name" }, { status: 400 });
      }
      if (existsSync(finalPath)) {
        return NextResponse.json({ error: "An audio file with this name already exists. Please delete the existing gate first or choose a different file name." }, { status: 409 });
      }
      await rename(uploadPath, finalPath);

      const gate = await prisma.gate.create({
        data: {
          title,
          scTrackUrl,
          scTrackUrn,
          fileName,
          fileSizeBytes: uploaded.size,
          isActive: true,
        },
      });

      return NextResponse.json(gate, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid upload action" }, { status: 400 });
  } catch (err) {
    console.error("Chunked upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
