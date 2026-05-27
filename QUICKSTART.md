# Monk.ai Mobile App — Quick Start

Built:  
✅ React Native + Expo (`mobile-rn/`)  
✅ Express.js backend + SQLite (`backend-mobile/`)  
✅ Design system (tokens, components, screens)  
✅ API client + local storage persistence  
✅ Auth flow (Login/Register)  
✅ Coach chat interface  

## Run It

### Terminal 1 — Backend

```bash
cd backend-mobile
npm run build  # Compile TypeScript
npm start     # Run server on :3001
```

Check: `curl http://localhost:3001/health`  
Response: `{"status":"ok","timestamp":"..."}`

### Terminal 2 — Mobile App

```bash
cd mobile-rn
npm start
```

Then:
- **iPhone:** Open Expo Go app → scan QR code
- **Android:** Open Expo Go app → scan QR code  
- **Web:** Press `w` in terminal

### Login

- **Email:** user@monk.ai
- **Password:** password123
- Or register new account

## What Works

| Feature | Status | Notes |
|---------|--------|-------|
| **Auth** | ✅ Done | Register/Login → JWT token → AsyncStorage |
| **Coach Chat** | ✅ Done | Send messages → AI (mock) responses |
| **Local Storage** | ✅ Done | Token, user, app state persisted |
| **Backend API** | ✅ Done | All 20+ routes stubbed + working |
| **Design System** | ✅ Done | Dark theme, 6 personalities, responsive |
| **CoachScreen** | ✅ Done | Chat + message sending |

## What's Next

### Quick Adds (30 min each)

1. **CheckIn Screen** — Morning/evening check-ins
2. **Habits Screen** — Add/complete habits with streaks
3. **Goals Screen** — Goal cards + progress
4. **Stats Screen** — Dopamine score gauge + week chart
5. **Review Screen** — Weekly AI analysis
6. **Tab Bar Navigation** — Bottom tabs switching between screens

### Medium (2-3 hours)

1. **Real Claude API** — Replace mock AI responses in `backend-mobile/src/index.ts:148`
   ```typescript
   // Before (mock):
   const aiText = responses[Math.floor(Math.random() * responses.length)];
   
   // After (real):
   const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
   const msg = await client.messages.create({
     model: 'claude-3-5-sonnet-20241022',
     system: getSystemPrompt(personality),
     messages: [{ role: 'user', content: text }],
   });
   const aiText = msg.content[0].text;
   ```

2. **Error Handling** — Retry logic, error toasts
3. **Loading States** — Spinners on all API calls
4. **Form Validation** — Email format, password strength

## Project Map

```
mobile-rn/                    React Native + Expo
├── src/
│   ├── App.tsx              Entry point → screens/auth
│   ├── screens/
│   │   ├── LoginScreen.tsx  ✅ Done
│   │   ├── CoachScreen.tsx  ✅ Done
│   │   ├── CheckInScreen.tsx (TODO)
│   │   ├── HabitsScreen.tsx  (TODO)
│   │   ├── GoalsScreen.tsx   (TODO)
│   │   ├── StatsScreen.tsx   (TODO)
│   │   └── ReviewScreen.tsx  (TODO)
│   ├── components/Theme.tsx ✅ Btn, Input, Toggle, Card, TopBar
│   ├── constants/tokens.ts  ✅ Design tokens (colors, spacing, safe areas)
│   ├── hooks/useAppState.ts ✅ State management + persistence
│   ├── api/client.ts        ✅ Axios + all routes
│   └── storage/index.ts     ✅ AsyncStorage wrapper
│
└── backend-mobile/          Express.js + SQLite
    ├── src/index.ts         ✅ All routes (auth, chat, habits, goals, etc)
    ├── db/monk.db           (auto-created on first run)
    └── dist/index.js        (compiled, run with `npm start`)
```

## API Routes (All 20+)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/user/profile
PUT    /api/user/profile

POST   /api/chat/message          → AI response
GET    /api/chat/history

GET    /api/habits
POST   /api/habits
POST   /api/habits/:id/complete

GET    /api/goals
POST   /api/goals
POST   /api/chat/goal-advice

POST   /api/checkins
GET    /api/checkins?date=YYYY-MM-DD

GET    /api/stats/week
GET    /api/stats/leaderboard

POST   /api/review/generate
```

## Test With curl

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@monk.ai","password":"test","name":"Test User"}'
# Response: {"token":"...", "user":{...}}

# Chat
curl -X POST http://localhost:3001/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"text":"What should I focus on?"}'
# Response: {"role":"ai", "text":"..."}

# Create habit
curl -X POST http://localhost:3001/api/habits \
  -H "Content-Type: application/json" \
  -d '{"name":"Morning run","emoji":"🏃","category":"fitness"}'
```

## Design System

- **Dark theme:** bg=`#0a0a0a`, surface=`#141414`, text=`#e5e5e5`
- **6 Personalities:** Drill (#f06060), Stoic (#b8f058), Sensei (#d65bff), Stay Hard (#ff8a3d), CEO (#5b9eff), Calm (#5be0c8)
- **Fonts:** Syne (display), DM Mono (mono)
- **Safe areas:** iPhone notch auto-handled  
- **Components:** Reusable Btn, Input, Toggle, Slider, Card, TopBar

## Troubleshoot

**Backend won't compile?**
```bash
cd backend-mobile
rm dist/
npx tsc
```

**Expo won't start?**
```bash
cd mobile-rn
rm -rf node_modules package-lock.json
npm install
npm start
```

**API not connecting?**  
Check `src/api/client.ts` line 4 — API_URL must match backend port (3001).

**Database locked?**  
Delete `backend-mobile/db/monk.db` and restart backend.

---

**You're ready!** Terminal 1 (backend), Terminal 2 (app), scan QR in Expo Go.  
Next: Add 5 screens, wire real Claude API, ship to TestFlight.
