-- ==========================================================================
-- Detail Command — Iris actions audit log
-- ==========================================================================
-- Run in Supabase SQL editor. Idempotent.
--
-- Records every action Iris proposes that Jayden approves and executes.
-- Pure audit / safety net — the action itself is performed client-side via
-- the existing store actions and Supabase tables. This table just lets you
-- look back and see "what did Iris do, when, on whose behalf."
--
-- No realtime — this is read-rarely / write-only.
-- RLS uses the same admin-only pattern as receipts / mileage.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS iris_actions (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  action_type     TEXT NOT NULL,
  label           TEXT,
  summary         TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- "executed" | "failed" | "dismissed"
  status          TEXT NOT NULL DEFAULT 'executed',
  result_summary  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS iris_actions_user_id_idx     ON iris_actions(user_id);
CREATE INDEX IF NOT EXISTS iris_actions_created_at_idx  ON iris_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS iris_actions_action_type_idx ON iris_actions(action_type);

-- ---------- RLS (admin-only via is_admin) ----------

ALTER TABLE iris_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin select own iris_actions" ON iris_actions;
DROP POLICY IF EXISTS "admin insert own iris_actions" ON iris_actions;
DROP POLICY IF EXISTS "admin delete own iris_actions" ON iris_actions;

CREATE POLICY "admin select own iris_actions"
  ON iris_actions FOR SELECT
  USING (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin insert own iris_actions"
  ON iris_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin delete own iris_actions"
  ON iris_actions FOR DELETE
  USING (auth.uid() = user_id AND public.is_admin());

-- ==========================================================================
-- Done.
-- ==========================================================================
