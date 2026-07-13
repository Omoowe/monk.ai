import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { fscale, scale } from '../utils/scale';

type Mode = 'welcome' | 'auth' | 'reset';

const STATS = [
  { value: '12,847', label: 'MONKS' },
  { value: '2.4M',   label: 'CHECK-INS' },
  { value: '89%',    label: '7-DAY STREAK' },
];

export default function LoginScreen() {
  const [mode, setMode]             = useState<Mode>('welcome');
  const [tab, setTab]               = useState<'signin' | 'create'>('signin');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [registerDone, setRegisterDone] = useState(false);
  const [resetSent, setResetSent]   = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    setError(''); setLoading(true);
    try {
      if (tab === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setRegisterDone(true);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) { setError('Enter your email first.'); return; }
    setError(''); setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Welcome / Marketing (Design 02) ──────────────────────────────────────
  if (mode === 'welcome') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.glow} />
        <View style={s.welcomeWrap}>
          <View style={s.logoRow}>
            <Text style={s.logoStar}>✦</Text>
            <Text style={s.logoText}> MONK.AI</Text>
          </View>
          <View style={s.heroBlock}>
            <Text style={s.eyebrow}>WELCOME</Text>
            <Text style={s.headline}>
              {'Discipline\nis '}
              <Text style={s.headlineLime}>freedom.</Text>
            </Text>
            <Text style={s.sub}>
              A coach in your pocket. Two check-ins a day. Zero excuses.
            </Text>
            <View style={s.statsRow}>
              {STATS.map((st, i) => (
                <View key={st.label} style={[s.statCell, i < STATS.length - 1 && s.statCellDivider]}>
                  <Text style={s.statValue}>{st.value}</Text>
                  <Text style={s.statLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.welcomeFooter}>
            <TouchableOpacity
              testID="login-get-started-btn"
              style={s.ctaMain}
              onPress={() => { setTab('create'); setMode('auth'); }}
              activeOpacity={0.85}
            >
              <Text style={s.ctaMainText}>Get Started →</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="login-sign-in-link" onPress={() => { setTab('signin'); setMode('auth'); }}>
              <Text style={s.alreadyText}>
                ALREADY A MONK?{'  '}
                <Text style={s.alreadyLink}>SIGN IN</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Reset password ────────────────────────────────────────────────────────
  if (mode === 'reset') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.glow} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
            <View style={s.authLogo}>
              <Text style={s.authLogoStar}>✦</Text>
              <Text style={s.authLogoName}>MONK.AI</Text>
              <Text style={s.authLogoSub}>ACCOUNTABILITY · DAILY</Text>
            </View>
            <Text style={s.authTitle}>{resetSent ? 'Check your inbox.' : 'Reset password.'}</Text>
            {error ? <Text style={s.authError}>{error}</Text> : null}
            {resetSent ? (
              <Text style={s.resetSent}>
                Link sent to {email}. Follow it to reset your password.
              </Text>
            ) : (
              <>
                <TextInput
                  style={s.authInput}
                  placeholder="monk@monk.ai"
                  placeholderTextColor="#444"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
                <TouchableOpacity
                  style={[s.ctaMain, loading && s.ctaDisabled]}
                  onPress={handleReset}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#0a0a0a" />
                    : <Text style={s.ctaMainText}>Send reset link →</Text>}
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={s.backLink} onPress={() => { setError(''); setResetSent(false); setMode('auth'); }}>
              <Text style={s.backLinkText}>← Back to sign in</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Auth screen — SIGN IN / CREATE tabs (Design 01) ──────────────────────
  return (
    <SafeAreaView style={s.container}>
      <View style={s.glow} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
          <View style={s.authLogo}>
            <Text style={s.authLogoStar}>✦</Text>
            <Text style={s.authLogoName}>MONK.AI</Text>
            <Text style={s.authLogoSub}>ACCOUNTABILITY · DAILY</Text>
          </View>

          {/* Tab toggle */}
          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'signin' && s.tabBtnActive]}
              onPress={() => { setTab('signin'); setError(''); setRegisterDone(false); }}
            >
              <Text style={[s.tabText, tab === 'signin' && s.tabTextActive]}>SIGN IN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'create' && s.tabBtnActive]}
              onPress={() => { setTab('create'); setError(''); setRegisterDone(false); }}
            >
              <Text style={[s.tabText, tab === 'create' && s.tabTextActive]}>CREATE</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={s.authError}>{error}</Text> : null}

          {registerDone ? (
            <View style={s.successCard}>
              <Text style={s.successTitle}>Check your email</Text>
              <Text style={s.successText}>
                Verify your account at {email}, then sign in.
              </Text>
              <TouchableOpacity
                style={[s.ctaMain, { marginTop: 20 }]}
                onPress={() => { setRegisterDone(false); setTab('signin'); }}
              >
                <Text style={s.ctaMainText}>Sign In →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={s.authInput}
                placeholder="monk@monk.ai"
                placeholderTextColor="#444"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                testID="login-email-input"
              />
              <TextInput
                style={s.authInput}
                placeholder="••••••••••"
                placeholderTextColor="#444"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                testID="login-password-input"
              />
              <TouchableOpacity
                style={[s.ctaMain, (loading || !email.trim() || !password.trim()) && s.ctaDisabled]}
                onPress={handleSubmit}
                disabled={loading || !email.trim() || !password.trim()}
              >
                {loading
                  ? <ActivityIndicator color="#0a0a0a" />
                  : <Text style={s.ctaMainText}>
                      {tab === 'signin' ? 'Sign In →' : 'Create Account →'}
                    </Text>}
              </TouchableOpacity>
              {tab === 'signin' && (
                <TouchableOpacity style={s.forgotBtn} onPress={() => { setError(''); setMode('reset'); }}>
                  <Text style={s.forgotText}>FORGOT PASSWORD?</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <Text style={s.footerLegal}>BY CONTINUING YOU ACCEPT THE PATH.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },

  glow: {
    position: 'absolute', bottom: -80, alignSelf: 'center',
    width: 580, height: 460, borderRadius: 290,
    backgroundColor: '#b8f05814',
  },

  // Welcome (Design 02)
  welcomeWrap: {
    flex: 1, paddingHorizontal: scale(28), paddingTop: scale(20), paddingBottom: scale(40),
    justifyContent: 'space-between',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoStar: { fontSize: fscale(14), color: '#b8f058' },
  logoText: { fontSize: fscale(13), color: '#b8f058', fontWeight: '700', fontFamily: 'DMMono_400Regular', letterSpacing: 1 },
  heroBlock: { flex: 1, justifyContent: 'center', paddingTop: scale(20) },
  eyebrow: {
    fontSize: fscale(11), color: '#b8f058', fontFamily: 'DMMono_400Regular',
    letterSpacing: 1.5, marginBottom: 16,
  },
  headline: {
    fontSize: fscale(38), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', lineHeight: fscale(46),
    letterSpacing: -1, marginBottom: 20,
  },
  headlineLime: { color: '#b8f058' },
  sub: {
    fontSize: fscale(15), color: '#888', lineHeight: fscale(24), marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCell: {
    flex: 1, paddingVertical: scale(12), paddingRight: scale(16),
  },
  statCellDivider: {
    borderRightWidth: 1, borderRightColor: '#1e1e1e',
  },
  statValue: {
    fontSize: fscale(20), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', marginBottom: 4,
  },
  statLabel: { fontSize: fscale(9), color: '#555', fontFamily: 'DMMono_400Regular', letterSpacing: 1.5 },
  welcomeFooter: { gap: 18 },
  alreadyText: {
    textAlign: 'center', fontSize: fscale(11), color: '#666',
    fontFamily: 'DMMono_400Regular', letterSpacing: 1,
  },
  alreadyLink: {
    color: '#b8f058',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(184,240,88,0.5)',
  },

  // Auth (Design 01)
  authScroll: { flexGrow: 1, padding: scale(28), paddingTop: scale(20), justifyContent: 'center' },
  authLogo: { alignItems: 'center', marginBottom: scale(40), marginTop: scale(20) },
  authLogoStar: { fontSize: fscale(28), color: '#b8f058', marginBottom: 8 },
  authLogoName: {
    fontSize: fscale(26), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', letterSpacing: 3, marginBottom: 6,
  },
  authLogoSub: {
    fontSize: fscale(10), color: '#555', fontFamily: 'DMMono_400Regular', letterSpacing: 3,
  },
  authTitle: {
    fontSize: fscale(28), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', marginBottom: 24,
  },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#111',
    borderRadius: 10, borderWidth: 1, borderColor: '#222',
    padding: 4, marginBottom: 28, gap: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: scale(12), borderRadius: 8, alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#b8f05850' },
  tabText: { fontSize: fscale(11), color: '#555', fontFamily: 'DMMono_400Regular', letterSpacing: 2 },
  tabTextActive: { color: '#b8f058' },
  authInput: {
    backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: scale(18), paddingVertical: scale(16), color: '#fff', fontSize: fscale(15),
    marginBottom: 12,
  },
  authError: {
    color: '#f06060', fontSize: fscale(13), marginBottom: 16,
    backgroundColor: '#f0606015', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#f0606030',
  },
  forgotBtn: { alignItems: 'center', paddingVertical: 16 },
  forgotText: { fontSize: fscale(10), color: '#444', fontFamily: 'DMMono_400Regular', letterSpacing: 2 },
  footerLegal: {
    fontSize: fscale(9), color: '#333', textAlign: 'center',
    fontFamily: 'DMMono_400Regular', letterSpacing: 1.5, marginTop: 32,
  },
  backLink: { alignItems: 'center', paddingVertical: 16 },
  backLinkText: { fontSize: fscale(13), color: '#555' },
  resetSent: { fontSize: fscale(15), color: '#aaa', lineHeight: fscale(24), marginBottom: 24 },
  successCard: {
    backgroundColor: '#0d1a07', borderRadius: 14, padding: scale(20),
    borderWidth: 1, borderColor: '#b8f05840', marginBottom: 24,
  },
  successTitle: {
    fontSize: fscale(20), fontWeight: '800', color: '#b8f058',
    fontFamily: 'Syne_800ExtraBold', marginBottom: 8,
  },
  successText: { fontSize: fscale(14), color: '#7a9a50', lineHeight: fscale(22) },

  // Shared CTA
  ctaMain: {
    backgroundColor: '#b8f058', borderRadius: 14, paddingVertical: scale(20),
    alignItems: 'center', justifyContent: 'center', minHeight: scale(58),
  },
  ctaMainText: {
    fontSize: fscale(17), fontWeight: '700', color: '#0a0a0a',
    fontFamily: 'Syne_800ExtraBold',
  },
  ctaDisabled: { opacity: 0.35 },
});
