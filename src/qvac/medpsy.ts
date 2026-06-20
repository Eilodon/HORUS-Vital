import { loadModel, completion, profiler } from '@qvac/sdk';
import type { PipelineMetricPack } from '../../modules/horus-sdk/src/HorusSdk.types';

export const MEDPSY_1_7B_URL =
  'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf';

export type LoadProgress = { percentage: number; downloaded: number; total: number };

export async function loadMedPsy(
  onProgress?: (p: LoadProgress) => void,
): Promise<string> {
  return loadModel({
    modelSrc: MEDPSY_1_7B_URL,
    modelType: 'llm',
    onProgress: onProgress
      ? (p) => onProgress({ percentage: p.percentage ?? 0, downloaded: p.downloaded ?? 0, total: p.total ?? 0 })
      : undefined,
  });
}

function buildVitalsSystemPrompt(pack: PipelineMetricPack): string {
  const [
    hr, conf, faceDetected, bufferFill,
    sdnnMs, rmssdMs, respBpm,
    fatigueScore, stressScore,
    fatigueLevel, stressLevel,
    recoveryReadiness, cognitiveLoad,
  ] = pack;
  return `You are MedPsy, a clinical-grade biofeedback AI assistant embedded in HORUS-Vital.
Respond concisely (≤3 sentences) with evidence-based guidance.

Live biometric snapshot:
- Heart rate: ${hr.toFixed(1)} bpm (confidence ${(conf * 100).toFixed(0)}%)
- Face detected: ${faceDetected > 0.5 ? 'yes' : 'no'}, buffer fill: ${(bufferFill * 100).toFixed(0)}%
- HRV SDNN: ${sdnnMs.toFixed(1)} ms, RMSSD: ${rmssdMs.toFixed(1)} ms
- Respiration: ${respBpm.toFixed(1)} bpm
- Fatigue score: ${fatigueScore.toFixed(2)} (level ${fatigueLevel.toFixed(0)})
- Stress score: ${stressScore.toFixed(2)} (level ${stressLevel.toFixed(0)})
- Recovery readiness: ${recoveryReadiness.toFixed(2)}
- Cognitive load: ${cognitiveLoad.toFixed(2)}`;
}

export interface InterpretResult {
  text: string;
  ttftMs: number;
  tokensPerSec: number;
}

export async function interpretVitals(
  modelId: string,
  pack: PipelineMetricPack,
  userQuery = 'How am I doing right now and what should I do?',
): Promise<InterpretResult> {
  profiler.enable({ mode: 'summary' });
  const t0 = Date.now();

  const run = completion({
    modelId,
    history: [
      { role: 'system', content: buildVitalsSystemPrompt(pack) },
      { role: 'user', content: userQuery },
    ],
    stream: true,
  });

  let text = '';
  let ttftMs = 0;
  let tokenCount = 0;
  let firstToken = true;
  for await (const event of run.events) {
    if ((event as any).type === 'textDelta') {
      if (firstToken) { ttftMs = Date.now() - t0; firstToken = false; }
      text += (event as any).delta ?? '';
      tokenCount++;
    }
  }

  profiler.disable();

  const elapsedSec = (Date.now() - t0) / 1000;
  const tokensPerSec = elapsedSec > 0 ? tokenCount / elapsedSec : 0;

  return { text, ttftMs, tokensPerSec };
}
