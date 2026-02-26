-- Full micronutrient repair / normalization for all entries
-- Purpose:
-- 1) Ensure canonical nutrient catalog exists (your chosen panel fields)
-- 2) Map USDA raw nutrient codes (usda_####) into canonical codes
-- 3) Backfill missing amino acids from protein where absent
-- 4) Rebuild daily item micronutrient rows for all historical DB-source logs
--
-- Safe to run multiple times.

begin;

-- Canonical nutrient list used by the app panel.
create temp table tmp_nutrient_defs (
  code text primary key,
  label text not null,
  unit text not null,
  sort_group text not null,
  sort_order int not null
) on commit drop;

insert into tmp_nutrient_defs(code, label, unit, sort_group, sort_order) values
  -- General
  ('energy_kcal', 'Energy', 'kcal', 'General', 10),
  ('alcohol_g', 'Alcohol', 'g', 'General', 20),
  ('caffeine_mg', 'Caffeine', 'mg', 'General', 30),
  ('water_g', 'Water', 'g', 'General', 40),

  -- Carbohydrates
  ('carbs_g', 'Total Carbs', 'g', 'Carbohydrates', 10),
  ('fiber_g', 'Fibre', 'g', 'Carbohydrates', 20),
  ('starch_g', 'Starch', 'g', 'Carbohydrates', 30),
  ('sugars_g', 'Sugars', 'g', 'Carbohydrates', 40),
  ('added_sugars_g', 'Added Sugars', 'g', 'Carbohydrates', 50),
  ('net_carbs_g', 'Net Carbs', 'g', 'Carbohydrates', 60),

  -- Lipids
  ('fat_g', 'Fat', 'g', 'Lipids', 10),
  ('monounsaturated_g', 'Monounsaturated Fat', 'g', 'Lipids', 20),
  ('polyunsaturated_g', 'Polyunsaturated Fat', 'g', 'Lipids', 30),
  ('omega3_g', 'Omega 3', 'g', 'Lipids', 40),
  ('omega6_g', 'Omega 6', 'g', 'Lipids', 50),
  ('sat_fat_g', 'Saturated Fat', 'g', 'Lipids', 60),
  ('trans_fat_g', 'Trans Fat', 'g', 'Lipids', 70),
  ('cholesterol_mg', 'Cholesterol', 'mg', 'Lipids', 80),

  -- Protein / amino acids
  ('protein_g', 'Protein', 'g', 'Protein', 10),
  ('cystine_g', 'Cystine', 'g', 'Protein', 20),
  ('histidine_g', 'Histidine', 'g', 'Protein', 30),
  ('isoleucine_g', 'Isoleucine', 'g', 'Protein', 40),
  ('leucine_g', 'Leucine', 'g', 'Protein', 50),
  ('lysine_g', 'Lysine', 'g', 'Protein', 60),
  ('methionine_g', 'Methionine', 'g', 'Protein', 70),
  ('phenylalanine_g', 'Phenylalanine', 'g', 'Protein', 80),
  ('threonine_g', 'Threonine', 'g', 'Protein', 90),
  ('tryptophan_g', 'Tryptophan', 'g', 'Protein', 100),
  ('tyrosine_g', 'Tyrosine', 'g', 'Protein', 110),
  ('valine_g', 'Valine', 'g', 'Protein', 120),

  -- Vitamins
  ('thiamin_b1_mg', 'B1 (Thiamine)', 'mg', 'Vitamins', 10),
  ('riboflavin_b2_mg', 'B2 (Riboflavin)', 'mg', 'Vitamins', 20),
  ('vitamin_b3_mg', 'B3 (Niacin)', 'mg', 'Vitamins', 30),
  ('pantothenic_b5_mg', 'B5 (Pantothenic Acid)', 'mg', 'Vitamins', 40),
  ('vitamin_b6_mg', 'B6 (Pyridoxine)', 'mg', 'Vitamins', 50),
  ('vitamin_b12_ug', 'B12 (Cobalamin)', 'ug', 'Vitamins', 60),
  ('folate_ug', 'Folate', 'ug', 'Vitamins', 70),
  ('vitamin_a_ug', 'Vitamin A', 'ug', 'Vitamins', 80),
  ('vitamin_c_mg', 'Vitamin C', 'mg', 'Vitamins', 90),
  ('vitamin_d_ug', 'Vitamin D', 'ug', 'Vitamins', 100),
  ('vitamin_e_mg', 'Vitamin E', 'mg', 'Vitamins', 110),
  ('vitamin_k_ug', 'Vitamin K', 'ug', 'Vitamins', 120),

  -- Minerals
  ('calcium_mg', 'Calcium', 'mg', 'Minerals', 10),
  ('copper_mg', 'Copper', 'mg', 'Minerals', 20),
  ('iron_mg', 'Iron', 'mg', 'Minerals', 30),
  ('magnesium_mg', 'Magnesium', 'mg', 'Minerals', 40),
  ('manganese_mg', 'Manganese', 'mg', 'Minerals', 50),
  ('phosphorus_mg', 'Phosphorus', 'mg', 'Minerals', 60),
  ('potassium_mg', 'Potassium', 'mg', 'Minerals', 70),
  ('selenium_ug', 'Selenium', 'ug', 'Minerals', 80),
  ('sodium_mg', 'Sodium', 'mg', 'Minerals', 90),
  ('zinc_mg', 'Zinc', 'mg', 'Minerals', 100);

insert into public.nutrients(code, label, unit, sort_group, sort_order)
select code, label, unit, sort_group, sort_order
from tmp_nutrient_defs
on conflict (code) do update
set label = excluded.label,
    unit = excluded.unit,
    sort_group = excluded.sort_group,
    sort_order = excluded.sort_order;

create temp table tmp_usda_map (
  source_code text not null,
  target_code text not null
) on commit drop;

insert into tmp_usda_map(source_code, target_code) values
  ('usda_1008','energy_kcal'),
  ('usda_221','alcohol_g'),
  ('usda_262','caffeine_mg'),
  ('usda_1051','water_g'),
  ('usda_1005','carbs_g'),
  ('usda_1079','fiber_g'),
  ('usda_2092','starch_g'),
  ('usda_2000','sugars_g'),
  ('usda_1235','added_sugars_g'),
  ('usda_1004','fat_g'),
  ('usda_645','monounsaturated_g'),
  ('usda_646','polyunsaturated_g'),
  ('usda_1258','sat_fat_g'),
  ('usda_1257','trans_fat_g'),
  ('usda_1253','cholesterol_mg'),
  ('usda_1003','protein_g'),
  ('usda_1227','cystine_g'),
  ('usda_1221','histidine_g'),
  ('usda_1222','isoleucine_g'),
  ('usda_1223','leucine_g'),
  ('usda_1224','lysine_g'),
  ('usda_1225','methionine_g'),
  ('usda_1226','phenylalanine_g'),
  ('usda_1228','threonine_g'),
  ('usda_1220','tryptophan_g'),
  ('usda_1232','tyrosine_g'),
  ('usda_1233','valine_g'),
  ('usda_1165','thiamin_b1_mg'),
  ('usda_1166','riboflavin_b2_mg'),
  ('usda_1167','vitamin_b3_mg'),
  ('usda_1170','pantothenic_b5_mg'),
  ('usda_1175','vitamin_b6_mg'),
  ('usda_1178','vitamin_b12_ug'),
  ('usda_1177','folate_ug'),
  ('usda_1106','vitamin_a_ug'),
  ('usda_1162','vitamin_c_mg'),
  ('usda_1110','vitamin_d_ug'),
  ('usda_1109','vitamin_e_mg'),
  ('usda_1185','vitamin_k_ug'),
  ('usda_1087','calcium_mg'),
  ('usda_1088','copper_mg'),
  ('usda_1089','iron_mg'),
  ('usda_1090','magnesium_mg'),
  ('usda_1098','manganese_mg'),
  ('usda_1091','phosphorus_mg'),
  ('usda_1092','potassium_mg'),
  ('usda_1103','selenium_ug'),
  ('usda_1093','sodium_mg'),
  ('usda_1095','zinc_mg');

-- Copy mapped USDA codes into canonical food_nutrients.
insert into public.food_nutrients(food_id, nutrient_code, amount_per_100g)
select fn.food_id, m.target_code, fn.amount_per_100g
from public.food_nutrients fn
join tmp_usda_map m on m.source_code = fn.nutrient_code
on conflict (food_id, nutrient_code) do update
set amount_per_100g = excluded.amount_per_100g;

-- Same mapping for user_food_nutrients when present.
insert into public.user_food_nutrients(user_food_id, nutrient_code, amount_per_100g)
select ufn.user_food_id, m.target_code, ufn.amount_per_100g
from public.user_food_nutrients ufn
join tmp_usda_map m on m.source_code = ufn.nutrient_code
on conflict (user_food_id, nutrient_code) do update
set amount_per_100g = excluded.amount_per_100g;

-- Derive net carbs (carbs - fiber), clipped at 0.
insert into public.food_nutrients(food_id, nutrient_code, amount_per_100g)
select c.food_id, 'net_carbs_g', greatest(0, c.amount_per_100g - coalesce(f.amount_per_100g, 0))
from public.food_nutrients c
left join public.food_nutrients f
  on f.food_id = c.food_id and f.nutrient_code = 'fiber_g'
where c.nutrient_code = 'carbs_g'
on conflict (food_id, nutrient_code) do update
set amount_per_100g = excluded.amount_per_100g;

insert into public.user_food_nutrients(user_food_id, nutrient_code, amount_per_100g)
select c.user_food_id, 'net_carbs_g', greatest(0, c.amount_per_100g - coalesce(f.amount_per_100g, 0))
from public.user_food_nutrients c
left join public.user_food_nutrients f
  on f.user_food_id = c.user_food_id and f.nutrient_code = 'fiber_g'
where c.nutrient_code = 'carbs_g'
on conflict (user_food_id, nutrient_code) do update
set amount_per_100g = excluded.amount_per_100g;

-- Derive omega-3 and omega-6 from fatty acids where explicit total omega rows are missing.
insert into public.food_nutrients(food_id, nutrient_code, amount_per_100g)
select food_id, 'omega3_g', sum(amount_per_100g)
from public.food_nutrients
where nutrient_code in ('usda_1270','usda_1271','usda_1278','usda_1279','usda_1280')
group by food_id
on conflict (food_id, nutrient_code) do update
set amount_per_100g = excluded.amount_per_100g;

insert into public.food_nutrients(food_id, nutrient_code, amount_per_100g)
select food_id, 'omega6_g', sum(amount_per_100g)
from public.food_nutrients
where nutrient_code in ('usda_1269','usda_1272','usda_1273','usda_1274')
group by food_id
on conflict (food_id, nutrient_code) do update
set amount_per_100g = excluded.amount_per_100g;

insert into public.user_food_nutrients(user_food_id, nutrient_code, amount_per_100g)
select user_food_id, 'omega3_g', sum(amount_per_100g)
from public.user_food_nutrients
where nutrient_code in ('usda_1270','usda_1271','usda_1278','usda_1279','usda_1280')
group by user_food_id
on conflict (user_food_id, nutrient_code) do update
set amount_per_100g = excluded.amount_per_100g;

insert into public.user_food_nutrients(user_food_id, nutrient_code, amount_per_100g)
select user_food_id, 'omega6_g', sum(amount_per_100g)
from public.user_food_nutrients
where nutrient_code in ('usda_1269','usda_1272','usda_1273','usda_1274')
group by user_food_id
on conflict (user_food_id, nutrient_code) do update
set amount_per_100g = excluded.amount_per_100g;

-- Backfill missing amino acids from protein if absent (approximation).
create temp table tmp_aa_factor(code text primary key, factor numeric not null) on commit drop;
insert into tmp_aa_factor(code, factor) values
  ('histidine_g', 0.030),
  ('isoleucine_g', 0.060),
  ('leucine_g', 0.120),
  ('lysine_g', 0.105),
  ('methionine_g', 0.022),
  ('cystine_g', 0.012),
  ('phenylalanine_g', 0.055),
  ('tyrosine_g', 0.045),
  ('threonine_g', 0.051),
  ('tryptophan_g', 0.013),
  ('valine_g', 0.067);

insert into public.food_nutrients(food_id, nutrient_code, amount_per_100g)
select p.food_id, aa.code, round((p.amount_per_100g * aa.factor)::numeric, 6)
from public.food_nutrients p
join tmp_aa_factor aa on true
left join public.food_nutrients ex
  on ex.food_id = p.food_id and ex.nutrient_code = aa.code
where p.nutrient_code = 'protein_g'
  and ex.food_id is null
on conflict (food_id, nutrient_code) do nothing;

insert into public.user_food_nutrients(user_food_id, nutrient_code, amount_per_100g)
select p.user_food_id, aa.code, round((p.amount_per_100g * aa.factor)::numeric, 6)
from public.user_food_nutrients p
join tmp_aa_factor aa on true
left join public.user_food_nutrients ex
  on ex.user_food_id = p.user_food_id and ex.nutrient_code = aa.code
where p.nutrient_code = 'protein_g'
  and ex.user_food_id is null
on conflict (user_food_id, nutrient_code) do nothing;

-- Rebuild historical daily item nutrient rows for DB-source items only.
delete from public.daily_nutrition_item_nutrients din
using public.daily_nutrition_items di
where din.item_id = di.id
  and di.source = 'db';

with db_items as (
  select
    di.id as item_id,
    di.food_id,
    di.user_food_id,
    coalesce(
      di.grams,
      case di.unit
        when 'g' then di.amount
        when 'kg' then di.amount * 1000
        when 'ml' then di.amount
        when 'l' then di.amount * 1000
        when 'oz' then di.amount * 28.349523125
        when 'lb' then di.amount * 453.59237
        else null
      end
    ) as grams_resolved
  from public.daily_nutrition_items di
  where di.source = 'db'
),
joined as (
  select
    d.item_id,
    fn.nutrient_code,
    (fn.amount_per_100g * d.grams_resolved / 100.0) as amount
  from db_items d
  join public.food_nutrients fn on fn.food_id = d.food_id
  where d.food_id is not null
    and d.grams_resolved is not null
    and d.grams_resolved > 0

  union all

  select
    d.item_id,
    ufn.nutrient_code,
    (ufn.amount_per_100g * d.grams_resolved / 100.0) as amount
  from db_items d
  join public.user_food_nutrients ufn on ufn.user_food_id = d.user_food_id
  where d.user_food_id is not null
    and d.grams_resolved is not null
    and d.grams_resolved > 0
)
insert into public.daily_nutrition_item_nutrients(item_id, nutrient_code, amount)
select
  j.item_id,
  j.nutrient_code,
  round(j.amount::numeric, 6)
from joined j
join tmp_nutrient_defs nd on nd.code = j.nutrient_code
on conflict (item_id, nutrient_code) do update
set amount = excluded.amount;

commit;
