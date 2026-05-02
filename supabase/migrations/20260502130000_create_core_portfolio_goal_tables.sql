-- Core portfolio, goals, scenario, and history tables used by the app.
-- This migration is defensive: it can create tables from scratch or add
-- missing columns to an existing Supabase project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Stock',
  shares NUMERIC NOT NULL DEFAULT 0,
  cost_basis NUMERIC NOT NULL DEFAULT 0,
  cost_basis_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ticker TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Stock',
  ADD COLUMN IF NOT EXISTS shares NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_basis NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_basis_date DATE NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS holdings_user_created_idx
  ON public.holdings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS holdings_user_ticker_idx
  ON public.holdings (user_id, ticker);

ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own holdings" ON public.holdings;
CREATE POLICY "Users select own holdings"
  ON public.holdings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own holdings" ON public.holdings;
CREATE POLICY "Users insert own holdings"
  ON public.holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own holdings" ON public.holdings;
CREATE POLICY "Users update own holdings"
  ON public.holdings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own holdings" ON public.holdings;
CREATE POLICY "Users delete own holdings"
  ON public.holdings FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS holdings_updated_at ON public.holdings;
CREATE TRIGGER holdings_updated_at
  BEFORE UPDATE ON public.holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  text_goal TEXT NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  monthly_savings_target NUMERIC NULL,
  deadline DATE NULL,
  icon TEXT NOT NULL DEFAULT 'other',
  ai_suggestion TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS text_goal TEXT,
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_savings_target NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS deadline DATE NULL,
  ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS ai_suggestion TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS goals_user_created_idx
  ON public.goals (user_id, created_at DESC);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own goals" ON public.goals;
CREATE POLICY "Users select own goals"
  ON public.goals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own goals" ON public.goals;
CREATE POLICY "Users insert own goals"
  ON public.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own goals" ON public.goals;
CREATE POLICY "Users update own goals"
  ON public.goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own goals" ON public.goals;
CREATE POLICY "Users delete own goals"
  ON public.goals FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS goals_updated_at ON public.goals;
CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.weekly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  shares NUMERIC NOT NULL DEFAULT 0,
  cost_basis NUMERIC NOT NULL DEFAULT 0,
  market_value NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  profit_pct NUMERIC NOT NULL DEFAULT 0,
  portfolio_weight NUMERIC NOT NULL DEFAULT 0,
  portfolio_contribution NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_snapshots
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ticker TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS week_start DATE,
  ADD COLUMN IF NOT EXISTS week_end DATE,
  ADD COLUMN IF NOT EXISTS shares NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_basis NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_pct NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portfolio_weight NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portfolio_contribution NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS weekly_snapshots_user_ticker_week_idx
  ON public.weekly_snapshots (user_id, ticker, week_start);

CREATE INDEX IF NOT EXISTS weekly_snapshots_user_week_idx
  ON public.weekly_snapshots (user_id, week_start DESC);

ALTER TABLE public.weekly_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own weekly_snapshots" ON public.weekly_snapshots;
CREATE POLICY "Users select own weekly_snapshots"
  ON public.weekly_snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own weekly_snapshots" ON public.weekly_snapshots;
CREATE POLICY "Users insert own weekly_snapshots"
  ON public.weekly_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own weekly_snapshots" ON public.weekly_snapshots;
CREATE POLICY "Users update own weekly_snapshots"
  ON public.weekly_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.rebalance_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL,
  scenario_title TEXT NOT NULL,
  original_allocation JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_allocation JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_reduction TEXT NULL,
  original_vol NUMERIC NULL,
  new_vol NUMERIC NULL,
  original_sharpe NUMERIC NULL,
  new_sharpe NUMERIC NULL,
  max_drawdown_original NUMERIC NULL,
  max_drawdown_optimized NUMERIC NULL,
  risk_contributions JSONB NULL,
  efficient_frontier JSONB NULL,
  explanation TEXT NULL,
  source TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rebalance_proposals
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scenario_id TEXT,
  ADD COLUMN IF NOT EXISTS scenario_title TEXT,
  ADD COLUMN IF NOT EXISTS original_allocation JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recommended_allocation JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_reduction TEXT NULL,
  ADD COLUMN IF NOT EXISTS original_vol NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS new_vol NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS original_sharpe NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS new_sharpe NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS max_drawdown_original NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS max_drawdown_optimized NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS risk_contributions JSONB NULL,
  ADD COLUMN IF NOT EXISTS efficient_frontier JSONB NULL,
  ADD COLUMN IF NOT EXISTS explanation TEXT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS rebalance_proposals_user_created_idx
  ON public.rebalance_proposals (user_id, created_at DESC);

ALTER TABLE public.rebalance_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own rebalance_proposals" ON public.rebalance_proposals;
CREATE POLICY "Users select own rebalance_proposals"
  ON public.rebalance_proposals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own rebalance_proposals" ON public.rebalance_proposals;
CREATE POLICY "Users insert own rebalance_proposals"
  ON public.rebalance_proposals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
