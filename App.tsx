import { EventEmitter } from 'expo-modules-core';
import { useCallback, useEffect, useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { HorusCameraView } from './modules/horus-sdk/src/HorusCameraView';
import HorusSdkModule from './modules/horus-sdk/src/HorusSdkModule';
import { useMedPsy } from './src/qvac/useMedPsy';
import { useVoice } from './src/voice/useVoice';
import type { PipelineMetricPack } from './modules/horus-sdk/src/HorusSdk.types';

// ── types ──────────────────────────────────────────────────────────────────

interface MetricsPayload {
  hr: number; conf: number; faceDetected: number; bufferFill: number;
  sdnnMs: number; rmssdMs: number; respBpm: number;
  fatigueScore: number; stressScore: number;
  fatigueLevel: number; stressLevel: number;
  recoveryReadiness: number; cognitiveLoad: number;
}

const EMPTY_METRICS: MetricsPayload = {
  hr: 0, conf: 0, faceDetected: 0, bufferFill: 0,
  sdnnMs: 0, rmssdMs: 0, respBpm: 0,
  fatigueScore: 0, stressScore: 0,
  fatigueLevel: 0, stressLevel: 0,
  recoveryReadiness: 0, cognitiveLoad: 0,
};

// ── hooks ──────────────────────────────────────────────────────────────────

function useCameraPermission() {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') { setGranted(false); return; }
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera Permission',
      message: 'HORUS-Vital needs camera access for biometric monitoring.',
      buttonPositive: 'Allow',
    }).then(s => setGranted(s === PermissionsAndroid.RESULTS.GRANTED));
  }, []);
  return granted;
}

type HorusEvents = { onMetrics: (data: MetricsPayload) => void };

function useLiveMetrics() {
  const [metrics, setMetrics] = useState<MetricsPayload>(EMPTY_METRICS);
  useEffect(() => {
    const emitter = new EventEmitter<HorusEvents>(HorusSdkModule as any);
    const sub = emitter.addListener('onMetrics', (data) => setMetrics(data));
    return () => sub.remove();
  }, []);
  return metrics;
}

// ── main ───────────────────────────────────────────────────────────────────

export default function App() {
  const cameraGranted = useCameraPermission();
  const metrics = useLiveMetrics();
  const medpsy = useMedPsy();
  const voice = useVoice();

  const livePack = useCallback((): PipelineMetricPack => [
    metrics.hr, metrics.conf, metrics.faceDetected, metrics.bufferFill,
    metrics.sdnnMs, metrics.rmssdMs, metrics.respBpm,
    metrics.fatigueScore, metrics.stressScore,
    metrics.fatigueLevel, metrics.stressLevel,
    metrics.recoveryReadiness, metrics.cognitiveLoad,
  ], [metrics]);

  // Text "Ask MedPsy" → interpret → speak response
  const askText = useCallback(async () => {
    if (medpsy.phase !== 'ready') return;
    const result = await medpsy.interpret(livePack());
    if (result?.text && voice.phase === 'ready') voice.speak(result.text);
  }, [medpsy, livePack, voice]);

  // Mic tap: start / stop recording → transcribe → interpret → speak
  const handleMic = useCallback(async () => {
    if (voice.phase === 'recording') {
      const text = await voice.stopAndTranscribe();
      if (text && medpsy.phase === 'ready') {
        const result = await medpsy.interpret(livePack(), text);
        if (result?.text) voice.speak(result.text);
      }
    } else if (voice.phase === 'ready') {
      voice.startRecording();
    } else if (voice.phase === 'speaking') {
      voice.stop();
    }
  }, [voice, medpsy, livePack]);

  const faceActive = metrics.faceDetected > 0.5;
  const bufPct = (metrics.bufferFill * 100).toFixed(0);

  const medpsyBusy = medpsy.phase === 'inferring';
  const voiceBusy  = voice.phase === 'recording' || voice.phase === 'transcribing';

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Camera / placeholder */}
      {cameraGranted === null && (
        <View style={styles.fill}><Text style={styles.dim}>Requesting camera…</Text></View>
      )}
      {cameraGranted === false && (
        <View style={styles.fill}><Text style={styles.dim}>Camera permission denied</Text></View>
      )}
      {cameraGranted === true && <HorusCameraView style={styles.fill} />}

      {/* Top status bar */}
      <View style={styles.statusBar}>
        <Text style={[styles.dot, faceActive && styles.dotActive]}>
          {faceActive ? '● Face' : '○ No face'}
        </Text>
        <Text style={styles.dim2}>buf {bufPct}%</Text>
        {medpsy.phase === 'loading' && (
          <Text style={styles.dim2}>MedPsy {medpsy.loadProgress.toFixed(0)}%</Text>
        )}
        {voice.phase === 'loading' && (
          <Text style={styles.dim2}>Whisper {voice.whisperProgress.toFixed(0)}%</Text>
        )}
      </View>

      {/* Vitals overlay */}
      <View style={styles.vitals}>
        <VRow label="HR"       value={`${metrics.hr.toFixed(0)} bpm`} warn={metrics.conf < 0.6} />
        <VRow label="RMSSD"    value={`${metrics.rmssdMs.toFixed(1)} ms`} />
        <VRow label="Resp"     value={`${metrics.respBpm.toFixed(1)} /min`} />
        <VRow label="Fatigue"  value={lvl(metrics.fatigueLevel)} />
        <VRow label="Stress"   value={lvl(metrics.stressLevel)} />
        <VRow label="Recovery" value={`${(metrics.recoveryReadiness * 100).toFixed(0)}%`} />
        <VRow label="Cog"      value={`${(metrics.cognitiveLoad * 100).toFixed(0)}%`} />
      </View>

      {/* Bottom panel: MedPsy + voice */}
      <View style={styles.panel}>
        {/* Transcript / response */}
        {voice.transcript && (
          <Text style={styles.transcript}>🎤 {voice.transcript}</Text>
        )}
        {medpsy.lastResult ? (
          <ScrollView style={styles.scroll}>
            <Text style={styles.meta}>
              MedPsy · TTFT {medpsy.lastResult.ttftMs} ms · {medpsy.lastResult.tokensPerSec.toFixed(1)} tok/s
            </Text>
            <Text style={styles.response}>{medpsy.lastResult.text}</Text>
          </ScrollView>
        ) : (
          <Text style={styles.meta}>
            {medpsy.phase === 'loading'
              ? `Loading MedPsy… ${medpsy.loadProgress.toFixed(0)}%`
              : voice.phase === 'loading'
              ? `Loading Whisper… ${voice.whisperProgress.toFixed(0)}%`
              : medpsyBusy ? 'Inferring…'
              : voiceBusy  ? (voice.phase === 'transcribing' ? 'Transcribing…' : '● Recording…')
              : voice.phase === 'speaking' ? 'Speaking…'
              : 'Tap Ask or 🎤 to query vitals'}
          </Text>
        )}

        {/* Action row */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, (medpsyBusy || medpsy.phase !== 'ready') && styles.btnDim]}
            onPress={askText}
            disabled={medpsy.phase !== 'ready' || medpsyBusy}
          >
            <Text style={styles.btnTxt}>
              {medpsyBusy ? 'Inferring…' : 'Ask MedPsy'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.micBtn,
              voice.phase === 'recording' && styles.micBtnActive,
              (voice.phase === 'loading' || voice.phase === 'transcribing') && styles.btnDim,
            ]}
            onPress={handleMic}
            disabled={voice.phase === 'loading' || voice.phase === 'transcribing' || voice.phase === 'error'}
          >
            <Text style={styles.micIcon}>
              {voice.phase === 'recording' ? '⏹' : voice.phase === 'speaking' ? '🔊' : '🎤'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function lvl(level: number) {
  // NaN means the fusion estimator hasn't warmed up yet (see android.rs
  // pipeline_result_to_jarray docs) — distinct from a valid level, so check
  // explicitly rather than relying on Math.round(NaN) → NaN → array miss.
  if (Number.isNaN(level)) return '—';
  return ['OK', 'Mild', 'Mod', 'High', 'Crit'][Math.round(level)] ?? '—';
}

function VRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.vrow}>
      <Text style={styles.vlabel}>{label}</Text>
      <Text style={[styles.vvalue, warn && styles.vwarn]}>{value}</Text>
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  fill: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  dim:  { color: '#888', fontSize: 16 },

  statusBar: {
    position: 'absolute', top: 48, left: 16, right: 16,
    flexDirection: 'row', gap: 12, alignItems: 'center',
  },
  dot:       { color: '#555', fontSize: 13 },
  dotActive: { color: '#4ade80' },
  dim2:      { color: '#555', fontSize: 12 },

  vitals: {
    position: 'absolute', top: 74, right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10, padding: 10, minWidth: 138,
  },
  vrow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  vlabel: { color: '#94a3b8', fontSize: 12 },
  vvalue: { color: '#f1f5f9', fontSize: 12, fontVariant: ['tabular-nums'] },
  vwarn:  { color: '#fbbf24' },

  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, paddingBottom: 36,
  },
  transcript: { color: '#7dd3fc', fontSize: 13, marginBottom: 6, fontStyle: 'italic' },
  meta:       { color: '#475569', fontSize: 11, marginBottom: 6 },
  scroll:     { maxHeight: 90, marginBottom: 8 },
  response:   { color: '#e2e8f0', fontSize: 13, lineHeight: 20 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  btn: {
    flex: 1, backgroundColor: '#1d4ed8',
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  btnDim: { backgroundColor: '#1e293b' },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },

  micBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
  },
  micBtnActive: { backgroundColor: '#dc2626' },
  micIcon: { fontSize: 22 },
});
