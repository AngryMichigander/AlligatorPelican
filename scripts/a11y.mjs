#!/usr/bin/env node
/**
 * a11y.mjs
 * Runs @axe-core/playwright accessibility checks against all five routes.
 * Fails on any critical or serious violation.
 * Boots `npm run preview` on port 4321 and cleanly shuts it down.
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;
const ROUTES = ['/', '/sources', '/about', '/methodology', '/changelog'];
const CRITICAL_IMPACT = new Set(['critical', 'serious']);

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

async function main() {
  // Start preview server
  const server = spawn('npm', ['run', 'preview', '--', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  server.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));

  let exitCode = 0;

  try {
    await waitForServer(`${BASE_URL}/`);

    const browser = await chromium.launch();
    // @axe-core/playwright requires pages created via newContext(), not browser.newPage()
    const context = await browser.newContext();
    const results = [];

    for (const route of ROUTES) {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}${route}`);

      const axeResults = await new AxeBuilder({ page }).analyze();
      const violations = axeResults.violations.filter((v) =>
        CRITICAL_IMPACT.has(v.impact)
      );

      results.push({ route, violations });

      if (violations.length > 0) {
        console.error(`\n[a11y] FAIL ${route} — ${violations.length} critical/serious violation(s):`);
        for (const v of violations) {
          console.error(`  [${v.impact}] ${v.id}: ${v.description}`);
          for (const node of v.nodes.slice(0, 3)) {
            console.error(`    Target: ${node.target.join(', ')}`);
          }
        }
        exitCode = 1;
      } else {
        console.log(`[a11y] PASS ${route}`);
      }

      await page.close();
    }

    await context.close();
    await browser.close();

    const totalViolations = results.reduce((s, r) => s + r.violations.length, 0);
    console.log(
      `\n[a11y] Summary: ${ROUTES.length} routes checked, ${totalViolations} critical/serious violations`
    );
  } finally {
    server.kill('SIGTERM');
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[a11y] Unexpected error:', err);
  process.exit(1);
});
