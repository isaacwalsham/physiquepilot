-- ── Habit Tracker Schema ──────────────────────────────────────────────────────
-- Run this in your Supabase SQL editor before using the Habit Tracker page.

-- Areas (categories with colours)
CREATE TABLE IF NOT EXISTS public.habit_areas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  icon       TEXT,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.habit_areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner" ON public.habit_areas;
CREATE POLICY "owner" ON public.habit_areas
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Habits
CREATE TABLE IF NOT EXISTS public.habits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id      UUID REFERENCES public.habit_areas(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  icon         TEXT,
  habit_type   TEXT NOT NULL DEFAULT 'positive'
               CHECK (habit_type IN ('positive', 'negative', 'quantified')),
  target_value NUMERIC,
  target_unit  TEXT,
  time_of_day  TEXT NOT NULL DEFAULT 'anytime'
               CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'anytime')),
  inherit_source TEXT
               CHECK (inherit_source IN (
                 'steps_goal','workout_session','cardio_logged','macros_hit','micros_hit'
               )),
  is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INT     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner" ON public.habits;
CREATE POLICY "owner" ON public.habits
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Habit Logs (one row per habit per day)
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  log_date   DATE NOT NULL,
  status     TEXT NOT NULL
             CHECK (status IN ('complete', 'incomplete', 'skipped')),
  value      NUMERIC,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, habit_id, log_date)
);
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner" ON public.habit_logs;
CREATE POLICY "owner" ON public.habit_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Migration: add inherit_source to existing habits table (safe to re-run)
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS inherit_source TEXT
  CHECK (inherit_source IN (
    'steps_goal','workout_session','cardio_logged','macros_hit','micros_hit'
  ));
