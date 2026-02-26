import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import supabase from "./supabaseClient.js";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { LRUCache } from "lru-cache";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const USDA_API_KEY = String(process.env.USDA_API_KEY || "").trim();

const nutritionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const parseCache = new LRUCache({ max: 500, ttl: 1000 * 60 * 60 });

const hashPayload = (items, notes) => {
  const s = JSON.stringify({ items, notes: notes || "" });
  return crypto.createHash("sha256").update(s).digest("hex");
};

const assertEnv = (cond, msg) => {
  if (!cond) {
    const err = new Error(msg);
    err.statusCode = 500;
    throw err;
  }
};

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://physiquepilot.com",
  "https://www.physiquepilot.com",
  /\.netlify\.app$/
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowed = allowedOrigins.some(o =>
      typeof o === "string" ? o === origin : o.test(origin)
    );

    if (allowed) return callback(null, true);

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.options(/.*/, cors());


app.use(express.json());

const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

const normalizeUnit = (unit) => String(unit || "").trim().toLowerCase();

const qtyToGrams = ({ qty, unit }) => {
  const q = toNum(qty);
  const u = normalizeUnit(unit);
  if (!Number.isFinite(q) || q <= 0) return null;

  if (u === "g") return q;
  if (u === "kg") return q * 1000;
  if (u === "oz") return q * 28.349523125;
  if (u === "lb") return q * 453.59237;
  if (u === "ml") return q;
  if (u === "l") return q * 1000;

  return null;
};

const scalePer100g = (amountPer100g, grams) => {
  const g = toNum(grams);
  if (!Number.isFinite(g) || g <= 0) return 0;
  return (toNum(amountPer100g) * g) / 100;
};

const isoDate = (d = new Date()) => {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const normalizeMode = (x) => {
  const v = String(x || "").trim().toLowerCase();
  if (v === "bodyweight") return "bodyweight";
  if (v === "custom") return "custom";
  return "rdi";
};

const ageFromDob = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
};

const rdiBaseByCode = {
  energy_kcal: { any: 2000 },
  water_g: { male: 3700, female: 2700, any: 3200 },
  caffeine_mg: { male: 400, female: 400, any: 400 },
  carbs_g: { male: 130, female: 130, any: 130 },
  fiber_g: { male: 38, female: 25, any: 31.5 },
  added_sugars_g: { male: 50, female: 50, any: 50 },
  fat_g: { male: null, female: null, any: null },
  monounsaturated_g: { male: null, female: null, any: null },
  monounsaturated_fat_g: { male: null, female: null, any: null },
  polyunsaturated_g: { male: null, female: null, any: null },
  polyunsaturated_fat_g: { male: null, female: null, any: null },
  omega3_g: { male: 1.6, female: 1.1, any: 1.35 },
  omega_3_g: { male: 1.6, female: 1.1, any: 1.35 },
  omega6_g: { male: 17, female: 12, any: 14.5 },
  omega_6_g: { male: 17, female: 12, any: 14.5 },
  sat_fat_g: { male: 20, female: 20, any: 20 },
  saturated_fat_g: { male: 20, female: 20, any: 20 },
  trans_fat_g: { male: 0, female: 0, any: 0 },
  cholesterol_mg: { male: 300, female: 300, any: 300 },
  protein_g: { male: 56, female: 46, any: 51 },
  cystine_g: { male: 0.525, female: 0.45, any: 0.4875 },
  histidine_g: { male: 0.7, female: 0.6, any: 0.65 },
  isoleucine_g: { male: 1.4, female: 1.2, any: 1.3 },
  leucine_g: { male: 2.73, female: 2.34, any: 2.535 },
  lysine_g: { male: 2.1, female: 1.8, any: 1.95 },
  methionine_g: { male: 0.525, female: 0.45, any: 0.4875 },
  phenylalanine_g: { male: 0.875, female: 0.75, any: 0.8125 },
  threonine_g: { male: 1.05, female: 0.9, any: 0.975 },
  tryptophan_g: { male: 0.28, female: 0.24, any: 0.26 },
  tyrosine_g: { male: 0.875, female: 0.75, any: 0.8125 },
  valine_g: { male: 1.82, female: 1.56, any: 1.69 },
  thiamin_b1_mg: { male: 1.2, female: 1.1, any: 1.15 },
  riboflavin_b2_mg: { male: 1.3, female: 1.1, any: 1.2 },
  vitamin_b3_mg: { male: 16, female: 14, any: 15 },
  pantothenic_b5_mg: { male: 5, female: 5, any: 5 },
  vitamin_b6_mg: { male: 1.3, female: 1.3, any: 1.3 },
  vitamin_b12_ug: { male: 2.4, female: 2.4, any: 2.4 },
  folate_ug: { male: 400, female: 400, any: 400 },
  vitamin_a_ug: { male: 900, female: 700, any: 800 },
  vitamin_c_mg: { male: 90, female: 75, any: 82.5 },
  vitamin_d_ug: { male: 15, female: 15, any: 15 }, // 600 IU
  vitamin_d_iu: { male: 600, female: 600, any: 600 },
  vitamin_e_mg: { male: 15, female: 15, any: 15 },
  vitamin_k_ug: { male: 120, female: 90, any: 105 },
  calcium_mg: { male: 1000, female: 1000, any: 1000 },
  copper_mg: { male: 0.9, female: 0.9, any: 0.9 },
  iron_mg: { male: 8, female: 18, any: 13 },
  magnesium_mg: { male: 400, female: 310, any: 355 },
  manganese_mg: { male: 2.3, female: 1.8, any: 2.05 },
  phosphorus_mg: { male: 700, female: 700, any: 700 },
  potassium_mg: { male: 3400, female: 2600, any: 3000 },
  selenium_ug: { male: 55, female: 55, any: 55 },
  sodium_mg: { male: 1500, female: 1500, any: 1500 },
  salt_g: { male: 3.75, female: 3.75, any: 3.75 },
  zinc_mg: { male: 11, female: 8, any: 9.5 },
  vitamin_b1_mg: { male: 1.2, female: 1.1, any: 1.15 },
  vitamin_b2_mg: { male: 1.3, female: 1.1, any: 1.2 },
  vitamin_b5_mg: { male: 5, female: 5, any: 5 },
  alcohol_g: { any: 0 }
};

const bodyweightCoeffByCode = {
  energy_kcal: 33,
  protein_g: 1.6,
  fat_g: 0.8,
  carbs_g: 3.0,
  fiber_g: 0.4,
  sodium_mg: 35,
  salt_g: 0.09,
  potassium_mg: 45,
  phosphorus_mg: 10,
  magnesium_mg: 5,
  iron_mg: 0.12,
  zinc_mg: 0.12,
  vitamin_b3_mg: 0.22,
  vitamin_b6_mg: 0.02,
  vitamin_b12_ug: 0.04
  ,
  histidine_g: 0.01,
  isoleucine_g: 0.02,
  leucine_g: 0.042,
  lysine_g: 0.03,
  methionine_cystine_g: 0.015,
  phenylalanine_tyrosine_g: 0.025,
  threonine_g: 0.015,
  tryptophan_g: 0.004,
  valine_g: 0.026
};

const resolveSexKey = (sex) => {
  const s = String(sex || "").trim().toLowerCase();
  if (s === "male") return "male";
  if (s === "female") return "female";
  return "any";
};

const computeRdiTarget = ({ code, sex }) => {
  const row = rdiBaseByCode[code];
  if (!row) return null;
  const sx = resolveSexKey(sex);
  const raw = row[sx] ?? row.any ?? null;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const computeBodyweightTarget = ({ code, sex, weightKg }) => {
  const coeff = toNum(bodyweightCoeffByCode[code]);
  const w = toNum(weightKg);
  if (coeff > 0 && w > 0) return coeff * w;
  const base = computeRdiTarget({ code, sex });
  if (!base) return null;
  if (w <= 0) return base;
  const scaled = base * (w / 70);
  return Math.max(base * 0.6, Math.min(base * 1.8, scaled));
};

const normalizeItemsForPrompt = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      food: String(it?.food || "").trim(),
      qty: Number(it?.qty),
      unit: String(it?.unit || "").trim().toLowerCase(),
      state: String(it?.state || "").trim().toLowerCase()
    }))
    .filter((it) => it.food && Number.isFinite(it.qty) && it.qty > 0 && it.unit);
};

const parseNutritionWithAI = async ({ items, notes }) => {
  assertEnv(OPENAI_API_KEY, "Missing OPENAI_API_KEY in backend environment");

  const safeItems = normalizeItemsForPrompt(items);
  if (safeItems.length === 0) {
    return {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fats_g: 0,
      warnings: ["No valid items provided."],
      items: []
    };
  }

  const cacheKey = hashPayload(safeItems, notes);
  const cached = parseCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      warnings: [...(cached.warnings || []), "Used cached estimate."]
    };
  }

  const schema = {
    name: "nutrition_parse",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        calories: { type: "number", minimum: 0 },
        protein_g: { type: "number", minimum: 0 },
        carbs_g: { type: "number", minimum: 0 },
        fats_g: { type: "number", minimum: 0 },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              food: { type: "string" },
              qty: { type: "number" },
              unit: { type: "string" },
              state: { type: "string" },
              calories: { type: "number", minimum: 0 },
              protein_g: { type: "number", minimum: 0 },
              carbs_g: { type: "number", minimum: 0 },
              fats_g: { type: "number", minimum: 0 }
            },
            required: ["food", "qty", "unit", "state", "calories", "protein_g", "carbs_g", "fats_g"]
          }
        },
        warnings: { type: "array", items: { type: "string" } }
      },
      required: ["calories", "protein_g", "carbs_g", "fats_g", "items", "warnings"]
    }
  };

  const prompt = [
    "You are a nutrition estimation assistant.",
    "Given a list of foods with amounts and units, estimate calories and macros.",
    "Rules:",
    "- If a unit is kg or lb, convert to grams (assume 1kg=1000g, 1lb=453.592g).",
    "- If a unit is ml or l, treat as volume; assume water-like density unless the food implies otherwise.",
    "- If a unit is 'serv', assume a typical serving for that item and note a warning.",
    "- Respect raw vs cooked if it materially changes weight (e.g., rice/pasta).",
    "- Return best-effort estimates. Add warnings when you had to assume serving sizes or density.",
    "\nItems:",
    JSON.stringify(safeItems, null, 2),
    notes ? `\nNotes: ${String(notes).slice(0, 500)}` : ""
  ].join("\n");

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: "You are a nutrition estimation assistant." },
        { role: "user", content: prompt }
      ],
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          schema: schema.schema,
          strict: true
        }
      }
    })
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`OpenAI request failed (${r.status}): ${txt || r.statusText}`);
  }

  const j = await r.json();

  const first = j?.output?.[0]?.content?.[0];

  if (j?.status === "incomplete") {
    throw new Error(
      `OpenAI incomplete response${j?.incomplete_details?.reason ? ` (${j.incomplete_details.reason})` : ""}.`
    );
  }

  if (!first) {
    throw new Error("OpenAI returned no content.");
  }

  if (first.type === "refusal") {
    throw new Error(first.refusal || "OpenAI refused to answer.");
  }

  if (first.type !== "output_text" || !first.text) {
    throw new Error("OpenAI returned an unexpected content type.");
  }

  const parsed = JSON.parse(first.text);

  const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const toInt = (x) => Math.round(toNum(x));

  const cleanItems = (Array.isArray(parsed.items) ? parsed.items : []).map((it) => ({
    food: String(it?.food ?? ""),
    qty: toNum(it?.qty),
    unit: String(it?.unit ?? ""),
    state: String(it?.state ?? ""),
    calories: Math.max(0, toInt(it?.calories)),
    protein_g: Math.max(0, toInt(it?.protein_g)),
    carbs_g: Math.max(0, toInt(it?.carbs_g)),
    fats_g: Math.max(0, toInt(it?.fats_g))
  }));

  const result = {
    calories: Math.max(0, toInt(parsed.calories)),
    protein_g: Math.max(0, toInt(parsed.protein_g)),
    carbs_g: Math.max(0, toInt(parsed.carbs_g)),
    fats_g: Math.max(0, toInt(parsed.fats_g)),
    items: cleanItems,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : []
  };

  parseCache.set(cacheKey, result);
  return result;
};

let foodUnitConversionTableAvailable = true;
let userFoodUnitConversionTableAvailable = true;

const maybeDisableUnitConversionTable = (table, error) => {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  const missing =
    msg.includes("Could not find the table") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    code === "PGRST205" ||
    code === "42P01";

  if (!missing) return;
  if (table === "food_unit_conversions") foodUnitConversionTableAvailable = false;
  if (table === "user_food_unit_conversions") userFoodUnitConversionTableAvailable = false;
};

const fetchUnitConversionGrams = async ({ food_id, user_food_id, unit, conversionCache }) => {
  const u = normalizeUnit(unit);
  if (!u) return null;

  const key = food_id ? `food:${food_id}:${u}` : user_food_id ? `user_food:${user_food_id}:${u}` : null;
  if (!key) return null;
  if (conversionCache.has(key)) return conversionCache.get(key);

  if (food_id && foodUnitConversionTableAvailable) {
    const { data, error } = await supabase
      .from("food_unit_conversions")
      .select("grams_per_unit")
      .eq("food_id", food_id)
      .eq("unit", u)
      .maybeSingle();
    if (error) {
      maybeDisableUnitConversionTable("food_unit_conversions", error);
    } else {
      const gramsPerUnit = toNum(data?.grams_per_unit);
      const val = gramsPerUnit > 0 ? gramsPerUnit : null;
      conversionCache.set(key, val);
      return val;
    }
  }

  if (user_food_id && userFoodUnitConversionTableAvailable) {
    const { data, error } = await supabase
      .from("user_food_unit_conversions")
      .select("grams_per_unit")
      .eq("user_food_id", user_food_id)
      .eq("unit", u)
      .maybeSingle();
    if (error) {
      maybeDisableUnitConversionTable("user_food_unit_conversions", error);
    } else {
      const gramsPerUnit = toNum(data?.grams_per_unit);
      const val = gramsPerUnit > 0 ? gramsPerUnit : null;
      conversionCache.set(key, val);
      return val;
    }
  }

  conversionCache.set(key, null);
  return null;
};

const resolveItemGrams = async ({ item, conversionCache }) => {
  const direct = qtyToGrams({ qty: item.amount, unit: item.unit });
  if (direct != null) return direct;

  if (!(item.food_id || item.user_food_id)) return null;
  const gramsPerUnit = await fetchUnitConversionGrams({
    food_id: item.food_id,
    user_food_id: item.user_food_id,
    unit: item.unit,
    conversionCache
  });
  if (gramsPerUnit == null) return null;
  return gramsPerUnit * toNum(item.amount);
};

const MACRO_FROM_NUTRIENT_CODE = {
  energy_kcal: "calories",
  protein_g: "protein_g",
  carbs_g: "carbs_g",
  fat_g: "fats_g",
  alcohol_g: "alcohol_g"
};
const MACRO_NUTRIENT_CODES = new Set(Object.keys(MACRO_FROM_NUTRIENT_CODE));
const KEY_NUTRIENT_CODES = [
  "energy_kcal",
  "protein_g",
  "fat_g",
  "carbs_g",
  "fiber_g",
  "starch_g",
  "sugars_g",
  "added_sugars_g",
  "net_carbs_g",
  "monounsaturated_g",
  "polyunsaturated_g",
  "omega3_g",
  "omega6_g",
  "sat_fat_g",
  "trans_fat_g",
  "cholesterol_mg",
  "caffeine_mg",
  "water_g",
  "sodium_mg",
  "calcium_mg",
  "copper_mg",
  "potassium_mg",
  "phosphorus_mg",
  "magnesium_mg",
  "iron_mg",
  "manganese_mg",
  "selenium_ug",
  "zinc_mg",
  "thiamin_b1_mg",
  "riboflavin_b2_mg",
  "vitamin_b3_mg",
  "pantothenic_b5_mg",
  "vitamin_b6_mg",
  "vitamin_b12_ug",
  "folate_ug",
  "vitamin_a_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "cystine_g",
  "histidine_g",
  "isoleucine_g",
  "leucine_g",
  "lysine_g",
  "methionine_g",
  "phenylalanine_g",
  "threonine_g",
  "tryptophan_g",
  "tyrosine_g",
  "valine_g",
  "alcohol_g"
];

const ALLOWED_TRACKED_NUTRIENT_CODES = new Set([
  "energy_kcal", "alcohol_g", "caffeine_mg", "water_g",
  "carbs_g", "fiber_g", "starch_g", "sugars_g", "added_sugars_g", "net_carbs_g",
  "fat_g", "monounsaturated_g", "polyunsaturated_g", "omega3_g", "omega6_g", "sat_fat_g", "trans_fat_g", "cholesterol_mg",
  "protein_g", "cystine_g", "histidine_g", "isoleucine_g", "leucine_g", "lysine_g", "methionine_g", "phenylalanine_g", "threonine_g", "tryptophan_g", "tyrosine_g", "valine_g",
  "thiamin_b1_mg", "riboflavin_b2_mg", "vitamin_b3_mg", "pantothenic_b5_mg", "vitamin_b6_mg", "vitamin_b12_ug", "folate_ug", "vitamin_a_ug", "vitamin_c_mg", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug",
  "calcium_mg", "copper_mg", "iron_mg", "magnesium_mg", "manganese_mg", "phosphorus_mg", "potassium_mg", "selenium_ug", "sodium_mg", "zinc_mg"
]);

const normalizeText = (x) =>
  String(x || "")
    .trim()
    .toLowerCase();

const slugCode = (x) =>
  String(x || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const canonicalCodeFromUsdaNutrient = ({ nutrientNumber, nutrientName, unitName }) => {
  const number = String(nutrientNumber || "").trim();
  const name = normalizeText(nutrientName);
  const unit = normalizeText(unitName);

  if (number === "1008" || (name.includes("energy") && unit === "kcal")) return "energy_kcal";
  if (number === "1003" || name === "protein") return "protein_g";
  if (number === "1004" || name.includes("total lipid")) return "fat_g";
  if (number === "1005" || name.includes("carbohydrate")) return "carbs_g";
  if (number === "1079" || name.includes("fiber")) return "fiber_g";
  if (number === "2092" || name === "starch") return "starch_g";
  if (number === "2000" || name.includes("sugars, total")) return "sugars_g";
  if (number === "1235" || name.includes("sugars, added")) return "added_sugars_g";
  if (number === "1093" || name.startsWith("sodium")) return "sodium_mg";
  if (number === "1087" || name.startsWith("calcium")) return "calcium_mg";
  if (number === "1088" || name.startsWith("copper")) return "copper_mg";
  if (number === "1092" || name.startsWith("potassium")) return "potassium_mg";
  if (number === "1091" || name.startsWith("phosphorus")) return "phosphorus_mg";
  if (number === "1090" || name.startsWith("magnesium")) return "magnesium_mg";
  if (number === "1089" || name.startsWith("iron")) return "iron_mg";
  if (number === "1098" || name.startsWith("manganese")) return "manganese_mg";
  if (number === "1103" || name.startsWith("selenium")) return "selenium_ug";
  if (number === "1095" || name.startsWith("zinc")) return "zinc_mg";
  if (number === "262" || name.includes("caffeine")) return "caffeine_mg";
  if (number === "1051" || name === "water") return "water_g";
  if (number === "1253" || name.includes("cholesterol")) return "cholesterol_mg";
  if (number === "1258" || name.includes("fatty acids, total saturated")) return "sat_fat_g";
  if (number === "1257" || name.includes("fatty acids, total trans")) return "trans_fat_g";
  if (number === "645" || name.includes("fatty acids, total monounsaturated")) return "monounsaturated_g";
  if (number === "646" || name.includes("fatty acids, total polyunsaturated")) return "polyunsaturated_g";
  if (number === "1167" || name.includes("niacin")) return "vitamin_b3_mg";
  if (number === "1165" || name.includes("thiamin")) return "thiamin_b1_mg";
  if (number === "1166" || name.includes("riboflavin")) return "riboflavin_b2_mg";
  if (number === "1170" || name.includes("pantothenic")) return "pantothenic_b5_mg";
  if (number === "1175" || name.includes("vitamin b-6")) return "vitamin_b6_mg";
  if (number === "1178" || name.includes("vitamin b-12")) return "vitamin_b12_ug";
  if (number === "1177" || name.includes("folate")) return "folate_ug";
  if (number === "1106" || name.includes("vitamin a")) return "vitamin_a_ug";
  if (number === "1162" || name.includes("vitamin c")) return "vitamin_c_mg";
  if (number === "1110" || name.includes("vitamin d")) return "vitamin_d_ug";
  if (number === "1109" || name.includes("vitamin e")) return "vitamin_e_mg";
  if (number === "1185" || name.includes("vitamin k")) return "vitamin_k_ug";
  if (number === "221" || name.includes("alcohol, ethyl")) return "alcohol_g";

  if (name === "histidine") return "histidine_g";
  if (name === "isoleucine") return "isoleucine_g";
  if (name === "leucine") return "leucine_g";
  if (name === "lysine") return "lysine_g";
  if (name === "threonine") return "threonine_g";
  if (name === "tryptophan") return "tryptophan_g";
  if (name === "valine") return "valine_g";
  if (name === "methionine") return "methionine_g";
  if (name === "cystine") return "cystine_g";
  if (name === "phenylalanine") return "phenylalanine_g";
  if (name === "tyrosine") return "tyrosine_g";
  if (name.includes("fatty acids, total omega-3") || ["1270", "1271", "1278", "1279", "1280"].includes(number)) return "omega3_g";
  if (name.includes("fatty acids, total omega-6") || ["1269", "1272", "1273", "1274"].includes(number)) return "omega6_g";

  return null;
};

const sortGroupFromUnitAndName = ({ code, unitName, nutrientName }) => {
  const name = normalizeText(nutrientName);
  const unit = normalizeText(unitName);
  if (code.includes("vitamin") || code.includes("thiamin") || code.includes("riboflavin") || code.includes("folate") || code.includes("pantothenic") || name.includes("vitamin")) return "Vitamins";
  if (["histidine_g", "isoleucine_g", "leucine_g", "lysine_g", "methionine_g", "cystine_g", "phenylalanine_g", "threonine_g", "tryptophan_g", "tyrosine_g", "valine_g"].includes(code)) return "Protein";
  if (unit === "mg" || unit === "ug" || name.includes("sodium") || name.includes("potassium")) return "Minerals";
  if (code === "energy_kcal" || code === "alcohol_g") return "General";
  if (code.includes("protein")) return "Protein";
  if (code.includes("carb") || code.includes("sugar") || code.includes("fiber") || code.includes("starch")) return "Carbohydrates";
  if (code.includes("fat")) return "Lipids";
  return "USDA nutrients";
};

const normalizeUsdaNutrientRow = (row) => {
  const nutrientId = row?.nutrient?.id ?? row?.nutrientId ?? null;
  const nutrientNumber = row?.nutrient?.number ?? row?.nutrientNumber ?? "";
  const nutrientName = row?.nutrient?.name ?? row?.nutrientName ?? "";
  const unitName = row?.nutrient?.unitName ?? row?.unitName ?? "";
  const rawAmount = row?.amount ?? row?.value ?? row?.nutrient?.amount ?? 0;
  const amount = toNum(rawAmount);
  if (!nutrientName || !Number.isFinite(amount)) return null;

  const canonical = canonicalCodeFromUsdaNutrient({ nutrientNumber, nutrientName, unitName });
  const code = canonical || `usda_${nutrientId || slugCode(nutrientName)}`;
  const label = String(nutrientName);
  const unit = String(unitName || "").toLowerCase();
  return {
    nutrient_id: nutrientId ? String(nutrientId) : null,
    nutrient_number: String(nutrientNumber || ""),
    nutrient_name: label,
    unit_name: unit,
    amount_per_100g: amount,
    code
  };
};

const fetchUsdaFoodDetails = async (fdcId) => {
  if (!USDA_API_KEY) throw new Error("USDA_API_KEY is missing in backend environment.");
  const id = String(fdcId || "").trim();
  if (!id) throw new Error("fdc_id is required.");

  const url = `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(id)}?api_key=${encodeURIComponent(USDA_API_KEY)}`;
  const r = await fetch(url);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`USDA food lookup failed (${r.status}): ${txt || r.statusText}`);
  }
  return r.json();
};

const importUsdaFoodByFdcId = async ({ fdcId }) => {
  const marker = `fdc:${String(fdcId).trim()}`;
  const { data: existing, error: existingErr } = await supabase
    .from("foods")
    .select("id, name")
    .eq("source", "usda")
    .eq("barcode", marker)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing?.id) return { food_id: existing.id, name: existing.name, reused: true };

  const detail = await fetchUsdaFoodDetails(fdcId);
  const name = String(detail?.description || "").trim();
  if (!name) throw new Error("USDA food has no description.");
  const brand = String(detail?.brandOwner || detail?.brandName || "").trim() || null;
  const locale = "en-us";

  const nutrientRowsRaw = Array.isArray(detail?.foodNutrients) ? detail.foodNutrients : [];
  const normalized = nutrientRowsRaw.map(normalizeUsdaNutrientRow).filter(Boolean);
  if (normalized.length === 0) throw new Error("USDA food has no nutrient rows.");

  const combined = new Map();
  for (const row of normalized) {
    const key = row.code;
    combined.set(key, toNum(combined.get(key)) + toNum(row.amount_per_100g));
  }

  const carbs = toNum(combined.get("carbs_g"));
  const fiber = toNum(combined.get("fiber_g"));
  if (carbs > 0 || fiber > 0) {
    combined.set("net_carbs_g", Math.max(0, carbs - fiber));
  }

  const omega3 = toNum(combined.get("omega3_g"));
  const omega6 = toNum(combined.get("omega6_g"));
  if (omega3 <= 0) {
    const derivedOmega3 = toNum(combined.get("usda_1270")) + toNum(combined.get("usda_1271")) + toNum(combined.get("usda_1278")) + toNum(combined.get("usda_1279")) + toNum(combined.get("usda_1280"));
    if (derivedOmega3 > 0) combined.set("omega3_g", derivedOmega3);
  }
  if (omega6 <= 0) {
    const derivedOmega6 = toNum(combined.get("usda_1269")) + toNum(combined.get("usda_1272")) + toNum(combined.get("usda_1273")) + toNum(combined.get("usda_1274"));
    if (derivedOmega6 > 0) combined.set("omega6_g", derivedOmega6);
  }

  const { data: insertedFood, error: foodErr } = await supabase
    .from("foods")
    .insert({
      name,
      brand,
      barcode: marker,
      locale,
      source: "usda"
    })
    .select("id, name")
    .single();
  if (foodErr) throw new Error(foodErr.message);

  const nutrientMetaPayload = [];
  const nutrientValuePayload = [];

  for (const [code, amount] of combined.entries()) {
    if (!ALLOWED_TRACKED_NUTRIENT_CODES.has(code)) continue;
    const sample = normalized.find((r) => r.code === code);
    const label = sample?.nutrient_name || code;
    const unit = sample?.unit_name || (code.endsWith("_mg") ? "mg" : code.endsWith("_ug") ? "ug" : code.endsWith("_kcal") ? "kcal" : "g");
    nutrientMetaPayload.push({
      code,
      label,
      unit,
      sort_group: sortGroupFromUnitAndName({ code, unitName: unit, nutrientName: label }),
      sort_order: 9000
    });
    nutrientValuePayload.push({
      food_id: insertedFood.id,
      nutrient_code: code,
      amount_per_100g: Math.max(0, toNum(amount))
    });
  }

  if (nutrientMetaPayload.length > 0) {
    const { error: metaErr } = await supabase
      .from("nutrients")
      .upsert(nutrientMetaPayload, { onConflict: "code" });
    if (metaErr) throw new Error(metaErr.message);
  }

  if (nutrientValuePayload.length > 0) {
    const { error: valueErr } = await supabase
      .from("food_nutrients")
      .upsert(nutrientValuePayload, { onConflict: "food_id,nutrient_code" });
    if (valueErr) throw new Error(valueErr.message);
  }

  return { food_id: insertedFood.id, name: insertedFood.name, reused: false };
};

const normalizeLogItems = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      const food_name = String(it?.food || it?.food_name || "").trim();
      const amount = toNum(it?.qty ?? it?.amount);
      const unit = normalizeUnit(it?.unit || "");
      const cooked_state = String(it?.state || it?.cooked_state || "").trim().toLowerCase();
      const food_id = it?.food_id || it?.foodId || null;
      const user_food_id = it?.user_food_id || it?.userFoodId || null;
      return { food_name, amount, unit, cooked_state, food_id, user_food_id };
    })
    .filter((it) => it.food_name && Number.isFinite(it.amount) && it.amount > 0 && it.unit && it.cooked_state);
};

const aiKey = (it) =>
  `${String(it?.food || "").trim().toLowerCase()}|${toNum(it?.qty)}|${String(it?.unit || "").trim().toLowerCase()}|${String(it?.state || "").trim().toLowerCase()}`;

const buildAiItemLookup = (rows = []) => {
  const m = new Map();
  for (const row of rows) {
    const k = aiKey(row);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(row);
  }
  return m;
};

const normalizedFoodKey = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ilikePattern = (term) => {
  const s = String(term || "").trim();
  if (!s) return "%";
  return `%${s.replace(/[%_]/g, " ")}%`;
};

const findDeterministicFoodRefByName = async ({ user_id, food_name, matchCache }) => {
  const key = normalizedFoodKey(food_name);
  if (!key) return null;
  if (matchCache.has(key)) return matchCache.get(key);
  const fullPattern = ilikePattern(food_name);
  const token = String(food_name || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  const tokenPattern = ilikePattern(token);

  const [userFoodsRes, foodsRes, userFoodsTokenRes, foodsTokenRes] = await Promise.all([
    user_id
      ? supabase
          .from("user_foods")
          .select("id, name, brand")
          .eq("user_id", user_id)
          .or(`name.ilike.${fullPattern},brand.ilike.${fullPattern}`)
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("foods")
      .select("id, name, brand")
      .or(`name.ilike.${fullPattern},brand.ilike.${fullPattern}`)
      .limit(24),
    user_id && token
      ? supabase
          .from("user_foods")
          .select("id, name, brand")
          .eq("user_id", user_id)
          .or(`name.ilike.${tokenPattern},brand.ilike.${tokenPattern}`)
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    token
      ? supabase
          .from("foods")
          .select("id, name, brand")
          .or(`name.ilike.${tokenPattern},brand.ilike.${tokenPattern}`)
          .limit(24)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (userFoodsRes.error) throw new Error(userFoodsRes.error.message);
  if (foodsRes.error) throw new Error(foodsRes.error.message);
  if (userFoodsTokenRes.error) throw new Error(userFoodsTokenRes.error.message);
  if (foodsTokenRes.error) throw new Error(foodsTokenRes.error.message);

  const mergeUniqueById = (rows = []) => {
    const m = new Map();
    for (const row of rows) {
      if (row?.id && !m.has(row.id)) m.set(row.id, row);
    }
    return Array.from(m.values());
  };

  const userFoods = mergeUniqueById([...(userFoodsRes.data || []), ...(userFoodsTokenRes.data || [])]);
  const foods = mergeUniqueById([...(foodsRes.data || []), ...(foodsTokenRes.data || [])]);
  const userFoodIds = userFoods.map((r) => r.id).filter(Boolean);
  const foodIds = foods.map((r) => r.id).filter(Boolean);

  const [userCoverageRes, foodCoverageRes] = await Promise.all([
    userFoodIds.length > 0
      ? supabase
          .from("user_food_nutrients")
          .select("user_food_id, nutrient_code")
          .in("user_food_id", userFoodIds)
          .in("nutrient_code", KEY_NUTRIENT_CODES)
      : Promise.resolve({ data: [], error: null }),
    foodIds.length > 0
      ? supabase
          .from("food_nutrients")
          .select("food_id, nutrient_code")
          .in("food_id", foodIds)
          .in("nutrient_code", KEY_NUTRIENT_CODES)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (userCoverageRes.error) throw new Error(userCoverageRes.error.message);
  if (foodCoverageRes.error) throw new Error(foodCoverageRes.error.message);

  const userCoverage = new Map();
  for (const row of userCoverageRes.data || []) {
    const id = row?.user_food_id;
    const code = String(row?.nutrient_code || "");
    if (!id || !code) continue;
    if (!userCoverage.has(id)) userCoverage.set(id, new Set());
    userCoverage.get(id).add(code);
  }

  const foodCoverage = new Map();
  for (const row of foodCoverageRes.data || []) {
    const id = row?.food_id;
    const code = String(row?.nutrient_code || "");
    if (!id || !code) continue;
    if (!foodCoverage.has(id)) foodCoverage.set(id, new Set());
    foodCoverage.get(id).add(code);
  }

  const candidates = [
    ...userFoods.map((row) => ({
      type: "user",
      id: row.id,
      normalized: normalizedFoodKey(row.name),
      coverage: userCoverage.get(row.id)?.size || 0
    })),
    ...foods.map((row) => ({
      type: "global",
      id: row.id,
      normalized: normalizedFoodKey(row.name),
      coverage: foodCoverage.get(row.id)?.size || 0
    }))
  ]
    .filter((c) => c.coverage > 0)
    .sort((a, b) => {
      const aExact = a.normalized === key ? 0 : 1;
      const bExact = b.normalized === key ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const sourceBias = a.type === "user" ? -1 : 0;
      const sourceBiasB = b.type === "user" ? -1 : 0;
      if (sourceBias !== sourceBiasB) return sourceBias - sourceBiasB;
      return b.coverage - a.coverage;
    });

  const picked = candidates[0] || null;
  const out = picked
    ? picked.type === "user"
      ? { user_food_id: picked.id, food_id: null, auto_matched: true }
      : { food_id: picked.id, user_food_id: null, auto_matched: true }
    : null;

  matchCache.set(key, out);
  return out;
};

const macroTotalsFromNutrients = (scaledRows = []) => {
  const totals = { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, alcohol_g: 0 };
  let hasEnergyRow = false;
  for (const row of scaledRows) {
    const code = String(row?.nutrient_code || "");
    const field = MACRO_FROM_NUTRIENT_CODE[code];
    if (!field) continue;
    if (code === "energy_kcal") hasEnergyRow = true;
    totals[field] += toNum(row?.amount);
  }
  const derivedCalories = totals.protein_g * 4 + totals.carbs_g * 4 + totals.fats_g * 9 + totals.alcohol_g * 7;
  return {
    calories: Math.max(0, Math.round(hasEnergyRow ? totals.calories : derivedCalories)),
    protein_g: Math.max(0, Math.round(totals.protein_g)),
    carbs_g: Math.max(0, Math.round(totals.carbs_g)),
    fats_g: Math.max(0, Math.round(totals.fats_g)),
    alcohol_g: Math.max(0, Math.round(totals.alcohol_g * 10) / 10)
  };
};

const micronutrientRowCount = (rows = []) =>
  (Array.isArray(rows) ? rows : []).filter((r) => !MACRO_NUTRIENT_CODES.has(String(r?.nutrient_code || ""))).length;

const fetchPer100gNutrients = async ({ food_id, user_food_id }) => {
  if (food_id) {
    const { data, error } = await supabase
      .from("food_nutrients")
      .select("nutrient_code, amount_per_100g")
      .eq("food_id", food_id);
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : [];
  }

  if (user_food_id) {
    const { data, error } = await supabase
      .from("user_food_nutrients")
      .select("nutrient_code, amount_per_100g")
      .eq("user_food_id", user_food_id);
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : [];
  }

  return [];
};

const fetchDaySummary = async ({ user_id, log_date }) => {
  const { data: itemRows, error: itemsErr } = await supabase
    .from("daily_nutrition_items")
    .select("id, food_name, amount, unit, grams, cooked_state, source, food_id, user_food_id, calories, protein_g, carbs_g, fats_g")
    .eq("user_id", user_id)
    .eq("log_date", log_date)
    .order("created_at", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);

  const items = Array.isArray(itemRows) ? itemRows : [];
  const totals = items.reduce(
    (acc, it) => {
      acc.calories += Math.max(0, Math.round(toNum(it?.calories)));
      acc.protein_g += Math.max(0, Math.round(toNum(it?.protein_g)));
      acc.carbs_g += Math.max(0, Math.round(toNum(it?.carbs_g)));
      acc.fats_g += Math.max(0, Math.round(toNum(it?.fats_g)));
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, alcohol_g: 0 }
  );

  const { data: allNutrientMetaRows, error: allMetaErr } = await supabase
    .from("nutrients")
    .select("code, label, unit, sort_group, sort_order")
    .order("sort_group", { ascending: true })
    .order("sort_order", { ascending: true });
  if (allMetaErr) throw new Error(allMetaErr.message);
  const allMeta = Array.isArray(allNutrientMetaRows) ? allNutrientMetaRows : [];

  const itemIds = items.map((x) => x.id).filter(Boolean);
  const { data: nRows, error: nErr } =
    itemIds.length > 0
      ? await supabase
          .from("daily_nutrition_item_nutrients")
          .select("nutrient_code, amount")
          .in("item_id", itemIds)
      : { data: [], error: null };
  if (nErr) throw new Error(nErr.message);

  const amountByCode = new Map();
  for (const row of nRows || []) {
    const code = String(row?.nutrient_code || "");
    if (!code) continue;
    amountByCode.set(code, toNum(amountByCode.get(code)) + toNum(row?.amount));
  }

  totals.alcohol_g = Math.max(0, Math.round(toNum(amountByCode.get("alcohol_g")) * 10) / 10);

  const nutrientCodes = new Set([
    ...allMeta.map((m) => String(m.code || "")),
    ...Array.from(amountByCode.keys())
  ]);

  const metaByCode = new Map(allMeta.map((m) => [m.code, m]));
  const nutrients = Array.from(nutrientCodes)
    .filter((code) => Boolean(code) && ALLOWED_TRACKED_NUTRIENT_CODES.has(String(code)))
    .map((code) => {
      const meta = metaByCode.get(code) || {};
      return {
        code,
        label: meta.label || code,
        unit: meta.unit || "",
        sort_group: meta.sort_group || "Other",
        sort_order: Number.isFinite(Number(meta.sort_order)) ? Number(meta.sort_order) : 9999,
        amount: toNum(amountByCode.get(code))
      };
    })
    .sort((a, b) => {
      if (String(a.sort_group) !== String(b.sort_group)) {
        return String(a.sort_group).localeCompare(String(b.sort_group));
      }
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });

  return { totals, nutrients, items };
};

const searchUsdaFoods = async ({ term, limit = 8 }) => {
  if (!USDA_API_KEY) return [];
  const payload = {
    query: String(term || "").trim(),
    pageSize: Math.min(25, Math.max(1, Number(limit))),
    dataType: ["Foundation", "SR Legacy"],
    sortBy: "dataType.keyword",
    sortOrder: "asc"
  };
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(USDA_API_KEY)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  const foods = Array.isArray(j?.foods) ? j.foods : [];
  return foods.map((f) => ({
    usda_fdc_id: f.fdcId,
    name: String(f.description || "").trim(),
    brand: String(f.brandOwner || "").trim() || null,
    source_name: "usda",
    source: "usda_remote",
    locale: "en-us",
    kcal_per_100g: null,
    nutrient_coverage_count: null,
    nutrient_coverage_ratio: null
  })).filter((x) => x.name);
};

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

app.post("/api/nutrition/parse", nutritionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const items = body.items || body.entries || [];
    const notes = body.notes || "";

    const parsed = await parseNutritionWithAI({ items, notes });
    return res.json({ ok: true, ...parsed });
  } catch (e) {
    const status = e?.statusCode || 500;
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/nutrition/log", nutritionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const user_id = body.user_id || body.userId;
    const log_date = body.log_date || isoDate(new Date());
    const notes = body.notes || null;
    const water_ml = body.water_ml ?? body.waterMl ?? 0;
    const salt_g = body.salt_g ?? body.saltG ?? 0;
    const items = body.items || body.entries || [];

    if (!user_id) {
      return res.status(400).json({ ok: false, error: "user_id (or userId) is required" });
    }

    const normalizedItems = normalizeLogItems(items);
    const warnings = [];

    const { data: existingRows, error: existingErr } = await supabase
      .from("daily_nutrition_items")
      .select("id")
      .eq("user_id", user_id)
      .eq("log_date", log_date);
    if (existingErr) {
      return res.status(400).json({ ok: false, error: existingErr.message });
    }

    const existingIds = (existingRows || []).map((r) => r.id).filter(Boolean);
    if (existingIds.length > 0) {
      const { error: delNutrientsErr } = await supabase
        .from("daily_nutrition_item_nutrients")
        .delete()
        .in("item_id", existingIds);
      if (delNutrientsErr) {
        return res.status(400).json({ ok: false, error: delNutrientsErr.message });
      }
    }

    const { error: delItemsErr } = await supabase
      .from("daily_nutrition_items")
      .delete()
      .eq("user_id", user_id)
      .eq("log_date", log_date);
    if (delItemsErr) {
      return res.status(400).json({ ok: false, error: delItemsErr.message });
    }

    const nutrientCache = new Map();
    const conversionCache = new Map();
    const matchCache = new Map();
    const stagedItems = [];
    const aiCandidates = [];

    for (const it of normalizedItems) {
      const resolvedItem = { ...it };
      if (!resolvedItem.food_id && !resolvedItem.user_food_id && resolvedItem.unit !== "serv") {
        const autoMatch = await findDeterministicFoodRefByName({
          user_id,
          food_name: resolvedItem.food_name,
          matchCache
        });
        if (autoMatch) {
          resolvedItem.food_id = autoMatch.food_id || null;
          resolvedItem.user_food_id = autoMatch.user_food_id || null;
          warnings.push(`"${resolvedItem.food_name}": auto-matched to verified food for deterministic nutrients.`);
        }
      }
      const hasFoodRef = Boolean(resolvedItem.food_id || resolvedItem.user_food_id);
      const grams = await resolveItemGrams({ item: resolvedItem, conversionCache });
      const deterministic = hasFoodRef && grams != null;

      if (!deterministic) {
        if (hasFoodRef) {
          warnings.push(`"${resolvedItem.food_name}": fell back to AI because unit "${resolvedItem.unit}" cannot be converted to grams.`);
        } else {
          warnings.push(`"${resolvedItem.food_name}": no verified food selected; select from suggestions for USDA-deterministic nutrients.`);
        }
        aiCandidates.push(resolvedItem);
        continue;
      }

      const cacheKey = resolvedItem.food_id ? `food:${resolvedItem.food_id}` : `user_food:${resolvedItem.user_food_id}`;
      let per100gRows = nutrientCache.get(cacheKey);
      if (!per100gRows) {
        per100gRows = await fetchPer100gNutrients({
          food_id: resolvedItem.food_id,
          user_food_id: resolvedItem.user_food_id
        });
        nutrientCache.set(cacheKey, per100gRows);
      }

      if (!Array.isArray(per100gRows) || per100gRows.length === 0 || micronutrientRowCount(per100gRows) === 0) {
        const autoMatch = await findDeterministicFoodRefByName({
          user_id,
          food_name: resolvedItem.food_name,
          matchCache
        });
        if (autoMatch && (autoMatch.food_id !== resolvedItem.food_id || autoMatch.user_food_id !== resolvedItem.user_food_id)) {
          resolvedItem.food_id = autoMatch.food_id || null;
          resolvedItem.user_food_id = autoMatch.user_food_id || null;
          const retryCacheKey = resolvedItem.food_id ? `food:${resolvedItem.food_id}` : `user_food:${resolvedItem.user_food_id}`;
          per100gRows = nutrientCache.get(retryCacheKey);
          if (!per100gRows) {
            per100gRows = await fetchPer100gNutrients({
              food_id: resolvedItem.food_id,
              user_food_id: resolvedItem.user_food_id
            });
            nutrientCache.set(retryCacheKey, per100gRows);
          }
          if (Array.isArray(per100gRows) && per100gRows.length > 0 && micronutrientRowCount(per100gRows) > 0) {
            warnings.push(`"${resolvedItem.food_name}": selected food lacked micronutrients, switched to a better verified match.`);
          }
        }
      }

      if (!Array.isArray(per100gRows) || per100gRows.length === 0) {
        warnings.push(`"${resolvedItem.food_name}": no nutrient rows found for selected food, using AI fallback.`);
        aiCandidates.push(resolvedItem);
        continue;
      }

      if (micronutrientRowCount(per100gRows) === 0) {
        warnings.push(`"${resolvedItem.food_name}": deterministic macros found, but no micronutrients exist for this food profile yet.`);
      }

      const scaledRows = per100gRows
        .filter((r) => ALLOWED_TRACKED_NUTRIENT_CODES.has(String(r?.nutrient_code || "")))
        .map((r) => ({
          nutrient_code: r.nutrient_code,
          amount: scalePer100g(r.amount_per_100g, grams)
        }));
      const macros = macroTotalsFromNutrients(scaledRows);

      stagedItems.push({
        ...resolvedItem,
        grams,
        source: "db",
        macros,
        scaledRows
      });
    }

    let aiWarnings = [];
    if (aiCandidates.length > 0) {
      const aiParsed = await parseNutritionWithAI({
        items: aiCandidates.map((it) => ({
          food: it.food_name,
          qty: it.amount,
          unit: it.unit,
          state: it.cooked_state
        })),
        notes
      });
      aiWarnings = Array.isArray(aiParsed?.warnings) ? aiParsed.warnings : [];
      const aiLookup = buildAiItemLookup(aiParsed?.items || []);

      for (const it of aiCandidates) {
        const key = aiKey({
          food: it.food_name,
          qty: it.amount,
          unit: it.unit,
          state: it.cooked_state
        });
        const matched = aiLookup.get(key)?.shift() || null;
        const macros = {
          calories: Math.max(0, Math.round(toNum(matched?.calories))),
          protein_g: Math.max(0, Math.round(toNum(matched?.protein_g))),
          carbs_g: Math.max(0, Math.round(toNum(matched?.carbs_g))),
          fats_g: Math.max(0, Math.round(toNum(matched?.fats_g)))
        };
        stagedItems.push({
          ...it,
          grams: await resolveItemGrams({ item: it, conversionCache }),
          source: "ai",
          macros,
          scaledRows: []
        });
      }
    }

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;
    let totalAlcohol = 0;
    let dbItemCount = 0;
    let aiItemCount = 0;
    let nutrientRowsInserted = 0;
    let micronutrientRowsInserted = 0;

    for (const staged of stagedItems) {
      const itemId = crypto.randomUUID();
      const row = {
        id: itemId,
        user_id,
        log_date,
        food_name: staged.food_name,
        amount: staged.amount,
        unit: staged.unit,
        cooked_state: staged.cooked_state,
        source_text: null,
        source: staged.source,
        food_id: staged.food_id || null,
        user_food_id: staged.food_id ? null : staged.user_food_id || null,
        grams: staged.grams,
        calories: staged.macros.calories,
        protein_g: staged.macros.protein_g,
        carbs_g: staged.macros.carbs_g,
        fats_g: staged.macros.fats_g
      };

      const { error: insErr } = await supabase.from("daily_nutrition_items").insert(row);
      if (insErr) {
        return res.status(400).json({ ok: false, error: insErr.message });
      }

      if (staged.source === "db" && staged.scaledRows.length > 0) {
        dbItemCount += 1;
        const payload = staged.scaledRows.map((r) => ({
          item_id: itemId,
          nutrient_code: r.nutrient_code,
          amount: r.amount
        }));
        const { error: nInsErr } = await supabase
          .from("daily_nutrition_item_nutrients")
          .upsert(payload, { onConflict: "item_id,nutrient_code" });
        if (nInsErr) {
          return res.status(400).json({ ok: false, error: nInsErr.message });
        }
        nutrientRowsInserted += payload.length;
        micronutrientRowsInserted += payload.filter((r) => !MACRO_NUTRIENT_CODES.has(String(r.nutrient_code || ""))).length;
      } else if (staged.source === "db") {
        dbItemCount += 1;
      } else {
        aiItemCount += 1;
      }

      totalCalories += staged.macros.calories;
      totalProtein += staged.macros.protein_g;
      totalCarbs += staged.macros.carbs_g;
      totalFats += staged.macros.fats_g;
      totalAlcohol += toNum(staged.macros.alcohol_g);
    }

    const { error: upsertErr } = await supabase
      .from("daily_nutrition_logs")
      .upsert(
        {
          user_id,
          log_date,
          notes,
          water_ml: Math.max(0, Math.round(toNum(water_ml))),
          salt_g: Math.max(0, toNum(salt_g)),
          calories: totalCalories,
          protein_g: totalProtein,
          carbs_g: totalCarbs,
          fats_g: totalFats
        },
        { onConflict: "user_id,log_date" }
      );
    if (upsertErr) {
      return res.status(400).json({ ok: false, error: upsertErr.message });
    }

    return res.json({
      ok: true,
      log_date,
      calories: totalCalories,
      protein_g: totalProtein,
      carbs_g: totalCarbs,
      fats_g: totalFats,
      alcohol_g: Math.max(0, Math.round(totalAlcohol * 10) / 10),
      warnings: [...warnings, ...aiWarnings],
      item_count: stagedItems.length,
      debug: {
        received_item_count: Array.isArray(items) ? items.length : 0,
        normalized_item_count: normalizedItems.length,
        db_item_count: dbItemCount,
        ai_item_count: aiItemCount,
        nutrient_rows_inserted: nutrientRowsInserted,
        micronutrient_rows_inserted: micronutrientRowsInserted
      }
    });
  } catch (e) {
    const status = e?.statusCode || 500;
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/foods/search", async (req, res) => {
  try {
    const term = String(req.query.q || "").trim();
    const user_id = String(req.query.user_id || req.query.userId || "").trim();
    const localeRaw = String(req.query.locale || "any").trim().toLowerCase();
    const locale =
      localeRaw === "us" ? "en-us" :
      localeRaw === "uk" ? "en-gb" :
      localeRaw;
    const limit = Math.min(30, Math.max(1, Number(req.query.limit || 12)));

    if (!term) return res.json({ ok: true, items: [] });

    const normalizedTerm = term.toLowerCase();
    const localeFilter = locale === "any" ? null : locale.toLowerCase();
    const includeUsda = String(req.query.include_usda || "1") !== "0";

    const safePattern = `%${term.replace(/[%_]/g, " ").trim()}%`;
    const mergeUniqueById = (rows = []) => {
      const m = new Map();
      for (const row of rows || []) {
        if (row?.id && !m.has(row.id)) m.set(row.id, row);
      }
      return Array.from(m.values());
    };

    const [foodsNameRes, foodsBrandRes, usdaRemote] = await Promise.all([
      supabase
        .from("foods")
        .select("id, name, brand, locale, source, barcode")
        .ilike("name", safePattern)
        .limit(limit * 4),
      supabase
        .from("foods")
        .select("id, name, brand, locale, source, barcode")
        .ilike("brand", safePattern)
        .limit(limit * 2),
      includeUsda ? searchUsdaFoods({ term, limit: Math.min(8, limit) }) : Promise.resolve([])
    ]);
    const foodsRes = {
      data: mergeUniqueById([...(foodsNameRes.data || []), ...(foodsBrandRes.data || [])]),
      error: foodsNameRes.error || foodsBrandRes.error || null
    };
    const foods = foodsRes.data;
    const fErr = foodsRes.error;

    if (fErr) return res.status(400).json({ ok: false, error: fErr.message });

    let userFoods = [];
    if (user_id) {
      const [uNameRes, uBrandRes] = await Promise.all([
        supabase
          .from("user_foods")
          .select("id, name, brand")
          .eq("user_id", user_id)
          .ilike("name", safePattern)
          .limit(limit * 2),
        supabase
          .from("user_foods")
          .select("id, name, brand")
          .eq("user_id", user_id)
          .ilike("brand", safePattern)
          .limit(limit * 2)
      ]);
      if (uNameRes.error || uBrandRes.error) {
        return res.status(400).json({ ok: false, error: String(uNameRes.error?.message || uBrandRes.error?.message || "Food search failed") });
      }
      userFoods = mergeUniqueById([...(uNameRes.data || []), ...(uBrandRes.data || [])]);
    }

    const filteredFoods = (foods || []).filter((row) => {
      if (!localeFilter) return true;
      return String(row?.locale || "").toLowerCase() === localeFilter;
    });

    const foodIds = filteredFoods.map((x) => x.id).filter(Boolean);
    const userFoodIds = userFoods.map((x) => x.id).filter(Boolean);

    let foodEnergyRows = [];
    if (foodIds.length > 0) {
      const { data: eRows, error: eErr } = await supabase
        .from("food_nutrients")
        .select("food_id, amount_per_100g")
        .in("food_id", foodIds)
        .eq("nutrient_code", "energy_kcal");
      if (eErr) return res.status(400).json({ ok: false, error: eErr.message });
      foodEnergyRows = Array.isArray(eRows) ? eRows : [];
    }

    let foodCoverageRows = [];
    if (foodIds.length > 0) {
      const { data: cRows, error: cErr } = await supabase
        .from("food_nutrients")
        .select("food_id, nutrient_code")
        .in("food_id", foodIds)
        .in("nutrient_code", KEY_NUTRIENT_CODES);
      if (cErr) return res.status(400).json({ ok: false, error: cErr.message });
      foodCoverageRows = Array.isArray(cRows) ? cRows : [];
    }

    let userFoodEnergyRows = [];
    if (userFoodIds.length > 0) {
      const { data: ueRows, error: ueErr } = await supabase
        .from("user_food_nutrients")
        .select("user_food_id, amount_per_100g")
        .in("user_food_id", userFoodIds)
        .eq("nutrient_code", "energy_kcal");
      if (ueErr) return res.status(400).json({ ok: false, error: ueErr.message });
      userFoodEnergyRows = Array.isArray(ueRows) ? ueRows : [];
    }

    let userFoodCoverageRows = [];
    if (userFoodIds.length > 0) {
      const { data: ucRows, error: ucErr } = await supabase
        .from("user_food_nutrients")
        .select("user_food_id, nutrient_code")
        .in("user_food_id", userFoodIds)
        .in("nutrient_code", KEY_NUTRIENT_CODES);
      if (ucErr) return res.status(400).json({ ok: false, error: ucErr.message });
      userFoodCoverageRows = Array.isArray(ucRows) ? ucRows : [];
    }

    const kcalByFoodId = new Map(foodEnergyRows.map((r) => [r.food_id, toNum(r.amount_per_100g)]));
    const kcalByUserFoodId = new Map(userFoodEnergyRows.map((r) => [r.user_food_id, toNum(r.amount_per_100g)]));
    const buildCoverageMap = (rows, idField) => {
      const m = new Map();
      for (const row of rows) {
        const id = row?.[idField];
        const code = String(row?.nutrient_code || "");
        if (!id || !code) continue;
        if (!m.has(id)) m.set(id, new Set());
        m.get(id).add(code);
      }
      return m;
    };
    const foodCoverageMap = buildCoverageMap(foodCoverageRows, "food_id");
    const userFoodCoverageMap = buildCoverageMap(userFoodCoverageRows, "user_food_id");

    const items = [
      ...(userFoods || []).map((x) => ({
        id: x.id,
        name: x.name,
        brand: x.brand || null,
        kcal_per_100g: kcalByUserFoodId.get(x.id) ?? null,
        source: "user",
        user_food_id: x.id,
        food_id: null
      })),
      ...filteredFoods.map((x) => ({
        id: x.id,
        name: x.name,
        brand: x.brand || null,
        locale: x.locale || null,
        source_name: x.source || "db",
        kcal_per_100g: kcalByFoodId.get(x.id) ?? null,
        nutrient_coverage_count: foodCoverageMap.get(x.id)?.size || 0,
        nutrient_coverage_ratio: (foodCoverageMap.get(x.id)?.size || 0) / KEY_NUTRIENT_CODES.length,
        source: "global",
        food_id: x.id,
        user_food_id: null,
        usda_fdc_id: String(x?.barcode || "").startsWith("fdc:") ? String(x.barcode).slice(4) : null
      })),
      ...(usdaRemote || []).map((x) => ({
        id: `usda:${x.usda_fdc_id}`,
        name: x.name,
        brand: x.brand,
        locale: x.locale,
        source_name: "usda",
        kcal_per_100g: null,
        nutrient_coverage_count: null,
        nutrient_coverage_ratio: null,
        source: "usda_remote",
        food_id: null,
        user_food_id: null,
        usda_fdc_id: String(x.usda_fdc_id)
      }))
    ];

    const withRank = items.map((item) => {
      const name = String(item?.name || "").toLowerCase();
      const brand = String(item?.brand || "").trim();
      const itemLocale = String(item?.locale || "").toLowerCase();
      const startsWith = name.startsWith(normalizedTerm) ? 0 : 1;
      const includes = name.includes(normalizedTerm) ? 0 : 1;
      const wholeFood = brand ? 1 : 0;
      const localePenalty = localeFilter ? (itemLocale === localeFilter ? 0 : 1) : 0;
      const sourcePenalty = item.source === "user" ? -1 : 0;
      const usdaRemotePenalty = item.source === "usda_remote" ? 0.5 : 0;
      const usdaBoost = String(item.source_name || "").toLowerCase() === "usda" ? -2 : 0;
      const coveragePenalty = 1 - Math.min(1, toNum(item.nutrient_coverage_ratio));
      return {
        ...item,
        match_confidence: Math.max(
          0,
          Math.min(
            100,
            Math.round(
              100 -
                (wholeFood * 18 + startsWith * 24 + includes * 18 + coveragePenalty * 25 + localePenalty * 8) +
                sourcePenalty * 4 +
                usdaBoost * 4
            )
          )
        ),
        _rank:
          sourcePenalty * 100 +
          usdaRemotePenalty * 20 +
          usdaBoost * 40 +
          wholeFood * 20 +
          startsWith * 14 +
          includes * 10 +
          coveragePenalty * 30 +
          localePenalty * 5
      };
    });

    withRank.sort((a, b) => {
      if (a._rank !== b._rank) return a._rank - b._rank;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    const ranked = withRank.slice(0, limit).map(({ _rank, ...rest }) => rest);

    return res.json({ ok: true, items: ranked });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/foods/resolve-usda", async (req, res) => {
  try {
    const body = req.body || {};
    const fdc_id = String(body.fdc_id || body.fdcId || "").trim();
    if (!fdc_id) return res.status(400).json({ ok: false, error: "fdc_id is required" });
    const imported = await importUsdaFoodByFdcId({ fdcId: fdc_id });
    return res.json({ ok: true, ...imported, fdc_id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/nutrients", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("nutrients")
      .select("code, label, unit, sort_group, sort_order")
      .order("sort_group", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) return res.status(400).json({ ok: false, error: error.message });
    return res.json({ ok: true, items: data || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/nutrition/micro-targets", async (req, res) => {
  try {
    const user_id = String(req.query.user_id || req.query.userId || "").trim();
    if (!user_id) {
      return res.status(400).json({ ok: false, error: "user_id (or userId) is required" });
    }

    const [profileRes, nutrientsRes, prefRes, overridesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("sex, date_of_birth, current_weight_kg")
        .eq("user_id", user_id)
        .maybeSingle(),
      supabase
        .from("nutrients")
        .select("code, label, unit, sort_group, sort_order")
        .order("sort_group", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("nutrition_target_preferences")
        .select("micro_target_mode")
        .eq("user_id", user_id)
        .maybeSingle(),
      supabase
        .from("user_nutrient_target_overrides")
        .select("nutrient_code, target_amount")
        .eq("user_id", user_id)
    ]);

    const missingPrefsTable =
      prefRes.error &&
      (String(prefRes.error.code || "") === "PGRST205" ||
        String(prefRes.error.code || "") === "42P01" ||
        String(prefRes.error.message || "").includes("schema cache"));
    const missingOverridesTable =
      overridesRes.error &&
      (String(overridesRes.error.code || "") === "PGRST205" ||
        String(overridesRes.error.code || "") === "42P01" ||
        String(overridesRes.error.message || "").includes("schema cache"));

    if (profileRes.error) return res.status(400).json({ ok: false, error: profileRes.error.message });
    if (nutrientsRes.error) return res.status(400).json({ ok: false, error: nutrientsRes.error.message });
    if (prefRes.error && !missingPrefsTable) return res.status(400).json({ ok: false, error: prefRes.error.message });
    if (overridesRes.error && !missingOverridesTable) return res.status(400).json({ ok: false, error: overridesRes.error.message });

    const mode = normalizeMode(prefRes.data?.micro_target_mode || "rdi");
    const sex = profileRes.data?.sex || "any";
    const age = ageFromDob(profileRes.data?.date_of_birth);
    const weightKg = toNum(profileRes.data?.current_weight_kg);
    const overridesMap = new Map(((overridesRes.data || [])).map((r) => [r.nutrient_code, toNum(r.target_amount)]));

    const items = (nutrientsRes.data || []).map((n) => {
      const code = String(n.code || "");
      const overrideVal = overridesMap.get(code);
      let target_amount = null;
      let basis = mode;

      if (mode === "custom" && Number.isFinite(overrideVal) && overrideVal >= 0) {
        target_amount = overrideVal;
        basis = "custom";
      } else if (mode === "bodyweight") {
        target_amount = computeBodyweightTarget({ code, sex, weightKg });
        if (target_amount == null) {
          target_amount = computeRdiTarget({ code, sex });
          basis = "rdi";
        }
      } else {
        target_amount = computeRdiTarget({ code, sex });
        basis = "rdi";
      }

      return {
        code,
        label: n.label,
        unit: n.unit,
        sort_group: n.sort_group,
        sort_order: n.sort_order,
        target_amount: target_amount == null ? null : Math.round(target_amount * 100) / 100,
        basis
      };
    });

    return res.json({
      ok: true,
      mode,
      profile: { sex, age, weight_kg: weightKg || null },
      items,
      warnings: [
        ...(missingPrefsTable || missingOverridesTable
          ? ["Micronutrient target tables missing. Run SQL migration to enable persisted custom targets."]
          : [])
      ]
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/nutrition/micro-targets", async (req, res) => {
  try {
    const body = req.body || {};
    const user_id = body.user_id || body.userId;
    const mode = normalizeMode(body.mode || "rdi");
    const overrides = Array.isArray(body.overrides) ? body.overrides : [];
    const replaceOverrides = Boolean(body.replace_overrides);

    if (!user_id) {
      return res.status(400).json({ ok: false, error: "user_id (or userId) is required" });
    }

    const { error: prefErr } = await supabase
      .from("nutrition_target_preferences")
      .upsert({ user_id, micro_target_mode: mode }, { onConflict: "user_id" });
    if (prefErr) return res.status(400).json({ ok: false, error: prefErr.message });

    if (replaceOverrides) {
      const { error: delErr } = await supabase
        .from("user_nutrient_target_overrides")
        .delete()
        .eq("user_id", user_id);
      if (delErr) return res.status(400).json({ ok: false, error: delErr.message });
    }

    const cleanOverrides = overrides
      .map((o) => ({
        user_id,
        nutrient_code: String(o?.nutrient_code || "").trim(),
        target_amount: toNum(o?.target_amount)
      }))
      .filter((o) => o.nutrient_code && Number.isFinite(o.target_amount) && o.target_amount >= 0);

    if (cleanOverrides.length > 0) {
      const { error: upErr } = await supabase
        .from("user_nutrient_target_overrides")
        .upsert(cleanOverrides, { onConflict: "user_id,nutrient_code" });
      if (upErr) return res.status(400).json({ ok: false, error: upErr.message });
    }

    return res.json({ ok: true, mode, overrides_saved: cleanOverrides.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/nutrition/day-summary", async (req, res) => {
  try {
    const user_id = String(req.query.user_id || req.query.userId || "").trim();
    const log_date = String(req.query.log_date || req.query.logDate || isoDate(new Date())).trim();
    if (!user_id) {
      return res.status(400).json({ ok: false, error: "user_id (or userId) is required" });
    }

    const [summary, logResult] = await Promise.all([
      fetchDaySummary({ user_id, log_date }),
      supabase
        .from("daily_nutrition_logs")
        .select("notes, water_ml, salt_g")
        .eq("user_id", user_id)
        .eq("log_date", log_date)
        .maybeSingle()
    ]);

    if (logResult.error) return res.status(400).json({ ok: false, error: logResult.error.message });

    return res.json({
      ok: true,
      log_date,
      totals: summary.totals,
      nutrients: summary.nutrients,
      items: summary.items,
      notes: logResult.data?.notes || "",
      water_ml: Number.isFinite(Number(logResult.data?.water_ml)) ? Number(logResult.data?.water_ml) : 0,
      salt_g: Number.isFinite(Number(logResult.data?.salt_g)) ? Number(logResult.data?.salt_g) : 0,
      debug: {
        nutrient_row_count: (summary.nutrients || []).length,
        micronutrient_row_count: (summary.nutrients || []).filter((n) => !MACRO_NUTRIENT_CODES.has(String(n.code || ""))).length
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

const startOfWeekMonday = (d = new Date()) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const macrosFromCalories = ({ calories, weightKg }) => {
  const weightLb = weightKg * 2.2046226218;
  const proteinG = Math.round(weightLb * 0.8);
  const fatG = Math.max(50, Math.round(weightLb * 0.3));
  const proteinCals = proteinG * 4;
  const fatCals = fatG * 9;
  const remaining = Math.max(0, calories - proteinCals - fatCals);
  const carbsG = Math.round(remaining / 4);
  return { calories, proteinG, carbsG, fatG };
};

const suggestCalories = ({ goalType, weeklyRateKg, weightKg }) => {
  const maintenance = Math.round(weightKg * 33);
  if (!goalType || goalType === "maintain") return maintenance;

  const rate = Math.abs(Number(weeklyRateKg || 0));
  const weeklyCals = rate * 7700;
  const dailyDelta = Math.round(weeklyCals / 7);

  if (goalType === "lose" || goalType === "cut") return Math.max(1200, maintenance - dailyDelta);
  if (goalType === "gain" || goalType === "bulk") return maintenance + dailyDelta;

  return maintenance;
};

app.post("/api/profile/init", async (req, res) => {
  try {
    const body = req.body || {};

    const user_id = body.user_id || body.userId;
    const email = body.email;

    if (!user_id) {
      return res.status(400).json({ ok: false, error: "user_id (or userId) is required" });
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id,
          email: email || null,
          subscription_status: "inactive",
          is_suspended: false,
          onboarding_complete: false
        },
        { onConflict: "user_id" }
      );

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/nutrition/init", async (req, res) => {
  const body = req.body || {};
  const user_id = body.user_id || body.userId;

  if (!user_id) {
    return res.status(400).json({ ok: false, error: "user_id (or userId) is required" });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("current_weight_kg, goal_type, weekly_weight_change_target_kg")
    .eq("user_id", user_id)
    .maybeSingle();

  if (profileErr) {
    return res.status(400).json({ ok: false, error: profileErr.message });
  }

  const weightKg = Number(profile?.current_weight_kg || 0);
  if (!weightKg) {
    return res.status(400).json({ ok: false, error: "current_weight_kg missing in profiles" });
  }

  const goalType = profile?.goal_type || "maintain";
  const weeklyRateKg = Number(profile?.weekly_weight_change_target_kg || 0);

  const baseCalories = suggestCalories({ goalType, weeklyRateKg, weightKg });

  const trainingCals = baseCalories;
  const restCals = Math.max(1200, baseCalories - 250);
  const highCals = baseCalories + 200;

  const training = macrosFromCalories({ calories: trainingCals, weightKg });
  const rest = macrosFromCalories({ calories: restCals, weightKg });
  const high = macrosFromCalories({ calories: highCals, weightKg });

  const targets = [
    { user_id, day_type: "training", calories: training.calories, protein_g: training.proteinG, carbs_g: training.carbsG, fats_g: training.fatG },
    { user_id, day_type: "rest", calories: rest.calories, protein_g: rest.proteinG, carbs_g: rest.carbsG, fats_g: rest.fatG },
    { user_id, day_type: "high", calories: high.calories, protein_g: high.proteinG, carbs_g: high.carbsG, fats_g: high.fatG }
  ];

  const { error: upsertErr } = await supabase
    .from("nutrition_day_targets")
    .upsert(targets, { onConflict: "user_id,day_type" });

  if (upsertErr) {
    return res.status(400).json({ ok: false, error: upsertErr.message });
  }

  const weekStart = startOfWeekMonday(new Date());

  const { data: flexExisting, error: flexReadErr } = await supabase
    .from("weekly_flex_rules")
    .select("id, week_start, base_cheat_meals, banked_cheat_meals, used_cheat_meals")
    .eq("user_id", user_id)
    .maybeSingle();

  if (flexReadErr && flexReadErr.code !== "PGRST116") {
    return res.status(400).json({ ok: false, error: flexReadErr.message });
  }

  if (!flexExisting) {
    const { error: flexUpsertErr } = await supabase
      .from("weekly_flex_rules")
      .upsert(
        {
          user_id,
          base_cheat_meals: 1,
          banked_cheat_meals: 0,
          used_cheat_meals: 0,
          alcohol_units_week: 0,
          week_start: weekStart
        },
        { onConflict: "user_id" }
      );

    if (flexUpsertErr) {
      return res.status(400).json({ ok: false, error: flexUpsertErr.message });
    }
  } else if (flexExisting.week_start !== weekStart) {
    const unusedLastWeek = Math.max(
      0,
      (Number(flexExisting.base_cheat_meals || 0) + Number(flexExisting.banked_cheat_meals || 0)) -
        Number(flexExisting.used_cheat_meals || 0)
    );
    const newBank = Math.min(1, unusedLastWeek > 0 ? 1 : 0);

    const { error: flexUpdateErr } = await supabase
      .from("weekly_flex_rules")
      .update({
        banked_cheat_meals: newBank,
        used_cheat_meals: 0,
        alcohol_units_week: 0,
        week_start: weekStart
      })
      .eq("user_id", user_id);

    if (flexUpdateErr) {
      return res.status(400).json({ ok: false, error: flexUpdateErr.message });
    }
  }

  return res.json({
    ok: true,
    targets: {
      training,
      rest,
      high
    }
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
