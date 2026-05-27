# Monk.ai Mobile App — React Native + Expo

Full-stack accountability coaching app. Dark theme, 6 personalities, local storage + Express backend.

## Project Structure

```
monk-ai/
├── mobile-rn/         — React Native app (Expo)
│   ├── src/
│   │   ├── App.tsx    — Root app component
│   │   ├── screens/   — Login, Coach, CheckIn, Habits, Goals, Stats, Review
│   │   ├── components/Theme.tsx — Reusable UI (Btn, Input, Toggle, etc)
│   │   ├── constants/tokens.ts — Design tokens (colors, spacing, safe areas)
│   │   ├── api/client.ts — Backend API client
│   │   ├── storage/   — AsyncStorage persistence
│   │   └── hooks/     — useAppState, custom hooks
│   └── package.json   — Expo + React Native deps
│
└── backend-mobile/    — Express.js backend (SQLite)
    ├── src/
    │   └── index.ts   — Express server + routes
    ├── db/            — SQLite database (auto-created)
    └── package.json   — Express + SQLite deps
```

## Setup & Run

### 1. Start Backend

```bash
cd backend-mobile
npm install
npm run dev
# Server runs on http://localhost:3001
# Check: curl http://localhost:3001/health
```

### 2. Start React Native App

In another terminal:

```bash
cd mobile-rn
npm install
npm run start
# or: npm run ios (iPhone simulator)
# or: npm run android (Android emulator)
# or: npm run web (Web browser)
```

Then open Expo Go on your iPhone and scan the QR code, or use simulator.

### 3. Test Login

- **Email:** user@monk.ai
- **Password:** password123
- Or register a new account

## How It Works

### Frontend (React Native)
- **Screens:** Login → Coach (main hub) + CheckIn, Habits, Goals, Stats, Review tabs
- **State:** `useAppState` hook with AsyncStorage persistence
- **API:** axios client to backend (`http://localhost:3001`)
- **Design:** Tokens (dark theme) + reusable components (Btn, Input, Toggle, etc)

### Backend (Express.js)
- **Routes:** `/api/auth`, `/api/chat`, `/api/habits`, `/api/goals`, `/api/checkins`, `/api/stats`, `/api/review`
- **Database:** SQLite (auto-created in `backend-mobile/db/monk.db`)
- **Mock AI:** Responds with coaching quotes (ready for real Anthropic API integration)

## Key Features Implemented

✅ **Auth:** Login/Register with JWT tokens  
✅ **Local Storage:** All data persists to AsyncStorage  
✅ **Design System:** Dark theme with 6 personality colors  
✅ **Coach Screen:** Chat interface with AI responses  
✅ **Database:** SQLite backend with all required tables  
✅ **API Client:** Axios with token management  

## Next Steps

1. **Add remaining screens:**
   - CheckInScreen (morning/evening)
   - HabitsScreen (with tab bar)
   - GoalsScreen, StatsScreen, ReviewScreen
   
2. **Wire backend to real Claude API:**
   - Replace mock responses in `/api/chat/message` with `Anthropic.Messages.create()`
   - Add system prompts (from original design)

3. **Add Tab Bar Navigation:**
   - Bottom tab bar routing between screens
   - Persist active tab state

4. **Polish:**
   - Error handling + retry logic
   - Loading states on all API calls
   - Proper error messages

## API Endpoints

| Method | Route | Body | Response |
|--------|-------|------|----------|
| POST | `/api/auth/register` | email, password, name | token, user |
| POST | `/api/auth/login` | email, password | token, user |
| GET | `/api/user/profile` | — | user data |
| PUT | `/api/user/profile` | personality, identity, name | success |
| POST | `/api/chat/message` | text | {role, text} |
| GET | `/api/chat/history` | — | messages[] |
| POST | `/api/habits` | name, emoji, category | habit |
| GET | `/api/habits` | — | habits[] |
| POST | `/api/goals` | name, category, target, deadline | goal |
| GET | `/api/goals` | — | goals[] |
| POST | `/api/checkins` | date, type, mission, energy, etc | success |
| GET | `/api/stats/week` | — | dopamineScore, weekData |

## Test Endpoints

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@monk.ai","password":"pwd123","name":"Test"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@monk.ai","password":"pwd123"}'

# Send message
curl -X POST http://localhost:3001/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"text":"What should I do today?"}'
```

## Notes

- **Frontend API URL:** `http://localhost:3001` (hardcoded in `src/api/client.ts`)
- **Safe areas:** iOS notch handling automatic via React Native
- **Fonts:** Syne + DM Mono imported from Google Fonts (fallback to system)
- **Database file:** Auto-created at `backend-mobile/db/monk.db` on first run
