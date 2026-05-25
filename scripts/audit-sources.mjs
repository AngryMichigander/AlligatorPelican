#!/usr/bin/env node
/**
 * audit-sources.mjs
 * HEADs every url and archiveUrl in src/data/sources.json.
 * Exits non-zero if any non-2xx response is found.
 * Exits 0 (cleanly) if sources.json doesn't exist or has no rows.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCES_PATH = join(ROOT, 'src', 'data', 'sources.json');

const TIMEOUT_MS = 10_000;
const CONCURRENCY = 8;

async function headUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'AlligatorPelican/audit-sources (+https://alligatorpelican.com)' },
    });
    clearTimeout(timer);
    return { url, status: res.status, ok: res.ok };
  } catch (err) {
    clearTimeout(timer);
    return { url, status: 0, ok: false, error: err.message };
  }
}

async function runBatch(tasks, concurrency) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  if (!existsSync(SOURCES_PATH)) {
    console.log('[audit-sources] src/data/sources.json not found — skipping (exit 0)');
    process.exit(0);
  }

  let sources;
  try {
    sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf8'));
  } catch (err) {
    console.error(`[audit-sources] Failed to parse sources.json: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(sources) || sources.length === 0) {
    console.log('[audit-sources] No sources found — skipping (exit 0)');
    process.exit(0);
  }

  // Only audit non-retracted sources
  const active = sources.filter((s) => !s.retracted);
  console.log(`[audit-sources] Auditing ${active.length} active sources (${sources.length - active.length} retracted, skipped)...`);

  const tasks = [];
  for (const source of active) {
    if (source.url) tasks.push(() => headUrl(source.url).then((r) => ({ ...r, sourceId: source.id, field: 'url' })));
    if (source.archiveUrl) tasks.push(() => headUrl(source.archiveUrl).then((r) => ({ ...r, sourceId: source.id, field: 'archiveUrl' })));
  }

  if (tasks.length === 0) {
    console.log('[audit-sources] No URLs to check — exit 0');
    process.exit(0);
  }

  const results = await runBatch(tasks, CONCURRENCY);

  const failures = results.filter((r) => !r.ok);
  const passes = results.filter((r) => r.ok);

  console.log(`[audit-sources] ${passes.length} passed, ${failures.length} failed`);

  if (failures.length > 0) {
    console.error('\nFailed URLs:');
    for (const f of failures) {
      const detail = f.error ? `ERROR: ${f.error}` : `HTTP ${f.status}`;
      console.error(`  [${f.sourceId}] ${f.field}: ${f.url} — ${detail}`);
    }
    process.exit(1);
  }

  console.log('[audit-sources] All URLs OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('[audit-sources] Unexpected error:', err);
  process.exit(1);
});
