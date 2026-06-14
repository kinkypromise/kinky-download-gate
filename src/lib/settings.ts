/**
 * Cached access to the single Settings row.
 * Creates the default row automatically if it does not exist.
 * Call invalidateSettings() after saving settings to refresh the cache.
 */
import { prisma } from "./prisma";
import type { Settings } from "@prisma/client";

const CACHE_TTL_MS = 5_000;

let cached: Settings | null = null;
let cachedAt = 0;

export async function getSettings(): Promise<Settings> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: { id: 1 },
    });
  }

  cached = settings;
  cachedAt = now;
  return settings;
}

export function invalidateSettings(): void {
  cached = null;
  cachedAt = 0;
}
