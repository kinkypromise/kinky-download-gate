/**
 * Verify that a password matches the stored ADMIN_PASSWORD_HASH.
 * Usage: echo "your-password" | npx tsx scripts/verify-password.ts
 */
import * as readline from "readline";
import bcrypt from "bcryptjs";
import "dotenv/config";

const hash = process.env.ADMIN_PASSWORD_HASH;
if (!hash) {
  console.error("ADMIN_PASSWORD_HASH not found in .env");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Enter password to verify: ", (password) => {
  rl.close();
  const trimmed = password.trim();
  const match = bcrypt.compareSync(trimmed, hash);
  console.log(match ? "✅ Password matches" : "❌ Password does NOT match");
  if (!match) {
    console.log("\nTip: Re-run scripts/setup-env.ts to generate a new hash if you forgot the password.");
  }
});
