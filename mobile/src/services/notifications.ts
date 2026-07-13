import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const REMINDERS_KEY = 'monk_reminders_enabled';
const MORNING_TIME_KEY = 'monk_morning_time';
const EVENING_TIME_KEY = 'monk_evening_time';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getNotificationTimes(): Promise<{ morningH: number; morningM: number; eveningH: number; eveningM: number }> {
  const [mStr, eStr] = await Promise.all([
    AsyncStorage.getItem(MORNING_TIME_KEY),
    AsyncStorage.getItem(EVENING_TIME_KEY),
  ]);
  const morning = mStr ? JSON.parse(mStr) : { h: 8, m: 0 };
  const evening = eStr ? JSON.parse(eStr) : { h: 20, m: 30 };
  return { morningH: morning.h, morningM: morning.m, eveningH: evening.h, eveningM: evening.m };
}

export async function setNotificationTimes(morningH: number, morningM: number, eveningH: number, eveningM: number): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(MORNING_TIME_KEY, JSON.stringify({ h: morningH, m: morningM })),
    AsyncStorage.setItem(EVENING_TIME_KEY, JSON.stringify({ h: eveningH, m: eveningM })),
  ]);
}

export async function scheduleDailyReminders(morningH = 8, morningM = 0, eveningH = 20, eveningM = 30): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    identifier: 'morning-checkin',
    content: {
      title: 'Morning Mission',
      body: 'Set your one thing for today. Your coach is waiting.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: morningH,
      minute: morningM,
      repeats: true,
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: 'evening-checkin',
    content: {
      title: 'Evening Debrief',
      body: 'Did you do what you said you would? Be honest.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: eveningH,
      minute: eveningM,
      repeats: true,
    },
  });

  await AsyncStorage.setItem(REMINDERS_KEY, 'true');
}

export async function cancelDailyReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.setItem(REMINDERS_KEY, 'false');
}

export async function getScheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}

export async function remindersWereEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(REMINDERS_KEY);
  return val === 'true';
}

export async function registerAndSavePushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return; // Expo push tokens don't work in simulator
  const granted = await requestNotificationPermission();
  if (!granted) return;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    await supabase.from('users').update({ expo_push_token: token }).eq('id', userId);
  } catch {
    // Non-fatal — push token registration failure shouldn't break login
  }
}
