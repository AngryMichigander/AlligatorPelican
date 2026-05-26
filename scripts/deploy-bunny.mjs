#!/usr/bin/env node
/**
 * deploy-bunny.mjs
 *
 * Uploads ./dist/ to a Bunny.net Storage Zone via their HTTP Storage API and
 * purges the corresponding Pull Zone cache. Designed for CI (GitHub Actions)
 * but works locally if the env vars are set.
 *
 * Required env vars:
 *   BUNNY_STORAGE_NAME       — storage zone slug, e.g. "alligatorpelican"
 *   BUNNY_STORAGE_PASSWORD   — the storage zone's password / API key (NOT the account-level key)
 *   BUNNY_STORAGE_REGION     — region prefix, e.g. "" for default NYC, "uk", "de", "sg", "se", "br", "jh", "la"
 *                              (see https://docs.bunny.net/reference/put_-storagezonename-path-filename)
 *   BUNNY_PULL_ZONE_ID       — numeric Pull Zone ID for cache purge
 *   BUNNY_API_KEY            — account-level API key (different from the storage password)
 *
 * Optional env vars:
 *   BUNNY_DELETE_ORPHANS     — "true" to delete remote files that no longer exist locally
 *                              (default: "true"). Set "false" to upload-only.
 *   DIST_DIR                 — defaults to "./dist"
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, posix } from 'node:path';

const required = ['BUNNY_STORAGE_NAME', 'BUNNY_STORAGE_PASSWORD', 'BUNNY_PULL_ZONE_ID', 'BUNNY_API_KEY'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`[deploy-bunny] missing env var: ${k}`);
    process.exit(2);
  }
}

const STORAGE_NAME = process.env.BUNNY_STORAGE_NAME;
const STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const STORAGE_REGION = process.env.BUNNY_STORAGE_REGION ?? '';
const PULL_ZONE_ID = process.env.BUNNY_PULL_ZONE_ID;
const API_KEY = process.env.BUNNY_API_KEY;
const DIST = process.env.DIST_DIR ?? './dist';
const DELETE_ORPHANS = (process.env.BUNNY_DELETE_ORPHANS ?? 'true') === 'true';

const STORAGE_HOST = STORAGE_REGION
  ? `https://${STORAGE_REGION}.storage.bunnycdn.com`
  : 'https://storage.bunnycdn.com';

console.log(`[deploy-bunny] config:`);
console.log(`  storage zone:  ${STORAGE_NAME}`);
console.log(`  storage host:  ${STORAGE_HOST}`);
console.log(`  region prefix: ${STORAGE_REGION || '(default / NYC)'}`);
console.log(`  pull zone id:  ${PULL_ZONE_ID}`);
console.log(`  delete orphans: ${DELETE_ORPHANS}`);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(p)));
    } else if (e.isFile()) {
      out.push(p);
    }
  }
  return out;
}

async function listRemote(prefix = '') {
  // Bunny returns folders + files at a single level; recurse to get full list.
  const url = `${STORAGE_HOST}/${STORAGE_NAME}/${prefix}`;
  const r = await fetch(url, { headers: { AccessKey: STORAGE_PASSWORD, Accept: 'application/json' } });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`list ${prefix}: HTTP ${r.status} ${await r.text()}`);
  const items = await r.json();
  const out = [];
  for (const item of items) {
    const path = prefix + item.ObjectName + (item.IsDirectory ? '/' : '');
    if (item.IsDirectory) {
      out.push(...(await listRemote(path)));
    } else {
      out.push(path);
    }
  }
  return out;
}

async function uploadFile(localPath, remotePath) {
  const buf = await readFile(localPath);
  const url = `${STORAGE_HOST}/${STORAGE_NAME}/${remotePath}`;
  const r = await fetch(url, {
    method: 'PUT',
    headers: { AccessKey: STORAGE_PASSWORD, 'Content-Type': 'application/octet-stream' },
    body: buf,
  });
  if (!r.ok) {
    throw new Error(`upload ${remotePath}: HTTP ${r.status} ${await r.text()}`);
  }
}

async function deleteRemote(remotePath) {
  const url = `${STORAGE_HOST}/${STORAGE_NAME}/${remotePath}`;
  const r = await fetch(url, { method: 'DELETE', headers: { AccessKey: STORAGE_PASSWORD } });
  if (!r.ok && r.status !== 404) {
    throw new Error(`delete ${remotePath}: HTTP ${r.status} ${await r.text()}`);
  }
}

async function purgeCache() {
  const r = await fetch(`https://api.bunny.net/pullzone/${PULL_ZONE_ID}/purgeCache`, {
    method: 'POST',
    headers: { AccessKey: API_KEY, Accept: 'application/json' },
  });
  if (!r.ok) {
    throw new Error(`purge cache: HTTP ${r.status} ${await r.text()}`);
  }
}

async function main() {
  const distStat = await stat(DIST).catch(() => null);
  if (!distStat || !distStat.isDirectory()) {
    console.error(`[deploy-bunny] dist dir not found at ${DIST}; run 'npm run build' first`);
    process.exit(1);
  }

  const localFiles = await walk(DIST);
  console.log(`[deploy-bunny] uploading ${localFiles.length} files to ${STORAGE_NAME}…`);

  // Concurrency: small pool so we don't blow Bunny's rate limit.
  const CONCURRENCY = 8;
  const queue = localFiles.slice();
  const localRemotePaths = new Set();
  let done = 0;

  async function worker() {
    while (queue.length) {
      const file = queue.shift();
      if (!file) break;
      const remote = posix.normalize(relative(DIST, file).split(/[\\/]/).join('/'));
      localRemotePaths.add(remote);
      await uploadFile(file, remote);
      done++;
      if (done % 10 === 0 || done === localFiles.length) {
        console.log(`  ${done}/${localFiles.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (DELETE_ORPHANS) {
    console.log('[deploy-bunny] checking for orphaned remote files…');
    const remote = await listRemote();
    const orphans = remote.filter((p) => !localRemotePaths.has(p));
    if (orphans.length) {
      console.log(`[deploy-bunny] deleting ${orphans.length} orphans:`);
      for (const o of orphans) {
        console.log(`  - ${o}`);
        await deleteRemote(o);
      }
    } else {
      console.log('[deploy-bunny] no orphans');
    }
  }

  console.log('[deploy-bunny] purging Pull Zone cache…');
  await purgeCache();

  console.log('[deploy-bunny] done.');
}

main().catch((err) => {
  console.error('[deploy-bunny] failed:', err.message);
  process.exit(1);
});
