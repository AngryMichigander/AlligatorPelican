# alligatorpelican.com

**A cited, fact-first public-interest site documenting the taxpayer cost and human impact of the "Alligator Alcatraz" immigration detention facility.**

> Every number cites a public source. Fact and opinion are visually distinct. Static, deterministic, mirrorable.

Implementation plan: `.omc/plans/alligatorpelican.md`

## Rescue Rebuild

If the primary host is unavailable, rebuild and serve locally from the mirror:

```bash
git clone <mirror-url> AlligatorPelican
cd AlligatorPelican
npm ci
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct -- src/data/sources.json src/data/counter-inputs.json) \
BUILD_TIMESTAMP_MS=$((SOURCE_DATE_EPOCH * 1000)) \
npm run build
npx serve dist/
```

`npm ci` + pinned `package-lock.json` + `SOURCE_DATE_EPOCH` give byte-stable rescue builds.

## Development

```bash
npm install      # install dependencies
npm run dev      # start local dev server at localhost:4321
npm run build    # build production site to ./dist/
npm run preview  # preview build locally
```

## Licenses

- **Code:** MIT — see `LICENSE-CODE`
- **Content:** CC-BY-4.0 — see `LICENSE-CONTENT`

Dual-license rationale: code MIT so rescue forks/mirrors are unrestricted; content CC-BY-4.0 so advocacy material can be shared with attribution.
