import React, { useState, useEffect } from 'react';
import { fscale, scale } from '../utils/scale';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { getWeeklyReview } from '../services/ai';
import { buildCoachContext } from '../services/context';
import MarkdownText from '../components/MarkdownText';
import { ReviewStatGridSkeleton, ReviewContentSkeleton } from '../components/Skeleton';
import PaywallModal from '../components/PaywallModal';
import { useUser } from '../context/UserContext';

interface WeekData {
  habitsCompleted: number;
  habitsPossible: number;
  perfectDays: number;
  score: number;
  bestHabit: string | null;
  worstHabit: string | null;
  goals: { name: string; progress: number; category: string }[];
}

interface WeekStats {
  habitsCompleted: number;
  habitsPossible: number;
  perfectDays: number;
  score: number;
  completionPct: number;
}

interface Review {
  id: string;
  content: string;
  created_at: string;
  week_of: string | null;
  week_stats: WeekStats | null;
  rating: number | null;
}

function getHeadline(pct: number): string {
  if (pct >= 80) return 'Strong week.';
  if (pct >= 60) return 'Solid effort.';
  if (pct >= 40) return 'Room to grow.';
  return 'Time to reset.';
}

function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    health: '#b8f058', business: '#40f5c8', mindset: '#7b6af0',
    fitness: '#f5c840', learning: '#f0a060', other: '#888',
  };
  return map[cat] ?? '#888';
}

export default function ReviewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { profile } = useUser();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [weekData, setWeekData] = useState<WeekData>({
    habitsCompleted: 0, habitsPossible: 0, perfectDays: 0, score: 0,
    bestHabit: null, worstHabit: null, goals: [],
  });

  const weekLabel = (() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const end = new Date();
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();

  useEffect(() => {
    loadWeekData();
    loadReviews();
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadWeekData);
    return unsub;
  }, [navigation]);

  const loadWeekData = async () => {
    setLoadingData(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const [{ data: userData }, { data: habitsData }, { data: completionsData }, { data: goalsData }] = await Promise.all([
        supabase.from('users').select('dopamine_score').eq('id', user.id).single(),
        supabase.from('habits').select('id, name, streak_days').eq('user_id', user.id),
        supabase.from('habit_completions').select('date, habit_id')
          .eq('user_id', user.id).gte('date', sevenDaysAgoStr),
        supabase.from('goals').select('name, progress, category').eq('user_id', user.id).limit(4),
      ]);

      const totalHabits = habitsData?.length || 0;
      const completedCount = completionsData?.length || 0;
      const habitsPossible = totalHabits * 7;

      const byDate: Record<string, number> = {};
      (completionsData ?? []).forEach((c: any) => {
        byDate[c.date] = (byDate[c.date] || 0) + 1;
      });
      const perfectDays = Object.values(byDate).filter((count) => count >= totalHabits && totalHabits > 0).length;

      const sorted = [...(habitsData ?? [])].sort((a: any, b: any) => (b.streak_days || 0) - (a.streak_days || 0));
      const bestHabit = sorted[0]?.name ?? null;
      const worstHabit = sorted[sorted.length - 1]?.name ?? null;

      setWeekData({
        habitsCompleted: completedCount,
        habitsPossible,
        perfectDays,
        score: userData?.dopamine_score ?? 50,
        bestHabit: bestHabit !== worstHabit ? bestHabit : null,
        worstHabit: sorted.length > 1 ? worstHabit : null,
        goals: (goalsData ?? []).map((g: any) => ({
          name: g.name, progress: g.progress || 0, category: g.category || 'other',
        })),
      });
    } catch (err) {
      console.error('Failed to load week data:', err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingData(false);
    }
  };

  const loadReviews = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('reviews').select('id, content, created_at, week_of, week_stats, rating')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setReviews(data);
    } catch {}
  };

  const doGenerate = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [ctx, checkInsResult] = await Promise.all([
        buildCoachContext(user.id),
        supabase.from('check_ins').select('type, completed, reason')
          .eq('user_id', user.id)
          .gte('date', sevenDaysAgo.toISOString().split('T')[0]),
      ]);

      const checkIns = checkInsResult.data ?? [];
      const eveningCheckins = checkIns.filter((c: any) => c.type === 'evening');
      const weekTotal = eveningCheckins.filter((c: any) => c.completed).length;
      const weekMax = eveningCheckins.length;
      const failedMissions = weekMax - weekTotal;
      const failureReasons = eveningCheckins
        .filter((c: any) => !c.completed && c.reason)
        .map((c: any) => c.reason as string);

      const newReview = await getWeeklyReview(
        ctx.personality || 'stoic_mentor', ctx, weekTotal, weekMax, failedMissions, failureReasons
      );
      const weekOfDate = sevenDaysAgo.toISOString().split('T')[0];
      const storedStats: WeekStats = {
        habitsCompleted: weekData.habitsCompleted,
        habitsPossible: weekData.habitsPossible,
        perfectDays: weekData.perfectDays,
        score: weekData.score,
        completionPct,
      };
      await supabase.from('reviews').insert({
        user_id: user.id,
        content: newReview,
        week_of: weekOfDate,
        week_stats: storedStats,
      });
      await loadReviews();
    } catch (err) {
      console.error('Failed to generate review:', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const generateReview = () => {
    if (!profile?.isPro) { setPaywallVisible(true); return; }
    if (reviews.length > 0) {
      Alert.alert(
        'Generate New Review?',
        'Create a fresh analysis for this week. Old reviews stay in history.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Generate', onPress: doGenerate },
        ]
      );
    } else {
      doGenerate();
    }
  };

  const saveRating = async (reviewId: string, stars: number) => {
    setRatingLoading(true);
    try {
      await supabase.from('reviews').update({ rating: stars }).eq('id', reviewId);
      setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, rating: stars } : r));
    } catch {}
    setRatingLoading(false);
  };

  const completionPct = weekData.habitsPossible > 0
    ? Math.round((weekData.habitsCompleted / weekData.habitsPossible) * 100)
    : 0;
  const headline = getHeadline(completionPct);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>WEEKLY REVIEW</Text>
        <Text style={styles.title}>{headline}</Text>
        <Text style={styles.weekLabel}>
          {reviews.length > 0 && reviews[0].week_of
            ? `Week of ${new Date(reviews[0].week_of).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
            : weekLabel}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadWeekData(); setRefreshing(false); }}
            tintColor="#b8f058"
          />
        }
      >
        {loadingData && !refreshing ? (
          <View style={{ gap: 16, paddingTop: 8 }}>
            <ReviewStatGridSkeleton />
            <ReviewContentSkeleton />
          </View>
        ) : (
          <>
            {/* 2×2 stat grid */}
            <View style={styles.grid}>
              <View style={styles.gridCell}>
                <Text style={styles.gridNumber}>{weekData.habitsCompleted}</Text>
                <Text style={styles.gridLabel}>HABITS</Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.gridNumber}>{completionPct}%</Text>
                <Text style={styles.gridLabel}>RATE</Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.gridNumber}>{weekData.perfectDays}</Text>
                <Text style={styles.gridLabel}>PERFECT DAYS</Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.gridNumber}>{weekData.score}</Text>
                <Text style={styles.gridLabel}>SCORE</Text>
              </View>
            </View>

            {/* Best habit */}
            {weekData.bestHabit && (
              <View style={styles.bestCard}>
                <Text style={styles.habitCardLabel}>BEST HABIT</Text>
                <Text style={styles.habitCardName}>{weekData.bestHabit}</Text>
                <Text style={styles.habitCardSub}>Keep it going — consistency compounds.</Text>
              </View>
            )}

            {/* Needs work */}
            {weekData.worstHabit && (
              <View style={styles.worstCard}>
                <Text style={[styles.habitCardLabel, { color: '#f06060' }]}>NEEDS WORK</Text>
                <Text style={styles.habitCardName}>{weekData.worstHabit}</Text>
                <Text style={styles.habitCardSub}>Focus here next week. Small wins first.</Text>
              </View>
            )}

            {/* Goal progress */}
            {weekData.goals.length > 0 && (
              <View style={styles.goalsCard}>
                <Text style={styles.sectionLabel}>GOAL PROGRESS</Text>
                {weekData.goals.map((goal, i) => {
                  const catColor = getCategoryColor(goal.category);
                  return (
                    <View key={i} style={styles.goalRow}>
                      <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
                      <View style={styles.goalBarWrap}>
                        <View style={styles.goalBarBg}>
                          <View style={[styles.goalBarFill, {
                            width: `${Math.min(goal.progress, 100)}%` as any,
                            backgroundColor: catColor,
                          }]} />
                        </View>
                        <Text style={[styles.goalPct, { color: catColor }]}>{goal.progress}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* AI Review section */}
        <View style={styles.aiSection}>
          <Text style={styles.sectionLabel}>COACH ANALYSIS</Text>
          {reviews.length === 0 ? (
            <View style={styles.generateBox}>
              <Text style={styles.generateTitle}>Your coach has been watching.</Text>
              <Text style={styles.generateSub}>7 days of data. Ready for the truth?</Text>
              <TouchableOpacity
                style={[styles.cta, loading && styles.disabled]}
                onPress={generateReview}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#0a0a0a" />
                  : <Text style={styles.ctaText}>Generate review</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.reviewBox}>
              <View style={styles.reviewCard}>
                <MarkdownText style={styles.reviewText}>{reviews[0].content}</MarkdownText>
              </View>
              <Text style={styles.generatedAt}>
                Generated {new Date(reviews[0].created_at).toLocaleDateString()}
              </Text>

              {/* Star rating */}
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>RATE YOUR WEEK</Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => saveRating(reviews[0].id, n)}
                      disabled={ratingLoading}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Text style={[styles.star, (reviews[0].rating ?? 0) >= n && styles.starActive]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.regenerateBtn, loading && styles.disabled]}
                onPress={generateReview}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#b8f058" size={14} style={{ marginVertical: 2 }} />
                  : <Text style={styles.regenerateBtnText}>↻ Generate new review</Text>}
              </TouchableOpacity>

              {reviews.length > 1 && (
                <View style={styles.historySection}>
                  <Text style={styles.historySectionLabel}>PAST REVIEWS</Text>
                  {reviews.slice(1).map((r) => {
                    const isExpanded = expandedIds.includes(r.id);
                    const ws = r.week_stats;
                    const weekOfLabel = r.week_of
                      ? (() => {
                          const d = new Date(r.week_of + 'T12:00:00');
                          const end = new Date(d);
                          end.setDate(end.getDate() + 6);
                          return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                        })()
                      : new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={styles.historyCard}
                        onPress={() => setExpandedIds(
                          isExpanded
                            ? expandedIds.filter((id) => id !== r.id)
                            : [...expandedIds, r.id]
                        )}
                        activeOpacity={0.7}
                      >
                        <View style={styles.historyCardHeader}>
                          <Text style={styles.historyDate}>{weekOfLabel}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {r.rating ? (
                              <Text style={styles.historyRating}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                            ) : null}
                            <Text style={styles.historyChevron}>{isExpanded ? '▲' : '▼'}</Text>
                          </View>
                        </View>
                        {ws && (
                          <View style={styles.historyStats}>
                            <View style={styles.historyStatPill}>
                              <Text style={styles.historyStatVal}>{ws.completionPct}%</Text>
                              <Text style={styles.historyStatLbl}>RATE</Text>
                            </View>
                            <View style={styles.historyStatPill}>
                              <Text style={styles.historyStatVal}>{ws.score}</Text>
                              <Text style={styles.historyStatLbl}>SCORE</Text>
                            </View>
                            <View style={styles.historyStatPill}>
                              <Text style={styles.historyStatVal}>{ws.perfectDays}</Text>
                              <Text style={styles.historyStatLbl}>PERFECT</Text>
                            </View>
                            <View style={styles.historyStatPill}>
                              <Text style={styles.historyStatVal}>{ws.habitsCompleted}</Text>
                              <Text style={styles.historyStatLbl}>HABITS</Text>
                            </View>
                          </View>
                        )}
                        {isExpanded && (
                          <MarkdownText style={[styles.reviewText, { marginTop: 12, fontSize: fscale(14) }]}>{r.content}</MarkdownText>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      <PaywallModal visible={paywallVisible} trigger="review" onClose={() => setPaywallVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  backBtn: { marginBottom: 12 },
  backBtnText: { fontSize: fscale(13), color: '#666', fontFamily: 'DMMono_400Regular' },
  eyebrow: { fontSize: fscale(11), letterSpacing: 1.5, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: fscale(22), fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', marginBottom: 2 },
  weekLabel: { fontSize: fscale(11), color: '#aaa', fontFamily: 'DMMono_400Regular' },

  content: { padding: 16, paddingBottom: 40, gap: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#111', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#252525', alignItems: 'center',
  },
  gridNumber: { fontSize: fscale(32), color: '#fff', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  gridLabel: { fontSize: fscale(9), color: '#aaa', fontFamily: 'DMMono_400Regular', letterSpacing: 2, textAlign: 'center' },

  bestCard: {
    backgroundColor: '#0d1a07', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#b8f05840',
  },
  worstCard: {
    backgroundColor: '#1a0808', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#f0606040',
  },
  habitCardLabel: { fontSize: fscale(11), letterSpacing: 1.5, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 6 },
  habitCardName: { fontSize: fscale(18), fontWeight: '700', color: '#fff', marginBottom: 4 },
  habitCardSub: { fontSize: fscale(12), color: '#999' },

  goalsCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#252525', gap: 12,
  },
  sectionLabel: { fontSize: fscale(11), letterSpacing: 1.5, color: '#999', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  goalRow: { gap: 6 },
  goalName: { fontSize: fscale(13), color: '#ccc', fontWeight: '600' },
  goalBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalBarBg: { flex: 1, height: 8, backgroundColor: '#222', borderRadius: 4 },
  goalBarFill: { height: 8, borderRadius: 4 },
  goalPct: { fontSize: fscale(11), fontFamily: 'DMMono_400Regular', width: 34 },

  aiSection: { gap: 10 },
  generateBox: {
    backgroundColor: '#111', borderRadius: 12, padding: 24,
    borderWidth: 1, borderColor: '#252525', alignItems: 'center', gap: 10,
  },
  generateTitle: { fontSize: fscale(17), fontWeight: '700', color: '#fff', textAlign: 'center' },
  generateSub: { fontSize: fscale(13), color: '#aaa', textAlign: 'center' },
  cta: {
    backgroundColor: '#b8f058', borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center', marginTop: 4,
  },
  ctaText: { color: '#0a0a0a', fontWeight: '700', fontSize: fscale(14) },
  disabled: { opacity: 0.4 },
  teaserBox: {
    width: '100%', backgroundColor: '#0d1a07', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#b8f05830', gap: 8,
  },
  teaserItem: { fontSize: fscale(13), color: '#6a9030', lineHeight: 20 },

  reviewBox: { gap: 10 },
  reviewCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#252525', borderLeftWidth: 3, borderLeftColor: '#b8f058',
  },
  reviewText: { fontSize: fscale(15), color: '#ddd', lineHeight: 26 },
  generatedAt: { fontSize: fscale(11), color: '#999', fontFamily: 'DMMono_400Regular', textAlign: 'center' },
  regenerateBtn: { alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10 },
  regenerateBtnText: { color: '#aaa', fontSize: fscale(13) },

  historySection: { gap: 8, marginTop: 4 },
  historySectionLabel: { fontSize: fscale(11), letterSpacing: 1.5, color: '#999', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  historyCard: {
    backgroundColor: '#0d0d0d', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#252525',
  },
  historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { fontSize: fscale(13), color: '#ccc', fontFamily: 'DMMono_400Regular' },
  historyChevron: { fontSize: fscale(10), color: '#aaa' },
  historyStats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  historyStatPill: {
    flex: 1, backgroundColor: '#161616', borderRadius: 8, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#252525',
  },
  historyStatVal: { fontSize: fscale(16), fontWeight: '700', color: '#b8f058', fontFamily: 'DMMono_400Regular' },
  historyStatLbl: { fontSize: fscale(8), color: '#aaa', fontFamily: 'DMMono_400Regular', letterSpacing: 1, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  ratingLabel: { fontSize: fscale(9), color: '#aaa', fontFamily: 'DMMono_400Regular', letterSpacing: 2, flex: 1 },
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: fscale(24), color: '#2a2a2a' },
  starActive: { color: '#f5c840' },
  historyRating: { fontSize: fscale(11), color: '#aaa' },
});
