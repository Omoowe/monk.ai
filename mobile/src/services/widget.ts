import { NativeModules, Platform } from 'react-native';

interface WidgetData {
  streak: number;
  doneCount: number;
  totalCount: number;
  personality: string;
  name: string;
}

export function updateWidgetData(data: WidgetData): void {
  if (Platform.OS !== 'ios') return;
  try {
    NativeModules.MonkWidgetBridge?.updateWidgetData(data);
  } catch {}
}
