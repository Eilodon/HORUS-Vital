import { loadModel, transcribe } from '@qvac/sdk';
import * as Speech from 'expo-speech';

// ggml-base-q8_0: ~57 MB, ~6× real-time on CPU, good English accuracy
const WHISPER_BASE_Q8_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base-q8_0.bin';

let whisperModelId: string | null = null;

export async function ensureWhisper(
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (whisperModelId) return whisperModelId;
  whisperModelId = await loadModel({
    modelSrc: WHISPER_BASE_Q8_URL,
    modelType: 'whisper',
    onProgress: onProgress ? (p) => onProgress(p.percentage ?? 0) : undefined,
  });
  return whisperModelId;
}

export async function transcribeAudio(audioUri: string): Promise<string> {
  const modelId = whisperModelId;
  if (!modelId) throw new Error('Whisper not loaded');
  // Strip file:// prefix — QVAC worker reads raw filesystem path
  const path = audioUri.replace(/^file:\/\//, '');
  return transcribe({ modelId, audioChunk: path });
}

export function speakResponse(text: string): Promise<void> {
  return new Promise((resolve) => {
    Speech.speak(text, {
      language: 'en',
      onDone: resolve,
      onStopped: resolve,
      onError: () => resolve(),
    });
  });
}

export function stopSpeaking() {
  Speech.stop();
}
