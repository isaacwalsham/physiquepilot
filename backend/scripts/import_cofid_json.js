import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import supabase from "../supabaseClient.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INPUT = path.resolve(__dirname, "..", "data", "cofid", "cofid_compiled.json");
const BATCH_SIZE = 500;

const NUTRIENT_DEFS = {
  energy_kcal: { label: "Energy", unit: "kcal", sort_group: "General", sort_order: 100 },
  water_g: { label: "Water", unit: "g", sort_group: "General", sort_order: 110 },
  protein_g: { label: "Protein", unit: "g", sort_group: "Protein", sort_order: 200 },
  fat_g: { label: "Fat", unit: "g", sort_group: "Lipids", sort_order: 300 },
  carbs_g: { label: "Carbohydrate", unit: "g", sort_group: "Carbohydrates", sort_order: 400 },
  starch_g: { label: "Starch", unit: "g", sort_group: "Carbohydrates", sort_order: 410 },
  sugars_g: { label: "Sugars", unit: "g", sort_group: "Carbohydrates", sort_order: 420 },
  sat_fat_g: { label: "Saturated Fat", unit: "g", sort_group: "Lipids", sort_order: 320 },
  monounsaturated_g: { label: "Monounsaturated Fat", unit: "g", sort_group: "Lipids", sort_order: 330 },
  polyunsaturated_g: { label: "Polyunsaturated Fat", unit: "g", sort_group: "Lipids", sort_order: 340 },
  omega3_g: { label: "Omega 3", unit: "g", sort_group: "Lipids", sort_order: 341 },
  omega6_g: { label: "Omega 6", unit: "g", sort_group: "Lipids", sort_order: 342 },
  sodium_mg: { label: "Sodium", unit: "mg", sort_group: "Minerals", sort_order: 500 },
  potassium_mg: { label: "Potassium", unit: "mg", sort_group: "Minerals", sort_order: 510 },
  calcium_mg: { label: "Calcium", unit: "mg", sort_group: "Minerals", sort_order: 520 },
  magnesium_mg: { label: "Magnesium", unit: "mg", sort_group: "Minerals", sort_order: 530 },
  phosphorus_mg: { label: "Phosphorus", unit: "mg", sort_group: "Minerals", sort_order: 540 },
  iron_mg: { label: "Iron", unit: "mg", sort_group: "Minerals", sort_order: 550 },
  copper_mg: { label: "Copper", unit: "mg", sort_group: "Minerals", sort_order: 560 },
  zinc_mg: { label: "Zinc", unit: "mg", sort_group: "Minerals", sort_order: 570 },
  manganese_mg: { label: "Manganese", unit: "mg", sort_group: "Minerals", sort_order: 580 },
  selenium_ug: { label: "Selenium", unit: "ug", sort_group: "Minerals", sort_order: 590 },
  vitamin_a_ug: { label: "Vitamin A", unit: "ug", sort_group: "Vitamins", sort_order: 600 },
  vitamin_d_ug: { label: "Vitamin D", unit: "ug", sort_group: "Vitamins", sort_order: 610 },
  vitamin_e_mg: { label: "Vitamin E", unit: "mg", sort_group: "Vitamins", sort_order: 620 },
  vitamin_k_ug: { label: "Vitamin K", unit: "ug", sort_group: "Vitamins", sort_order: 630 },
  thiamin_b1_mg: { label: "B1", unit: "mg", sort_group: "Vitamins", sort_order: 640 },
  riboflavin_b2_mg: { label: "B2", unit: "mg", sort_group: "Vitamins", sort_order: 650 },
  vitamin_b3_mg: { label: "B3", unit: "mg", sort_group: "Vitamins", sort_order: 660 },
  vitamin_b6_mg: { label: "B6", unit: "mg", sort_group: "Vitamins", sort_order: 670 },
  vitamin_b12_ug: { label: "B12", unit: "ug", sort_group: "Vitamins", sort_order: 680 },
  folate_ug: { label: "B9", unit: "ug", sort_group: "Vitamins", sort_order: 690 }
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fetchExistingCofidFoods = async () => {
  const out = new Map();
  let from = 0;
  const page = 1000;
  while (true) {
    const to = from + page - 1;
    const { data, error } = await supabase
      .from("foods")
      .select("id, barcode")
      .eq("source", "cofid")
      .range(from, to);
    if (error) throw new Error(error.message);
    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const key = String(row?.barcode || "").trim();
      if (key) out.set(key, row.id);
    }
    if (rows.length < page) break;
    from += page;
  }
  return out;
};

const upsertNutrientDefinitions = async () => {
  const rows = Object.entries(NUTRIENT_DEFS).map(([code, def]) => ({
    code,
    label: def.label,
    unit: def.unit,
    sort_group: def.sort_group,
    sort_order: def.sort_order
  }));
  const { error } = await supabase.from("nutrients").upsert(rows, { onConflict: "code" });
  if (error) throw new Error(error.message);
};

const insertMissingFoods = async (foods, existingByBarcode) => {
  const missing = foods
    .filter((f) => !existingByBarcode.has(String(f.barcode)))
    .map((f) => ({
      name: String(f.name || "").trim(),
      brand: null,
      barcode: String(f.barcode || "").trim(),
      locale: "en-gb",
      source: "cofid"
    }))
    .filter((f) => f.name && f.barcode);

  for (const group of chunk(missing, BATCH_SIZE)) {
    if (group.length === 0) continue;
    const { data, error } = await supabase.from("foods").insert(group).select("id, barcode");
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      existingByBarcode.set(String(row.barcode), row.id);
    }
  }
};

const upsertFoodNutrients = async (foods, existingByBarcode) => {
  const rows = [];
  for (const food of foods) {
    const foodId = existingByBarcode.get(String(food.barcode || "").trim());
    if (!foodId) continue;
    for (const [code, value] of Object.entries(food.nutrients || {})) {
      if (!NUTRIENT_DEFS[code]) continue;
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) continue;
      rows.push({
        food_id: foodId,
        nutrient_code: code,
        amount_per_100g: amount
      });
    }
  }

  for (const group of chunk(rows, 1000)) {
    if (group.length === 0) continue;
    const { error } = await supabase
      .from("food_nutrients")
      .upsert(group, { onConflict: "food_id,nutrient_code" });
    if (error) throw new Error(error.message);
  }
  return rows.length;
};

const run = async () => {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`missing ${INPUT}; run extract_cofid.py first`);
  }
  const raw = fs.readFileSync(INPUT, "utf8");
  const parsed = JSON.parse(raw);
  const foods = Array.isArray(parsed?.foods) ? parsed.foods : [];
  if (foods.length === 0) {
    // eslint-disable-next-line no-console
    console.log("no foods in cofid_compiled.json");
    return;
  }

  await upsertNutrientDefinitions();
  const existingByBarcode = await fetchExistingCofidFoods();
  await insertMissingFoods(foods, existingByBarcode);
  const nutrientRows = await upsertFoodNutrients(foods, existingByBarcode);
  // eslint-disable-next-line no-console
  console.log(`CoFID import done: foods=${foods.length}, nutrient_rows_upserted=${nutrientRows}`);
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
