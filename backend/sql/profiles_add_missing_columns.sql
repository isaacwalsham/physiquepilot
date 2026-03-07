-- ═══════════════════════════════════════════════════════════════════════════
-- profiles_add_missing_columns.sql
-- Run this in the Supabase SQL Editor.
-- Uses ADD COLUMN IF NOT EXISTS throughout — safe to run multiple times.
-- Also enables Row Level Security on user tables (fixes security advisor
-- warnings).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. PROFILES TABLE — add every column the overhaul references ──────────

-- Onboarding progress
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_step          integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_complete      boolean  NOT NULL DEFAULT false;

-- Basic identity (may already exist — safe either way)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name               text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name                text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth            date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sex                      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unit_system              text     NOT NULL DEFAULT 'metric';

-- Body metrics
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm                numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS starting_weight_kg       numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_weight_kg        numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_weight_kg           numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS body_fat_pct             numeric;

-- Goal & calorie settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_type                text     NOT NULL DEFAULT 'maintain';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_weight_change_target_kg  numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calorie_mode             text     NOT NULL DEFAULT 'ai';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_calories          integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rest_day_deficit         integer  NOT NULL DEFAULT 250;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_day_surplus         integer  NOT NULL DEFAULT 200;

-- Activity
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activity_level          text     NOT NULL DEFAULT 'moderate';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lifestyle_activity      text;

-- Training schedule
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS split_mode              text     NOT NULL DEFAULT 'fixed';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_days           text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_days_per_week  integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_frequency_range text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rolling_start_date      date;

-- Training experience & gym
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_level        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gym_type                text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gym_chain               text;

-- Activity baselines
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS baseline_steps_per_day            integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS steps_target                       integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS baseline_cardio_minutes_per_week  integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS baseline_cardio_avg_hr            integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_liss_opt_in               boolean NOT NULL DEFAULT true;

-- Dietary preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dietary_preference      text     NOT NULL DEFAULT 'omnivore';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dietary_additional      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dislikes                text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS food_allergies          text;

-- Manual day-type overrides (Training page toggle)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS today_day_type               text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS today_day_type_date          text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_day_type_override   boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nutrition_day_type_override  boolean NOT NULL DEFAULT false;

-- Nutrition display preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nutrition_view_mode     text     NOT NULL DEFAULT 'macros';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_meal_macros        boolean  NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_day_macros         boolean  NOT NULL DEFAULT true;

-- Check-in day preference
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS check_in_day            text;

-- Account status (may already exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status     text     NOT NULL DEFAULT 'inactive';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended            boolean  NOT NULL DEFAULT false;


-- ── 2. NUTRITION DAY TARGETS — ensure table exists ────────────────────────

CREATE TABLE IF NOT EXISTS public.nutrition_day_targets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  day_type   text NOT NULL,
  calories   integer,
  protein_g  integer,
  carbs_g    integer,
  fats_g     integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_type)
);


-- ── 3. ROW LEVEL SECURITY — fix Supabase security advisor warnings ────────
-- The service-role key (used by the backend) bypasses RLS entirely.
-- The anon key (used by the frontend) is constrained by these policies.
-- All policies use auth.uid() = user_id so users only see their own rows.

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own ON public.profiles
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- nutrition_day_targets
ALTER TABLE public.nutrition_day_targets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_day_targets' AND policyname = 'ndt_select_own'
  ) THEN
    CREATE POLICY ndt_select_own ON public.nutrition_day_targets
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_day_targets' AND policyname = 'ndt_insert_own'
  ) THEN
    CREATE POLICY ndt_insert_own ON public.nutrition_day_targets
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_day_targets' AND policyname = 'ndt_update_own'
  ) THEN
    CREATE POLICY ndt_update_own ON public.nutrition_day_targets
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_day_targets' AND policyname = 'ndt_delete_own'
  ) THEN
    CREATE POLICY ndt_delete_own ON public.nutrition_day_targets
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- nutrition_meal_presets
ALTER TABLE public.nutrition_meal_presets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_meal_presets' AND policyname = 'nmp_all_own'
  ) THEN
    CREATE POLICY nmp_all_own ON public.nutrition_meal_presets
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- nutrition_saved_meals
ALTER TABLE public.nutrition_saved_meals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_saved_meals' AND policyname = 'nsm_all_own'
  ) THEN
    CREATE POLICY nsm_all_own ON public.nutrition_saved_meals
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- weight_logs (if it exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weight_logs') THEN
    EXECUTE 'ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'weight_logs' AND policyname = 'wl_all_own'
    ) THEN
      EXECUTE 'CREATE POLICY wl_all_own ON public.weight_logs FOR ALL USING (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;

-- steps_logs (if it exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'steps_logs') THEN
    EXECUTE 'ALTER TABLE public.steps_logs ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'steps_logs' AND policyname = 'sl_all_own'
    ) THEN
      EXECUTE 'CREATE POLICY sl_all_own ON public.steps_logs FOR ALL USING (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;

-- training_sessions (if it exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'training_sessions') THEN
    EXECUTE 'ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_sessions' AND policyname = 'ts_all_own'
    ) THEN
      EXECUTE 'CREATE POLICY ts_all_own ON public.training_sessions FOR ALL USING (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;

-- check_ins (if it exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'check_ins') THEN
    EXECUTE 'ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'check_ins' AND policyname = 'ci_all_own'
    ) THEN
      EXECUTE 'CREATE POLICY ci_all_own ON public.check_ins FOR ALL USING (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;

-- nutrition_logs (if it exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nutrition_logs') THEN
    EXECUTE 'ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_logs' AND policyname = 'nl_all_own'
    ) THEN
      EXECUTE 'CREATE POLICY nl_all_own ON public.nutrition_logs FOR ALL USING (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;

-- daily_nutrition_items (used by Dashboard to show consumed vs target progress bars)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_nutrition_items') THEN
    EXECUTE 'ALTER TABLE public.daily_nutrition_items ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'daily_nutrition_items' AND policyname = 'dni_all_own'
    ) THEN
      EXECUTE 'CREATE POLICY dni_all_own ON public.daily_nutrition_items FOR ALL USING (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;
