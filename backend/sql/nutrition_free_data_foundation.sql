-- Nutrition free-data foundation (USDA/UK/OFF friendly)
-- Run this in Supabase SQL editor before relying on serving conversions at scale.

create extension if not exists pg_trgm;

-- Ensure alcohol nutrient exists for 7 kcal/g tracking.
insert into public.nutrients(code, label, unit, sort_group, sort_order)
values ('alcohol_g', 'Alcohol', 'g', 'General', 30)
on conflict (code) do update
set label = excluded.label,
    unit = excluded.unit,
    sort_group = excluded.sort_group,
    sort_order = excluded.sort_order;

-- Essential amino acids / protein-related micronutrients.
insert into public.nutrients(code, label, unit, sort_group, sort_order)
values
  ('histidine_g', 'Histidine', 'g', 'Amino acids', 10),
  ('isoleucine_g', 'Isoleucine', 'g', 'Amino acids', 20),
  ('leucine_g', 'Leucine', 'g', 'Amino acids', 30),
  ('lysine_g', 'Lysine', 'g', 'Amino acids', 40),
  ('methionine_cystine_g', 'Methionine + Cystine', 'g', 'Amino acids', 50),
  ('phenylalanine_tyrosine_g', 'Phenylalanine + Tyrosine', 'g', 'Amino acids', 60),
  ('threonine_g', 'Threonine', 'g', 'Amino acids', 70),
  ('tryptophan_g', 'Tryptophan', 'g', 'Amino acids', 80),
  ('valine_g', 'Valine', 'g', 'Amino acids', 90)
on conflict (code) do update
set label = excluded.label,
    unit = excluded.unit,
    sort_group = excluded.sort_group,
    sort_order = excluded.sort_order;

create table if not exists public.nutrition_target_preferences (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  micro_target_mode text not null default 'rdi' check (micro_target_mode in ('rdi', 'bodyweight', 'custom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_nutrient_target_overrides (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  nutrient_code text not null references public.nutrients(code) on delete cascade,
  target_amount numeric not null check (target_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, nutrient_code)
);

drop trigger if exists trg_nutrition_target_preferences_updated_at on public.nutrition_target_preferences;
create trigger trg_nutrition_target_preferences_updated_at
before update on public.nutrition_target_preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_nutrient_target_overrides_updated_at on public.user_nutrient_target_overrides;
create trigger trg_user_nutrient_target_overrides_updated_at
before update on public.user_nutrient_target_overrides
for each row execute function public.set_updated_at();

-- Deterministic unit -> gram conversions for global foods.
create table if not exists public.food_unit_conversions (
  food_id uuid not null references public.foods(id) on delete cascade,
  unit text not null,
  grams_per_unit numeric not null check (grams_per_unit > 0),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (food_id, unit)
);

-- Deterministic unit -> gram conversions for user-created foods.
create table if not exists public.user_food_unit_conversions (
  user_food_id uuid not null references public.user_foods(id) on delete cascade,
  unit text not null,
  grams_per_unit numeric not null check (grams_per_unit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_food_id, unit)
);

create index if not exists idx_foods_name_trgm on public.foods using gin (name gin_trgm_ops);
create index if not exists idx_foods_brand_trgm on public.foods using gin (brand gin_trgm_ops);
create index if not exists idx_foods_locale on public.foods(locale);
create index if not exists idx_foods_source on public.foods(source);

create index if not exists idx_food_nutrients_code_food on public.food_nutrients(nutrient_code, food_id);
create index if not exists idx_user_food_nutrients_code_food on public.user_food_nutrients(nutrient_code, user_food_id);

create index if not exists idx_daily_items_user_date on public.daily_nutrition_items(user_id, log_date);
create index if not exists idx_daily_item_nutrients_item on public.daily_nutrition_item_nutrients(item_id);

-- Optional: keep updated_at fresh on writes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_food_unit_conversions_updated_at on public.food_unit_conversions;
create trigger trg_food_unit_conversions_updated_at
before update on public.food_unit_conversions
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_food_unit_conversions_updated_at on public.user_food_unit_conversions;
create trigger trg_user_food_unit_conversions_updated_at
before update on public.user_food_unit_conversions
for each row execute function public.set_updated_at();

-- Optional seed example conversions.
-- insert into public.food_unit_conversions(food_id, unit, grams_per_unit, source)
-- values ('<food_uuid>', 'serv', 100, 'usda_portion')
-- on conflict (food_id, unit) do update set grams_per_unit = excluded.grams_per_unit, source = excluded.source;
