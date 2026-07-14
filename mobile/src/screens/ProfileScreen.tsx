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
  Alert,
  Switch,
  Share,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { recalculateStats } from '../services/stats';
import { drainOfflineQueue } from '../services/syncQueue';
import {
  requestNotificationPermission,
  scheduleDailyReminders,
  cancelDailyReminders,
  remindersWereEnabled,
  getNotificationTimes,
  setNotificationTimes,
} from '../services/notifications';
import { ProfileHeaderSkeleton, ProfileRowSkeleton } from '../components/Skeleton';
import { useAccessibility } from '../context/AccessibilityContext';
import { useUser } from '../context/UserContext';
import PaywallModal from '../components/PaywallModal';
import { restorePurchases } from '../services/purchases';
import { getContrastText } from '../utils/coachColors';

type Props = { navigation: NativeStackNavigationProp<any> };


const HABIT_EMOJIS = ['✅', '🏃', '💪', '📚', '🧘', '💤', '🥗', '🎯', '💧', '🌅', '📝', '🏋️'];

const COACHES = [
  { id: 'stoic_mentor',   name: 'Stoic Mentor',    color: '#b8f058', free: true,  preview: '"Control what you can. The rest is noise. Did you train today?"' },
  { id: 'drill_sergeant', name: 'Drill Sergeant',  color: '#f06060', free: false, preview: '"No excuses. No delays. You said you would — now prove it. Move."' },
  { id: 'anime_sensei',   name: 'Anime Sensei',    color: '#7b6af0', free: false, preview: '"This is your arc! Dig deeper — I believe in your power! GO!"' },
  { id: 'goggins',        name: 'Stay Hard',       color: '#f5c840', free: false, preview: '"Nobody cares. Work harder. Who\'s gonna carry the boats?"' },
  { id: 'ceo_coach',      name: 'CEO Coach',       color: '#40f5c8', free: false, preview: '"Time is equity. That missed session just cost you compound returns."' },
  { id: 'calm_therapist', name: 'Calm Therapist',  color: '#f0a060', free: false, preview: '"You\'ve already grown by showing up. Let\'s be gentle and honest today."' },
];

const HABIT_CATEGORIES = [
  { id: 'health',        label: 'Health' },
  { id: 'fitness',       label: 'Fitness' },
  { id: 'mindset',       label: 'Mindset' },
  { id: 'learning',      label: 'Learning' },
  { id: 'productivity',  label: 'Productivity' },
  { id: 'other',         label: 'Other' },
];

interface Habit {
  id: string;
  name: string;
  emoji: string;
  streak_days: number;
  category: string;
}

export default function ProfileScreen({ navigation }: Props) {
  const { reduceMotion, highContrast, setReduceMotion, setHighContrast } = useAccessibility();
  const { profile, updateProfileField } = useUser();
  const initialized = useRef(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<'personality' | 'monkmode' | 'habits'>('personality');
  const [restoring, setRestoring] = useState(false);
  const coachAnims = useRef<Record<string, Animated.Value>>({});
  const getCoachAnim = (id: string): Animated.Value => {
    if (!coachAnims.current[id]) coachAnims.current[id] = new Animated.Value(1);
    return coachAnims.current[id];
  };
  const dimColor = highContrast ? '#aaa' : '#888';
  const sectionLabelStyle = [s.sectionLabel, { color: dimColor }];
  const subTextStyle = [s.monkModeSub, { color: dimColor }];
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [personality, setPersonality] = useState('stoic_mentor');
  const [identity, setIdentity] = useState('');
  const [email, setEmail] = useState('');
  const [monkMode, setMonkMode] = useState(false);
  const [strictGoals, setStrictGoals] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [morningH, setMorningH] = useState(8);
  const [morningM, setMorningM] = useState(0);
  const [eveningH, setEveningH] = useState(20);
  const [eveningM, setEveningM] = useState(30);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [streakFreezes, setStreakFreezes] = useState(0);
  const [freezeUsedOn, setFreezeUsedOn] = useState<string | null>(null);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);
  const [memoryCleared, setMemoryCleared] = useState(false);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
  const [notifyCoachNudges, setNotifyCoachNudges] = useState(true);
  const [avatar, setAvatar] = useState('🧘');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('✅');
  const [newHabitCategory, setNewHabitCategory] = useState('productivity');
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitName, setEditingHabitName] = useState('');

  useEffect(() => {
    loadHabits();
    remindersWereEnabled().then((enabled) => setReminders(enabled));
    getNotificationTimes().then(({ morningH: mh, morningM: mm, eveningH: eh, eveningM: em }) => {
      setMorningH(mh); setMorningM(mm); setEveningH(eh); setEveningM(em);
    });
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? ''));
  }, []);

  useEffect(() => {
    if (!profile || initialized.current) return;
    initialized.current = true;
    setName(profile.name);
    setUsername(profile.username);
    setPersonality(profile.personality);
    setIdentity(profile.identityStatement);
    setMonkMode(profile.monkMode);
    setStrictGoals(profile.strictGoals);
    setStreakFreezes(profile.streakFreezes);
    setFreezeUsedOn(profile.freezeUsedOn);
    setShowOnLeaderboard(profile.showOnLeaderboard);
    setNotifyCoachNudges(profile.notifyCoachNudges);
    setAvatar(profile.avatar);
    setLoading(false);
  }, [profile]);

  const loadHabits = async () => {
    setHabitsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('habits').select('id, name, emoji, streak_days, category')
        .eq('user_id', user.id).order('created_at', { ascending: true });
      if (data) {
        setHabits(data.map((h: any) => ({
          id: h.id, name: h.name,
          emoji: h.emoji || '✅',
          streak_days: h.streak_days || 0,
          category: h.category || 'productivity',
        })));
      }
    } catch (err) {
      console.error('Failed to load habits:', err instanceof Error ? err.message : String(err));
    } finally {
      setHabitsLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const uname = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      await supabase.from('users').update({
        name: name.trim(),
        username: uname || null,
        personality,
        identity_statement: identity.trim(),
        monk_mode: monkMode,
        strict_goals: strictGoals,
        show_on_leaderboard: showOnLeaderboard,
        avatar,
      }).eq('id', user.id);
      updateProfileField({ name: name.trim(), username: uname || '', personality, identityStatement: identity.trim(), monkMode, strictGoals, showOnLeaderboard, avatar });
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save profile:', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const addHabit = async () => {
    if (!newHabitName.trim()) return;
    if (!profile?.isPro && habits.length >= 3) { setPaywallTrigger('habits'); setPaywallVisible(true); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('habits').insert({
        user_id: user.id,
        name: newHabitName.trim(),
        emoji: newHabitEmoji,
        category: newHabitCategory,
      });
      setNewHabitName('');
      setNewHabitEmoji('✅');
      setNewHabitCategory('productivity');
      setShowAddHabit(false);
      await loadHabits();
    } catch (err) {
      console.error('Failed to add habit:', err instanceof Error ? err.message : String(err));
    }
  };

  const saveHabitEdit = async (habitId: string) => {
    const trimmed = editingHabitName.trim();
    if (!trimmed) { setEditingHabitId(null); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('habits').update({ name: trimmed }).eq('id', habitId).eq('user_id', user.id);
      setHabits((prev) => prev.map((h) => h.id === habitId ? { ...h, name: trimmed } : h));
    } catch {}
    setEditingHabitId(null);
  };

  const deleteHabit = (habitId: string, habitName: string) => {
    Alert.alert(
      'Delete Habit',
      `Remove "${habitName}"? This will also delete its history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              await supabase.from('habits').delete().eq('id', habitId).eq('user_id', user.id);
              setHabits((prev) => prev.filter((h) => h.id !== habitId));
              recalculateStats(user.id).catch(() => {});
              drainOfflineQueue().catch(() => {});
            } catch (err) {
              console.error('Failed to delete habit:', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ]
    );
  };

  const useFreeze = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (streakFreezes <= 0 || freezeUsedOn === today) return;
    Alert.alert(
      'Use Streak Freeze?',
      `This will protect your streak by counting yesterday as completed. You have ${streakFreezes} freeze${streakFreezes !== 1 ? 's' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use Freeze', style: 'default', onPress: async () => {
          setFreezeLoading(true);
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yd = yesterday.toISOString().split('T')[0];
            const { data: userHabits } = await supabase.from('habits').select('id').eq('user_id', user.id);
            if (userHabits?.length) {
              const rows = userHabits.map((h: any) => ({ habit_id: h.id, user_id: user.id, date: yd }));
              await supabase.from('habit_completions').upsert(rows, { onConflict: 'habit_id,date' });
            }
            await supabase.from('users').update({
              streak_freezes: streakFreezes - 1,
              freeze_used_on: today,
            }).eq('id', user.id);
            await supabase.rpc('recalculate_user_stats', { p_user_id: user.id });
            setStreakFreezes((n) => n - 1);
            setFreezeUsedOn(today);
            Alert.alert('Freeze Used', 'Your streak has been protected.');
          } catch (err) {
            Alert.alert('Error', 'Failed to use freeze. Try again.');
          } finally {
            setFreezeLoading(false);
          }
        }},
      ]
    );
  };

  const clearCoachMemory = () => {
    Alert.alert(
      'Clear Coach Memory',
      'Your coach will forget everything it learned about you. Conversations continue, but context resets. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Memory',
          style: 'destructive',
          onPress: async () => {
            setClearingMemory(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              await supabase.from('users').update({ coach_memory: null }).eq('id', user.id);
              updateProfileField({ coachMemory: '' });
              setMemoryCleared(true);
            } catch {
              Alert.alert('Error', 'Could not clear memory. Try again.');
            } finally {
              setClearingMemory(false);
            }
          },
        },
      ]
    );
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const ok = await restorePurchases();
      Alert.alert(ok ? 'Pro Restored' : 'Nothing Found', ok ? 'Your Pro subscription is active.' : 'No active subscription found on this account.');
    } catch {
      Alert.alert('Restore Failed', 'Could not reach the store. Check your connection.');
    } finally {
      setRestoring(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => { await supabase.auth.signOut(); },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, all habits, goals, and chat history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            const doDelete = async () => {
              try {
                const { error } = await supabase.functions.invoke('delete-account', { body: {} });
                if (error) throw error;
                await supabase.auth.signOut();
              } catch {
                Alert.alert('Error', 'Could not delete account. Contact support.');
              }
            };
            if (Platform.OS === 'ios') {
              Alert.prompt(
                'Type DELETE to confirm',
                'All your data will be permanently erased.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete Forever',
                    style: 'destructive',
                    onPress: async (value) => {
                      if (value?.trim() !== 'DELETE') {
                        Alert.alert('Cancelled', 'You must type DELETE exactly to proceed.');
                        return;
                      }
                      await doDelete();
                    },
                  },
                ],
                'plain-text'
              );
            } else {
              Alert.alert(
                'Final confirmation',
                'This will permanently erase ALL your data. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete Forever', style: 'destructive', onPress: doDelete },
                ]
              );
            }
          },
        },
      ]
    );
  };

  const exportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [habitsRes, goalsRes, checkinsRes, chatsRes] = await Promise.all([
        supabase.from('habits').select('name, emoji, streak_days, category, created_at').eq('user_id', user.id),
        supabase.from('goals').select('name, category, progress, target, deadline, created_at').eq('user_id', user.id),
        supabase.from('check_ins').select('date, type, mission, energy, completed, reason').eq('user_id', user.id).order('date', { ascending: false }).limit(90),
        supabase.from('chat_messages').select('role, text, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        habits:       habitsRes.data   ?? [],
        goals:        goalsRes.data    ?? [],
        check_ins:    checkinsRes.data ?? [],
        chat_messages: chatsRes.data  ?? [],
      };
      await Share.share({
        message: JSON.stringify(payload, null, 2),
        title:   'Monk.ai Data Export',
      });
    } catch {
      Alert.alert('Export failed', 'Could not export data. Check your connection.');
    }
  };

  function stepTime30(h: number, m: number, dir: 1 | -1): [number, number] {
    let total = h * 60 + m + dir * 30;
    total = ((total % 1440) + 1440) % 1440;
    return [Math.floor(total / 60), total % 60];
  }

  function formatTime(h: number, m: number): string {
    const ampm = h < 12 ? 'AM' : 'PM';
    const hh = h % 12 || 12;
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm} ${ampm}`;
  }

  const adjustTime = async (which: 'morning' | 'evening', dir: 1 | -1) => {
    let newMH = morningH, newMM = morningM, newEH = eveningH, newEM = eveningM;
    if (which === 'morning') {
      [newMH, newMM] = stepTime30(morningH, morningM, dir);
      setMorningH(newMH); setMorningM(newMM);
    } else {
      [newEH, newEM] = stepTime30(eveningH, eveningM, dir);
      setEveningH(newEH); setEveningM(newEM);
    }
    await setNotificationTimes(newMH, newMM, newEH, newEM);
    if (reminders) await scheduleDailyReminders(newMH, newMM, newEH, newEM, personality as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} scrollEnabled={false}>
          <ProfileHeaderSkeleton />
          <ProfileRowSkeleton />
          <ProfileRowSkeleton />
          <ProfileRowSkeleton />
          <ProfileRowSkeleton />
          <ProfileRowSkeleton />
          <ProfileRowSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const coachColor = COACHES.find(c => c.id === personality)?.color ?? '#b8f058';
  const accentText = getContrastText(coachColor);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Profile</Text>
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#0a0a0a" size={14} />
            : <Text style={s.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={s.avatarSection}>
          <TouchableOpacity style={[s.avatarCircle, { borderColor: coachColor + '90', borderWidth: 2.5 }]} onPress={() => setShowAvatarPicker((v) => !v)} activeOpacity={0.8}>
            <Text style={s.avatarEmoji}>{avatar}</Text>
          </TouchableOpacity>
          <Text style={s.avatarHint}>Tap to change avatar</Text>
        </View>
        {showAvatarPicker && (
          <View style={s.avatarGrid}>
            {['🧘','🐉','🦁','🔥','⚡','🎯','🌙','🏋️','🧠','🥷','🦅','🌊','🐺','💎','🗿','👑','🌟','🦊','🐻','🍀'].map((em) => (
              <TouchableOpacity
                key={em}
                style={[s.avatarOption, avatar === em && s.avatarOptionActive]}
                onPress={() => { setAvatar(em); setShowAvatarPicker(false); }}
              >
                <Text style={s.avatarOptionEmoji}>{em}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Identity group — email + name + username + identity in one card */}
        <Text style={sectionLabelStyle}>IDENTITY</Text>
        <View style={s.groupCard}>
          <View style={s.groupRow}>
            <Text style={s.groupRowLabel}>EMAIL</Text>
            <Text style={s.groupRowValue}>{email}</Text>
          </View>
          <View style={s.groupDivider} />
          <View style={s.groupRow}>
            <Text style={s.groupRowLabel}>NAME</Text>
            <TextInput
              style={s.groupRowInput}
              placeholder="Your name"
              placeholderTextColor="#444"
              value={name}
              onChangeText={setName}
              returnKeyType="done"
            />
          </View>
          <View style={s.groupDivider} />
          <View style={s.groupRow}>
            <Text style={s.groupRowLabel}>HANDLE</Text>
            <TextInput
              style={s.groupRowInput}
              placeholder="monk_warrior"
              placeholderTextColor="#444"
              value={username}
              onChangeText={v => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              returnKeyType="done"
            />
          </View>
          <View style={s.groupDivider} />
          <View style={[s.groupRow, { alignItems: 'flex-start', paddingVertical: 14 }]}>
            <Text style={[s.groupRowLabel, { paddingTop: 2 }]}>IDENTITY</Text>
            <TextInput
              style={[s.groupRowInput, { minHeight: scale(60), textAlignVertical: 'top' }]}
              placeholder="I am the type of person who..."
              placeholderTextColor="#444"
              value={identity}
              onChangeText={setIdentity}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Coach Personality */}
        <Text style={sectionLabelStyle}>YOUR COACH</Text>
        <View style={s.personalityGrid}>
          {COACHES.map((coach) => {
            const active = personality === coach.id;
            const locked = !coach.free && !profile?.isPro;
            return (
              <TouchableOpacity
                key={coach.id}
                style={s.personalityCardWrap}
                onPress={() => {
                  if (locked) { setPaywallTrigger('personality'); setPaywallVisible(true); return; }
                  setPersonality(coach.id);
                  // Reschedule with new coach voice if reminders active
                  if (reminders) scheduleDailyReminders(morningH, morningM, eveningH, eveningM, coach.id as any).catch(() => {});
                  const anim = getCoachAnim(coach.id);
                  anim.setValue(0.97);
                  Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 250 }).start();
                }}
                activeOpacity={0.85}
              >
                <Animated.View style={[s.personalityCard, active && { backgroundColor: coach.color + '11' }, { transform: [{ scale: getCoachAnim(coach.id) }] }]}>
                  {active && <View style={[s.personalityAccentBar, { backgroundColor: coach.color }]} />}
                  <View style={[s.dot, { backgroundColor: locked ? '#333' : coach.color }]} />
                  <Text style={[s.personalityName, active && { color: coach.color }, locked && { color: '#555' }]}>{coach.name}</Text>
                  {locked && <Text style={s.lockBadge}>PRO</Text>}
                  {active && !locked && <Text style={s.personalityPreview}>{coach.preview}</Text>}
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Coach Memory */}
        <Text style={sectionLabelStyle}>WHAT YOUR COACH REMEMBERS</Text>
        <View style={[s.memoryCard, { borderLeftColor: coachColor + '60' }]}>
          {memoryCleared || !profile?.coachMemory ? (
            <Text style={s.memoryEmpty}>
              {memoryCleared
                ? 'Memory cleared. Your coach starts fresh.'
                : 'Your coach hasn\'t learned anything about you yet. Start chatting.'}
            </Text>
          ) : (
            <>
              <Text style={s.memoryText}>{profile.coachMemory}</Text>
              <View style={s.memoryFooter}>
                <Text style={[s.memoryMeta, { color: coachColor + '99' }]}>
                  Updated as you chat
                </Text>
                <TouchableOpacity
                  onPress={clearCoachMemory}
                  disabled={clearingMemory}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  {clearingMemory
                    ? <ActivityIndicator size={12} color="#555" />
                    : <Text style={s.memoryClearBtn}>Clear</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Settings group */}
        <Text style={sectionLabelStyle}>SETTINGS</Text>
        {/* Monk Mode */}
        <View style={[s.monkModeCard, monkMode && { borderLeftWidth: 3, borderLeftColor: coachColor }]}>
          <View style={s.monkModeLeft}>
            <Text style={s.monkModeTitle}>Monk Mode</Text>
            <Text style={subTextStyle}>Max focus. Your coach gets strict.</Text>
          </View>
          <Switch
            value={monkMode}
            onValueChange={async (val) => {
              if (val && !profile?.isPro) { setPaywallTrigger('monkmode'); setPaywallVisible(true); return; }
              setMonkMode(val);
              updateProfileField({ monkMode: val });
              const { data: { user } } = await supabase.auth.getUser();
              if (user) { try { await supabase.from('users').update({ monk_mode: val }).eq('id', user.id); } catch {} }
            }}
            trackColor={{ false: '#333', true: coachColor }}
            thumbColor={monkMode ? accentText : '#666'}
          />
        </View>

        {/* Strict Daily Goals */}
        <View style={[s.monkModeCard, { marginTop: 8 }, strictGoals && { borderLeftWidth: 3, borderLeftColor: coachColor }]}>
          <View style={s.monkModeLeft}>
            <Text style={s.monkModeTitle}>Strict Daily Goals</Text>
            <Text style={subTextStyle}>Miss a habit = streak penalty.</Text>
          </View>
          <Switch
            value={strictGoals}
            onValueChange={async (val) => {
              if (val && !profile?.isPro) { setPaywallTrigger('monkmode'); setPaywallVisible(true); return; }
              setStrictGoals(val);
              updateProfileField({ strictGoals: val });
              const { data: { user } } = await supabase.auth.getUser();
              if (user) { try { await supabase.from('users').update({ strict_goals: val }).eq('id', user.id); } catch {} }
            }}
            trackColor={{ false: '#333', true: coachColor }}
            thumbColor={strictGoals ? accentText : '#666'}
          />
        </View>

        {/* Streak Freeze */}
        <View style={s.freezeCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.freezeTitle}>Streak Freezes</Text>
            <Text style={s.freezeSub}>
              {streakFreezes > 0
                ? `${streakFreezes} available — protects your streak if you miss a day`
                : 'No freezes available right now'}
            </Text>
          </View>
          {streakFreezes > 0 && (
            <TouchableOpacity
              style={[s.freezeBtn, (freezeUsedOn === new Date().toISOString().split('T')[0] || freezeLoading) && s.freezeBtnDisabled]}
              onPress={useFreeze}
              disabled={freezeUsedOn === new Date().toISOString().split('T')[0] || freezeLoading}
            >
              {freezeLoading
                ? <ActivityIndicator color="#0a0a0a" size={12} />
                : <Text style={s.freezeBtnText}>{freezeUsedOn === new Date().toISOString().split('T')[0] ? 'Used Today' : 'Use'}</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Leaderboard opt-out */}
        <View style={[s.monkModeCard, { marginTop: 8 }, showOnLeaderboard && { borderLeftWidth: 3, borderLeftColor: coachColor }]}>
          <View style={s.monkModeLeft}>
            <Text style={s.monkModeTitle}>Leaderboard</Text>
            <Text style={subTextStyle}>Show your score on the public leaderboard.</Text>
          </View>
          <Switch
            value={showOnLeaderboard}
            onValueChange={async (val) => {
              setShowOnLeaderboard(val);
              updateProfileField({ showOnLeaderboard: val });
              const { data: { user } } = await supabase.auth.getUser();
              if (user) { try { await supabase.from('users').update({ show_on_leaderboard: val }).eq('id', user.id); } catch {} }
            }}
            trackColor={{ false: '#222', true: coachColor + '88' }}
            thumbColor={showOnLeaderboard ? coachColor : '#444'}
          />
        </View>

        {/* Reminders */}
        <Text style={sectionLabelStyle}>DAILY REMINDERS</Text>
        <View style={[s.monkModeCard, reminders && { borderLeftWidth: 3, borderLeftColor: coachColor }]}>
          <View style={s.monkModeLeft}>
            <Text style={s.monkModeTitle}>Daily Reminders</Text>
            <Text style={subTextStyle}>{reminders ? `${formatTime(morningH, morningM)} · ${formatTime(eveningH, eveningM)}` : 'Off'}</Text>
          </View>
          <Switch
            value={reminders}
            onValueChange={async (val) => {
              if (val) {
                const granted = await requestNotificationPermission();
                if (!granted) {
                  Alert.alert('Permission Required', 'Enable notifications in Settings to use reminders.');
                  return;
                }
                await scheduleDailyReminders(morningH, morningM, eveningH, eveningM, personality as any);
              } else {
                await cancelDailyReminders();
              }
              setReminders(val);
            }}
            trackColor={{ false: '#333', true: coachColor }}
            thumbColor={reminders ? accentText : '#666'}
          />
        </View>
        {reminders && (
          <View style={s.timePickerCard}>
            <View style={s.timeRow}>
              <Text style={s.timeLabel}>Morning</Text>
              <View style={s.timeControls}>
                <TouchableOpacity style={s.timeBtn} onPress={() => adjustTime('morning', -1)}>
                  <Text style={s.timeBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.timeValue}>{formatTime(morningH, morningM)}</Text>
                <TouchableOpacity style={s.timeBtn} onPress={() => adjustTime('morning', 1)}>
                  <Text style={s.timeBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[s.timeRow, { borderBottomWidth: 0 }]}>
              <Text style={s.timeLabel}>Evening</Text>
              <View style={s.timeControls}>
                <TouchableOpacity style={s.timeBtn} onPress={() => adjustTime('evening', -1)}>
                  <Text style={s.timeBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.timeValue}>{formatTime(eveningH, eveningM)}</Text>
                <TouchableOpacity style={s.timeBtn} onPress={() => adjustTime('evening', 1)}>
                  <Text style={s.timeBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Coach nudges (grouped under NOTIFICATIONS with reminders above) */}
        <View style={[s.monkModeCard, { marginTop: 8 }]}>
          <View style={s.monkModeLeft}>
            <Text style={s.monkModeTitle}>Coach Nudges</Text>
            <Text style={subTextStyle}>Push notifications from your AI coach.</Text>
          </View>
          <Switch
            value={notifyCoachNudges}
            onValueChange={async (val) => {
              setNotifyCoachNudges(val);
              updateProfileField({ notifyCoachNudges: val });
              const { data: { user } } = await supabase.auth.getUser();
              if (user) { try { await supabase.from('users').update({ notify_coach_nudges: val }).eq('id', user.id); } catch {} }
            }}
            trackColor={{ false: '#333', true: coachColor }}
            thumbColor={notifyCoachNudges ? accentText : '#666'}
          />
        </View>

        {/* Habits */}
        <Text style={sectionLabelStyle}>YOUR HABITS</Text>
        <View style={s.habitsCard}>
          {habitsLoading && <ActivityIndicator color="#b8f058" size={20} style={{ marginVertical: 8 }} />}
          {!habitsLoading && habits.length === 0 && (
            <Text style={s.habitsEmpty}>No habits yet. Add things you want to do every day.</Text>
          )}
          {habits.map((habit) => (
            <View key={habit.id} style={s.habitRow}>
              <Text style={s.habitEmoji}>{habit.emoji}</Text>
              <View style={{ flex: 1 }}>
                {editingHabitId === habit.id ? (
                  <TextInput
                    style={s.habitEditInput}
                    value={editingHabitName}
                    onChangeText={setEditingHabitName}
                    onBlur={() => saveHabitEdit(habit.id)}
                    onSubmitEditing={() => saveHabitEdit(habit.id)}
                    autoFocus
                    returnKeyType="done"
                  />
                ) : (
                  <TouchableOpacity onPress={() => { setEditingHabitId(habit.id); setEditingHabitName(habit.name); }}>
                    <Text style={s.habitName}>{habit.name}</Text>
                    <Text style={s.habitCat}>{habit.category}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {habit.streak_days > 0 && editingHabitId !== habit.id && (
                <Text style={s.habitStreak}>{habit.streak_days}d</Text>
              )}
              <TouchableOpacity
                onPress={() => deleteHabit(habit.id, habit.name)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Text style={s.habitDelete}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {showAddHabit ? (
            <View style={s.addHabitForm}>
              {/* Emoji picker */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={s.emojiPicker}>
                {HABIT_EMOJIS.map((em) => (
                  <TouchableOpacity
                    key={em}
                    style={[s.emojiOption, newHabitEmoji === em && s.emojiOptionActive]}
                    onPress={() => setNewHabitEmoji(em)}
                  >
                    <Text style={{ fontSize: fscale(22) }}>{em}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                testID="habit-name-input"
                style={s.input}
                placeholder="Habit name..."
                placeholderTextColor="#555"
                value={newHabitName}
                onChangeText={setNewHabitName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={addHabit}
              />
              {/* Category picker */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={s.emojiPicker}>
                {HABIT_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.catChip, newHabitCategory === cat.id && s.catChipActive]}
                    onPress={() => setNewHabitCategory(cat.id)}
                  >
                    <Text style={[s.catChipText, newHabitCategory === cat.id && s.catChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  testID="habit-add-btn"
                  style={[s.addBtn, { flex: 1 }, !newHabitName.trim() && s.addBtnDisabled]}
                  onPress={addHabit}
                  disabled={!newHabitName.trim()}
                >
                  <Text style={s.addBtnText}>Add habit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="habit-cancel-btn"
                  style={[s.addBtn, { flex: 1, backgroundColor: '#222' }]}
                  onPress={() => { setShowAddHabit(false); setNewHabitName(''); setNewHabitEmoji('✅'); setNewHabitCategory('productivity'); }}
                >
                  <Text style={[s.addBtnText, { color: '#888' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity testID="habit-open-form-btn" style={s.addHabitBtn} onPress={() => setShowAddHabit(true)}>
              <Text style={s.addHabitBtnText}>+ Add habit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Accessibility */}
        <Text style={sectionLabelStyle}>ACCESSIBILITY</Text>
        <View style={[s.monkModeCard, { marginBottom: 8 }]}>
          <View style={s.monkModeLeft}>
            <Text style={s.monkModeTitle}>Reduce Motion</Text>
            <Text style={subTextStyle}>
              Disables animations and transitions
            </Text>
          </View>
          <Switch
            value={reduceMotion}
            onValueChange={setReduceMotion}
            trackColor={{ false: '#333', true: coachColor }}
            thumbColor={reduceMotion ? accentText : '#666'}
          />
        </View>
        <View style={[s.monkModeCard, { marginTop: 0 }]}>
          <View style={s.monkModeLeft}>
            <Text style={s.monkModeTitle}>High Contrast</Text>
            <Text style={subTextStyle}>
              Increases text and border contrast
            </Text>
          </View>
          <Switch
            value={highContrast}
            onValueChange={setHighContrast}
            trackColor={{ false: '#333', true: coachColor }}
            thumbColor={highContrast ? accentText : '#666'}
          />
        </View>

        {/* Export */}
        <Text style={sectionLabelStyle}>DATA</Text>
        <TouchableOpacity style={s.exportBtn} onPress={exportData}>
          <Text style={s.exportBtnTitle}>Export My Data</Text>
          <Text style={s.exportBtnSub}>JSON — habits, goals, check-ins, chat (last 100)</Text>
        </TouchableOpacity>

        {/* Pro status */}
        {profile?.isPro ? (
          <View style={s.proBanner}>
            <Text style={s.proBannerLabel}>PRO</Text>
            <Text style={s.proBannerSub}>Unlimited. All coaches. Weekly review.</Text>
          </View>
        ) : (
          <TouchableOpacity style={s.upgradeBtn} onPress={() => { setPaywallTrigger('personality'); setPaywallVisible(true); }} activeOpacity={0.85}>
            <Text style={s.upgradeBtnTitle}>Upgrade to Pro</Text>
            <Text style={s.upgradeBtnSub}>Unlock all coaches · unlimited AI · weekly review</Text>
          </TouchableOpacity>
        )}

        {/* Restore purchases */}
        <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={restoring}>
          <Text style={s.restoreText}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete account */}
        <TouchableOpacity style={s.deleteAccountBtn} onPress={handleDeleteAccount}>
          <Text style={s.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
      <PaywallModal visible={paywallVisible} trigger={paywallTrigger} onClose={() => setPaywallVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: fscale(13), color: '#aaa' },
  title: { fontSize: fscale(17), fontWeight: '700', color: '#fff', fontFamily: 'Syne_800ExtraBold' },
  saveBtn: { backgroundColor: '#b8f058', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: fscale(13), fontWeight: '700', color: '#0a0a0a' },

  scroll: { padding: 20, paddingBottom: 60, gap: 8 },
  sectionLabel: {
    fontSize: fscale(11), letterSpacing: 1.5, color: '#aaa',
    fontFamily: 'DMMono_400Regular', marginTop: 16, marginBottom: 8,
  },

  card: { backgroundColor: '#111', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#252525' },
  cardLabel: { fontSize: fscale(11), color: '#aaa', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  cardValue: { fontSize: fscale(15), color: '#fff' },
  groupCard: { backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#252525', overflow: 'hidden' },
  groupRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  groupDivider: { height: 1, backgroundColor: '#1e1e1e', marginLeft: 14 },
  groupRowLabel: { fontSize: fscale(9), color: '#555', fontFamily: 'DMMono_400Regular', letterSpacing: 1, width: 52 },
  groupRowValue: { flex: 1, fontSize: fscale(14), color: '#777' },
  groupRowInput: { flex: 1, fontSize: fscale(14), color: '#fff', padding: 0 },

  input: {
    backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#333',
    padding: 14, color: '#fff', fontSize: fscale(15),
  },
  inputMulti: { minHeight: scale(80), textAlignVertical: 'top' },

  personalityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  personalityCardWrap: { flex: 1, minWidth: '45%' },
  personalityCard: {
    flex: 1, backgroundColor: '#111', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#252525', overflow: 'hidden',
  },
  personalityAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 8 },
  personalityName: { fontSize: fscale(13), fontWeight: '700', color: '#fff', marginBottom: 2 },
  personalityDesc: { fontSize: fscale(11), color: '#aaa' },
  personalityPreview: { fontSize: fscale(11), color: '#999', lineHeight: 16, marginTop: 4, fontStyle: 'italic' },
  lockBadge: { fontSize: fscale(9), color: '#555', letterSpacing: 1, marginTop: 4, fontWeight: '700' },
  personalityProBadge: { fontSize: fscale(8), letterSpacing: 2, fontFamily: 'DMMono_400Regular', alignSelf: 'flex-end', marginBottom: 4 },

  monkModeCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#252525',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  monkModeLeft: { gap: 3 },
  monkModeTitle: { fontSize: fscale(15), fontWeight: '700', color: '#fff' },
  monkModeSub: { fontSize: fscale(12), color: '#aaa' },
  freezeBadge: { paddingHorizontal: 16, paddingVertical: 10 },
  freezeText: { fontSize: fscale(13), color: '#aaa' },
  freezeCard: {
    backgroundColor: '#0d1a2a', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1a3a5a',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  freezeTitle: { fontSize: fscale(14), fontWeight: '700', color: '#7ab8f0' },
  freezeSub: { fontSize: fscale(12), color: '#aaa', marginTop: 2, lineHeight: 16 },
  freezeBtn: {
    backgroundColor: '#7ab8f0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center', minWidth: 60,
  },
  freezeBtnDisabled: { backgroundColor: '#2a2a2a' },
  freezeBtnText: { fontSize: fscale(12), fontWeight: '700', color: '#0a0a0a' },

  // Habits
  habitsCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#252525', gap: 2,
  },
  habitsEmpty: { fontSize: fscale(13), color: '#aaa', paddingVertical: 8 },
  habitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  habitEmoji: { fontSize: fscale(20) },
  habitEditInput: {
    fontSize: fscale(14), fontWeight: '600', color: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#b8f058', paddingVertical: 2,
  },
  habitName: { fontSize: fscale(14), fontWeight: '600', color: '#fff' },
  habitCat: { fontSize: fscale(10), color: '#999', fontFamily: 'DMMono_400Regular', letterSpacing: 1, marginTop: 1 },
  habitStreak: { fontSize: fscale(11), color: '#999', fontFamily: 'DMMono_400Regular' },
  habitDelete: { color: '#aaa', fontSize: fscale(16) },

  addHabitForm: { gap: 10, marginTop: 10 },
  emojiPicker: { flexDirection: 'row' },
  emojiOption: {
    width: 44, height: 44, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1a1a1a', marginRight: 6,
    borderWidth: 2, borderColor: 'transparent',
  },
  emojiOptionActive: { borderColor: '#b8f058', backgroundColor: '#1e2a1e' },
  addBtn: {
    backgroundColor: '#b8f058', borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: fscale(14) },
  addHabitBtn: {
    borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  addHabitBtnText: { color: '#aaa', fontSize: fscale(14) },

  catChip: {
    borderWidth: 1, borderColor: '#333', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 6,
    backgroundColor: '#1a1a1a',
  },
  catChipActive: { borderColor: '#b8f058', backgroundColor: '#1e2a1e' },
  catChipText: { fontSize: fscale(11), color: '#aaa', fontFamily: 'DMMono_400Regular' },
  catChipTextActive: { color: '#b8f058' },

  lockIcon: { fontSize: fscale(14), position: 'absolute', top: 8, right: 8 },

  memoryCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#252525', borderLeftWidth: 3,
  },
  memoryEmpty: { fontSize: fscale(13), color: '#555', lineHeight: 20, fontFamily: 'DMMono_400Regular' },
  memoryText: { fontSize: fscale(13), color: '#aaaaaa', lineHeight: 20, fontFamily: 'DMMono_400Regular' },
  memoryFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1e1e1e',
  },
  memoryMeta: { fontSize: fscale(10), letterSpacing: 0.8, fontFamily: 'DMMono_400Regular' },
  memoryClearBtn: { fontSize: fscale(12), color: '#f06060', fontFamily: 'DMMono_400Regular' },

  exportBtn: {
    backgroundColor: '#111', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#252525', gap: 4,
  },
  exportBtnTitle: { fontSize: fscale(15), fontWeight: '700', color: '#fff' },
  exportBtnSub: { fontSize: fscale(11), color: '#aaa', fontFamily: 'DMMono_400Regular' },
  proBanner: {
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: '#b8f05840', backgroundColor: '#b8f05808',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  proBannerLabel: { fontSize: fscale(11), fontWeight: '700', color: '#b8f058', letterSpacing: 1.5 },
  proBannerSub: { fontSize: fscale(12), color: '#666', flex: 1 },
  upgradeBtn: {
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: '#b8f05860', backgroundColor: '#b8f05812',
    alignItems: 'center',
  },
  upgradeBtnTitle: { fontSize: fscale(15), fontWeight: '700', color: '#b8f058', marginBottom: 3 },
  upgradeBtnSub: { fontSize: fscale(12), color: '#888' },
  restoreBtn: {
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center',
  },
  restoreText: { fontSize: fscale(14), color: '#999', fontWeight: '600' },
  signOutBtn: {
    marginTop: 24, borderRadius: 12, paddingVertical: 18, alignItems: 'center',
    borderWidth: 1, borderColor: '#f0606040', backgroundColor: '#1a0808',
  },
  signOutText: { fontSize: fscale(15), fontWeight: '700', color: '#f06060' },
  deleteAccountBtn: { alignItems: 'center', paddingVertical: 16, marginBottom: 8 },
  deleteAccountText: { fontSize: fscale(13), color: '#999' },

  timePickerCard: {
    backgroundColor: '#111', borderRadius: 12,
    borderWidth: 1, borderColor: '#252525', overflow: 'hidden',
  },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  timeLabel: { fontSize: fscale(14), color: '#aaa', fontWeight: '600' },
  timeControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  timeBtnText: { fontSize: fscale(18), color: '#b8f058', lineHeight: 22 },
  timeValue: { fontSize: fscale(15), color: '#fff', fontFamily: 'DMMono_400Regular', minWidth: 80, textAlign: 'center' },

  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#2a2a2a',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: fscale(40) },
  avatarHint: { fontSize: fscale(10), color: '#aaa', fontFamily: 'DMMono_400Regular', letterSpacing: 1, marginTop: 8 },
  avatarGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    justifyContent: 'center', paddingBottom: 16, paddingHorizontal: 8,
  },
  avatarOption: {
    width: scale(48), height: scale(48), borderRadius: 12,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarOptionActive: { borderColor: '#b8f058', backgroundColor: '#0d1a07' },
  avatarOptionEmoji: { fontSize: fscale(24) },
});
