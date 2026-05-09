-- ==========================================================================
-- Detail Command — Phase 8: Admin Lockdown
-- ==========================================================================
-- Locks the management app down to a single admin email.
-- Run this in your Supabase SQL editor. Idempotent — safe to re-run.
--
-- What this does:
--   1. Creates a public.is_admin() helper that resolves the current session's
--      email and returns true iff it matches the admin allowlist below.
--   2. Tightens settings RLS so non-admins cannot read/write the row (defense
--      in depth — the auth.uid() = user_id rule already blocks them, this is
--      a second layer in case a stray account is ever created).
--   3. Provides an audit query (commented) you can run to spot stray
--      auth.users rows that are NOT the admin.
--
-- IMPORTANT:
--   - The frontend (src/lib/admin.ts) holds the same allowlist. Keep them
--     in sync if you ever add a second admin.
--   - Disabling public signup in the Supabase dashboard is a separate manual
--     step (see deliverable in chat).
-- ==========================================================================

-- ---------- 1. is_admin() helper ----------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) IN (
        'munroe.jayden20@gmail.com'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ---------- 2. Tighten settings RLS (defense in depth) ----------
-- Existing policies already require auth.uid() = user_id, but this also
-- requires the caller to be an admin email. With signups disabled this is
-- redundant; with signups ever re-enabled this still protects you.

DROP POLICY IF EXISTS "users select own settings" ON settings;
DROP POLICY IF EXISTS "users insert own settings" ON settings;
DROP POLICY IF EXISTS "users update own settings" ON settings;
DROP POLICY IF EXISTS "users delete own settings" ON settings;

CREATE POLICY "admin select own settings"
  ON settings FOR SELECT
  USING (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin insert own settings"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin update own settings"
  ON settings FOR UPDATE
  USING (auth.uid() = user_id AND public.is_admin())
  WITH CHECK (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin delete own settings"
  ON settings FOR DELETE
  USING (auth.uid() = user_id AND public.is_admin());

-- ---------- 3. Audit (run manually if you want to check for stray users) ----------
-- SELECT id, email, created_at
-- FROM auth.users
-- WHERE lower(email) NOT IN ('munroe.jayden20@gmail.com')
-- ORDER BY created_at;
--
-- To delete a stray user (DESTRUCTIVE — confirms ownership of the email first):
--   DELETE FROM auth.users WHERE id = '<uuid>';
-- ==========================================================================
