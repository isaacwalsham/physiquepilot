-- Nutrition meal plan table + profile columns for meal plan preferences
-- Run in Supabase SQL editor

-- Add meal plan preference columns to profiles
alter table public.profiles
  add column if not exists meals_per_day integer default 4 check (meals_per_day between 2 and 8),
  add column if not exists training_time_hour integer default 17 check (training_time_hour between 0 and 23);

-- 7-day AI-generated meal plans (one per user per week)
create table if not exists public.nutrition_meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  week_start date not null,
  plan_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, week_start)
);

create index if not exists idx_nutrition_meal_plans_user_week
  on public.nutrition_meal_plans(user_id, week_start desc);

-- RLS
alter table public.nutrition_meal_plans enable row level security;

drop policy if exists "Users can manage their own meal plans" on public.nutrition_meal_plans;
create policy "Users can manage their own meal plans"
  on public.nutrition_meal_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Updated_at trigger
drop trigger if exists trg_nutrition_meal_plans_updated_at on public.nutrition_meal_plans;
create trigger trg_nutrition_meal_plans_updated_at
  before update on public.nutrition_meal_plans
  for each row execute function public.set_updated_at();
