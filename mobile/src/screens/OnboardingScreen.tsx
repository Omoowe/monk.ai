import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { requestNotificationPermission, scheduleDailyReminders, getNotificationTimes } from '../services/notifications';
import { fscale, scale } from '../utils/scale';

type Props = { navigation: NativeStackNavigationProp<any> };

// Steps: 0=Coach, 1=Identity, 2=Commit
const TOTAL_STEPS = 3;

const COACHES = [
  { id: 'stoic_mentor',   name: 'Stoic Mentor',  color: '#b8f058', tag: 'Measured. Marcus.' },
  { id: 'drill_sergeant', name: 'Drill Sergeant', color: '#f06060', tag: 'No excuses, monk.' },
  { id: 'anime_sensei',   name: 'Anime Sensei',   color: '#7b6af0', tag: 'Unleash your arc.' },
  { id: 'goggins',        name: 'Stay Hard',       color: '#f5c840', tag: "Who's gonna carry?" },
  { id: 'ceo_coach',      name: 'CEO Coach',       color: '#40f5c8', tag: 'Ship. Iterate. Win.' },
  { id: 'calm_therapist', name: 'Calm Therapist', color: '#f0a060', tag: "You're doing great." },
];

const IDENTITY_EXAMPLES = [
  'I am a runner who never skips Mondays.',
  'I am the kind of person who keeps promises to themselves.',
  'I am a writer who shows up before sunrise.',
];

const COMMIT_POINTS = [
  'Two check-ins a day. Morning and night.',
  'I tell the truth, even when it stings.',
  'I show up — even on bad days. Especially then.',
];

export default function OnboardingScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const [step, setStep]             = useState(0);
  const [personality, setPersonality] = useState('stoic_mentor');
  const [identity, setIdentity]     = useState('');
  const [saving, setSaving]         = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const coachScaleAnims = useRef<Record<string, Animated.Value>>({});
  const getCoachAnim = (id: string): Animated.Value => {
    if (!coachScaleAnims.current[id]) coachScaleAnims.current[id] = new Animated.Value(1);
    return coachScaleAnims.current[id];
  };

  const goTo = (next: number) => {
    const forward = next > step;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: forward ? -width * 0.2 : width * 0.2, duration: 160, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(forward ? width * 0.2 : -width * 0.2);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('users').upsert({
        id: user.id,
        personality,
        identity_statement: identity.trim(),
        onboarding_done: true,
        streak: 0,
        dopamine_score: 50,
      }, { onConflict: 'id' });

      if (error) throw error;

      const granted = await requestNotificationPermission();
      if (granted) {
        const times = await getNotificationTimes();
        await scheduleDailyReminders(times.morningH, times.morningM, times.eveningH, times.eveningM).catch(() => {});
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('App');
    } catch (err: any) {
      Alert.alert('Something went wrong', err?.message ?? 'Could not save your profile. Check connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCoach = COACHES.find(c => c.id === personality)!;

  return (
    <SafeAreaView style={s.container}>
      {/* Progress header */}
      <View style={s.header}>
        {step > 0 ? (
          <TouchableOpacity style={s.backBtn} onPress={() => goTo(step - 1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
        ) : <View style={s.backBtn} />}
        <View style={s.progressBar}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[s.progressSeg, i < step && s.progressDone, i === step && s.progressActive]} />
          ))}
        </View>
        <View style={s.backBtn} />
      </View>

      <Animated.View style={[s.animWrap, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>

        {/* ── Step 0: Coach picker ──────────────────────────────────────── */}
        {step === 0 && (
          <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.stepHeader}>
              <Text style={s.stepEyebrow}>STEP 1 OF 3</Text>
              <Text style={s.heading}>Pick your{'\n'}coach.</Text>
              <Text style={s.sub}>You can swap them out anytime. Each shapes the tone of every reply.</Text>
            </View>

            <View style={s.coachGrid}>
              {COACHES.map(c => {
                const selected = personality === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={s.coachCardWrap}
                    onPress={() => {
                      setPersonality(c.id);
                      Haptics.selectionAsync();
                      const anim = getCoachAnim(c.id);
                      anim.setValue(0.97);
                      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 220 }).start();
                    }}
                    activeOpacity={0.85}
                  >
                    <Animated.View style={[s.coachCard, { transform: [{ scale: getCoachAnim(c.id) }] }]}>
                      {selected && <View style={[s.coachAccentBar, { backgroundColor: c.color }]} />}
                      {selected && (
                        <View style={[s.coachCheck, { backgroundColor: c.color }]}>
                          <Text style={s.coachCheckMark}>✓</Text>
                        </View>
                      )}
                      <View style={[s.coachColorBar, { backgroundColor: c.color + '33' }]}>
                        <View style={[s.coachColorBarInner, { backgroundColor: c.color }]} />
                      </View>
                      <Text style={[s.coachName, selected && { color: c.color }]}>{c.name}</Text>
                      <Text style={s.coachTag}>{c.tag}</Text>
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={s.cta} onPress={() => goTo(1)} activeOpacity={0.85}>
              <Text style={s.ctaText}>Continue →</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {/* ── Step 1: Identity ─────────────────────────────────────────── */}
        {step === 1 && (
          <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.stepHeader}>
              <Text style={s.stepEyebrow}>STEP 2 OF 3</Text>
              <Text style={s.heading}>Who are you becoming?</Text>
              <Text style={s.sub}>Write it like it's already true. We'll remind you, every day.</Text>
            </View>

            <View style={s.identityWrap}>
              <TextInput
                style={s.identityInput}
                placeholder="I am a calm, focused builder who ships every day..."
                placeholderTextColor="#444"
                value={identity}
                onChangeText={t => { if (t.length <= 140) setIdentity(t); }}
                multiline
                textAlignVertical="top"
                autoFocus
                maxLength={140}
              />
              <Text style={s.charCount}>{identity.length} / 140</Text>
            </View>

            <Text style={s.examplesLabel}>EXAMPLES</Text>
            {IDENTITY_EXAMPLES.map((ex, i) => (
              <TouchableOpacity
                key={i}
                style={s.exampleChip}
                onPress={() => setIdentity(ex)}
                activeOpacity={0.7}
              >
                <Text style={s.exampleText}>{ex}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[s.cta, { marginTop: 16 }]} onPress={() => goTo(2)} activeOpacity={0.85}>
              <Text style={s.ctaText}>Continue →</Text>
            </TouchableOpacity>
            {!identity.trim() && (
              <TouchableOpacity style={s.skipBtn} onPress={() => goTo(2)}>
                <Text style={s.skipText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* ── Step 2: Commit ───────────────────────────────────────────── */}
        {step === 2 && (
          <View style={s.commitWrap}>
            <View style={s.commitContent}>
              <Text style={[s.stepEyebrow, { textAlign: 'center' }]}>STEP 3 OF 3 · COMMITMENT</Text>
              <View style={s.commitIconWrap}>
                <Text style={s.commitIcon}>✦</Text>
              </View>
              <Text style={s.commitHeading}>
                I commit to{'\n'}showing{' '}
                <Text style={s.commitLime}>up.</Text>
              </Text>
              <View style={s.commitPoints}>
                {COMMIT_POINTS.map((pt, i) => (
                  <View key={i} style={s.commitPointRow}>
                    <Text style={s.commitPointNum}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={s.commitPointText}>{pt}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={s.commitFooter}>
              <TouchableOpacity
                style={[s.cta, saving && s.ctaDisabled]}
                onPress={handleFinish}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#0a0a0a" />
                  : <Text style={s.ctaText}>✦  Begin</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backText: { fontSize: 22, color: '#b8f058' },
  progressBar: { flex: 1, flexDirection: 'row', gap: 5 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#1e1e1e' },
  progressDone:   { backgroundColor: '#3a5a12' },
  progressActive: { backgroundColor: '#b8f058' },

  animWrap: { flex: 1 },
  stepScroll: { padding: 24, paddingBottom: 16 },
  stepHeader: { marginBottom: 14 },

  stepEyebrow: {
    fontSize: fscale(10), color: '#b8f058', fontFamily: 'DMMono_400Regular',
    letterSpacing: 2, marginBottom: 14,
  },
  heading: {
    fontSize: fscale(30), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', lineHeight: fscale(36),
    letterSpacing: -0.5, marginBottom: 10,
  },
  sub: { fontSize: fscale(14), color: '#888', lineHeight: fscale(22) },

  // Coach grid
  coachGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28,
  },
  coachCardWrap: { width: '47%' },
  coachCard: {
    flex: 1, backgroundColor: '#111', borderRadius: 14,
    padding: scale(16), borderWidth: 1, borderColor: '#252525',
    position: 'relative', overflow: 'hidden',
  },
  coachAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
  },
  coachCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  coachCheckMark: { fontSize: 11, color: '#0a0a0a', fontWeight: '800' },
  coachColorBar: { height: 4, borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  coachColorBarInner: { width: 24, height: 4, borderRadius: 2 },
  coachName: {
    fontSize: fscale(14), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', marginBottom: 4,
  },
  coachTag: { fontSize: fscale(11), color: '#666' },

  // Identity
  identityWrap: { marginBottom: 12 },
  identityInput: {
    backgroundColor: '#111', borderRadius: 12, borderWidth: 1.5, borderColor: '#b8f05860',
    padding: scale(14), color: '#fff', fontSize: fscale(16), lineHeight: fscale(24),
    minHeight: scale(90), textAlignVertical: 'top',
  },
  charCount: {
    fontSize: fscale(10), color: '#444', fontFamily: 'DMMono_400Regular',
    textAlign: 'right', marginTop: 8,
  },
  examplesLabel: {
    fontSize: fscale(9), color: '#555', fontFamily: 'DMMono_400Regular',
    letterSpacing: 2, marginBottom: 10,
  },
  exampleChip: {
    backgroundColor: '#111', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#1e1e1e', marginBottom: 6,
  },
  exampleText: { fontSize: fscale(13), color: '#666', fontStyle: 'italic', lineHeight: fscale(20) },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: fscale(13), color: '#444', fontFamily: 'DMMono_400Regular' },

  // Commit screen
  commitWrap: { flex: 1, justifyContent: 'space-between', paddingBottom: 40 },
  commitContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  commitIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1.5, borderColor: '#b8f058',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32, marginTop: 16,
  },
  commitIcon: { fontSize: 28, color: '#b8f058' },
  commitHeading: {
    fontSize: fscale(36), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', lineHeight: fscale(44),
    textAlign: 'center', marginBottom: 36,
  },
  commitLime: { color: '#b8f058' },
  commitPoints: { gap: 20, alignSelf: 'stretch' },
  commitPointRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  commitPointNum: {
    fontSize: fscale(11), color: '#b8f058', fontFamily: 'DMMono_400Regular',
    fontWeight: '700', minWidth: 20, marginTop: 2,
  },
  commitPointText: { fontSize: fscale(14), color: '#aaa', lineHeight: fscale(22), flex: 1 },
  commitFooter: { paddingHorizontal: 24 },

  // CTA
  cta: {
    backgroundColor: '#b8f058', borderRadius: 14, paddingVertical: scale(20),
    alignItems: 'center', justifyContent: 'center', minHeight: scale(58),
  },
  ctaText: { fontSize: fscale(17), fontWeight: '700', color: '#0a0a0a', fontFamily: 'Syne_800ExtraBold' },
  ctaDisabled: { opacity: 0.4 },
});
