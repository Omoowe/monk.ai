-- ============================================================
-- Streak Battle scoring: proper habit-completion-based scores
-- Adds score columns + two RPC functions:
--   get_battle_scores(UUID) → live scores during active battle
--   settle_battle(UUID)     → finalize ended battle, set winner
-- Both use SECURITY DEFINER to read opponent's habit_completions
-- across the RLS boundary; auth check is enforced inside.
-- ============================================================

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS challenger_habits_done INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS challenged_habits_done INT NOT NULL DEFAULT 0;

-- ── Live scores for an active battle ─────────────────────────
-- Returns (challenger_done, challenged_done) counts.
-- Only callable by a battle participant.
CREATE OR REPLACE FUNCTION public.get_battle_scores(p_battle_id UUID)
RETURNS TABLE(challenger_done INT, challenged_done INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_challenger_id UUID;
  v_challenged_id UUID;
  v_start         TEXT;
  v_end           TEXT;
  v_c_done        INT;
  v_o_done        INT;
BEGIN
  SELECT challenger_id, challenged_id, start_date::TEXT,
         LEAST(end_date, CURRENT_DATE)::TEXT
  INTO   v_challenger_id, v_challenged_id, v_start, v_end
  FROM   public.challenges
  WHERE  id = p_battle_id
    AND  status = 'active'
    AND  (challenger_id = auth.uid() OR challenged_id = auth.uid());

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(*)::INT INTO v_c_done
  FROM   public.habit_completions hc
  JOIN   public.habits h ON h.id = hc.habit_id
  WHERE  h.user_id = v_challenger_id
    AND  hc.date >= v_start AND hc.date <= v_end;

  SELECT COUNT(*)::INT INTO v_o_done
  FROM   public.habit_completions hc
  JOIN   public.habits h ON h.id = hc.habit_id
  WHERE  h.user_id = v_challenged_id
    AND  hc.date >= v_start AND hc.date <= v_end;

  challenger_done := v_c_done;
  challenged_done := v_o_done;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_battle_scores(UUID) TO authenticated;

-- ── Settle a finished battle ──────────────────────────────────
-- Calculates final scores, sets winner_id, status → completed.
-- Only works when end_date < today and status = active.
CREATE OR REPLACE FUNCTION public.settle_battle(p_battle_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_challenger_id UUID;
  v_challenged_id UUID;
  v_start         TEXT;
  v_end           TEXT;
  v_c_done        INT;
  v_o_done        INT;
  v_winner        UUID;
BEGIN
  SELECT challenger_id, challenged_id, start_date::TEXT, end_date::TEXT
  INTO   v_challenger_id, v_challenged_id, v_start, v_end
  FROM   public.challenges
  WHERE  id = p_battle_id
    AND  status = 'active'
    AND  end_date < CURRENT_DATE
    AND  (challenger_id = auth.uid() OR challenged_id = auth.uid());

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(*)::INT INTO v_c_done
  FROM   public.habit_completions hc
  JOIN   public.habits h ON h.id = hc.habit_id
  WHERE  h.user_id = v_challenger_id
    AND  hc.date >= v_start AND hc.date <= v_end;

  SELECT COUNT(*)::INT INTO v_o_done
  FROM   public.habit_completions hc
  JOIN   public.habits h ON h.id = hc.habit_id
  WHERE  h.user_id = v_challenged_id
    AND  hc.date >= v_start AND hc.date <= v_end;

  v_winner := CASE WHEN v_c_done >= v_o_done THEN v_challenger_id ELSE v_challenged_id END;

  UPDATE public.challenges
  SET    status                 = 'completed',
         winner_id              = v_winner,
         challenger_habits_done = v_c_done,
         challenged_habits_done = v_o_done
  WHERE  id = p_battle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_battle(UUID) TO authenticated;
