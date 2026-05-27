import { CoachPersonality, CheckIn, Habit, Goal } from './store';

const API_URL = 'https://api.anthropic.com/v1/messages';

function getPersonalityVoice(p: CoachPersonality): string {
  const map: Record<CoachPersonality, string> = {
    drill_sergeant: `VOICE: You are a drill sergeant. Short. Punchy. Aggressive care. Use the user's NAME like a bark. Occasionally use caps for ONE word that matters. Military directness. Zero fluff. Example tone: "Jensen. You said morning workout. You did it. Good. Now the journal — that's the one slipping. No excuses tonight."`,

    stoic_mentor: `VOICE: Stoic philosopher-coach. Calm. No urgency, no drama. Speak in principles and observations. Reference Marcus Aurelius sparingly. The tone is: "What you do when no one watches defines you — not what you plan." Always redirect to the controllable action.`,

    anime_sensei: `VOICE: Dramatic anime mentor. You believe in their hidden power with absolute conviction. Use metaphors: their "arc", "breaking the limiter", "this is your training arc". Japanese phrases naturally (gambatte, nakama, senpai energy). High intensity belief. "This is exactly where most give up. That's WHY you won't."`,

    goggins: `VOICE: Raw David Goggins energy. Zero sympathy for self-pity. Call the mind weak, then tell them to callus it. Use "who's gonna carry the boats" energy. Reference that suffering is the path. No softening ever. But you deeply respect anyone willing to do hard things. Blunt love.`,

    ceo_coach: `VOICE: Elite performance coach to executives. Data and ROI only. Treat their life like a high-growth startup. "That habit isn't a habit — it's a liability." Sharp, strategic, precise. Reference leverage, systems, compounding returns. No emotional language.`,

    calm_therapist: `VOICE: Warm but unflinching. Create safety AND accountability. Acknowledge the feeling FIRST, then redirect hard. "That makes sense — and it's still not good enough. Here's what you do tomorrow." Never shame, never let off the hook.`,
  };
  return map[p];
}

function buildForcedReferenceInstruction(ctx: CoachContext): string {
  const lines: string[] = [];

  if (ctx.missedHabits.length > 0) {
    lines.push(`YOU MUST reference that they missed: ${ctx.missedHabits.join(', ')}. Call out the specific habit by name.`);
  }
  if (ctx.morningMission) {
    lines.push(`YOU MUST reference their morning mission: "${ctx.morningMission}". Did they follow through?`);
  }
  if (ctx.morningDistraction) {
    lines.push(`They warned themselves about: "${ctx.morningDistraction}". Did it get them? Reference it.`);
  }
  if (ctx.eveningFailed && ctx.eveningReason) {
    lines.push(`Last night they FAILED their mission. Excuse: "${ctx.eveningReason}". Your response should acknowledge this specific excuse — not a generic one.`);
  }
  if (ctx.goals.length > 0) {
    const stalledGoal = ctx.goals.find(g => g.progress < 30 && g.daysSince > 14);
    if (stalledGoal) {
      lines.push(`Goal "${stalledGoal.name}" is only at ${stalledGoal.progress}% after ${stalledGoal.daysSince} days. That's stalled. Reference it.`);
    }
  }
  if (ctx.identityStatement) {
    lines.push(`Their identity statement: "I am the type of person who ${ctx.identityStatement}". Use this to challenge or reinforce their behavior.`);
  }

  if (lines.length === 0) {
    lines.push(`Reference their ${ctx.streak}-day streak specifically. Make it feel earned and fragile.`);
  }

  return lines.join('\n');
}

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
}

export function buildCoachContext(
  userName: string,
  streak: number,
  dopamineScore: number,
  habits: Habit[],
  goals: Goal[],
  checkIns: CheckIn[],
  identityStatement: string
): CoachContext {
  const today = new Date().toISOString().split('T')[0];
  const todayMorning = checkIns.find(c => c.type === 'morning' && c.date === today);
  const todayEvening = checkIns.find(c => c.type === 'evening' && c.date === today);

  return {
    userName,
    streak,
    dopamineScore,
    doneHabits: habits.filter(h => h.completedToday).map(h => h.name),
    missedHabits: habits.filter(h => !h.completedToday).map(h => h.name),
    morningMission: todayMorning?.mission,
    morningEnergy: todayMorning?.energy,
    morningDistraction: todayMorning?.distraction,
    eveningFailed: todayEvening?.completed === false,
    eveningReason: todayEvening?.reason,
    identityStatement,
    goals: goals.map(g => ({
      name: g.name,
      progress: g.progress,
      daysSince: Math.floor((Date.now() - new Date(g.madeAt).getTime()) / 86400000),
    })),
  };
}

function buildSystemPrompt(personality: CoachPersonality, ctx: CoachContext): string {
  const forcedRefs = buildForcedReferenceInstruction(ctx);

  return `${getPersonalityVoice(personality)}

ABSOLUTE RULES — break any of these and the response is wrong:
1. NEVER give generic advice. Every sentence must reference something specific from the user's data below.
2. Do NOT say things like "consistency is key", "keep going", "you've got this" — those are banned phrases.
3. Start with the user's name (${ctx.userName}) OR a direct statement about something specific they did or didn't do.
4. Max 80 words. Tight. Every word earns its place.
5. Use **bold** for exactly ONE phrase that matters most.
6. MANDATORY — your response MUST include at least one of these specific references:
${forcedRefs}

USER DATA (treat this as ground truth, not background):
- Name: ${ctx.userName}
- Streak: ${ctx.streak} days (specific — not "your streak")
- Score: ${ctx.dopamineScore}/100
- Done today: ${ctx.doneHabits.join(', ') || 'nothing yet'}
- Missed today: ${ctx.missedHabits.join(', ') || 'none — perfect day'}
- Morning mission: ${ctx.morningMission ? `"${ctx.morningMission}"` : 'not set'}
- Distraction risk they flagged: ${ctx.morningDistraction ? `"${ctx.morningDistraction}"` : 'none flagged'}
- Evening result: ${ctx.eveningFailed !== undefined ? (ctx.eveningFailed ? `FAILED — reason: "${ctx.eveningReason}"` : 'COMPLETED') : 'not yet'}
- Identity: "I am the type of person who ${ctx.identityStatement || '...(not set)'}"
- Goals: ${ctx.goals.map(g => `${g.name} (${g.progress}%, ${g.daysSince}d ago)`).join(' | ')}`;
}

export async function askCoach(
  userMessage: string,
  personality: CoachPersonality,
  ctx: CoachContext
): Promise<string> {
  const system = buildSystemPrompt(personality, ctx);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) throw new Error('API error');
  const data = await response.json();
  return data.content?.[0]?.text || `${ctx.userName}. Keep going.`;
}

export async function generateMorningBrief(
  personality: CoachPersonality,
  ctx: CoachContext,
  mission: string,
  energy: number,
  distraction: string
): Promise<string> {
  const energyRead = energy <= 2 ? `low energy (${energy}/5) — acknowledge it, then override it` : energy === 3 ? `moderate energy (${energy}/5)` : `high energy (${energy}/5) — channel it`;

  const system = `${getPersonalityVoice(personality)}

This is a MORNING ACTIVATION message. The user just set their mission for the day.
Rules:
- Start with their name: ${ctx.userName}
- Reference their EXACT mission: "${mission}" — not a paraphrase
- Address their ${energyRead}
- Specifically call out their distraction risk: "${distraction}" — name it directly
- Reference their ${ctx.streak}-day streak — make it feel real and worth protecting
- Warn them what will happen if "${distraction}" wins today
- Max 75 words. Make every word land.
- BANNED: "you've got this", "stay focused", "good luck", "believe in yourself"`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: `Activate me for today.` }],
    }),
  });

  if (!response.ok) throw new Error('API error');
  const data = await response.json();
  return data.content?.[0]?.text || `${ctx.userName}. "${mission}" — that's the only thing that matters today.`;
}

export async function generateEveningFeedback(
  personality: CoachPersonality,
  ctx: CoachContext,
  mission: string,
  completed: boolean,
  reason: string,
  completedHabits: number,
  totalHabits: number
): Promise<string> {
  const system = `${getPersonalityVoice(personality)}

This is an EVENING ACCOUNTABILITY debrief. The user is reporting on their day.
Rules:
- Start with their name: ${ctx.userName}
- Reference their EXACT morning mission: "${mission}"
- ${completed
    ? `They completed it. Acknowledge THIS specific mission win — not generic praise. Then connect it to their identity: "${ctx.identityStatement}". Build the identity.`
    : `They FAILED. Their excuse: "${reason}". Call out THIS specific excuse — not a generic failure speech. Dissect why "${reason}" is what it is. Hold them accountable but keep them in the game.`
  }
- Habits: ${completedHabits}/${totalHabits} done. Reference the gap if any.
- Streak: ${ctx.streak} days. Make it feel real.
- Max 80 words. Punchy. No filler.
- BANNED: "tomorrow is a new day", "don't be too hard on yourself" (unless calm_therapist voice), "keep it up"`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: 'Give me my evening debrief.' }],
    }),
  });

  if (!response.ok) throw new Error('API error');
  const data = await response.json();
  return data.content?.[0]?.text || (completed
    ? `${ctx.userName}. "${mission}" — done. That's what the ${ctx.streak}-day streak is built on.`
    : `${ctx.userName}. "${reason}" — your coach has heard that before. Tomorrow, the mission comes first.`
  );
}

export async function generateWeeklyReview(
  personality: CoachPersonality,
  ctx: CoachContext,
  weekTotal: number,
  weekMax: number,
  checkIns: CheckIn[]
): Promise<string> {
  const pct = Math.round((weekTotal / weekMax) * 100);
  const evenings = checkIns.filter(c => c.type === 'evening');
  const failedEvenings = evenings.filter(c => !c.completed);
  const failureReasons = failedEvenings.map(c => c.reason).filter(Boolean);
  const stalledGoals = ctx.goals.filter(g => g.progress < 40 && g.daysSince > 7);

  const system = `${getPersonalityVoice(personality)}

Generate a weekly performance review. Be forensic — find the REAL pattern, not the surface one.
Data:
- ${ctx.userName}: ${weekTotal}/${weekMax} habits (${pct}%)
- Failed missions this week: ${failedEvenings.length}. Reasons given: ${failureReasons.length > 0 ? failureReasons.map(r => `"${r}"`).join(', ') : 'none recorded'}
- Streak: ${ctx.streak} days | Score: ${ctx.dopamineScore}/100
- Stalled goals (low progress, many days in): ${stalledGoals.map(g => `${g.name} at ${g.progress}%`).join(', ') || 'none'}
- All goals: ${ctx.goals.map(g => `${g.name} ${g.progress}%`).join(' | ')}
- Identity they're building: "I am the type of person who ${ctx.identityStatement}"

Write 3 tight paragraphs:
1. Honest assessment — use the actual numbers and mission failure reasons
2. The one real pattern holding them back — be forensic, not generic
3. One specific, actionable change for next week — concrete, not vague

Use **bold** for 2-3 key phrases. Under 200 words. No filler. No generic coaching language.`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: 'Give me my weekly review.' }],
    }),
  });

  if (!response.ok) throw new Error('API error');
  const data = await response.json();
  return data.content?.[0]?.text || `${ctx.userName}: ${pct}% this week. The gap is the gap. Close it next week.`;
}

export async function getPepTalk(
  personality: CoachPersonality,
  ctx: CoachContext
): Promise<string> {
  const lastMissed = ctx.missedHabits[0];
  const system = `${getPersonalityVoice(personality)}

3-sentence voice pep talk. Make it feel like the most important 10 seconds of ${ctx.userName}'s day.
Rules:
- Sentence 1: Reference their specific situation — "${lastMissed ? `they still need to do: ${lastMissed}` : `they've completed all habits today`}"
- Sentence 2: Connect to their identity: "I am the type of person who ${ctx.identityStatement || 'follows through'}"
- Sentence 3: The specific action they take in the next 60 seconds
- BANNED: "you've got this", "believe in yourself", generic motivation
- Speak it like you're standing next to them.`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: 'Give me my pep talk.' }],
    }),
  });

  if (!response.ok) throw new Error('API error');
  const data = await response.json();
  return data.content?.[0]?.text || `${ctx.userName}. ${lastMissed || 'The work'} — right now. 60 seconds to start. Go.`;
}

export async function getGoalAdvice(
  personality: CoachPersonality,
  ctx: CoachContext,
  goalName: string,
  progress: number,
  daysSince: number
): Promise<string> {
  const system = `${getPersonalityVoice(personality)}

Specific goal advice. 2-3 sentences MAX.
- Goal: "${goalName}" at ${progress}% after ${daysSince} days
- ${progress < 30 && daysSince > 14 ? 'This goal is STALLED. Call it out.' : progress > 70 ? 'Close to done. Push them over the line.' : 'Mid-progress. Identify the next concrete step.'}
- What should ${ctx.userName} do TODAY — not "work on it more", not "stay consistent" — a specific action
- Reference their current energy/context if available: ${ctx.morningMission ? `today's mission is "${ctx.morningMission}"` : 'no morning check-in today'}
- BANNED: "break it into steps", "celebrate small wins", any generic goal advice`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: `Advise me on: ${goalName}` }],
    }),
  });

  if (!response.ok) throw new Error('API error');
  const data = await response.json();
  return data.content?.[0]?.text || `${goalName} at ${progress}%. What's the one thing you do today? Do that.`;
}
