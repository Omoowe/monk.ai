import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { fscale, scale } from '../utils/scale';
import { supabase } from '../lib/supabase';
import { getMorningBrief, getEveningFeedback } from '../services/ai';
import { buildCoachContext } from '../services/context';
import { recalculateStats, updateHabitStreak } from '../services/stats';
import { enqueueAction, getQueueLength } from '../services/offline';
import { drainOfflineQueue } from '../services/syncQueue';
import MarkdownText from '../components/MarkdownText';
import MilestoneModal from '../components/MilestoneModal';
import { checkAndAwardMilestones, type Milestone } from '../services/milestones';
import { HabitRowSkeleton } from '../components/Skeleton';
import HabitHistoryModal from '../components/HabitHistoryModal';
import PaywallModal from '../components/PaywallModal';
import { useUser } from '../context/UserContext';
import { getCoachColor, getContrastText } from '../utils/coachColors';
import { updateWidgetData } from '../services/widget';

const HABIT_EMOJIS = [
  '✅','💪','🏃','🧘','📚','💧','🥗','😴',
  '🧠','💼','✍️','🎯','🔥','🌅','🏋️','🚴',
  '🎵','🌿','☕','🏊','🚶','🧹','💊','📝',
];

const HABIT_TEMPLATES = [
  { name: 'Wake up early',  emoji: '🌅' },
  { name: 'Exercise',       emoji: '💪' },
  { name: 'Read 30 min',    emoji: '📚' },
  { name: 'Drink 2L water', emoji: '💧' },
  { name: 'Meditate',       emoji: '🧘' },
  { name: 'Cold shower',    emoji: '🚿' },
  { name: 'No phone AM',    emoji: '📵' },
  { name: 'Journal',        emoji: '📝' },
  { name: 'Walk outside',   emoji: '🚶' },
  { name: 'Sleep early',    emoji: '💤' },
];

function StreakBadge({ days }: { days: number }) {
  if (days === 0) return null;
  if (days >= 30) return (
    <View style={[styles.streakBadge, styles.streakKing]}>
      <View style={[styles.streakBar, { backgroundColor: '#f5c840' }]} />
      <View style={[styles.streakBar, { backgroundColor: '#f5c840' }]} />
      <View style={[styles.streakBar, { backgroundColor: '#f5c840' }]} />
      <Text style={[styles.streakDays, { color: '#f5c840' }]}>{days}d</Text>
    </View>
  );
  if (days >= 7) return (
    <View style={[styles.streakBadge, styles.streakHot]}>
      <View style={[styles.streakBar, { backgroundColor: '#f0a060' }]} />
      <View style={[styles.streakBar, { backgroundColor: '#f0a060', height: 9 }]} />
      <Text style={[styles.streakDays, { color: '#f0a060' }]}>{days}d</Text>
    </View>
  );
  return (
    <View style={[styles.streakBadge, styles.streakNew]}>
      <View style={[styles.streakBar, { backgroundColor: '#b8f058', height: 8 }]} />
      <Text style={[styles.streakDays, { color: '#b8f058' }]}>{days}d</Text>
    </View>
  );
}

function getCheckinCopy(type: 'morning' | 'evening'): { heading: string; placeholder: string } {
  const h = new Date().getHours();
  if (type === 'morning') {
    if (h < 9)  return { heading: 'Rise early. Set your mission.', placeholder: 'The one thing that matters most today.' };
    if (h < 12) return { heading: "What's your mission today?", placeholder: 'One clear commitment for the day ahead.' };
    return { heading: 'Late start — lock in your mission.', placeholder: 'What will you accomplish before tonight?' };
  }
  if (h < 18) return { heading: 'Early debrief. How is the day going?', placeholder: 'Honest reflection — what has happened so far?' };
  if (h < 22) return { heading: 'Did you complete your mission?', placeholder: 'Be honest. Your coach remembers.' };
  return { heading: 'End of day. Did you execute?', placeholder: 'Last honest look at your day.' };
}

type Phase = 'pick' | 'morning' | 'evening' | 'result';

const CAT_COLORS: Record<string, string> = {
  health: '#b8f058', business: '#40f5c8', mindset: '#7b6af0',
  fitness: '#f5c840', learning: '#f0a060', productivity: '#60c8f0', other: '#888',
};

interface Habit {
  id: string;
  name: string;
  emoji: string;
  streak_days: number;
  completedToday: boolean;
  sort_order: number;
  category: string;
  effort_level: number; // 1=low 2=med 3=high
}

export default function CheckInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { profile } = useUser();
  const accent = getCoachColor(profile?.personality);
  const accentText = getContrastText(accent);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>('pick');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [resultType, setResultType] = useState<'morning' | 'evening'>('morning');
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);
  const [morningMissionText, setMorningMissionText] = useState('');
  const [morningEnergyStored, setMorningEnergyStored] = useState(3);
  const [morningDistractionStored, setMorningDistractionStored] = useState('');
  const [eveningCompletedStored, setEveningCompletedStored] = useState<boolean | null>(null);
  const [eveningReasonStored, setEveningReasonStored] = useState('');
  const [morningAiSummary, setMorningAiSummary] = useState('');
  const [eveningAiSummary, setEveningAiSummary] = useState('');
  const [morningDoneTime, setMorningDoneTime] = useState('');
  const [eveningDoneTime, setEveningDoneTime] = useState('');

  // Forms
  const [mission, setMission] = useState('');
  const [energy, setEnergy] = useState(3);
  const [distraction, setDistraction] = useState('');
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');

  // Habits (shown on pick screen)
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(false);
  const [graceEligible, setGraceEligible] = useState(false);
  const [graceStreak, setGraceStreak] = useState(0);
  const [recoverySucceeded, setRecoverySucceeded] = useState(false);

  // Habit management
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [habitName, setHabitName] = useState('');
  const [habitEmoji, setHabitEmoji] = useState('✅');
  const [habitSaving, setHabitSaving] = useState(false);
  const [habitError, setHabitError] = useState('');
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [historyHabit, setHistoryHabit] = useState<{ id: string; name: string; emoji: string } | null>(null);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});
  const scrollRef = useRef<ScrollView>(null);
  const checkAnimMap = useRef<Record<string, Animated.Value>>({});
  const habitItemAnims = useRef<Animated.Value[]>([]);
  const getCheckAnim = (id: string): Animated.Value => {
    if (!checkAnimMap.current[id]) checkAnimMap.current[id] = new Animated.Value(1);
    return checkAnimMap.current[id];
  };

  const loadHabits = useCallback(async () => {
    setHabitsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];
      const [{ data: habitsData }, { data: completionsData }] = await Promise.all([
        supabase.from('habits').select('id, name, emoji, streak_days, sort_order, category').eq('user_id', user.id).order('sort_order', { ascending: true }),
        supabase.from('habit_completions').select('habit_id, effort_level').eq('user_id', user.id).eq('date', today),
      ]);
      const completionMap = new Map((completionsData ?? []).map((c: any) => [c.habit_id, c.effort_level ?? 2]));
      const loadedHabits = (habitsData ?? []).map((h: any) => ({
        id: h.id, name: h.name,
        emoji: h.emoji || '✅',
        streak_days: h.streak_days || 0,
        completedToday: completionMap.has(h.id),
        effort_level: completionMap.get(h.id) ?? 2,
        sort_order: h.sort_order ?? 0,
        category: h.category || 'other',
      }));
      setHabits(loadedHabits);

      // Check grace window (yesterday missed, day before had activity)
      const { data: grace } = await supabase.rpc('check_streak_grace', { p_user_id: user.id });
      if (grace) {
        const { data: userData } = await supabase.from('users').select('streak_before_break').eq('id', user.id).single();
        setGraceEligible(true);
        setGraceStreak(userData?.streak_before_break ?? 0);
      }
    } catch (err) {
      console.error('Failed to load habits:', err instanceof Error ? err.message : String(err));
    } finally {
      setHabitsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!habitsLoading && habits.length > 0) {
      habitItemAnims.current = habits.map(() => new Animated.Value(0));
      Animated.stagger(40, habitItemAnims.current.map(a =>
        Animated.spring(a, { toValue: 1, tension: 80, friction: 14, useNativeDriver: true })
      )).start();
    }
  }, [habitsLoading]);

  const checkTodayStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('check_ins')
        .select('type, mission, energy, distraction, completed, reason, ai_summary, created_at')
        .eq('user_id', user.id).eq('date', today);
      const morning = (data ?? []).find((c: any) => c.type === 'morning');
      const evening = (data ?? []).find((c: any) => c.type === 'evening');
      setMorningDone(!!morning);
      setEveningDone(!!evening);
      setMorningMissionText(morning?.mission ?? '');
      setMorningEnergyStored(morning?.energy ?? 3);
      setMorningDistractionStored(morning?.distraction ?? '');
      setEveningCompletedStored(evening?.completed ?? null);
      setEveningReasonStored(evening?.reason ?? '');
      setMorningAiSummary(morning?.ai_summary ?? '');
      setEveningAiSummary(evening?.ai_summary ?? '');
      if (morning?.created_at) {
        setMorningDoneTime(new Date(morning.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      if (evening?.created_at) {
        setEveningDoneTime(new Date(evening.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch {}
  }, []);

  const syncAndRefresh = useCallback(async () => {
    const synced = await drainOfflineQueue();
    if (synced > 0) { checkTodayStatus(); loadHabits(); }
    const remaining = await getQueueLength();
    setPendingSync(remaining);
  }, [checkTodayStatus, loadHabits]);

  useEffect(() => {
    checkTodayStatus();
    loadHabits();
    syncAndRefresh();
  }, [checkTodayStatus, loadHabits, syncAndRefresh]);


  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      setPhase('pick');
      checkTodayStatus();
      loadHabits();
      syncAndRefresh();
    });
    return unsub;
  }, [navigation, checkTodayStatus, loadHabits, syncAndRefresh]);

  const STREAK_MILESTONES = [7, 14, 21, 30, 60, 100];

  const checkStreakMilestone = (newStreak: number) => {
    if (STREAK_MILESTONES.includes(newStreak)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        `${newStreak}-Day Streak`,
        newStreak >= 30
          ? 'Rare territory. Most quit by week two. You didn\'t.'
          : newStreak >= 14
          ? 'Two weeks of discipline. This is becoming identity.'
          : 'One week down. The habit is forming.',
        [{ text: 'Keep going', style: 'default' }]
      );
    }
  };

  const toggleHabit = async (habitId: string, current: boolean) => {
    Haptics.impactAsync(current ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    if (!current) {
      const anim = getCheckAnim(habitId);
      anim.setValue(0.7);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 260 }).start();
    }
    // Optimistic update — reflect immediately, roll back on failure
    setHabits((prev) => prev.map((h) => {
      if (h.id !== habitId) return h;
      const newStreak = !current ? h.streak_days + 1 : Math.max(0, h.streak_days - 1);
      if (!current) checkStreakMilestone(newStreak);
      return { ...h, completedToday: !current, streak_days: newStreak };
    }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];
      if (current) {
        await supabase.from('habit_completions').delete()
          .eq('habit_id', habitId).eq('user_id', user.id).eq('date', today);
      } else {
        await supabase.from('habit_completions').insert({ habit_id: habitId, user_id: user.id, date: today, effort_level: 2 });
        checkAndAwardMilestones(user.id).then((m) => { if (m) setMilestone(m); }).catch(() => {});
      }
      updateHabitStreak(habitId).catch(() => {});
      recalculateStats(user.id).catch(() => {});
      // Push latest state to home screen widget
      setHabits((prev) => {
        const updated = prev.map(h => h.id === habitId ? { ...h, completedToday: !current } : h);
        const done = updated.filter(h => h.completedToday).length;
        updateWidgetData({
          streak:      profile?.streak ?? 0,
          doneCount:   done,
          totalCount:  updated.length,
          personality: profile?.personality ?? 'stoic_mentor',
          name:        profile?.name ?? '',
        });
        return updated;
      });
    } catch {
      // Network failure — keep optimistic state, queue for sync when back online
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (user) {
        const today = new Date().toISOString().split('T')[0];
        await enqueueAction({
          type: 'habit_toggle',
          payload: { habitId, completed: !current, date: today },
        });
        setPendingSync((n) => n + 1);
      }
    }
  };

  const setHabitEffort = async (habitId: string, effort: number) => {
    setHabits((prev) => prev.map((h) => h.id === habitId ? { ...h, effort_level: effort } : h));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('habit_completions')
        .update({ effort_level: effort })
        .eq('habit_id', habitId).eq('user_id', user.id).eq('date', today);
    } catch {}
  };

  const handleMorningSubmit = async () => {
    if (!mission.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const today = new Date().toISOString().split('T')[0];
      const ctx = await buildCoachContext(user.id);
      const brief = await getMorningBrief(ctx.personality || 'stoic_mentor', ctx, mission, energy, distraction);
      await supabase.from('check_ins').upsert({
        user_id: user.id, date: today, type: 'morning',
        mission, energy, distraction: distraction || null,
        ai_summary: brief,
      }, { onConflict: 'user_id,date,type' });
      setMorningDone(true);
      setMorningAiSummary(brief);
      setResultType('morning');
      setResult(brief);
      setPhase('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      checkAndAwardMilestones(user.id).then((m) => { if (m) setMilestone(m); }).catch(() => {});
    } catch (err) {
      console.error('Failed to submit morning check-in:', err instanceof Error ? err.message : String(err));
      Alert.alert('Failed to submit', 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEveningSubmit = async () => {
    if (completed === null || !reason.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const today = new Date().toISOString().split('T')[0];
      const ctx = await buildCoachContext(user.id);
      const missionText = ctx.morningMission || 'Day challenge';
      const completedHabits = ctx.doneHabits.length;
      const totalHabits = ctx.doneHabits.length + ctx.missedHabits.length;
      const feedback = await getEveningFeedback(
        ctx.personality || 'stoic_mentor', ctx, missionText, completed, reason, completedHabits, totalHabits
      );
      await supabase.from('check_ins').upsert({
        user_id: user.id, date: today, type: 'evening', completed, reason,
        ai_summary: feedback,
      }, { onConflict: 'user_id,date,type' });
      recalculateStats(user.id).catch(() => {});
      setEveningAiSummary(feedback);
      setResultType('evening');
      setResult(feedback);
      setPhase('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to submit evening check-in:', err instanceof Error ? err.message : String(err));
      Alert.alert('Failed to submit', 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhase('pick');
    setMission(''); setEnergy(3); setDistraction('');
    setCompleted(null); setReason(''); setResult('');
    checkTodayStatus();
    loadHabits();
  };

  const openAddHabit = () => {
    setEditingHabitId(null);
    setHabitName('');
    setHabitEmoji('✅');
    setHabitError('');
    setShowAddHabitModal(true);
  };

  const openEditHabit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setHabitName(habit.name);
    setHabitEmoji(habit.emoji);
    setHabitError('');
    setShowAddHabitModal(true);
  };

  const saveHabit = async () => {
    if (!habitName.trim()) return;
    if (!editingHabitId && !profile?.isPro && habits.length >= 3) {
      setShowAddHabitModal(false);
      setPaywallVisible(true);
      return;
    }
    setHabitSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (editingHabitId) {
        await supabase.from('habits').update({ name: habitName.trim(), emoji: habitEmoji }).eq('id', editingHabitId);
        setHabits((prev) => prev.map((h) => h.id === editingHabitId ? { ...h, name: habitName.trim(), emoji: habitEmoji } : h));
      } else {
        const nextOrder = habits.length > 0 ? Math.max(...habits.map(h => h.sort_order)) + 1 : 0;
        const { data, error } = await supabase.from('habits').insert({
          user_id: user.id, name: habitName.trim(), emoji: habitEmoji, streak_days: 0, sort_order: nextOrder,
        }).select().single();
        if (error) throw error;
        setHabits((prev) => [...prev, { id: data.id, name: data.name, emoji: data.emoji, streak_days: 0, completedToday: false, effort_level: 2, sort_order: nextOrder, category: 'other' }]);
      }
      setShowAddHabitModal(false);
    } catch (err: any) {
      setHabitError(err.message || 'Failed to save habit');
    } finally {
      setHabitSaving(false);
    }
  };

  const deleteHabit = (habitId: string, name: string) => {
    Alert.alert(
      'Delete habit?',
      `"${name}" and all its history will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('habits').delete().eq('id', habitId);
            setHabits((prev) => prev.filter((h) => h.id !== habitId));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            drainOfflineQueue().catch(() => {});
          } catch {}
        }},
      ]
    );
  };

  const reorderHabit = async (habitId: string, direction: 'up' | 'down') => {
    const idx = habits.findIndex((h) => h.id === habitId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= habits.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = [...habits];
    const aOrder = updated[idx].sort_order;
    const bOrder = updated[swapIdx].sort_order;
    updated[idx] = { ...updated[idx], sort_order: bOrder };
    updated[swapIdx] = { ...updated[swapIdx], sort_order: aOrder };
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setHabits(updated);
    try {
      await Promise.all([
        supabase.from('habits').update({ sort_order: bOrder }).eq('id', habitId),
        supabase.from('habits').update({ sort_order: aOrder }).eq('id', updated[idx].id),
      ]);
    } catch {}
  };

  const doneCount = habits.filter((h) => h.completedToday).length;

  // Auto-claim recovery when all habits are done and grace is active
  useEffect(() => {
    if (!graceEligible || recoverySucceeded || habits.length === 0) return;
    if (doneCount < habits.length) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: claimed } = await supabase.rpc('claim_streak_recovery', { p_user_id: user.id });
        if (claimed) {
          setGraceEligible(false);
          setRecoverySucceeded(true);
        }
      } catch {}
    })();
  }, [doneCount, graceEligible, recoverySucceeded, habits.length]);

  const dynamicEyebrow = (() => {
    const h = new Date().getHours();
    const day = ['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date().getDay()];
    if (h < 12) return `${day} · MORNING`;
    if (h < 17) return `${day} · AFTERNOON`;
    return `${day} · EVENING`;
  })();

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{dynamicEyebrow}</Text>
        <Text style={styles.title}>Check In</Text>
        <Text style={styles.subtitle}>Two minutes of honesty. Twice a day.</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          phase === 'pick'
            ? <RefreshControl refreshing={habitsLoading} onRefresh={() => { checkTodayStatus(); loadHabits(); }} tintColor="#b8f058" />
            : undefined
        }
      >

        {phase === 'pick' && (
          <>
            {pendingSync > 0 && (
              <View style={styles.syncBanner}>
                <Text style={styles.syncBannerText}>{pendingSync} change{pendingSync !== 1 ? 's' : ''} pending sync</Text>
              </View>
            )}
            {/* 2-column check-in grid */}
            <View style={styles.pickGrid}>
              <TouchableOpacity
                testID="checkin-morning-card"
                style={[styles.pickCardNew, styles.pickCardMorning, morningDone && styles.pickCardNewDone]}
                onPress={() => {
                  if (morningDone && morningAiSummary) {
                    setResult(morningAiSummary); setResultType('morning'); setPhase('result'); return;
                  }
                  if (morningDone) { setMission(morningMissionText); setEnergy(morningEnergyStored); setDistraction(morningDistractionStored); }
                  setPhase('morning');
                }}
                activeOpacity={0.75}
              >
                <View style={styles.pickCardIcon}>
                  <View style={[styles.pickSunOrb, { backgroundColor: '#f0a06022', borderColor: '#f0a06055' }]}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#f0a060' }} />
                  </View>
                </View>
                <Text style={styles.pickCardTitleNew} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Morning</Text>
                <Text style={[styles.pickCardStatus, morningDone && styles.pickCardStatusDone]}>
                  {morningDone ? `DONE · ${morningDoneTime || '✓'}` : 'PENDING · BY 12PM'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pickCardNew, eveningDone && styles.pickCardNewDone, !morningDone && styles.pickCardNewLocked]}
                onPress={() => {
                  if (!morningDone) return;
                  if (eveningDone && eveningAiSummary) {
                    setResult(eveningAiSummary); setResultType('evening'); setPhase('result'); return;
                  }
                  if (eveningDone) { setCompleted(eveningCompletedStored); setReason(eveningReasonStored); }
                  setPhase('evening');
                }}
                activeOpacity={morningDone ? 0.75 : 1}
              >
                <View style={styles.pickCardIcon}>
                  <View style={[styles.pickSunOrb, { backgroundColor: '#7b6af022', borderColor: !morningDone ? '#1a1a1a' : '#7b6af055' }]}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: !morningDone ? '#2a2a2a' : '#7b6af0' }} />
                  </View>
                </View>
                <Text style={[styles.pickCardTitleNew, !morningDone && styles.textLocked]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Evening</Text>
                <Text style={[styles.pickCardStatus, eveningDone && styles.pickCardStatusDone]}>
                  {!morningDone ? '◇ LOCKED' : eveningDone ? `DONE · ${eveningDoneTime || '✓'}` : 'PENDING · BY 10PM'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Today's mission preview */}
            {morningMissionText ? (
              <View style={styles.missionPreview}>
                <View style={styles.missionPreviewHeader}>
                  <Text style={styles.missionPreviewEyebrow}>TODAY'S</Text>
                  <View style={styles.missionPreviewChip}>
                    <Text style={styles.missionPreviewChipText}>MISSION</Text>
                  </View>
                </View>
                <Text style={styles.missionPreviewText}>{morningMissionText}</Text>
              </View>
            ) : null}

            {/* Day complete banner */}
            {morningDone && eveningDone && (
              <View style={styles.dayCompleteRow}>
                <View style={styles.dayCompleteIconView} />
                <View>
                  <Text style={styles.dayCompleteTitle}>Day Complete</Text>
                  <Text style={styles.dayCompleteSub}>Both check-ins done. Your coach has the data.</Text>
                </View>
              </View>
            )}

            {/* Inline habit tracker */}
            <View style={styles.habitsSection}>
              <View style={styles.habitsSectionHeader}>
                <Text style={styles.habitsSectionLabel}>TODAY'S HABITS</Text>
                {!habitsLoading && habits.length > 0 && (
                  <Text style={styles.habitsDoneCount}>{doneCount}/{habits.length}</Text>
                )}
                <TouchableOpacity style={styles.addHabitBtn} onPress={openAddHabit}>
                  <Text style={styles.addHabitBtnText}>+ ADD</Text>
                </TouchableOpacity>
              </View>
              {habitsLoading && (
                <View style={{ gap: 8 }}>
                  <HabitRowSkeleton />
                  <HabitRowSkeleton />
                  <HabitRowSkeleton />
                </View>
              )}
              {/* Streak recovery banner */}
              {!habitsLoading && habits.length > 0 && (graceEligible || recoverySucceeded) && (
                <View style={[styles.graceCard, recoverySucceeded && { borderColor: accent + '60', backgroundColor: accent + '0d' }]}>
                  {recoverySucceeded ? (
                    <>
                      <Text style={[styles.graceTitle, { color: accent }]}>Streak Recovered</Text>
                      <Text style={styles.graceSub}>
                        You came back and finished strong. Yesterday filled in.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.graceTitle, { color: '#f5c840' }]}>Grace Day Active</Text>
                      <Text style={styles.graceSub}>
                        You missed yesterday{graceStreak > 0 ? ` (${graceStreak}-day streak at stake)` : ''}. Complete every habit today to save it.
                      </Text>
                      <View style={styles.graceProgress}>
                        <View style={[styles.graceProgressFill, {
                          width: habits.length > 0 ? `${Math.round((doneCount / habits.length) * 100)}%` : '0%' as any,
                          backgroundColor: doneCount === habits.length ? accent : '#f5c840',
                        }]} />
                      </View>
                      <Text style={styles.graceProgressLabel}>{doneCount}/{habits.length} habits done</Text>
                    </>
                  )}
                </View>
              )}

              {!habitsLoading && habits.length === 0 && (
                <TouchableOpacity style={styles.habitEmptyCard} onPress={openAddHabit}>
                  <Text style={styles.habitEmptyIcon}>+</Text>
                  <Text style={styles.habitEmptyText}>Add your first habit</Text>
                  <Text style={styles.habitEmptySub}>Daily actions that compound over time</Text>
                </TouchableOpacity>
              )}
              {habits.map((habit, hIdx) => (
                <Animated.View
                  key={habit.id}
                  style={{
                    opacity: habitItemAnims.current[hIdx] ?? 1,
                    transform: [{ translateY: habitItemAnims.current[hIdx]
                      ? habitItemAnims.current[hIdx].interpolate({ inputRange: [0, 1], outputRange: [10, 0] })
                      : 0 }],
                  }}
                >
                <Swipeable
                  key={`s-${habit.id}`}
                  ref={(ref) => { swipeableRefs.current[habit.id] = ref; }}
                  onSwipeableOpen={() => {
                    Object.entries(swipeableRefs.current).forEach(([id, ref]) => {
                      if (id !== habit.id) ref?.close();
                    });
                  }}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.swipeDelete}
                      onPress={() => {
                        swipeableRefs.current[habit.id]?.close();
                        deleteHabit(habit.id, habit.name);
                      }}
                    >
                      <Text style={styles.swipeDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                  friction={2}
                  overshootRight={false}
                >
                  <TouchableOpacity
                    style={[styles.habitRow, habit.completedToday && styles.habitRowDone, habit.completedToday && { borderLeftWidth: 3, borderLeftColor: CAT_COLORS[habit.category] ?? '#b8f058' }]}
                    onPress={() => toggleHabit(habit.id, habit.completedToday)}
                    onLongPress={() => Alert.alert(habit.name, '', [
                      { text: 'View History', onPress: () => setHistoryHabit({ id: habit.id, name: habit.name, emoji: habit.emoji }) },
                      ...(habit.completedToday ? [{
                        text: `Effort: ${ ['', 'Low', 'Med', 'High'][habit.effort_level] ?? 'Med' } — change`,
                        onPress: () => Alert.alert('Set Effort', 'How hard did you push?', [
                          { text: 'Low', onPress: () => setHabitEffort(habit.id, 1) },
                          { text: 'Med', onPress: () => setHabitEffort(habit.id, 2) },
                          { text: 'High', onPress: () => setHabitEffort(habit.id, 3) },
                          { text: 'Cancel', style: 'cancel' },
                        ]),
                      }] : []),
                      { text: 'Edit', onPress: () => openEditHabit(habit) },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit.id, habit.name) },
                      { text: 'Cancel', style: 'cancel' },
                    ])}
                    activeOpacity={0.7}
                    delayLongPress={500}
                  >
                    <View style={styles.habitEmojiWrap}>
                      <Text style={styles.habitRowEmoji}>{habit.emoji}</Text>
                      <View style={[styles.habitCatDot, { backgroundColor: CAT_COLORS[habit.category] ?? '#888' }]} />
                    </View>
                    <Text style={[styles.habitRowName, habit.completedToday && styles.habitRowNameDone]}>
                      {habit.name}
                    </Text>
                    <StreakBadge days={habit.streak_days} />
                    {habits.length > 1 && (
                      <View style={styles.habitReorder}>
                        <TouchableOpacity
                          onPress={() => reorderHabit(habit.id, 'up')}
                          disabled={hIdx === 0}
                          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                        >
                          <Text style={[styles.habitReorderBtn, hIdx === 0 && styles.habitReorderBtnDisabled]}>▲</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => reorderHabit(habit.id, 'down')}
                          disabled={hIdx === habits.length - 1}
                          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                        >
                          <Text style={[styles.habitReorderBtn, hIdx === habits.length - 1 && styles.habitReorderBtnDisabled]}>▼</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {habit.completedToday && habit.effort_level !== 2 && (
                      <View style={[styles.effortPill, { backgroundColor: habit.effort_level === 3 ? '#f0606018' : '#55555518', borderColor: habit.effort_level === 3 ? '#f0606060' : '#55555560' }]}>
                        <Text style={[styles.effortPillText, { color: habit.effort_level === 3 ? '#f06060' : '#888' }]}>
                          {habit.effort_level === 3 ? 'HIGH' : 'LOW'}
                        </Text>
                      </View>
                    )}
                    <Animated.View style={[styles.habitCheck, habit.completedToday && styles.habitCheckDone, { transform: [{ scale: getCheckAnim(habit.id) }] }]}>
                      {habit.completedToday && <Text style={styles.habitCheckMark}>✓</Text>}
                    </Animated.View>
                  </TouchableOpacity>
                </Swipeable>
                </Animated.View>
              ))}
            </View>
          </>
        )}

        {phase === 'morning' && (
          <View style={styles.form}>
            <Text style={styles.formHeading}>{morningDone ? 'Update your mission.' : getCheckinCopy('morning').heading}</Text>
            <TextInput
              testID="checkin-mission-input"
              style={[styles.input, styles.inputMulti]}
              placeholder={getCheckinCopy('morning').placeholder}
              placeholderTextColor="#555"
              value={mission}
              onChangeText={setMission}
              editable={!loading}
              multiline
            />
            <Text style={styles.fieldLabel}>Energy level</Text>
            <View style={styles.energyWrap}>
              <Text style={styles.energyAxisLabel}>Low</Text>
              <View style={styles.energyRow}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <TouchableOpacity
                    key={level}
                    testID={`checkin-energy-${level}`}
                    style={[styles.energyDot, energy === level && styles.energyDotActive]}
                    onPress={() => setEnergy(level)}
                    disabled={loading}
                  >
                    <Text style={[styles.energyDotText, energy === level && styles.energyDotTextActive]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.energyAxisLabel}>High</Text>
            </View>
            <Text style={styles.fieldLabel}>What might get in your way?</Text>
            <TextInput
              testID="checkin-distraction-input"
              style={styles.input}
              placeholder="Phone? Meetings? Be specific."
              placeholderTextColor="#555"
              value={distraction}
              onChangeText={setDistraction}
              editable={!loading}
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
            />
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: accent }, (loading || !mission.trim()) && styles.ctaDisabled]}
              onPress={handleMorningSubmit}
              disabled={loading || !mission.trim()}
            >
              {loading ? <ActivityIndicator color={accentText} /> : <Text style={[styles.ctaText, { color: accentText }]}>{morningDone ? 'Update →' : 'Lock it in →'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity testID="checkin-back-btn" style={styles.backBtn} onPress={handleReset}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'evening' && (
          <View style={styles.form}>
            {morningMissionText ? (
              <View style={styles.missionReminder}>
                <Text style={styles.missionReminderLabel}>YOUR MISSION TODAY</Text>
                <Text style={styles.missionReminderText}>"{morningMissionText}"</Text>
              </View>
            ) : null}
            <Text style={styles.formHeading}>{eveningDone ? 'Review your debrief.' : getCheckinCopy('evening').heading}</Text>
            <View style={styles.choiceRow}>
              <TouchableOpacity
                style={[styles.choiceBtn, completed === true && styles.choiceBtnYes]}
                onPress={() => setCompleted(true)}
                disabled={loading}
              >
                <Text style={[styles.choiceBtnText, completed === true && styles.choiceBtnTextActive]}>✓ Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choiceBtn, completed === false && styles.choiceBtnNo]}
                onPress={() => setCompleted(false)}
                disabled={loading}
              >
                <Text style={[styles.choiceBtnText, completed === false && styles.choiceBtnTextActive]}>✗ No</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>
              {completed === null ? 'Reflect on your day' : completed ? 'What made it happen?' : 'What got in the way?'}
            </Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder={getCheckinCopy('evening').placeholder}
              placeholderTextColor="#555"
              value={reason}
              onChangeText={setReason}
              editable={!loading}
              multiline
            />
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: accent }, (loading || completed === null || !reason.trim()) && styles.ctaDisabled]}
              onPress={handleEveningSubmit}
              disabled={loading || completed === null || !reason.trim()}
            >
              {loading ? <ActivityIndicator color={accentText} /> : <Text style={[styles.ctaText, { color: accentText }]}>{eveningDone ? 'Update →' : 'Get feedback →'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity testID="checkin-back-btn" style={styles.backBtn} onPress={handleReset}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'result' && (
          <View style={styles.result}>
            <Text style={styles.resultLabel}>
              {resultType === 'morning' ? 'MORNING BRIEF' : 'EVENING FEEDBACK'}
            </Text>
            <View style={styles.resultCard}>
              <MarkdownText style={styles.resultText}>{result}</MarkdownText>
            </View>
            <TouchableOpacity style={[styles.cta, { backgroundColor: accent }]} onPress={handleReset}>
              <Text style={[styles.ctaText, { color: accentText }]}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
      </KeyboardAvoidingView>

      <MilestoneModal milestone={milestone} onClose={() => setMilestone(null)} />
      <PaywallModal visible={paywallVisible} trigger="habits" onClose={() => setPaywallVisible(false)} />
      <HabitHistoryModal
        habitId={historyHabit?.id ?? null}
        habitName={historyHabit?.name ?? ''}
        habitEmoji={historyHabit?.emoji ?? ''}
        visible={!!historyHabit}
        onClose={() => setHistoryHabit(null)}
      />

      {/* Add Habit Modal */}
      <Modal
        visible={showAddHabitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddHabitModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowAddHabitModal(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingHabitId ? 'Edit Habit' : 'New Habit'}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
              {habitError ? <Text style={styles.habitErrorText}>{habitError}</Text> : null}
              <TextInput
                style={styles.habitInput}
                placeholder="Habit name..."
                placeholderTextColor="#555"
                value={habitName}
                onChangeText={setHabitName}
                autoFocus
                maxLength={60}
              />
              <Text style={styles.emojiPickerLabel}>QUICK ADD</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {HABIT_TEMPLATES.map((t) => (
                    <TouchableOpacity
                      key={t.name}
                      style={styles.templateChip}
                      onPress={() => { setHabitName(t.name); setHabitEmoji(t.emoji); }}
                    >
                      <Text style={styles.templateChipEmoji}>{t.emoji}</Text>
                      <Text style={styles.templateChipText}>{t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.emojiPickerLabel}>PICK AN EMOJI</Text>
              <View style={styles.emojiGrid}>
                {HABIT_EMOJIS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiCell, habitEmoji === e && styles.emojiCellActive]}
                    onPress={() => setHabitEmoji(e)}
                  >
                    <Text style={styles.emojiCellText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.habitPreviewRow}>
                <Text style={styles.habitPreviewEmoji}>{habitEmoji}</Text>
                <Text style={styles.habitPreviewName} numberOfLines={1}>
                  {habitName.trim() || 'Your habit'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.modalCta, { backgroundColor: habitName.trim() ? '#b8f058' : '#1e1e1e', opacity: habitSaving ? 0.6 : 1 }]}
                  onPress={saveHabit}
                  disabled={!habitName.trim() || habitSaving}
                >
                  {habitSaving
                    ? <ActivityIndicator color="#0a0a0a" size={16} />
                    : <Text style={[styles.modalCtaText, { color: habitName.trim() ? '#0a0a0a' : '#444' }]}>{editingHabitId ? 'Save Changes' : 'Add Habit'}</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalCta, { flex: 0.6, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' }]}
                  onPress={() => setShowAddHabitModal(false)}
                >
                  <Text style={[styles.modalCtaText, { color: '#aaa' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
              {editingHabitId && (
                <TouchableOpacity
                  style={styles.modalDeleteBtn}
                  onPress={() => {
                    const h = habits.find(x => x.id === editingHabitId);
                    setShowAddHabitModal(false);
                    if (h) deleteHabit(h.id, h.name);
                  }}
                >
                  <Text style={styles.modalDeleteText}>Delete Habit</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingHorizontal: scale(20), paddingTop: scale(20), paddingBottom: scale(16),
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  eyebrow: { fontSize: fscale(11), letterSpacing: 1.5, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: fscale(28), fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', marginBottom: 2 },
  subtitle: { fontSize: fscale(13), color: '#aaa', fontFamily: 'DMMono_400Regular' },
  scroll: { padding: scale(20), paddingBottom: scale(40), gap: 20 },

  syncBanner: {
    backgroundColor: '#1a1400', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#f5c84040',
  },
  syncBannerText: { fontSize: 11, color: '#f5c840', fontFamily: 'DMMono_400Regular', textAlign: 'center' },
  pickGrid: { flexDirection: 'row', gap: 12 },
  pickCardNew: {
    flex: 1, backgroundColor: '#111', borderRadius: 16, padding: scale(20),
    borderWidth: 1, borderColor: '#252525', minHeight: scale(180),
    justifyContent: 'space-between',
  },
  pickCardMorning: { flex: 1.5 },
  pickCardNewDone: { borderColor: '#b8f058', backgroundColor: '#0a130a' },
  pickCardNewLocked: { backgroundColor: '#0d0d0d', borderColor: '#1a1a1a', opacity: 0.6 },
  pickCardIcon: { marginBottom: 8 },
  pickSunOrb: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pickCardTitleNew: {
    fontSize: fscale(22), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', marginBottom: 6,
  },
  pickCardStatus: {
    fontSize: fscale(10), color: '#444', fontFamily: 'DMMono_400Regular', letterSpacing: 0.5,
  },
  pickCardStatusDone: { color: '#b8f058' },

  missionPreview: {
    backgroundColor: '#111', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: '#252525',
  },
  missionPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  missionPreviewEyebrow: { fontSize: fscale(10), color: '#555', fontFamily: 'DMMono_400Regular', letterSpacing: 2 },
  missionPreviewChip: {
    backgroundColor: '#1a2a0a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#b8f05850',
  },
  missionPreviewChipText: { fontSize: fscale(9), color: '#b8f058', fontFamily: 'DMMono_400Regular', letterSpacing: 1.5 },
  missionPreviewText: { fontSize: fscale(15), color: '#e0e0e0', lineHeight: fscale(22) },

  dayCompleteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0d1a07', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#b8f05840',
  },
  dayCompleteIconView: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#b8f058' },
  dayCompleteTitle: { fontSize: 14, fontWeight: '700', color: '#b8f058' },
  dayCompleteSub: { fontSize: 12, color: '#6a9030', marginTop: 2 },
  textLocked: { color: '#333' },
  lockedHint: { fontSize: 11, color: '#f5c840', fontStyle: 'italic' },

  // Inline habit tracker
  habitsSection: { gap: 8 },
  habitsSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  habitsSectionLabel: {
    flex: 1, fontSize: fscale(11), letterSpacing: 1.5, color: '#999', fontFamily: 'DMMono_400Regular',
  },
  habitsDoneCount: { fontSize: fscale(12), color: '#b8f058', fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  addHabitBtn: {
    borderWidth: 1, borderColor: '#b8f05860', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  addHabitBtnText: { fontSize: fscale(9), color: '#b8f058', fontFamily: 'DMMono_400Regular', letterSpacing: 1, fontWeight: '700' },
  graceCard: {
    backgroundColor: '#1a1500', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#f5c84040', marginBottom: 10, gap: 6,
  },
  graceTitle: { fontSize: fscale(12), fontWeight: '700', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
  graceSub: { fontSize: fscale(12), color: '#aaa', lineHeight: 18 },
  graceProgress: {
    height: 3, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden', marginTop: 4,
  },
  graceProgressFill: { height: 3, borderRadius: 2 },
  graceProgressLabel: { fontSize: fscale(10), color: '#666', fontFamily: 'DMMono_400Regular' },

  habitEmptyCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#252525', borderStyle: 'dashed',
    alignItems: 'center', gap: 6,
  },
  habitEmptyIcon: { fontSize: 28, color: '#333' },
  habitEmptyText: { fontSize: fscale(15), fontWeight: '700', color: '#999' },
  habitEmptySub: { fontSize: fscale(12), color: '#2a2a2a', textAlign: 'center' },
  habitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#111', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  habitRowDone: { borderColor: '#b8f05870', backgroundColor: '#0f2010' },
  habitRowEmoji: { fontSize: fscale(20) },
  habitRowName: { flex: 1, fontSize: fscale(14), fontWeight: '600', color: '#ccc' },
  habitRowNameDone: { color: '#b8f058' },
  habitRowStreak: { fontSize: 11, color: '#aaa', fontFamily: 'DMMono_400Regular' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1 },
  streakKing: { backgroundColor: '#f5c84022', borderColor: '#f5c84060' },
  streakHot:  { backgroundColor: '#f0a06022', borderColor: '#f0a06060' },
  streakNew:  { backgroundColor: '#b8f05822', borderColor: '#b8f05860' },
  streakBar: { width: 3, height: 12, borderRadius: 2 },
  streakDot: { width: 6, height: 6, borderRadius: 3 },
  streakDays: { fontSize: 10, fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  templateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1a1a1a', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  templateChipEmoji: { fontSize: 15 },
  templateChipText: { fontSize: 11, color: '#aaa', fontFamily: 'DMMono_400Regular' },
  habitEmojiWrap: { position: 'relative', width: 28, alignItems: 'center', justifyContent: 'center' },
  habitCatDot: { position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: '#0a0a0a' },
  habitReorder: { flexDirection: 'column', alignItems: 'center', marginRight: 6, gap: 2 },
  habitReorderBtn: { fontSize: 10, color: '#aaa', paddingHorizontal: 2 },
  habitReorderBtnDisabled: { color: '#2a2a2a' },
  habitCheck: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: '#444',
    justifyContent: 'center', alignItems: 'center',
  },
  habitCheckDone: { backgroundColor: '#b8f058', borderColor: '#b8f058' },
  habitCheckMark: { fontSize: 13, color: '#0a0a0a', fontWeight: '700' },
  effortPill: {
    borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, marginRight: 2,
  },
  effortPillText: { fontSize: 9, fontFamily: 'DMMono_400Regular', fontWeight: '700', letterSpacing: 0.5 },

  missionReminder: {
    backgroundColor: '#0a150a', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#b8f05840',
  },
  missionReminderLabel: { fontSize: 11, letterSpacing: 1.5, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  missionReminderText: { fontSize: 14, color: '#ccc', fontStyle: 'italic', lineHeight: 20 },

  form: { gap: 16 },
  formHeading: { fontSize: fscale(22), fontWeight: '700', color: '#fff', lineHeight: fscale(30) },
  fieldLabel: { fontSize: fscale(11), letterSpacing: 1.5, color: '#999', fontFamily: 'DMMono_400Regular' },
  input: {
    backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#333',
    padding: scale(14), color: '#fff', fontSize: fscale(15),
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },

  energyWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  energyAxisLabel: { fontSize: 9, color: '#666', fontFamily: 'DMMono_400Regular', letterSpacing: 1, width: 28, textAlign: 'center' },
  energyRow: { flex: 1, flexDirection: 'row', gap: 6 },
  energyDot: {
    flex: 1, height: 48, borderRadius: 8,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  energyDotActive: { backgroundColor: '#b8f058', borderColor: '#b8f058' },
  energyDotText: { fontSize: fscale(16), fontWeight: '700', color: '#aaa' },
  energyDotTextActive: { color: '#0a0a0a' },

  choiceRow: { flexDirection: 'row', gap: 12 },
  choiceBtn: {
    flex: 1, height: 56, borderRadius: 10,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  choiceBtnYes: { backgroundColor: '#b8f05820', borderColor: '#b8f058' },
  choiceBtnNo: { backgroundColor: '#f0606020', borderColor: '#f06060' },
  choiceBtnText: { fontSize: fscale(16), fontWeight: '700', color: '#999' },
  choiceBtnTextActive: { color: '#fff' },

  cta: {
    backgroundColor: '#b8f058', borderRadius: 12, paddingVertical: 18,
    alignItems: 'center', marginTop: 4,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: fscale(16), fontWeight: '700', color: '#0a0a0a' },

  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backText: { fontSize: 13, color: '#aaa' },

  result: { gap: 16 },
  resultLabel: { fontSize: fscale(11), letterSpacing: 1.5, color: '#b8f058', fontFamily: 'DMMono_400Regular' },
  resultCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#252525', borderLeftWidth: 3, borderLeftColor: '#b8f058',
  },
  resultText: { fontSize: fscale(15), color: '#ddd', lineHeight: fscale(26) },

  // Add habit modal
  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingTop: 12, paddingBottom: 40, maxHeight: '90%',
  },
  modalHandle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: fscale(20), fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', marginBottom: 4 },
  habitErrorText: { color: '#f06060', fontSize: 12, backgroundColor: '#f0606015', borderRadius: 6, padding: 10 },
  habitInput: {
    backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#333',
    padding: scale(14), color: '#fff', fontSize: fscale(16),
  },
  emojiPickerLabel: { fontSize: fscale(11), letterSpacing: 1.5, color: '#999', fontFamily: 'DMMono_400Regular' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiCell: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    justifyContent: 'center', alignItems: 'center',
  },
  emojiCellActive: { backgroundColor: '#b8f05820', borderColor: '#b8f058' },
  emojiCellText: { fontSize: fscale(22) },
  habitPreviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0c180a', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#b8f05830',
  },
  habitPreviewEmoji: { fontSize: fscale(24) },
  habitPreviewName: { flex: 1, fontSize: fscale(15), fontWeight: '600', color: '#b8f058' },
  modalCta: { flex: 1, borderRadius: 10, paddingVertical: scale(14), alignItems: 'center' },
  modalCtaText: { fontSize: fscale(15), fontWeight: '700' },
  modalDeleteBtn: {
    marginTop: 12, paddingVertical: 14, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#1e1e1e',
  },
  modalDeleteText: { fontSize: fscale(14), color: '#f06060', fontWeight: '600' },

  swipeDelete: {
    backgroundColor: '#f06060', justifyContent: 'center', alignItems: 'center',
    width: 88, borderRadius: 10, marginLeft: 8,
  },
  swipeDeleteText: { fontSize: fscale(13), fontWeight: '700', color: '#fff' },
});
