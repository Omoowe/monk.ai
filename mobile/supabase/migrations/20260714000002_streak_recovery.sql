-- Streak grace-day recovery mechanic
-- If user misses one day, completing ALL habits the next day saves the streak

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS streak_grace_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS streak_before_break   INT     NOT NULL DEFAULT 0;

-- ── Detect grace eligibility ──────────────────────────────────
-- Call after habits load: returns TRUE if yesterday was missed
-- but the day before had completions (one-day gap only).
CREATE OR REPLACE FUNCTION public.check_streak_grace(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_habit_count        INT;
  v_yesterday          TEXT := (CURRENT_DATE - INTERVAL '1 day')::TEXT;
  v_day_before         TEXT := (CURRENT_DATE - INTERVAL '2 days')::TEXT;
  v_done_yesterday     INT;
  v_done_day_before    INT;
  v_current_streak     INT;
BEGIN
  IF auth.uid() != p_user_id THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO v_habit_count
  FROM public.habits WHERE user_id = p_user_id;
  IF v_habit_count = 0 THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO v_done_yesterday
  FROM public.habit_completions hc
  JOIN public.habits h ON h.id = hc.habit_id
  WHERE h.user_id = p_user_id AND hc.date = v_yesterday;

  SELECT COUNT(*) INTO v_done_day_before
  FROM public.habit_completions hc
  JOIN public.habits h ON h.id = hc.habit_id
  WHERE h.user_id = p_user_id AND hc.date = v_day_before;

  SELECT streak INTO v_current_streak
  FROM public.users WHERE id = p_user_id;

  -- One missed day with prior activity: set grace
  IF v_done_yesterday = 0 AND v_done_day_before > 0 THEN
    UPDATE public.users
    SET streak_grace_eligible = TRUE,
        streak_before_break   = GREATEST(v_current_streak, streak_before_break)
    WHERE id = p_user_id AND streak_grace_eligible = FALSE;
    RETURN TRUE;
  END IF;

  RETURN (SELECT streak_grace_eligible FROM public.users WHERE id = p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_streak_grace(UUID) TO authenticated;

-- ── Claim recovery: complete ALL habits today → saves streak ──
-- Backdates yesterday's completions, recalculates stats.
-- Returns TRUE on success.
CREATE OR REPLACE FUNCTION public.claim_streak_recovery(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_habit_count     INT;
  v_today           TEXT := CURRENT_DATE::TEXT;
  v_yesterday       TEXT := (CURRENT_DATE - INTERVAL '1 day')::TEXT;
  v_done_today      INT;
  v_h               RECORD;
BEGIN
  IF auth.uid() != p_user_id THEN RETURN FALSE; END IF;

  IF NOT (SELECT streak_grace_eligible FROM public.users WHERE id = p_user_id) THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_habit_count
  FROM public.habits WHERE user_id = p_user_id;
  IF v_habit_count = 0 THEN RETURN FALSE; END IF;

  -- Must have completed every habit today
  SELECT COUNT(DISTINCT hc.habit_id) INTO v_done_today
  FROM public.habit_completions hc
  JOIN public.habits h ON h.id = hc.habit_id
  WHERE h.user_id = p_user_id AND hc.date = v_today;

  IF v_done_today < v_habit_count THEN RETURN FALSE; END IF;

  -- Backdate yesterday
  FOR v_h IN SELECT id FROM public.habits WHERE user_id = p_user_id LOOP
    INSERT INTO public.habit_completions (habit_id, user_id, date)
    VALUES (v_h.id, p_user_id, v_yesterday)
    ON CONFLICT (habit_id, date) DO NOTHING;
  END LOOP;

  UPDATE public.users
  SET streak_grace_eligible = FALSE,
      streak_before_break   = 0
  WHERE id = p_user_id;

  PERFORM public.recalculate_user_stats(p_user_id);

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_streak_recovery(UUID) TO authenticated;
