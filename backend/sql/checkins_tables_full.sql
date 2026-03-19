-- ─── Check-ins Full Migration ──────────────────────────────────────────────────
-- Run this in Supabase SQL Editor BEFORE running checkins_overhaul.sql
-- Creates weekly_check_ins, progress_photos, coach_conversations, check_in_reports

-- ── 1. weekly_check_ins ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_check_ins (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start                   date        NOT NULL,
  week_end                     date        NOT NULL,

  -- Auto-computed metrics
  avg_weight_kg                numeric,
  weight_change_kg             numeric,
  avg_calories                 numeric,
  avg_protein_g                numeric,
  avg_carbs_g                  numeric,
  avg_fat_g                    numeric,
  training_sessions_completed  smallint,
  cardio_sessions              smallint,
  avg_steps                    numeric,

  -- Subjective ratings (1-10)
  hunger_rating                smallint CHECK (hunger_rating      BETWEEN 1 AND 10),
  energy_rating                smallint CHECK (energy_rating      BETWEEN 1 AND 10),
  performance_rating           smallint CHECK (performance_rating BETWEEN 1 AND 10),
  recovery_rating              smallint CHECK (recovery_rating    BETWEEN 1 AND 10),
  adherence_rating             smallint CHECK (adherence_rating   BETWEEN 1 AND 10),
  sleep_quality_rating         smallint CHECK (sleep_quality_rating BETWEEN 1 AND 10),
  mood_rating                  smallint CHECK (mood_rating        BETWEEN 1 AND 10),
  stress_rating                smallint CHECK (stress_rating      BETWEEN 1 AND 10),

  notes                        text,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_check_ins_user_week
  ON public.weekly_check_ins (user_id, week_start DESC);

ALTER TABLE public.weekly_check_ins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'weekly_check_ins' AND policyname = 'wci_all_own'
  ) THEN
    CREATE POLICY wci_all_own ON public.weekly_check_ins
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. progress_photos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progress_photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_on     timestamptz NOT NULL DEFAULT now(),
  image_path   text        NOT NULL,   -- path inside "progress-photos" bucket
  pose_preset  text,                   -- 'standard' | 'bodybuilding'
  pose_name    text,                   -- e.g. 'Front Relaxed', 'Back Double Bicep'
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS progress_photos_user_taken
  ON public.progress_photos (user_id, taken_on DESC);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_photos' AND policyname = 'pp_all_own'
  ) THEN
    CREATE POLICY pp_all_own ON public.progress_photos
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. coach_conversations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL,
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

-- ── 4. check_in_reports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.check_in_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start    date        NOT NULL,
  week_end      date        NOT NULL,
  report_text   text        NOT NULL,
  report_data   jsonb,
  email_sent    boolean     NOT NULL DEFAULT false,
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

-- ── 5. Storage bucket: progress-photos ───────────────────────────────────────
-- Run this separately if the bucket doesn't exist yet:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'progress-photos',
--   'progress-photos',
--   false,
--   10485760,  -- 10 MB
--   ARRAY['image/jpeg','image/jpg','image/png','image/webp']
-- )
-- ON CONFLICT (id) DO NOTHING;
--
-- Storage RLS policies for progress-photos bucket:
-- CREATE POLICY "Users can upload their own photos"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
--
-- CREATE POLICY "Users can view their own photos"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'progress-photos' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
--
-- CREATE POLICY "Users can delete their own photos"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'progress-photos' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
