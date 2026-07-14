import React, { useState, useEffect, useRef } from 'react';
import { fscale, scale } from '../utils/scale';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { getGoalAdvice, getGoalMilestoneComment } from '../services/ai';
import { buildCoachContext } from '../services/context';
import MilestoneModal from '../components/MilestoneModal';
import { checkGoalMilestone, type Milestone } from '../services/milestones';
import ConfettiOverlay from '../components/ConfettiOverlay';
import { GoalCardSkeleton } from '../components/Skeleton';
import PaywallModal from '../components/PaywallModal';
import { useUser } from '../context/UserContext';
import { getCoachColor, getContrastText } from '../utils/coachColors';
import { enqueueAction } from '../services/offline';
import { drainOfflineQueue } from '../services/syncQueue';

interface Goal {
  id: string;
  name: string;
  category: string;
  progress: number;
  target: string;
  deadline: string;
  created_at: string;
  last_milestone: number;
}

const CATEGORIES = [
  { id: 'health',   label: 'HEALTH',   color: '#b8f058' },
  { id: 'business', label: 'BUSINESS', color: '#40f5c8' },
  { id: 'mindset',  label: 'MINDSET',  color: '#7b6af0' },
  { id: 'fitness',  label: 'FITNESS',  color: '#f5c840' },
  { id: 'learning', label: 'LEARNING', color: '#f0a060' },
  { id: 'other',    label: 'OTHER',    color: '#888'    },
];

function getCategoryColor(cat: string): string {
  return CATEGORIES.find((c) => c.id === cat)?.color ?? '#888';
}

function getCategoryLabel(cat: string): string {
  return CATEGORIES.find((c) => c.id === cat)?.label ?? 'OTHER';
}

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / 86400000);
}

function formatDeadline(dateStr: string): string {
  if (!dateStr) return '';
  const deadline = new Date(dateStr + 'T12:00:00');
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft === 0) return 'due today';
  if (daysLeft === 1) return '1d left';
  return `${daysLeft}d left`;
}

export default function GoalsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { profile } = useUser();
  const accent = getCoachColor(profile?.personality);
  const accentText = getContrastText(accent);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCategory, setNewCategory] = useState('health');
  const [newDeadlineDays, setNewDeadlineDays] = useState(90);
  const [adviceId, setAdviceId] = useState<string | null>(null);
  const [adviceText, setAdviceText] = useState<Record<string, string>>({});
  const [adviceLoading, setAdviceLoading] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [addError, setAddError] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editCategory, setEditCategory] = useState('health');
  const [editDeadlineDays, setEditDeadlineDays] = useState(30);
  const [typingProgressId, setTypingProgressId] = useState<string | null>(null);
  const [typingProgressValue, setTypingProgressValue] = useState('');
  const [milestoneComment, setMilestoneComment] = useState<{ goalId: string; pct: number; text: string } | null>(null);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [showConfetti, setShowConfetti] = useState(false);
  const progressAnims = useRef<Record<string, Animated.Value>>({});
  const barWidths = useRef<Record<string, number>>({});
  const cardAnimsRef = useRef<Animated.Value[]>([]);
  const emptyPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(emptyPulse, { toValue: 0.3, duration: 1600, useNativeDriver: true }),
        Animated.timing(emptyPulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, [emptyPulse]);

  useEffect(() => {
    loadGoals();
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadGoals);
    return unsub;
  }, [navigation]);


  const loadGoals = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      rows.forEach((g: any) => {
        const prog = g.progress || 0;
        if (!progressAnims.current[g.id]) {
          progressAnims.current[g.id] = new Animated.Value(0);
        }
        Animated.spring(progressAnims.current[g.id], {
          toValue: prog,
          useNativeDriver: false,
          tension: 60,
          friction: 10,
        }).start();
      });
      const mapped = rows.map((g: any) => ({
        id: g.id,
        name: g.name,
        category: g.category || 'other',
        progress: g.progress || 0,
        target: g.target || '',
        deadline: g.deadline || '',
        created_at: g.created_at,
        last_milestone: g.last_milestone || 0,
      }));
      const newAnims = mapped.map(() => new Animated.Value(0));
      cardAnimsRef.current = newAnims;
      setGoals(mapped);
      Animated.stagger(60, newAnims.map(anim =>
        Animated.spring(anim, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true })
      )).start();
    } catch (err) {
      console.error('Failed to load goals:', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const addGoal = async () => {
    if (!newName.trim()) return;
    if (!profile?.isPro && goals.length >= 2) {
      setShowAddForm(false);
      setPaywallVisible(true);
      return;
    }
    setAddError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + newDeadlineDays);
      const insertPayload: Record<string, any> = {
        user_id: user.id,
        name: newName.trim(),
        target: newTarget.trim() || newName.trim(),
        progress: 0,
        deadline: deadline.toISOString().split('T')[0],
      };
      const { error: insertError } = await supabase.from('goals').insert({ ...insertPayload, category: newCategory });
      if (insertError) throw insertError;
      setNewName(''); setNewTarget(''); setNewCategory('health'); setNewDeadlineDays(90);
      setShowAddForm(false);
      await loadGoals();
    } catch (err: any) {
      console.error('Failed to add goal:', err instanceof Error ? err.message : String(err));
      setAddError(err.message || 'Failed to create goal');
    }
  };

  const triggerMilestoneComment = async (goal: Goal, newProgress: number, user: any) => {
    const milestones = [25, 50, 75, 100];
    const hit = milestones.find((m) => newProgress >= m && goal.last_milestone < m);
    if (!hit) return;
    await supabase.from('goals').update({ last_milestone: hit }).eq('id', goal.id).eq('user_id', user.id);
    setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, last_milestone: hit } : g));
    Notifications.scheduleNotificationAsync({
      content: {
        title: hit === 100 ? 'Goal Complete' : `${hit}% Reached`,
        body: `"${goal.name}" — ${hit === 100 ? 'mission accomplished!' : `${hit}% done. Keep the momentum.`}`,
        data: { url: 'monkai://goals' },
      },
      trigger: null,
    }).catch(() => {});
    try {
      const ctx = await buildCoachContext(user.id);
      const text = await getGoalMilestoneComment(ctx.personality || 'stoic_mentor', ctx, goal.name, hit, goal.target);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMilestoneComment({ goalId: goal.id, pct: hit, text });
    } catch {}
  };

  const adjustProgress = async (goal: Goal, delta: number) => {
    const next = Math.max(0, Math.min(100, goal.progress + delta));
    setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, progress: next } : g));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('goals').update({ progress: next }).eq('id', goal.id).eq('user_id', user.id);
      drainOfflineQueue().catch(() => {});
      triggerMilestoneComment(goal, next, user).catch(() => {});
      if (next === 100 && goal.progress < 100) {
        setShowConfetti(true);
        Alert.alert(
          'Goal Complete',
          `"${goal.name}" — done.`,
          [
            {
              text: 'Archive it',
              style: 'destructive',
              onPress: async () => {
                try {
                  const { data: { user: u } } = await supabase.auth.getUser();
                  if (u) await supabase.from('goals').delete().eq('id', goal.id).eq('user_id', u.id);
                  setGoals((prev) => prev.filter((g) => g.id !== goal.id));
                } catch {}
              },
            },
            { text: 'Keep tracking', style: 'default' },
          ]
        );
      }
      if (progressAnims.current[goal.id]) {
        Animated.spring(progressAnims.current[goal.id], {
          toValue: next,
          useNativeDriver: false,
          tension: 60,
          friction: 10,
        }).start();
      }
    } catch {
      // Optimistic UI already applied — queue for sync on reconnect
      await enqueueAction({ type: 'goal_update', payload: { goalId: goal.id, progress: next } }).catch(() => {});
    }
  };

  const deleteGoal = (goalId: string, goalName: string) => {
    Alert.alert(
      'Delete Goal',
      `Remove "${goalName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              await supabase.from('goals').delete().eq('id', goalId).eq('user_id', user.id);
              setGoals((prev) => prev.filter((g) => g.id !== goalId));
            } catch (err) {
              console.error('Failed to delete goal:', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ]
    );
  };

  const startEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setEditName(goal.name);
    setEditTarget(goal.target);
    setEditCategory(goal.category || 'health');
    const today = new Date().toISOString().split('T')[0];
    const deadlineDate = new Date(goal.deadline);
    const todayDate = new Date(today);
    const daysLeft = Math.max(1, Math.round((deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)));
    setEditDeadlineDays(daysLeft);
  };

  const saveGoalEdit = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName || !editingGoalId) { setEditingGoalId(null); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const newDeadline = new Date();
      newDeadline.setDate(newDeadline.getDate() + editDeadlineDays);
      const deadlineStr = newDeadline.toISOString().split('T')[0];
      await supabase.from('goals').update({
        name: trimmedName,
        target: editTarget.trim() || trimmedName,
        category: editCategory,
        deadline: deadlineStr,
      }).eq('id', editingGoalId).eq('user_id', user.id);
      setGoals((prev) => prev.map((g) =>
        g.id === editingGoalId
          ? { ...g, name: trimmedName, target: editTarget.trim() || trimmedName, category: editCategory, deadline: deadlineStr }
          : g
      ));
    } catch (err) {
      console.error('Failed to save goal edit:', err instanceof Error ? err.message : String(err));
    } finally {
      setEditingGoalId(null);
    }
  };

  const getAdvice = async (goal: Goal) => {
    if (adviceId === goal.id) { setAdviceId(null); return; }
    setAdviceId(goal.id);
    if (adviceText[goal.id]) return;
    setAdviceLoading(goal.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ctx = await buildCoachContext(user.id);
      const text = await getGoalAdvice(ctx.personality || 'stoic_mentor', ctx, goal.name, goal.progress, goal.target, goal.deadline);
      setAdviceText((prev) => ({ ...prev, [goal.id]: text }));
    } catch {
      setAdviceText((prev) => ({ ...prev, [goal.id]: 'Could not load advice. Try again.' }));
    } finally {
      setAdviceLoading(null);
    }
  };

  const commitProgress = async (goal: Goal) => {
    const parsed = parseInt(typingProgressValue, 10);
    const next = isNaN(parsed) ? goal.progress : Math.max(0, Math.min(100, parsed));
    setTypingProgressId(null);
    if (next === goal.progress) return;
    setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, progress: next } : g));
    if (progressAnims.current[goal.id]) {
      Animated.spring(progressAnims.current[goal.id], { toValue: next, useNativeDriver: false, tension: 60, friction: 10 }).start();
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('goals').update({ progress: next }).eq('id', goal.id).eq('user_id', user.id);
      drainOfflineQueue().catch(() => {});
      triggerMilestoneComment(goal, next, user).catch(() => {});
      if (next === 100 && goal.progress < 100) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowConfetti(true);
        checkGoalMilestone(user.id).then((m) => { if (m) setMilestone(m); }).catch(() => {});
        Alert.alert('Goal Complete', `"${goal.name}" — done.`, [
          { text: 'Archive it', style: 'destructive', onPress: async () => {
            try {
              const { data: { user: u } } = await supabase.auth.getUser();
              if (u) await supabase.from('goals').delete().eq('id', goal.id).eq('user_id', u.id);
              setGoals((prev) => prev.filter((g) => g.id !== goal.id));
            } catch {}
          }},
          { text: 'Keep tracking', style: 'default' },
        ]);
      }
    } catch {
      await enqueueAction({ type: 'goal_update', payload: { goalId: goal.id, progress: next } }).catch(() => {});
    }
  };

  const handleBarTap = (goal: Goal, x: number) => {
    const width = barWidths.current[goal.id];
    if (!width) return;
    const pct = Math.round(Math.max(0, Math.min(100, (x / width) * 100)) / 5) * 5;
    adjustProgress(goal, pct - goal.progress);
  };

  const isStalled = (g: Goal) => g.progress < 25 && daysSince(g.created_at) > 14;

  const activeCats = ['all', ...CATEGORIES.map((c) => c.id).filter((id) => goals.some((g) => g.category === id))];
  const filteredGoals = filterCat === 'all' ? goals : goals.filter((g) => g.category === filterCat);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.eyebrow}>YOUR TARGETS</Text>
            <Text style={styles.title}>Goals</Text>
            {goals.length > 0 && (() => {
              const active = goals.filter((g) => g.progress < 100).length;
              const done = goals.length - active;
              return (
                <Text style={styles.subtitle}>
                  {active > 0 ? `${active} active` : 'all done'}{done > 0 ? ` · ${done} complete` : ''} · coach watching
                </Text>
              );
            })()}
          </View>
          <TouchableOpacity testID="goals-add-btn" style={styles.addBtn} onPress={() => setShowAddForm(true)}>
            <Text style={styles.addBtnText}>+ Goal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {goals.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {activeCats.map((catId) => {
            const cat = CATEGORIES.find((c) => c.id === catId);
            const label = catId === 'all' ? 'ALL' : (cat?.label ?? catId.toUpperCase());
            const color = catId === 'all' ? '#b8f058' : (cat?.color ?? '#888');
            const count = catId === 'all' ? goals.length : goals.filter((g) => g.category === catId).length;
            const active = filterCat === catId;
            return (
              <TouchableOpacity
                key={catId}
                style={[styles.filterChip, active && { backgroundColor: color + '22', borderColor: color }]}
                onPress={() => setFilterCat(catId)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, active && { color }]}>{label}</Text>
                <Text style={[styles.filterChipCount, active && { color }]}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadGoals} tintColor="#b8f058" />}
      >
        {loading && (
          <View style={{ gap: 14, paddingTop: 4 }}>
            <GoalCardSkeleton />
            <GoalCardSkeleton />
            <GoalCardSkeleton />
          </View>
        )}

        {!loading && goals.length === 0 && (
          <View style={styles.empty}>
            <Animated.View style={[styles.emptyIconView, { opacity: emptyPulse }]}>
              <View style={styles.emptyIconInner} />
            </Animated.View>
            <Text style={styles.emptyTitle}>No targets yet.</Text>
            <Text style={styles.emptySub}>What are you chasing?{'\n'}Set a goal. Make it real.</Text>
          </View>
        )}

        {!loading && goals.length > 0 && filteredGoals.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIconView}>
              <View style={[styles.emptyIconInner, { backgroundColor: '#555' }]} />
            </View>
            <Text style={styles.emptyTitle}>No {filterCat} goals.</Text>
            <Text style={styles.emptySub}>Try a different category or add one.</Text>
          </View>
        )}

        {filteredGoals.map((goal, goalIndex) => {
          const catColor = getCategoryColor(goal.category);
          const stalled = isStalled(goal);
          const days = daysSince(goal.created_at);
          const showAdvice = adviceId === goal.id;
          const isComplete = goal.progress >= 100;
          const cardAnim = cardAnimsRef.current[goalIndex] ?? new Animated.Value(1);

          return (
            <Animated.View key={goal.id} style={{ opacity: cardAnim, transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
            <View style={[styles.goalCard, stalled && styles.goalCardStalled, isComplete && styles.goalCardComplete]}>
              {/* Header row */}
              <View style={styles.goalTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.catBadge, { backgroundColor: catColor + '22', borderColor: catColor + '55' }]}>
                    <Text style={[styles.catLabel, { color: catColor }]}>{getCategoryLabel(goal.category)}</Text>
                  </View>
                  {isComplete && (
                    <View style={styles.completeBadge}>
                      <Text style={styles.completeBadgeText}>✓ DONE</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => deleteGoal(goal.id, goal.name)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Text style={styles.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {editingGoalId === goal.id ? (
                <View style={styles.editForm}>
                  <TextInput
                    style={styles.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Goal name..."
                    placeholderTextColor="#555"
                    autoFocus
                    returnKeyType="next"
                  />
                  <TextInput
                    style={styles.editInput}
                    value={editTarget}
                    onChangeText={setEditTarget}
                    placeholder="Target..."
                    placeholderTextColor="#555"
                    returnKeyType="done"
                    onSubmitEditing={saveGoalEdit}
                  />
                  {/* Category picker */}
                  <View style={styles.editCatRow}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.editCatChip, editCategory === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '22' }]}
                        onPress={() => setEditCategory(cat.id)}
                      >
                        <Text style={[styles.editCatChipText, editCategory === cat.id && { color: cat.color }]}>{cat.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Deadline stepper */}
                  <View style={styles.editDeadlineRow}>
                    <Text style={styles.editDeadlineLabel}>DEADLINE</Text>
                    <TouchableOpacity onPress={() => setEditDeadlineDays((d) => Math.max(1, d - 7))} style={styles.editStepBtn}>
                      <Text style={styles.editStepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.editDeadlineVal}>in {editDeadlineDays}d</Text>
                    <TouchableOpacity onPress={() => setEditDeadlineDays((d) => Math.min(365, d + 7))} style={styles.editStepBtn}>
                      <Text style={styles.editStepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.editSaveBtn, !editName.trim() && { opacity: 0.4 }]}
                      onPress={saveGoalEdit}
                      disabled={!editName.trim()}
                    >
                      <Text style={styles.editSaveBtnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editCancelBtn}
                      onPress={() => setEditingGoalId(null)}
                    >
                      <Text style={styles.editCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => startEditGoal(goal)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.goalName}>{goal.name}</Text>
                    <Text style={styles.editHint}>✏</Text>
                  </View>
                  {goal.target ? <Text style={styles.goalTarget}>{goal.target}</Text> : null}
                </TouchableOpacity>
              )}

              {/* Progress bar — tap to set (snaps to 5%) */}
              <View style={styles.progressBarWrap}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={(e) => handleBarTap(goal, e.nativeEvent.locationX)}
                  style={{ flex: 1 }}
                >
                  <View
                    style={styles.progressBarBg}
                    onLayout={(e) => { barWidths.current[goal.id] = e.nativeEvent.layout.width; }}
                  >
                    <Animated.View style={[styles.progressBarFill, {
                      width: (progressAnims.current[goal.id] ?? new Animated.Value(goal.progress)).interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: catColor,
                    }]} />
                  </View>
                </TouchableOpacity>
                {typingProgressId === goal.id ? (
                  <TextInput
                    style={[styles.progressPctInput, { color: catColor }]}
                    value={typingProgressValue}
                    onChangeText={setTypingProgressValue}
                    onBlur={() => commitProgress(goal)}
                    onSubmitEditing={() => commitProgress(goal)}
                    keyboardType="numeric"
                    maxLength={3}
                    selectTextOnFocus
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity onPress={() => { setTypingProgressId(goal.id); setTypingProgressValue(goal.progress.toString()); }} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Text style={[styles.progressPct, { color: catColor }]}>{goal.progress}%</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Deadline + AI advice */}
              <View style={styles.goalFooter}>
                {goal.deadline ? (
                  <Text style={[
                    styles.deadline,
                    formatDeadline(goal.deadline).includes('overdue') && { color: '#f06060' },
                    formatDeadline(goal.deadline) === 'due today' && { color: '#f5c840' },
                  ]}>
                    {formatDeadline(goal.deadline)}
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={[styles.adviceBtn, showAdvice && { backgroundColor: catColor + '30', borderColor: catColor }]}
                  onPress={() => getAdvice(goal)}
                >
                  <Text style={[styles.adviceBtnText, showAdvice && { color: catColor }]}>AI Advice</Text>
                </TouchableOpacity>
              </View>

              {stalled && (
                <Text style={styles.stalledText}>Stalled — {days} days in</Text>
              )}

              {/* Advice expansion */}
              {showAdvice && (
                <View style={[styles.adviceBox, { borderLeftColor: catColor }]}>
                  <View style={styles.adviceBoxHeader}>
                    <Text style={[styles.adviceBoxLabel, { color: catColor }]}>AI ADVICE</Text>
                    <TouchableOpacity onPress={() => setAdviceId(null)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <Text style={styles.adviceClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  {adviceLoading === goal.id
                    ? <ActivityIndicator color={catColor} size={20} />
                    : <Text style={styles.adviceText}>{adviceText[goal.id]}</Text>}
                </View>
              )}

              {/* Milestone commentary */}
              {milestoneComment?.goalId === goal.id && (
                <View style={styles.milestoneBox}>
                  <View style={styles.milestoneBoxHeader}>
                    <Text style={styles.milestoneBoxLabel}>
                      ◆ {milestoneComment.pct}% MILESTONE
                    </Text>
                    <TouchableOpacity onPress={() => setMilestoneComment(null)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <Text style={styles.adviceClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.milestoneBoxText}>{milestoneComment.text}</Text>
                </View>
              )}
            </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      <MilestoneModal milestone={milestone} onClose={() => setMilestone(null)} />
      <ConfettiOverlay visible={showConfetti} onDone={() => setShowConfetti(false)} />
      <PaywallModal visible={paywallVisible} trigger="goals" onClose={() => setPaywallVisible(false)} />

      {/* Add Goal Modal */}
      <Modal
        visible={showAddForm}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAddForm(false); setNewName(''); setNewTarget(''); setAddError(''); setNewDeadlineDays(90); }}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => { setShowAddForm(false); setNewName(''); setNewTarget(''); setAddError(''); setNewDeadlineDays(90); }}
          />
          <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>New Goal</Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
                {addError ? <Text style={styles.addErrorText}>{addError}</Text> : null}
                <TextInput
                  testID="goals-name-input"
                  style={styles.input}
                  placeholder="Goal name..."
                  placeholderTextColor="#555"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <TextInput
                  testID="goals-target-input"
                  style={styles.input}
                  placeholder="Target (e.g. 5K run, 100 pages)..."
                  placeholderTextColor="#555"
                  value={newTarget}
                  onChangeText={setNewTarget}
                />
                <Text style={styles.formFieldLabel}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, newCategory === cat.id && { backgroundColor: cat.color + '30', borderColor: cat.color }]}
                      onPress={() => setNewCategory(cat.id)}
                    >
                      <Text style={[styles.catChipText, newCategory === cat.id && { color: cat.color }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.formFieldLabel}>DEADLINE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {[
                    { days: 30, label: '1 month' },
                    { days: 60, label: '2 months' },
                    { days: 90, label: '3 months' },
                    { days: 180, label: '6 months' },
                    { days: 365, label: '1 year' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.days}
                      style={[styles.catChip, newDeadlineDays === opt.days && { backgroundColor: '#b8f05830', borderColor: '#b8f058' }]}
                      onPress={() => setNewDeadlineDays(opt.days)}
                    >
                      <Text style={[styles.catChipText, newDeadlineDays === opt.days && { color: '#b8f058' }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    testID="goals-create-btn"
                    style={[styles.cta, { flex: 1, backgroundColor: accent, opacity: newName.trim() ? 1 : 0.35 }]}
                    onPress={addGoal}
                    disabled={!newName.trim()}
                  >
                    <Text style={[styles.ctaText, { color: accentText }]}>Create Goal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="goals-cancel-btn"
                    style={[styles.cta, { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' }]}
                    onPress={() => { setShowAddForm(false); setNewName(''); setNewTarget(''); setAddError(''); setNewDeadlineDays(90); }}
                  >
                    <Text style={[styles.ctaText, { color: '#aaa' }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontSize: fscale(11), letterSpacing: 1.5, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: fscale(22), fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', marginBottom: 2 },
  subtitle: { fontSize: fscale(11), color: '#aaa', fontFamily: 'DMMono_400Regular' },
  addBtn: { borderWidth: 1, borderColor: '#b8f058', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { color: '#b8f058', fontSize: fscale(13), fontWeight: '700' },

  list: { padding: 16, paddingBottom: 40, gap: 14 },

  goalCard: { backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#252525' },
  goalCardStalled: { borderColor: '#f0606040' },
  goalCardComplete: { borderColor: '#b8f05850', backgroundColor: '#0a150a' },
  completeBadge: {
    backgroundColor: '#b8f05825', borderRadius: 4, borderWidth: 1, borderColor: '#b8f05880',
    paddingHorizontal: 6, paddingVertical: 2,
  },
  completeBadgeText: { fontSize: fscale(9), color: '#b8f058', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catBadge: {
    borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  catLabel: { fontSize: fscale(9), letterSpacing: 2, fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  deleteBtn: { color: '#555', fontSize: fscale(16) },
  goalName: { fontSize: fscale(17), fontWeight: '700', color: '#fff' },
  editHint: { fontSize: fscale(11), color: '#444' },
  goalTarget: { fontSize: fscale(12), color: '#aaa', fontFamily: 'DMMono_400Regular', marginBottom: 12 },

  progressBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressBarBg: { flex: 1, height: 10, backgroundColor: '#2a2a2a', borderRadius: 5 },
  progressBarFill: { height: 10, borderRadius: 5 },
  progressPct: { fontSize: fscale(12), fontFamily: 'DMMono_400Regular', fontWeight: '700', width: 36 },
  progressPctInput: {
    fontSize: fscale(12), fontFamily: 'DMMono_400Regular', fontWeight: '700',
    width: 44, textAlign: 'right', paddingVertical: 0,
    borderBottomWidth: 1, borderBottomColor: '#555',
  },

  goalFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepper: { flexDirection: 'row', gap: 6 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  stepBtnDisabledBox: { borderColor: '#252525' },
  stepBtnText: { fontSize: fscale(18), fontWeight: '700', lineHeight: 20 },
  stepBtnDisabled: { color: '#333' },
  deadline: { flex: 1, fontSize: fscale(11), color: '#aaa', fontFamily: 'DMMono_400Regular' },
  adviceBtn: {
    flex: 1,
    borderWidth: 1, borderColor: '#333', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    alignItems: 'center',
  },
  adviceBtnText: { fontSize: fscale(13), color: '#b8f058', fontWeight: '700' },

  stalledText: { fontSize: fscale(11), color: '#f06060', fontFamily: 'DMMono_400Regular', marginTop: 10, letterSpacing: 1 },
  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#383838', backgroundColor: '#161616',
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  filterChipText: { fontSize: fscale(10), color: '#aaa', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
  filterChipCount: { fontSize: fscale(10), color: '#666', fontFamily: 'DMMono_400Regular' },
  milestoneBox: {
    marginTop: 12, backgroundColor: '#0d1507',
    borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#b8f05850',
  },
  milestoneBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  milestoneBoxLabel: { fontSize: fscale(11), letterSpacing: 1.5, color: '#b8f058', fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  milestoneBoxText: { fontSize: fscale(13), color: '#ccc', lineHeight: 20 },

  adviceBox: {
    marginTop: 12, backgroundColor: '#0d1a07',
    borderRadius: 8, padding: 12,
    borderLeftWidth: 2, borderLeftColor: '#b8f058',
  },
  adviceBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  adviceBoxLabel: { fontSize: fscale(11), letterSpacing: 1.5, fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  adviceClose: { fontSize: fscale(13), color: '#aaa' },
  adviceText: { fontSize: fscale(13), color: '#bbb', lineHeight: 20 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIconView: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: '#b8f05840', backgroundColor: '#b8f05808', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyIconInner: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#b8f058' },
  emptyTitle: { fontSize: fscale(18), color: '#fff', fontWeight: '700', fontFamily: 'Syne_800ExtraBold' },
  emptySub: { fontSize: fscale(13), color: '#999', textAlign: 'center', lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingTop: 12, paddingBottom: 40, maxHeight: '92%',
  },
  modalHandle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: fscale(20), fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', marginBottom: 16 },
  formFieldLabel: { fontSize: fscale(9), letterSpacing: 2, color: '#aaa', fontFamily: 'DMMono_400Regular', marginBottom: -4 },
  addErrorText: { color: '#f06060', fontSize: fscale(12), backgroundColor: '#f0606015', borderRadius: 6, padding: 10, borderWidth: 1, borderColor: '#f0606030' },
  input: { backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#333', padding: 12, color: '#fff', fontSize: fscale(15) },
  catPicker: { flexDirection: 'row' },
  catChip: {
    borderWidth: 1, borderColor: '#333', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 8,
  },
  catChipText: { fontSize: fscale(10), letterSpacing: 1, color: '#aaa', fontFamily: 'DMMono_400Regular' },
  cta: { borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  ctaText: { fontWeight: '700', fontSize: fscale(14) },

  editForm: { marginBottom: 12, gap: 8 },
  editInput: {
    backgroundColor: '#1a1a1a', borderRadius: 8, borderWidth: 1, borderColor: '#444',
    paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: fscale(15),
  },
  editSaveBtn: {
    flex: 1, backgroundColor: '#b8f058', borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  editSaveBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: fscale(13) },
  editCancelBtn: {
    flex: 1, backgroundColor: '#222', borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#333',
  },
  editCancelBtnText: { color: '#aaa', fontWeight: '600', fontSize: fscale(13) },
  editCatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  editCatChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: '#333', backgroundColor: 'transparent',
  },
  editCatChipText: { fontSize: fscale(9), color: '#999', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
  editDeadlineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a1a',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#333',
  },
  editDeadlineLabel: { flex: 1, fontSize: fscale(9), color: '#999', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
  editDeadlineVal: { fontSize: fscale(14), color: '#fff', fontFamily: 'DMMono_400Regular', minWidth: 56, textAlign: 'center' },
  editStepBtn: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center',
  },
  editStepBtnText: { fontSize: fscale(18), color: '#b8f058', lineHeight: 20 },
});
