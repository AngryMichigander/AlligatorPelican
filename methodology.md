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

## Future: IPFS Snapshot

After launch is stable, pin the build output for permanent archival:

```bash
ipfs add -r dist/
# pin via Pinata or Web3.Storage
```
