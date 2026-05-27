# Monk.ai Landing Page — Design Spec

## Goal

Validate demand before building the full app. Collect email addresses from target audience (discipline-focused Gen Z, ADHD professionals, entrepreneurs) via a waitlist. Ship fast — no fake social proof, no pricing, no screenshots that don't exist yet.

## Success criteria

- Page live and collecting emails
- At least 1 real email submitted successfully to Supabase
- `/app` route still works (existing app unbroken)

---

## Architecture

### Approach

Add landing page as a new `/` route inside `monk-ai-handoff`. Existing app moves to `/app`. Routing handled by React Router v6 (new dep).

### New files

| File | Purpose |
|---|---|
| `src/pages/LandingPage.tsx` | Full landing page component — all 5 sections |
| `src/lib/supabase.ts` | Supabase client initialised from env vars |
| `.env.example` | Documents required env vars |

### Modified files

| File | Change |
|---|---|
| `src/main.tsx` | Wrap app in `<BrowserRouter>` |
| `src/App.tsx` | Wrap in `<Routes>`: `/` → LandingPage, `/app` → existing logic |
| `package.json` | Add `react-router-dom`, `@supabase/supabase-js` |

### New dependencies

```
npm install react-router-dom @supabase/supabase-js
```

---

## Visual design

**Direction:** Dark & Intense
- Background: `#0a0a0a`
- Accent: `#b8f058` (acid green — matches stoic_mentor personality color)
- Fonts: Syne (display headings) + DM Mono (monospace labels) — already loaded in `index.css`
- No new CSS variables needed — reuse existing design system

---

## Page sections

### 01 — Hero (full viewport, centered)

**Headline:** "Stop organizing. Start becoming."  
**Subline:** "The AI accountability coach that remembers your failures — and won't let you forget them."  
**CTA:** Inline email input + JOIN WAITLIST button  
**Label above headline:** `MONK.AI · WAITLIST OPEN` in acid green, letter-spaced uppercase

Behavior: submit email → insert to Supabase `waitlist` → show success message "You're in. We'll be in touch." Error on duplicate: "Already on the list."

### 02 — Problem

**Header:** "Most apps help you organize. None hold you accountable."  
**3 pain points** (icon + label + one-line description):
1. Inconsistency — "You know what to do. You just don't do it."
2. Emotional dips — "Motivation runs out. Discipline needs to be built."
3. No real stakes — "An app that forgives everything changes nothing."

### 03 — Features

**Header:** "Built different."  
**3 cards:**
1. **Memory** — "Remembers your last failures. References them by name. Makes it real."
2. **Monk Mode** — "Lock in. No distractions. No excuses. 24-hour accountability mode."
3. **Streak system** — "One missed day resets everything. That's the point."

### 04 — Personalities

**Header:** "Pick your coach. They don't let you quit."  
**6 cards** — pulled from `personalities` object in `src/store.ts`:

| ID | Name | Color | One-line vibe |
|---|---|---|---|
| drill_sergeant | Drill Sergeant | #f06060 | "No excuses. No rest. Only results." |
| stoic_mentor | Stoic Mentor | #b8f058 | "What would Marcus Aurelius do?" |
| anime_sensei | Anime Sensei | #7b6af0 | "This is your power-up arc." |
| goggins | Stay Hard | #f5c840 | "Callus your mind. Do the work." |
| ceo_coach | CEO Coach | #40f5c8 | "Your time has ROI. Act like it." |
| calm_therapist | Calm Therapist | #f0a060 | "Compassion without excuses." |

Each card: colored border matching personality color, name, emoji, one-line vibe. Not interactive on landing page — display only.

### 05 — Waitlist CTA (repeat)

**Header:** "Be first."  
**Subline:** "First 500 get 3 months Pro free."  
Repeat email form — same `WaitlistForm` component reused, each instance has independent local state.  
**Footer:** `© 2026 Monk.ai` — no social links, no legal yet.

---

## Supabase schema

Run in Supabase SQL editor before deploying:

```sql
create table waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  created_at timestamptz default now()
);

alter table waitlist enable row level security;

create policy "anon insert"
  on waitlist for insert
  to anon
  with check (true);
```

RLS allows anonymous inserts only. No read policy — emails are not exposed client-side.

## Environment variables

```env
# .env (gitignored)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Existing — unchanged
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Anon key is safe to expose in frontend: insert-only table, RLS enforced, no sensitive data readable.

---

## Out of scope

- Auth
- Pricing page
- Social proof / testimonials (none exist yet)
- App screenshots (not ready)
- Analytics (add after validation)
- Mobile app (separate project in `/mobile`)
