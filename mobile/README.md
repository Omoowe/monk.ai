# Monk.ai – AI Accountability Coach 🧘

A React Native mobile app for AI-powered accountability coaching. Real-time feedback from your personal coach (choose from 6 personalities), habit tracking, goal management, and weekly AI-generated reviews.

## Features

- **🤖 AI Coach** – Chat with your personal coach powered by OpenAI
  - 6 personalities: Stoic Mentor, Drill Sergeant, Anime Sensei, Stay Hard, CEO Coach, Calm Therapist
  - Pep talks on demand
  - Morning briefs & evening feedback

- **✅ Habit Tracking** – Build habits with streak counting
  - Daily completions
  - Streak visualization
  - Habit categories

- **🎯 Goals** – Track progress toward long-term goals
  - Progress visualization
  - Deadline tracking
  - AI-powered goal advice

- **📋 Check-Ins** – Morning missions & evening debriefs
  - Set daily mission
  - Track energy levels
  - Log completion reasons
  - Get AI feedback

- **📊 Stats Dashboard** – See your progress
  - Dopamine score (habit completion %)
  - Current streak
  - Weekly summary
  - Leaderboard

- **📝 Weekly Reviews** – AI-generated forensic analysis
  - 3-paragraph reviews
  - Personalized to your coach
  - Highlights wins & areas for growth

- **🔐 User Auth** – Secure login via Supabase
  - Email/password signup
  - Session persistence
  - Row-level security

## Tech Stack

- **Frontend**: React Native + Expo
- **Backend**: Supabase (PostgreSQL + Auth)
- **AI**: OpenAI (gpt-4-turbo)
- **Navigation**: React Navigation (Stack + Tab)
- **Styling**: React Native StyleSheet

## Quick Start

See [SETUP.md](./SETUP.md) for detailed instructions.

```bash
# Install dependencies
npm install

# Set up .env with Supabase & OpenAI keys
# (see SETUP.md for how to get them)

# Start dev server
npm run ios     # iOS Simulator
npm run android # Android Emulator
npm run web     # Web (Expo Go)
```

## Project Structure

```
src/
├── lib/
│   └── supabase.ts          — Supabase client
├── screens/
│   ├── LoginScreen.tsx
│   ├── CoachScreen.tsx      — AI chat interface
│   ├── CheckInScreen.tsx    — Morning/evening check-ins
│   ├── HabitsScreen.tsx     — Habit tracking
│   ├── GoalsScreen.tsx      — Goal management
│   ├── StatsScreen.tsx      — Dashboard & leaderboard
│   └── ReviewScreen.tsx     — Weekly AI review
└── services/
    └── openai.ts            — OpenAI API wrapper
```

## Database

Supabase PostgreSQL with 7 tables:
- `users` — User profiles with personality
- `habits` — Habit definitions & streaks
- `habit_completions` — Daily check-ins
- `goals` — Goal tracking
- `check_ins` — Morning/evening logs
- `chat_messages` — Chat history
- `reviews` — Weekly summaries

Row-level security (RLS) ensures users can only access their own data.

## Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=https://[project].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
OPENAI_API_KEY=sk-...
```

## Personalities

| ID | Name | Vibe |
|---|---|---|
| stoic_mentor | Stoic Mentor | Marcus Aurelius wisdom |
| drill_sergeant | Drill Sergeant | Military discipline |
| anime_sensei | Anime Sensei | Power-up energy |
| goggins | Stay Hard | Raw Goggins energy |
| ceo_coach | CEO Coach | ROI-focused strategy |
| calm_therapist | Calm Therapist | Compassionate firmness |

## Key Flows

### Morning
1. Choose mission & energy level
2. Get morning brief from AI coach
3. Complete habit checklist

### Evening
1. Log mission completion & reason
2. Get AI feedback & dopamine update
3. View streak progress

### Weekly
1. View stats dashboard
2. Generate AI review (3 paragraphs)
3. Get insights for next week

## Testing Checklist

- [ ] Register new account
- [ ] Pick personality in onboarding
- [ ] Send message to coach → AI responds
- [ ] Do morning check-in → get brief
- [ ] Create habit, complete today → streak updates
- [ ] Create goal, add progress
- [ ] Do evening check-in → get feedback
- [ ] View stats (dopamine, streak, week summary)
- [ ] Generate weekly review
- [ ] Close & reopen app → data persists

## Deployment

See [SETUP.md](./SETUP.md) "Next Steps" for:
- Deploying to Expo Go
- Building native iOS/Android
- Publishing to App Stores
- Setting up EAS Build

## API Costs

- **Supabase**: Free tier includes 500K rows & unlimited API calls
- **OpenAI**: ~$0.01-0.10 per user per week (gpt-4-turbo)

## License

MIT
