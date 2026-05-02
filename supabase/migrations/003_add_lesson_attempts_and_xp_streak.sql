-- Lesson completions + current streak on user_xp

ALTER TABLE user_xp
  ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS lesson_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL,
  choice TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_attempts_user_played_idx
  ON lesson_attempts (user_id, played_at DESC);

ALTER TABLE lesson_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own lesson_attempts" ON lesson_attempts;
CREATE POLICY "Users select own lesson_attempts"
  ON lesson_attempts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own lesson_attempts" ON lesson_attempts;
CREATE POLICY "Users insert own lesson_attempts"
  ON lesson_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
