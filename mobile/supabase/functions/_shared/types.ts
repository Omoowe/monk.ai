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
  monkMode?: boolean;
  strictGoals?: boolean;
  coachMemory?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  personality: string;
  context: CoachContext;
  history?: ChatTurn[];
}

export interface PepTalkRequest {
  personality: string;
  context: CoachContext;
}

export interface MorningBriefRequest {
  personality: string;
  context: CoachContext;
  mission: string;
  energy: number;
  distraction: string;
}

export interface EveningFeedbackRequest {
  personality: string;
  context: CoachContext;
  mission: string;
  completed: boolean;
  reason: string;
  completedHabits: number;
  totalHabits: number;
}

export interface ReviewRequest {
  personality: string;
  context: CoachContext;
  weekTotal: number;
  weekMax: number;
  failedMissions: number;
  failureReasons: string[];
}
