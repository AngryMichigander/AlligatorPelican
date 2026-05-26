#!/usr/bin/env node
/**
 * check-no-hardcoded-peers.mjs
 * Verifies no peer network URLs are hardcoded in source files
 * (outside vendor/network-manifest/). Exit 1 if any are found.
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const peers = [
  "https://dinokent.com",
  "https://cheatingchelsea.com",
  "https://onlyphiles.com",
  "https://angrymichigander.com",
];

let found = false;

for (const url of peers) {
  try {
    const result = execSync(
      `grep -r --include="*.astro" --include="*.ts" --include="*.js" --include="*.mjs" --include="*.json" --include="*.html" -l "${url}" "${root}/src" "${root}/public" 2>/dev/null || true`,
      { encoding: "utf8" }
    ).trim();

    if (result) {
      console.error(`ERROR: Hardcoded peer URL found: ${url}`);
      console.error(`  In files:\n${result.split("\n").map((f) => "  - " + f).join("\n")}`);
      found = true;
    }
  } catch {
    // grep exits non-zero if no match — that's fine
  }
}

if (found) {
  console.error("\nFAIL: Remove hardcoded peer URLs and source them from vendor/network-manifest/network.json instead.");
  process.exit(1);
} else {
  console.log("OK: No hardcoded peer URLs found in source files.");
}
