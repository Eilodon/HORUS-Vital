import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureWhisper, transcribeAudio, speakResponse, stopSpeaking } from './voice';

type VoicePhase =
  | 'idle'
  | 'loading'      // Whisper downloading
  | 'ready'
  | 'recording'
  | 'transcribing'
  | 'speaking'
  | 'error';

export interface VoiceState {
  phase: VoicePhase;
  whisperProgress: number;
  transcript: string | null;
  error: string | null;
}

export function useVoice() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [state, setState] = useState<VoiceState>({
    phase: 'idle',
    whisperProgress: 0,
    transcript: null,
    error: null,
  });

  // Lazily load Whisper on first mount (runs in background)
  useEffect(() => {
    setState(s => ({ ...s, phase: 'loading' }));
    ensureWhisper((pct) => setState(s => ({ ...s, whisperProgress: pct })))
      .then(() => setState(s => ({ ...s, phase: 'ready', whisperProgress: 100 })))
      .catch(err =>
        setState(s => ({
          ...s, phase: 'error',
          error: err instanceof Error ? err.message : String(err),
        })),
      );
  }, []);

  const startRecording = useCallback(async () => {
    if (state.phase !== 'ready') return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { setState(s => ({ ...s, error: 'Mic permission denied' })); return; }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setState(s => ({ ...s, phase: 'recording', transcript: null, error: null }));
    } catch (err) {
      setState(s => ({
        ...s, phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [state.phase]);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    const recording = recordingRef.current;
    if (!recording) return null;
    try {
      await recording.stopAndUnloadAsync();
      recordingRef.current = null;
      const uri = recording.getURI();
      if (!uri) throw new Error('No audio file');

      setState(s => ({ ...s, phase: 'transcribing' }));
      const text = await transcribeAudio(uri);
      setState(s => ({ ...s, phase: 'ready', transcript: text }));
      return text;
    } catch (err) {
      setState(s => ({
        ...s, phase: 'ready',
        error: err instanceof Error ? err.message : String(err),
      }));
      return null;
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    setState(s => ({ ...s, phase: 'speaking' }));
    await speakResponse(text);
    setState(s => ({ ...s, phase: 'ready' }));
  }, []);

  const stop = useCallback(() => {
    stopSpeaking();
    setState(s => ({ ...s, phase: 'ready' }));
  }, []);

  return { ...state, startRecording, stopAndTranscribe, speak, stop };
}
