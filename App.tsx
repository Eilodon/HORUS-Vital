import { useEffect, useRef, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import HorusSdkModule from './modules/horus-sdk/src/HorusSdkModule';
import { useMedPsy } from './src/qvac/useMedPsy';
import type { PipelineMetricPack } from './modules/horus-sdk/src/HorusSdk.types';

// Synthetic metric pack for M1 gate (camera not wired until M2)
const DEMO_PACK: PipelineMetricPack = [
  72.4,  // heartRateBpm
  0.91,  // confidence
  1.0,   // faceDetected
  0.85,  // bufferFill
  48.2,  // sdnnMs
  38.7,  // rmssdMs
  15.3,  // respBpm
  0.42,  // fatigueScore
  0.38,  // stressScore
  1.0,   // fatigueLevel
  1.0,   // stressLevel
  0.72,  // recoveryReadiness
  0.45,  // cognitiveLoad
];

function useHorusLinkCheck() {
  const [status, setStatus] = useState<'checking' | 'ok' | string>('checking');
  useEffect(() => {
    try {
      const handle = HorusSdkModule.pipelineCreate(30, 640, 480, 150);
      HorusSdkModule.pipelineDestroy(handle);
      setStatus('ok');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }, []);
  return status;
}

export default function App() {
  const linkStatus = useHorusLinkCheck();
  const { phase, loadProgress, error, lastResult, interpret } = useMedPsy();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (phase === 'ready' && !didRunRef.current) {
      didRunRef.current = true;
      interpret(DEMO_PACK, 'How am I doing right now and what should I do?');
    }
  }, [phase, interpret]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>HORUS-Vital</Text>

      <Section label="M0 — native link">
        {linkStatus === 'checking' && <Row text="Checking libhorus.so..." />}
        {linkStatus === 'ok' && <Row text="✅ pipelineCreate → pipelineDestroy OK" />}
        {linkStatus !== 'checking' && linkStatus !== 'ok' && <Row text={`❌ ${linkStatus}`} />}
      </Section>

      <Section label="M1 — MedPsy-1.7B QVAC">
        {phase === 'loading' && (
          <Row text={`Downloading model… ${loadProgress.toFixed(0)}%`} />
        )}
        {phase === 'ready' && !lastResult && (
          <Row text="Model ready — running demo completion…" />
        )}
        {phase === 'inferring' && <Row text="Inferring…" />}
        {phase === 'error' && <Row text={`❌ ${error}`} />}
        {lastResult && (
          <>
            <Row text={`✅ TTFT ${lastResult.ttftMs} ms · ${lastResult.tokensPerSec.toFixed(1)} tok/s`} />
            <Text style={styles.responseText}>{lastResult.text}</Text>
          </>
        )}
        {phase === 'ready' && lastResult && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => interpret(DEMO_PACK)}
          >
            <Text style={styles.btnText}>Run again</Text>
          </TouchableOpacity>
        )}
      </Section>

      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ text }: { text: string }) {
  return <Text style={styles.row}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', alignItems: 'center', padding: 24, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 24 },
  section: { width: '100%', marginBottom: 20, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8, textTransform: 'uppercase' },
  row: { fontSize: 14, color: '#333', marginBottom: 4 },
  responseText: { fontSize: 14, color: '#1a1a1a', marginTop: 8, lineHeight: 20 },
  btn: { marginTop: 12, backgroundColor: '#0066cc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'flex-start' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
