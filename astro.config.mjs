// @ts-check
import { execSync } from 'node:child_process';
import { defineConfig } from 'astro/config';

// Inject BUILD_TIMESTAMP_MS from SOURCE_DATE_EPOCH (CI) or git log of the data files.
const epoch = (() => {
  if (process.env.SOURCE_DATE_EPOCH) {
    return parseInt(process.env.SOURCE_DATE_EPOCH, 10);
  }
  try {
    const out = execSync(
      'git log -1 --format=%ct -- src/data/sources.json src/data/counter-inputs.json'
    )
      .toString()
      .trim();
    return out ? parseInt(out, 10) : Math.floor(Date.now() / 1000);
  } catch {
    return Math.floor(Date.now() / 1000);
  }
})();

// https://astro.build/config
export default defineConfig({
  site: 'https://alligatorpelican.com',
  output: 'static',
  integrations: [],
  vite: {
    define: {
      // Exposes BUILD_TIMESTAMP_MS to both server (SSG frontmatter) and client scripts.
      'import.meta.env.BUILD_TIMESTAMP_MS': String(epoch * 1000),
    },
  },
});
