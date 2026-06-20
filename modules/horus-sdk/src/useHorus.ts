import { useCallback, useEffect, useRef } from 'react';

import HorusSdkModule from './HorusSdkModule';
import type { BboxFrame, PipelineMetricPack } from './HorusSdk.types';

export interface UseHorusOptions {
  fps?: number;
  width: number;
  height: number;
  bufferSize?: number;
}

/**
 * Owns one `VideoPipeline` handle for the component's lifetime: creates it on
 * mount, destroys it on unmount (M0 round-trip), and exposes the bbox-only
 * ingest path (M2 spine).
 */
export function useHorus({ fps = 30, width, height, bufferSize = 150 }: UseHorusOptions) {
  const handleRef = useRef<bigint | null>(null);

  useEffect(() => {
    handleRef.current = HorusSdkModule.pipelineCreate(fps, width, height, bufferSize);
    return () => {
      if (handleRef.current != null) {
        HorusSdkModule.pipelineDestroy(handleRef.current);
        handleRef.current = null;
      }
    };
  }, [fps, width, height, bufferSize]);

  const processBbox = useCallback(
    (frame: Uint8Array, frameInfo: BboxFrame, timestampUs: bigint): PipelineMetricPack | null => {
      if (handleRef.current == null) return null;
      return HorusSdkModule.pipelineProcessBbox(handleRef.current, frame, frameInfo, timestampUs);
    },
    [],
  );

  const reset = useCallback(() => {
    if (handleRef.current != null) HorusSdkModule.pipelineReset(handleRef.current);
  }, []);

  return { processBbox, reset };
}
