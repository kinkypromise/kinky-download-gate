-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "artistName" TEXT NOT NULL DEFAULT 'Your Artist Name',
    "labelName" TEXT NOT NULL DEFAULT '',
    "instagramUrl" TEXT NOT NULL DEFAULT '',
    "accentColor" TEXT NOT NULL DEFAULT '#f22e8c',
    "bpm" INTEGER NOT NULL DEFAULT 160,
    "consentText" TEXT NOT NULL DEFAULT 'By unlocking, you will follow {artist} on SoundCloud, like and repost this track, and post your comment.',
    "privacyText" TEXT NOT NULL DEFAULT 'We only use your SoundCloud login to follow {artist} and like, repost, and comment on this track — nothing else. No email access. No newsletter. No stored fan profile.',
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "adminPasswordHash" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("accentColor", "artistName", "bpm", "consentText", "createdAt", "id", "instagramUrl", "isConfigured", "labelName", "privacyText", "updatedAt") SELECT "accentColor", "artistName", "bpm", "consentText", "createdAt", "id", "instagramUrl", "isConfigured", "labelName", "privacyText", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE INDEX "Settings_isConfigured_idx" ON "Settings"("isConfigured");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
