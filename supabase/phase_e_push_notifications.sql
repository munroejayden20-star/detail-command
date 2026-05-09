-- ==========================================================================
-- Detail Command — Phase E: Phone notifications (Web Push + SMS scaffold)
-- ==========================================================================
-- Run in Supabase SQL editor. Idempotent.
--
-- Adds:
--   - push_subscriptions table (one row per device that opted in to push)
--   - settings columns for push enablement + SMS phone number (SMS is
--     scaffolded for later — the edge function checks the toggle but won't
--     actually send until Twilio creds are added as function secrets)
--
-- After running this migration, you still need to:
--
--   1. Generate VAPID keys:
--        npx web-push generate-vapid-keys
--      Put the PUBLIC key in your client .env as VITE_VAPID_PUBLIC_KEY.
--      Put the PRIVATE key as a Supabase function secret:
--        supabase secrets set VAPID_PRIVATE_KEY=<value>
--        supabase secrets set VAPID_PUBLIC_KEY=<value>
--        supabase secrets set VAPID_SUBJECT=mailto:you@example.com
--
--   2. Deploy the edge function:
--        supabase functions deploy send-notification
--
--   3. In Supabase Dashboard → Database → Webhooks → "Create a new hook":
--        Table: notifications
--        Events: INSERT
--        Method: POST
--        URL: https://<project>.supabase.co/functions/v1/send-notification
--        HTTP Headers:
--          Authorization: Bearer <SUPABASE_ANON_KEY>
--          Content-Type: application/json
--      This is the bridge that fires push whenever a notification row is
--      inserted (from any source: client engine, public booking RPC, etc.).
-- ==========================================================================

-- ---------- Push subscriptions table ----------

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The Web Push subscription endpoint URL (Apple/Mozilla/Google FCM).
  -- Unique per device — one device, one endpoint.
  endpoint    TEXT NOT NULL UNIQUE,

  -- Encryption keys from PushSubscription.toJSON().keys
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,

  -- Diagnostic / cleanup metadata
  user_agent  TEXT,
  device_label TEXT,
  last_used_at TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id);

CREATE OR REPLACE FUNCTION _push_subs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at BEFORE UPDATE ON push_subscriptions
FOR EACH ROW EXECUTE FUNCTION _push_subs_set_updated_at();

-- ---------- RLS (admin-only via is_admin) ----------

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin select own push subs" ON push_subscriptions;
DROP POLICY IF EXISTS "admin insert own push subs" ON push_subscriptions;
DROP POLICY IF EXISTS "admin update own push subs" ON push_subscriptions;
DROP POLICY IF EXISTS "admin delete own push subs" ON push_subscriptions;

CREATE POLICY "admin select own push subs"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin insert own push subs"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin update own push subs"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id AND public.is_admin())
  WITH CHECK (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin delete own push subs"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id AND public.is_admin());

-- ---------- Settings columns ----------

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_enabled                BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_phone_number           TEXT;

-- ---------- Realtime publication ----------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'push_subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE push_subscriptions';
  END IF;
END$$;

-- ==========================================================================
-- Done. Continue with VAPID key generation + edge function deployment +
-- Database Webhook configuration (see header).
-- ==========================================================================
