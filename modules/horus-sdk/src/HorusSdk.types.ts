/**
 * 0=RGB888, 1=RGBA8888, 2=NV21 — mirrors `PixelFormat` in the Rust core.
 *
 * Source of truth: `modules/horus-sdk/ffi-contract.json` (synced from HORUS
 * core's `bindings/ffi-contract.json` via `scripts/sync-horus-sdk.sh`). If you
 * change these codes here, update the JSON and `Horus.kt`'s
 * `EXPECTED_FFI_CONTRACT_VERSION` too — there is no compiler check across
 * this Rust/Kotlin/TypeScript boundary, only the runtime `ffiContractVersion()`
 * check in `HorusSdkModule.kt` and `scripts/check-jni-symbols.sh` in CI.
 */
export type PixelFormat = 0 | 1 | 2;

/** Bbox + frame geometry for `pipelineProcessBbox` — mirrors `BboxFrame` (Kotlin Record). */
export interface BboxFrame {
  format: PixelFormat;
  width: number;
  height: number;
  x: number;
  y: number;
  bboxW: number;
  bboxH: number;
}

/**
 * `float[13]` metric pack — mirrors `pipeline_result_to_jarray` in
 * `src/ffi/android.rs` (HORUS core), field order pinned by `metricPack` in
 * `modules/horus-sdk/ffi-contract.json`. Unavailable metrics are `NaN`
 * (including `fatigueLevel`/`stressLevel` — not `-1` — while the fatigue/
 * stress fusion hasn't warmed up yet; handle `NaN` explicitly, don't assume
 * array-index lookups on it will throw).
 */
export type PipelineMetricPack = [
  heartRateBpm: number,
  confidence: number,
  faceDetected: number,
  bufferFill: number,
  sdnnMs: number,
  rmssdMs: number,
  respBpm: number,
  fatigueScore: number,
  stressScore: number,
  fatigueLevel: number,
  stressLevel: number,
  recoveryReadiness: number,
  cognitiveLoad: number,
];
