# App Store Submission Guide — Monk.ai

## Step 1: Prerequisites (one-time setup)

### Apple Developer Account
1. Enroll at developer.apple.com ($99/yr)
2. Get your **Apple Team ID** from Membership tab — looks like `ABC123XYZ`
3. Add to `eas.json` → `submit.production.ios.appleTeamId`

### App Store Connect
1. Go to appstoreconnect.apple.com → My Apps → New App
2. Platform: iOS, Name: **Monk.ai**, Bundle ID: `com.monk.ai`
3. Get **App ID (ascAppId)** from the URL: `appstoreconnect.apple.com/apps/XXXXXXXXX/...`
4. Add to `eas.json` → `submit.production.ios.ascAppId`

### RevenueCat (required for in-app purchases)
- Create account at app.revenuecat.com
- Add iOS app → API key starts with `appl_`
- Set `EXPO_PUBLIC_RC_IOS_KEY=appl_...` in `.env`
- Create entitlement: `pro`
- Create monthly product: `com.monk.ai.pro.monthly` ($9.99/mo)
- Create annual product: `com.monk.ai.pro.annual` ($59.99/yr)
- Set both in default offering
- Add webhook: `https://ecknypzdpovzzmvedsuw.supabase.co/functions/v1/revenuecat-webhook`
- Webhook Authorization: `44cde6868a4b162a8345406d13770cf128ec76856492e3279016b6f6d15c8d25`

---

## Step 2: Build for TestFlight

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to your Expo account
eas login

# First time: configure project
eas build:configure

# Build production iOS (uploads to TestFlight automatically)
eas build --platform ios --profile production

# Or build + submit in one command:
eas build --platform ios --profile production --auto-submit
```

EAS will:
- Request/create certificates automatically (say Yes)
- Upload `.ipa` to App Store Connect
- Appear in TestFlight within ~5 minutes

---

## Step 3: TestFlight

1. App Store Connect → TestFlight tab
2. Add your devices (External Testing → Add Tester)
3. Test on device: install TestFlight app → accept invite → install Monk.ai

### What to test on device
- [ ] Login / signup flow
- [ ] Onboarding (5 steps) → coach selection, username
- [ ] Check-in (morning + evening) — ensure AI responses work
- [ ] Habit add/toggle
- [ ] Goals: add goal, progress update, milestone fires AI commentary
- [ ] Coach chat
- [ ] Push notifications arrive (have someone trigger a nudge)
- [ ] Deep links (`monkai://checkin`, `monkai://coach`)
- [ ] Paywall → purchase flow (use sandbox test account)
- [ ] Social: search, add friend, create challenge

---

## Step 4: App Store Connect Metadata

### Required fields

**App Name:** Monk.ai  
**Subtitle:** AI Accountability Coach  
**Category:** Health & Fitness (primary), Productivity (secondary)

**Description (4000 chars max):**
```
Monk.ai is not another habit tracker. It's an AI accountability coach that remembers your patterns, calls you out when you slip, and stays on you until you actually change.

Choose your coach personality:
• Drill Sergeant — no excuses, military discipline
• Stoic Mentor — Marcus Aurelius energy, long-game thinking
• Anime Sensei — dramatic power-up speeches, high energy
• Stay Hard — raw Goggins-style accountability
• CEO Coach — ROI-focused, strategic execution
• Calm Therapist — compassionate but firm

WHAT YOU GET:
✓ AI that remembers your failures and patterns across sessions
✓ Daily Morning Mission + Evening Debrief with real AI feedback
✓ Habit tracking with streak protection and freezes
✓ Goal tracking with AI milestone commentary
✓ Challenge friends to streak battles
✓ Weekly AI performance reviews with stats
✓ Push notifications in your coach's voice

FOR PEOPLE WHO:
• Have started and quit 10 times before
• Need accountability that actually bites back
• Want results, not vibes

No fluff. No hand-holding. Just results.
```

**Keywords (100 chars max):**  
`accountability,coach,habits,productivity,discipline,goals,AI,streak,self-improvement,focus`

**What's New (version 1.0):**  
`Initial release.`

**Support URL:** https://monkai.app/support  
**Marketing URL:** https://monkai.app  
**Privacy Policy URL:** https://monkai.app/privacy

### Screenshots needed
- iPhone 6.9" (1320×2868): 3–10 screenshots
- iPhone 6.5" (1242×2688): 3–10 screenshots

**Screenshot ideas:**
1. CoachScreen — active chat with coach
2. CheckInScreen — morning mission form
3. GoalsScreen — goals with progress bars
4. WelcomeScreen — headline animation
5. StatsScreen — dopamine score + leaderboard

Use iPhone 16 Pro Max simulator, screenshot tool: `⌘S` in Xcode Simulator

### App Rating (Privacy)
- Data Not Collected (no tracking)
- No advertising identifier

### Age Rating
- 4+ (no mature content)

---

## Step 5: Submit for Review

1. App Store Connect → App → Pricing and Availability → Free
2. In-App Purchases section → add `com.monk.ai.pro.monthly` and `com.monk.ai.pro.annual`
3. Review information → Add review notes: "Use test credentials: test@test.com / TestPass123"
4. Submit for Review

**Typical review time:** 24–48 hours

---

## Build Commands Reference

```bash
# Development build (for Expo Go alternative)
eas build --platform ios --profile development

# Preview build (ad-hoc distribution, no TestFlight)
eas build --platform ios --profile preview

# Production build
eas build --platform ios --profile production

# Check build status
eas build:list

# Submit existing build to App Store
eas submit --platform ios --latest
```

---

## Known Issues / Edge Cases

- RevenueCat purchases require real device (not simulator)
- Push notifications require real device
- Voice input (expo-av) requires microphone permission — prompt appears on first use
- Offline habit toggles sync on foreground — test by toggling while in airplane mode, then reconnecting
