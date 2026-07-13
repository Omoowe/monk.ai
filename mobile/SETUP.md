# Monk.ai — Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g @expo/cli`
- Supabase CLI: `npm install -g supabase`
- iOS: Xcode + simulator, or physical device with Expo Go
- Android: Android Studio + emulator, or physical device with Expo Go

---

## Step 1: Install dependencies

```bash
cd mobile
npm install
```

---

## Step 2: Supabase project

1. Create project at [supabase.com](https://supabase.com)
2. Wait for it to initialize (~1 min)
3. Go to **Settings → API** and copy:
   - Project URL → `EXPO_PUBLIC_SUPABASE_URL`
   - Anon/Public key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## Step 3: Environment variables

Create `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> **Never put your Anthropic API key here.** It lives in Supabase secrets only.

---

## Step 4: Push database schema

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

This applies both migration files:
- `20260518000000_init.sql` — all tables + RLS + auth trigger
- `20260518000001_goals_category.sql` — category column for goals

Your project ref is in your Supabase dashboard URL: `app.supabase.com/project/YOUR_REF`.

---

## Step 5: Deploy Edge Functions (AI proxy)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
supabase functions deploy chat
supabase functions deploy pep-talk
supabase functions deploy morning-brief
supabase functions deploy evening-feedback
supabase functions deploy review
```

The API key never touches the mobile app — it lives in Supabase secrets and is called from Edge Functions (Deno).

---

## Step 6: Enable Email auth

In Supabase dashboard → **Authentication → Providers** → ensure **Email** is enabled.

---

## Step 7: Run the app

```bash
# iOS simulator
npm run ios

# Android emulator
npm run android

# Expo Go (scan QR code with your phone)
npm start
```

---

## First-run flow

1. **Register** — email + password
2. **Welcome screen** — intro splash
3. **Onboarding** (3 steps):
   - Enter your name
   - Choose coach personality
   - Write identity statement
4. **Main app** — Coach, Check-In, Goals, Stats, Review tabs

---

## App overview

| Screen | What it does |
|---|---|
| Coach | AI chat with your chosen personality + quick-action chips |
| Check-In | Morning mission + evening debrief + inline habit tracker |
| Goals | Goal cards with category, progress ±5%, AI advice |
| Stats | Dopamine score, 2×2 grid, 7-day bar chart |
| Review | Weekly AI analysis + best/worst habit + goal bars |
| Profile | Name, identity, personality picker, habit management, sign out |

**Access Profile**: tap the score circle in the top-right header from any screen.

---

## Database tables

| Table | Purpose |
|---|---|
| `users` | Profile: name, personality, streak, dopamine_score, identity_statement, onboarding_done |
| `habits` | User habits: name, emoji, streak_days |
| `habit_completions` | Daily toggle: habit_id, user_id, date |
| `goals` | Goals: name, category, progress, target, deadline |
| `check_ins` | Morning + evening entries per day |
| `chat_messages` | Coach chat history |
| `reviews` | Cached weekly AI reviews |

All tables have RLS — users only see their own data.

---

## Architecture

```
Mobile (Expo/RN)
  └── Supabase Auth (email/password)
  └── Supabase DB (Postgres + RLS)
  └── Supabase Edge Functions (Deno)
        └── Anthropic claude-sonnet-4-6 API
              (key stored as Supabase secret, never in app)
```

---

## Troubleshooting

**"Cannot find module"**
```bash
rm -rf node_modules && npm install
```

**Auth not working**
- Check `.env` values match Supabase dashboard
- Ensure Email provider is enabled

**AI calls failing (edge functions)**
- Verify `ANTHROPIC_API_KEY` is set: `supabase secrets list`
- Check functions are deployed: `supabase functions list`
- View logs: `supabase functions logs chat`

**DB schema issues**
- Re-run: `supabase db push`
- Check migration status: `supabase migration list`
