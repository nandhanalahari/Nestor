-- Migration: user XP totals, weekly XP, level from breakpoints, weekly cron reset

CREATE TABLE IF NOT EXISTS user_xp (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp_this_week INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.award_xp(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  breakpoints CONSTANT integer[] := ARRAY[0, 100, 300, 600, 1000, 1500, 2100];
  new_total integer;
  new_level integer := 1;
  i integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.user_xp AS ux (user_id, total_xp, xp_this_week, level, last_updated_at)
  VALUES (p_user_id, p_amount, p_amount, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = ux.total_xp + p_amount,
    xp_this_week = ux.xp_this_week + p_amount,
    last_updated_at = now();

  SELECT ux.total_xp INTO STRICT new_total
  FROM public.user_xp ux
  WHERE ux.user_id = p_user_id;

  FOR i IN REVERSE 7..1 LOOP
    IF new_total >= breakpoints[i] THEN
      new_level := i;
      EXIT;
    END IF;
  END LOOP;

  UPDATE public.user_xp
  SET level = new_level
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, integer) TO service_role;

-- Weekly reset: Monday 00:00 UTC (pg_cron dow 1 = Monday)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset_user_xp_weekly') THEN
    PERFORM cron.unschedule('reset_user_xp_weekly');
  END IF;
END;
$cron$;

SELECT cron.schedule(
  'reset_user_xp_weekly',
  '0 0 * * 1',
  $$UPDATE public.user_xp SET xp_this_week = 0$$
);
