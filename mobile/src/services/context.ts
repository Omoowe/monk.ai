import { supabase } from '../lib/supabase';

const CACHE_TTL_MS = 30_000;
const ctxCache = new Map<string, { ctx: CoachContext; ts: number; date: string }>();

export interface CoachContext {
  userName: string;
  streak: number;
  dopamineScore: number;
  doneHabits: string[];
  missedHabits: string[];
  morningMission?: string;
  morningEnergy?: number;
  morningDistraction?: string;
  eveningFailed?: boolean;
  eveningReason?: string;
  identityStatement: string;
  goals: Array<{ name: string; progress: number; daysSince: number }>;
  habitEfforts?: Array<{ name: string; effort: number }>;
  personality?: string;
  monkMode?: boolean;
  strictGoals?: boolean;
  streakFreezes?: number;
  coachMemory?: string;
}

export async function buildCoachContext(userId: string): Promise<CoachContext> {
  const today = new Date().toISOString().split('T')[0];
  const cached = ctxCache.get(userId);
  if (cached && cached.date === today && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.ctx;
  }

  const [userResult, habitsResult, goalsResult, checkinResult] = await Promise.all([
    supabase
      .from('users')
      .select('name, personality, streak, dopamine_score, identity_statement, monk_mode, strict_goals, streak_freezes, coach_memory')
      .eq('id', userId)
      .single(),
    supabase.from('habits').select('id, name').eq('user_id', userId),
    supabase.from('goals').select('name, progress, created_at').eq('user_id', userId),
    supabase
      .from('check_ins')
      .select('type, mission, energy, distraction, completed, reason')
      .eq('user_id', userId)
      .eq('date', today),
  ]);

  const user = userResult.data;
  const habits = habitsResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const checkins = checkinResult.data ?? [];

  const habitIds = habits.map((h) => h.id);
  let doneHabitIds: string[] = [];
  let effortMap = new Map<string, number>();
  if (habitIds.length > 0) {
    const { data: completions } = await supabase
      .from('habit_completions')
      .select('habit_id, effort_level')
      .eq('date', today)
      .in('habit_id', habitIds);
    doneHabitIds = (completions ?? []).map((c) => c.habit_id);
    effortMap = new Map((completions ?? []).map((c) => [c.habit_id, c.effort_level ?? 2]));
  }

  const doneHabits = habits.filter((h) => doneHabitIds.includes(h.id)).map((h) => h.name);
  const missedHabits = habits.filter((h) => !doneHabitIds.includes(h.id)).map((h) => h.name);

  const morning = checkins.find((c) => c.type === 'morning');
  const evening = checkins.find((c) => c.type === 'evening');

  const mappedGoals = goals.map((g) => ({
    name: g.name,
    progress: g.progress ?? 0,
    daysSince: g.created_at
      ? Math.floor((Date.now() - new Date(g.created_at).getTime()) / 86400000)
      : 0,
  }));

  const ctx: CoachContext = {
    userName: user?.name ?? 'Monk',
    streak: user?.streak ?? 0,
    dopamineScore: user?.dopamine_score ?? 50,
    identityStatement: user?.identity_statement ?? '',
    personality: user?.personality ?? 'stoic_mentor',
    monkMode: user?.monk_mode ?? false,
    strictGoals: user?.strict_goals ?? false,
    streakFreezes: user?.streak_freezes ?? 1,
    coachMemory: user?.coach_memory ?? '',
    doneHabits,
    missedHabits,
    goals: mappedGoals,
    habitEfforts: habits
      .filter((h) => doneHabitIds.includes(h.id) && effortMap.get(h.id) !== 2)
      .map((h) => ({ name: h.name, effort: effortMap.get(h.id) ?? 2 })),
    morningMission: morning?.mission ?? undefined,
    morningEnergy: morning?.energy ?? undefined,
    morningDistraction: morning?.distraction ?? undefined,
    eveningFailed: evening ? !evening.completed : undefined,
    eveningReason: evening?.reason ?? undefined,
  };
  ctxCache.set(userId, { ctx, ts: Date.now(), date: today });
  return ctx;
}
