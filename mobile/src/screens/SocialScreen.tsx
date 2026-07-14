import React, { useState, useEffect, useCallback } from 'react';
import { fscale, scale } from '../utils/scale';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';

interface PublicProfile {
  id: string;
  name: string;
  username: string;
  streak: number;
  dopamine_score: number;
}

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
}

interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  type: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  status: string;
  winner_id: string | null;
  challenger_habits_done: number;
  challenged_habits_done: number;
  created_at: string;
}

type Tab = 'friends' | 'battles';
type DurationDays = 7 | 14 | 30;

export default function SocialScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [tab, setTab] = useState<Tab>('friends');
  const [me, setMe] = useState<{ id: string; username: string | null; streak: number; dopamine_score: number }>({ id: '', username: null, streak: 0, dopamine_score: 50 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Friends state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<(Friendship & { profile: PublicProfile })[]>([]);
  const [pendingIn, setPendingIn] = useState<(Friendship & { profile: PublicProfile })[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  // Challenges state
  const [challenges, setChallenges] = useState<(Challenge & { opponent: PublicProfile })[]>([]);
  const [battleScores, setBattleScores] = useState<Record<string, { challengerDone: number; challengedDone: number }>>({});
  const [showChallengePicker, setShowChallengePicker] = useState<string | null>(null); // friend userId
  const [challengeDays, setChallengeDays] = useState<DurationDays>(7);
  const [creating, setCreating] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users').select('username, streak, dopamine_score').eq('id', user.id).single();
      setMe({ id: user.id, username: userData?.username ?? null, streak: userData?.streak ?? 0, dopamine_score: userData?.dopamine_score ?? 50 });

      // Load friendships
      const { data: fships } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .neq('status', 'declined');

      const allFships = (fships ?? []) as Friendship[];
      const accepted = allFships.filter(f => f.status === 'accepted');
      const inbound  = allFships.filter(f => f.status === 'pending' && f.addressee_id === user.id);
      const outbound = allFships.filter(f => f.status === 'pending' && f.requester_id === user.id);

      setSentIds(new Set(outbound.map(f => f.addressee_id)));

      // Fetch profiles for accepted + inbound
      const allIds = [
        ...accepted.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id),
        ...inbound.map(f => f.requester_id),
      ].filter(Boolean);

      let profileMap: Record<string, PublicProfile> = {};
      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_public_profiles').select('*').in('id', allIds);
        (profiles ?? []).forEach((p: PublicProfile) => { profileMap[p.id] = p; });
      }

      setFriends(accepted.map(f => ({
        ...f,
        profile: profileMap[f.requester_id === user.id ? f.addressee_id : f.requester_id],
      })).filter(f => f.profile));

      setPendingIn(inbound.map(f => ({
        ...f,
        profile: profileMap[f.requester_id],
      })).filter(f => f.profile));

      // Load challenges
      const { data: chal } = await supabase
        .from('challenges')
        .select('*')
        .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      const chalList = (chal ?? []) as Challenge[];
      const opponentIds = chalList.map(c => c.challenger_id === user.id ? c.challenged_id : c.challenger_id);
      const uniqueIds = [...new Set(opponentIds)];

      let chalProfileMap: Record<string, PublicProfile> = {};
      if (uniqueIds.length > 0) {
        const { data: cp } = await supabase
          .from('user_public_profiles').select('*').in('id', uniqueIds);
        (cp ?? []).forEach((p: PublicProfile) => { chalProfileMap[p.id] = p; });
      }

      const mappedChallenges = chalList.map(c => ({
        ...c,
        opponent: chalProfileMap[c.challenger_id === user.id ? c.challenged_id : c.challenger_id],
      })).filter(c => c.opponent);
      setChallenges(mappedChallenges);

      // Settle any battles whose end_date has passed
      const endedUnsettled = chalList.filter(c => c.status === 'active' && new Date(c.end_date) < new Date());
      if (endedUnsettled.length > 0) {
        await Promise.all(endedUnsettled.map(c => supabase.rpc('settle_battle', { p_battle_id: c.id })));
      }

      // Fetch live habit-completion scores for all active battles
      const activeBattles = mappedChallenges.filter(c => c.status === 'active' && new Date(c.end_date) >= new Date());
      if (activeBattles.length > 0) {
        const scoreResults = await Promise.all(
          activeBattles.map(c => supabase.rpc('get_battle_scores', { p_battle_id: c.id }))
        );
        const scores: Record<string, { challengerDone: number; challengedDone: number }> = {};
        activeBattles.forEach((c, i) => {
          const row = scoreResults[i]?.data?.[0];
          if (row) scores[c.id] = { challengerDone: row.challenger_done, challengedDone: row.challenged_done };
        });
        setBattleScores(scores);
      }

    } catch (err) {
      console.error('Social load error:', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadAll);
    return unsub;
  }, [navigation, loadAll]);

  const searchUsers = async (q: string) => {
    const safe = q.replace(/[^a-zA-Z0-9_]/g, '');
    if (safe.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('user_public_profiles')
        .select('*')
        .ilike('username', `%${safe}%`)
        .neq('id', me.id)
        .limit(8);
      setSearchResults((data ?? []) as PublicProfile[]);
    } catch {}
    finally { setSearching(false); }
  };

  const sendRequest = async (addresseeId: string) => {
    try {
      await supabase.from('friendships').insert({ requester_id: me.id, addressee_id: addresseeId });
      setSentIds(prev => new Set([...prev, addresseeId]));
      setSearchResults(prev => prev.filter(p => p.id !== addresseeId));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not send request');
    }
  };

  const respondFriend = async (friendshipId: string, accept: boolean) => {
    try {
      if (accept) {
        await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await supabase.from('friendships').update({ status: 'declined' }).eq('id', friendshipId);
      }
      await loadAll();
    } catch {}
  };

  const removeFriend = (friendshipId: string, name: string) => {
    Alert.alert(`Remove ${name}?`, 'You can add them again later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await supabase.from('friendships').delete().eq('id', friendshipId);
        await loadAll();
      }},
    ]);
  };

  const createChallenge = async (challengedId: string) => {
    setCreating(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const end = new Date();
      end.setDate(end.getDate() + challengeDays);
      const endDate = end.toISOString().split('T')[0];
      await supabase.from('challenges').insert({
        challenger_id: me.id,
        challenged_id: challengedId,
        type: 'streak',
        duration_days: challengeDays,
        start_date: today,
        end_date: endDate,
        status: 'pending',
      });
      setShowChallengePicker(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not send challenge');
    } finally {
      setCreating(false);
    }
  };

  const respondChallenge = async (challengeId: string, accept: boolean) => {
    try {
      const newStatus = accept ? 'active' : 'declined';
      await supabase.from('challenges').update({ status: newStatus }).eq('id', challengeId);
      if (accept) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadAll();
    } catch {}
  };

  const isEnded = (c: Challenge) => new Date(c.end_date) < new Date();
  const daysLeft = (c: Challenge) => {
    const diff = new Date(c.end_date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  const activeChallenges  = challenges.filter(c => c.status === 'active' && !isEnded(c));
  const pendingChallenges = challenges.filter(c => c.status === 'pending');
  const pastChallenges    = challenges.filter(c => (c.status === 'active' && isEnded(c)) || c.status === 'completed' || c.status === 'declined');

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['bottom', 'left', 'right']}>
        <ActivityIndicator color="#b8f058" size={36} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom', 'left', 'right']}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>SOCIAL</Text>
          <Text style={s.title}>Friends & Battles</Text>
        </View>
        <TouchableOpacity style={s.reviewBtn} onPress={() => navigation.navigate('Review')}>
          <Text style={s.reviewBtnText}>Review</Text>
        </TouchableOpacity>
      </View>

      {/* No username prompt */}
      {!me.username && (
        <TouchableOpacity style={s.usernamePrompt} onPress={() => navigation.navigate('Profile')}>
          <Text style={s.usernamePromptText}>Set a username to find friends →</Text>
        </TouchableOpacity>
      )}

      {/* Segment */}
      <View style={s.segmentBar}>
        {(['friends', 'battles'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.segBtn, tab === t && s.segBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.segBtnText, tab === t && s.segBtnTextActive]}>
              {t === 'friends' ? `FRIENDS${friends.length > 0 ? ` (${friends.length})` : ''}` : `BATTLES${activeChallenges.length > 0 ? ` (${activeChallenges.length})` : ''}`}
            </Text>
            {t === 'friends' && pendingIn.length > 0 && <View style={s.badge}><Text style={s.badgeText}>{pendingIn.length}</Text></View>}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#b8f058" />}
      >

        {/* ── FRIENDS TAB ── */}
        {tab === 'friends' && (
          <>
            {/* Search */}
            <View style={s.searchRow}>
              <TextInput
                style={s.searchInput}
                placeholder="Search by username…"
                placeholderTextColor="#444"
                value={searchQuery}
                onChangeText={q => { setSearchQuery(q); searchUsers(q); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searching && <ActivityIndicator color="#b8f058" size={16} style={{ position: 'absolute', right: 14 }} />}
            </View>

            {searchResults.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>RESULTS</Text>
                {searchResults.map(p => (
                  <View key={p.id} style={s.userRow}>
                    <View style={s.userAvatar}><Text style={s.userAvatarText}>{p.name[0]?.toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.userName}>{p.name}</Text>
                      <Text style={s.userHandle}>@{p.username} · {p.streak}d streak</Text>
                    </View>
                    {sentIds.has(p.id) || friends.some(f => f.profile.id === p.id) ? (
                      <Text style={s.sentText}>{friends.some(f => f.profile.id === p.id) ? 'Friends' : 'Sent'}</Text>
                    ) : (
                      <TouchableOpacity style={s.addBtn} onPress={() => sendRequest(p.id)}>
                        <Text style={s.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Pending incoming */}
            {pendingIn.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>REQUESTS ({pendingIn.length})</Text>
                {pendingIn.map(f => (
                  <View key={f.id} style={s.userRow}>
                    <View style={s.userAvatar}><Text style={s.userAvatarText}>{f.profile.name[0]?.toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.userName}>{f.profile.name}</Text>
                      <Text style={s.userHandle}>@{f.profile.username}</Text>
                    </View>
                    <TouchableOpacity style={s.acceptBtn} onPress={() => respondFriend(f.id, true)}>
                      <Text style={s.acceptBtnText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.declineBtn} onPress={() => respondFriend(f.id, false)}>
                      <Text style={s.declineBtnText}>✗</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Friends list */}
            {friends.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionLabel}>YOUR FRIENDS</Text>
                {friends.map(f => (
                  <View key={f.id} style={s.friendCard}>
                    <View style={s.userAvatar}><Text style={s.userAvatarText}>{f.profile.name[0]?.toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.userName}>{f.profile.name}</Text>
                      <Text style={s.userHandle}>@{f.profile.username} · {f.profile.streak}d streak · {f.profile.dopamine_score}pts</Text>
                    </View>
                    <TouchableOpacity
                      style={s.challengeBtn}
                      onPress={() => { setShowChallengePicker(f.profile.id); setChallengeDays(7); }}
                    >
                      <Text style={s.challengeBtnText}>VS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeFriend(f.id, f.profile.name)} style={{ padding: 8 }}>
                      <Text style={{ color: '#333', fontSize: fscale(16) }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : searchQuery.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconDot} />
                <Text style={s.emptyTitle}>No friends yet.</Text>
                <Text style={s.emptySub}>Search by username above to add your first rival.</Text>
              </View>
            ) : null}
          </>
        )}

        {/* ── BATTLES TAB ── */}
        {tab === 'battles' && (
          <>
            {/* Pending challenges (I was challenged) */}
            {pendingChallenges.filter(c => c.challenged_id === me.id).length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>INCOMING CHALLENGES</Text>
                {pendingChallenges.filter(c => c.challenged_id === me.id).map(c => (
                  <View key={c.id} style={[s.challengeCard, { borderColor: '#f5c84060' }]}>
                    <Text style={s.challengeTitle}>{c.opponent.name} challenged you!</Text>
                    <Text style={s.challengeSub}>{c.duration_days}-day streak battle</Text>
                    <View style={s.challengeActions}>
                      <TouchableOpacity style={s.acceptChalBtn} onPress={() => respondChallenge(c.id, true)}>
                        <Text style={s.acceptChalBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.declineChalBtn} onPress={() => respondChallenge(c.id, false)}>
                        <Text style={s.declineChalBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Pending challenges I sent */}
            {pendingChallenges.filter(c => c.challenger_id === me.id).length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>SENT CHALLENGES</Text>
                {pendingChallenges.filter(c => c.challenger_id === me.id).map(c => (
                  <View key={c.id} style={s.challengeCard}>
                    <Text style={s.challengeTitle}>Waiting for {c.opponent.name}…</Text>
                    <Text style={s.challengeSub}>{c.duration_days}-day streak battle · sent {new Date(c.created_at).toLocaleDateString()}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Active battles */}
            {activeChallenges.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>ACTIVE BATTLES</Text>
                {activeChallenges.map(c => {
                  const sc      = battleScores[c.id];
                  const isChal  = c.challenger_id === me.id;
                  const myDone  = sc ? (isChal ? sc.challengerDone : sc.challengedDone) : 0;
                  const oppDone = sc ? (isChal ? sc.challengedDone : sc.challengerDone) : 0;
                  const winning = myDone >= oppDone;
                  const total   = (myDone + oppDone) || 1;
                  const myPct   = Math.round((myDone / total) * 100);
                  const start   = new Date(c.start_date);
                  const elapsed = Math.max(0, Math.min(c.duration_days, Math.round((Date.now() - start.getTime()) / 86400000)));
                  const battlePct = Math.round((elapsed / c.duration_days) * 100);
                  return (
                    <View key={c.id} style={[s.battleCard, winning && s.battleCardWinning]}>
                      <View style={s.battleHeader}>
                        <Text style={s.battleTitle}>{c.duration_days}-DAY HABIT BATTLE</Text>
                        <View style={s.battleDaysLeft}>
                          <Text style={s.battleDaysLeftText}>{daysLeft(c)}d left</Text>
                        </View>
                      </View>

                      <View style={s.battleTimeline}>
                        <View style={[s.battleTimelineFill, { width: `${battlePct}%` }]} />
                      </View>
                      <Text style={s.battleTimelineLabel}>Day {elapsed} of {c.duration_days}</Text>

                      <View style={s.battleScores}>
                        <View style={s.battlePlayer}>
                          <Text style={[s.battleScore, winning && { color: '#b8f058' }]}>{myDone}</Text>
                          <Text style={s.battlePlayerName}>You</Text>
                          <Text style={s.battleSubScore}>habits done</Text>
                        </View>
                        <View style={s.battleBarCol}>
                          <View style={s.battleBar}>
                            <View style={[s.battleBarFillMe, { width: `${myPct}%` }]} />
                          </View>
                          <Text style={s.battleVsSmall}>VS</Text>
                          <View style={s.battleBar}>
                            <View style={[s.battleBarFillOpp, { width: `${100 - myPct}%`, alignSelf: 'flex-start' }]} />
                          </View>
                        </View>
                        <View style={[s.battlePlayer, { alignItems: 'flex-end' }]}>
                          <Text style={[s.battleScore, !winning && { color: '#f06060' }]}>{oppDone}</Text>
                          <Text style={s.battlePlayerName}>{c.opponent.name.split(' ')[0]}</Text>
                          <Text style={s.battleSubScore}>habits done</Text>
                        </View>
                      </View>

                      <Text style={s.battleStatus}>
                        {winning ? 'Ahead — don\'t let up.' : 'Behind — grind harder.'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Past battles */}
            {pastChallenges.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>PAST BATTLES</Text>
                {pastChallenges.map(c => {
                  const declined    = c.status === 'declined';
                  const iWon        = !declined && c.winner_id === me.id;
                  const isChal      = c.challenger_id === me.id;
                  const myFinal     = isChal ? c.challenger_habits_done : c.challenged_habits_done;
                  const oppFinal    = isChal ? c.challenged_habits_done : c.challenger_habits_done;
                  return (
                    <View key={c.id} style={s.pastCard}>
                      <Text style={[s.pastResult, declined ? { color: '#555' } : iWon ? { color: '#b8f058' } : { color: '#f06060' }]}>
                        {declined ? 'DECLINED' : iWon ? 'WON' : 'LOST'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.pastOpponent}>vs {c.opponent.name}</Text>
                        {!declined && (
                          <Text style={[s.pastDate, { color: iWon ? '#b8f05870' : '#f0606070' }]}>
                            {myFinal} – {oppFinal} habits
                          </Text>
                        )}
                      </View>
                      <Text style={s.pastDate}>
                        {new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {activeChallenges.length === 0 && pendingChallenges.length === 0 && pastChallenges.length === 0 && (
              <View style={s.empty}>
                <View style={s.emptyIconDot} />
                <Text style={s.emptyTitle}>No battles yet.</Text>
                <Text style={s.emptySub}>Go to Friends and tap VS to challenge someone.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Challenge duration picker bottom sheet */}
      {showChallengePicker && (
        <View style={s.pickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowChallengePicker(null)} />
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Choose battle length</Text>
            <View style={s.durationRow}>
              {([7, 14, 30] as DurationDays[]).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.durationBtn, challengeDays === d && s.durationBtnActive]}
                  onPress={() => setChallengeDays(d)}
                >
                  <Text style={[s.durationText, challengeDays === d && s.durationTextActive]}>{d}</Text>
                  <Text style={[s.durationSub, challengeDays === d && { color: '#b8f058' }]}>days</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.sendChalBtn, creating && { opacity: 0.6 }]}
              onPress={() => createChallenge(showChallengePicker)}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator color="#0a0a0a" />
                : <Text style={s.sendChalBtnText}>Send Challenge</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', padding: 12 }} onPress={() => setShowChallengePicker(null)}>
              <Text style={{ color: '#aaa', fontSize: fscale(13) }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  eyebrow: { fontSize: fscale(11), letterSpacing: 1.5, color: '#b8f058', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  title: { fontSize: fscale(28), fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold' },
  reviewBtn: {
    borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, marginTop: 4,
  },
  reviewBtnText: { fontSize: fscale(12), color: '#aaa' },
  usernamePrompt: {
    backgroundColor: '#0d1a07', borderBottomWidth: 1, borderBottomColor: '#b8f05820',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  usernamePromptText: { fontSize: fscale(13), color: '#b8f058' },
  segmentBar: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    paddingHorizontal: 20, gap: 0,
  },
  segBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 4, marginRight: 24,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  segBtnActive: { borderBottomColor: '#b8f058' },
  segBtnText: { fontSize: fscale(10), letterSpacing: 2, color: '#aaa', fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  segBtnTextActive: { color: '#b8f058' },
  badge: {
    backgroundColor: '#f06060', borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
    minWidth: 16, alignItems: 'center',
  },
  badgeText: { fontSize: fscale(9), color: '#fff', fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  section: { gap: 8 },
  sectionLabel: { fontSize: fscale(11), letterSpacing: 1.5, color: '#aaa', fontFamily: 'DMMono_400Regular', marginBottom: 4 },
  searchRow: { position: 'relative' },
  searchInput: {
    backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: fscale(14),
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#111', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  friendCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#111', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center',
  },
  userAvatarText: { fontSize: fscale(16), color: '#b8f058', fontWeight: '700' },
  userName: { fontSize: fscale(14), fontWeight: '700', color: '#fff', marginBottom: 2 },
  userHandle: { fontSize: fscale(11), color: '#aaa', fontFamily: 'DMMono_400Regular' },
  sentText: { fontSize: fscale(11), color: '#aaa' },
  addBtn: {
    borderWidth: 1, borderColor: '#b8f058', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  addBtnText: { color: '#b8f058', fontSize: fscale(12), fontWeight: '700' },
  acceptBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#b8f05820', borderWidth: 1, borderColor: '#b8f058',
    justifyContent: 'center', alignItems: 'center',
  },
  acceptBtnText: { color: '#b8f058', fontSize: fscale(14), fontWeight: '700' },
  declineBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#f0606015', borderWidth: 1, borderColor: '#f06060',
    justifyContent: 'center', alignItems: 'center',
  },
  declineBtnText: { color: '#f06060', fontSize: fscale(14), fontWeight: '700' },
  challengeBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center',
  },
  challengeBtnText: { fontSize: fscale(16) },
  challengeCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#2a2a2a', gap: 6,
  },
  challengeTitle: { fontSize: fscale(15), fontWeight: '700', color: '#fff' },
  challengeSub: { fontSize: fscale(12), color: '#aaa' },
  challengeActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  acceptChalBtn: {
    flex: 1, backgroundColor: '#b8f058', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  acceptChalBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: fscale(13) },
  declineChalBtn: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  declineChalBtnText: { color: '#aaa', fontSize: fscale(13) },
  battleCard: {
    backgroundColor: '#111', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: '#2a2a2a', gap: 12,
  },
  battleCardWinning: { borderColor: '#b8f05840', backgroundColor: '#0a150a' },
  battleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  battleTitle: { fontSize: fscale(13), color: '#aaa', fontFamily: 'DMMono_400Regular' },
  battleDaysLeft: {
    backgroundColor: '#1e1e1e', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  battleDaysLeftText: { fontSize: fscale(10), color: '#f5c840', fontFamily: 'DMMono_400Regular' },
  battleScores: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  battlePlayer: { alignItems: 'center', flex: 1 },
  battleScore: { fontSize: fscale(44), fontWeight: '800', color: '#fff', fontFamily: 'DMMono_400Regular' },
  battlePlayerName: { fontSize: fscale(12), color: '#999', marginTop: 2 },
  battleVs: { fontSize: fscale(14), color: '#333', fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  battleStatus: { fontSize: fscale(12), color: '#aaa', textAlign: 'center', marginTop: 8 },
  battleTimeline: { height: 4, backgroundColor: '#1a1a1a', borderRadius: 2, marginVertical: 8, overflow: 'hidden' },
  battleTimelineFill: { height: 4, backgroundColor: '#b8f05880', borderRadius: 2 },
  battleTimelineLabel: { fontSize: fscale(9), color: '#999', fontFamily: 'DMMono_400Regular', textAlign: 'center', marginBottom: 12 },
  battleBarCol: { flex: 1, alignItems: 'center', gap: 4 },
  battleBar: { width: '100%', height: 5, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' },
  battleBarFillMe: { height: 5, backgroundColor: '#b8f058', borderRadius: 3 },
  battleBarFillOpp: { height: 5, backgroundColor: '#f06060', borderRadius: 3, alignSelf: 'flex-end' },
  battleVsSmall: { fontSize: fscale(8), color: '#999', fontFamily: 'DMMono_400Regular', letterSpacing: 2 },
  battleSubScore: { fontSize: fscale(10), color: '#aaa', fontFamily: 'DMMono_400Regular', marginTop: 2 },
  pastCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0d0d0d', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#1a1a1a',
  },
  pastResult: { fontSize: fscale(13), fontWeight: '700', width: 80 },
  pastOpponent: { flex: 1, fontSize: fscale(13), color: '#ccc' },
  pastDate: { fontSize: fscale(10), color: '#999', fontFamily: 'DMMono_400Regular' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIconDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#333', marginBottom: 12 },
  emptyTitle: { fontSize: fscale(18), fontWeight: '700', color: '#999' },
  emptySub: { fontSize: fscale(13), color: '#888', textAlign: 'center', paddingHorizontal: 20 },
  pickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: '#1e1e1e',
  },
  pickerHandle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  pickerTitle: { fontSize: fscale(18), fontWeight: '800', color: '#fff', fontFamily: 'Syne_800ExtraBold', marginBottom: 20, textAlign: 'center' },
  durationRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  durationBtn: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#2a2a2a',
  },
  durationBtnActive: { borderColor: '#b8f058', backgroundColor: '#0d1a07' },
  durationText: { fontSize: fscale(28), fontWeight: '800', color: '#999', fontFamily: 'DMMono_400Regular' },
  durationTextActive: { color: '#b8f058' },
  durationSub: { fontSize: fscale(10), color: '#999', letterSpacing: 1 },
  sendChalBtn: {
    backgroundColor: '#b8f058', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginBottom: 4,
  },
  sendChalBtnText: { fontSize: fscale(15), fontWeight: '800', color: '#0a0a0a', fontFamily: 'Syne_800ExtraBold' },
});
