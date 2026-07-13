import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4,  duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: '#1e1e1e', opacity }, style]}
    />
  );
}

// Pre-built skeleton layouts for each screen

export function GoalCardSkeleton() {
  return (
    <View style={sk.goalCard}>
      <View style={sk.row}>
        <SkeletonBox width={120} height={12} borderRadius={4} />
        <SkeletonBox width={48} height={20} borderRadius={10} />
      </View>
      <SkeletonBox width="85%" height={20} borderRadius={5} style={{ marginTop: 10 }} />
      <SkeletonBox width="60%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
      <View style={[sk.row, { marginTop: 14 }]}>
        <SkeletonBox width="100%" height={6} borderRadius={3} />
      </View>
      <View style={[sk.row, { marginTop: 10 }]}>
        <SkeletonBox width={70} height={11} borderRadius={4} />
        <SkeletonBox width={50} height={11} borderRadius={4} />
      </View>
    </View>
  );
}

export function HabitRowSkeleton() {
  return (
    <View style={sk.habitRow}>
      <SkeletonBox width={32} height={32} borderRadius={8} />
      <SkeletonBox width="55%" height={14} borderRadius={4} />
      <SkeletonBox width={40} height={11} borderRadius={4} style={{ marginLeft: 'auto' }} />
      <SkeletonBox width={24} height={24} borderRadius={6} />
    </View>
  );
}

export function StatCardSkeleton() {
  return (
    <View style={sk.statCard}>
      <SkeletonBox width={36} height={11} borderRadius={3} />
      <SkeletonBox width={64} height={28} borderRadius={6} style={{ marginTop: 8 }} />
      <SkeletonBox width={80} height={11} borderRadius={3} style={{ marginTop: 6 }} />
    </View>
  );
}

export function ReviewStatGridSkeleton() {
  return (
    <View style={sk.statGrid}>
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </View>
  );
}

export function ReviewContentSkeleton() {
  return (
    <View style={sk.reviewContent}>
      <SkeletonBox width={90}  height={10} borderRadius={3} />
      <SkeletonBox width="100%" height={14} borderRadius={4} style={{ marginTop: 12 }} />
      <SkeletonBox width="95%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
      <SkeletonBox width="80%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
      <SkeletonBox width="90%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
      <SkeletonBox width="70%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
      <SkeletonBox width="85%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
    </View>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <View style={sk.profileHeader}>
      <SkeletonBox width={72} height={72} borderRadius={36} />
      <SkeletonBox width={140} height={20} borderRadius={6} style={{ marginTop: 12 }} />
      <SkeletonBox width={100} height={13} borderRadius={4} style={{ marginTop: 6 }} />
      <View style={[sk.row, { marginTop: 20, gap: 12 }]}>
        <SkeletonBox width={80} height={56} borderRadius={10} />
        <SkeletonBox width={80} height={56} borderRadius={10} />
        <SkeletonBox width={80} height={56} borderRadius={10} />
      </View>
    </View>
  );
}

export function ProfileRowSkeleton() {
  return (
    <View style={sk.profileRow}>
      <SkeletonBox width={28} height={28} borderRadius={6} />
      <SkeletonBox width="60%" height={14} borderRadius={4} />
      <SkeletonBox width={60} height={14} borderRadius={4} style={{ marginLeft: 'auto' }} />
    </View>
  );
}

export function StatsScoreSkeleton() {
  return (
    <View style={sk.scoreBlock}>
      <SkeletonBox width={100} height={10} borderRadius={3} style={{ alignSelf: 'center' }} />
      <SkeletonBox width={120} height={72} borderRadius={12} style={{ alignSelf: 'center', marginTop: 12 }} />
      <SkeletonBox width={80}  height={14} borderRadius={6} style={{ alignSelf: 'center', marginTop: 10 }} />
    </View>
  );
}

export function StatsBarChartSkeleton() {
  return (
    <View style={sk.barChart}>
      {[40, 70, 55, 90, 35, 80, 60].map((h, i) => (
        <View key={i} style={sk.barCol}>
          <SkeletonBox width={20} height={h} borderRadius={4} />
          <SkeletonBox width={24} height={10} borderRadius={3} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalCard: {
    backgroundColor: '#111', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: '#1e1e1e', marginBottom: 14,
  },
  habitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#111', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  statCard: {
    flex: 1, backgroundColor: '#111', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reviewContent: {
    backgroundColor: '#111', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#1e1e1e', borderLeftWidth: 3, borderLeftColor: '#1e1e1e',
  },
  profileHeader: { alignItems: 'center', paddingVertical: 24 },
  profileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#111',
  },
  scoreBlock: { paddingVertical: 24 },
  barChart: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    backgroundColor: '#111', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1e1e1e', height: 140,
  },
  barCol: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
});
