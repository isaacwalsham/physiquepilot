-- ─── Check-ins Overhaul Migration ─────────────────────────────────────────────
-- Run this in Supabase SQL Editor

-- 1. Add new subjective rating columns to weekly_check_ins
ALTER TABLE public.weekly_check_ins
  ADD COLUMN IF NOT EXISTS sleep_quality_rating   smallint CHECK (sleep_quality_rating BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS mood_rating             smallint CHECK (mood_rating BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS stress_rating           smallint CHECK (stress_rating BETWEEN 1 AND 10);

-- Update existing 1-5 ratings to allow 1-10
ALTER TABLE public.weekly_check_ins
  DROP CONSTRAINT IF EXISTS weekly_check_ins_hunger_rating_check,
  DROP CONSTRAINT IF EXISTS weekly_check_ins_energy_rating_check,
  DROP CONSTRAINT IF EXISTS weekly_check_ins_performance_rating_check,
  DROP CONSTRAINT IF EXISTS weekly_check_ins_recovery_rating_check,
  DROP CONSTRAINT IF EXISTS weekly_check_ins_adherence_rating_check;

ALTER TABLE public.weekly_check_ins
  ADD CONSTRAINT weekly_check_ins_hunger_rating_check      CHECK (hunger_rating BETWEEN 1 AND 10),
  ADD CONSTRAINT weekly_check_ins_energy_rating_check      CHECK (energy_rating BETWEEN 1 AND 10),
  ADD CONSTRAINT weekly_check_ins_performance_rating_check CHECK (performance_rating BETWEEN 1 AND 10),
  ADD CONSTRAINT weekly_check_ins_recovery_rating_check    CHECK (recovery_rating BETWEEN 1 AND 10),
  ADD CONSTRAINT weekly_check_ins_adherence_rating_check   CHECK (adherence_rating BETWEEN 1 AND 10);

-- Add macro averages columns to weekly_check_ins
ALTER TABLE public.weekly_check_ins
  ADD COLUMN IF NOT EXISTS avg_protein_g  numeric,
  ADD COLUMN IF NOT EXISTS avg_carbs_g    numeric,
  ADD COLUMN IF NOT EXISTS avg_fat_g      numeric;

-- 2. Add pose metadata columns to progress_photos
ALTER TABLE public.progress_photos
  ADD COLUMN IF NOT EXISTS pose_preset  text, -- 'standard' | 'bodybuilding'
  ADD COLUMN IF NOT EXISTS pose_name    text; -- e.g. 'Front Relaxed', 'Back Double Bicep'

-- 3. Create coach_conversations table
CREATE TABLE IF NOT EXISTS public.coach_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_conversations_user_created
  ON public.coach_conversations (user_id, created_at DESC);

ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coach_conversations' AND policyname = 'cc_all_own'
  ) THEN
    CREATE POLICY cc_all_own ON public.coach_conversations
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Create check_in_reports table
CREATE TABLE IF NOT EXISTS public.check_in_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start    date NOT NULL,
  week_end      date NOT NULL,
  report_text   text NOT NULL,        -- markdown report content
  report_data   jsonb,                -- raw structured data snapshot
  email_sent    boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS check_in_reports_user_week
  ON public.check_in_reports (user_id, week_start DESC);

ALTER TABLE public.check_in_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_in_reports' AND policyname = 'cir_all_own'
  ) THEN
    CREATE POLICY cir_all_own ON public.check_in_reports
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
