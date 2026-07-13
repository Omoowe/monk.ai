import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'monk_offline_queue';

interface HabitToggleAction {
  id: string;
  type: 'habit_toggle';
  payload: {
    habitId: string;
    completed: boolean; // target state (true = mark done, false = mark undone)
    date: string;       // YYYY-MM-DD
  };
  ts: number;
}

interface GoalUpdateAction {
  id: string;
  type: 'goal_update';
  payload: {
    goalId: string;
    progress: number; // 0-100
  };
  ts: number;
}

export type OfflineAction = HabitToggleAction | GoalUpdateAction;

type ActionInput = Omit<HabitToggleAction, 'id' | 'ts'> | Omit<GoalUpdateAction, 'id' | 'ts'>;

export async function enqueueAction(action: ActionInput): Promise<void> {
  try {
    const queue = await getQueue();
    let filtered: OfflineAction[];
    if (action.type === 'habit_toggle') {
      const p = action.payload;
      filtered = queue.filter(
        (a) => !(a.type === 'habit_toggle' && a.payload.habitId === p.habitId && a.payload.date === p.date)
      );
    } else {
      const p = action.payload;
      filtered = queue.filter(
        (a) => !(a.type === 'goal_update' && a.payload.goalId === p.goalId)
      );
    }
    filtered.push({ ...action, id: `${Date.now()}-${Math.random()}`, ts: Date.now() } as OfflineAction);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch {}
}

export async function getQueue(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getQueueLength(): Promise<number> {
  const q = await getQueue();
  return q.length;
}

export async function removeAction(id: string): Promise<void> {
  try {
    const queue = await getQueue();
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((a) => a.id !== id)));
  } catch {}
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
