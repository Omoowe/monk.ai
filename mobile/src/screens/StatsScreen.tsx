import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  RefreshControl,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { StatsScoreSkeleton, StatsBarChartSkeleton, StatCardSkeleton } from '../components/Skeleton';

interface DayBar {
  label: string;
  done: number;
  total: number;
}

function getRank(score: number): { label: string; color: string; icon: string } {
  if (score >= 86) return { label: 'MONK ELITE',   color: '#b8f058', icon: '◆' };
  if (score >= 61) return { label: 'DISCIPLINED',  color: '#40f5c8', icon: '▲' };
  if (score >= 31) return { label: 'RISING FORCE', color: '#f5c840', icon: '●' };
  return              { label: 'AWAKENING',      color: '#f0a060', icon: '○' };
}

function RankShape({ color, score, size = 8 }: { color: string; score: number; size?: number }) {
  if (score >= 86) {
    return <View style={{ width: size, height: size, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />;
  }
  if (score >= 61) {
    return (
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: size * 0.6, borderRightWidth: size * 0.6, borderBottomWidth: size,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color,
      }} />
    );
  }
  if (score >= 31) {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
  }
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color }} />;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getLastSevenDates(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function CountText({ anim, color, scaleAnim }: { anim: Animated.Value; color: string; scaleAnim: Animated.Value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    return () => anim.removeListener(id);
  }, [anim]);
  return (
    <Animated.Text style={[styles.scoreNumber, { color, transform: [{ scale: scaleAnim }] }]}>
      {display}
    </Animated.Text>
  );
}

export default function StatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [dopamineScore, setDopamineScore] = useState(50);
  const [streak, setStreak] = useState(0);
  const [weekStats, setWeekStats] = useState({ completed: 0, total: 0, perfectDays: 0 });
  const [dailyBars, setDailyBars] = useState<DayBar[]>([]);
  const [personalBests, setPersonalBests] = useState({ totalHabits: 0, totalMissions: 0 });
  const [checkInsWeek, setCheckInsWeek] = useState({ morning: 0, evening: 0 });
  const [categoryStats, setCategoryStats] = useState<Array<{ id: string; label: string; color: string; done: number; total: number }>>([]);
  const [leaderboard, setLeaderboard] = useState<Array<{ id: string; name: string; dopamine_score: number; streak: number; avatar?: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthData, setMonthData] = useState<Record<string, { done: number; total: number }>>({});
  const [focusMinutesWeek, setFocusMinutesWeek] = useState(0);
  const [focusSessionsWeek, setFocusSessionsWeek] = useState(0);
  const barAnims = useRef<Animated.Value[]>(Array.from({ length: 7 }, () => new Animated.Value(0)));
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
    loadStats();
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadStats);
    return unsub;
  }, [navigation]);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const dates = getLastSevenDates();
      const sevenDaysAgoStr = dates[0];

      const [
        { data: userData },
        { data: habitsData },
        { data: completionsData },
        { data: checkInsData },
        { count: totalHabitsAllTime },
        { count: totalMissionsWon },
      ] = await Promise.all([
        supabase.from('users').select('dopamine_score, streak').eq('id', user.id).single(),
        supabase.from('habits').select('id, category').eq('user_id', user.id),
        supabase.from('habit_completions').select('date, habit_id').eq('user_id', user.id).gte('date', sevenDaysAgoStr),
        supabase.from('check_ins').select('type').eq('user_id', user.id).gte('date', sevenDaysAgoStr),
        supabase.from('habit_completions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('check_ins').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'evening').eq('completed', true),
      ]);

      if (userData) {
        const score = userData.dopamine_score || 50;
        setDopamineScore(score);
        setStreak(userData.streak || 0);
        countAnim.setValue(0);
        Animated.spring(countAnim, { toValue: score, tension: 40, friction: 8, useNativeDriver: false }).start();
      }

      const morningDone = checkInsData?.filter((c: any) => c.type === 'morning').length || 0;
      const eveningDone = checkInsData?.filter((c: any) => c.type === 'evening').length || 0;
      setCheckInsWeek({ morning: morningDone, evening: eveningDone });
      setPersonalBests({ totalHabits: totalHabitsAllTime || 0, totalMissions: totalMissionsWon || 0 });

      const totalHabits = habitsData?.length || 0;
      const totalPossible = totalHabits * 7;
      const completedCount = completionsData?.length || 0;

      const completionsByDate: Record<string, number> = {};
      (completionsData ?? []).forEach((c: any) => {
        completionsByDate[c.date] = (completionsByDate[c.date] || 0) + 1;
      });

      const bars: DayBar[] = dates.map((date) => ({
        label: DAY_LABELS[new Date(date + 'T12:00:00').getDay() === 0 ? 6 : new Date(date + 'T12:00:00').getDay() - 1],
        done: completionsByDate[date] || 0,
        total: totalHabits,
      }));
      setDailyBars(bars);
      bars.forEach((bar, i) => {
        const fillPct = bar.total > 0 ? bar.done / bar.total : 0;
        Animated.spring(barAnims.current[i], {
          toValue: fillPct,
          useNativeDriver: false,
          tension: 50,
          friction: 8,
          delay: i * 60,
        }).start();
      });

      const perfectDays = bars.filter((b) => b.total > 0 && b.done >= b.total).length;
      setWeekStats({ completed: completedCount, total: totalPossible, perfectDays });

      // Category breakdown
      const CAT_COLORS: Record<string, string> = {
        health: '#b8f058', fitness: '#f5c840', mindset: '#7b6af0',
        learning: '#40f5c8', productivity: '#b8f058', other: '#888888',
      };
      const CAT_LABELS: Record<string, string> = {
        health: 'Health', fitness: 'Fitness', mindset: 'Mindset',
        learning: 'Learning', productivity: 'Productivity', other: 'Other',
      };
      const habitCatMap: Record<string, string> = {};
      (habitsData ?? []).forEach((h: any) => { habitCatMap[h.id] = h.category || 'other'; });
      const catDone: Record<string, number> = {};
      const catTotal: Record<string, number> = {};
      (habitsData ?? []).forEach((h: any) => {
        const cat = h.category || 'other';
        catTotal[cat] = (catTotal[cat] || 0) + 7;
      });
      (completionsData ?? []).forEach((c: any) => {
        const cat = habitCatMap[c.habit_id] || 'other';
        catDone[cat] = (catDone[cat] || 0) + 1;
      });
      const catArr = Object.keys(catTotal)
        .map((cat) => ({
          id: cat,
          label: CAT_LABELS[cat] || cat,
          color: CAT_COLORS[cat] || '#888',
          done: catDone[cat] || 0,
          total: catTotal[cat],
        }))
        .sort((a, b) => (b.done / b.total) - (a.done / a.total));
      setCategoryStats(catArr);

      // Monthly heatmap data
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const { data: monthCompletions } = await supabase
        .from('habit_completions').select('date, habit_id')
        .eq('user_id', user.id).gte('date', monthStart);
      const monthByDate: Record<string, { done: number; total: number }> = {};
      (monthCompletions ?? []).forEach((c: any) => {
        if (!monthByDate[c.date]) monthByDate[c.date] = { done: 0, total: totalHabits };
        monthByDate[c.date].done += 1;
      });
      setMonthData(monthByDate);

      // Focus sessions this week
      const weekAgoISO = `${sevenDaysAgoStr}T00:00:00.000Z`;
      const { data: focusData } = await supabase
        .from('monk_sessions')
        .select('duration_minutes')
        .eq('user_id', user.id)
        .gte('completed_at', weekAgoISO);
      if (focusData) {
        setFocusSessionsWeek(focusData.length);
        setFocusMinutesWeek(focusData.reduce((acc: number, s: any) => acc + s.duration_minutes, 0));
      }

      // Leaderboard
      const { data: lbData } = await supabase.from('leaderboard').select('id, name, dopamine_score, streak, avatar');
      setLeaderboard(lbData ?? []);
    } catch (err) {
      console.error('Failed to load stats:', err instanceof Error ? err.message : String(err));
    } finally {
      setDataLoading(false);
    }
  };

  const rank = getRank(dopamineScore);
  const completionPct = weekStats.total > 0 ? Math.round((weekStats.completed / weekStats.total) * 100) : 0;
  const barMaxHeight = 80;

  const shareStats = async () => {
    const rankInfo = getRank(dopamineScore);
    await Share.share({
      message: `${rankInfo.icon} Monk.ai — Week ${completionPct}% completion · ${dopamineScore} dopamine score · ${streak} day streak · rank: ${rankInfo.label}\n\nmonkai://stats`,
    });
  };

  const weekOf = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `Week of ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  })();

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR NUMBERS</Text>
          <Text style={styles.title}>Stats</Text>
          <Text style={styles.weekLabel}>{weekOf}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={shareStats}>
            <Text style={styles.headerActionText}>↑</Text>
            <Text style={styles.headerActionLabel}>SHARE</Text>
          </TouchableOpacity>
          <View style={styles.headerActionDivider} />
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('Review')}>
            <Text style={[styles.headerActionText, { color: '#b8f058' }]}>✦</Text>
            <Text style={[styles.headerActionLabel, { color: '#b8f058' }]}>REVIEW</Text>
          </TouchableOpacity>
          <View style={styles.headerActionDivider} />
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.headerActionText}>⚙</Text>
            <Text style={styles.headerActionLabel}>PROFILE</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadStats(); setRefreshing(false); }} tintColor="#b8f058" />}
      >
        {dataLoading ? (
          <View style={{ gap: 16, paddingTop: 4 }}>
            <StatsScoreSkeleton />
            <StatsBarChartSkeleton />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
          </View>
        ) : (
        <>
        {weekStats.total === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconView, { borderColor: '#252525' }]}>
              <Text style={{ fontSize: 28, color: '#333' }}>◆</Text>
            </View>
            <Text style={styles.emptyTitle}>Zero data. Start training.</Text>
            <Text style={styles.emptySub}>Add habits in Check-In and complete your first check-in. Stats appear the moment you start.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('App', { screen: 'CheckIn' })}>
              <Text style={styles.emptyBtnText}>Add habits →</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Score card — only when there's data */}
        {weekStats.total > 0 && (
          <View style={[styles.scoreCard, { overflow: 'hidden' }]}>
            <View style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: rank.color + '0b' }} />
            <Text style={styles.scoreLabel}>DOPAMINE SCORE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 8 }}>
              <CountText anim={countAnim} color={rank.color} scaleAnim={scaleAnim} />
              <View style={{ flex: 1, paddingBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <RankShape color={rank.color} score={dopamineScore} size={8} />
                  <Text style={[styles.rankLine, { color: rank.color, marginTop: 0, marginBottom: 0 }]}>{rank.label}</Text>
                </View>
                <View style={styles.scoreBar}>
                  <View style={[styles.scoreFillBg, { width: '100%', backgroundColor: rank.color + '60' }]} />
                  <View style={[styles.scoreFill, { width: `${dopamineScore}%` as any, backgroundColor: rank.color }]} />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Hero row — 2 dominant stats */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.gridCellHero, { borderColor: rank.color + '40' }]}>
            <Text style={[styles.gridNumberHero, { color: rank.color }]}>{weekStats.completed}</Text>
            <Text style={styles.gridLabel}>HABITS THIS WEEK</Text>
          </View>
          <View style={[styles.gridCellHero, { borderColor: rank.color + '25' }]}>
            <Text style={[styles.gridNumberHero, { color: rank.color }]}>{completionPct}%</Text>
            <Text style={styles.gridLabel}>COMPLETION RATE</Text>
          </View>
        </View>
        {/* Secondary grid */}
        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <Text style={styles.gridNumber}>{streak}</Text>
            <Text style={styles.gridLabel}>CURRENT STREAK</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridNumber}>{weekStats.perfectDays}</Text>
            <Text style={styles.gridLabel}>PERFECT DAYS</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridNumber}>{checkInsWeek.morning}/7</Text>
            <Text style={styles.gridLabel}>MORNING CHECK-INS</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridNumber}>{checkInsWeek.evening}/7</Text>
            <Text style={styles.gridLabel}>EVENING DEBRIEFS</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={[styles.gridNumber, focusSessionsWeek > 0 && { color: '#b8f058' }]}>{focusSessionsWeek}</Text>
            <Text style={styles.gridLabel}>FOCUS SESSIONS</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={[styles.gridNumber, focusMinutesWeek > 0 && { color: '#b8f058' }]}>{focusMinutesWeek}</Text>
            <Text style={styles.gridLabel}>FOCUS MINUTES</Text>
          </View>
        </View>

        {/* 7-day bar chart */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionLabel}>LAST 7 DAYS</Text>
          <View style={styles.chart}>
            {dailyBars.map((bar, i) => {
              const isToday = i === dailyBars.length - 1;
              const pct = bar.total > 0 ? Math.round((bar.done / bar.total) * 100) : 0;
              const barColor = pct === 100 ? rank.color : pct > 50 ? rank.color + 'aa' : '#2a2a2a';
              const animH = barAnims.current[i].interpolate({
                inputRange: [0, 1],
                outputRange: [0, barMaxHeight],
              });
              return (
                <View key={i} style={styles.chartCol}>
                  <Text style={styles.chartPct}>{bar.total > 0 ? `${pct}%` : ''}</Text>
                  <View style={[styles.barBg, { height: barMaxHeight }]}>
                    <Animated.View style={[styles.barFill, { height: animH, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.chartDay, isToday && { color: rank.color }]}>{bar.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Habit Insights */}
        {categoryStats.length > 0 && (
          <View style={styles.insightsCard}>
            <Text style={styles.sectionLabel}>HABIT INSIGHTS</Text>
            {categoryStats.map((cat) => {
              const pct = cat.total > 0 ? Math.round((cat.done / cat.total) * 100) : 0;
              return (
                <View key={cat.id} style={styles.catRow}>
                  <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label.toUpperCase()}</Text>
                  <View style={styles.catBarBg}>
                    <View style={[styles.catBarFill, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
                  </View>
                  <Text style={styles.catPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Personal Bests */}
        <View style={styles.bestsCard}>
          <Text style={styles.sectionLabel}>PERSONAL BESTS</Text>
          <View style={styles.pbRow}>
            <View style={[styles.pbIconView, { backgroundColor: rank.color + '18', borderColor: rank.color + '35' }]} />
            <Text style={styles.pbName}>All-time habits done</Text>
            <Text style={[styles.pbValue, { color: rank.color }]}>{personalBests.totalHabits}</Text>
          </View>
          <View style={styles.pbRow}>
            <View style={[styles.pbIconView, { backgroundColor: '#40f5c818', borderColor: '#40f5c835' }]} />
            <Text style={styles.pbName}>Missions won</Text>
            <Text style={[styles.pbValue, { color: '#40f5c8' }]}>{personalBests.totalMissions}</Text>
          </View>
          <View style={[styles.pbRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.pbIconView, { backgroundColor: rank.color + '18', borderColor: rank.color + '35' }]}>
              <RankShape color={rank.color} score={dopamineScore} size={8} />
            </View>
            <Text style={styles.pbName}>Current rank</Text>
            <Text style={[styles.pbValue, { color: rank.color, fontSize: 12, letterSpacing: 1 }]}>{rank.label}</Text>
          </View>
        </View>

        {/* Streak Calendar */}
        {(() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();
          const today = now.toISOString().split('T')[0];
          const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          const firstDay = new Date(year, month, 1);
          const firstDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon=0
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const cells: (number | null)[] = [
            ...Array(firstDow).fill(null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ];
          while (cells.length % 7 !== 0) cells.push(null);
          const weeks: (number | null)[][] = [];
          for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
          const getCellColor = (day: number) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (dateStr > today) return '#111';
            const d = monthData[dateStr];
            if (!d || d.done === 0) return '#1a1a1a';
            if (d.total === 0) return '#1a1a1a';
            const ratio = d.done / d.total;
            if (ratio >= 1) return '#b8f058';
            if (ratio >= 0.5) return '#4a7020';
            return '#2a4010';
          };
          return (
            <View style={styles.calCard}>
              <Text style={styles.sectionLabel}>STREAK CALENDAR</Text>
              <Text style={styles.calMonth}>{monthName}</Text>
              <View style={styles.calDayRow}>
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <Text key={i} style={styles.calDayLabel}>{d}</Text>
                ))}
              </View>
              {weeks.map((week, wi) => (
                <View key={wi} style={styles.calWeekRow}>
                  {week.map((day, di) => {
                    if (!day) return <View key={di} style={styles.calCell} />;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isToday = dateStr === today;
                    return (
                      <View key={di} style={[styles.calCell, { backgroundColor: getCellColor(day) }, isToday && styles.calCellToday]}>
                        <Text style={[styles.calDayNum, isToday && { color: '#b8f058' }]}>{day}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
              <View style={styles.calLegend}>
                {[['#1a1a1a','None'],['#2a4010','Partial'],['#4a7020','50%+'],['#b8f058','All done']].map(([c,l]) => (
                  <View key={l} style={styles.calLegendItem}>
                    <View style={[styles.calLegendDot, { backgroundColor: c }]} />
                    <Text style={styles.calLegendText}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <View style={styles.lbCard}>
            <Text style={styles.sectionLabel}>LEADERBOARD</Text>
            {leaderboard.map((entry, i) => {
              const isMe = entry.id === currentUserId;
              return (
                <View key={entry.id} style={[styles.lbRow, isMe && styles.lbRowMe, i === leaderboard.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.lbRankBadge, i < 3 && { backgroundColor: (i === 0 ? '#f5c840' : i === 1 ? '#aaaaaa' : '#cd7f32') + '20', borderColor: (i === 0 ? '#f5c840' : i === 1 ? '#aaaaaa' : '#cd7f32') + '50' }]}>
                    <Text style={[styles.lbRankText, i < 3 && { color: i === 0 ? '#f5c840' : i === 1 ? '#aaaaaa' : '#cd7f32' }]}>{i + 1}</Text>
                  </View>
                  {entry.avatar ? <Text style={styles.lbAvatar}>{entry.avatar}</Text> : null}
                  <Text style={[styles.lbName, isMe && { color: rank.color }]} numberOfLines={1}>
                    {entry.name}{isMe ? ' (you)' : ''}
                  </Text>
                  <View style={styles.lbScores}>
                    <Text style={[styles.lbScore, isMe && { color: rank.color }]}>{entry.dopamine_score}</Text>
                    <Text style={styles.lbStreak}>{entry.streak}d</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#222',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', marginBottom: 2 },
  weekLabel: { fontSize: 11, color: '#aaa', fontFamily: 'DMMono_400Regular' },
  profileBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  profileBtnText: { fontSize: 16, color: '#aaa' },
  headerActions: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#161616', borderRadius: 12,
    borderWidth: 1, borderColor: '#2e2e2e', marginTop: 8,
    overflow: 'hidden',
  },
  headerActionBtn: { paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', gap: 3 },
  headerActionText: { fontSize: 15, color: '#aaa' },
  headerActionLabel: { fontSize: 8, color: '#555', fontFamily: 'DMMono_400Regular', letterSpacing: 0.8 },
  headerActionDivider: { width: 1, height: 28, backgroundColor: '#2e2e2e' },

  content: { padding: 16, paddingBottom: 40, gap: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIconView: { width: 64, height: 64, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold' },
  emptySub: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  emptyBtn: { marginTop: 8, backgroundColor: '#b8f058', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 14 },

  scoreCard: {
    backgroundColor: '#111', borderRadius: 14, padding: 24,
    borderWidth: 1, borderColor: '#252525',
  },
  scoreLabel: { fontSize: 11, letterSpacing: 1.5, color: '#999', fontFamily: 'DMMono_400Regular' },
  scoreNumber: { fontSize: 80, fontFamily: 'DMMono_400Regular', lineHeight: 88 },
  rankLine: { fontSize: 13, fontFamily: 'DMMono_400Regular', letterSpacing: 2 },
  scoreBar: { width: '100%', height: 10, backgroundColor: '#222', borderRadius: 5, overflow: 'hidden' },
  scoreFillBg: { position: 'absolute', height: 10, borderRadius: 5 },
  scoreFill: { height: 10, borderRadius: 5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCellHero: {
    flex: 1, backgroundColor: '#111', borderRadius: 14, padding: 20,
    borderWidth: 1,
  },
  gridNumberHero: { fontSize: 42, fontFamily: 'DMMono_400Regular', marginBottom: 6 },
  gridCell: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#111', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1e1e1e', alignItems: 'center',
  },
  gridNumber: { fontSize: 26, color: '#fff', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  gridLabel: { fontSize: 9, color: '#666', fontFamily: 'DMMono_400Regular', letterSpacing: 1.5, textAlign: 'center' },

  chartCard: {
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#252525',
  },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, color: '#999', fontFamily: 'DMMono_400Regular', marginBottom: 16 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartPct: { fontSize: 9, color: '#aaa', fontFamily: 'DMMono_400Regular' },
  barBg: { width: '85%', backgroundColor: '#1a1a1a', borderRadius: 4, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, borderRadius: 4 },
  chartDay: { fontSize: 9, color: '#aaa', fontFamily: 'DMMono_400Regular' },

  bestsCard: {
    backgroundColor: '#111', borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: '#252525',
  },
  pbRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', gap: 10,
  },
  pbIconView: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pbName: { flex: 1, fontSize: 14, color: '#ccc', fontWeight: '500' },
  pbValue: { fontSize: 18, fontFamily: 'DMMono_400Regular', fontWeight: '700' },

  insightsCard: {
    backgroundColor: '#111', borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: '#252525',
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 18, gap: 12,
  },
  catMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catLabel: {
    fontSize: 13, fontWeight: '800', fontFamily: 'DMMono_400Regular',
    letterSpacing: 1, width: 110,
  },
  catPct: {
    fontSize: 18, fontWeight: '700', color: '#fff',
    fontFamily: 'DMMono_400Regular', width: 48, textAlign: 'right',
  },
  catBarBg: {
    flex: 1, height: 20, backgroundColor: '#1e1e1e',
    borderRadius: 6, overflow: 'hidden',
  },
  catBarFill: { height: 20, borderRadius: 6 },

  lbCard: { backgroundColor: '#111', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#252525' },
  lbRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  lbRowMe: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 8, marginHorizontal: -8 },
  lbRankBadge: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, borderColor: '#252525', alignItems: 'center', justifyContent: 'center' },
  lbRankText: { fontSize: 12, color: '#999', fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  lbAvatar: { fontSize: 18, width: 26 },
  lbName: { flex: 1, fontSize: 14, color: '#ccc', fontWeight: '600' },
  lbScores: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lbScore: { fontSize: 18, color: '#fff', fontFamily: 'DMMono_400Regular' },
  lbStreak: { fontSize: 11, color: '#555', fontFamily: 'DMMono_400Regular' },

  calCard: { backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#252525' },
  calMonth: { fontSize: 11, letterSpacing: 1.5, color: '#999', fontFamily: 'DMMono_400Regular', marginBottom: 12 },
  calDayRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  calDayLabel: { fontSize: 9, color: '#999', fontFamily: 'DMMono_400Regular', width: 32, textAlign: 'center' },
  calWeekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
  calCell: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  calCellToday: { borderWidth: 1, borderColor: '#b8f058' },
  calDayNum: { fontSize: 10, fontFamily: 'DMMono_400Regular' },
  calLegend: { flexDirection: 'row', gap: 12, marginTop: 12, justifyContent: 'flex-end' },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendDot: { width: 10, height: 10, borderRadius: 3 },
  calLegendText: { fontSize: 9, color: '#999', fontFamily: 'DMMono_400Regular' },
});
