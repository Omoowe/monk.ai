import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Animated,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { Audio } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MarkdownText from '../components/MarkdownText';
import { useNavigation } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { askCoach, getPepTalk, transcribeAudio, RateLimitError } from '../services/ai';
import { buildCoachContext } from '../services/context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { fscale, scale } from '../utils/scale';
import { useUser } from '../context/UserContext';
import PaywallModal from '../components/PaywallModal';
import { COACH_COLORS, getContrastText } from '../utils/coachColors';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isError?: boolean;
  starred?: boolean;
}

const PERSONALITY_COLORS = COACH_COLORS;

const PERSONALITY_NAMES: Record<string, string> = {
  drill_sergeant: 'Drill Sergeant',
  stoic_mentor:   'Stoic Mentor',
  anime_sensei:   'Anime Sensei',
  goggins:        'Stay Hard',
  ceo_coach:      'CEO Coach',
  calm_therapist: 'Calm Therapist',
};

const PERSONALITY_QUOTES: Record<string, string> = {
  drill_sergeant: 'No excuses. Ever.',
  stoic_mentor:   'You have power over your mind.',
  anime_sensei:   'This is your training arc.',
  goggins:        'Stay hard.',
  ceo_coach:      'Optimize or fall behind.',
  calm_therapist: 'Progress, not perfection.',
};

const DAILY_QUOTES: Record<string, string[]> = {
  drill_sergeant: [
    'Pain is weakness leaving the body.',
    'Comfort is the enemy of progress.',
    'Nobody cares. Work harder.',
    'Excuses are lies you tell yourself.',
    'The body achieves what the mind believes.',
    'Suffer now, live like a champion later.',
    'Discipline is the highest form of self-love.',
  ],
  stoic_mentor: [
    'You have power over your mind, not outside events.',
    'Waste no more time arguing what a good man should be — be one.',
    'It is not death that a man should fear, but never beginning to live.',
    'The impediment to action advances action. The obstacle becomes the way.',
    'Wealth consists not in having great possessions, but in having few wants.',
    'Confine yourself to the present.',
    'Make the best use of what is in your power.',
  ],
  anime_sensei: [
    'Every strike you throw, throw it with your entire soul!',
    'Believing in yourself is your greatest technique!',
    'Those who break the limits are those who push past them!',
    'Your will is the only power no one can take from you!',
    'Surpass yourself. That is the true path of the warrior.',
    'The only wall between you and your goal is the one in your mind.',
    'Train until your weakness becomes your strength!',
  ],
  goggins: [
    'When your mind is telling you you\'re done, you\'re really only 40% done.',
    'Suffering is the true test of life.',
    'No one is going to save you. That\'s the hard truth.',
    'Callous your mind like you callous your hands.',
    'Most people give up when they hit the 40% mark. Don\'t.',
    'You are in danger of living a life so comfortable and soft that you will die without ever realizing your true potential.',
    'Get out of your comfort zone. That\'s where you\'ll find your best self.',
  ],
  ceo_coach: [
    'What gets measured gets managed.',
    'Your network is your net worth.',
    'Revenue is vanity, profit is sanity, cash is reality.',
    'Build systems, not goals.',
    'The best investment is the one in yourself.',
    'Execution eats strategy for breakfast.',
    'Compounding works on habits, not just investments.',
  ],
  calm_therapist: [
    'You are enough, exactly as you are.',
    'Progress is not linear, and that\'s okay.',
    'Be gentle with yourself — you are a child of the universe.',
    'Rest is not laziness; it\'s a part of the process.',
    'Your feelings are valid. Act on your values anyway.',
    'Self-compassion is the foundation of sustainable growth.',
    'Every moment is a fresh beginning.',
  ],
};

function getDailyQuote(p: string): string {
  const quotes = DAILY_QUOTES[p] ?? DAILY_QUOTES['stoic_mentor'];
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start.getTime()) / 86400000);
  return quotes[day % quotes.length];
}

function getQuickActions(): { label: string; message: string }[] {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return [
      { label: 'Set intention',  message: 'Help me set a strong intention for today' },
      { label: 'Activate me',    message: 'I need you to fire me up for the day ahead' },
      { label: 'My one thing',   message: 'What should I focus on most today?' },
    ];
  }
  if (hour >= 12 && hour < 18) {
    return [
      { label: 'Mid-day check',  message: 'How am I tracking against my mission today?' },
      { label: "I'm slipping",   message: "I've been distracted today, hold me accountable" },
      { label: 'Push me',        message: 'Push me harder — I need motivation right now' },
    ];
  }
  return [
    { label: 'Evening journal', message: 'Help me reflect on my evening journal' },
    { label: 'Wind down',       message: 'Help me wind down and prepare for tomorrow' },
    { label: 'Rate my day',     message: 'Rate my day honestly based on what you know' },
  ];
}

function AnimatedMessageWrapper({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, tension: 100, friction: 14, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

export default function CoachScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const headerHeight = useHeaderHeight();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPepTalk, setLoadingPepTalk] = useState(false);

  const { profile, today: todayCtx, updateProfileField } = useUser();
  const personality   = profile?.personality       ?? 'stoic_mentor';
  const streak        = profile?.streak            ?? 0;
  const identity      = profile?.identityStatement ?? '';
  const monkMode      = profile?.monkMode          ?? false;
  const dopamineScore = profile?.dopamineScore     ?? 0;
  const todayMission  = todayCtx.morningMission;
  const morningDone   = todayCtx.morningDone;
  const eveningDone   = todayCtx.eveningDone;
  const habitsToday   = { done: todayCtx.habitsDone, total: todayCtx.habitsTotal };

  const [quoteDismissed, setQuoteDismissed] = useState(false);

  const [showCoachPicker, setShowCoachPicker] = useState(false);
  const sessionMessageCount = useRef(0);
  const memoryUpdateInFlight = useRef(false);
  const todayAiMsgCount = useRef(0);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<TextInput>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micPulse = useRef(new Animated.Value(1)).current;
  const sendScale = useRef(new Animated.Value(1)).current;
  const dotPulseScale = useRef(new Animated.Value(1)).current;
  const dotPulseOpacity = useRef(new Animated.Value(0.9)).current;

  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const dotY1 = useRef(new Animated.Value(0)).current;
  const dotY2 = useRef(new Animated.Value(0)).current;
  const dotY3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(dotPulseScale, { toValue: 1.45, duration: 1600, useNativeDriver: true }),
          Animated.timing(dotPulseOpacity, { toValue: 0.4, duration: 1600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(dotPulseScale, { toValue: 1, duration: 1600, useNativeDriver: true }),
          Animated.timing(dotPulseOpacity, { toValue: 0.9, duration: 1600, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [dotPulseScale, dotPulseOpacity]);

  useEffect(() => {
    if (!loading) return;
    const bounce = (dot: Animated.Value, dotY: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(dot, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.timing(dotY, { toValue: -5, duration: 250, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(dot, { toValue: 0.3, duration: 250, useNativeDriver: true }),
            Animated.timing(dotY, { toValue: 0, duration: 250, useNativeDriver: true }),
          ]),
          Animated.delay(500 - delay),
        ])
      );
    const a1 = bounce(dot1, dotY1, 0);
    const a2 = bounce(dot2, dotY2, 160);
    const a3 = bounce(dot3, dotY3, 320);
    a1.start(); a2.start(); a3.start();
    return () => {
      a1.stop(); a2.stop(); a3.stop();
      dot1.setValue(0.3); dot2.setValue(0.3); dot3.setValue(0.3);
      dotY1.setValue(0); dotY2.setValue(0); dotY3.setValue(0);
    };
  }, [loading, dot1, dot2, dot3, dotY1, dotY2, dotY3]);

  useEffect(() => {
    loadChatHistory();
    const todayStr = new Date().toISOString().split('T')[0];
    AsyncStorage.getItem(`monk_quote_dismissed_${todayStr}`).then((v) => { if (v) setQuoteDismissed(true); });
    AsyncStorage.getItem('monk_starred_msgs').then((v) => { if (v) setStarredIds(new Set(JSON.parse(v))); });
  }, []);

  const loadChatHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStr = new Date().toISOString().split('T')[0];
      // Check absence + today's AI message count in parallel with chat fetch
      const [{ data }, { data: lastCheckin }, { count: aiCount }] = await Promise.all([
        supabase.from('chat_messages').select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }).limit(50),
        supabase.from('check_ins').select('date')
          .eq('user_id', user.id)
          .order('date', { ascending: false }).limit(1).single(),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('role', 'ai').gte('created_at', `${todayStr}T00:00:00`),
      ]);
      todayAiMsgCount.current = aiCount ?? 0;

      const daysSince = lastCheckin?.date
        ? Math.floor((Date.now() - new Date(lastCheckin.date).getTime()) / 86_400_000)
        : 999;
      const isComeback = daysSince >= 2;

      if (data && data.length > 0) {
        setMessages(data.map((msg: any) => ({
          id: msg.id, role: msg.role, text: msg.text,
          timestamp: new Date(msg.created_at),
        })));
        if (isComeback) generateComebackMessage(user.id, daysSince);
      } else {
        if (isComeback) {
          generateComebackMessage(user.id, daysSince);
        } else {
          generateOpeningMessage(user.id);
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err instanceof Error ? err.message : String(err));
    }
  };

  const generateComebackMessage = async (userId: string, daysSince: number) => {
    setLoading(true);
    try {
      const ctx = await buildCoachContext(userId);
      const daysText = daysSince >= 30 ? 'over a month' : `${daysSince} day${daysSince !== 1 ? 's' : ''}`;
      // Inject framing as a hidden system instruction in the user turn
      const prompt = `[COACH SYSTEM: User has been away for ${daysText}. Zero judgment about the absence — one brief acknowledgment then immediately re-anchor to their identity and what today holds. End with one direct question about right now. Max 55 words.]`;
      const text = await askCoach(prompt, ctx.personality || 'stoic_mentor', ctx, []);
      const aiMsg: Message = { id: `comeback-${Date.now()}`, role: 'ai', text, timestamp: new Date() };
      setMessages((prev) => [...prev, aiMsg]);
      void supabase.from('chat_messages').insert({ user_id: userId, role: 'ai', text });
    } catch {
      // Silent — user still sees existing chat or blank state
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('chat_messages')
        .select('*').eq('user_id', user.id)
        .ilike('text', `%${q.trim()}%`)
        .order('created_at', { ascending: false }).limit(40);
      setSearchResults((data ?? []).map((msg: any) => ({
        id: msg.id, role: msg.role, text: msg.text,
        timestamp: new Date(msg.created_at),
      })));
    } catch {} finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => runSearch(q), 300);
  };

  const exitSearch = () => {
    setSearchActive(false);
    setSearchQuery('');
    setSearchResults([]);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const generateOpeningMessage = async (userId: string) => {
    setLoading(true);
    try {
      const ctx = await buildCoachContext(userId);
      const text = await getPepTalk(ctx.personality || 'stoic_mentor', ctx);
      const aiMsg: Message = { id: Date.now().toString(), role: 'ai', text, timestamp: new Date() };
      setMessages([aiMsg]);
      void supabase.from('chat_messages').insert({ user_id: userId, role: 'ai', text });
    } catch {
      const fallback: Message = {
        id: Date.now().toString(), role: 'ai', timestamp: new Date(),
        text: "Your coach is ready. What are you working on today?",
      };
      setMessages([fallback]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!profile?.isPro && todayAiMsgCount.current >= 10) { setPaywallVisible(true); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg = text.trim();
    setInput('');
    setMessages((prev) => [...prev, {
      id: Date.now().toString(), role: 'user', text: userMsg, timestamp: new Date(),
    }]);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const ctx = await buildCoachContext(user.id);
      const history = messages.slice(-10).map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }));
      const aiResponse = await askCoach(userMsg, ctx.personality || personality, ctx, history);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role: 'ai', text: aiResponse, timestamp: new Date(),
      }]);
      await Promise.all([
        supabase.from('chat_messages').insert({ user_id: user.id, role: 'user', text: userMsg }),
        supabase.from('chat_messages').insert({ user_id: user.id, role: 'ai', text: aiResponse }),
      ]);
      sessionMessageCount.current += 1;
      todayAiMsgCount.current += 1;
      if (sessionMessageCount.current % 5 === 0 && !memoryUpdateInFlight.current) {
        memoryUpdateInFlight.current = true;
        supabase.functions.invoke('update-coach-memory').finally(() => {
          memoryUpdateInFlight.current = false;
        });
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        setMessages((prev) => prev.slice(0, -1));
        setInput(userMsg);
        return;
      }
      console.error('Failed to send message:', err instanceof Error ? err.message : String(err));
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role: 'ai',
        text: 'Connection issue. Check your network and try again.',
        timestamp: new Date(), isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handlePepTalk = async () => {
    if (!profile?.isPro && todayAiMsgCount.current >= 10) { setPaywallVisible(true); return; }
    setMessages((prev) => [...prev, {
      id: `pep-user-${Date.now()}`, role: 'user', text: 'Give me a pep talk.', timestamp: new Date(),
    }]);
    setLoadingPepTalk(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const ctx = await buildCoachContext(user.id);
      const pepTalk = await getPepTalk(ctx.personality || personality, ctx);
      setMessages((prev) => [...prev, {
        id: Date.now().toString(), role: 'ai', text: pepTalk, timestamp: new Date(),
      }]);
      await supabase.from('chat_messages').insert({ user_id: user.id, role: 'ai', text: pepTalk });
      todayAiMsgCount.current += 1;
    } catch (err) {
      console.error('Failed to generate pep talk:', err instanceof Error ? err.message : String(err));
      setMessages((prev) => [...prev, {
        id: Date.now().toString(), role: 'ai',
        text: 'Could not reach your coach. Check connection.',
        timestamp: new Date(), isError: true,
      }]);
    } finally {
      setLoadingPepTalk(false);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone access is required for voice input.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } catch (e) {
      console.error('Recording start failed:', e);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    micPulse.stopAnimation();
    micPulse.setValue(1);
    setTranscribing(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);
      if (uri) {
        const text = await transcribeAudio(uri);
        if (text.trim()) setInput((prev) => (prev ? prev + ' ' + text.trim() : text.trim()));
      }
    } catch (e) {
      console.error('Transcription failed:', e);
    } finally {
      setTranscribing(false);
    }
  };

  const switchCoach = async (id: string) => {
    updateProfileField({ personality: id });
    setShowCoachPicker(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('users').update({ personality: id }).eq('id', user.id);
    } catch {}
  };

  const clearChat = () => {
    Alert.alert('Clear Chat', 'Delete all messages with your coach?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('chat_messages').delete().eq('user_id', user.id);
        setMessages([]);
      }},
    ]);
  };

  const openMoreMenu = () => {
    const opts: any[] = [
      { text: 'Search', onPress: () => { setSearchActive(true); setTimeout(() => searchRef.current?.focus(), 80); } },
      { text: 'Pep Talk', onPress: handlePepTalk },
      { text: 'Settings', onPress: () => navigation.navigate('Profile') },
    ];
    if (messages.length > 0) opts.push({ text: 'Clear Chat', style: 'destructive', onPress: clearChat });
    opts.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Options', undefined, opts);
  };

  const insets = useSafeAreaInsets();
  const color = PERSONALITY_COLORS[personality] ?? '#b8f058';
  const quickActions = getQuickActions();

  const dismissQuote = () => {
    const today = new Date().toISOString().split('T')[0];
    AsyncStorage.setItem(`monk_quote_dismissed_${today}`, '1').catch(() => {});
    setQuoteDismissed(true);
  };

  const toggleStar = async (msgId: string) => {
    const next = new Set(starredIds);
    if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
    setStarredIds(next);
    await AsyncStorage.setItem('monk_starred_msgs', JSON.stringify([...next]));
  };

  const handleStarMessage = (msg: Message) => {
    const isStarred = starredIds.has(msg.id);
    Alert.alert(
      isStarred ? 'Remove star?' : 'Star this message?',
      isStarred ? 'Remove from your pinned insights.' : 'Pin this coaching insight for easy recall.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isStarred ? 'Remove' : 'Star it', onPress: () => toggleStar(msg.id) },
      ]
    );
  };

  const QuoteCard = () => {
    if (quoteDismissed) return null;
    const quote = getDailyQuote(personality);
    return (
      <View style={[styles.quoteCard, { borderTopColor: color + '40' }]}>
        <View style={[styles.quoteColorDot, { backgroundColor: color }]} />
        <Text style={styles.quoteText}>"{quote}"</Text>
        <TouchableOpacity onPress={dismissQuote} style={styles.quoteDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.quoteDismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const TodayCard = () => {
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (streak === 0 && habitsToday.total === 0 && dopamineScore === 0 && !morningDone) return null;
    return (
      <View style={[styles.todayCard, { borderLeftWidth: 3, borderLeftColor: color + '50' }]}>
        <Text style={[styles.todayDate, { color: color + '80' }]}>{dayName.toUpperCase()}</Text>
        <View style={styles.todayRow}>
          {streak > 0 && (
            <View style={styles.todayStat}>
              <Text style={[styles.todayStatVal, { color }]}>{streak}</Text>
              <Text style={styles.todayStatLbl}>streak</Text>
            </View>
          )}
          {habitsToday.total > 0 && (
            <View style={styles.todayStat}>
              <Text style={[styles.todayStatVal, habitsToday.done === habitsToday.total && { color: '#b8f058' }]}>
                {habitsToday.done}/{habitsToday.total}
              </Text>
              <Text style={styles.todayStatLbl}>habits</Text>
            </View>
          )}
          {dopamineScore > 0 && (
            <View style={styles.todayStat}>
              <Text style={styles.todayStatVal}>{dopamineScore}</Text>
              <Text style={styles.todayStatLbl}>score</Text>
            </View>
          )}
          <View style={styles.todayStat}>
            <View style={styles.checkinDots}>
              <View style={[styles.checkinDot, morningDone && styles.checkinDotDone]} />
              <View style={[styles.checkinDot, eveningDone && styles.checkinDotDone]} />
            </View>
            <Text style={styles.todayStatLbl}>check-ins</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <AnimatedMessageWrapper>
      <View style={item.role === 'user' ? styles.msgUserWrap : styles.msgAIWrap}>
        {item.role === 'ai' && (
          <View style={styles.aiLabel}>
            <View style={[styles.aiLabelDot, { backgroundColor: color }]} />
            <Text style={[styles.aiLabelName, { color }]}>{PERSONALITY_NAMES[personality]}</Text>
            {starredIds.has(item.id) && <Text style={styles.aiLabelStar}>★</Text>}
          </View>
        )}
        <TouchableOpacity
          activeOpacity={item.role === 'ai' ? 0.85 : 1}
          onLongPress={item.role === 'ai' ? () => handleStarMessage(item) : undefined}
          delayLongPress={500}
          style={[
            styles.msgBubble,
            item.role === 'user' ? [styles.msgBubbleUser, { borderRightWidth: 3, borderRightColor: color + '30', backgroundColor: color + '14', borderColor: color + '20' }] : [styles.msgBubbleAI, { borderLeftColor: item.isError ? '#f06060' : color }],
            item.isError && styles.msgBubbleError,
            item.role === 'ai' && starredIds.has(item.id) && styles.msgBubbleStarred,
          ]}
        >
          {item.role === 'ai'
            ? <MarkdownText style={styles.msgText} boldStyle={{ color: color }}>{item.text}</MarkdownText>
            : <Text style={[styles.msgText, styles.msgTextUser]}>{item.text}</Text>}
          <Text style={[styles.msgTime, item.role === 'user' && { color: '#0a0a0a66' }]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>
      </View>
    </AnimatedMessageWrapper>
  );

  return (
    <View style={styles.container}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
    <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
      {/* Coach identity bar */}
      <View style={[styles.coachBar, monkMode && { backgroundColor: '#120808', borderBottomColor: '#f0606030' }]}>
        <TouchableOpacity testID="coach-identity-bar" style={styles.coachLeft} onPress={() => setShowCoachPicker(true)} activeOpacity={0.7}>
          <Animated.View style={[styles.coachColorDot, { backgroundColor: color, transform: [{ scale: dotPulseScale }], opacity: dotPulseOpacity }]} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.coachName, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{PERSONALITY_NAMES[personality]}</Text>
              <Text style={styles.coachSwitch}>▾</Text>
            </View>
            <Text style={styles.coachQuote} numberOfLines={1}>"{PERSONALITY_QUOTES[personality]}"</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.coachRight}>
          <TouchableOpacity onPress={openMoreMenu} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Text style={styles.moreBtn}>···</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Monk Mode strip */}
      <TouchableOpacity
        testID="monkmode-btn"
        style={[styles.monkModeStrip, monkMode && styles.monkModeStripActive]}
        onPress={() => navigation.navigate('MonkMode')}
        activeOpacity={0.7}
      >
        <Text style={[styles.monkModeIcon, monkMode && { color: '#f06060' }]}>
          {monkMode ? '◆' : '◇'}
        </Text>
        <Text style={[styles.monkModeLabel, monkMode && { color: '#f06060' }]}>MONK MODE</Text>
        <Text style={styles.monkModeSep}>  |  </Text>
        <Text style={[styles.monkModeStatus, monkMode && { color: '#f0606099' }]}>
          {monkMode ? 'ON · ACTIVE' : 'OFF · TAP TO ENABLE'}
        </Text>
      </TouchableOpacity>

      {/* Identity strip */}
      {identity ? (
        <View style={styles.identityStrip}>
          <Text style={styles.identityText} numberOfLines={1}>
            <Text style={styles.identityLabel}>You: </Text>
            "{identity}"
          </Text>
        </View>
      ) : null}

      {/* Today's mission strip */}
      {!searchActive && todayMission ? (
        <View style={[styles.identityStrip, styles.missionStrip]}>
          <Text style={styles.identityText} numberOfLines={1}>
            <Text style={[styles.identityLabel, { color: '#f5c840' }]}>MISSION: </Text>
            {todayMission}
          </Text>
          {habitsToday.total > 0 && (
            <Text style={styles.habitsLine}>
              {habitsToday.done}/{habitsToday.total} HABITS DONE TODAY
            </Text>
          )}
        </View>
      ) : null}

      {/* Search bar */}
      {searchActive && (
        <View style={styles.searchBar}>
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#555"
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searching && <ActivityIndicator color="#666" size={14} style={{ marginLeft: 8 }} />}
          <TouchableOpacity onPress={exitSearch} style={{ marginLeft: 8 }} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={styles.searchCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={searchActive ? searchResults : messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => { if (!searchActive) flatListRef.current?.scrollToEnd({ animated: true }); }}
        contentContainerStyle={styles.msgList}
        style={{ flex: 1 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={searchActive ? null : <><QuoteCard /><TodayCard /></>}
        ListFooterComponent={loading || loadingPepTalk ? (
          <View style={styles.typingWrap}>
            <View style={[styles.aiLabelDot, { backgroundColor: color }]} />
            <View style={[styles.typingBubble, { borderLeftColor: color }]}>
              {([[ dot1, dotY1 ], [dot2, dotY2], [dot3, dotY3]] as [Animated.Value, Animated.Value][]).map(([dot, dotY], i) => (
                <Animated.View key={i} style={[styles.typingDot, { opacity: dot, backgroundColor: color, transform: [{ translateY: dotY }] }]} />
              ))}
            </View>
          </View>
        ) : null}
        ListEmptyComponent={searchActive ? (
          <View style={styles.empty}>
            <View style={[styles.emptyColorOrb, { backgroundColor: color, opacity: 0.3 }]} />
            <Text style={styles.emptySub}>
              {searchQuery.trim() ? 'No messages found.' : 'Type to search your chat history.'}
            </Text>
          </View>
        ) : (
          <View style={styles.empty}>
            <Animated.View style={[styles.emptyColorOrb, { backgroundColor: color, opacity: pulseAnim }]} />
            <Text style={[styles.emptyCoachName, { color }]}>
              {PERSONALITY_NAMES[personality]}
            </Text>
            <Text style={styles.emptyQuote}>
              "{PERSONALITY_QUOTES[personality]}"
            </Text>
            <View style={styles.emptySeparator} />
            <Text style={styles.emptyPrompt}>Your coach is watching.</Text>
            <Text style={styles.emptySub}>Start talking. Get held accountable.</Text>
          </View>
        )}
      />

        {searchActive ? null : <View style={styles.inputArea}>
          {/* Quick action chips */}
          <View style={styles.chipsRow}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.chip, { backgroundColor: color + '0d', borderColor: color + '20', borderLeftWidth: 2, borderLeftColor: color }]}
                onPress={() => sendMessage(action.message)}
                disabled={loading}
              >
                <Text style={[styles.chipText, { color: color + 'cc' }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Input box */}
          <View style={[
            styles.inputBox,
            { borderColor: inputFocused ? color + '90' : color + '40' },
            inputFocused && { shadowColor: color, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
          ]}>
            <TouchableOpacity
              onPress={recording ? stopRecording : startRecording}
              disabled={transcribing || loading}
              style={styles.micBtn}
            >
              {transcribing
                ? <ActivityIndicator color="#666" size={16} />
                : <Animated.Text style={[
                    styles.actionIcon,
                    recording ? styles.micActive : { color: '#666' },
                    { transform: [{ scale: micPulse }] },
                  ]}>⏺</Animated.Text>}
            </TouchableOpacity>
            <TextInput
              testID="coach-input"
              style={styles.input}
              placeholder="Message your coach..."
              placeholderTextColor="#555"
              value={input}
              onChangeText={setInput}
              editable={!loading}
              multiline
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: (loading || !input.trim()) ? '#222' : color }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Animated.sequence([
                  Animated.spring(sendScale, { toValue: 0.88, useNativeDriver: true, tension: 200, friction: 10 }),
                  Animated.spring(sendScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
                ]).start();
                sendMessage(input);
              }}
              disabled={loading || !input.trim()}
            >
              <Animated.View style={{ transform: [{ scale: sendScale }] }}>
                {loading
                  ? <ActivityIndicator color={color} size={16} />
                  : <Text style={[styles.sendBtnText, { color: (loading || !input.trim()) ? '#777' : getContrastText(color) }]}>↑</Text>}
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>}
      <PaywallModal visible={paywallVisible} trigger="messages" onClose={() => setPaywallVisible(false)} />
    </SafeAreaView>
    </KeyboardAvoidingView>

    {/* Coach picker bottom sheet */}
    <Modal
      visible={showCoachPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCoachPicker(false)}
    >
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCoachPicker(false)} />
      <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        <View style={styles.pickerHandle} />
        <Text style={styles.pickerTitle}>Switch Coach</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
          {Object.keys(PERSONALITY_NAMES).map((id) => {
            const active = personality === id;
            const c = PERSONALITY_COLORS[id];
            return (
              <TouchableOpacity
                key={id}
                testID={`coach-option-${id}`}
                style={[styles.pickerCard, active && { borderColor: c, backgroundColor: c + '12' }]}
                onPress={() => switchCoach(id)}
                activeOpacity={0.7}
              >
                <View style={[styles.pickerColorBar, { backgroundColor: c }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerCardName, { color: active ? c : '#fff' }]}>
                    {PERSONALITY_NAMES[id]}
                  </Text>
                  <View style={[styles.pickerDivider, active && { backgroundColor: c + '30' }]} />
                  <Text style={styles.pickerCardQuote}>"{PERSONALITY_QUOTES[id]}"</Text>
                </View>
                {active && (
                  <View style={[styles.pickerCheckCircle, { backgroundColor: c + '20', borderColor: c + '50' }]}>
                    <View style={[styles.pickerCheckDot, { backgroundColor: c }]} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  coachBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: scale(20), paddingVertical: scale(10), minHeight: scale(64),
    backgroundColor: '#111',
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  coachLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  coachColorDot: {
    width: scale(10), height: scale(10), borderRadius: scale(5), flexShrink: 0,
  },
  coachName: { fontSize: fscale(14), fontWeight: '800', fontFamily: 'Syne_800ExtraBold' },
  coachQuote: { fontSize: fscale(11), color: '#aaa', fontStyle: 'italic', marginTop: 1 },
  coachRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statInline: { fontSize: fscale(13), color: '#f5c840', fontWeight: '700', fontFamily: 'DMMono_400Regular' },
  moreBtn: { fontSize: fscale(18), color: '#555', letterSpacing: 2, paddingLeft: 2 },

  monkModeStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: scale(20), paddingVertical: scale(8),
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
  },
  monkModeStripActive: { backgroundColor: '#1a0808', borderBottomColor: '#f0606030' },
  monkModeIcon: { fontSize: fscale(14), marginRight: 6, color: '#4a8a4a' },
  monkModeLabel: { fontSize: fscale(11), fontWeight: '700', color: '#4a8a4a', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
  monkModeSep: { fontSize: fscale(11), color: '#333' },
  monkModeStatus: { fontSize: fscale(11), color: '#444', fontFamily: 'DMMono_400Regular' },
  habitsLine: { fontSize: fscale(10), color: '#666', fontFamily: 'DMMono_400Regular', marginTop: 3, letterSpacing: 0.5 },

  identityStrip: {
    paddingHorizontal: scale(20), paddingVertical: scale(7),
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  identityLabel: { color: '#b8f058', fontWeight: '700', fontSize: fscale(11) },
  identityText: { fontSize: fscale(11), color: '#aaa', fontStyle: 'italic' },
  missionStrip: { backgroundColor: '#0d160a' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
  },
  searchInput: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    color: '#fff', fontSize: fscale(14),
    borderWidth: 1, borderColor: '#333',
  },
  searchCancel: { fontSize: fscale(13), color: '#aaa', paddingHorizontal: 4 },

  quoteCard: {
    backgroundColor: '#0d0d0d', borderRadius: 10, padding: 14,
    borderTopWidth: 1, marginBottom: 10,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  quoteColorDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  quoteText: { flex: 1, fontSize: fscale(13), lineHeight: fscale(20), fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' },
  quoteDismiss: { paddingTop: 2 },
  quoteDismissText: { fontSize: fscale(12), color: '#555' },

  todayCard: {
    backgroundColor: '#111', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#1e1e1e', marginBottom: 12,
    borderLeftWidth: 3,
  },
  todayDate: { fontSize: fscale(11), letterSpacing: 1.5, color: '#aaa', fontFamily: 'DMMono_400Regular', marginBottom: 8 },
  todayRow: { flexDirection: 'row', gap: 16 },
  todayStat: { alignItems: 'center', gap: 2 },
  todayStatVal: { fontSize: fscale(13), fontWeight: '700', color: '#ccc' },
  todayStatLbl: { fontSize: fscale(9), color: '#aaa', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
  checkinDots: { flexDirection: 'row', gap: 4, paddingVertical: 2 },
  checkinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#333' },
  checkinDotDone: { backgroundColor: '#b8f058' },

  msgList: { flexGrow: 1, padding: 16, gap: 12 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: scale(60), paddingHorizontal: scale(32) },
  emptyColorOrb: {
    width: scale(56), height: scale(56), borderRadius: scale(28),
    marginBottom: scale(20),
  },
  emptyCoachName: { fontSize: fscale(26), fontWeight: '800', fontFamily: 'Syne_800ExtraBold', marginBottom: 8 },
  emptyQuote: { fontSize: fscale(14), color: '#aaa', fontStyle: 'italic', textAlign: 'center', lineHeight: fscale(22) },
  emptySeparator: { width: 32, height: 1, backgroundColor: '#222', marginVertical: 24 },
  emptyPrompt: { fontSize: fscale(15), fontWeight: '700', color: '#fff', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: fscale(13), color: '#999', textAlign: 'center', lineHeight: fscale(20) },

  msgUserWrap: { alignItems: 'flex-end' },
  msgAIWrap: { alignItems: 'flex-start' },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4, paddingLeft: 2 },
  aiLabelDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  aiLabelName: { fontSize: fscale(11), fontWeight: '700', fontFamily: 'DMMono_400Regular' },
  msgBubble: { maxWidth: '85%', borderRadius: 12, padding: scale(12) },
  msgBubbleUser: { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2e2e2e' },
  msgBubbleAI: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1, borderColor: '#2a2a2a', borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  msgBubbleError: { backgroundColor: '#1a0808', borderColor: '#f0606030' },
  msgBubbleStarred: { borderTopColor: '#f5c84040', borderTopWidth: 1 },
  aiLabelStar: { fontSize: fscale(11), marginLeft: 2 },
  msgText: { fontSize: fscale(15), lineHeight: fscale(22), color: '#fff' },
  msgTextUser: { color: '#e0e0e0' },
  msgTime: { fontSize: fscale(11), color: '#aaa', marginTop: 4, fontFamily: 'DMMono_400Regular' },

  inputArea: {
    borderTopWidth: 1, borderTopColor: '#222',
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8,
    gap: 8,
  },
  chipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    borderRadius: 8,
    paddingHorizontal: scale(11), paddingVertical: scale(7),
    borderWidth: 1,
  },
  chipText: { fontSize: fscale(11), fontFamily: 'DMMono_400Regular', letterSpacing: 0.3 },

  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 14,
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1, color: '#fff', fontSize: fscale(15),
    maxHeight: 120, paddingVertical: 6, textAlignVertical: 'top',
  },
  micBtn: { width: scale(36), height: scale(36), justifyContent: 'center', alignItems: 'center' },
  actionIcon: { fontSize: fscale(20) },
  micActive: { color: '#ff4444' },
  sendBtn: {
    width: scale(38), height: scale(38), borderRadius: scale(19),
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnText: { fontSize: fscale(18), fontWeight: '700', color: '#0a0a0a' },
  disabled: { opacity: 0.4 },

  msgCounter: { fontSize: fscale(10), color: '#aaa', textAlign: 'right', fontFamily: 'DMMono_400Regular', paddingRight: 2 },

  typingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2, paddingTop: 4 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#111', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#252525', borderLeftWidth: 3,
  },
  typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#b8f058' },

  coachSwitch: { fontSize: fscale(12), color: '#aaa' },

  pickerOverlay: { flex: 1, backgroundColor: '#00000088' },
  pickerSheet: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
    borderWidth: 1, borderBottomWidth: 0, borderColor: '#252525',
    maxHeight: '75%',
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#333',
    alignSelf: 'center', marginBottom: 16,
  },
  pickerTitle: {
    fontSize: fscale(18), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', marginBottom: 4,
  },
  pickerSub: { fontSize: fscale(12), color: '#aaa', marginBottom: 4 },
  pickerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#161616', borderRadius: 14,
    borderWidth: 1, borderColor: '#2e2e2e',
    padding: scale(14), marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  pickerColorBar: { width: 4, height: scale(38), borderRadius: 2, flexShrink: 0 },
  pickerCardName: { fontSize: fscale(15), fontWeight: '700', fontFamily: 'Syne_800ExtraBold', marginBottom: 2 },
  pickerDivider: { height: 1, backgroundColor: '#252525', marginVertical: 5 },
  pickerCardQuote: { fontSize: fscale(12), color: '#888', fontStyle: 'italic' },
  pickerCheckCircle: {
    width: scale(26), height: scale(26), borderRadius: scale(13),
    borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  pickerCheckDot: { width: scale(9), height: scale(9), borderRadius: scale(4.5) },
  pickerLock: { fontSize: fscale(16) },
});
