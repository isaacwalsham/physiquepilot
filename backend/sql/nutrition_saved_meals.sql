-- Saved meals and meal-structure presets for nutrition logging.
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.nutrition_meal_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_meal_preset_segments (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.nutrition_meal_presets(id) on delete cascade,
  segment_key text not null,
  label text not null,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (preset_id, segment_key)
);

create table if not exists public.nutrition_saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  name text not null,
  preset_id uuid null references public.nutrition_meal_presets(id) on delete set null,
  segment_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references public.nutrition_saved_meals(id) on delete cascade,
  position integer not null default 1,
  food_name text not null,
  amount numeric not null check (amount > 0),
  unit text not null,
  cooked_state text not null,
  food_id uuid null references public.foods(id) on delete set null,
  user_food_id uuid null references public.user_foods(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nutrition_meal_presets_user on public.nutrition_meal_presets(user_id);
create index if not exists idx_nutrition_meal_preset_segments_preset on public.nutrition_meal_preset_segments(preset_id, position);
create index if not exists idx_nutrition_saved_meals_user on public.nutrition_saved_meals(user_id, updated_at desc);
create index if not exists idx_nutrition_saved_meal_items_meal on public.nutrition_saved_meal_items(saved_meal_id, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nutrition_meal_presets_updated_at on public.nutrition_meal_presets;
create trigger trg_nutrition_meal_presets_updated_at
before update on public.nutrition_meal_presets
for each row execute function public.set_updated_at();

drop trigger if exists trg_nutrition_meal_preset_segments_updated_at on public.nutrition_meal_preset_segments;
create trigger trg_nutrition_meal_preset_segments_updated_at
before update on public.nutrition_meal_preset_segments
for each row execute function public.set_updated_at();

drop trigger if exists trg_nutrition_saved_meals_updated_at on public.nutrition_saved_meals;
create trigger trg_nutrition_saved_meals_updated_at
before update on public.nutrition_saved_meals
for each row execute function public.set_updated_at();

drop trigger if exists trg_nutrition_saved_meal_items_updated_at on public.nutrition_saved_meal_items;
create trigger trg_nutrition_saved_meal_items_updated_at
before update on public.nutrition_saved_meal_items
for each row execute function public.set_updated_at();
