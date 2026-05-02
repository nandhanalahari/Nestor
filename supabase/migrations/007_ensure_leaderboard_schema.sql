-- Idempotent: full leaderboard stack + views (safe if prior migrations were skipped)
-- Fixes: "Could not find the table 'public.leaderboard_view' in the schema cache"

-- ─── user_xp (XP + levels) ───
CREATE TABLE IF NOT EXISTS public.user_xp (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp_this_week INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_xp
  ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own xp" ON public.user_xp;
CREATE POLICY "Users read own xp"
  ON public.user_xp FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users upsert own xp" ON public.user_xp;
CREATE POLICY "Users upsert own xp"
  ON public.user_xp FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own xp" ON public.user_xp;
CREATE POLICY "Users update own xp"
  ON public.user_xp FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

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

-- ─── public.profiles (display names for leaderboard; separate from user_profiles quiz) ───
-- CREATE IF NOT EXISTS alone leaves legacy tables missing avatar_url / email_local / updated_at.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email_local TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS email_local TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.profiles p
SET
  email_local = COALESCE(NULLIF(trim(p.email_local), ''), split_part(u.email, '@', 1)),
  updated_at = COALESCE(p.updated_at, now())
FROM auth.users u
WHERE u.id = p.id
  AND (p.email_local IS NULL OR trim(p.email_local) = '');

CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles (updated_at DESC);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are readable for leaderboard" ON public.profiles;
CREATE POLICY "Profiles are readable for leaderboard"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users upsert own profile" ON public.profiles;
CREATE POLICY "Users upsert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS user_badges_user_idx ON public.user_badges (user_id);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badges readable for leaderboard" ON public.user_badges;
CREATE POLICY "Badges readable for leaderboard"
  ON public.user_badges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users insert own badges" ON public.user_badges;
CREATE POLICY "Users insert own badges"
  ON public.user_badges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email_local, updated_at)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), '')
    ),
    NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), ''),
    split_part(NEW.email, '@', 1),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email_local = COALESCE(EXCLUDED.email_local, profiles.email_local),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_sync_profile ON auth.users;
CREATE TRIGGER on_auth_user_sync_profile
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_from_auth();

INSERT INTO public.profiles (id, display_name, avatar_url, email_local, updated_at)
SELECT
  u.id,
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'display_name'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'name'), '')
  ),
  NULLIF(trim(u.raw_user_meta_data->>'avatar_url'), ''),
  split_part(u.email, '@', 1),
  now()
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
  avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
  email_local = COALESCE(EXCLUDED.email_local, profiles.email_local),
  updated_at = now();

CREATE OR REPLACE FUNCTION public.format_leaderboard_display_name(
  p_full text,
  p_email_local text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
  parts text[];
  n int;
BEGIN
  t := trim(COALESCE(p_full, ''));
  IF length(t) = 0 THEN
    RETURN COALESCE(NULLIF(trim(COALESCE(p_email_local, '')), ''), 'Investor');
  END IF;
  parts := regexp_split_to_array(t, '\s+');
  n := array_length(parts, 1);
  IF n IS NULL OR n < 1 THEN
    RETURN COALESCE(NULLIF(trim(COALESCE(p_email_local, '')), ''), 'Investor');
  END IF;
  IF n = 1 THEN
    RETURN parts[1];
  END IF;
  RETURN parts[1] || ' ' || left(parts[n], 1) || '.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.format_leaderboard_display_name(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_leaderboard_display_name(text, text) TO anon;

-- ─── Snapshots table (for rank_yesterday) ───
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank > 0),
  total_xp INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  PRIMARY KEY (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS leaderboard_snapshots_date_idx
  ON public.leaderboard_snapshots (snapshot_date DESC);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leaderboard_snapshots_select_authenticated" ON public.leaderboard_snapshots;
CREATE POLICY "leaderboard_snapshots_select_authenticated"
  ON public.leaderboard_snapshots FOR SELECT TO authenticated USING (true);

-- ─── Views ───
DROP VIEW IF EXISTS public.leaderboard_weekly_view;
DROP VIEW IF EXISTS public.leaderboard_view;

CREATE VIEW public.leaderboard_view AS
SELECT
  ROW_NUMBER() OVER (
    ORDER BY ux.total_xp DESC, ux.user_id ASC
  )::bigint AS rank,
  ux.user_id,
  public.format_leaderboard_display_name(pr.display_name, pr.email_local) AS display_name,
  COALESCE(NULLIF(trim(pr.avatar_url), ''), '') AS avatar_url,
  ux.total_xp,
  ux.level,
  CASE ux.level
    WHEN 1 THEN 'Saver'
    WHEN 2 THEN 'Planner'
    WHEN 3 THEN 'Investor'
    WHEN 4 THEN 'Builder'
    WHEN 5 THEN 'Allocator'
    WHEN 6 THEN 'Strategist'
    WHEN 7 THEN 'Master'
    ELSE 'Saver'
  END AS level_label,
  COALESCE(bc.cnt, 0)::bigint AS badge_count,
  tb.top_badge,
  ux.xp_this_week,
  ls_y.rank AS rank_yesterday
FROM public.user_xp ux
LEFT JOIN public.profiles pr ON pr.id = ux.user_id
LEFT JOIN public.leaderboard_snapshots ls_y
  ON ls_y.user_id = ux.user_id
  AND ls_y.snapshot_date = ((timezone('utc', now()))::date - INTERVAL '1 day')
LEFT JOIN LATERAL (
  SELECT COUNT(*)::bigint AS cnt
  FROM public.user_badges ub
  WHERE ub.user_id = ux.user_id
) bc ON true
LEFT JOIN LATERAL (
  SELECT ub.badge_id AS top_badge
  FROM public.user_badges ub
  WHERE ub.user_id = ux.user_id
  ORDER BY ub.xp_reward DESC, ub.badge_id DESC
  LIMIT 1
) tb ON true;

CREATE VIEW public.leaderboard_weekly_view AS
SELECT
  ROW_NUMBER() OVER (
    ORDER BY ux.xp_this_week DESC, ux.user_id ASC
  )::bigint AS rank,
  ux.user_id,
  public.format_leaderboard_display_name(pr.display_name, pr.email_local) AS display_name,
  COALESCE(NULLIF(trim(pr.avatar_url), ''), '') AS avatar_url,
  ux.total_xp,
  ux.level,
  CASE ux.level
    WHEN 1 THEN 'Saver'
    WHEN 2 THEN 'Planner'
    WHEN 3 THEN 'Investor'
    WHEN 4 THEN 'Builder'
    WHEN 5 THEN 'Allocator'
    WHEN 6 THEN 'Strategist'
    WHEN 7 THEN 'Master'
    ELSE 'Saver'
  END AS level_label,
  COALESCE(bc.cnt, 0)::bigint AS badge_count,
  tb.top_badge,
  ux.xp_this_week,
  NULL::bigint AS rank_yesterday
FROM public.user_xp ux
LEFT JOIN public.profiles pr ON pr.id = ux.user_id
LEFT JOIN LATERAL (
  SELECT COUNT(*)::bigint AS cnt
  FROM public.user_badges ub
  WHERE ub.user_id = ux.user_id
) bc ON true
LEFT JOIN LATERAL (
  SELECT ub.badge_id AS top_badge
  FROM public.user_badges ub
  WHERE ub.user_id = ux.user_id
  ORDER BY ub.xp_reward DESC, ub.badge_id DESC
  LIMIT 1
) tb ON true;

GRANT SELECT ON public.leaderboard_view TO authenticated;
GRANT SELECT ON public.leaderboard_weekly_view TO authenticated;

NOTIFY pgrst, 'reload schema';
