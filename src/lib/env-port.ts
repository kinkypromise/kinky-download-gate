/**
 * Helper to persist the runtime port in .env.local so Next.js picks it up
 * on the next start. Only touches the PORT variable; all other lines are
 * preserved. .env.local is gitignored, so this never commits secrets.
 */
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

const ENV_LOCAL_PATH = ".env.local";

export async function writePortToEnvLocal(port: number): Promise<void> {
  let content = "";
  if (existsSync(ENV_LOCAL_PATH)) {
    content = await readFile(ENV_LOCAL_PATH, "utf-8");
  }

  const lines = content.split("\n");
  let found = false;
  const updated = lines.map((line) => {
    if (/^\s*PORT\s*=/.test(line)) {
      found = true;
      return `PORT=${port}`;
    }
    return line;
  });

  if (!found) {
    updated.push(`PORT=${port}`);
  }

  await writeFile(ENV_LOCAL_PATH, updated.join("\n").trimEnd() + "\n", "utf-8");
}
