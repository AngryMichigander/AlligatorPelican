export interface CounterInputs {
  facilityOpenedAt: string | null;
  oneTimeConstructionCostUSD: number | null;
  dailyOperatingCostUSD: number | null;
  inputsSourceIds: string[];
  lastVerified: string | null;
  confidence: 'contracted' | 'reported_estimate' | 'projection';
}

export interface SourceRow {
  id: string;
  primarySource: boolean;
  retracted: boolean;
}

export interface LaunchGateResult {
  showCounter: boolean;
  reason: string;
  label?: 'reported estimate';
}

/**
 * Evaluates whether the live counter should be shown based on the confidence
 * level of the counter inputs and the availability of qualifying source rows.
 *
 * Logic per §8 Launch Gate:
 * - 'contracted'       → show iff ≥1 inputsSourceId resolves to a primarySource:true, non-retracted row.
 * - 'reported_estimate'→ show iff ≥1 inputsSourceId resolves to a primarySource:false, non-retracted row;
 *                         result carries label:'reported estimate'.
 * - 'projection'       → never show.
 * - PUBLIC_COUNTER_DISABLED=true → never show, regardless of gate status.
 */
export function evaluateLaunchGate(
  inputs: CounterInputs,
  sources: SourceRow[]
): LaunchGateResult {
  // Manual kill switch (build-time env var)
  if (import.meta.env.PUBLIC_COUNTER_DISABLED === 'true') {
    return { showCounter: false, reason: 'manually disabled' };
  }

  // Resolve inputsSourceIds to non-retracted source rows
  const linkedSources = inputs.inputsSourceIds
    .map((sid) => sources.find((s) => s.id === sid))
    .filter((s): s is SourceRow => s !== undefined && s.retracted === false);

  if (inputs.confidence === 'contracted') {
    const hasPrimary = linkedSources.some((s) => s.primarySource === true);
    return hasPrimary
      ? { showCounter: true, reason: 'contracted: primary source confirmed' }
      : { showCounter: false, reason: 'contracted: no non-retracted primary source in inputsSourceIds' };
  }

  if (inputs.confidence === 'reported_estimate') {
    const hasOutlet = linkedSources.some((s) => s.primarySource === false);
    return hasOutlet
      ? { showCounter: true, reason: 'reported_estimate: named-outlet source confirmed', label: 'reported estimate' }
      : { showCounter: false, reason: 'reported_estimate: no non-retracted named-outlet source in inputsSourceIds' };
  }

  // confidence === 'projection'
  return { showCounter: false, reason: 'projection: counter not eligible for live display' };
}
