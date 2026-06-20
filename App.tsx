import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import HorusSdkModule from './modules/horus-sdk/src/HorusSdkModule';

/**
 * M0 gate: `pipelineCreate` -> `pipelineDestroy` round-trip with no
 * UnsatisfiedLinkError. See docs/superskills/specs/2026-06-20-horus-vital-app-phase.md (M0).
 */
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

  return (
    <View style={styles.container}>
      <Text>HORUS-Vital — M0 native link check</Text>
      <Text style={styles.status}>
        {linkStatus === 'checking' && 'Checking libhorus.so link...'}
        {linkStatus === 'ok' && '✅ pipelineCreate -> pipelineDestroy round-trip OK'}
        {linkStatus !== 'checking' && linkStatus !== 'ok' && `❌ ${linkStatus}`}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  status: {
    marginTop: 12,
    textAlign: 'center',
  },
});
