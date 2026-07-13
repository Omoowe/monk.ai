import { supabase } from '../lib/supabase';

export async function updateHabitStreak(habitId: string): Promise<void> {
  await supabase.rpc('update_habit_streak', { p_habit_id: habitId });
}

export async function recalculateStats(userId: string): Promise<void> {
  await supabase.rpc('recalculate_user_stats', { p_user_id: userId });
}
