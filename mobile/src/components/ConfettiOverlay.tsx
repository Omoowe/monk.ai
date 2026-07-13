import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const COLORS = ['#b8f058', '#f5c840', '#7b6af0', '#f06060', '#40f5c8', '#f0a060', '#ffffff'];
const COUNT = 28;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface Particle {
  x: number;
  color: string;
  size: number;
  y: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
}

interface Props {
  visible: boolean;
  onDone?: () => void;
}

export default function ConfettiOverlay({ visible, onDone }: Props) {
  const particles = useRef<Particle[]>(
    Array.from({ length: COUNT }, () => ({
      x: rand(0, W - 12),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: rand(6, 12),
      y: new Animated.Value(-20),
      opacity: new Animated.Value(1),
      rotate: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    particles.forEach((p) => {
      p.y.setValue(-20);
      p.opacity.setValue(1);
      p.rotate.setValue(0);
    });
    const anims = particles.map((p, i) =>
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: H * rand(0.5, 0.9),
          duration: rand(1200, 2000),
          delay: i * 40,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(rand(800, 1400) + i * 40),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(p.rotate, {
          toValue: rand(-4, 4),
          duration: rand(1200, 2000),
          delay: i * 40,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(anims).start(() => onDone?.());
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              left: p.x,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateY: p.y },
                { rotate: p.rotate.interpolate({ inputRange: [-4, 4], outputRange: ['-720deg', '720deg'] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', top: 0 },
});
