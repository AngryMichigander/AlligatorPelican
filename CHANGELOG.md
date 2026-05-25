# Changelog

All notable changes to this project are documented here.
Auto-generated entries for data file changes appear on the `/changelog` page (built from git history).

---

## 2026-05-25 — Pre-launch verification complete

**Status: READY FOR DEPLOYMENT**

All §9 pre-launch checks passed (2026-05-25):
- Build: 5 pages, deterministic (38 output files match across two independent builds)
- audit:numbers: 24 data-claim occurrences, 0 violations
- a11y: 0 critical/serious violations across 5 routes
- visual-check: 0 overflow failures across 5 routes × 3 viewports
- Launch Gate: COUNTER VISIBLE — reported estimate, $1.2M/day, two named-outlet sources
- noscript fallback: build-time total + timestamp renders correctly

Bug fixed: `Counter.astro` SSG total was using `Date.now()` instead of `BUILD_TIMESTAMP`, causing non-deterministic builds. Fixed; deterministic check now passes.

audit:sources (live URL HEAD checks) deferred to CI — script ready at `scripts/audit-sources.mjs`.

## 2026-05-25 — Project bootstrap

Initial repository setup:
- Astro static site scaffold (minimal template, TypeScript strict)
- Dual-license structure: MIT for code, CC-BY-4.0 for content
- Project documentation: README, CONTRIBUTING, methodology placeholder
- Implementation plan at `.omc/plans/alligatorpelican.md`
