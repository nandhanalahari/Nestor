-- Migration: append-only health score snapshots for trend / delta

CREATE TABLE IF NOT EXISTS health_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_score_history_user_recorded_idx
  ON health_score_history (user_id, recorded_at DESC);

ALTER TABLE health_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own health_score_history" ON health_score_history;
CREATE POLICY "Users select own health_score_history"
  ON health_score_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own health_score_history" ON health_score_history;
CREATE POLICY "Users insert own health_score_history"
  ON health_score_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);
