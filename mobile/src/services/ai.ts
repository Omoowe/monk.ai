import { supabase } from '../lib/supabase';
import type { CoachContext } from './context';

export async function transcribeAudio(uri: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const formData = new FormData();
  formData.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' } as any);

  const resp = await fetch(`${supabaseUrl}/functions/v1/transcribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!resp.ok) throw new Error('Transcription failed');
  const { text } = await resp.json();
  return text ?? '';
}

export class RateLimitError extends Error {
  constructor() {
    super('LIMIT_REACHED');
    this.name = 'RateLimitError';
  }
}

async function invoke<T>(fn: string, body: object): Promise<string> {
  const { data, error } = await supabase.functions.invoke<T>(fn, { body });
  if (error) throw error;
  if ((data as any)?.limitReached) throw new RateLimitError();
  return (data as { text: string }).text;
}

export async function askCoach(
  message: string,
  personality: string,
  context: CoachContext,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  return invoke('chat', { message, personality, context, history });
}

export async function getPepTalk(
  personality: string,
  context: CoachContext
): Promise<string> {
  return invoke('pep-talk', { personality, context });
}

export async function getMorningBrief(
  personality: string,
  context: CoachContext,
  mission: string,
  energy: number,
  distraction: string
): Promise<string> {
  return invoke('morning-brief', { personality, context, mission, energy, distraction });
}

export async function getEveningFeedback(
  personality: string,
  context: CoachContext,
  mission: string,
  completed: boolean,
  reason: string,
  completedHabits: number,
  totalHabits: number
): Promise<string> {
  return invoke('evening-feedback', {
    personality,
    context,
    mission,
    completed,
    reason,
    completedHabits,
    totalHabits,
  });
}

export async function getGoalAdvice(
  personality: string,
  context: CoachContext,
  goalName: string,
  goalProgress: number,
  goalTarget?: string,
  goalDeadline?: string,
): Promise<string> {
  return invoke('goal-advice', { personality, context, goalName, goalProgress, goalTarget, goalDeadline });
}

export async function getGoalMilestoneComment(
  personality: string,
  context: CoachContext,
  goalName: string,
  milestone: number,
  goalTarget?: string,
): Promise<string> {
  return invoke('goal-advice', { personality, context, goalName, goalProgress: milestone, goalTarget, milestone });
}

export async function getWeeklyReview(
  personality: string,
  context: CoachContext,
  weekTotal: number,
  weekMax: number,
  failedMissions: number,
  failureReasons: string[]
): Promise<string> {
  return invoke('review', {
    personality,
    context,
    weekTotal,
    weekMax,
    failedMissions,
    failureReasons,
  });
}
