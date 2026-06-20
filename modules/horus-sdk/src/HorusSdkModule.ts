import { NativeModule, requireNativeModule } from 'expo';

import type { BboxFrame, PipelineMetricPack } from './HorusSdk.types';

declare class HorusSdkModule extends NativeModule<{}> {
  pipelineCreate(fps: number, width: number, height: number, bufferSize: number): bigint;
  pipelineProcessBbox(
    handle: bigint,
    frame: Uint8Array,
    frameInfo: BboxFrame,
    timestampUs: bigint,
  ): PipelineMetricPack | null;
  pipelineReset(handle: bigint): void;
  pipelineDestroy(handle: bigint): void;
}

export default requireNativeModule<HorusSdkModule>('HorusSdk');
