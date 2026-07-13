import { supabase } from '../lib/supabase';
import { getQueue, removeAction } from './offline';
import { updateHabitStreak, recalculateStats } from './stats';

let draining = false;

export async function drainOfflineQueue(): Promise<number> {
  if (draining) return 0;
  draining = true;
  let synced = 0;
  try {
    const queue = await getQueue();
    if (!queue.length) return 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    const userId = user.id;

    for (const action of queue) {
      try {
        if (action.type === 'habit_toggle') {
          const { habitId, completed, date } = action.payload;
          if (completed) {
            await supabase.from('habit_completions').upsert(
              { habit_id: habitId, user_id: userId, date },
              { onConflict: 'habit_id,date' }
            );
          } else {
            await supabase.from('habit_completions').delete()
              .eq('habit_id', habitId).eq('user_id', userId).eq('date', date);
          }
          updateHabitStreak(habitId).catch(() => {});
          recalculateStats(userId).catch(() => {});
        } else if (action.type === 'goal_update') {
          const { goalId, progress } = action.payload;
          await supabase.from('goals').update({ progress }).eq('id', goalId).eq('user_id', userId);
        }
        await removeAction(action.id);
        synced++;
      } catch {
        // Leave in queue, retry next drain
      }
    }
  } finally {
    draining = false;
  }
  return synced;
}
