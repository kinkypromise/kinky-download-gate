/**
 * Secure Download Endpoint
 * GET /api/download?token=...
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyDownloadToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { resolve, sep } from "path";
import { rateLimitResponse } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage/downloads";

function nodeStreamToWebStream(nodeStream: ReturnType<typeof createReadStream>): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^\w\s\-.]/g, "_").trim() || "download";
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimitResponse(`dl:${ip}`, 10, 60 * 1000);
  if (!rl.allowed) {
    log({ level: "warn", msg: "rate_limit", route: "/api/download", ip });
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rl.headers }
    );
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    log({ level: "warn", msg: "missing_token", route: "/api/download", ip });
    return NextResponse.json({ error: "Missing token" }, { status: 400, headers: rl.headers });
  }

  const payload = verifyDownloadToken(token);
  if (!payload) {
    log({ level: "warn", msg: "invalid_token", route: "/api/download", ip });
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 410, headers: rl.headers });
  }

  const gate = await prisma.gate.findUnique({ where: { id: payload.gateId } });
  if (!gate || !gate.isActive) {
    log({ level: "warn", msg: "gate_not_found", route: "/api/download", ip, gateId: payload.gateId });
    return NextResponse.json({ error: "Gate not found or inactive" }, { status: 404, headers: rl.headers });
  }

  const storageRoot = resolve(STORAGE_DIR);
  const filePath = resolve(storageRoot, gate.fileName);
  if (!filePath.startsWith(storageRoot + sep)) {
    log({ level: "warn", msg: "path_traversal", route: "/api/download", ip, gateId: payload.gateId });
    return NextResponse.json({ error: "File not found" }, { status: 404, headers: rl.headers });
  }

  let stats;
  try {
    stats = await stat(filePath);
    if (!stats.isFile()) throw new Error("Not a file");
  } catch {
    log({ level: "error", msg: "file_not_found", route: "/api/download", ip, gateId: payload.gateId });
    return NextResponse.json({ error: "File not found" }, { status: 404, headers: rl.headers });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = nodeStreamToWebStream(nodeStream);
  const ext = gate.fileName.split(".").pop() || "bin";
  const contentType = ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "application/octet-stream";
  const safeTitle = sanitizeFilename(gate.title);

  log({ level: "info", msg: "download_started", route: "/api/download", ip, gateId: payload.gateId });
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeTitle}.${ext}"`,
      "Content-Length": String(stats.size),
      ...rl.headers,
    },
  });
}
