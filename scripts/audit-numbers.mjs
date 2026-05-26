#!/usr/bin/env node
/**
 * audit-numbers.mjs
 * Walks .astro files under src/pages/ and src/components/.
 * For each element with data-claim="...", asserts there is a
 * <Cite id="..."/> within ±500 characters resolving to a
 * non-retracted sources.json row.
 * Exits non-zero on any violation.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCES_PATH = join(ROOT, 'src', 'data', 'sources.json');

/** Recursively collect .astro files under a directory */
function collectAstroFiles(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectAstroFiles(full));
    } else if (entry.endsWith('.astro')) {
      results.push(full);
    }
  }
  return results;
}

function main() {
  // Load sources
  let sourcesById = new Map();
  if (existsSync(SOURCES_PATH)) {
    const sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf8'));
    for (const s of sources) {
      sourcesById.set(s.id, s);
    }
  }

  const dirs = [
    join(ROOT, 'src', 'pages'),
    join(ROOT, 'src', 'components'),
  ];

  const files = dirs.flatMap(collectAstroFiles);

  if (files.length === 0) {
    console.log('[audit-numbers] No .astro files found — exit 0');
    process.exit(0);
  }

  let violations = 0;
  let claimsChecked = 0;

  // Regex to find data-claim attributes
  const claimRe = /data-claim\s*=\s*["'][^"']*["']/g;
  // Regex to find <Cite id="..."/> or <Cite id='...'/>
  const citeRe = /<Cite\s+id\s*=\s*["']([^"']+)["']\s*\/>/g;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    let match;

    claimRe.lastIndex = 0;
    while ((match = claimRe.exec(content)) !== null) {
      claimsChecked++;
      const pos = match.index;

      // Search within ±500 characters of the data-claim occurrence
      const windowStart = Math.max(0, pos - 500);
      const windowEnd = Math.min(content.length, pos + match[0].length + 500);
      const window = content.slice(windowStart, windowEnd);

      // Find all <Cite id="..."/> in the window
      const citeIds = [];
      citeRe.lastIndex = 0;
      let citeMatch;
      while ((citeMatch = citeRe.exec(window)) !== null) {
        citeIds.push(citeMatch[1]);
      }

      if (citeIds.length === 0) {
        console.error(
          `[audit-numbers] VIOLATION: data-claim at ${file}:${getLine(content, pos)} has no <Cite/> within ±500 chars`
        );
        violations++;
        continue;
      }

      // Check each cited id resolves to a non-retracted source
      let hasValidCite = false;
      for (const id of citeIds) {
        const source = sourcesById.get(id);
        if (!source) {
          console.error(
            `[audit-numbers] VIOLATION: <Cite id="${id}"/> near data-claim at ${file}:${getLine(content, pos)} — id not found in sources.json`
          );
          violations++;
        } else if (source.retracted) {
          console.warn(
            `[audit-numbers] WARNING: <Cite id="${id}"/> near data-claim at ${file}:${getLine(content, pos)} — source is retracted`
          );
          // Retracted cites don't fail the build per §4, but we warn
        } else {
          hasValidCite = true;
        }
      }

      if (!hasValidCite && citeIds.length > 0 && sourcesById.size > 0) {
        // All cites resolved but all retracted — report
        const allRetracted = citeIds.every((id) => {
          const s = sourcesById.get(id);
          return s && s.retracted;
        });
        if (allRetracted) {
          console.error(
            `[audit-numbers] VIOLATION: data-claim at ${file}:${getLine(content, pos)} — all cited sources are retracted`
          );
          violations++;
        }
      }
    }
  }

  console.log(
    `[audit-numbers] Checked ${files.length} files, ${claimsChecked} data-claim occurrences, ${violations} violations`
  );

  if (violations > 0) {
    process.exit(1);
  }
  process.exit(0);
}

function getLine(content, pos) {
  const lines = content.slice(0, pos).split('\n');
  return lines.length;
}

main();
