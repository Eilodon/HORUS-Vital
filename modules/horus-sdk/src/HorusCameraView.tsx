import { requireNativeViewManager } from 'expo-modules-core';
import { StyleSheet, View, type ViewProps } from 'react-native';

const NativeView = requireNativeViewManager('HorusCameraView');

export function HorusCameraView(props: ViewProps) {
  return (
    <View style={[StyleSheet.absoluteFill, props.style]}>
      <NativeView style={StyleSheet.absoluteFill} />
    </View>
  );
}
