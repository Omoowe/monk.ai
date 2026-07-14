import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fscale } from '../utils/scale';

interface ShareCardProps {
  score: number;
  streak: number;
  rank: { label: string; color: string; icon: string };
  completionPct: number;
  habitsThisWeek: number;
  username?: string;
}

function RankShapeCard({ color, score }: { color: string; score: number }) {
  const s = 10;
  if (score >= 86) return <View style={{ width: s, height: s, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />;
  if (score >= 61) return (
    <View style={{ width: 0, height: 0, borderLeftWidth: s * 0.6, borderRightWidth: s * 0.6, borderBottomWidth: s, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
  );
  if (score >= 31) return <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: color }} />;
  return <View style={{ width: s, height: s, borderRadius: s / 2, borderWidth: 1.5, borderColor: color }} />;
}

const ShareCard = forwardRef<View, ShareCardProps>(({
  score, streak, rank, completionPct, habitsThisWeek, username,
}, ref) => {
  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <View style={[styles.glowBlob, { backgroundColor: rank.color + '18' }]} />

      <View style={styles.topRow}>
        <Text style={styles.wordmark}>Monk.ai</Text>
        <View style={[styles.rankPill, { backgroundColor: rank.color + '20', borderColor: rank.color + '50' }]}>
          <RankShapeCard color={rank.color} score={score} />
          <Text style={[styles.rankText, { color: rank.color }]}>{rank.label}</Text>
        </View>
      </View>

      <Text style={[styles.scoreNumber, { color: rank.color }]}>{score}</Text>
      <Text style={styles.scoreLabel}>DOPAMINE SCORE</Text>

      <View style={[styles.barTrack, { backgroundColor: rank.color + '20' }]}>
        <View style={[styles.barFill, { width: `${score}%` as any, backgroundColor: rank.color }]} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: rank.color }]}>{streak}</Text>
          <Text style={styles.statLabel}>DAY STREAK</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: rank.color + '30' }]} />
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: rank.color }]}>{completionPct}%</Text>
          <Text style={styles.statLabel}>THIS WEEK</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: rank.color + '30' }]} />
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: rank.color }]}>{habitsThisWeek}</Text>
          <Text style={styles.statLabel}>HABITS DONE</Text>
        </View>
      </View>

      <View style={styles.footer}>
        {username ? <Text style={styles.footerName}>{username}</Text> : null}
        <Text style={styles.footerUrl}>monkai.app</Text>
      </View>
    </View>
  );
});

ShareCard.displayName = 'ShareCard';
export default ShareCard;

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: '#0a0a0a',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#252525',
    overflow: 'hidden',
  },
  glowBlob: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  wordmark: {
    fontSize: fscale(22),
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Syne_800ExtraBold',
  },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rankText: {
    fontSize: fscale(10),
    fontFamily: 'DMMono_400Regular',
    letterSpacing: 1.5,
  },
  scoreNumber: {
    fontSize: fscale(80),
    fontFamily: 'DMMono_400Regular',
    lineHeight: fscale(86),
    marginBottom: 2,
  },
  scoreLabel: {
    fontSize: fscale(10),
    color: '#555',
    fontFamily: 'DMMono_400Regular',
    letterSpacing: 2,
    marginBottom: 14,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 28,
  },
  barFill: { height: 4, borderRadius: 2 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    padding: 16,
    marginBottom: 24,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statNum: { fontSize: fscale(24), fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  statLabel: { fontSize: fscale(8), color: '#555', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
  statDivider: { width: 1, height: 32 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerName: { fontSize: fscale(11), color: '#666', fontFamily: 'DMMono_400Regular' },
  footerUrl: { fontSize: fscale(11), color: '#444', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
});
