/**
 * Access to the single Settings row. Reads fresh from the database on every
 * call so that configuration gating never sees stale state across Next.js
 * route chunks or worker boundaries. Creates the default row automatically if
 * it does not exist.
 */
import { prisma } from "./prisma";
import type { Settings } from "@prisma/client";

export async function getSettings(): Promise<Settings> {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    try {
      settings = await prisma.settings.create({ data: { id: 1 } });
    } catch (err) {
      // Guard against concurrent creation races during static generation.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Unique constraint failed")) {
        settings = await prisma.settings.findUnique({ where: { id: 1 } });
      }
      if (!settings) {
        throw err;
      }
    }
  }
  return settings;
}

/**
 * No-op kept for compatibility. Settings are no longer cached, so callers do
 * not need to invalidate them after writes.
 */
export function invalidateSettings(): void {
  // intentionally empty
}
