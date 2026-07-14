import React, { useState, useEffect, useRef } from 'react';
import { fscale, scale } from '../utils/scale';
import {
  View, Text, TouchableOpacity, Switch, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import PaywallModal from '../components/PaywallModal';

const SOUNDS = [
  { id: 'rain',  label: 'Rain' },
  { id: 'brown', label: 'Brown Noise' },
  { id: 'lofi',  label: 'Lo-fi' },
];

// Files live in Supabase Storage bucket "ambient-sounds" (public).
// Upload rain.mp3, brown-noise.mp3, lofi.mp3 to that bucket.
// Bucket URL: Supabase dashboard → Storage → ambient-sounds → make public
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SOUND_URLS: Record<string, string> = {
  rain:  `${SUPABASE_URL}/storage/v1/object/public/ambient-sounds/rain.mp3`,
  brown: `${SUPABASE_URL}/storage/v1/object/public/ambient-sounds/brown-noise.mp3`,
  lofi:  `${SUPABASE_URL}/storage/v1/object/public/ambient-sounds/lofi.mp3`,
};

type Props = { navigation: NativeStackNavigationProp<any> };

const PRESETS = [15, 30, 60];

export default function MonkModeScreen({ navigation }: Props) {
  const { profile } = useUser();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [noExcuses, setNoExcuses] = useState(false);
  const [strictGoals, setStrictGoals] = useState(false);
  const [todaySessions, setTodaySessions] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [selectedSound, setSelectedSound] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadSettings();
    loadFocusStats();
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            setDone(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  useEffect(() => {
    if (done) logSession(minutes);
  }, [done]);

  useEffect(() => {
    if (running && selectedSound && SOUND_URLS[selectedSound]) {
      Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true }).catch(() => {});
      Audio.Sound.createAsync(
        { uri: SOUND_URLS[selectedSound] },
        { isLooping: true, volume: 0.4, shouldPlay: true }
      ).then(({ sound }) => {
        soundRef.current = sound;
      }).catch(() => {});
    } else if (!running) {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    return () => {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [running, selectedSound]);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('users').select('monk_mode, strict_goals').eq('id', user.id).single();
      if (data) {
        setNoExcuses(data.monk_mode ?? false);
        setStrictGoals(data.strict_goals ?? false);
      }
    } catch {}
  };

  const logSession = async (durationMinutes: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('monk_sessions').insert({ user_id: user.id, duration_minutes: durationMinutes });
      setTodaySessions((n) => n + 1);
      setTodayMinutes((m) => m + durationMinutes);
      setWeekMinutes((m) => m + durationMinutes);
    } catch {}
  };

  const loadFocusStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
      const { data } = await supabase
        .from('monk_sessions')
        .select('duration_minutes, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', weekAgo.toISOString());
      if (!data) return;
      const todayData = data.filter((s: any) => s.completed_at.startsWith(today));
      setTodaySessions(todayData.length);
      setTodayMinutes(todayData.reduce((acc: number, s: any) => acc + s.duration_minutes, 0));
      setWeekMinutes(data.reduce((acc: number, s: any) => acc + s.duration_minutes, 0));
    } catch {}
  };

  const selectSound = (id: string | null) => {
    setSelectedSound(id === selectedSound ? null : id);
  };

  const setPreset = (min: number) => {
    if (running) return;
    setMinutes(min);
    setSecondsLeft(min * 60);
    setDone(false);
  };

  const adjustMinutes = (delta: number) => {
    if (running) return;
    const next = Math.max(5, Math.min(120, minutes + delta));
    setMinutes(next);
    setSecondsLeft(next * 60);
    setDone(false);
  };

  const toggleTimer = () => {
    if (done) {
      setDone(false);
      setSecondsLeft(minutes * 60);
      return;
    }
    setRunning((r) => !r);
  };

  const toggleNoExcuses = async (val: boolean) => {
    if (val && !profile?.isPro) { setPaywallVisible(true); return; }
    setNoExcuses(val);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('users').update({ monk_mode: val }).eq('id', user.id);
    } catch {}
  };

  const toggleStrictGoals = async (val: boolean) => {
    if (val && !profile?.isPro) { setPaywallVisible(true); return; }
    setStrictGoals(val);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('users').update({ strict_goals: val }).eq('id', user.id);
    } catch {}
  };

  const displayMins = Math.floor(secondsLeft / 60);
  const displaySecs = secondsLeft % 60;
  const progress = secondsLeft / (minutes * 60);

  const ringProgress = done ? 1 : progress;
  const rightRot = `${Math.min(ringProgress * 360, 180) - 180}deg`;
  const leftRot = `${Math.max(0, (ringProgress - 0.5) * 360)}deg`;
  const arcColor = (running || done) ? '#b8f058' : '#2a2a2a';

  const timerLabel = done ? 'DONE' : running ? 'RUNNING' : 'READY';

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.headerAccentDot} />
          <View>
            <Text style={s.headerTitle}>Monk Mode</Text>
            <Text style={s.headerSub}>Gamify your discipline</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <Text style={s.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Timer card */}
        <View style={s.card}>
          <Text style={s.cardLabel}>⏱ Dopamine Detox Timer</Text>
          <Text style={s.cardSub}>Lock in. No distractions. Just work.</Text>

          {/* Progress ring */}
          <View style={s.timerWrap}>
            <View style={s.ringOuter}>
              <View style={s.ringBgLayer} />
              <View style={s.ringClipRight}>
                <View style={[s.ringInnerRight, { transform: [{ rotate: rightRot }] }]}>
                  <View style={[s.ringHalfBlock, { backgroundColor: arcColor }]} />
                </View>
              </View>
              <View style={s.ringClipLeft}>
                <View style={[s.ringInnerLeft, { transform: [{ rotate: leftRot }] }]}>
                  <View style={[s.ringHalfBlock, { backgroundColor: arcColor }]} />
                </View>
              </View>
              <View style={s.ringCenterHole}>
                <Text style={[s.timerText, done && { color: '#b8f058' }]}>
                  {String(displayMins).padStart(2, '0')}:{String(displaySecs).padStart(2, '0')}
                </Text>
                <Text style={[s.timerState, running && { color: '#b8f058' }, done && { color: '#b8f058' }]}>
                  {timerLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* Presets */}
          <View style={s.presets}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.presetBtn, minutes === p && !running && s.presetActive]}
                onPress={() => setPreset(p)}
                disabled={running}
              >
                <Text style={[s.presetText, minutes === p && !running && s.presetTextActive]}>
                  {p} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom duration */}
          <View style={s.customRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => adjustMinutes(-5)} disabled={running}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <View style={s.customCenter}>
              <Text style={s.customMins}>{minutes} min</Text>
              <Text style={s.customStep}>±5 min</Text>
            </View>
            <TouchableOpacity style={s.stepBtn} onPress={() => adjustMinutes(5)} disabled={running}>
              <Text style={s.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.startBtn, running && s.pauseBtn, done && s.doneBtn]}
            onPress={toggleTimer}
          >
            <Text style={[s.startBtnText, running && { color: '#fff' }]}>
              {done ? 'Reset Timer' : running ? '■ Stop' : 'Start Focus Block'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ambient Sound — only shown when audio URLs are configured */}
        {Object.values(SOUND_URLS).some(Boolean) && (
        <View style={s.card}>
          <Text style={s.cardLabel}>Ambient Sound</Text>
          <Text style={s.cardSub}>Background audio while you focus.</Text>
          <View style={s.soundRow}>
            {SOUNDS.map((sound) => (
              <TouchableOpacity
                key={sound.id}
                style={[s.soundChip, selectedSound === sound.id && s.soundChipActive]}
                onPress={() => selectSound(sound.id)}
              >
                <Text style={[s.soundLabel, selectedSound === sound.id && s.soundLabelActive]}>{sound.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.soundChip, selectedSound === null && s.soundChipActive]}
              onPress={() => setSelectedSound(null)}
            >
              <Text style={[s.soundLabel, selectedSound === null && s.soundLabelActive]}>Off</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Focus Stats */}
        {(todaySessions > 0 || weekMinutes > 0) && (
          <View style={s.statsCard}>
            <Text style={s.statsCardLabel}>FOCUS STATS</Text>
            <View style={s.statsRow}>
              <View style={s.statCol}>
                <Text style={s.statNum}>{todaySessions}</Text>
                <Text style={s.statLbl}>TODAY{'\n'}SESSIONS</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCol}>
                <Text style={s.statNum}>{todayMinutes}</Text>
                <Text style={s.statLbl}>TODAY{'\n'}MINUTES</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCol}>
                <Text style={[s.statNum, { color: '#b8f058' }]}>{weekMinutes}</Text>
                <Text style={s.statLbl}>WEEK{'\n'}MINUTES</Text>
              </View>
            </View>
          </View>
        )}

        {/* No Excuses Mode */}
        <View style={[s.toggleCard, noExcuses && s.toggleCardRed]}>
          <View style={s.toggleRow}>
            <View style={s.toggleIconDot} />
            <View style={s.toggleText}>
              <Text style={[s.toggleTitle, noExcuses && { color: '#f06060' }]}>No Excuses Mode</Text>
              <Text style={s.toggleSub}>Coach gives zero sympathy. Raw accountability only.</Text>
            </View>
            <Switch
              value={noExcuses}
              onValueChange={toggleNoExcuses}
              trackColor={{ false: '#333', true: '#f06060' }}
              thumbColor={noExcuses ? '#fff' : '#aaa'}
              ios_backgroundColor="#333"
            />
          </View>
          {noExcuses && (
            <View style={s.expansionRed}>
              <Text style={s.expansionTextRed}>
                ⚠ Your coach will call out every excuse, skip the sympathy, and demand results. No softening.
              </Text>
            </View>
          )}
        </View>

        {/* Strict Daily Goals */}
        <View style={[s.toggleCard, strictGoals && s.toggleCardGreen]}>
          <View style={s.toggleRow}>
            <View style={s.toggleIconDot} />
            <View style={s.toggleText}>
              <Text style={[s.toggleTitle, strictGoals && { color: '#b8f058' }]}>Strict Daily Goals</Text>
              <Text style={s.toggleSub}>All habits locked in. Miss one = streak penalty.</Text>
            </View>
            <Switch
              value={strictGoals}
              onValueChange={toggleStrictGoals}
              trackColor={{ false: '#333', true: '#b8f058' }}
              thumbColor={strictGoals ? '#0a0a0a' : '#aaa'}
              ios_backgroundColor="#333"
            />
          </View>
          {strictGoals && (
            <View style={s.expansionGreen}>
              <Text style={s.expansionTextGreen}>
                ✓ Every habit is now a non-negotiable. Your coach tracks and penalises misses in real-time.
              </Text>
            </View>
          )}
        </View>

        {/* Block Distractions */}
        <View style={[s.toggleCard, { opacity: 0.5 }]}>
          <View style={s.toggleRow}>
            <View style={s.toggleIconDot} />
            <View style={s.toggleText}>
              <Text style={s.toggleTitle}>Block Distractions</Text>
              <Text style={s.toggleSub}>Social media, news & dopamine traps go dark.</Text>
            </View>
            <View style={s.comingSoonBadge}>
              <Text style={s.comingSoonText}>SOON</Text>
              <Text style={s.comingSoonSub}>Q3 2026</Text>
            </View>
          </View>
        </View>

        {/* Monk Mode Active summary */}
        {(noExcuses || strictGoals) && (
          <View style={s.summaryRow}>
            <View style={s.summaryIcon} />
            <View>
              <Text style={s.summaryTitle}>Monk Mode Active</Text>
              <Text style={s.summarySub}>
                {[noExcuses && 'No excuses', strictGoals && 'Strict goals'].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      <PaywallModal visible={paywallVisible} trigger="monkmode" onClose={() => setPaywallVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAccentDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#7b6af020', borderWidth: 2, borderColor: '#7b6af0', marginRight: 4 },
  headerTitle: { fontSize: fscale(20), fontWeight: '800', color: '#b8f058', fontFamily: 'Syne_800ExtraBold' },
  headerSub: { fontSize: fscale(12), color: '#aaa', marginTop: 2 },
  closeBtn: { fontSize: fscale(18), color: '#aaa' },

  content: { padding: 16, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: '#111', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#222',
  },
  cardLabel: { fontSize: fscale(15), fontWeight: '700', color: '#fff', marginBottom: 4 },
  cardSub: { fontSize: fscale(12), color: '#aaa', marginBottom: 24 },

  timerWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  ringOuter: { width: 200, height: 200, borderRadius: 100, overflow: 'hidden' },
  ringBgLayer: { position: 'absolute', width: 200, height: 200, backgroundColor: '#1a1a1a' },
  ringClipRight: { position: 'absolute', left: 100, width: 100, height: 200, overflow: 'hidden' },
  ringInnerRight: { position: 'absolute', left: -100, width: 200, height: 200 },
  ringClipLeft: { position: 'absolute', left: 0, width: 100, height: 200, overflow: 'hidden' },
  ringInnerLeft: { position: 'absolute', left: 0, width: 200, height: 200 },
  ringHalfBlock: { position: 'absolute', left: 100, width: 100, height: 200 },
  ringCenterHole: {
    position: 'absolute', left: 14, top: 14, width: 172, height: 172,
    borderRadius: 86, backgroundColor: '#111',
    justifyContent: 'center', alignItems: 'center',
  },
  timerText: { fontSize: fscale(48), color: '#fff', fontFamily: 'DMMono_400Regular', letterSpacing: 2 },
  timerState: { fontSize: fscale(11), color: '#aaa', fontFamily: 'DMMono_400Regular', letterSpacing: 1.5, marginTop: 4 },

  presets: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  presetBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center',
  },
  presetActive: { backgroundColor: '#1a2a0a', borderColor: '#b8f058' },
  presetText: { fontSize: fscale(13), color: '#999', fontWeight: '600' },
  presetTextActive: { color: '#b8f058' },

  customRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, marginBottom: 20,
  },
  stepBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333',
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: fscale(22), color: '#fff', fontWeight: '300' },
  customCenter: { alignItems: 'center', minWidth: 80 },
  customMins: { fontSize: fscale(18), color: '#fff', fontWeight: '700' },
  customStep: { fontSize: fscale(10), color: '#aaa', fontFamily: 'DMMono_400Regular', marginTop: 2 },

  startBtn: {
    backgroundColor: '#b8f058', borderRadius: 14, paddingVertical: 18, alignItems: 'center',
  },
  pauseBtn: { backgroundColor: '#f06060', borderWidth: 0 },
  doneBtn: { backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#b8f058' },
  startBtnText: { fontSize: fscale(16), fontWeight: '800', color: '#0a0a0a', fontFamily: 'Syne_800ExtraBold' },

  toggleCard: {
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#222',
  },
  toggleCardRed:   { borderColor: '#f06060aa', backgroundColor: '#1a0808' },
  toggleCardGreen: { borderColor: '#b8f058aa', backgroundColor: '#0a150a' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  toggleIconDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#444', marginRight: 4, marginTop: 2 },
  toggleText: { flex: 1 },
  toggleTitle: { fontSize: fscale(15), fontWeight: '700', color: '#fff', marginBottom: 3 },
  toggleSub: { fontSize: fscale(12), color: '#aaa', lineHeight: 17 },

  expansionRed: {
    marginTop: 12, backgroundColor: '#2a0a0a', borderRadius: 8, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#f06060',
  },
  expansionTextRed: { fontSize: fscale(13), color: '#f09090', lineHeight: 19 },
  expansionGreen: {
    marginTop: 12, backgroundColor: '#0d1a07', borderRadius: 8, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#b8f058',
  },
  expansionTextGreen: { fontSize: fscale(13), color: '#a0d060', lineHeight: 19 },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0d1a07', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#b8f05840',
  },
  comingSoonBadge: { backgroundColor: '#1a1a1a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  comingSoonText: { fontSize: fscale(9), color: '#aaa', letterSpacing: 2, fontFamily: 'DMMono_400Regular' },
  comingSoonSub: { fontSize: fscale(8), color: '#555', fontFamily: 'DMMono_400Regular', marginTop: 2 },
  summaryIcon: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#b8f058', marginTop: 4, marginRight: 4 },
  summaryTitle: { fontSize: fscale(14), fontWeight: '700', color: '#b8f058' },
  summarySub: { fontSize: fscale(12), color: '#6a9030', marginTop: 2 },

  soundRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  soundChip: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10,
    backgroundColor: '#1a1a1a', borderRadius: 10,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  soundChipActive: { backgroundColor: '#0d1a07', borderColor: '#b8f058' },
  soundEmoji: { fontSize: fscale(18) },
  soundLabel: { fontSize: fscale(10), color: '#aaa', fontFamily: 'DMMono_400Regular', letterSpacing: 0.5 },
  soundLabelActive: { color: '#b8f058' },
  statsCard: {
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#222',
  },
  statsCardLabel: { fontSize: fscale(11), letterSpacing: 1.5, color: '#aaa', fontFamily: 'DMMono_400Regular', marginBottom: 14 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statNum: { fontSize: fscale(28), color: '#fff', fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  statLbl: { fontSize: fscale(8), color: '#aaa', fontFamily: 'DMMono_400Regular', letterSpacing: 1, textAlign: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: '#1a1a1a' },
});
