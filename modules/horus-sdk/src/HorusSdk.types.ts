/** 0=RGB888, 1=RGBA8888, 2=NV21 — mirrors `PixelFormat` in the Rust core. */
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
 * `src/ffi/android.rs` (HORUS core). Unavailable metrics are `NaN`.
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
