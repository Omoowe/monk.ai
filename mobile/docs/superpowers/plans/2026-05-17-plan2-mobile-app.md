# Mobile App UI & Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all 6 screens to match the `monk-ai_4.html` prototype, add onboarding flow, Monk Mode panel, and voice input.

**Architecture:** All changes are within `mobile/`. No new deps beyond `expo-font`, `@expo-google-fonts/syne`, `@expo-google-fonts/dm-mono`, and `@react-native-voice/voice`. Plan 1 (edge functions) must be complete before starting.

**Tech Stack:** Expo SDK 54, React Native 0.76, `@react-navigation/native`, `expo-font`, `@expo-google-fonts/*`, `@react-native-voice/voice`

---

## File Map

**Create:**
- `mobile/src/screens/OnboardingScreen.tsx`

**Modify:**
- `mobile/App.tsx` — font loading + onboarding gate
- `mobile/src/screens/CoachScreen.tsx` — header restyle + Monk Mode panel + voice input
- `mobile/src/screens/CheckInScreen.tsx` — full restyle
- `mobile/src/screens/HabitsScreen.tsx` — full restyle
- `mobile/src/screens/GoalsScreen.tsx` — full restyle
- `mobile/src/screens/StatsScreen.tsx` — full restyle
- `mobile/src/screens/ReviewScreen.tsx` — full restyle

---

## Design tokens (reference for all tasks)

```typescript
// Colours
const BG = '#0a0a0a';
const SURFACE = '#111111';
const BORDER = '#222222';
const TEXT = '#ffffff';
const MUTED = '#666666';
const ACCENT = '#b8f058'; // stoic_mentor green — default

// Personality colours
const PERSONALITY_COLORS: Record<string, string> = {
  drill_sergeant: '#f06060',
  stoic_mentor:   '#b8f058',
  anime_sensei:   '#7b6af0',
  goggins:        '#f5c840',
  ceo_coach:      '#40f5c8',
  calm_therapist: '#f0a060',
};

// Rank thresholds (StatsScreen)
function getRank(score: number): string {
  if (score >= 86) return 'Monk Elite';
  if (score >= 61) return 'Disciplined';
  if (score >= 31) return 'Rising Force';
  return 'Starting Out';
}
```

---

## Task 1: Install fonts

**Files:**
- Modify: `mobile/package.json` (via install)

- [ ] **Step 1: Install font packages**

```bash
cd /Users/hafee/Documents/Claude/Monk/mobile
npx expo install expo-font @expo-google-fonts/syne @expo-google-fonts/dm-mono
```

Expected: packages added to `node_modules/` and `package.json`.

- [ ] **Step 2: Install voice input package**

```bash
cd /Users/hafee/Documents/Claude/Monk/mobile
npx expo install @react-native-voice/voice
```

Expected: package added. Note: requires `npx expo prebuild` for bare workflow or EAS build for voice on device. Simulator will not support voice.

- [ ] **Step 3: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add package.json package-lock.json
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "chore: install expo-font, google fonts, voice packages"
```

---

## Task 2: App.tsx — font loading + onboarding gate

**Files:**
- Modify: `mobile/App.tsx`

- [ ] **Step 1: Update App.tsx**

Replace the entire contents of `mobile/App.tsx` with:

```typescript
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono';
import { supabase } from './src/lib/supabase';
import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CoachScreen from './src/screens/CoachScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import HabitsScreen from './src/screens/HabitsScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import StatsScreen from './src/screens/StatsScreen';
import ReviewScreen from './src/screens/ReviewScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#222', height: 60 },
        tabBarActiveTintColor: '#b8f058',
        tabBarInactiveTintColor: '#444',
        tabBarLabelStyle: { fontSize: 10, fontFamily: 'DMMono_400Regular', marginBottom: 4 },
      }}
    >
      <Tab.Screen name="Coach"   component={CoachScreen}   options={{ tabBarLabel: '🧘 Coach' }} />
      <Tab.Screen name="CheckIn" component={CheckInScreen} options={{ tabBarLabel: '📋 Check-In' }} />
      <Tab.Screen name="Habits"  component={HabitsScreen}  options={{ tabBarLabel: '✅ Habits' }} />
      <Tab.Screen name="Goals"   component={GoalsScreen}   options={{ tabBarLabel: '🎯 Goals' }} />
      <Tab.Screen name="Stats"   component={StatsScreen}   options={{ tabBarLabel: '📊 Stats' }} />
      <Tab.Screen name="Review"  component={ReviewScreen}  options={{ tabBarLabel: '📝 Review' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [appLoading, setAppLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    DMMono_400Regular,
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('onboarding_done')
          .eq('id', session.user.id)
          .single();
        setOnboardingDone(data?.onboarding_done ?? false);
      }
      setAppLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('onboarding_done')
          .eq('id', session.user.id)
          .single();
        setOnboardingDone(data?.onboarding_done ?? false);
      } else {
        setOnboardingDone(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (!fontsLoaded || appLoading) return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !onboardingDone ? (
          <Stack.Screen name="Onboarding">
            {() => <OnboardingScreen onComplete={() => setOnboardingDone(true)} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="App" component={AppTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: Run app and verify fonts + routing work**

```bash
cd /Users/hafee/Documents/Claude/Monk/mobile && npx expo start
```

Open iOS simulator. Verify: app shows black splash until fonts load, then goes to Login. If already logged in with `onboarding_done = false`, should show OnboardingScreen (which doesn't exist yet — it will crash until Task 3 is done).

- [ ] **Step 3: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add App.tsx
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "feat: add font loading and onboarding gate to App.tsx"
```

---

## Task 3: OnboardingScreen

**Files:**
- Create: `mobile/src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Create OnboardingScreen.tsx**

```typescript
// mobile/src/screens/OnboardingScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

const PERSONALITIES = [
  { id: 'drill_sergeant', name: 'Drill Sergeant', color: '#f06060', emoji: '🪖', vibe: 'No excuses. No rest. Only results.' },
  { id: 'stoic_mentor',   name: 'Stoic Mentor',   color: '#b8f058', emoji: '📜', vibe: 'What would Marcus Aurelius do?' },
  { id: 'anime_sensei',   name: 'Anime Sensei',   color: '#7b6af0', emoji: '⚡', vibe: 'This is your power-up arc.' },
  { id: 'goggins',        name: 'Stay Hard',      color: '#f5c840', emoji: '🔥', vibe: 'Callus your mind. Do the work.' },
  { id: 'ceo_coach',      name: 'CEO Coach',      color: '#40f5c8', emoji: '📈', vibe: 'Your time has ROI. Act like it.' },
  { id: 'calm_therapist', name: 'Calm Therapist', color: '#f0a060', emoji: '🌿', vibe: 'Compassion without excuses.' },
];

type Step = 'name' | 'personality' | 'identity';

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('stoic_mentor');
  const [identity, setIdentity] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCompleteName = () => {
    if (!name.trim()) return;
    setStep('personality');
  };

  const handleCompletePersonality = () => {
    setStep('identity');
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        name: name.trim(),
        personality,
        identity_statement: identity.trim(),
        onboarding_done: true,
      }, { onConflict: 'id' });
      onComplete();
    } catch (err) {
      console.error('Onboarding failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedPersonality = PERSONALITIES.find(p => p.id === personality)!;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {step === 'name' && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>MONK.AI</Text>
            <Text style={styles.title}>What do I call you?</Text>
            <Text style={styles.subtitle}>No nicknames. The name you hold yourself to.</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#444"
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleCompleteName}
            />
            <TouchableOpacity
              style={[styles.cta, !name.trim() && styles.ctaDisabled]}
              onPress={handleCompleteName}
              disabled={!name.trim()}
            >
              <Text style={styles.ctaText}>That's me →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'personality' && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>STEP 2 OF 3</Text>
            <Text style={styles.title}>Pick your coach, {name}.</Text>
            <Text style={styles.subtitle}>They don't let you quit.</Text>
            <View style={styles.personalityGrid}>
              {PERSONALITIES.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.personalityCard, personality === p.id && { borderColor: p.color, borderWidth: 2 }]}
                  onPress={() => setPersonality(p.id)}
                >
                  <Text style={styles.personalityEmoji}>{p.emoji}</Text>
                  <Text style={[styles.personalityName, personality === p.id && { color: p.color }]}>{p.name}</Text>
                  <Text style={styles.personalityVibe}>{p.vibe}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.cta} onPress={handleCompletePersonality}>
              <Text style={styles.ctaText}>Lock in {selectedPersonality.name} →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'identity' && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>STEP 3 OF 3</Text>
            <Text style={styles.title}>Who are you becoming?</Text>
            <Text style={styles.subtitle}>Complete this: "I am the type of person who..."</Text>
            <TextInput
              style={[styles.input, styles.identityInput]}
              placeholder="follows through on hard things"
              placeholderTextColor="#444"
              value={identity}
              onChangeText={setIdentity}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={[styles.cta, loading && styles.ctaDisabled]}
              onPress={handleCompleteOnboarding}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#0a0a0a" />
                : <Text style={styles.ctaText}>Let's get to work →</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCompleteOnboarding} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flexGrow: 1, padding: 24, paddingTop: 48 },
  stepContainer: { flex: 1 },
  label: { fontSize: 10, letterSpacing: 4, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 12 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', lineHeight: 38, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32, lineHeight: 20 },
  input: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#333',
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 18, marginBottom: 16,
  },
  identityInput: { height: 100, textAlignVertical: 'top' },
  cta: {
    backgroundColor: '#b8f058', borderRadius: 8, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: '#0a0a0a', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  personalityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  personalityCard: {
    width: '47%', backgroundColor: '#111', borderRadius: 10,
    padding: 14, borderWidth: 1, borderColor: '#222',
  },
  personalityEmoji: { fontSize: 24, marginBottom: 6 },
  personalityName: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 4 },
  personalityVibe: { fontSize: 11, color: '#666', lineHeight: 15 },
  skipButton: { alignItems: 'center', paddingVertical: 16 },
  skipText: { color: '#444', fontSize: 13 },
});
```

- [ ] **Step 2: Verify onboarding flow end-to-end**

Log out of the app (or use a fresh account with `onboarding_done = false`). Log in. Verify:
1. Name step shows
2. Personality step shows with 6 cards, selected card has colored border
3. Identity step shows, "Skip for now" works
4. After completion: `users` row in Supabase has `name`, `personality`, `identity_statement`, `onboarding_done = true`
5. Main app loads after completion

- [ ] **Step 3: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add src/screens/OnboardingScreen.tsx
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "feat: add onboarding screen (name, coach picker, identity)"
```

---

## Task 4: CoachScreen restyle + header + Monk Mode panel

**Files:**
- Modify: `mobile/src/screens/CoachScreen.tsx`

- [ ] **Step 1: Replace CoachScreen styles and header**

After the existing logic (keeping all handlers from Plan 1), replace the JSX `return` statement and `styles` object entirely:

```typescript
// Add new state at top of component (after existing state):
const [monkMode, setMonkMode] = useState(false);
const [personalityColor, setPersonalityColor] = useState('#b8f058');

// Add to loadChatHistory() after fetching user:
// (inside the existing try block, after getting user)
const { data: userData } = await supabase
  .from('users')
  .select('personality, monk_mode')
  .eq('id', user.id)
  .single();
const pColor = PERSONALITY_COLORS[userData?.personality ?? 'stoic_mentor'] ?? '#b8f058';
setPersonalityColor(pColor);
setMonkMode(userData?.monk_mode ?? false);

// Add PERSONALITY_COLORS constant above component:
const PERSONALITY_COLORS: Record<string, string> = {
  drill_sergeant: '#f06060', stoic_mentor: '#b8f058',
  anime_sensei: '#7b6af0', goggins: '#f5c840',
  ceo_coach: '#40f5c8', calm_therapist: '#f0a060',
};

// Add toggleMonkMode handler:
const toggleMonkMode = async () => {
  const newMode = !monkMode;
  setMonkMode(newMode);
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from('users').update({ monk_mode: newMode }).eq('id', user.id);
};
```

Replace the `return` JSX:

```typescript
return (
  <SafeAreaView style={styles.container}>
    {/* Header */}
    <View style={styles.header}>
      <Text style={styles.wordmark}>
        Monk<Text style={{ color: personalityColor }}>.</Text>ai
      </Text>
      <TouchableOpacity
        style={[styles.monkModeButton, monkMode && { backgroundColor: `${personalityColor}20`, borderColor: personalityColor }]}
        onPress={toggleMonkMode}
      >
        <Text style={[styles.monkModeText, monkMode && { color: personalityColor }]}>
          {monkMode ? '🧘 Monk' : '🔓 Focus'}
        </Text>
      </TouchableOpacity>
    </View>

    {/* Monk Mode panel */}
    {monkMode && (
      <View style={[styles.monkPanel, { borderColor: `${personalityColor}30` }]}>
        {['Block Distractions', 'Dopamine Detox Timer', 'No Excuses Mode', 'Strict Daily Goals'].map(item => (
          <View key={item} style={styles.monkPanelRow}>
            <View style={[styles.monkPanelDot, { backgroundColor: personalityColor }]} />
            <Text style={styles.monkPanelText}>{item}</Text>
          </View>
        ))}
      </View>
    )}

    {/* Chat list */}
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={item => item.id}
      onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      contentContainerStyle={styles.messageList}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your coach has been watching.</Text>
          <Text style={styles.emptySubtext}>Say something. Don't hide.</Text>
        </View>
      }
    />

    {/* Input area */}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inputArea}>
      <TouchableOpacity
        style={[styles.pepTalkButton, { backgroundColor: personalityColor }, (loadingPepTalk || loading) && styles.disabled]}
        onPress={handlePepTalk}
        disabled={loadingPepTalk || loading}
      >
        {loadingPepTalk
          ? <ActivityIndicator color="#0a0a0a" size="small" />
          : <Text style={styles.pepTalkText}>⚡ Pep talk</Text>
        }
      </TouchableOpacity>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message your coach..."
          placeholderTextColor="#444"
          value={input}
          onChangeText={setInput}
          editable={!loading}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: personalityColor }, (loading || !input.trim()) && styles.disabled]}
          onPress={handleSendMessage}
          disabled={loading || !input.trim()}
        >
          {loading
            ? <ActivityIndicator color="#0a0a0a" size="small" />
            : <Text style={styles.sendText}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
```

Update `renderMessage` to use personality color for AI bubble border:

```typescript
const renderMessage = ({ item }: { item: Message }) => (
  <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : [styles.aiBubble, { borderLeftColor: personalityColor }]]}>
    <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.aiText]}>
      {item.text}
    </Text>
    <Text style={styles.timestamp}>
      {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </Text>
  </View>
);
```

Replace `styles` entirely:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222',
  },
  wordmark: { fontSize: 18, fontWeight: '900', color: '#fff', fontFamily: 'Syne_800ExtraBold', letterSpacing: -0.5 },
  monkModeButton: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#333', backgroundColor: '#111',
  },
  monkModeText: { fontSize: 12, color: '#666', fontFamily: 'DMMono_400Regular' },
  monkPanel: {
    backgroundColor: '#0d0d0d', borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: '#222', paddingHorizontal: 20, paddingVertical: 12, gap: 8,
  },
  monkPanelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monkPanelDot: { width: 6, height: 6, borderRadius: 3 },
  monkPanelText: { fontSize: 12, color: '#aaa', fontFamily: 'DMMono_400Regular' },
  messageList: { flexGrow: 1, padding: 16, gap: 10 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Syne_700Bold', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#444' },
  bubble: { maxWidth: '85%', marginBottom: 4 },
  userBubble: {
    alignSelf: 'flex-end', backgroundColor: '#b8f058',
    borderRadius: 12, padding: 12,
  },
  aiBubble: {
    alignSelf: 'flex-start', backgroundColor: '#111',
    borderRadius: 12, padding: 12, borderLeftWidth: 3,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#0a0a0a' },
  aiText: { color: '#fff' },
  timestamp: { fontSize: 11, color: '#555', marginTop: 4 },
  inputArea: { borderTopWidth: 1, borderTopColor: '#222', padding: 12, gap: 8 },
  pepTalkButton: {
    height: 40, borderRadius: 8, justifyContent: 'center',
    alignItems: 'center', marginBottom: 4,
  },
  pepTalkText: { fontSize: 13, fontWeight: '700', color: '#0a0a0a', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: {
    flex: 1, backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#222',
    paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14, maxHeight: 100,
  },
  sendButton: { width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sendText: { fontSize: 18, color: '#0a0a0a', fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
```

- [ ] **Step 2: Verify in simulator**

Run app. Open Coach tab. Verify:
- Header shows "Monk.ai" wordmark with personality-colored dot
- Monk Mode toggle button in header
- Tapping toggle shows/hides panel with 4 rows
- AI bubbles have colored left border
- User bubbles are accent-colored
- Empty state shows "Your coach has been watching."

- [ ] **Step 3: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add src/screens/CoachScreen.tsx
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "feat: restyle CoachScreen with monk mode panel"
```

---

## Task 5: CoachScreen voice input

**Files:**
- Modify: `mobile/src/screens/CoachScreen.tsx`

- [ ] **Step 1: Add voice state and handlers**

Add at top of component (after existing state declarations):

```typescript
const [isListening, setIsListening] = useState(false);
const [voiceAvailable, setVoiceAvailable] = useState(false);
```

Add import at top of file:

```typescript
import Voice, { SpeechResultsEvent } from '@react-native-voice/voice';
```

Add `useEffect` for Voice setup (inside component, after existing useEffect):

```typescript
useEffect(() => {
  Voice.isAvailable().then(available => setVoiceAvailable(!!available));
  Voice.onSpeechResults = (e: SpeechResultsEvent) => {
    const transcript = e.value?.[0] ?? '';
    if (transcript) setInput(prev => prev + (prev ? ' ' : '') + transcript);
    setIsListening(false);
  };
  Voice.onSpeechError = () => setIsListening(false);
  return () => { Voice.destroy().then(Voice.removeAllListeners); };
}, []);
```

Add voice handler:

```typescript
const toggleVoice = async () => {
  if (isListening) {
    await Voice.stop();
    setIsListening(false);
  } else {
    try {
      await Voice.start('en-US');
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }
};
```

- [ ] **Step 2: Add mic button to inputRow JSX**

Inside `inputRow`, add before `sendButton`:

```typescript
{voiceAvailable && (
  <TouchableOpacity
    style={[styles.micButton, isListening && { backgroundColor: '#f06060' }]}
    onPress={toggleVoice}
  >
    <Text style={styles.micText}>{isListening ? '⏹' : '🎙'}</Text>
  </TouchableOpacity>
)}
```

Add to `styles`:

```typescript
micButton: {
  width: 44, height: 44, borderRadius: 8, justifyContent: 'center',
  alignItems: 'center', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333',
},
micText: { fontSize: 18 },
```

Show "Listening…" when active — add above `inputRow`:

```typescript
{isListening && (
  <Text style={{ color: '#b8f058', fontSize: 12, fontFamily: 'DMMono_400Regular', marginBottom: 4 }}>
    Listening…
  </Text>
)}
```

- [ ] **Step 3: Verify on physical device**

Voice requires a real device. On simulator: mic button will be hidden (`voiceAvailable = false`). On device: tap mic, speak, verify transcript fills input.

- [ ] **Step 4: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add src/screens/CoachScreen.tsx
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "feat: add voice input to CoachScreen"
```

---

## Task 6: CheckInScreen restyle

**Files:**
- Modify: `mobile/src/screens/CheckInScreen.tsx`

- [ ] **Step 1: Replace the JSX return and styles**

Keep all existing logic (handleMorningSubmit, handleEveningSubmit from Plan 1). Replace only the `return` JSX and `styles`:

```typescript
return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.label}>TWO MINUTES OF HONESTY. TWICE A DAY.</Text>
      <Text style={styles.title}>Check-In</Text>
    </View>

    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {phase === 'pick' && (
        <View style={styles.pickContainer}>
          <TouchableOpacity
            style={styles.checkInCard}
            onPress={() => { setType('morning'); setPhase('morning'); }}
          >
            <Text style={styles.cardEmoji}>☀️</Text>
            <Text style={styles.cardTitle}>Morning Mission</Text>
            <Text style={styles.cardSub}>Set your mission. Lock in your day.</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.checkInCard}
            onPress={() => { setType('evening'); setPhase('evening'); }}
          >
            <Text style={styles.cardEmoji}>🌙</Text>
            <Text style={styles.cardTitle}>Evening Debrief</Text>
            <Text style={styles.cardSub}>Did you follow through? No hiding.</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'morning' && (
        <View style={styles.formContainer}>
          <Text style={styles.formLabel}>TODAY'S #1 MISSION</Text>
          <TextInput
            style={styles.missionInput}
            placeholder="What matters most today? Be specific."
            placeholderTextColor="#444"
            value={mission}
            onChangeText={setMission}
            multiline
            autoFocus
          />
          <Text style={styles.formLabel}>ENERGY LEVEL</Text>
          <View style={styles.energyRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.energyDot, energy >= n && styles.energyDotActive]}
                onPress={() => setEnergy(n)}
              />
            ))}
            <Text style={styles.energyLabel}>
              {energy <= 2 ? 'Drained' : energy === 3 ? 'Okay' : energy === 4 ? 'Good' : 'Locked in'}
            </Text>
          </View>
          <Text style={styles.formLabel}>BIGGEST DISTRACTION RISK</Text>
          <TextInput
            style={styles.input}
            placeholder="What could derail you today?"
            placeholderTextColor="#444"
            value={distraction}
            onChangeText={setDistraction}
          />
          <TouchableOpacity
            style={[styles.cta, (!mission.trim() || loading) && styles.disabled]}
            onPress={handleMorningSubmit}
            disabled={!mission.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="#0a0a0a" />
              : <Text style={styles.ctaText}>Lock it in. Let's go. 🔒</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {phase === 'evening' && (
        <View style={styles.formContainer}>
          <Text style={styles.formLabel}>DID YOU COMPLETE YOUR MISSION?</Text>
          <View style={styles.boolRow}>
            <TouchableOpacity
              style={[styles.boolButton, completed === true && styles.boolButtonYes]}
              onPress={() => setCompleted(true)}
            >
              <Text style={styles.boolText}>Commit ✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.boolButton, completed === false && styles.boolButtonNo]}
              onPress={() => setCompleted(false)}
            >
              <Text style={styles.boolText}>No excuses</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.formLabel}>NO EDITING. JUST THE TRUTH.</Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            placeholder={completed ? 'What made today work?' : 'What actually happened?'}
            placeholderTextColor="#444"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <TouchableOpacity
            style={[styles.cta, (completed === null || loading) && styles.disabled]}
            onPress={handleEveningSubmit}
            disabled={completed === null || loading}
          >
            {loading
              ? <ActivityIndicator color="#0a0a0a" />
              : <Text style={styles.ctaText}>Submit debrief</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {phase === 'result' && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>YOUR COACH</Text>
          <Text style={styles.resultText}>{result}</Text>
          <TouchableOpacity style={styles.cta} onPress={() => { setPhase('pick'); setResult(''); setMission(''); setReason(''); }}>
            <Text style={styles.ctaText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  </SafeAreaView>
);
```

Replace `styles`:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  label: { fontSize: 9, letterSpacing: 3, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold' },
  content: { padding: 20, gap: 16 },
  pickContainer: { gap: 12 },
  checkInCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#222',
  },
  cardEmoji: { fontSize: 28, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#fff', fontFamily: 'Syne_700Bold', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#666', lineHeight: 18 },
  formContainer: { gap: 12 },
  formLabel: { fontSize: 9, letterSpacing: 3, color: '#b8f058', fontFamily: 'DMMono_400Regular' },
  missionInput: {
    backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#333',
    padding: 14, color: '#fff', fontSize: 16, minHeight: 100, textAlignVertical: 'top',
  },
  input: {
    backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#333',
    padding: 14, color: '#fff', fontSize: 15,
  },
  reasonInput: { minHeight: 80, textAlignVertical: 'top' },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  energyDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#222', borderWidth: 1, borderColor: '#333' },
  energyDotActive: { backgroundColor: '#b8f058', borderColor: '#b8f058' },
  energyLabel: { color: '#aaa', fontSize: 12, fontFamily: 'DMMono_400Regular', marginLeft: 4 },
  boolRow: { flexDirection: 'row', gap: 10 },
  boolButton: {
    flex: 1, paddingVertical: 14, borderRadius: 8,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#333', alignItems: 'center',
  },
  boolButtonYes: { borderColor: '#b8f058', backgroundColor: '#0f1a0a' },
  boolButtonNo: { borderColor: '#f06060', backgroundColor: '#1a0a0a' },
  boolText: { color: '#fff', fontWeight: '600' },
  cta: {
    backgroundColor: '#b8f058', borderRadius: 8, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  ctaText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  resultContainer: { gap: 16 },
  resultLabel: { fontSize: 9, letterSpacing: 3, color: '#b8f058', fontFamily: 'DMMono_400Regular' },
  resultText: { fontSize: 16, color: '#fff', lineHeight: 26, backgroundColor: '#111', borderRadius: 10, padding: 16, borderLeftWidth: 3, borderLeftColor: '#b8f058' },
});
```

- [ ] **Step 2: Verify in simulator**

Open Check-In tab. Verify: morning/evening cards show, mission + energy dots + distraction inputs work, lock-in CTA works, result screen shows AI brief with left accent border.

- [ ] **Step 3: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add src/screens/CheckInScreen.tsx
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "feat: restyle CheckInScreen to match prototype"
```

---

## Task 7: HabitsScreen restyle

**Files:**
- Modify: `mobile/src/screens/HabitsScreen.tsx`

- [ ] **Step 1: Replace JSX return and styles (keep existing logic)**

Keep all existing Supabase logic (loadHabits, toggleHabit, addHabit). Replace return JSX:

```typescript
return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.label}>DAILY REPS</Text>
      <Text style={styles.title}>Habits</Text>
      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(!showAddForm)}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>

    {showAddForm && (
      <View style={styles.addForm}>
        <TextInput
          style={styles.addInput}
          placeholder="New habit name"
          placeholderTextColor="#444"
          value={newHabitName}
          onChangeText={setNewHabitName}
          autoFocus
        />
        <TouchableOpacity
          style={[styles.addSubmit, !newHabitName.trim() && styles.disabled]}
          onPress={handleAddHabit}
          disabled={!newHabitName.trim()}
        >
          <Text style={styles.addSubmitText}>Add habit</Text>
        </TouchableOpacity>
      </View>
    )}

    {loading ? (
      <ActivityIndicator color="#b8f058" style={{ marginTop: 40 }} />
    ) : (
      <FlatList
        data={habits}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.habitCard, item.completedToday && styles.habitCardDone]}
            onPress={() => toggleHabit(item.id, item.completedToday)}
          >
            <View style={[styles.checkCircle, item.completedToday && styles.checkCircleDone]}>
              {item.completedToday && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <View style={styles.habitInfo}>
              <Text style={[styles.habitName, item.completedToday && styles.habitNameDone]}>
                {item.emoji} {item.name}
              </Text>
              <Text style={styles.habitStreak}>🔥 {item.streak} day streak</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No habits yet.</Text>
            <Text style={styles.emptySubtext}>Add your first one above.</Text>
          </View>
        }
      />
    )}
  </SafeAreaView>
);
```

Replace styles:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  label: { fontSize: 9, letterSpacing: 3, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', flex: 1 },
  addButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#b8f058',
    justifyContent: 'center', alignItems: 'center',
  },
  addButtonText: { fontSize: 22, color: '#0a0a0a', lineHeight: 26 },
  addForm: { padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  addInput: {
    backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#333',
    padding: 12, color: '#fff', fontSize: 15,
  },
  addSubmit: {
    backgroundColor: '#b8f058', borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  addSubmitText: { color: '#0a0a0a', fontWeight: '700' },
  list: { padding: 16, gap: 10 },
  habitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#111', borderRadius: 10, padding: 16,
    borderWidth: 1, borderColor: '#222',
  },
  habitCardDone: { borderColor: '#b8f05840', backgroundColor: '#0f1a0a' },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  checkCircleDone: { backgroundColor: '#b8f058', borderColor: '#b8f058' },
  checkMark: { color: '#0a0a0a', fontWeight: '900', fontSize: 14 },
  habitInfo: { flex: 1 },
  habitName: { fontSize: 15, color: '#fff', fontWeight: '600', marginBottom: 2 },
  habitNameDone: { color: '#b8f058' },
  habitStreak: { fontSize: 11, color: '#555', fontFamily: 'DMMono_400Regular' },
  disabled: { opacity: 0.4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#fff', fontWeight: '600', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#444' },
});
```

- [ ] **Step 2: Verify in simulator**

Open Habits tab. Verify: habit cards show, tap to complete fills check circle in green, streak count shows, add form opens/closes.

- [ ] **Step 3: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add src/screens/HabitsScreen.tsx
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "feat: restyle HabitsScreen to match prototype"
```

---

## Task 8: GoalsScreen restyle

**Files:**
- Modify: `mobile/src/screens/GoalsScreen.tsx`

- [ ] **Step 1: Replace JSX return and styles**

Keep existing Supabase logic. Replace return JSX:

```typescript
return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <View>
        <Text style={styles.label}>THE LONG GAME</Text>
        <Text style={styles.title}>Goals</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(!showAddForm)}>
        <Text style={styles.addButtonText}>+ New Goal</Text>
      </TouchableOpacity>
    </View>

    {showAddForm && (
      <View style={styles.addForm}>
        <TextInput style={styles.input} placeholder="Goal name" placeholderTextColor="#444" value={newGoalName} onChangeText={setNewGoalName} autoFocus />
        <TextInput style={styles.input} placeholder="Deadline (e.g. Dec 31 2026)" placeholderTextColor="#444" value={newGoalDeadline} onChangeText={setNewGoalDeadline} />
        <TouchableOpacity style={[styles.cta, !newGoalName.trim() && styles.disabled]} onPress={handleAddGoal} disabled={!newGoalName.trim()}>
          <Text style={styles.ctaText}>Add goal</Text>
        </TouchableOpacity>
      </View>
    )}

    <ScrollView contentContainerStyle={styles.list}>
      {goals.map(goal => {
        const isStalled = goal.progress < 30 && goal.daysSince > 14;
        return (
          <View key={goal.id} style={[styles.goalCard, isStalled && styles.goalCardStalled]}>
            {isStalled && (
              <Text style={styles.stalledBadge}>⚠️ STALLED — Call it out.</Text>
            )}
            <Text style={styles.goalName}>{goal.name}</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${goal.progress}%` as any }]} />
              </View>
              <Text style={styles.progressText}>{goal.progress}%</Text>
            </View>
            {goal.deadline ? (
              <Text style={styles.deadline}>📅 {goal.deadline}</Text>
            ) : (
              <Text style={styles.deadline}>No deadline</Text>
            )}
            <View style={styles.progressButtons}>
              {[0, 25, 50, 75, 100].map(val => (
                <TouchableOpacity
                  key={val}
                  style={[styles.progressButton, goal.progress === val && styles.progressButtonActive]}
                  onPress={() => updateGoalProgress(goal.id, val)}
                >
                  <Text style={[styles.progressButtonText, goal.progress === val && styles.progressButtonTextActive]}>{val}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}
      {goals.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No goals set</Text>
          <Text style={styles.emptySubtext}>Add the thing you're actually working toward.</Text>
        </View>
      )}
    </ScrollView>
  </SafeAreaView>
);
```

Make sure these state variables exist: `newGoalDeadline`, `showAddForm`, `goals` with `daysSince`. Add `daysSince` to the `Goal` interface and calculate it in `loadGoals`:

```typescript
interface Goal {
  id: string;
  name: string;
  progress: number;
  deadline?: string;
  daysSince: number;
}
// In loadGoals, map goals:
goals: data.map((g: any) => ({
  id: g.id, name: g.name, progress: g.progress ?? 0,
  deadline: g.deadline,
  daysSince: Math.floor((Date.now() - new Date(g.created_at).getTime()) / 86400000),
}))
```

Replace styles:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  label: { fontSize: 9, letterSpacing: 3, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold' },
  addButton: {
    borderWidth: 1, borderColor: '#b8f058', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  addButtonText: { color: '#b8f058', fontSize: 13, fontWeight: '600' },
  addForm: { padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  input: {
    backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#333',
    padding: 12, color: '#fff', fontSize: 15,
  },
  cta: { backgroundColor: '#b8f058', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  ctaText: { color: '#0a0a0a', fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  goalCard: { backgroundColor: '#111', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: '#222' },
  goalCardStalled: { borderColor: '#f0606040', backgroundColor: '#1a0a0a' },
  stalledBadge: { fontSize: 11, color: '#f06060', fontFamily: 'DMMono_400Regular', marginBottom: 8, letterSpacing: 1 },
  goalName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  progressBar: { flex: 1, height: 4, backgroundColor: '#222', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#b8f058', borderRadius: 2 },
  progressText: { fontSize: 12, color: '#b8f058', fontFamily: 'DMMono_400Regular', width: 36 },
  deadline: { fontSize: 11, color: '#555', fontFamily: 'DMMono_400Regular', marginBottom: 10 },
  progressButtons: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  progressButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  progressButtonActive: { backgroundColor: '#b8f05820', borderColor: '#b8f058' },
  progressButtonText: { fontSize: 11, color: '#555', fontFamily: 'DMMono_400Regular' },
  progressButtonTextActive: { color: '#b8f058' },
  disabled: { opacity: 0.4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#fff', fontWeight: '600', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#444', textAlign: 'center' },
});
```

- [ ] **Step 2: Verify in simulator**

Open Goals tab. Verify: goal cards show, progress bar fills, stalled badge appears for goals <30% and >14 days old, progress buttons update the bar.

- [ ] **Step 3: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add src/screens/GoalsScreen.tsx
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "feat: restyle GoalsScreen with stall detection"
```

---

## Task 9: StatsScreen restyle

**Files:**
- Modify: `mobile/src/screens/StatsScreen.tsx`

- [ ] **Step 1: Replace JSX return and styles**

Keep existing Supabase logic. Add helper function at top of file (before component):

```typescript
function getRank(score: number): { label: string; color: string } {
  if (score >= 86) return { label: 'Monk Elite',    color: '#b8f058' };
  if (score >= 61) return { label: 'Disciplined',   color: '#40f5c8' };
  if (score >= 31) return { label: 'Rising Force',  color: '#f5c840' };
  return              { label: 'Starting Out',   color: '#f0a060' };
}
```

Replace return JSX:

```typescript
const rank = getRank(dopamineScore);
const completionPct = weekStats.total > 0 ? Math.round((weekStats.completed / weekStats.total) * 100) : 0;

return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.label}>YOUR NUMBERS</Text>
      <Text style={styles.title}>Stats</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>

      {/* Dopamine Score */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>DOPAMINE SCORE</Text>
        <Text style={[styles.scoreNumber, { color: rank.color }]}>{dopamineScore}</Text>
        <Text style={[styles.rankBadge, { color: rank.color }]}>{rank.label}</Text>
        <View style={styles.scoreBar}>
          <View style={[styles.scoreFill, { width: `${dopamineScore}%` as any, backgroundColor: rank.color }]} />
        </View>
      </View>

      {/* This Week */}
      <View style={styles.weekCard}>
        <Text style={styles.sectionLabel}>THIS WEEK</Text>
        <View style={styles.weekRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{streak}</Text>
            <Text style={styles.statLabel}>Current streak</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{completionPct}%</Text>
            <Text style={styles.statLabel}>Completion rate</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{weekStats.completed}</Text>
            <Text style={styles.statLabel}>Habits done</Text>
          </View>
        </View>
      </View>

      {/* Leaderboard */}
      <View style={styles.leaderboardCard}>
        <Text style={styles.sectionLabel}>LEADERBOARD</Text>
        {[
          { name: 'You', score: dopamineScore, isYou: true },
          { name: 'RizeTogether', score: 88, isYou: false },
          { name: 'DisciplinedB', score: 81, isYou: false },
          { name: 'MindfulK', score: 74, isYou: false },
        ].sort((a, b) => b.score - a.score).map((entry, i) => (
          <View key={entry.name} style={[styles.leaderboardRow, entry.isYou && styles.leaderboardRowYou]}>
            <Text style={styles.leaderboardRank}>#{i + 1}</Text>
            <Text style={[styles.leaderboardName, entry.isYou && { color: '#b8f058' }]}>{entry.name}</Text>
            <Text style={styles.leaderboardScore}>{entry.score}</Text>
          </View>
        ))}
      </View>

    </ScrollView>
  </SafeAreaView>
);
```

Replace styles:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  label: { fontSize: 9, letterSpacing: 3, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold' },
  content: { padding: 16, gap: 12 },
  scoreCard: { backgroundColor: '#111', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#222', alignItems: 'center' },
  scoreLabel: { fontSize: 9, letterSpacing: 3, color: '#666', fontFamily: 'DMMono_400Regular', marginBottom: 8 },
  scoreNumber: { fontSize: 72, fontWeight: '900', fontFamily: 'Syne_800ExtraBold', lineHeight: 80 },
  rankBadge: { fontSize: 13, fontFamily: 'DMMono_400Regular', letterSpacing: 2, marginTop: 4, marginBottom: 16 },
  scoreBar: { width: '100%', height: 4, backgroundColor: '#222', borderRadius: 2 },
  scoreFill: { height: 4, borderRadius: 2 },
  weekCard: { backgroundColor: '#111', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#222' },
  sectionLabel: { fontSize: 9, letterSpacing: 3, color: '#666', fontFamily: 'DMMono_400Regular', marginBottom: 16 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBlock: { alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '900', color: '#fff', fontFamily: 'Syne_800ExtraBold' },
  statLabel: { fontSize: 10, color: '#555', fontFamily: 'DMMono_400Regular', marginTop: 2, textAlign: 'center' },
  leaderboardCard: { backgroundColor: '#111', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#222' },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  leaderboardRowYou: { backgroundColor: '#0f1a0a', marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 6 },
  leaderboardRank: { width: 28, fontSize: 12, color: '#555', fontFamily: 'DMMono_400Regular' },
  leaderboardName: { flex: 1, fontSize: 14, color: '#fff', fontWeight: '600' },
  leaderboardScore: { fontSize: 14, color: '#b8f058', fontFamily: 'DMMono_400Regular', fontWeight: '700' },
});
```

- [ ] **Step 2: Verify in simulator**

Open Stats tab. Verify: dopamine score displays large, rank badge below it, progress bar, week stats in 3 columns, leaderboard sorted by score with "You" highlighted.

- [ ] **Step 3: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add src/screens/StatsScreen.tsx
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "feat: restyle StatsScreen with rank system and leaderboard"
```

---

## Task 10: ReviewScreen restyle

**Files:**
- Modify: `mobile/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: Replace JSX return and styles**

Keep all logic from Plan 1 (`handleGenerateReview`, `reviewText` state). Replace return JSX:

```typescript
const weekStart = new Date();
weekStart.setDate(weekStart.getDate() - 6);
const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.label}>FORENSIC ANALYSIS</Text>
      <Text style={styles.title}>Weekly Review</Text>
      <Text style={styles.weekLabel}>Week of {weekLabel}</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      {!reviewText ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Your coach has been watching.</Text>
          <Text style={styles.emptySubtext}>7 days of data. Ready for the truth?</Text>
          <TouchableOpacity
            style={[styles.cta, loading && styles.disabled]}
            onPress={handleGenerateReview}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#0a0a0a" />
              : <Text style={styles.ctaText}>Generate review</Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.reviewContainer}>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewText}>{reviewText}</Text>
          </View>
          <TouchableOpacity style={styles.regenerate} onPress={() => setReviewText('')}>
            <Text style={styles.regenerateText}>Generate new review</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  </SafeAreaView>
);
```

Replace styles:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  label: { fontSize: 9, letterSpacing: 3, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', marginBottom: 2 },
  weekLabel: { fontSize: 11, color: '#555', fontFamily: 'DMMono_400Regular' },
  content: { padding: 20, flexGrow: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', fontFamily: 'Syne_700Bold', textAlign: 'center' },
  emptySubtext: { fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 8 },
  cta: { backgroundColor: '#b8f058', borderRadius: 8, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center' },
  ctaText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.4 },
  reviewContainer: { gap: 16 },
  reviewCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#222', borderLeftWidth: 3, borderLeftColor: '#b8f058',
  },
  reviewText: { fontSize: 15, color: '#ddd', lineHeight: 26 },
  regenerate: { alignItems: 'center', paddingVertical: 12 },
  regenerateText: { color: '#444', fontSize: 13 },
});
```

- [ ] **Step 2: Verify in simulator**

Open Review tab. Verify: empty state shows "Your coach has been watching." + generate button. After generating: review text displays in card with green left border.

- [ ] **Step 3: Commit**

```bash
git -C /Users/hafee/Documents/Claude/Monk/mobile add src/screens/ReviewScreen.tsx
git -C /Users/hafee/Documents/Claude/Monk/mobile commit -m "feat: restyle ReviewScreen to match prototype"
```

---

## Plan 2 complete

All screens restyled. Onboarding live. Monk Mode panel + voice input on CoachScreen.

Final smoke test — open each tab in simulator and verify no crashes:

```bash
cd /Users/hafee/Documents/Claude/Monk/mobile && npx expo start
```

Tabs to verify: Coach → Check-In → Habits → Goals → Stats → Review. Log out and verify onboarding flow runs for a new account.
