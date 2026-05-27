import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  askCoach,
  getPepTalk,
  getGoalAdvice as aiGoalAdvice,
  generateWeeklyReview as aiWeeklyReview,
  generateMorningBrief,
  generateEveningFeedback,
  type CoachContext,
} from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cors());

const dbPath = path.join(__dirname, '../db/monk.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    personality TEXT DEFAULT 'stoic',
    identity TEXT DEFAULT '',
    streak INTEGER DEFAULT 0,
    dopamine_score INTEGER DEFAULT 50,
    token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    emoji TEXT DEFAULT '✅',
    category TEXT DEFAULT 'productivity',
    streak_days INTEGER DEFAULT 0,
    last_completed TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    emoji TEXT DEFAULT '🎯',
    category TEXT,
    progress INTEGER DEFAULT 0,
    target TEXT,
    deadline TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS check_ins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT,
    type TEXT,
    mission TEXT,
    energy INTEGER,
    distraction TEXT,
    completed BOOLEAN,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, date, type)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT,
    text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migrations for existing DBs
try { db.exec('ALTER TABLE users ADD COLUMN token TEXT'); } catch {}
try { db.exec('ALTER TABLE goals ADD COLUMN emoji TEXT DEFAULT \'🎯\''); } catch {}

// Seed test user
db.prepare(`INSERT OR IGNORE INTO users (id, email, password, name, token, personality) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('user_test', 'test@monk.ai', 'password', 'Marcus', 'test_token', 'stoic');

// Auth: extract userId from Bearer token
const getUser = (req: Request): string => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const user = db.prepare('SELECT id FROM users WHERE token = ?').get(token) as any;
    if (user) return user.id;
  }
  return 'user_test';
};

const today = () => new Date().toISOString().split('T')[0];
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

// ─── Build coach context from DB ─────────────────────────────────────────

function buildContext(userId: string): CoachContext {
  const t = today();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ?').all(userId) as any[];
  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ?').all(userId) as any[];
  const morningCI = db.prepare("SELECT * FROM check_ins WHERE user_id = ? AND date = ? AND type = 'morning'").get(userId, t) as any;
  const eveningCI = db.prepare("SELECT * FROM check_ins WHERE user_id = ? AND date = ? AND type = 'evening'").get(userId, t) as any;

  return {
    userName: user?.name || 'Warrior',
    streak: user?.streak || 0,
    dopamineScore: user?.dopamine_score || 50,
    doneHabits: habits.filter(h => h.last_completed === t).map(h => h.name),
    missedHabits: habits.filter(h => h.last_completed !== t).map(h => h.name),
    morningMission: morningCI?.mission,
    morningEnergy: morningCI?.energy,
    morningDistraction: morningCI?.distraction,
    eveningFailed: eveningCI ? !eveningCI.completed : undefined,
    eveningReason: eveningCI?.reason,
    identityStatement: user?.identity || '',
    goals: goals.map(g => ({
      name: g.name,
      progress: g.progress || 0,
      daysSince: Math.floor((Date.now() - new Date(g.created_at).getTime()) / 86400000),
    })),
  };
}

// ─── Health ───────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Auth ─────────────────────────────────────────────────────────────────

app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const id = `user_${Date.now()}`;
    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    db.prepare(`INSERT INTO users (id, email, password, name, token) VALUES (?, ?, ?, ?, ?)`)
      .run(id, email, password, name, token);

    res.json({ token, user: { id, email, name, personality: 'stoic' } });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password) as any;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, user.id);

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, personality: user.personality } });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// ─── User ─────────────────────────────────────────────────────────────────

app.get('/api/user/profile', (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id, email: user.email, name: user.name,
      personality: user.personality, identity: user.identity,
      streak: user.streak, dopamineScore: user.dopamine_score,
    });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.put('/api/user/profile', (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const { personality, identity, name } = req.body;
    db.prepare('UPDATE users SET personality = ?, identity = ?, name = ? WHERE id = ?')
      .run(personality, identity, name, userId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// ─── Habits ───────────────────────────────────────────────────────────────

app.get('/api/habits', (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const t = today();
    const habits = db.prepare('SELECT * FROM habits WHERE user_id = ? ORDER BY created_at').all(userId) as any[];
    res.json({ habits: habits.map(h => ({ ...h, done: h.last_completed === t })) });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.post('/api/habits', (req: Request, res: Response) => {
  try {
    const { name, emoji, category } = req.body;
    const userId = getUser(req);
    const id = `habit_${Date.now()}`;
    db.prepare('INSERT INTO habits (id, user_id, name, emoji, category) VALUES (?, ?, ?, ?, ?)')
      .run(id, userId, name, emoji || '✅', category || 'work');
    res.json({ id, name, emoji, category, streak_days: 0, done: false });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.post('/api/habits/:id/complete', (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const { id } = req.params;
    const t = today();

    const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(id, userId) as any;
    if (!habit) return res.status(404).json({ error: 'Habit not found' });

    if (habit.last_completed === t) {
      // Undo today's completion
      db.prepare('UPDATE habits SET last_completed = NULL WHERE id = ?').run(id);
      res.json({ done: false, streak: habit.streak_days });
    } else {
      // Mark complete, update streak
      const newStreak = habit.last_completed === yesterday() ? habit.streak_days + 1 : 1;
      db.prepare('UPDATE habits SET last_completed = ?, streak_days = ? WHERE id = ?').run(t, newStreak, id);

      // Recalculate dopamine score
      const all = db.prepare('SELECT last_completed FROM habits WHERE user_id = ?').all(userId) as any[];
      const doneCount = all.filter(h => h.last_completed === t).length;
      const score = all.length > 0 ? Math.round((doneCount / all.length) * 100) : 0;
      db.prepare('UPDATE users SET dopamine_score = ? WHERE id = ?').run(score, userId);

      res.json({ done: true, streak: newStreak });
    }
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// ─── Goals ────────────────────────────────────────────────────────────────

app.get('/api/goals', (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at').all(userId) as any[];
    res.json({ goals });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.post('/api/goals', (req: Request, res: Response) => {
  try {
    const { name, emoji, category, target, deadline } = req.body;
    const userId = getUser(req);
    const id = `goal_${Date.now()}`;
    db.prepare('INSERT INTO goals (id, user_id, name, emoji, category, target, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, name, emoji || '🎯', category, target, deadline);
    res.json({ id, name, emoji, category, target, deadline, progress: 0 });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// ─── Check-ins ────────────────────────────────────────────────────────────

app.get('/api/checkins', (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const date = (req.query.date as string) || today();
    const checkins = db.prepare('SELECT * FROM check_ins WHERE user_id = ? AND date = ?').all(userId, date) as any[];
    res.json({ checkins });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.post('/api/checkins', (req: Request, res: Response) => {
  try {
    const { date, type, mission, energy, distraction, completed, reason } = req.body;
    const userId = getUser(req);
    const id = `checkin_${Date.now()}`;
    db.prepare(`
      INSERT INTO check_ins (id, user_id, date, type, mission, energy, distraction, completed, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date, type) DO UPDATE SET
        mission = excluded.mission, energy = excluded.energy,
        distraction = excluded.distraction, completed = excluded.completed,
        reason = excluded.reason
    `).run(id, userId, date, type, mission, energy, distraction, completed ? 1 : 0, reason);
    res.json({ id, success: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// ─── Chat ─────────────────────────────────────────────────────────────────

app.post('/api/chat/message', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const userId = getUser(req);
    const user = db.prepare('SELECT personality FROM users WHERE id = ?').get(userId) as any;
    const pers = (user?.personality || 'stoic') as any;

    const msgId = `msg_${Date.now()}`;
    db.prepare('INSERT INTO chat_messages (id, user_id, role, text) VALUES (?, ?, ?, ?)')
      .run(msgId, userId, 'user', text);

    const ctx = buildContext(userId);
    const aiText = await askCoach(text, pers, ctx);

    const aiId = `msg_${Date.now() + 1}`;
    db.prepare('INSERT INTO chat_messages (id, user_id, role, text) VALUES (?, ?, ?, ?)')
      .run(aiId, userId, 'ai', aiText);

    res.json({ role: 'ai', text: aiText, id: aiId });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.get('/api/chat/history', (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const messages = db.prepare('SELECT role, text, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at').all(userId);
    res.json({ messages });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.post('/api/chat/pep-talk', async (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const user = db.prepare('SELECT personality FROM users WHERE id = ?').get(userId) as any;
    const pers = (user?.personality || 'stoic') as any;
    const ctx = buildContext(userId);
    const text = await getPepTalk(pers, ctx);
    res.json({ text });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.post('/api/chat/goal-advice', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.body;
    const userId = getUser(req);
    const user = db.prepare('SELECT personality FROM users WHERE id = ?').get(userId) as any;
    const pers = (user?.personality || 'stoic') as any;
    const ctx = buildContext(userId);

    // Look up the specific goal if goalId provided
    const goal = goalId
      ? db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(goalId, userId) as any
      : null;

    const advice = await aiGoalAdvice(
      pers,
      ctx,
      goal?.name || 'your goal',
      goal?.progress || 0,
      goal ? Math.floor((Date.now() - new Date(goal.created_at).getTime()) / 86400000) : 0
    );
    res.json({ advice });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// ─── Stats ────────────────────────────────────────────────────────────────

app.get('/api/stats/week', (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const user = db.prepare('SELECT dopamine_score FROM users WHERE id = ?').get(userId) as any;
    const score = user?.dopamine_score ?? 50;

    // Build week data from habit completions
    const habits = db.prepare('SELECT last_completed FROM habits WHERE user_id = ?').all(userId) as any[];
    const weekData: number[] = [];
    const days: string[] = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const now = new Date();

    // Day of week: 0=Sun, 1=Mon...
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? 6 : dow - 1;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const count = habits.filter(h => h.last_completed === ds).length;
      weekData.push(count);
    }

    res.json({ dopamineScore: score, weekData, days });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.get('/api/stats/leaderboard', (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const user = db.prepare('SELECT name, dopamine_score FROM users WHERE id = ?').get(userId) as any;
    const myScore = user?.dopamine_score ?? 50;
    const myName = user?.name || 'you';

    // Mock leaderboard + real user score
    const entries = [
      { name: 'kaito_zen', score: 94, you: false },
      { name: 'ironwill_42', score: 88, you: false },
      { name: 'before_dawn', score: 82, you: false },
      { name: myName, score: myScore, you: true },
      { name: 'rep_machine', score: Math.max(myScore - 4, 5), you: false },
    ]
      .sort((a, b) => b.score - a.score)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    res.json({ leaderboard: entries });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// ─── Review ───────────────────────────────────────────────────────────────

app.post('/api/review/generate', async (req: Request, res: Response) => {
  try {
    const userId = getUser(req);
    const t = today();
    const user = db.prepare('SELECT personality FROM users WHERE id = ?').get(userId) as any;
    const pers = (user?.personality || 'stoic') as any;
    const habits = db.prepare('SELECT * FROM habits WHERE user_id = ?').all(userId) as any[];
    const goals = db.prepare('SELECT * FROM goals WHERE user_id = ?').all(userId) as any[];

    const doneCount = habits.filter((h: any) => h.last_completed === t).length;
    const totalHabits = habits.length;

    // Week total: count habits completed in last 7 days
    const weekTotal = habits.reduce((sum: number, h: any) => {
      if (!h.last_completed) return sum;
      const daysDiff = Math.floor((new Date(t).getTime() - new Date(h.last_completed).getTime()) / 86400000);
      return sum + (daysDiff <= 7 ? 1 : 0);
    }, 0);
    const weekMax = totalHabits * 7;

    // Failed mission reasons from this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const failedCIs = db.prepare(
      "SELECT reason FROM check_ins WHERE user_id = ? AND type = 'evening' AND completed = 0 AND date >= ?"
    ).all(userId, weekAgoStr) as any[];
    const failedReasons = failedCIs.map((c: any) => c.reason).filter(Boolean);

    // Stalled goals
    const stalledGoals = goals
      .filter((g: any) => g.progress < 40)
      .map((g: any) => ({ name: g.name, progress: g.progress || 0 }));

    const ctx = buildContext(userId);
    const analysis = await aiWeeklyReview(pers, ctx, weekTotal, weekMax, failedReasons, stalledGoals);

    // Build insights from real data
    const topStreak = habits.reduce((max: number, h: any) => Math.max(max, h.streak_days || 0), 0);
    const topHabit = habits.find((h: any) => h.streak_days === topStreak);

    const insights = [
      { kind: 'win', text: doneCount > 0 ? `${doneCount} habits completed today — the streak builds.` : 'You opened the app. The habit of checking in starts here.' },
      topHabit && topStreak > 0
        ? { kind: 'win', text: `${topHabit.emoji || '🔥'} ${topHabit.name} — ${topStreak} day streak. Your strongest input habit.` }
        : { kind: 'down', text: 'No streak data yet. Log your first habit to start building.' },
      failedReasons.length > 0
        ? { kind: 'down', text: `${failedReasons.length} failed mission${failedReasons.length > 1 ? 's' : ''} this week. Pattern: "${failedReasons[0]}"` }
        : { kind: 'win', text: 'All missions completed this week. Rare. Build on it.' },
      stalledGoals.length > 0
        ? { kind: 'down', text: `Goal stalled: "${stalledGoals[0].name}" at ${stalledGoals[0].progress}%. Re-anchor it.` }
        : { kind: 'win', text: 'Morning check-ins build the discipline foundation. Keep it.' },
    ].filter(Boolean);

    res.json({ analysis, missionDays: doneCount, totalHabits, insights });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Monk backend running on :${PORT}`);
});
