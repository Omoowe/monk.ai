# Monk.ai Mobile App — Design Spec

## Goal

Iterate on the existing `/mobile` Expo app to match the `monk-ai_4.html` prototype UI and flow. Add missing features (onboarding, Monk Mode panel, voice input). Replace client-side OpenAI calls with Supabase Edge Functions proxying Anthropic. Result: a fully functional React Native app backed entirely by Supabase.

## Success criteria

- App runs on iOS simulator and physical device
- Onboarding completes end-to-end and saves to Supabase
- AI coach responds via Supabase Edge Function (no API key in mobile bundle)
- All 6 screens styled to match prototype
- Monk Mode panel toggles and persists
- Voice input transcribes and fills chat input

---

## Architecture

### AI backend: Supabase Edge Functions

```
Mobile (Expo) ──▶ Supabase Edge Function ──▶ Anthropic API
                  (Deno runtime)               claude-sonnet-4-6
```

`ANTHROPIC_API_KEY` stored as Supabase secret — never in mobile bundle.

**5 edge functions:**

| Function | Replaces |
|---|---|
| `supabase/functions/chat/index.ts` | `askCoach()` |
| `supabase/functions/pep-talk/index.ts` | `generatePepTalk()` |
| `supabase/functions/morning-brief/index.ts` | `generateMorningBrief()` |
| `supabase/functions/evening-feedback/index.ts` | `generateEveningFeedback()` |
| `supabase/functions/review/index.ts` | `generateWeeklyReview()` |

Each function:
- Accepts `{ personality, ...context }` in request body
- Calls Anthropic with full personality system prompt (ported from `monk-ai-handoff/src/ai.ts`)
- Returns `{ text: string }`
- Uses `Authorization: Bearer <supabase_anon_key>` — Supabase validates the JWT before invoking

**Local dev:** requires Supabase CLI installed (`brew install supabase/tap/supabase`). Run `supabase functions serve` — serves all functions at `http://localhost:54321/functions/v1/`.
**Deploy:** `supabase functions deploy` — JWT verification on by default (mobile sends user's Supabase session token).

### Mobile service layer

**DELETE:** `mobile/src/services/openai.ts`

**NEW:** `mobile/src/services/ai.ts` — same function signatures as `openai.ts`, calls Supabase function URLs instead of OpenAI directly.

```typescript
// Same exports, different implementation
export async function askCoach(message, personality, history): Promise<string>
export async function generatePepTalk(personality, userState): Promise<string>
export async function generateMorningBrief(personality, mission, energy): Promise<string>
export async function generateEveningFeedback(personality, mission, completed, reason): Promise<string>
export async function generateWeeklyReview(personality, weekSummary): Promise<string>
```

**3 screens updated (import swap only):**
- `CoachScreen.tsx` — `askCoach`, `generatePepTalk`
- `CheckInScreen.tsx` — `generateMorningBrief`, `generateEveningFeedback`
- `ReviewScreen.tsx` — `generateWeeklyReview`

---

## Supabase migration

One new column on existing `users` table:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT false;
```

All other tables (`habits`, `goals`, `check_ins`, `chat_messages`, `reviews`) already exist in `supabase.sql`.

Set Anthropic secret:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

---

## Environment variables

```env
# mobile/.env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

No `OPENAI_API_KEY` anywhere. No separate backend `.env`.

---

## Onboarding flow

Triggered once after first login when `users.onboarding_done = false`.

**Steps:**
1. **Name** — "What do I call you?" — text input
2. **Coach picker** — "Pick your coach" — 6 personality cards showing name, color, one-line vibe
3. **Identity** — "Who are you becoming?" — text input for `identity_statement`
4. **Complete** — saves `{ name, personality, identity_statement, onboarding_done: true }` to `users` table, navigates to main app

**Navigation gate in `App.tsx`:**
```
session + onboarding_done=false → OnboardingScreen
session + onboarding_done=true  → AppTabs
no session                      → LoginScreen
```

**New file:** `mobile/src/screens/OnboardingScreen.tsx`

---

## CoachScreen additions

### Monk Mode panel

- Header button toggles `monkMode` state
- When active: panel slides up (Animated.Value) with 4 option rows:
  - Block Distractions
  - Dopamine Detox Timer
  - No Excuses Mode
  - Strict Daily Goals
- Active state persists via `supabase.from('users').update({ monk_mode: true })`
- Visual: panel background uses active personality color at 10% opacity

### Voice input

- Mic icon button in chat input row
- Library: `@react-native-voice/voice`
- States: idle → listening ("Listening…" shown) → transcribed (fills input)
- Graceful fallback: if permissions denied or not on device, button hidden
- Physical device only — not available in simulator

---

## Screen restyling

All screens already exist. Changes are visual/component updates to match `monk-ai_4.html`.

### CoachScreen
- Header: `Monk.ai` wordmark left, streak (🔥 N) + Monk Mode toggle right
- Chat bubbles: user right-aligned, AI left with personality color left border
- "Pep talk" quick action button above input bar
- Input row: text input + mic icon + send button

### CheckInScreen
- Morning / Evening segmented tabs
- Morning: mission text input ("Today's #1 mission — be specific"), energy selector (1–5 dots), distraction input, "Lock it in" CTA
- Evening: "Did you follow through?" boolean, reason text input, AI debrief triggers after submit
- AI response shown inline below form

### HabitsScreen
- Habit cards with: emoji, name, colored category badge, streak count
- One-tap complete (fills circle, triggers streak update)
- Swipe to delete or long-press menu
- "+" FAB to add habit (bottom right)

### GoalsScreen
- Goal cards: name, category badge, progress bar (0–100%), deadline chip
- Stall detection: if `updated_at` > 7 days old → show "This goal is STALLED. Call it out." in red
- Edit progress via slider
- "New Goal" button

### StatsScreen
- Dopamine Score: large ring/arc (0–100)
- Rank system based on score:
  - 0–30: Starting Out
  - 31–60: Rising Force
  - 61–85: Disciplined
  - 86–100: Monk Elite
- "This Week" section: completion rate, perfect days, current streak
- Leaderboard: mocked with placeholder users (real leaderboard is post-MVP)

### ReviewScreen
- Week header: "Week of [date range]"
- "Generate Review" button → calls `review` edge function with week summary
- Displays 3-paragraph AI analysis: what went well, what to improve, next week focus
- Loading state while generating

---

## Fonts

```bash
npx expo install expo-font @expo-google-fonts/syne @expo-google-fonts/dm-mono
```

Load in `App.tsx` with `useFonts`:
- `Syne_700Bold` → headings, wordmark
- `DMMono_400Regular` → labels, stats, monospace elements

Show `null` (splash) until fonts loaded.

---

## New dependencies

```bash
npx expo install @react-native-voice/voice expo-font @expo-google-fonts/syne @expo-google-fonts/dm-mono
npm install  # no additional npm deps beyond what's installed
```

---

## Out of scope

- Real leaderboard (mocked in StatsScreen)
- Push notifications
- Stripe / payments
- Social features
- App Store submission
- Analytics
