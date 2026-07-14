import React, { useEffect, useRef } from 'react';
import { fscale, scale } from '../utils/scale';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import type { Milestone } from '../services/milestones';

interface Props {
  milestone: Milestone | null;
  onClose: () => void;
}

export default function MilestoneModal({ milestone, onClose }: Props) {
  const scale  = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!milestone) return;
    scale.setValue(0.4);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [milestone]);

  if (!milestone) return null;

  return (
    <Modal visible={!!milestone} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <Text style={s.emoji}>{milestone.emoji}</Text>
          <Text style={s.badge}>MILESTONE UNLOCKED</Text>
          <Text style={s.title}>{milestone.title}</Text>
          <Text style={s.sub}>{milestone.sub}</Text>
          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.btnText}>Let's go</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  card: {
    backgroundColor: '#111', borderRadius: 24, padding: 36,
    alignItems: 'center', borderWidth: 1, borderColor: '#b8f05840',
    width: '100%', maxWidth: 340,
  },
  emoji: { fontSize: fscale(64), marginBottom: 16 },
  badge: {
    fontSize: fscale(9), letterSpacing: 3, color: '#b8f058',
    fontFamily: 'DMMono_400Regular', marginBottom: 12,
  },
  title: {
    fontSize: fscale(28), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', textAlign: 'center',
    marginBottom: 10, letterSpacing: -0.5,
  },
  sub: {
    fontSize: fscale(14), color: '#666', textAlign: 'center',
    lineHeight: fscale(21), marginBottom: 32,
  },
  btn: {
    backgroundColor: '#b8f058', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 40,
  },
  btnText: {
    fontSize: fscale(15), fontWeight: '800', color: '#0a0a0a',
    fontFamily: 'Syne_800ExtraBold',
  },
});
