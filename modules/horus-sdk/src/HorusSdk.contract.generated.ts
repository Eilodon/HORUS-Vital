// GENERATED FILE — do not edit by hand.
// Source: modules/horus-sdk/ffi-contract.json (synced from HORUS core via scripts/sync-horus-sdk.sh)
// Regenerate: npm run generate:ffi-contract
// scripts/check-generated.sh fails CI if this drifts from the source JSON.

/**
 * FFI contract version baked into the synced `libhorus.so`. Checked against
 * `Horus.ffiContractVersion()` at runtime — see HorusSdkModule.kt.
 */
export const FFI_CONTRACT_VERSION = 1;

/** Mirrors `PixelFormat` in HORUS core. */
export const PixelFormat = {
  RGB888: 0,
  RGBA8888: 1,
  NV21: 2,
} as const;

export type PixelFormat = (typeof PixelFormat)[keyof typeof PixelFormat];

/**
 * `float[13]` metric pack — mirrors `pipeline_result_to_jarray` in
 * `src/ffi/android.rs` (HORUS core). Unavailable metrics are `NaN` (see
 * per-field comments) — handle `NaN` explicitly, don't assume array-index
 * lookups on it will throw.
 */
export type PipelineMetricPack = [
  /** bpm. NaN when: no heart-rate estimate yet. */
  heartRateBpm: number,
  /** 0-1. */
  confidence: number,
  /** 0|1. */
  faceDetected: number,
  /** 0-1. */
  bufferFill: number,
  /** ms. NaN when: HRV not estimable yet. */
  sdnnMs: number,
  /** ms. NaN when: HRV not estimable yet. */
  rmssdMs: number,
  /** bpm. NaN when: respiration not estimable yet. */
  respBpm: number,
  /** 0-1. NaN when: fatigue/stress fusion not warmed up. */
  fatigueScore: number,
  /** 0-1. NaN when: fatigue/stress fusion not warmed up. */
  stressScore: number,
  /** 0-4. NaN when: fatigue/stress fusion not warmed up (NaN, not -1). */
  fatigueLevel: number,
  /** 0-4. NaN when: fatigue/stress fusion not warmed up (NaN, not -1). */
  stressLevel: number,
  /** 0-1. NaN when: fatigue/stress fusion not warmed up. */
  recoveryReadiness: number,
  /** 0-1. NaN when: fatigue/stress fusion not warmed up. */
  cognitiveLoad: number,
];
