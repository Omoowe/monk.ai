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

type Personality = 'drill_sergeant' | 'stoic_mentor' | 'anime_sensei' | 'goggins' | 'ceo_coach' | 'calm_therapist';

const MORNING_COPY: Record<Personality, { title: string; body: string }> = {
  drill_sergeant: { title: 'FALL IN.',            body: 'Mission unset. Clock is running. Get in here and lock it down — NOW.' },
  stoic_mentor:   { title: 'The day begins.',     body: 'What you do in the next hour sets the trajectory. Set your mission before distraction does.' },
  anime_sensei:   { title: 'Ohayo, warrior.',     body: 'The path is dark without intention. Set your mission — your training awaits.' },
  goggins:        { title: "You're already behind.", body: "Most people rolled over and hit snooze. You didn't. Prove it. What's the mission today?" },
  ceo_coach:      { title: 'Morning check.',      body: "No mission logged. That's not how top performers operate. Open the app. Set it. Go." },
  calm_therapist: { title: 'Good morning.',       body: 'Take a breath. What matters most today? Set your intention — one thing is enough.' },
};

const EVENING_COPY: Record<Personality, { title: string; body: string }> = {
  drill_sergeant: { title: 'DEBRIEF TIME.',       body: 'Did you execute or make excuses? Your coach is waiting. Report in.' },
  stoic_mentor:   { title: 'Reflect.',            body: 'The day ends whether you examine it or not. Debrief now — honest answers only.' },
  anime_sensei:   { title: 'Sensei waits...',     body: 'A warrior without reflection is a warrior who does not grow. Your evening review is due.' },
  goggins:        { title: "Don't lie to yourself.", body: "Did you do what you said? No sugar coating. Open the app and face the truth." },
  ceo_coach:      { title: 'EOD debrief.',        body: "Top performers review their day. 60 seconds. Did you ship what you committed to?" },
  calm_therapist: { title: 'Evening check-in.',   body: "How did today feel? There's no judgment — just honest reflection before you rest." },
};

const STREAK_COPY: Record<Personality, { title: string; body: string }> = {
  drill_sergeant: { title: 'STREAK IN DANGER.',  body: "Soldier — your streak dies tonight if you don't move. Get your habits done. Now." },
  stoic_mentor:   { title: 'The streak is at risk.', body: 'Consistency is built one day at a time. Today is almost over. Complete what you started.' },
  anime_sensei:   { title: 'Your fire dims...',  body: 'The streak you built is fading. One last effort tonight keeps the flame alive.' },
  goggins:        { title: 'STREAK ENDS TONIGHT?', body: "You built that with suffering. You're going to let it die? Get up. Finish." },
  ceo_coach:      { title: 'Streak alert.',       body: "Consistency compounds. Your streak is on the line tonight — close your habits before midnight." },
  calm_therapist: { title: 'A gentle reminder.',  body: "Your habits are still open for today. Even one small step keeps the momentum going." },
};

export async function scheduleDailyReminders(
  morningH = 8, morningM = 0,
  eveningH = 20, eveningM = 30,
  personality: Personality = 'stoic_mentor',
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const mc = MORNING_COPY[personality];
  await Notifications.scheduleNotificationAsync({
    identifier: 'morning-checkin',
    content: { title: mc.title, body: mc.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: morningH, minute: morningM, repeats: true,
    },
  });

  const ec = EVENING_COPY[personality];
  await Notifications.scheduleNotificationAsync({
    identifier: 'evening-checkin',
    content: { title: ec.title, body: ec.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: eveningH, minute: eveningM, repeats: true,
    },
  });

  const sc = STREAK_COPY[personality];
  await Notifications.scheduleNotificationAsync({
    identifier: 'streak-warning',
    content: { title: sc.title, body: sc.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 22, minute: 0, repeats: true,
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
