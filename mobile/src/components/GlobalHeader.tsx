import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUser } from '../context/UserContext';
import { getCoachColor } from '../utils/coachColors';

export default function GlobalHeader() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { profile } = useUser();
  const streak   = profile?.streak    ?? 0;
  const monkMode = profile?.monkMode  ?? false;
  const color    = getCoachColor(profile?.personality);

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <Text style={styles.wordmark}>Monk.ai</Text>
      <TouchableOpacity
        testID="header-profile-btn"
        style={styles.right}
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.7}
      >
        {monkMode && <View style={styles.monkDot} />}
        <View style={[styles.streakDiamond, { backgroundColor: color }]} />
        <View style={styles.streakBlock}>
          <Text style={[styles.streakNum, { color }]}>{streak}</Text>
          <Text style={[styles.streakLabel, { color: color + '80' }]}>
            {streak === 0 ? 'START' : streak < 7 ? 'DAYS' : 'STREAK'}
          </Text>
        </View>
        <View style={[styles.avatarCircle, { borderColor: color + '60' }]}>
          <Text style={[styles.avatarInitial, { color }]}>
            {profile?.name ? profile.name.trim()[0].toUpperCase() : 'M'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Syne_800ExtraBold',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#b8f058' },
  streakDiamond: { width: 7, height: 7, borderRadius: 2, transform: [{ rotate: '45deg' }] },
  streakBlock: { alignItems: 'flex-end' },
  streakNum: { fontSize: 18, fontWeight: '700', fontFamily: 'DMMono_400Regular', lineHeight: 20 },
  streakLabel: { fontSize: 8, fontFamily: 'DMMono_400Regular', letterSpacing: 1, lineHeight: 10 },
  avatarCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1a1a1a', borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 2,
  },
  avatarInitial: { fontSize: 13, fontWeight: '700', fontFamily: 'DMMono_400Regular' },
});
