import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROUTES = ['/', '/sources', '/methodology', '/about', '/changelog'];
const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];
const OUT = resolve(process.cwd(), 'artifacts/screenshots');

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const url = `http://localhost:4321${route}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 1200));
    const safe = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
    const file = `${OUT}/${vp.name}-${safe}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log('✓', file);
  }
  await ctx.close();
}
await browser.close();
console.log('Done');
