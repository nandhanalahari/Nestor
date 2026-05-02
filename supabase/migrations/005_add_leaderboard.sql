-- Leaderboard: public profiles mirror (for API-safe joins), user_badges, views

-- ─── Public profile row (synced from auth.users — avoids joining auth in views) ───
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email_local TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles (updated_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are readable for leaderboard" ON public.profiles;
CREATE POLICY "Profiles are readable for leaderboard"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users upsert own profile" ON public.profiles;
CREATE POLICY "Users upsert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ─── Badges earned ───
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
  ON public.user_badges FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users insert own badges" ON public.user_badges;
CREATE POLICY "Users insert own badges"
  ON public.user_badges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── Sync auth → profiles (SECURITY DEFINER) ───
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

-- Backfill profiles for existing users
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

-- ─── Display name: "Maya R." from full name + email fallback ───
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

-- ─── Views (drop first for clean replace) ───
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
  ux.xp_this_week
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
  ux.xp_this_week
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
