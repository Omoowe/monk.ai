import { supabase } from '../lib/supabase';

export interface Milestone {
  id: string;
  emoji: string;
  title: string;
  sub: string;
}

export const MILESTONES: Record<string, Milestone> = {
  first_habit:    { id: 'first_habit',    emoji: '🔥', title: 'First Blood',       sub: 'You completed your first habit. The streak begins.' },
  perfect_day:    { id: 'perfect_day',    emoji: '⚡', title: 'Perfect Day',        sub: 'All habits done. Today you were unstoppable.' },
  streak_7:       { id: 'streak_7',       emoji: '🎯', title: '7-Day Streak',       sub: 'One week of consistency. Most people quit by day 3.' },
  streak_30:      { id: 'streak_30',      emoji: '💎', title: '30-Day Streak',      sub: 'One month. You are building a different identity now.' },
  streak_100:     { id: 'streak_100',     emoji: '👑', title: '100-Day Streak',     sub: 'You are in the top 1% of people who start habits.' },
  score_80:       { id: 'score_80',       emoji: '🧠', title: 'High Performer',     sub: 'Dopamine score above 80. Your brain is rewiring.' },
  score_100:      { id: 'score_100',      emoji: '🏆', title: 'Monk Elite',         sub: 'Perfect dopamine score. Absolute discipline.' },
  first_checkin:  { id: 'first_checkin',  emoji: '🌅', title: 'First Check-In',    sub: 'The morning mission is set. Intention beats chance.' },
  goal_complete:  { id: 'goal_complete',  emoji: '🎉', title: 'Goal Achieved',      sub: 'One goal crossed off. What\'s next?' },
};

export async function checkAndAwardMilestones(userId: string): Promise<Milestone | null> {
  const { data: user } = await supabase
    .from('users')
    .select('streak, dopamine_score, milestones_earned')
    .eq('id', userId)
    .single();

  if (!user) return null;

  const earned: string[] = user.milestones_earned ?? [];
  const { streak, dopamine_score } = user;

  // Check total completions for first_habit
  const { count: totalCompletions } = await supabase
    .from('habit_completions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const candidates: string[] = [];
  if ((totalCompletions ?? 0) >= 1)  candidates.push('first_habit');
  if (streak >= 7)                   candidates.push('streak_7');
  if (streak >= 30)                  candidates.push('streak_30');
  if (streak >= 100)                 candidates.push('streak_100');
  if (dopamine_score >= 80)          candidates.push('score_80');
  if (dopamine_score >= 100)         candidates.push('score_100');

  // Perfect day check
  const today = new Date().toISOString().split('T')[0];
  const [{ data: habits }, { data: completions }] = await Promise.all([
    supabase.from('habits').select('id').eq('user_id', userId),
    supabase.from('habit_completions').select('habit_id').eq('user_id', userId).eq('date', today),
  ]);
  const total = habits?.length ?? 0;
  const done  = completions?.length ?? 0;
  if (total > 0 && done >= total) candidates.push('perfect_day');

  // Morning check-in
  const { count: checkinCount } = await supabase
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'morning');
  if ((checkinCount ?? 0) >= 1) candidates.push('first_checkin');

  const newMilestone = candidates.find((id) => !earned.includes(id));
  if (!newMilestone) return null;

  // Award it
  await supabase
    .from('users')
    .update({ milestones_earned: [...earned, newMilestone] })
    .eq('id', userId);

  return MILESTONES[newMilestone] ?? null;
}

export async function checkGoalMilestone(userId: string): Promise<Milestone | null> {
  const { data: user } = await supabase
    .from('users')
    .select('milestones_earned')
    .eq('id', userId)
    .single();

  const earned: string[] = user?.milestones_earned ?? [];
  if (earned.includes('goal_complete')) return null;

  const { count } = await supabase
    .from('goals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('progress', 100);

  if ((count ?? 0) < 1) return null;

  await supabase
    .from('users')
    .update({ milestones_earned: [...earned, 'goal_complete'] })
    .eq('id', userId);

  return MILESTONES['goal_complete'];
}
