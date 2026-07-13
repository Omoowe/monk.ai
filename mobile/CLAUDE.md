# mobile/ — Expo React Native App

## Stack

- Expo SDK 54, React Native, TypeScript
- Navigation: React Navigation (bottom tabs + native stack)
- Auth + data: Supabase JS SDK
- AI: Supabase Edge Functions (Deno) — never call Anthropic directly
- Payments: RevenueCat (`src/services/purchases.ts`)
- Fonts: `@expo-google-fonts/syne` (display) + `@expo-google-fonts/dm-mono` (mono)

## Commands

```bash
npx expo start              # dev server (scan QR with Expo Go)
npx expo run:ios            # build + launch iOS simulator
npx expo run:android        # build + launch Android emulator
npx tsc --noEmit            # TypeScript check (uses expo/tsconfig.base)
```

## Directory layout

```
src/
├── screens/        ← Full-page screens (one per bottom tab + modals)
├── components/     ← Shared UI: GlobalHeader, Skeleton, PaywallModal, etc.
├── services/
│   ├── ai.ts       ← Calls Edge Functions (chat, pep-talk, review, etc.)
│   ├── context.ts  ← Builds CoachContext from user state
│   ├── purchases.ts← RevenueCat entitlement checks
│   ├── stats.ts    ← Dopamine score + streak calculations
│   ├── offline.ts  ← Offline queue logic
│   └── syncQueue.ts← Sync pending mutations
├── lib/
│   └── supabase.ts ← Supabase client singleton (reads EXPO_PUBLIC_* env vars)
├── context/        ← React context providers (auth, user state)
└── utils/
    └── scale.ts    ← fscale(n) / scale(n) — responsive sizing (BASE_WIDTH=390)
```

## Screens

| Screen | Description |
|--------|-------------|
| `CoachScreen` | AI chat, Monk Mode toggle, voice input |
| `CheckInScreen` | Morning mission + Evening debrief |
| `StatsScreen` | Dopamine score, week chart, leaderboard |
| `GoalsScreen` | Goal cards with AI advice |
| `ProfileScreen` | Coach selector, Monk Mode settings, identity |
| `ReviewScreen` | Weekly AI analysis |
| `SocialScreen` | Leaderboard + social features |
| `MonkModeScreen` | Monk Mode detail |
| `OnboardingScreen` | First-run flow |
| `LoginScreen` | Supabase auth |
| `WelcomeScreen` | Pre-login splash |

## Design system

**Scale helpers** — always use for sizes, not hardcoded px:
```ts
import { fscale, scale } from '../utils/scale';
// fscale(n) — font size  |  scale(n) — layout/spacing
```

**Design tokens**
```ts
bg:     '#0a0a0a'   // root background
bg2:    '#111111'   // card/surface background
bg3:    '#171717'   // nested surface
border: '#1e1e1e'   // dividers / borders
muted:  '#555555'   // secondary text
```

**Coach colors**
```ts
drill_sergeant: '#f06060'
stoic_mentor:   '#b8f058'
anime_sensei:   '#7b6af0'
goggins:        '#f5c840'
ceo_coach:      '#40f5c8'
calm_therapist: '#f0a060'
```

**Typography**
- Headers: `Syne_800ExtraBold`, `letterSpacing: -0.5`
- Labels/mono: `DMMono_400Regular`
- Body: system default

**Anti-patterns**
- No emojis in UI chrome — use View primitives or Phosphor icons
- No hardcoded pixel values — use `fscale()`/`scale()`
- No `react-native-svg` — use View/border tricks for shapes
- No Flexbox percentage math — use fixed scaled values or flex ratios
- `divide-y` pattern for lists: `borderTopWidth: 1, borderTopColor: '#1e1e1e'`

## AI calls

All AI calls go through `src/services/ai.ts` → `supabase.functions.invoke()`.
Never import or call Anthropic SDK in mobile code.

```ts
// Pattern for every AI feature
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { ...payload }
});
```

## Environment variables

```env
EXPO_PUBLIC_SUPABASE_URL=https://...supabase.co    # public by design
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...               # public by design
EXPO_PUBLIC_RC_IOS_KEY=appl_...                    # RevenueCat public key
EXPO_PUBLIC_RC_ANDROID_KEY=goog_...                # RevenueCat public key
```

`ANTHROPIC_API_KEY` must NEVER appear here — it lives in Supabase secrets only.

## Lint / type check

```bash
npx tsc --noEmit            # TypeScript (no build output, expo base config)
```

LSP: use `mcp__ide__getDiagnostics` for open file errors.
Note: `supabase/functions/` Deno errors are expected — Deno types not in this tsconfig.

## Adding a screen

1. Create `src/screens/MyScreen.tsx`
2. Register in bottom tab or stack navigator
3. Use `fscale()`/`scale()` for all sizes
4. No emojis in UI chrome

## Supabase Edge Functions (in `supabase/functions/`)

See `supabase/CLAUDE.md` for Edge Function conventions.
