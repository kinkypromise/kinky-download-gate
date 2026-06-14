/**
 * Helper to generate secrets and hash the admin password.
 * Usage: npx tsx scripts/setup-env.ts
 *
 * Outputs:
 * - SESSION_SECRET (base64, 32 bytes)
 * - DOWNLOAD_TOKEN_SECRET (base64, 32 bytes)
 * - ADMIN_PASSWORD_HASH (bcrypt, cost 12)
 *
 * The plaintext password is never printed or stored.
 */

import * as readline from "node:readline";
import * as crypto from "node:crypto";
import bcrypt from "bcryptjs";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

async function main() {
  const password = await ask("Enter admin password (hidden input not supported in terminal, type carefully): ");

  if (!password || password.length < 8) {
    console.error("Password must be at least 8 characters.");
    rl.close();
    process.exit(1);
  }

  const sessionSecret = crypto.randomBytes(32).toString("base64");
  const downloadSecret = crypto.randomBytes(32).toString("base64");
  const hash = bcrypt.hashSync(password, 12);

  console.log("\n--- Generated values ---");
  console.log(`SESSION_SECRET=${sessionSecret}`);
  console.log(`DOWNLOAD_TOKEN_SECRET=${downloadSecret}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log("\nCopy these into your .env file.");
  console.log("The plaintext password has NOT been saved anywhere.");

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
