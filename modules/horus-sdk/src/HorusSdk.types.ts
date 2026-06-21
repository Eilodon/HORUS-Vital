import type { PixelFormat } from './HorusSdk.contract.generated';

export {
  FFI_CONTRACT_VERSION,
  PixelFormat,
  type PipelineMetricPack,
} from './HorusSdk.contract.generated';

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
