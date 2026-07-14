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

// Steps: 0=Quiz, 1=Coach, 2=Identity, 3=Commit
const TOTAL_STEPS = 4;

const COACHES = [
  { id: 'stoic_mentor',   name: 'Stoic Mentor',  color: '#b8f058', tag: 'Measured. Marcus.' },
  { id: 'drill_sergeant', name: 'Drill Sergeant', color: '#f06060', tag: 'No excuses, monk.' },
  { id: 'anime_sensei',   name: 'Anime Sensei',   color: '#7b6af0', tag: 'Unleash your arc.' },
  { id: 'goggins',        name: 'Stay Hard',       color: '#f5c840', tag: "Who's gonna carry?" },
  { id: 'ceo_coach',      name: 'CEO Coach',       color: '#40f5c8', tag: 'Ship. Iterate. Win.' },
  { id: 'calm_therapist', name: 'Calm Therapist', color: '#f0a060', tag: "You're doing great." },
];

const QUIZ_QUESTIONS = [
  {
    key: 'q1',
    question: 'How do you work best?',
    options: [
      { value: 'structured',  label: 'Structured routine',   sub: 'Same time, same place, every day' },
      { value: 'spontaneous', label: 'Spontaneous flow',     sub: 'I move when the energy hits' },
      { value: 'balanced',    label: 'Somewhere in between', sub: 'Depends on the week' },
    ],
  },
  {
    key: 'q2',
    question: "What trips you up most?",
    options: [
      { value: 'starting',    label: 'Getting started',  sub: 'Procrastination kills my momentum' },
      { value: 'finishing',   label: 'Finishing things', sub: 'I start a lot, complete less' },
      { value: 'distraction', label: 'Staying focused',  sub: 'Too many tabs, too many ideas' },
      { value: 'burnout',     label: 'Going too hard',   sub: 'I overdo it, then crash' },
    ],
  },
  {
    key: 'q3',
    question: 'What kind of push do you need?',
    options: [
      { value: 'hard',   label: 'Push me hard',       sub: 'No hand-holding. Get it done.' },
      { value: 'steady', label: 'Keep me consistent', sub: 'Measured, sustainable progress' },
      { value: 'gentle', label: 'Go easy on me',      sub: 'Encouragement over pressure' },
    ],
  },
] as const;

type QuizKey = 'q1' | 'q2' | 'q3';

function getRecommendation(q1: string, q2: string, q3: string): string {
  if (q3 === 'gentle') return 'calm_therapist';
  if (q3 === 'hard') {
    if (q2 === 'burnout') return 'ceo_coach';
    if (q2 === 'finishing') return 'drill_sergeant';
    return 'goggins';
  }
  // steady
  if (q1 === 'spontaneous' || q2 === 'distraction') return 'anime_sensei';
  if (q2 === 'burnout') return 'calm_therapist';
  return 'stoic_mentor';
}

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
  const [step, setStep]               = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<QuizKey, string>>({ q1: '', q2: '', q3: '' });
  const [personality, setPersonality] = useState('stoic_mentor');
  const [identity, setIdentity]       = useState('');
  const [saving, setSaving]           = useState(false);

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

  const handleQuizContinue = () => {
    const rec = getRecommendation(quizAnswers.q1, quizAnswers.q2, quizAnswers.q3);
    setPersonality(rec);
    goTo(1);
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
        await scheduleDailyReminders(
          times.morningH, times.morningM,
          times.eveningH, times.eveningM,
          personality as any,
        ).catch(() => {});
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('App');
    } catch (err: any) {
      Alert.alert('Something went wrong', err?.message ?? 'Could not save your profile. Check connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const quizComplete = !!(quizAnswers.q1 && quizAnswers.q2 && quizAnswers.q3);
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

        {/* ── Step 0: Quiz ──────────────────────────────────────────────── */}
        {step === 0 && (
          <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.stepHeader}>
              <Text style={s.stepEyebrow}>STEP 1 OF 4</Text>
              <Text style={s.heading}>Find your{'\n'}coach.</Text>
              <Text style={s.sub}>Three questions. We'll match you with the right voice.</Text>
            </View>

            {QUIZ_QUESTIONS.map((q, qi) => (
              <View key={q.key} style={s.quizBlock}>
                <Text style={s.quizQ}>
                  <Text style={s.quizNum}>{qi + 1}{'  '}</Text>
                  {q.question}
                </Text>
                <View style={s.quizOptions}>
                  {q.options.map(opt => {
                    const selected = quizAnswers[q.key as QuizKey] === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.quizOpt, selected && s.quizOptSelected]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setQuizAnswers(prev => ({ ...prev, [q.key]: opt.value }));
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[s.quizRadio, selected && s.quizRadioSelected]} />
                        <View style={s.quizOptText}>
                          <Text style={[s.quizOptLabel, selected && s.quizOptLabelSelected]}>{opt.label}</Text>
                          <Text style={s.quizOptSub}>{opt.sub}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[s.cta, !quizComplete && s.ctaDisabled]}
              onPress={handleQuizContinue}
              disabled={!quizComplete}
              activeOpacity={0.85}
            >
              <Text style={s.ctaText}>See my match →</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {/* ── Step 1: Coach picker ──────────────────────────────────────── */}
        {step === 1 && (
          <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.stepHeader}>
              <Text style={s.stepEyebrow}>STEP 2 OF 4</Text>
              <Text style={s.heading}>Your match.</Text>
              <Text style={s.sub}>
                We recommend{' '}
                <Text style={{ color: selectedCoach.color, fontFamily: 'Syne_800ExtraBold' }}>{selectedCoach.name}</Text>
                {' '}based on your answers. Swap anytime.
              </Text>
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

            <TouchableOpacity style={s.cta} onPress={() => goTo(2)} activeOpacity={0.85}>
              <Text style={s.ctaText}>Continue →</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {/* ── Step 2: Identity ─────────────────────────────────────────── */}
        {step === 2 && (
          <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.stepHeader}>
              <Text style={s.stepEyebrow}>STEP 3 OF 4</Text>
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

            <TouchableOpacity style={[s.cta, { marginTop: 16 }]} onPress={() => goTo(3)} activeOpacity={0.85}>
              <Text style={s.ctaText}>Continue →</Text>
            </TouchableOpacity>
            {!identity.trim() && (
              <TouchableOpacity style={s.skipBtn} onPress={() => goTo(3)}>
                <Text style={s.skipText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* ── Step 3: Commit ───────────────────────────────────────────── */}
        {step === 3 && (
          <View style={s.commitWrap}>
            <View style={s.commitContent}>
              <Text style={[s.stepEyebrow, { textAlign: 'center' }]}>STEP 4 OF 4 · COMMITMENT</Text>
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
  backText: { fontSize: fscale(22), color: '#b8f058' },
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

  // Quiz
  quizBlock: { marginBottom: 28 },
  quizQ: {
    fontSize: fscale(15), color: '#fff', fontFamily: 'Syne_800ExtraBold',
    marginBottom: 12, lineHeight: fscale(22),
  },
  quizNum: {
    fontSize: fscale(10), color: '#b8f058', fontFamily: 'DMMono_400Regular',
    letterSpacing: 1,
  },
  quizOptions: { gap: 8 },
  quizOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#111', borderRadius: 12, padding: scale(14),
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  quizOptSelected: { borderColor: '#b8f05860', backgroundColor: '#b8f05808' },
  quizRadio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: '#333',
  },
  quizRadioSelected: { borderColor: '#b8f058', backgroundColor: '#b8f058' },
  quizOptText: { flex: 1 },
  quizOptLabel: { fontSize: fscale(14), color: '#aaaaaa', fontWeight: '600', marginBottom: 2 },
  quizOptLabelSelected: { color: '#fff' },
  quizOptSub: { fontSize: fscale(11), color: '#555', lineHeight: fscale(16) },

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
  coachCheckMark: { fontSize: fscale(11), color: '#0a0a0a', fontWeight: '800' },
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
  commitIcon: { fontSize: fscale(28), color: '#b8f058' },
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
