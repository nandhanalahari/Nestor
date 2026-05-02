-- Repair: recreate leaderboard_snapshots + views if a prior migration failed mid-flight
-- (e.g. DROP VIEW succeeded before CREATE VIEW). Idempotent. Keeps PostgREST cache fresh.

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
  ON public.leaderboard_snapshots FOR SELECT
  TO authenticated
  USING (true);

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
