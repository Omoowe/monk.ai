export type Screen = 'coach' | 'checkin' | 'goals' | 'stats' | 'review';

export type CoachPersonality =
  | 'drill_sergeant'
  | 'stoic_mentor'
  | 'anime_sensei'
  | 'goggins'
  | 'ceo_coach'
  | 'calm_therapist';

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  streakDays: number;
  completedToday: boolean;
  category: 'health' | 'mindset' | 'productivity' | 'social';
  lastMissed?: string; // ISO date
}

export interface Goal {
  id: string;
  name: string;
  category: 'health' | 'business' | 'mindset' | 'finance' | 'relationships';
  progress: number;
  target: string;
  deadline: string;
  madeAt: string; // ISO date — for "you promised X days ago"
}

export interface CheckIn {
  date: string; // YYYY-MM-DD
  type: 'morning' | 'evening';
  mission?: string;
  energy?: number; // 1-5
  distraction?: string;
  completed?: boolean;
  reason?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: number;
}

export interface WeekData {
  day: string;
  score: number;
  completed: number;
  total: number;
}

export interface AppState {
  screen: Screen;
  userName: string;
  monkMode: boolean;
  streak: number;
  dopamineScore: number;
  habits: Habit[];
  goals: Goal[];
  chatHistory: ChatMessage[];
  weekData: WeekData[];
  onboardingDone: boolean;
  personality: CoachPersonality;
  checkIns: CheckIn[];
  morningDone: boolean;
  eveningDone: boolean;
  identityStatement: string; // "I am the type of person who..."
}

export const personalities: Record<CoachPersonality, {
  name: string;
  emoji: string;
  tagline: string;
  color: string;
  description: string;
}> = {
  drill_sergeant: {
    name: 'Drill Sergeant',
    emoji: '🪖',
    tagline: 'No excuses. Ever.',
    color: '#f06060',
    description: 'Brutal. Loud. Effective. Will call you out without mercy.',
  },
  stoic_mentor: {
    name: 'Stoic Mentor',
    emoji: '🏛️',
    tagline: 'Control what you can.',
    color: '#b8f058',
    description: 'Calm, philosophical, Marcus Aurelius energy. Logic over emotion.',
  },
  anime_sensei: {
    name: 'Anime Sensei',
    emoji: '⛩️',
    tagline: 'Your arc is not over.',
    color: '#7b6af0',
    description: 'Believes in your potential with dramatic intensity. Power-up mentality.',
  },
  goggins: {
    name: 'Stay Hard',
    emoji: '💀',
    tagline: 'Who\'s gonna carry the boats?',
    color: '#f5c840',
    description: 'Extreme ownership. Raw accountability. Callus your mind.',
  },
  ceo_coach: {
    name: 'CEO Coach',
    emoji: '📈',
    tagline: 'Execute or get left behind.',
    color: '#40f5c8',
    description: 'ROI-focused. Strategic. Results only — no feelings.',
  },
  calm_therapist: {
    name: 'Calm Therapist',
    emoji: '🌿',
    tagline: 'Progress, not perfection.',
    color: '#f0a060',
    description: 'Compassionate but honest. Holds space and holds you accountable.',
  },
};

export const defaultHabits: Habit[] = [
  { id: '1', name: 'Morning workout', emoji: '💪', streakDays: 14, completedToday: true, category: 'health' },
  { id: '2', name: 'Cold shower', emoji: '🚿', streakDays: 9, completedToday: true, category: 'health' },
  { id: '3', name: 'Read 20 pages', emoji: '📖', streakDays: 14, completedToday: true, category: 'mindset' },
  { id: '4', name: 'Deep work block', emoji: '🧠', streakDays: 7, completedToday: true, category: 'productivity' },
  { id: '5', name: 'Evening journal', emoji: '✍️', streakDays: 13, completedToday: false, category: 'mindset', lastMissed: '2026-05-14' },
];

export const defaultGoals: Goal[] = [
  { id: '1', name: 'Run a half marathon', category: 'health', progress: 62, target: 'Complete 21km race', deadline: '2026-06-30', madeAt: '2026-04-01' },
  { id: '2', name: 'Build SaaS to $1k MRR', category: 'business', progress: 28, target: '$1,000 monthly revenue', deadline: '2026-08-01', madeAt: '2026-03-15' },
  { id: '3', name: 'Meditate 100 days straight', category: 'mindset', progress: 14, target: '100 consecutive days', deadline: 'Ongoing', madeAt: '2026-05-01' },
];

export const defaultWeekData: WeekData[] = [
  { day: 'Mon', score: 80, completed: 4, total: 5 },
  { day: 'Tue', score: 100, completed: 5, total: 5 },
  { day: 'Wed', score: 60, completed: 3, total: 5 },
  { day: 'Thu', score: 100, completed: 5, total: 5 },
  { day: 'Fri', score: 80, completed: 4, total: 5 },
  { day: 'Sat', score: 100, completed: 5, total: 5 },
  { day: 'Sun', score: 40, completed: 2, total: 5 },
];

export const leaderboard = [
  { rank: 1, initials: 'JS', name: 'JayS', streak: 21, score: 96, color: '#b8f058' },
  { rank: 2, initials: 'MK', name: 'MindfulK', streak: 18, score: 91, color: '#7b6af0' },
  { rank: 3, initials: 'AX', name: 'You', streak: 14, score: 82, color: '#b8f058', isYou: true },
  { rank: 4, initials: 'RT', name: 'RizeTogether', streak: 9, score: 74, color: '#f5c840' },
  { rank: 5, initials: 'DB', name: 'DisciplinedB', streak: 5, score: 61, color: '#7a7888' },
];
