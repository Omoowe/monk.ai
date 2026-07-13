import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface Props {
  habitId: string | null;
  habitName: string;
  habitEmoji: string;
  visible: boolean;
  onClose: () => void;
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getLast35Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
}

function longestStreak(completedSet: Set<string>, days: Date[]): number {
  let best = 0;
  let cur = 0;
  for (const d of days) {
    if (completedSet.has(fmt(d))) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

export default function HabitHistoryModal({ habitId, habitName, habitEmoji, visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !habitId) return;
    setLoading(true);
    const days = getLast35Days();
    const from = fmt(days[0]);
    const to = fmt(days[days.length - 1]);
    supabase
      .from('habit_completions')
      .select('date')
      .eq('habit_id', habitId)
      .gte('date', from)
      .lte('date', to)
      .then(({ data }) => {
        setCompleted(new Set((data ?? []).map((r: any) => r.date)));
        setLoading(false);
      });
  }, [visible, habitId]);

  const days = getLast35Days();
  const today = fmt(new Date());

  // Build weeks (Mon-aligned)
  const firstDow = days[0].getDay() === 0 ? 6 : days[0].getDay() - 1;
  const cells: (Date | null)[] = [...Array(firstDow).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const thisMonthDays = days.filter((d) => {
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthDone = thisMonthDays.filter((d) => completed.has(fmt(d))).length;
  const rate = thisMonthDays.length > 0 ? Math.round((thisMonthDone / thisMonthDays.length) * 100) : 0;
  const best = longestStreak(completed, days);
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.habitEmoji}>{habitEmoji}</Text>
            <Text style={styles.habitName}>{habitName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#b8f058" style={{ marginVertical: 40 }} />
          ) : (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <Text style={styles.statVal}>{best}</Text>
                  <Text style={styles.statLbl}>LONGEST{'\n'}STREAK</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={styles.statVal}>{thisMonthDone}/{thisMonthDays.length}</Text>
                  <Text style={styles.statLbl}>THIS{'\n'}MONTH</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={[styles.statVal, { color: rate >= 80 ? '#b8f058' : rate >= 50 ? '#f5c840' : '#f06060' }]}>
                    {rate}%
                  </Text>
                  <Text style={styles.statLbl}>MONTHLY{'\n'}RATE</Text>
                </View>
              </View>

              <View style={styles.calCard}>
                <View style={styles.dayLabels}>
                  {DAY_LABELS.map((l, i) => (
                    <Text key={i} style={styles.dayLabel}>{l}</Text>
                  ))}
                </View>
                {weeks.map((week, wi) => (
                  <View key={wi} style={styles.weekRow}>
                    {week.map((day, di) => {
                      if (!day) return <View key={di} style={styles.cell} />;
                      const dateStr = fmt(day);
                      const done = completed.has(dateStr);
                      const isToday = dateStr === today;
                      const future = day > new Date(today);
                      return (
                        <View
                          key={di}
                          style={[
                            styles.cell,
                            done && styles.cellDone,
                            isToday && styles.cellToday,
                            future && styles.cellFuture,
                          ]}
                        >
                          <Text style={[
                            styles.cellNum,
                            done && styles.cellNumDone,
                            future && styles.cellNumFuture,
                          ]}>
                            {day.getDate()}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12,
  },
  handle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  habitEmoji: { fontSize: 24 },
  habitName: { flex: 1, fontSize: 18, color: '#fff', fontWeight: '700' },
  closeBtn: { padding: 6 },
  closeBtnText: { fontSize: 16, color: '#666' },

  statsRow: {
    flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, marginBottom: 16, alignItems: 'center',
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 22, color: '#fff', fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  statLbl: { fontSize: 8, color: '#888', fontFamily: 'DMMono_400Regular', letterSpacing: 1, textAlign: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: '#2a2a2a' },

  calCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14 },
  dayLabels: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  dayLabel: { width: 34, textAlign: 'center', fontSize: 9, color: '#777', fontFamily: 'DMMono_400Regular' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  cell: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cellDone: { backgroundColor: '#1a3a0a', borderWidth: 1, borderColor: '#4a7020' },
  cellToday: { borderWidth: 1, borderColor: '#b8f058' },
  cellFuture: { opacity: 0.25 },
  cellNum: { fontSize: 11, color: '#888', fontFamily: 'DMMono_400Regular' },
  cellNumDone: { color: '#b8f058' },
  cellNumFuture: { color: '#333' },
});
