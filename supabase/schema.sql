-- ==========================================================================
-- Detail Command — Supabase schema
-- ==========================================================================
-- Run this in your Supabase project's SQL editor (https://app.supabase.com).
-- Idempotent — safe to re-run; existing data will be preserved.
-- ==========================================================================

-- All tables use TEXT primary keys generated client-side (uid() helper) so
-- inserts can be optimistic without round-tripping for IDs.

-- ---------- Tables ----------

create table if not exists customers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  address text,
  vehicles jsonb not null default '[]'::jsonb,
  notes text,
  is_repeat boolean not null default false,
  is_monthly_maintenance boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists customers_user_id_idx on customers(user_id);

create table if not exists appointments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text references customers(id) on delete set null,
  vehicle jsonb not null default '{}'::jsonb,
  address text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  service_ids jsonb not null default '[]'::jsonb,
  addon_ids jsonb not null default '[]'::jsonb,
  estimated_price numeric not null default 0,
  final_price numeric,
  deposit_paid boolean not null default false,
  payment_status text not null default 'unpaid',
  status text not null default 'scheduled',
  interior_condition text,
  exterior_condition text,
  pet_hair boolean not null default false,
  stains boolean not null default false,
  heavy_dirt boolean not null default false,
  water_access boolean not null default true,
  power_access boolean not null default true,
  customer_notes text,
  internal_notes text,
  before_photos jsonb default '[]'::jsonb,
  after_photos jsonb default '[]'::jsonb,
  reminder_sent boolean default false,
  travel_time_notes text,
  created_at timestamptz not null default now()
);
create index if not exists appointments_user_id_idx on appointments(user_id);
create index if not exists appointments_start_at_idx on appointments(start_at);

create table if not exists leads (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  source text not null default 'other',
  vehicle text,
  interest text not null default 'medium',
  last_contacted timestamptz,
  follow_up_date timestamptz,
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists leads_user_id_idx on leads(user_id);

create table if not exists tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'general',
  priority text not null default 'medium',
  due_date timestamptz,
  completed boolean not null default false,
  recurring text not null default 'none',
  notes text,
  appointment_id text,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_id_idx on tasks(user_id);

create table if not exists services (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price_low numeric not null default 0,
  price_high numeric not null default 0,
  duration_minutes integer not null default 60,
  is_addon boolean not null default false
);
create index if not exists services_user_id_idx on services(user_id);

create table if not exists expenses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  category text not null default 'misc',
  amount numeric not null default 0,
  notes text
);
create index if not exists expenses_user_id_idx on expenses(user_id);

create table if not exists startup_items (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  budget numeric not null default 0,
  spent numeric not null default 0,
  purchased boolean not null default false,
  notes text
);
create index if not exists startup_items_user_id_idx on startup_items(user_id);

-- Phase 3: budget / future-purchase tracker fields
alter table startup_items
  add column if not exists category text not null default 'misc',
  add column if not exists priority text not null default 'want',
  add column if not exists status text not null default 'want',
  add column if not exists link text,
  add column if not exists target_date timestamptz,
  add column if not exists actual_cost numeric;
-- Backfill status from purchased flag for existing rows
update startup_items set status = 'purchased' where purchased = true and status = 'want';

create table if not exists templates (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  tag text not null default 'other'
);
create index if not exists templates_user_id_idx on templates(user_id);

create table if not exists checklist_groups (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text,
  items jsonb not null default '[]'::jsonb,
  appointment_id text
);
create index if not exists checklist_groups_user_id_idx on checklist_groups(user_id);

-- Phase 3: custom checklist builder
alter table checklist_groups
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists customer_id text,
  add column if not exists vehicle text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
-- Backfill category from legacy `kind` so existing rows still group
update checklist_groups set category = coalesce(category, kind, 'custom') where category is null;
-- Allow `kind` to be null going forward
alter table checklist_groups alter column kind drop not null;

create table if not exists blocked_times (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  label text not null default 'Blocked',
  recurring text default 'none'
);
create index if not exists blocked_times_user_id_idx on blocked_times(user_id);

create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system',
  buffer_minutes integer not null default 30,
  max_jobs_per_day integer not null default 3,
  weekday_evenings boolean not null default true,
  weekday_unavailable_start text not null default '08:00',
  weekday_unavailable_end text not null default '17:00',
  startup_goal numeric not null default 2000,
  business_name text not null default 'JMDetailing',
  owner_name text not null default '',
  contact_phone text not null default ''
);

-- Phase 3: profile customization
alter table settings
  add column if not exists email text,
  add column if not exists service_area text,
  add column if not exists business_description text,
  add column if not exists accent_color text,
  add column if not exists avatar_url text,
  add column if not exists logo_url text;

-- Phase 5: notification center
create table if not exists notifications (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  link_url text,
  metadata jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_created_at_idx on notifications(created_at desc);
create index if not exists notifications_unread_idx on notifications(user_id, read) where read = false;

-- Phase 5: notification preferences (one row per user)
alter table settings
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists notify_appointments boolean not null default true,
  add column if not exists notify_payments boolean not null default true,
  add column if not exists notify_follow_ups boolean not null default true,
  add column if not exists notify_reviews boolean not null default true,
  add column if not exists notify_weather boolean not null default true,
  add column if not exists notify_updates boolean not null default true,
  add column if not exists reminder_minutes integer not null default 60;

-- Settings overhaul: new profile, scheduling, defaults, and booking columns
alter table settings
  add column if not exists google_review_link text,
  add column if not exists service_area_radius integer,
  add column if not exists weekend_availability boolean not null default true,
  add column if not exists workday_start text not null default '08:00',
  add column if not exists workday_end text not null default '18:00',
  add column if not exists default_appointment_duration integer not null default 90,
  add column if not exists default_tax_rate numeric,
  add column if not exists default_travel_fee numeric,
  add column if not exists default_quote_disclaimer text,
  add column if not exists default_confirmation_message text,
  add column if not exists default_follow_up_days integer not null default 2,
  add column if not exists default_review_request_message text,
  add column if not exists booking_page_enabled boolean not null default false,
  add column if not exists booking_page_slug text,
  add column if not exists auto_confirm_bookings boolean not null default false,
  add column if not exists deposit_required boolean not null default false,
  add column if not exists deposit_amount numeric;

-- Phase 5c: public booking page columns
alter table appointments
  add column if not exists source text not null default 'dashboard',
  add column if not exists booking_photo_urls jsonb not null default '[]'::jsonb;

alter table customers
  add column if not exists preferred_contact text;

-- Phase 4: photos metadata
create table if not exists photos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  type text not null default 'general',
  customer_id text references customers(id) on delete set null,
  appointment_id text references appointments(id) on delete set null,
  vehicle text,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  width integer,
  height integer,
  size_bytes integer,
  created_at timestamptz not null default now()
);
create index if not exists photos_user_id_idx on photos(user_id);
create index if not exists photos_customer_id_idx on photos(customer_id);
create index if not exists photos_appointment_id_idx on photos(appointment_id);

-- ---------- Row Level Security ----------

alter table customers enable row level security;
alter table appointments enable row level security;
alter table leads enable row level security;
alter table tasks enable row level security;
alter table services enable row level security;
alter table expenses enable row level security;
alter table startup_items enable row level security;
alter table templates enable row level security;
alter table checklist_groups enable row level security;
alter table blocked_times enable row level security;
alter table photos enable row level security;
alter table notifications enable row level security;
alter table settings enable row level security;

-- Helper to (re)create the four CRUD policies for a table
do $$
declare
  t text;
  tables text[] := array[
    'customers','appointments','leads','tasks','services',
    'expenses','startup_items','templates','checklist_groups','blocked_times','photos','notifications'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "users select own %1$s" on %1$I', t);
    execute format('drop policy if exists "users insert own %1$s" on %1$I', t);
    execute format('drop policy if exists "users update own %1$s" on %1$I', t);
    execute format('drop policy if exists "users delete own %1$s" on %1$I', t);
    execute format('create policy "users select own %1$s" on %1$I for select using (auth.uid() = user_id)', t);
    execute format('create policy "users insert own %1$s" on %1$I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "users update own %1$s" on %1$I for update using (auth.uid() = user_id)', t);
    execute format('create policy "users delete own %1$s" on %1$I for delete using (auth.uid() = user_id)', t);
  end loop;
end$$;

-- Settings table uses user_id as primary key, same policies
drop policy if exists "users select own settings" on settings;
drop policy if exists "users insert own settings" on settings;
drop policy if exists "users update own settings" on settings;
drop policy if exists "users delete own settings" on settings;
create policy "users select own settings" on settings for select using (auth.uid() = user_id);
create policy "users insert own settings" on settings for insert with check (auth.uid() = user_id);
create policy "users update own settings" on settings for update using (auth.uid() = user_id);
create policy "users delete own settings" on settings for delete using (auth.uid() = user_id);

-- ---------- Realtime publication (cross-device sync) ----------
-- Enable realtime on all user-owned tables so changes from one device
-- stream live to others. Idempotent — skips tables already published.
do $$
declare
  t text;
  tables text[] := array[
    'customers','appointments','leads','tasks','services',
    'expenses','startup_items','templates','checklist_groups',
    'blocked_times','photos','notifications','settings'
  ];
begin
  foreach t in array tables loop
    perform 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t;
    if not found then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end$$;

-- ---------- Storage bucket for photos (Phase 4) ----------

-- Create a private bucket for photo uploads (idempotent).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Storage RLS: users can only read/write/delete files inside a folder named
-- after their own auth UID. Path layout used by the app: <user_id>/<photo_id>.<ext>
drop policy if exists "users read own photo files" on storage.objects;
drop policy if exists "users upload own photo files" on storage.objects;
drop policy if exists "users update own photo files" on storage.objects;
drop policy if exists "users delete own photo files" on storage.objects;

create policy "users read own photo files"
  on storage.objects for select
  using (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users upload own photo files"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users update own photo files"
  on storage.objects for update
  using (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users delete own photo files"
  on storage.objects for delete
  using (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ==========================================================================
-- Done. After running this, configure VITE_SUPABASE_URL and
-- VITE_SUPABASE_ANON_KEY in your .env.local file and run `npm run dev`.
-- ==========================================================================
