-- Public profiles view for friend search (same pattern as leaderboard)
CREATE OR REPLACE VIEW public.user_public_profiles AS
SELECT id, name, username, streak, dopamine_score
FROM public.users
WHERE username IS NOT NULL;

GRANT SELECT ON public.user_public_profiles TO authenticated;

-- ── Friendships ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select" ON public.friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id AND requester_id <> addressee_id);
CREATE POLICY "friendships_update" ON public.friendships
  FOR UPDATE USING (auth.uid() = addressee_id);
CREATE POLICY "friendships_delete" ON public.friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ── Challenges ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenges (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  challenged_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL DEFAULT 'streak',
  duration_days INT         NOT NULL DEFAULT 7,
  start_date    DATE        NOT NULL,
  end_date      DATE        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending', -- pending | active | completed | declined
  winner_id     UUID        REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenges_select" ON public.challenges
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);
CREATE POLICY "challenges_insert" ON public.challenges
  FOR INSERT WITH CHECK (auth.uid() = challenger_id AND challenger_id <> challenged_id);
CREATE POLICY "challenges_update" ON public.challenges
  FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);
