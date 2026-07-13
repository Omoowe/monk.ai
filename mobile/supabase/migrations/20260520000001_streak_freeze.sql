-- Add streak freeze columns to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS streak_freezes      INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS freeze_used_on      DATE,
  ADD COLUMN IF NOT EXISTS last_freeze_awarded DATE NOT NULL DEFAULT CURRENT_DATE;

-- ============================================================
-- Updated recalculate_user_stats: adds freeze + weekly award
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_habits    INT;
  v_week_completed  INT;
  v_week_possible   INT;
  v_new_score       INT;
  v_raw_streak      INT;
  v_cur_streak      INT;
  v_freezes         INT;
  v_freeze_used_on  DATE;
  v_last_awarded    DATE;
  v_week_start      TEXT;
BEGIN
  v_week_start := (CURRENT_DATE - INTERVAL '6 days')::TEXT;

  -- Dopamine score
  SELECT COUNT(*) INTO v_total_habits
  FROM public.habits WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_week_completed
  FROM public.habit_completions hc
  JOIN public.habits h ON h.id = hc.habit_id
  WHERE h.user_id = p_user_id AND hc.date >= v_week_start;

  v_week_possible := v_total_habits * 7;
  IF v_week_possible > 0 THEN
    v_new_score := LEAST(100, ROUND((v_week_completed::NUMERIC / v_week_possible) * 100));
  ELSE
    v_new_score := 50;
  END IF;

  -- Raw streak from habits
  SELECT COALESCE(MAX(streak_days), 0) INTO v_raw_streak
  FROM public.habits WHERE user_id = p_user_id;

  -- Fetch user state
  SELECT streak, streak_freezes, freeze_used_on, last_freeze_awarded
  INTO v_cur_streak, v_freezes, v_freeze_used_on, v_last_awarded
  FROM public.users WHERE id = p_user_id;

  -- Award 1 freeze per week (if 7+ days since last award)
  IF v_last_awarded IS NULL OR CURRENT_DATE - v_last_awarded >= 7 THEN
    v_freezes         := LEAST(3, v_freezes + 1); -- cap at 3
    v_last_awarded    := CURRENT_DATE;
  END IF;

  -- Streak freeze: if streak dropped by exactly 1 day (yesterday missed),
  -- and we haven't already used a freeze for yesterday, consume one freeze.
  IF v_raw_streak = v_cur_streak - 1
    AND v_freezes > 0
    AND (v_freeze_used_on IS NULL OR v_freeze_used_on != CURRENT_DATE - 1)
  THEN
    -- Protect the streak
    v_raw_streak     := v_cur_streak;
    v_freezes        := v_freezes - 1;
    v_freeze_used_on := CURRENT_DATE - 1;
  END IF;

  UPDATE public.users
  SET dopamine_score      = v_new_score,
      streak              = v_raw_streak,
      streak_freezes      = v_freezes,
      freeze_used_on      = v_freeze_used_on,
      last_freeze_awarded = v_last_awarded
  WHERE id = p_user_id;
END;
$$;
