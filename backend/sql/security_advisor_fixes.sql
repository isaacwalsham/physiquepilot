-- ═══════════════════════════════════════════════════════════════════════════
-- security_advisor_fixes.sql
-- Fixes every ERROR and WARN from the Supabase Security Advisor.
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ERROR 1: SECURITY DEFINER VIEW — daily_nutrition_totals ──────────────
-- This view is not used anywhere in the application. Drop it.
DROP VIEW IF EXISTS public.daily_nutrition_totals;


-- ── ERROR 2–7: RLS DISABLED on 6 tables ──────────────────────────────────

-- ─── nutrition_target_preferences (user-owned, user_id column) ───────────
ALTER TABLE public.nutrition_target_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_target_preferences' AND policyname='ntp_all_own') THEN
    CREATE POLICY ntp_all_own ON public.nutrition_target_preferences
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─── user_nutrient_target_overrides (user-owned, user_id column) ─────────
ALTER TABLE public.user_nutrient_target_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_nutrient_target_overrides' AND policyname='unto_all_own') THEN
    CREATE POLICY unto_all_own ON public.user_nutrient_target_overrides
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─── nutrients (shared read-only lookup — every user can read, none can write) ──
ALTER TABLE public.nutrients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrients' AND policyname='nutrients_read_all') THEN
    CREATE POLICY nutrients_read_all ON public.nutrients
      FOR SELECT USING (true);
  END IF;
END $$;

-- ─── food_search_aliases (shared read-only lookup) ────────────────────────
ALTER TABLE public.food_search_aliases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='food_search_aliases' AND policyname='fsa_read_all') THEN
    CREATE POLICY fsa_read_all ON public.food_search_aliases
      FOR SELECT USING (true);
  END IF;
END $$;

-- ─── nutrition_meal_preset_segments (owned via preset → nutrition_meal_presets.user_id) ──
ALTER TABLE public.nutrition_meal_preset_segments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_meal_preset_segments' AND policyname='nmps_all_own') THEN
    CREATE POLICY nmps_all_own ON public.nutrition_meal_preset_segments
      FOR ALL USING (
        auth.uid() = (
          SELECT user_id FROM public.nutrition_meal_presets WHERE id = preset_id
        )
      );
  END IF;
END $$;

-- ─── nutrition_saved_meal_items (owned via saved_meal → nutrition_saved_meals.user_id) ──
ALTER TABLE public.nutrition_saved_meal_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_saved_meal_items' AND policyname='nsmi_all_own') THEN
    CREATE POLICY nsmi_all_own ON public.nutrition_saved_meal_items
      FOR ALL USING (
        auth.uid() = (
          SELECT user_id FROM public.nutrition_saved_meals WHERE id = saved_meal_id
        )
      );
  END IF;
END $$;


-- ── WARN 1: FUNCTION SEARCH PATH MUTABLE — set_updated_at ────────────────
-- Recreate with a fixed search_path so it can't be exploited via
-- search_path injection. Function body is identical.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ── WARN 2: EXTENSION IN PUBLIC — pg_trgm ────────────────────────────────
-- Move pg_trgm from the public schema to the extensions schema.
-- The extensions schema is on Supabase's default search_path so
-- gin_trgm_ops operators remain resolvable without any query changes.
--
-- NOTE: This drops and recreates the GIN indexes that use trgm operators.
-- The steps are: drop indexes → drop extension → recreate in extensions
-- schema → recreate indexes.

-- Drop ALL indexes that depend on gin_trgm_ops (foods + user_foods)
DROP INDEX IF EXISTS public.idx_foods_name_trgm;
DROP INDEX IF EXISTS public.idx_foods_brand_trgm;
DROP INDEX IF EXISTS public.foods_name_trgm_idx;
DROP INDEX IF EXISTS public.foods_brand_trgm_idx;
DROP INDEX IF EXISTS public.user_foods_name_trgm_idx;
DROP INDEX IF EXISTS public.user_foods_brand_trgm_idx;

DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Recreate all GIN indexes
CREATE INDEX IF NOT EXISTS idx_foods_name_trgm       ON public.foods      USING gin (name  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_foods_brand_trgm      ON public.foods      USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS user_foods_name_trgm_idx  ON public.user_foods USING gin (name  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS user_foods_brand_trgm_idx ON public.user_foods USING gin (brand gin_trgm_ops);


-- ── WARN 3: LEAKED PASSWORD PROTECTION DISABLED ───────────────────────────
-- This cannot be fixed with SQL. Enable it in the Supabase Dashboard:
--   Authentication → Sign In / Up → Password Security
--   Toggle ON "Leaked password protection (HaveIBeenPwned.org)"
