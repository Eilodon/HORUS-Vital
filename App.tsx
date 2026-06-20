import { EventEmitter } from 'expo-modules-core';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    }).then(status => setGranted(status === PermissionsAndroid.RESULTS.GRANTED));
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
  const { phase, loadProgress, lastResult, interpret } = useMedPsy();

  const interpret$ = useCallback(() => {
    if (phase !== 'ready') return;
    const pack: PipelineMetricPack = [
      metrics.hr, metrics.conf, metrics.faceDetected, metrics.bufferFill,
      metrics.sdnnMs, metrics.rmssdMs, metrics.respBpm,
      metrics.fatigueScore, metrics.stressScore,
      metrics.fatigueLevel, metrics.stressLevel,
      metrics.recoveryReadiness, metrics.cognitiveLoad,
    ];
    interpret(pack);
  }, [phase, metrics, interpret]);

  const faceActive = metrics.faceDetected > 0.5;
  const bufPct = (metrics.bufferFill * 100).toFixed(0);

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Camera / placeholder */}
      {cameraGranted === null && (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.placeholderText}>Requesting camera…</Text>
        </View>
      )}
      {cameraGranted === false && (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.placeholderText}>Camera permission denied</Text>
        </View>
      )}
      {cameraGranted === true && (
        <HorusCameraView style={styles.camera} />
      )}

      {/* Status bar: face + buffer */}
      <View style={styles.statusBar}>
        <Text style={[styles.statusDot, faceActive && styles.statusDotActive]}>
          {faceActive ? '● Face' : '○ No face'}
        </Text>
        <Text style={styles.statusLabel}>Buffer {bufPct}%</Text>
        {phase === 'loading' && (
          <Text style={styles.statusLabel}>MedPsy {loadProgress.toFixed(0)}%</Text>
        )}
      </View>

      {/* Vitals overlay */}
      <View style={styles.vitalsPanel}>
        <Row label="HR" value={`${metrics.hr.toFixed(0)} bpm`} conf={metrics.conf} />
        <Row label="RMSSD" value={`${metrics.rmssdMs.toFixed(1)} ms`} />
        <Row label="Resp" value={`${metrics.respBpm.toFixed(1)} /min`} />
        <Row label="Fatigue" value={lvl(metrics.fatigueLevel)} />
        <Row label="Stress" value={lvl(metrics.stressLevel)} />
        <Row label="Recovery" value={`${(metrics.recoveryReadiness * 100).toFixed(0)}%`} />
        <Row label="Cog load" value={`${(metrics.cognitiveLoad * 100).toFixed(0)}%`} />
      </View>

      {/* MedPsy panel */}
      <View style={styles.medpsyPanel}>
        {lastResult ? (
          <>
            <Text style={styles.medpsyMeta}>
              MedPsy · TTFT {lastResult.ttftMs} ms · {lastResult.tokensPerSec.toFixed(1)} tok/s
            </Text>
            <ScrollView style={styles.medpsyScroll}>
              <Text style={styles.medpsyText}>{lastResult.text}</Text>
            </ScrollView>
          </>
        ) : (
          <Text style={styles.medpsyMeta}>
            {phase === 'loading' ? `Loading MedPsy… ${loadProgress.toFixed(0)}%`
              : phase === 'ready' ? 'Tap Ask MedPsy to interpret vitals'
              : phase === 'inferring' ? 'MedPsy inferring…'
              : phase === 'error' ? 'MedPsy unavailable'
              : 'Initialising…'}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.askBtn, phase !== 'ready' && styles.askBtnDisabled]}
          onPress={interpret$}
          disabled={phase !== 'ready'}
        >
          <Text style={styles.askBtnText}>
            {phase === 'inferring' ? 'Inferring…' : 'Ask MedPsy'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function lvl(level: number) {
  return ['OK', 'Mild', 'Moderate', 'High', 'Critical'][Math.round(level)] ?? '—';
}

function Row({ label, value, conf }: { label: string; value: string; conf?: number }) {
  return (
    <View style={styles.vitalRow}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={styles.vitalValue}>
        {value}
        {conf !== undefined && conf < 0.6 ? ' ⚠' : ''}
      </Text>
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { ...StyleSheet.absoluteFillObject },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#111',
  },
  placeholderText: { color: '#aaa', fontSize: 16 },

  statusBar: {
    position: 'absolute', top: 48, left: 16, right: 16,
    flexDirection: 'row', gap: 12,
  },
  statusDot: { color: '#666', fontSize: 13 },
  statusDotActive: { color: '#4ade80' },
  statusLabel: { color: '#aaa', fontSize: 13 },

  vitalsPanel: {
    position: 'absolute', top: 76, right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10, padding: 10, minWidth: 140,
  },
  vitalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  vitalLabel: { color: '#94a3b8', fontSize: 12, marginRight: 8 },
  vitalValue: { color: '#f1f5f9', fontSize: 12, fontVariant: ['tabular-nums'] },

  medpsyPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, paddingBottom: 32, maxHeight: 240,
  },
  medpsyMeta: { color: '#64748b', fontSize: 11, marginBottom: 6 },
  medpsyScroll: { maxHeight: 100 },
  medpsyText: { color: '#e2e8f0', fontSize: 13, lineHeight: 20 },
  askBtn: {
    marginTop: 10, backgroundColor: '#2563eb',
    borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  askBtnDisabled: { backgroundColor: '#1e3a5f' },
  askBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
