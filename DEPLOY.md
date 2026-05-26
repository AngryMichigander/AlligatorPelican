# Deploy

Production target: **Bunny.net Storage Zone + Pull Zone**.

Push to `main` → GitHub Actions builds with deterministic `SOURCE_DATE_EPOCH`,
runs the citation/source audits, uploads `dist/` to the Storage Zone, and
purges the Pull Zone cache. See `.github/workflows/deploy.yml`.

## One-time Bunny setup

1. **Storage Zone** — Bunny → Storage → Add Storage Zone
   - Name: `alligatorpelican`
   - Tier: Standard
   - Note the **Password** (used as the storage API key) and the **region prefix** shown next to the FTP hostname (e.g. blank = NYC, `de` = Frankfurt). Save them as repo secrets.

2. **Pull Zone** — Bunny → CDN → Add Pull Zone
   - Origin Type: **Storage Zone** → `alligatorpelican`
   - Tier: Standard
   - Save the numeric **Pull Zone ID** for the cache-purge secret.

3. **Hostname** — Pull Zone → Hostnames
   - Add `alligatorpelican.com` and `www.alligatorpelican.com`
   - Enable **Force SSL** and **Let's Encrypt**. SSL is issued once DNS resolves.

4. **DNS** — Bunny DNS (or your registrar)
   - Apex `alligatorpelican.com` → CNAME / ALIAS / ANAME → `<your-pull-zone>.b-cdn.net`
   - `www` → CNAME → same target

5. **Account API Key** — Bunny → Account Settings → API
   - Copy the **Account API Key**. This is used for cache purging and is
     different from the Storage Zone password.

## GitHub repo secrets

Add these in the `AngryMichigander/AlligatorPelican` repo:
`Settings → Secrets and variables → Actions → New repository secret`.

| Secret name              | Value                                                        |
| ------------------------ | ------------------------------------------------------------ |
| `BUNNY_STORAGE_ZONE`     | Storage Zone name (e.g. `alligatorpelican`)                  |
| `BUNNY_STORAGE_PASSWORD` | Storage Zone password (shown on the zone's FTP/API page)     |
| `BUNNY_STORAGE_REGION`   | Region prefix; blank for NYC, or `uk`/`de`/`sg`/`se`/`br`/`jh`/`la` |
| `BUNNY_PULL_ZONE_ID`     | Numeric Pull Zone ID                                         |
| `BUNNY_API_KEY`          | Account-level API key (from Account Settings → API)          |

A missing or wrong `BUNNY_STORAGE_REGION` is the most common silent-failure
cause — the upload either 401s (wrong key) or 404s (wrong host).

## Manual deploy (debugging)

```
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct -- src/data/sources.json src/data/counter-inputs.json) \
BUILD_TIMESTAMP_MS=$((SOURCE_DATE_EPOCH * 1000)) \
npm ci && npm run build

BUNNY_STORAGE_ZONE=alligatorpelican \
BUNNY_STORAGE_PASSWORD=… \
BUNNY_STORAGE_REGION= \
BUNNY_PULL_ZONE_ID=… \
BUNNY_API_KEY=… \
node scripts/deploy-bunny.mjs
```

## What the deploy script does

- Walks `dist/` recursively and PUTs every file to
  `https://[REGION.]storage.bunnycdn.com/<zone>/<path>` with the Storage
  Password as the `AccessKey` header.
- After uploading, lists the remote tree and DELETEs anything that no
  longer exists locally (set `BUNNY_DELETE_ORPHANS=false` to disable).
- POSTs `https://api.bunny.net/pullzone/<id>/purgeCache` with the Account
  API Key so visitors see the new build immediately.

Concurrency is 8 parallel uploads — adjust at the top of
`scripts/deploy-bunny.mjs` if Bunny rate-limits.

## Caveats

- The deploy script does **not** dry-run. Add a `--dry-run` flag yourself
  before pointing it at a populated production zone.
- Bunny Storage Standard region defaults to NYC and replicates to the CDN
  on-demand. Switch to a closer storage region or enable Storage
  Replication if origin pulls become slow.
- HSTS is **not** preloaded yet — keep it short (the Pull Zone default of
  1 year is fine) until you've confirmed the site is stable. Don't enable
  HSTS preload until you're sure you'll never want to drop HTTPS.
