#!/usr/bin/env node
/**
 * visual-check.mjs
 * Playwright visual check: visits each route at three viewports,
 * asserts no horizontal overflow, saves screenshots to artifacts/.
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PORT = 4322; // Use different port from a11y to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;
const ROUTES = ['/', '/sources', '/about', '/methodology', '/changelog'];
const VIEWPORTS = [
  { width: 375, height: 667, label: 'mobile' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1280, height: 800, label: 'desktop' },
];
const ARTIFACTS_DIR = join(ROOT, 'artifacts');

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
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

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
    let totalChecks = 0;
    let failures = 0;

    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of ROUTES) {
        await page.goto(`${BASE_URL}${route}`);

        // Assert no horizontal overflow
        const noOverflow = await page.evaluate(
          () => document.body.scrollWidth <= window.innerWidth
        );

        const routeSlug = route === '/' ? 'home' : route.replace(/\//g, '');
        const screenshotPath = join(
          ARTIFACTS_DIR,
          `${routeSlug}-${viewport.label}-${viewport.width}x${viewport.height}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: false });

        totalChecks++;
        if (!noOverflow) {
          const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
          const innerWidth = await page.evaluate(() => window.innerWidth);
          console.error(
            `[visual-check] FAIL ${route} @ ${viewport.width}x${viewport.height}: scrollWidth=${scrollWidth} > innerWidth=${innerWidth}`
          );
          exitCode = 1;
          failures++;
        } else {
          console.log(
            `[visual-check] PASS ${route} @ ${viewport.width}x${viewport.height} — screenshot: ${screenshotPath}`
          );
        }
      }

      await page.close();
    }

    await browser.close();

    console.log(
      `\n[visual-check] Summary: ${totalChecks} checks, ${failures} failures. Screenshots in ${ARTIFACTS_DIR}/`
    );
  } finally {
    server.kill('SIGTERM');
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[visual-check] Unexpected error:', err);
  process.exit(1);
});
