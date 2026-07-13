import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const HEADLINE = 'Become the person who follows through.';

const BULLETS = [
  { text: 'AI that remembers your patterns' },
  { text: 'Daily habit accountability' },
  { text: 'Challenge friends to streak battles' },
];

export default function WelcomeScreen({ navigation }: Props) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const bulletAnims = useRef(BULLETS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(HEADLINE.slice(0, indexRef.current));
      if (indexRef.current >= HEADLINE.length) {
        clearInterval(interval);
        Animated.sequence([
          Animated.stagger(120, bulletAnims.map(anim =>
            Animated.spring(anim, { toValue: 1, tension: 80, friction: 14, useNativeDriver: true })
          )),
          Animated.spring(ctaAnim, { toValue: 1, tension: 60, friction: 12, useNativeDriver: true }),
        ]).start();
      }
    }, 32);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>
        <View style={styles.eyebrowRow}>
          <View style={styles.dot} />
          <Text style={styles.eyebrow}>AI ACCOUNTABILITY</Text>
        </View>

        <Text style={styles.heading}>{displayed}<Text style={styles.cursor}>|</Text></Text>

        <Text style={styles.subtitle}>
          Not another habit tracker. An AI that remembers your failures, calls you out, and stays on you until you change.
        </Text>

        <View style={styles.bullets}>
          {BULLETS.map((b, i) => (
            <Animated.View
              key={i}
              style={[
                styles.bulletRow,
                {
                  opacity: bulletAnims[i],
                  transform: [{ translateY: bulletAnims[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                },
              ]}
            >
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{b.text}</Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[styles.footer, {
        opacity: ctaAnim,
        transform: [{ translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }]}>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
          <Text style={styles.ctaText}>I'm ready to be held accountable →</Text>
        </TouchableOpacity>
        <Text style={styles.footnote}>No fluff. No hand-holding. Just results.</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 64,
    justifyContent: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#b8f058',
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 3,
    color: '#b8f058',
    fontFamily: 'DMMono_400Regular',
  },
  heading: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Syne_800ExtraBold',
    lineHeight: 54,
    letterSpacing: -1,
    marginBottom: 28,
  },
  cursor: {
    color: '#b8f058',
    fontWeight: '300',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 26,
    maxWidth: 320,
    marginBottom: 32,
  },
  bullets: {
    gap: 14,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#b8f058',
    marginTop: 5,
  },
  bulletText: {
    fontSize: 15,
    color: '#ccc',
    fontFamily: 'DMMono_400Regular',
    letterSpacing: 0.3,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },
  cta: {
    width: '100%',
    backgroundColor: '#b8f058',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a0a0a',
    textAlign: 'center',
  },
  footnote: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
});
