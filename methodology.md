# Methodology

## Live Taxpayer-Cost Counter

The counter on the homepage tracks the running taxpayer cost of the "Alligator Alcatraz" facility.

### Inputs

Inputs are stored in `src/data/counter-inputs.json`:

| Field | Type | Description |
|---|---|---|
| `facilityOpenedAt` | ISO datetime | When the facility began operating |
| `oneTimeConstructionCostUSD` | number\|null | One-time construction/setup cost |
| `dailyOperatingCostUSD` | number\|null | Reported daily operating cost |
| `inputsSourceIds` | string[] | IDs from `sources.json` backing these figures |
| `lastVerified` | ISO date | When inputs were last manually verified |
| `confidence` | string | `"contracted"`, `"reported_estimate"`, or `"projection"` |

### Formula

```
referenceMs = Math.max(Date.now(), BUILD_TIMESTAMP)
elapsedMs   = Math.max(0, referenceMs - Date.parse(facilityOpenedAt))
total       = Math.floor(
                (oneTimeConstructionCostUSD ?? 0)
              + dailyOperatingCostUSD * (elapsedMs / 86_400_000)
              )
```

The counter ticks once per second (`setInterval(1000)`). Spending is daily-aggregated in reality; sub-second smoothing would imply false precision.

### Clock-Skew Guard

`BUILD_TIMESTAMP` is injected at build time from `SOURCE_DATE_EPOCH` (the git commit timestamp of the last change to either data file). `referenceMs = Math.max(Date.now(), BUILD_TIMESTAMP)` prevents devices with wrong clocks from showing $0 or implausibly-future totals. The counter is monotonic non-decreasing.

### Launch Gate

- `confidence: "contracted"` → counter shown only if `inputsSourceIds` contains at least one source with `primarySource: true`.
- `confidence: "reported_estimate"` → counter shown only if `inputsSourceIds` contains at least one named-outlet citation AND the UI labels the figure "reported estimate."
- `confidence: "projection"` → not eligible for the live counter; banner only.

If the gate is not met, the counter is replaced with: *"Figures pending verification — site will update when primary sources confirm operating cost."*

The build-time env var `PUBLIC_COUNTER_DISABLED=true` forces the banner regardless of gate status.

### No-JS Fallback

When JavaScript is disabled, a `<noscript>` block renders:
- The build-time integer total
- The `BUILD_TIMESTAMP` date
- The note "as computed at build time on YYYY-MM-DD HH:MM UTC — refresh for live tick"
- The same citation

## Verification Log

**Date:** 2026-05-25  
**Commit verified:** `9870e62` (HEAD at time of run)

| Check | Result | Detail |
|---|---|---|
| `npm ci && npm run build` | ✅ PASS | 5 pages built; `dist/` produced |
| `npm run audit:numbers` | ✅ PASS | 7 files, 24 `data-claim` occurrences, 0 violations |
| `npm run audit:sources` | ⏭ DEFERRED | Live HTTP HEAD checks; deferred to CI on PR to avoid sandbox rate-limits. Script ready. |
| `npm run a11y` | ✅ PASS | 5 routes, 0 critical/serious axe-core violations |
| `npm run visual-check` | ✅ PASS | 15 checks (5 routes × 3 viewports: 375×667, 768×1024, 1280×800), 0 overflow failures. Screenshots in `artifacts/`. |
| `<noscript>` fallback | ✅ PASS | Renders build-time total `$394,777,374` + timestamp `2026-05-25 23:31 UTC` + citation |
| `rel="noopener noreferrer"` | ✅ PASS | All external links in all rendered pages carry the attribute |
| `data-claim` → `<Cite>` | ✅ PASS | 24 claims, each has a sibling non-retracted `<Cite/>` (via `audit:numbers`) |
| Deterministic build | ✅ PASS | Two sequential builds with same `SOURCE_DATE_EPOCH` produce identical SHA-256 checksums for all 38 output files |
| Launch Gate | ✅ COUNTER VISIBLE | `confidence: "reported_estimate"`, sources `floridatrib-2026-03-burn-rate` + `cbs12-2026-03-burn-rate` (both named-outlet) → gate passes; UI shows "Reported estimate" confidence pill |

**Bug fixed during verification:**  
`src/components/Counter.astro` — SSG build-time total used `Math.max(Date.now(), BUILD_TS)`, causing `index.html` to differ between builds. Fixed to use `BUILD_TS` directly. The `Math.max(Date.now(), buildTimestampMs)` clock-skew guard is preserved in the client-side JS.

**Note on formula documentation above:**  
The formula `referenceMs = Math.max(Date.now(), BUILD_TIMESTAMP)` describes the **client-side live counter** (correct). The **SSG noscript value** uses `BUILD_TIMESTAMP` alone for determinism.

## Future: IPFS Snapshot

After launch is stable, pin the build output for permanent archival:

```bash
ipfs add -r dist/
# pin via Pinata or Web3.Storage
```
