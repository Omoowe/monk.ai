# Monk.ai — User Flow Diagram

## Authentication & Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          APP LAUNCH                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Font + session load │
                    │  (black splash)      │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     no session          session exists     session exists
              │          onboarding=false   onboarding=true
              ▼                │                │
    ┌──────────────────┐       ▼                ▼
    │  LoginScreen     │  ┌──────────────┐  ┌────────────────┐
    │                  │  │ WelcomeScreen│  │  Main App Tabs │
    │  ┌────────────┐  │  └──────┬───────┘  └────────────────┘
    │  │  Welcome   │  │         │
    │  │  (default) │  │         ▼
    │  └─────┬──────┘  │  ┌──────────────────────────────────┐
    │        │         │  │        OnboardingScreen           │
    │  ┌─────▼──────┐  │  │                                  │
    │  │   Sign In  │  │  │  Step 1: Name + Avatar           │
    │  │   (email/  │  │  │  Step 2: Identity Statement ──►  │
    │  │   password)│  │  │          [Skip for now]          │
    │  └─────┬──────┘  │  │  Step 3: Choose Coach            │
    │        │         │  │  Step 4: Set First Habit         │
    │  ┌─────▼──────┐  │  │  Step 5: Review + Complete       │
    │  │  Register  │  │  └──────────────┬─────────────────--┘
    │  │  (email +  │  │                 │
    │  │  name +    │  │      onboarding_done = true
    │  │  password) │  │                 │
    │  └─────┬──────┘  │                 ▼
    │        │         │       ┌─────────────────┐
    │  ┌─────▼──────┐  │       │  Main App Tabs   │
    │  │  Forgot    │  │       └─────────────────┘
    │  │  Password  │  │
    │  │  (email    │  │
    │  │  link)     │  │
    │  └────────────┘  │
    └──────────────────┘
              │
    successful auth
              │
              ▼
   ┌────────────────────┐
   │   Main App Tabs    │
   └────────────────────┘
```

---

## Main Navigation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GLOBAL HEADER                                   │
│   Monk.ai          🔥 {streak}    [{dopamine_score}]  ──► ProfileScreen │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────┬───────────────┼───────────────┬───────────┐
        │           │               │               │           │
        ▼           ▼               ▼               ▼           ▼
   ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐
   │  COACH  │ │ CHECK-IN │ │   GOALS    │ │   STATS   │ │  SOCIAL  │
   │   🤖    │ │   📋     │ │    🎯      │ │    📊     │ │   ⚔️    │
   └────┬────┘ └────┬─────┘ └─────┬──────┘ └─────┬─────┘ └────┬─────┘
        │           │             │               │            │
        ▼           ▼             ▼               ▼            ▼
   CoachScreen  CheckIn      GoalsScreen      StatsScreen  SocialScreen
               Screen
```

---

## Screen-Level User Flows

### CoachScreen Flow
```
CoachScreen
│
├── Load chat history (last 30 messages from DB)
│
├── Load coach context (user profile, habits, goals, check-in)
│
├── [PERSONALITY PICKER] ──► tap current coach
│   └── scroll picker sheet ──► select coach
│       ├── Free: Stoic Mentor only ──► others trigger PaywallModal
│       └── Pro: all 6 available
│
├── [CHAT INPUT]
│   ├── Type message ──► Send ──► Edge Function: /chat ──► AI reply
│   │   └── Rate limit hit ──► PaywallModal (messages trigger)
│   │
│   ├── 🎙 Voice button ──► Record audio ──► Edge Function: /transcribe
│   │   └── Transcribed text auto-fills input
│   │
│   └── 💪 Pep Talk button ──► Edge Function: /pep-talk ──► AI reply
│
├── [MONK MODE PANEL] (swipe or tab)
│   └── ──► MonkModeScreen (modal)
│
└── [MilestoneModal] ──► shown on streak/habit milestones
```

### CheckInScreen Flow
```
CheckInScreen
│
├── Load: today's habits + existing check-ins + habit completions
│
├── [TOP SECTION] — Morning or Evening status indicators
│
├── [MORNING CHECK-IN FORM] (expandable)
│   ├── Mission input (one goal for today)
│   ├── Energy level (1–5 pill buttons)  Low ◄──────────► High
│   ├── Distraction input
│   └── Submit ──► Edge Function: /morning-brief ──► AI response shown
│
├── [HABITS SECTION]
│   ├── List of user's habits with category dots
│   ├── Tap habit to toggle completion (optimistic update + offline queue)
│   │   └── HabitHistoryModal ──► 35-day calendar grid
│   └── Badge count updates app tab icon
│
└── [EVENING CHECK-IN FORM] (expandable)
    ├── Did you complete your mission? (Yes / No)
    ├── If No: Reason input
    ├── Habit completion summary (X of Y done)
    └── Submit ──► Edge Function: /evening-feedback ──► AI debrief shown
```

### GoalsScreen Flow
```
GoalsScreen
│
├── Load goals from DB
│
├── [GOAL CARDS] — each shows:
│   ├── Category · Progress % · Deadline · Time remaining
│   ├── Progress bar
│   ├── [✏ goal name] ──► inline name edit
│   ├── [+ / −] step buttons ──► adjust progress (1% / 10%)
│   ├── [🤖 Coach Advice] ──► Edge Function: /goal-advice ──► AI tip
│   │   └── Rate limit hit ──► PaywallModal
│   ├── [✕ delete] ──► Alert confirm ──► delete
│   └── Milestone celebration ──► ConfettiOverlay + MilestoneModal
│
└── [+ Add Goal] button
    └── Inline form:
        ├── Goal name
        ├── Category picker
        ├── Target (text)
        ├── Deadline (days slider)
        └── Save ──► insert to DB
            └── Pro limit: 2 goals free ──► PaywallModal
```

### StatsScreen Flow
```
StatsScreen
│
├── Load: user stats (streak, dopamine_score), week completions
│
├── [DOPAMINE SCORE CARD] — only shown when week has data
│   └── {score} + label (e.g. "ON A ROLL")
│
├── [WEEK BAR CHART] — Mon–Sun completion bars
│
├── [STAT GRID]
│   ├── 🔥 Current Streak
│   ├── ⚡ Dopamine Score
│   ├── ✅ Done Today (X/Y habits)
│   └── ❤️ Health (placeholder)
│
├── [LEADERBOARD] — top 10 users by streak (public)
│
└── Pull-to-refresh ──► reload all stats
```

### ReviewScreen Flow
```
ReviewScreen  (accessible via modal from Stats or direct navigation)
│
├── [FREE USER VIEW]
│   ├── Teaser list (what the review contains)
│   ├── 🔒 Unlock weekly review ──► PaywallModal (review trigger)
│   └── No generation possible
│
└── [PRO USER VIEW]
    ├── Load week stats (habits, missions, check-ins)
    ├── [Generate My Review] ──► Edge Function: /review ──► AI analysis
    │   └── Shown as formatted markdown
    │
    ├── [STAT GRID] — week summary numbers
    │
    └── Pull-to-refresh ──► reload
```

### SocialScreen Flow
```
SocialScreen
│
├── [FRIENDS TAB]
│   ├── Username search ──► find users ──► Send friend request
│   ├── Pending incoming requests ──► Accept / Decline
│   ├── Friends list with streak + dopamine_score
│   └── [⚔️ Challenge] ──► duration picker (7 / 14 / 30 days)
│       └── Create streak battle
│
└── [BATTLES TAB]
    ├── Active challenges with opponent + days remaining
    ├── Completed challenges with winner
    └── Pending challenges (accept / decline)
```

### ProfileScreen Flow
```
ProfileScreen  (modal)
│
├── Avatar picker (emoji grid)
│
├── Account: email (read-only)
│
├── Name + Username (editable)
│
├── Identity Statement (text area)
│
├── [COACH PERSONALITY] — 6 options
│   └── Non-free coaches ──► PaywallModal (personality trigger)
│
├── [HABITS SECTION]
│   ├── List with emoji + category + streak
│   ├── Inline edit name
│   ├── Delete ──► Alert confirm
│   └── [+ Add Habit] ──► name + emoji + category
│       └── Free limit: 3 habits ──► PaywallModal (habits trigger)
│
├── [MONK MODE TOGGLE] ──► save to DB
│
├── [STRICT GOALS TOGGLE]
│
├── [DAILY REMINDERS]
│   ├── Toggle on/off ──► requestNotificationPermission
│   └── Morning/Evening time adjust (± 30 min steps)
│
├── [ACCESSIBILITY]
│   ├── Reduce Motion toggle
│   └── High Contrast toggle
│
├── [PRO SECTION]
│   └── Streak Freeze (❄️ use freeze) ──► protects yesterday's streak
│
├── [DATA]
│   ├── Export Data ──► Share JSON
│   └── Restore Purchases (RevenueCat)
│
├── [DANGER ZONE]
│   ├── Sign Out ──► Alert confirm
│   └── Delete Account ──► Double-confirm ──► Edge Function: /delete-account
│
└── [Save] ──► upsert to DB ──► navigate back
```

### MonkModeScreen Flow
```
MonkModeScreen  (modal)
│
├── [NO EXCUSES MODE] toggle
│   └── Pro only ──► PaywallModal (monkmode trigger)
│
├── [STRICT GOALS] toggle
│   └── Pro only
│
└── [COMING SOON] features
    ├── Phone Lockdown — Q3 2026
    └── Accountability Partner — Q3 2026
```

---

## Paywall Trigger Map

```
Feature                     Trigger ID      Shown from
─────────────────────────────────────────────────────────
AI message limit (10/day)   messages        CoachScreen
Non-default coach            personality    ProfileScreen, CoachScreen
>2 goals                    goals           GoalsScreen
>3 habits                   habits          ProfileScreen
Weekly AI review            review          ReviewScreen
Monk Mode features          monkmode        MonkModeScreen
```

---

## Edge Function Call Map

```
Screen          User Action                    Edge Function
──────────────────────────────────────────────────────────────────
CoachScreen     Send message                   /chat
CoachScreen     Pep talk                       /pep-talk
CoachScreen     Voice input                    /transcribe
CoachScreen     Update coach memory            /update-coach-memory
CheckInScreen   Submit morning check-in        /morning-brief
CheckInScreen   Submit evening check-in        /evening-feedback
GoalsScreen     Request goal advice            /goal-advice
ReviewScreen    Generate weekly review         /review
ProfileScreen   Delete account                 /delete-account
─ cron ─────────────────────────────────────────────────────────────
System (8am)    Push coach nudge               /send-coach-nudges?type=morning
System (8pm)    Push evening nudge             /send-coach-nudges?type=evening
System (daily)  Goal deadline alerts           /send-goal-alerts
System (Sun)    Weekly review reminder         /send-review-reminder
RevenueCat      Subscription event             /revenuecat-webhook
```

---

## Offline + Sync Flow

```
User taps habit ──► optimistic UI update (instant)
                ──► attempt Supabase write
                    ├── success ──► streak + stats recalculated via RPC
                    └── failure ──► enqueue to AsyncStorage offline queue

App foreground (AppState 'active')
                ──► drainOfflineQueue()
                    └── replay queued habit toggles ──► update streak + stats

Realtime subscription on habit_completions
                ──► update badge count on CheckIn tab
```
