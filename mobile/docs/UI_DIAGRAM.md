# Monk.ai — UI Screen Diagrams

> All screens: dark bg `#0a0a0a`, primary accent `#b8f058` (lime green), mono font `DMMono`, display font `Syne 800`

---

## Global Header (persistent above all tabs)

```
┌────────────────────────────────────────────────────┐
│  Monk.ai          ● 🔥 14   [72]                   │
│  (wordmark)      Monk🟢 streak score               │
│                  mode  (color=personality)         │
└──────────────────────────────────────────────────►─┘
                                         taps → ProfileScreen
```

---

## Tab Bar (persistent bottom navigation)

```
┌──────┬──────────┬──────┬──────┬──────┐
│  🤖  │   📋     │  🎯  │  📊  │  ⚔️  │
│COACH │ CHECK-IN │GOALS │STATS │SOCIAL│
│      │  [badge] │      │      │      │
└──────┴──────────┴──────┴──────┴──────┘
  active tab: lime pill background behind emoji
  badge: lime circle with pending habit count
```

---

## CoachScreen

```
┌────────────────────────────────────────┐
│  [Global Header]                       │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ [Coach picker row]               │  │
│  │  ● Stoic Mentor ▼    [🧘 Monk]  │  │
│  │  (tap to open personality sheet) │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ─ ─ ─ chat messages ─ ─ ─           │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ USER: I skipped the gym again    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 🤖 COACH: That's the third time  │  │
│  │ this week. What's the actual     │  │
│  │ reason? Not the excuse.          │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ [input]         [🎙] [💪] [↑]   │  │
│  │ Type a message...  voice  pep   send│
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘

PERSONALITY PICKER (bottom sheet, modal-style):
┌────────────────────────────────────────┐
│  ━━━━━━  (pill handle)                │
│                                        │
│  ┌──────────┐  ┌──────────┐           │
│  │ Stoic    │  │ Drill    │           │
│  │ Mentor   │  │ Sergeant │ 🔒        │
│  │ #b8f058  │  │ #f06060  │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │ Anime    │  │ Stay     │           │
│  │ Sensei   │  │ Hard     │ 🔒        │
│  │ #7b6af0  │  │ #f5c840  │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │ CEO      │  │ Calm     │           │
│  │ Coach    │  │ Therapist│ 🔒        │
│  │ #40f5c8  │  │ #f0a060  │           │
│  └──────────┘  └──────────┘           │
└────────────────────────────────────────┘
```

---

## CheckInScreen

```
┌────────────────────────────────────────┐
│  [Global Header]                       │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────┐  ┌──────────┐           │
│  │ ☀️ MORNING│  │ 🌙 EVENING│          │
│  │ ● Done   │  │ ○ Pending│           │
│  └──────────┘  └──────────┘           │
│                                        │
│  ──── MORNING CHECK-IN ────           │
│  ┌──────────────────────────────────┐  │
│  │ Your one mission today:          │  │
│  │ [____________________________]   │  │
│  │                                  │  │
│  │ Energy level:                    │  │
│  │ Low [1][2][3][4][5] High         │  │
│  │     ●  ○  ○  ○  ○               │  │
│  │                                  │  │
│  │ Biggest distraction risk:        │  │
│  │ [____________________________]   │  │
│  │                                  │  │
│  │ [  Activate my day  ──────────►] │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ── AI RESPONSE (after submit) ──     │
│  ┌──────────────────────────────────┐  │
│  │ "Marcus. 'Write 2000 words' —    │  │
│  │  not a wish. A debt you owe..."  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ──── TODAY'S HABITS ────            │
│  ┌──────────────────────────────────┐  │
│  │ ● 🏃 Morning Run        7🔥  [✓] │  │
│  │   fitness                         │  │
│  ├──────────────────────────────────┤  │
│  │ ○ 📚 Read 30 mins       3🔥  [ ] │  │
│  │   learning                        │  │
│  ├──────────────────────────────────┤  │
│  │ ● 💧 Drink 2L water     12🔥 [✓] │  │
│  │   health                          │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ──── EVENING CHECK-IN ────          │
│  ┌──────────────────────────────────┐  │
│  │ Did you complete: "Write 2000    │  │
│  │ words"?                          │  │
│  │  [✓ Yes, I did it]  [✗ No]      │  │
│  │                                  │  │
│  │ Habits: 2/3 done today           │  │
│  │                                  │  │
│  │ [  Submit evening debrief  ────►]│  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

## GoalsScreen

```
┌────────────────────────────────────────┐
│  [Global Header]                       │
├────────────────────────────────────────┤
│                                        │
│  GOALS  (2 active)         [+ Add]    │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ HEALTH              ◉ 73%        │  │
│  │ ✏ Lose 10kg                      │  │
│  │ Target: 75kg  ·  12 days left    │  │
│  │ ████████████████░░░░░░  73%      │  │
│  │                                  │  │
│  │ [−10] [−1]  73  [+1] [+10]      │  │
│  │                                  │  │
│  │ [🤖 Get coach advice]            │  │
│  │                              [✕] │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ LEARNING           ◉ 40%  OVERDUE│  │
│  │ ✏ Finish TypeScript course       │  │
│  │ Target: Cert  ·  3 days overdue  │  │
│  │ ████████░░░░░░░░░░░░░░░  40%     │  │
│  │                                  │  │
│  │ [−10] [−1]  40  [+1] [+10]      │  │
│  │                                  │  │
│  │ [🤖 Get coach advice]            │  │
│  │                              [✕] │  │
│  └──────────────────────────────────┘  │
│                                        │
│  FREE: 2 of 2 goals used              │
│  [🔒 Add more goals — Go Pro]         │
│                                        │
└────────────────────────────────────────┘

ADD GOAL FORM (inline, expands at top):
┌────────────────────────────────────────┐
│  Goal name: [______________________]  │
│  Category:  [Health ▼]               │
│  Target:    [______________________]  │
│  Deadline:  [← 30 days →]            │
│             [Cancel]  [Add Goal ──►]  │
└────────────────────────────────────────┘
```

---

## StatsScreen

```
┌────────────────────────────────────────┐
│  [Global Header]                       │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │         DOPAMINE SCORE           │  │
│  │              72                  │  │
│  │          ON A ROLL               │  │
│  └──────────────────────────────────┘  │
│                                        │
│  THIS WEEK                            │
│  ┌──────────────────────────────────┐  │
│  │       ██                         │  │
│  │    ██ ██    ██                   │  │
│  │ ██ ██ ██ ██ ██ ██               │  │
│  │ M  T  W  T  F  S  S             │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────┐ ┌──────────┐           │
│  │ 🔥 14    │ │ ⚡ 72     │           │
│  │ DAY STK  │ │ DOPAMINE  │           │
│  └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐           │
│  │ ✅ 2/3   │ │ ❤️ 85    │           │
│  │ TODAY    │ │ HEALTH   │           │
│  └──────────┘ └──────────┘           │
│                                        │
│  LEADERBOARD                          │
│  ┌──────────────────────────────────┐  │
│  │  #   USER          STK   SCORE   │  │
│  │  1   🧘 monk_k     42    94      │  │
│  │  2   ⚡ you        14    72  ◄── │  │
│  │  3   🔥 hafee99    11    68      │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

## ReviewScreen (modal)

```
┌────────────────────────────────────────┐
│  [← Close]      WEEKLY REVIEW         │
├────────────────────────────────────────┤
│                                        │
│  [FREE USER]                           │
│  ┌──────────────────────────────────┐  │
│  │ ✓ Your top and worst habits      │  │
│  │ ✓ Honest analysis of consistency │  │
│  │ ✓ Specific actions for next week │  │
│  └──────────────────────────────────┘  │
│  [🔒 Unlock weekly review — Go Pro]   │
│                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                        │
│  [PRO USER — after generation]         │
│  ┌──────────┐ ┌──────────┐           │
│  │ DONE     │ │ MISSIONS │           │
│  │  14/21   │ │  4/7     │           │
│  └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐           │
│  │ STK BEST │ │ SCORE    │           │
│  │   14     │ │   72     │           │
│  └──────────┘ └──────────┘           │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ▌                                │  │
│  │  You showed up 67% this week.    │  │
│  │  The gym streak is real. The     │  │
│  │  reading habit is lying to you.  │  │
│  │  3 days skipped, always evening. │  │
│  │  Pattern: you're tired, you quit │  │
│  │  ...                             │  │
│  └──────────────────────────────────┘  │
│                                        │
│  [Generate my review]  (or Regenerate) │
└────────────────────────────────────────┘
```

---

## SocialScreen

```
┌────────────────────────────────────────┐
│  [Global Header]                       │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────┐  ┌──────────┐           │
│  │ FRIENDS  │  │ BATTLES  │           │
│  │ (active) │  │          │           │
│  └──────────┘  └──────────┘           │
│                                        │
│  [FRIENDS TAB]                         │
│  ┌──────────────────────────────────┐  │
│  │ 🔍 Search by username...  [Go]   │  │
│  └──────────────────────────────────┘  │
│                                        │
│  PENDING (1)                          │
│  ┌──────────────────────────────────┐  │
│  │ 🔥 goggins_fan  wants to connect  │  │
│  │                  [✓ Accept] [✗]  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  FRIENDS (3)                          │
│  ┌──────────────────────────────────┐  │
│  │ 🧘 monk_k        🔥42   ⚡94     │  │
│  │                    [⚔ Challenge] │  │
│  ├──────────────────────────────────┤  │
│  │ 🦁 alex_builds   🔥 7   ⚡68     │  │
│  │                    [⚔ Challenge] │  │
│  └──────────────────────────────────┘  │
│                                        │
│  [BATTLES TAB]                         │
│  ┌──────────────────────────────────┐  │
│  │ ⚔ vs monk_k  — 14-day battle     │  │
│  │   Day 6 of 14  ·  you 🔥14 vs 🔥42│  │
│  │   Status: ACTIVE                 │  │
│  └──────────────────────────────────┘  │
│                                        │
│  CHALLENGE PICKER (when tapped):      │
│  ┌──────────────────────────────────┐  │
│  │  Duration:  [7d]  [14d]  [30d]   │  │
│  │             [Cancel] [Challenge] │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

## ProfileScreen (modal)

```
┌────────────────────────────────────────┐
│ ← Back     Profile           [Save]   │
├────────────────────────────────────────┤
│                                        │
│              🧘                        │
│         Tap to change avatar           │
│                                        │
│  ACCOUNT                              │
│  hafeezalliowe@gmail.com               │
│                                        │
│  YOUR NAME                            │
│  [Marcus                           ]  │
│                                        │
│  USERNAME                             │
│  [monk_warrior                     ]  │
│                                        │
│  COACH PERSONALITY                    │
│  ┌──────┐ ┌──────┐ ┌──────┐          │
│  │Stoic │ │Drill │ │Anime │          │
│  │ ✓    │ │ 🔒   │ │ 🔒   │          │
│  └──────┘ └──────┘ └──────┘          │
│                                        │
│  HABITS                               │
│  ┌──────────────────────────────────┐  │
│  │ ✅ Morning Run        7🔥   [✕]  │  │
│  │ 📚 Read 30 mins       3🔥   [✕]  │  │
│  │ 💧 Drink 2L water    12🔥   [✕]  │  │
│  │ [+ Add habit]                    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  MONK MODE       [Toggle ──────── ●] │
│  STRICT GOALS    [Toggle ──── ●    ] │
│                                        │
│  DAILY REMINDERS [Toggle ──────── ●] │
│  ☀️ Morning:  8:00 AM  [◄] [►]       │
│  🌙 Evening: 8:30 PM  [◄] [►]       │
│                                        │
│  ACCESSIBILITY                        │
│  Reduce Motion   [Toggle ──── ●    ] │
│  High Contrast   [Toggle ──── ●    ] │
│                                        │
│  PRO FEATURES                         │
│  ❄️ Streak Freeze  (1 remaining)     │
│  [Use Freeze]                         │
│                                        │
│  DATA                                 │
│  [Export My Data]                     │
│  [Restore Purchases]                  │
│                                        │
│  [Sign Out]                           │
│  [Delete Account]                     │
└────────────────────────────────────────┘
```

---

## MonkModeScreen (modal)

```
┌────────────────────────────────────────┐
│  [← Close]      MONK MODE             │
├────────────────────────────────────────┤
│                                        │
│  🧘                                    │
│  MONK MODE                            │
│  Total discipline. No compromises.    │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ⚡ NO EXCUSES MODE               │  │
│  │ Coach stays brutal. No softening.│  │
│  │                    [● enabled]   │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 🎯 STRICT GOALS                  │  │
│  │ Missed = failure. No partial win.│  │
│  │                    [○ disabled]  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  COMING SOON                          │
│  ┌──────────────────────────────────┐  │
│  │ 📵 PHONE LOCKDOWN  [SOON Q3 2026]│  │
│  │ Block apps when habits undone.   │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 👥 PARTNER  [SOON Q3 2026]       │  │
│  │ Accountability partner notified. │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

## Paywall Modal (bottom sheet overlay)

```
┌────────────────────────────────────────┐
│  ━━━━━━  (drag handle)                │
│                                        │
│              🔒                        │
│        Coach locked.                   │
│   Free users get Stoic Mentor.        │
│   Pro unlocks all 6.                  │
│                                        │
│  ──────────────────────────────────── │
│                                        │
│  ┌────────────────┐ ┌────────────────┐ │
│  │   MONTHLY      │ │    ANNUAL ✓    │ │
│  │   $9.00/mo     │ │ SAVE 26%       │ │
│  │                │ │ $6.58/mo       │ │
│  │                │ │ $79.00/yr      │ │
│  └────────────────┘ └────────────────┘ │
│                                        │
│  MONK PRO                             │
│  ● All 6 coach personalities          │
│  ● Unlimited AI messages              │
│  ● Unlimited habits + goals           │
│  ● Weekly AI review                   │
│  ● Full Monk Mode access              │
│                                        │
│  [   Get Pro — $79.00/yr  ─────────►] │
│  $6.58/month · billed as $79.00/year  │
│                                        │
│  [Restore Purchases]                   │
│  [Maybe later]                         │
│                                        │
│  Auto-renews annually. Cancel anytime │
│  Privacy · Terms                      │
└────────────────────────────────────────┘
```

---

## Onboarding Flow (new user, 5 steps)

```
STEP 1                  STEP 2                  STEP 3
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│                  │    │                  │    │                  │
│       🧑         │    │       ✍️          │    │       ⚔️         │
│                  │    │                  │    │                  │
│  What's your     │    │  Your identity   │    │  Choose your     │
│  name?           │    │  statement.      │    │  coach.          │
│                  │    │                  │    │                  │
│  [__________]    │    │ "I am someone    │    │  ┌────────────┐  │
│                  │    │  who..."         │    │  │Stoic Mentor│  │
│  Pick an avatar: │    │  [text area]     │    │  │ (selected) │  │
│  🧘🐉🦁🔥⚡🎯    │    │                  │    │  └────────────┘  │
│  🌙🏋️🧠🥷🦅🌊   │    │  [Skip for now]  │    │  ┌────────────┐  │
│                  │    │                  │    │  │Drill Sgt🔒 │  │
│  [Next ──────►]  │    │  [Next ──────►]  │    │  └────────────┘  │
└──────────────────┘    └──────────────────┘    │                  │
                                                 │  [Next ──────►]  │
                                                 └──────────────────┘

STEP 4                  STEP 5
┌──────────────────┐    ┌──────────────────┐
│                  │    │                  │
│       ✅         │    │       🔥         │
│                  │    │                  │
│  Your first      │    │  You're set.     │
│  habit.          │    │                  │
│                  │    │  Coach: Stoic    │
│  Name: [______]  │    │  Habit: Run 🏃   │
│  Emoji: [✅ ▼]   │    │  Identity set    │
│  Category:[▼]    │    │                  │
│                  │    │  [Enter the      │
│  [Next ──────►]  │    │   arena ──────►] │
└──────────────────┘    └──────────────────┘
```

---

## Milestone Modal (overlay on habit completion)

```
┌──────────────────────────────────┐
│                                  │
│            🔥                    │
│                                  │
│       MILESTONE UNLOCKED         │
│                                  │
│      On Fire                     │
│  7-day streak achieved.          │
│  The discipline is becoming      │
│  identity.                       │
│                                  │
│       [Let's go]                 │
│                                  │
└──────────────────────────────────┘
  (spring animation scale-in, dark overlay)
```

---

## HabitHistoryModal (slide-up sheet)

```
┌────────────────────────────────────────┐
│  ━━━━━━  (drag handle)                │
│  🏃  Morning Run                   ✕  │
├────────────────────────────────────────┤
│                                        │
│  ┌────────────┬────────────┬─────────┐ │
│  │  LONGEST   │    THIS    │ MONTHLY │ │
│  │  STREAK    │   MONTH    │  RATE   │ │
│  │    14      │   18/23    │  78%    │ │
│  └────────────┴────────────┴─────────┘ │
│                                        │
│  M   T   W   T   F   S   S            │
│  ■   ■   ■   ■   ■   ■   □  (week 1) │
│  ■   □   ■   ■   ■   ■   ■  (week 2) │
│  ■   ■   ■   ■   □   ■   ■  (week 3) │
│  ■   ■   ■   ■   ■   ●   □  (week 4) │
│  □   □   ■   ...              (week 5) │
│                                        │
│  ■ = done   □ = missed   ● = today    │
└────────────────────────────────────────┘
```

---

## Confetti Overlay (success animation)

```
  *   *    *        *      *
     *        ✦         *
  *       *      *    *
      *      *        ✦
  (28 coloured particles fall: #b8f058 #f5c840 #7b6af0 #f06060 #40f5c8)
  (useNativeDriver spring + fade over 1.2–2s)
  (pointerEvents="none" — renders above everything, non-blocking)
```
