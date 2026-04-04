#!/usr/bin/env npx tsx
/**
 * CI script: detect missing translation keys between en/ and es/ locale files.
 * Exits with code 1 if any keys are missing.
 *
 * Usage: npx tsx scripts/check-i18n-keys.ts
 */

import fs from "fs";
import path from "path";

const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales");
const BASE_LOCALE = "en";
const TARGET_LOCALES = ["es"];

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function loadJson(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

let hasErrors = false;

// Get all JSON files from the base locale
const baseDir = path.join(LOCALES_DIR, BASE_LOCALE);
const files = fs.readdirSync(baseDir).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const baseKeys = flattenKeys(loadJson(path.join(baseDir, file)));

  for (const targetLocale of TARGET_LOCALES) {
    const targetPath = path.join(LOCALES_DIR, targetLocale, file);

    if (!fs.existsSync(targetPath)) {
      console.error(`MISSING FILE: ${targetLocale}/${file}`);
      hasErrors = true;
      continue;
    }

    const targetKeys = flattenKeys(loadJson(targetPath));
    const targetKeySet = new Set(targetKeys);
    const baseKeySet = new Set(baseKeys);

    // Keys in base but not in target
    const missingInTarget = baseKeys.filter((k) => !targetKeySet.has(k));
    // Keys in target but not in base (extra keys)
    const extraInTarget = targetKeys.filter((k) => !baseKeySet.has(k));

    if (missingInTarget.length > 0) {
      hasErrors = true;
      console.error(`\n${targetLocale}/${file} — MISSING ${missingInTarget.length} key(s):`);
      for (const key of missingInTarget) {
        console.error(`  - ${key}`);
      }
    }

    if (extraInTarget.length > 0) {
      console.warn(`\n${targetLocale}/${file} — ${extraInTarget.length} extra key(s):`);
      for (const key of extraInTarget) {
        console.warn(`  + ${key}`);
      }
    }
  }
}

if (hasErrors) {
  console.error("\ni18n key check FAILED — missing translations detected.");
  process.exit(1);
} else {
  console.log(
    `\ni18n key check PASSED — all ${files.length} files in sync across ${TARGET_LOCALES.length + 1} locale(s).`
  );
}
