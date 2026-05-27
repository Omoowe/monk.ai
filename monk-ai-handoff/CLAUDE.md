# Monk.ai — Claude Code Project Brief

## What this is
An AI accountability coach app. NOT a habit tracker — an emotional accountability system with memory, personality, and real stakes. Built for the discipline/self-improvement culture (Gen Z, ADHD professionals, entrepreneurs).

## Current state
A working single-file HTML prototype (`monk-ai.html`) with full UI and AI coaching logic. Now needs to be a real full-stack app with persistence, auth, and a proper backend.

---

## Architecture to build

### Frontend — React + Vite + TypeScript + Tailwind
Location: `/frontend`

All source files are in `/src`. The design system uses:
- Fonts: Syne (display) + DM Mono (monospace) — imported from Google Fonts
- Dark theme with CSS variables (see `src/index.css`)
- Mobile-first, iOS safe areas, 100dvh

**Screens:**
1. `CoachScreen` — AI chat, Monk Mode panel, voice input
2. `CheckInScreen` — Morning mission + Evening debrief
3. `HabitsScreen` — Habit check-ins with streaks
4. `GoalsScreen` — Goal cards with AI advice
5. `StatsScreen` — Dopamine score, week chart, leaderboard
6. `ReviewScreen` — Weekly AI analysis

**Key frontend changes needed:**
- Replace `src/ai.ts` direct Anthropic API calls → call backend API instead (never expose API key in browser)
- Replace `useState` app state → TanStack Query + backend API calls
- Add auth (Clerk or Supabase Auth)
- Add proper routing (React Router v6)

---

### Backend — Node.js + Express + TypeScript
Location: `/backend`

#### API Routes needed

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/user/profile
PUT    /api/user/profile

GET    /api/habits
POST   /api/habits
PUT    /api/habits/:id
DELETE /api/habits/:id
POST   /api/habits/:id/complete     — toggle today's completion

GET    /api/goals
POST   /api/goals
PUT    /api/goals/:id
DELETE /api/goals/:id

GET    /api/checkins?date=YYYY-MM-DD
POST   /api/checkins                — create morning or evening check-in

GET    /api/chat/history
POST   /api/chat/message            — sends to Claude, saves response
POST   /api/chat/pep-talk
POST   /api/chat/goal-advice

GET    /api/stats/week
GET    /api/stats/leaderboard

POST   /api/review/generate         — weekly AI review
```

#### AI proxy (critical)
The backend handles ALL Anthropic API calls. The system prompts from `src/ai.ts` move here verbatim. The API key lives in `.env` only.

```typescript
// backend/src/ai/prompts.ts — copy all logic from frontend src/ai.ts
// backend/src/routes/chat.ts — proxy to Anthropic, save to DB
```

#### Database — PostgreSQL + Prisma

**Schema:**

```prisma
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  name              String
  personality       String    @default("stoic_mentor")
  identityStatement String    @default("")
  streak            Int       @default(0)
  dopamineScore     Int       @default(50)
  monkMode          Boolean   @default(false)
  createdAt         DateTime  @default(now())
  
  habits            Habit[]
  goals             Goal[]
  checkIns          CheckIn[]
  chatMessages      ChatMessage[]
}

model Habit {
  id            String   @id @default(cuid())
  userId        String
  name          String
  emoji         String   @default("✅")
  category      String   @default("productivity")
  streakDays    Int      @default(0)
  lastCompleted DateTime?
  createdAt     DateTime @default(now())
  
  user          User     @relation(fields: [userId], references: [id])
  completions   HabitCompletion[]
}

model HabitCompletion {
  id        String   @id @default(cuid())
  habitId   String
  date      String   — YYYY-MM-DD
  habit     Habit    @relation(fields: [habitId], references: [id])
  
  @@unique([habitId, date])
}

model Goal {
  id        String   @id @default(cuid())
  userId    String
  name      String
  category  String
  progress  Int      @default(0)
  target    String
  deadline  String
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
}

model CheckIn {
  id          String   @id @default(cuid())
  userId      String
  date        String   — YYYY-MM-DD
  type        String   — 'morning' | 'evening'
  mission     String?
  energy      Int?
  distraction String?
  completed   Boolean?
  reason      String?
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id])
  @@unique([userId, date, type])
}

model ChatMessage {
  id        String   @id @default(cuid())
  userId    String
  role      String   — 'user' | 'ai'
  text      String
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
}
```

---

## Streak calculation logic
Run this server-side on each habit completion:
1. Get last completion date
2. If yesterday → streak + 1
3. If today (already counted) → no change
4. If gap > 1 day → streak resets to 1
5. Update `User.streak` = max streak across all habits

## Dopamine score calculation
`score = (habitsCompletedThisWeek / totalPossible) * 100`
Recalculate on every habit completion, store on User.

---

## Environment variables needed

```env
# backend/.env
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=...
PORT=3001

# frontend/.env
VITE_API_URL=http://localhost:3001
```

---

## Project structure to create

```
monk-ai/
├── frontend/
│   ├── src/           ← (move existing src/ here)
│   │   ├── api/       ← NEW: api client (replaces direct fetch to Anthropic)
│   │   ├── components/
│   │   ├── hooks/     ← NEW: useHabits, useGoals, useChat, useAuth
│   │   ├── store.ts   ← keep types, remove defaults (comes from API now)
│   │   └── ai.ts      ← DELETE (logic moves to backend)
│   ├── package.json
│   └── vite.config.ts
│
└── backend/
    ├── src/
    │   ├── routes/
    │   │   ├── auth.ts
    │   │   ├── habits.ts
    │   │   ├── goals.ts
    │   │   ├── checkins.ts
    │   │   ├── chat.ts     ← AI proxy lives here
    │   │   ├── stats.ts
    │   │   └── review.ts
    │   ├── ai/
    │   │   ├── prompts.ts  ← all personality/system prompts from src/ai.ts
    │   │   └── client.ts   ← Anthropic SDK wrapper
    │   ├── middleware/
    │   │   └── auth.ts     ← JWT verify
    │   ├── prisma/
    │   │   └── schema.prisma
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

---

## The AI system prompts (copy these exactly)

The entire coaching personality system is in `src/ai.ts`. Key functions to move to backend:
- `getPersonalityVoice(personality)` — voice definitions per coach
- `buildForcedReferenceInstruction(ctx)` — forces specific habit/mission references
- `buildSystemPrompt(personality, ctx)` — full system prompt
- `buildCoachContext(...)` — assembles user state into context object
- All `generate*` and `ask*` functions — become POST route handlers

The prompts are what make the AI different from every other app. Preserve them exactly.

---

## Coach personalities (6)

| ID | Name | Color | Vibe |
|---|---|---|---|
| drill_sergeant | Drill Sergeant | #f06060 | Military, no excuses |
| stoic_mentor | Stoic Mentor | #b8f058 | Marcus Aurelius energy |
| anime_sensei | Anime Sensei | #7b6af0 | Dramatic, power-up |
| goggins | Stay Hard | #f5c840 | Raw Goggins energy |
| ceo_coach | CEO Coach | #40f5c8 | ROI-focused, strategic |
| calm_therapist | Calm Therapist | #f0a060 | Compassionate but firm |

---

## MVP launch checklist
- [ ] Backend: Auth + all API routes
- [ ] Backend: AI proxy (Anthropic API key secured server-side)
- [ ] Backend: Prisma + PostgreSQL
- [ ] Frontend: Replace ai.ts calls with backend API calls
- [ ] Frontend: Add auth (login/register screens)
- [ ] Frontend: Persist state via API (no more useState-only)
- [ ] Deploy: Backend to Railway/Render, Frontend to Vercel
- [ ] Domain + HTTPS

## Monetisation (post-MVP)
- Free: 1 personality, 10 AI messages/day, 3 habits, 2 goals
- Pro ($9/mo): All 6 personalities, unlimited messages, unlimited habits/goals, weekly review, Monk Mode
- Stripe integration via backend `/api/billing` routes
