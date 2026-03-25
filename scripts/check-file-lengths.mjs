import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

const MAX_LINES = 500;

const ALLOWED_OVERSIZED = new Map([
  ["package-lock.json", "Generated lockfile"],
  ["prisma/tenant-schema.prisma", "Single Prisma schema file"],
  ["prisma/tenant-migrations/0001_init.sql", "Baseline tenant SQL migration"],
  ["prisma/migrations/20260317145051_init_tenant_schema/migration.sql", "Baseline public SQL migration"],
  ["src/i18n/locales/en/tenant.json", "Tenant translation bundle"],
  ["src/i18n/locales/es/tenant.json", "Tenant translation bundle"],
  ["src/components/ui/sidebar.tsx", "Vendored UI primitive pending deeper extraction"],
]);

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean);

const violations = [];
const allowed = [];

for (const file of trackedFiles) {
  try {
    if (!statSync(file).isFile()) continue;
    const lineCount = readFileSync(file, "utf8").split("\n").length;
    if (lineCount <= MAX_LINES) continue;

    const reason = ALLOWED_OVERSIZED.get(file);
    if (reason) {
      allowed.push({ file, lineCount, reason });
      continue;
    }

    violations.push({ file, lineCount });
  } catch {
    // Ignore unreadable or non-text files.
  }
}

if (violations.length > 0) {
  console.error(`Files over ${MAX_LINES} lines:`);
  for (const { file, lineCount } of violations) {
    console.error(`- ${file}: ${lineCount}`);
  }
  process.exit(1);
}

console.log(`No unapproved files exceed ${MAX_LINES} lines.`);

if (allowed.length > 0) {
  console.log("\nApproved oversized files:");
  for (const { file, lineCount, reason } of allowed) {
    console.log(`- ${file}: ${lineCount} (${reason})`);
  }
}
