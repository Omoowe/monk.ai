import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  personality: string;
  identityStatement: string;
  monkMode: boolean;
  strictGoals: boolean;
  streak: number;
  dopamineScore: number;
  streakFreezes: number;
  freezeUsedOn: string | null;
  coachMemory: string;
  avatar: string;
  showOnLeaderboard: boolean;
  notifyCoachNudges: boolean;
  isPro: boolean;
}

export interface TodaySnapshot {
  morningDone: boolean;
  eveningDone: boolean;
  morningMission: string;
  habitsDone: number;
  habitsTotal: number;
}

interface UserCtx {
  profile: UserProfile | null;
  today: TodaySnapshot;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  refreshToday: () => Promise<void>;
  updateProfileField: (updates: Partial<UserProfile>) => void;
}

const DEFAULT_TODAY: TodaySnapshot = {
  morningDone: false, eveningDone: false, morningMission: '',
  habitsDone: 0, habitsTotal: 0,
};

const UserContext = createContext<UserCtx>({
  profile: null,
  today: DEFAULT_TODAY,
  profileLoading: true,
  refreshProfile: async () => {},
  refreshToday: async () => {},
  updateProfileField: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [today, setToday] = useState<TodaySnapshot>(DEFAULT_TODAY);
  const [profileLoading, setProfileLoading] = useState(true);
  const userId = useRef<string | null>(null);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('users')
      .select('id, name, username, personality, identity_statement, monk_mode, strict_goals, streak, dopamine_score, streak_freezes, freeze_used_on, coach_memory, avatar, show_on_leaderboard, notify_coach_nudges, is_pro')
      .eq('id', uid)
      .single();
    if (data) {
      setProfile({
        id: data.id,
        name: data.name || '',
        username: data.username || '',
        personality: data.personality || 'stoic_mentor',
        identityStatement: data.identity_statement || '',
        monkMode: data.monk_mode ?? false,
        strictGoals: data.strict_goals ?? false,
        streak: data.streak ?? 0,
        dopamineScore: data.dopamine_score ?? 50,
        streakFreezes: data.streak_freezes ?? 1,
        freezeUsedOn: data.freeze_used_on ?? null,
        coachMemory: data.coach_memory ?? '',
        avatar: data.avatar || '🧘',
        showOnLeaderboard: data.show_on_leaderboard ?? true,
        notifyCoachNudges: data.notify_coach_nudges ?? true,
        isPro: data.is_pro ?? false,
      });
    }
  }, []);

  const fetchToday = useCallback(async (uid: string) => {
    const date = new Date().toISOString().split('T')[0];
    const [{ data: habits }, { data: checkins }] = await Promise.all([
      supabase.from('habits').select('id').eq('user_id', uid),
      supabase.from('check_ins').select('type, mission').eq('user_id', uid).eq('date', date),
    ]);
    const habitIds = (habits ?? []).map((h: any) => h.id);
    let done = 0;
    if (habitIds.length > 0) {
      const { data: completions } = await supabase
        .from('habit_completions').select('habit_id')
        .eq('date', date).in('habit_id', habitIds);
      done = completions?.length ?? 0;
    }
    const morning = (checkins ?? []).find((c: any) => c.type === 'morning');
    const evening = (checkins ?? []).find((c: any) => c.type === 'evening');
    setToday({
      morningDone: !!morning,
      eveningDone: !!evening,
      morningMission: morning?.mission ?? '',
      habitsDone: done,
      habitsTotal: habitIds.length,
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId.current) return;
    await fetchProfile(userId.current);
  }, [fetchProfile]);

  const refreshToday = useCallback(async () => {
    if (!userId.current) return;
    await fetchToday(userId.current);
  }, [fetchToday]);

  const updateProfileField = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  useEffect(() => {
    let realtimeSub: ReturnType<typeof supabase.channel> | null = null;

    const boot = async (uid: string) => {
      userId.current = uid;
      setProfileLoading(true);
      try {
        await Promise.all([fetchProfile(uid), fetchToday(uid)]);
      } catch {}
      setProfileLoading(false);

      realtimeSub = supabase
        .channel(`user-ctx-${uid}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${uid}` },
          () => { fetchProfile(uid).catch(() => {}); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'check_ins', filter: `user_id=eq.${uid}` },
          () => { fetchToday(uid).catch(() => {}); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_completions', filter: `user_id=eq.${uid}` },
          () => { fetchToday(uid).catch(() => {}); })
        .subscribe();
    };

    const clear = () => {
      userId.current = null;
      setProfile(null);
      setToday(DEFAULT_TODAY);
      setProfileLoading(false);
      realtimeSub?.unsubscribe();
      realtimeSub = null;
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) boot(session.user.id);
      else setProfileLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        boot(session.user.id);
      } else {
        clear();
      }
    });

    return () => {
      subscription?.unsubscribe();
      realtimeSub?.unsubscribe();
    };
  }, [fetchProfile, fetchToday]);

  return (
    <UserContext.Provider value={{ profile, today, profileLoading, refreshProfile, refreshToday, updateProfileField }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
