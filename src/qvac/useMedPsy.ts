import { useCallback, useEffect, useRef, useState } from 'react';
import { loadMedPsy, interpretVitals } from './medpsy';
import type { InterpretResult } from './medpsy';
import type { PipelineMetricPack } from '../../modules/horus-sdk/src/HorusSdk.types';

type Phase = 'idle' | 'loading' | 'ready' | 'inferring' | 'error';

export interface MedPsyState {
  phase: Phase;
  loadProgress: number;
  error: string | null;
  lastResult: InterpretResult | null;
}

export function useMedPsy() {
  const modelIdRef = useRef<string | null>(null);
  const [state, setState] = useState<MedPsyState>({
    phase: 'idle',
    loadProgress: 0,
    error: null,
    lastResult: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, phase: 'loading', loadProgress: 0, error: null }));

    loadMedPsy((p) => {
      if (!cancelled) setState(s => ({ ...s, loadProgress: p.percentage }));
    })
      .then(id => {
        if (cancelled) return;
        modelIdRef.current = id;
        setState(s => ({ ...s, phase: 'ready', loadProgress: 100 }));
      })
      .catch(err => {
        if (cancelled) return;
        setState(s => ({ ...s, phase: 'error', error: err instanceof Error ? err.message : String(err) }));
      });

    return () => { cancelled = true; };
  }, []);

  const interpret = useCallback(
    async (pack: PipelineMetricPack, query?: string): Promise<InterpretResult | null> => {
      if (!modelIdRef.current || state.phase !== 'ready') return null;
      setState(s => ({ ...s, phase: 'inferring' }));
      try {
        const result = await interpretVitals(modelIdRef.current, pack, query);
        setState(s => ({ ...s, phase: 'ready', lastResult: result }));
        return result;
      } catch (err) {
        setState(s => ({
          ...s,
          phase: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
        return null;
      }
    },
    [state.phase],
  );

  return { ...state, interpret };
}
