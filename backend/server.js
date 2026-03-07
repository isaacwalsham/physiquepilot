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
const foodSearchCache = new LRUCache({ max: 1500, ttl: 1000 * 60 });

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
  "http://localhost:5174",
  "http://localhost:3000",
  "https://physiquepilot.com",
  "https://www.physiquepilot.com",
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /\.netlify\.app$/
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowed = allowedOrigins.some(o =>
      typeof o === "string" ? o === origin : o.test(origin)
    );

    if (allowed) return callback(null, true);

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
};

app.use(cors(corsOptions));

app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "1mb" }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests, please slow down." }
});
app.use(globalLimiter);

const authenticate = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }
  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
  req.userId = data.user.id;
  next();
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    req.userId = data?.user?.id || null;
  } else {
    req.userId = null;
  }
  next();
};

const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

const normalizeUnit = (unit) => String(unit || "").trim().toLowerCase();
const DB_ALLOWED_UNITS = new Set(["g", "kg", "oz", "lb", "ml", "l"]);
const DEFAULT_MEAL_SEGMENTS = [
  { key: "breakfast", label: "Breakfast", position: 1 },
  { key: "lunch", label: "Lunch", position: 2 },
  { key: "dinner", label: "Dinner", position: 3 },
  { key: "snacks", label: "Snacks", position: 4 }
];

const normalizeMealSegmentKey = (segment) => {
  const key = String(segment || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return key || "snacks";
};

const parseSourceTextMeta = (sourceText) => {
  const raw = String(sourceText || "").trim();
  if (!raw) return {};
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf("=");
      if (idx <= 0) return acc;
      const key = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (!key) return acc;
      acc[key] = value;
      return acc;
    }, {});
};

const sanitizeMetaValue = (value, maxLen = 160) =>
  String(value ?? "")
    .replace(/[;=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);

const mergeSourceTextMeta = (sourceText, patch = {}) => {
  const base = parseSourceTextMeta(sourceText);
  for (const [k, v] of Object.entries(patch || {})) {
    const key = String(k || "").trim().toLowerCase();
    if (!key) continue;
    const value = String(v ?? "").trim();
    if (!value) {
      delete base[key];
    } else {
      base[key] = value;
    }
  }
  const parts = Object.entries(base).map(([k, v]) => `${k}=${v}`);
  return parts.join(";");
};

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

const estimateItemUnitGrams = ({ food_name, unit }) => {
  const u = normalizeUnit(unit);
  if (!["item", "items", "each", "ea", "serv", "serving", "servings"].includes(u)) return null;
  const name = String(food_name || "").toLowerCase();

  if (name.includes("egg")) {
    if (name.includes("white")) return 33;
    if (name.includes("yolk")) return 17;
    return 50;
  }
  if (name.includes("banana")) return 118;
  if (name.includes("apple")) return 182;
  if (name.includes("orange")) return 131;

  // Conservative generic fallback for unknown item-sized entries.
  return u === "serv" || u === "serving" || u === "servings" ? 100 : 75;
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
  carbs_g: { male: null, female: null, any: null }, // inherit from macro goals
  fiber_g: { male: 38, female: 38, any: 38 },
  starch_g: { male: null, female: null, any: null }, // no target
  sugars_g: { male: null, female: null, any: null }, // no target
  added_sugars_g: { male: null, female: null, any: null }, // no target
  fat_g: { male: null, female: null, any: null }, // inherit from macro goals
  monounsaturated_g: { male: null, female: null, any: null }, // no target
  monounsaturated_fat_g: { male: null, female: null, any: null }, // no target
  polyunsaturated_g: { male: null, female: null, any: null }, // no target
  polyunsaturated_fat_g: { male: null, female: null, any: null }, // no target
  omega3_g: { male: 1.6, female: 1.6, any: 1.6 },
  omega_3_g: { male: 1.6, female: 1.6, any: 1.6 },
  omega6_g: { male: 17, female: 17, any: 17 },
  omega_6_g: { male: 17, female: 17, any: 17 },
  sat_fat_g: { male: null, female: null, any: null }, // no target
  saturated_fat_g: { male: null, female: null, any: null }, // no target
  trans_fat_g: { male: null, female: null, any: null }, // no target
  cholesterol_mg: { male: null, female: null, any: null }, // no target
  protein_g: { male: null, female: null, any: null }, // inherit from macro goals
  cystine_g: { male: 0.7, female: 0.7, any: 0.7 },
  histidine_g: { male: 1.1, female: 1.1, any: 1.1 },
  isoleucine_g: { male: 1.5, female: 1.5, any: 1.5 },
  leucine_g: { male: 3.3, female: 3.3, any: 3.3 },
  lysine_g: { male: 3.0, female: 3.0, any: 3.0 },
  methionine_g: { male: 0.7, female: 0.7, any: 0.7 },
  phenylalanine_g: { male: 1.3, female: 1.3, any: 1.3 },
  threonine_g: { male: 1.6, female: 1.6, any: 1.6 },
  tryptophan_g: { male: 0.4, female: 0.4, any: 0.4 },
  tyrosine_g: { male: 1.3, female: 1.3, any: 1.3 },
  valine_g: { male: 1.9, female: 1.9, any: 1.9 },
  thiamin_b1_mg: { male: 1.2, female: 1.2, any: 1.2 },
  riboflavin_b2_mg: { male: 1.3, female: 1.3, any: 1.3 },
  vitamin_b3_mg: { male: 16, female: 16, any: 16 },
  pantothenic_b5_mg: { male: 5, female: 5, any: 5 },
  vitamin_b6_mg: { male: 1.3, female: 1.3, any: 1.3 },
  vitamin_b12_ug: { male: 2.4, female: 2.4, any: 2.4 },
  folate_ug: { male: 400, female: 400, any: 400 },
  vitamin_a_ug: { male: 900, female: 900, any: 900 },
  vitamin_c_mg: { male: 90, female: 90, any: 90 },
  vitamin_d_ug: { male: 15, female: 15, any: 15 }, // 600 IU
  vitamin_d_iu: { male: 600, female: 600, any: 600 },
  vitamin_e_mg: { male: 15, female: 15, any: 15 },
  vitamin_k_ug: { male: 120, female: 120, any: 120 },
  calcium_mg: { male: 1000, female: 1000, any: 1000 },
  copper_mg: { male: 0.9, female: 0.9, any: 0.9 },
  iron_mg: { male: 8, female: 8, any: 8 },
  magnesium_mg: { male: 400, female: 400, any: 400 },
  manganese_mg: { male: 2.3, female: 2.3, any: 2.3 },
  phosphorus_mg: { male: 700, female: 700, any: 700 },
  potassium_mg: { male: 3400, female: 3400, any: 3400 },
  selenium_ug: { male: 55, female: 55, any: 55 },
  sodium_mg: { male: 1500, female: 1500, any: 1500 },
  salt_g: { male: 3.75, female: 3.75, any: 3.75 },
  zinc_mg: { male: 11, female: 11, any: 11 },
  vitamin_b1_mg: { male: 1.2, female: 1.2, any: 1.2 },
  vitamin_b2_mg: { male: 1.3, female: 1.3, any: 1.3 },
  vitamin_b5_mg: { male: 5, female: 5, any: 5 },
  alcohol_g: { any: 0 }
};

const INHERIT_FROM_MACRO_CODES = new Set(["protein_g", "carbs_g", "fat_g"]);

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
  if (INHERIT_FROM_MACRO_CODES.has(String(code || ""))) return null;
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

  const estimatedDirect = estimateItemUnitGrams({ food_name: item.food_name, unit: item.unit });
  if (estimatedDirect != null) return estimatedDirect * toNum(item.amount);

  if (!(item.food_id || item.user_food_id)) return null;
  const gramsPerUnit = await fetchUnitConversionGrams({
    food_id: item.food_id,
    user_food_id: item.user_food_id,
    unit: item.unit,
    conversionCache
  });
  if (gramsPerUnit == null) return null;
  const fromTable = gramsPerUnit * toNum(item.amount);
  // Guard against obviously bad serving conversion rows (e.g. tiny fractions for whole items).
  if (normalizeUnit(item.unit) === "serv" && fromTable > 0 && fromTable < 5) {
    const estimatedFallback = estimateItemUnitGrams({ food_name: item.food_name, unit: item.unit });
    if (estimatedFallback != null) return estimatedFallback * toNum(item.amount);
  }
  return fromTable;
};

const normalizeItemForPersistence = (stagedItem) => {
  const originalUnit = normalizeUnit(stagedItem?.unit);
  const originalAmount = toNum(stagedItem?.amount);
  const grams = toNum(stagedItem?.grams);
  if (DB_ALLOWED_UNITS.has(originalUnit)) {
    return {
      amount: originalAmount,
      unit: originalUnit,
      source_text: null
    };
  }
  if (grams > 0) {
    return {
      amount: grams,
      unit: "g",
      source_text: `original_amount=${originalAmount};original_unit=${originalUnit || "unknown"}`
    };
  }
  return {
    amount: originalAmount,
    unit: "g",
    source_text: `original_amount=${originalAmount};original_unit=${originalUnit || "unknown"};coerced_without_grams=1`
  };
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
  "monounsaturated_g",
  "polyunsaturated_g",
  "omega3_g",
  "omega6_g",
  "sat_fat_g",
  "trans_fat_g",
  "cholesterol_mg",
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
  "energy_kcal", "alcohol_g",
  "carbs_g", "fiber_g", "starch_g", "sugars_g", "added_sugars_g",
  "fat_g", "monounsaturated_g", "polyunsaturated_g", "omega3_g", "omega6_g", "sat_fat_g", "trans_fat_g", "cholesterol_mg",
  "protein_g", "cystine_g", "histidine_g", "isoleucine_g", "leucine_g", "lysine_g", "methionine_g", "phenylalanine_g", "threonine_g", "tryptophan_g", "tyrosine_g", "valine_g",
  "thiamin_b1_mg", "riboflavin_b2_mg", "vitamin_b3_mg", "pantothenic_b5_mg", "vitamin_b6_mg", "vitamin_b12_ug", "folate_ug", "vitamin_a_ug", "vitamin_c_mg", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug",
  "calcium_mg", "copper_mg", "iron_mg", "magnesium_mg", "manganese_mg", "phosphorus_mg", "potassium_mg", "selenium_ug", "sodium_mg", "zinc_mg"
]);
const NON_MACRO_TRACKED_NUTRIENT_CODES = KEY_NUTRIENT_CODES.filter(
  (code) => !MACRO_NUTRIENT_CODES.has(code) && code !== "alcohol_g"
);

const RAW_TO_CANONICAL_NUTRIENT_CODE = {
  vitamin_b1_mg: "thiamin_b1_mg",
  vitamin_b2_mg: "riboflavin_b2_mg",
  vitamin_b5_mg: "pantothenic_b5_mg",
  saturated_fat_g: "sat_fat_g",
  monounsaturated_fat_g: "monounsaturated_g",
  polyunsaturated_fat_g: "polyunsaturated_g",
  omega_3_g: "omega3_g",
  omega_6_g: "omega6_g",
  usda_1008: "energy_kcal",
  usda_221: "alcohol_g",
  usda_262: "caffeine_mg",
  usda_1051: "water_g",
  usda_1005: "carbs_g",
  usda_1079: "fiber_g",
  usda_2092: "starch_g",
  usda_2000: "sugars_g",
  usda_1235: "added_sugars_g",
  usda_1004: "fat_g",
  usda_645: "monounsaturated_g",
  usda_646: "polyunsaturated_g",
  usda_1258: "sat_fat_g",
  usda_1257: "trans_fat_g",
  usda_1253: "cholesterol_mg",
  usda_1003: "protein_g",
  usda_1227: "cystine_g",
  usda_1221: "histidine_g",
  usda_1222: "isoleucine_g",
  usda_1223: "leucine_g",
  usda_1224: "lysine_g",
  usda_1225: "methionine_g",
  usda_1226: "phenylalanine_g",
  usda_1228: "threonine_g",
  usda_1220: "tryptophan_g",
  usda_1232: "tyrosine_g",
  usda_1233: "valine_g",
  usda_1165: "thiamin_b1_mg",
  usda_1166: "riboflavin_b2_mg",
  usda_1167: "vitamin_b3_mg",
  usda_1170: "pantothenic_b5_mg",
  usda_1175: "vitamin_b6_mg",
  usda_1178: "vitamin_b12_ug",
  usda_1177: "folate_ug",
  usda_1106: "vitamin_a_ug",
  usda_1162: "vitamin_c_mg",
  usda_1110: "vitamin_d_ug",
  usda_1109: "vitamin_e_mg",
  usda_1185: "vitamin_k_ug",
  usda_1087: "calcium_mg",
  usda_1088: "copper_mg",
  usda_1089: "iron_mg",
  usda_1090: "magnesium_mg",
  usda_1098: "manganese_mg",
  usda_1091: "phosphorus_mg",
  usda_1092: "potassium_mg",
  usda_1103: "selenium_ug",
  usda_1093: "sodium_mg",
  usda_1095: "zinc_mg"
};

const normalizeTrackedNutrientAmountMap = (inputMap) => {
  const amounts = new Map();
  for (const [rawCode, rawAmount] of inputMap.entries()) {
    const codeRaw = String(rawCode || "").trim();
    const code = RAW_TO_CANONICAL_NUTRIENT_CODE[codeRaw] || codeRaw;
    if (!code) continue;
    amounts.set(code, toNum(amounts.get(code)) + toNum(rawAmount));
  }

  return amounts;
};

const normalizePer100gNutrientRows = (rows = []) => {
  const amountMap = new Map();
  for (const row of rows || []) {
    const code = String(row?.nutrient_code || "").trim();
    if (!code) continue;
    amountMap.set(code, toNum(amountMap.get(code)) + toNum(row?.amount_per_100g));
  }
  const normalizedMap = normalizeTrackedNutrientAmountMap(amountMap);
  return Array.from(normalizedMap.entries()).map(([nutrient_code, amount_per_100g]) => ({
    nutrient_code,
    amount_per_100g
  }));
};

const normalizeText = (x) =>
  String(x || "")
    .trim()
    .toLowerCase();

const withTimeout = async (promiseFactory, timeoutMs, fallbackValue) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await promiseFactory(controller.signal);
  } catch (_e) {
    return fallbackValue;
  } finally {
    clearTimeout(timeout);
  }
};

const SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "or", "the", "with", "without", "in", "on", "at", "to", "for",
  "of", "from", "by", "fresh", "raw", "cooked", "boiled", "fried", "roasted"
]);

const SEARCH_QUERY_NOISE_WORDS = new Set(["percent", "pc", "fat"]);
const SEARCH_DISH_HINT_WORDS = new Set([
  "with",
  "homemade",
  "takeaway",
  "burger",
  "biryani",
  "lasagne",
  "pizza",
  "sandwich",
  "soup",
  "sauce",
  "chasseur",
  "fricassee"
]);
const SEARCH_PREPARATION_WORDS = new Set([
  "boiled",
  "fried",
  "roasted",
  "grilled",
  "stewed",
  "microwaved",
  "scrambled",
  "poached",
  "baked",
  "cooked"
]);
const SEARCH_EGG_ALT_SPECIES_WORDS = new Set(["duck", "quail", "turkey", "goose"]);

const singularizeWord = (w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w);

const expandSearchAliases = (token) => {
  const t = singularizeWord(String(token || "").toLowerCase().trim());
  if (!t) return [];
  const out = new Set([t]);
  if (t === "mince") out.add("ground");
  if (t === "ground") out.add("mince");
  if (t === "nando") out.add("nandos");
  if (t === "nandos") out.add("nando");
  if (t === "pepper") out.add("peppers");
  if (t === "peppers") out.add("pepper");
  return Array.from(out);
};

const tokenizeSearchQuery = (text, { keepNumbers = false } = {}) => {
  const words = String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singularizeWord);
  if (words.length === 0) return [];
  const filtered = words.filter((w) => {
    if (!keepNumbers && /^[0-9]+$/.test(w)) return false;
    if (SEARCH_STOP_WORDS.has(w)) return false;
    if (SEARCH_QUERY_NOISE_WORDS.has(w)) return false;
    return true;
  });
  return filtered.length > 0 ? filtered : words.filter((w) => (keepNumbers ? true : !/^[0-9]+$/.test(w)));
};

const buildSearchTermVariants = (term) => {
  const base = String(term || "").trim().toLowerCase();
  if (!base) return [];
  const variants = new Set([base]);
  const replacements = [
    [/mince/g, "ground"],
    [/ground/g, "mince"]
  ];
  for (const [from, to] of replacements) {
    if (from.test(base)) variants.add(base.replace(from, to));
  }
  return Array.from(variants).slice(0, 3);
};

const normalizeUkFoodQuery = (term) => {
  let out = String(term || "").trim().toLowerCase();
  if (!out) return "";
  out = out.replace(/\bbrocolli\b/g, "broccoli");
  out = out.replace(/\bchilli\b/g, "chili");
  out = out.replace(/\b(\d+)\s*%\s*fat\b/g, "$1 percent fat");
  out = out.replace(/\b(\d+)\s*%\b/g, "$1 percent");
  out = out.replace(/\s+/g, " ").trim();
  return out;
};

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
  if (name.includes("methionine") && name.includes("cystine")) return "methionine_cystine_g";
  if (name === "phenylalanine") return "phenylalanine_g";
  if (name === "tyrosine") return "tyrosine_g";
  if (name.includes("phenylalanine") && name.includes("tyrosine")) return "phenylalanine_tyrosine_g";
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

  const normalizedCombined = normalizeTrackedNutrientAmountMap(combined);

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

  for (const [code, amount] of normalizedCombined.entries()) {
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
      const meal_segment = normalizeMealSegmentKey(it?.segment || it?.meal_segment || it?.mealSegment || "snacks");
      const meal_instance_id = sanitizeMetaValue(it?.meal_instance_id || it?.mealInstanceId || "", 80);
      const meal_name = sanitizeMetaValue(it?.meal_name || it?.mealName || "", 120);
      return { food_name, amount, unit, cooked_state, food_id, user_food_id, meal_segment, meal_instance_id, meal_name };
    })
    .filter((it) => it.food_name && Number.isFinite(it.amount) && it.amount > 0 && it.unit && it.cooked_state);
};

const normalizeMealSegmentsInput = (segments = []) => {
  const rows = Array.isArray(segments) ? segments : [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const labelRaw = typeof row === "string" ? row : row?.label || row?.name || row?.segment || row?.key || "";
    const label = String(labelRaw || "").trim();
    if (!label) continue;
    const keySource = typeof row === "string" ? row : row?.key || label;
    let key = normalizeMealSegmentKey(keySource);
    if (!key) key = `segment_${i + 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      segment_key: key,
      label: label.slice(0, 60),
      position: Number.isFinite(Number(row?.position)) ? Number(row.position) : out.length + 1
    });
  }
  if (out.length === 0) return DEFAULT_MEAL_SEGMENTS.map((x) => ({ ...x, segment_key: x.key })).map((x) => ({ segment_key: x.segment_key, label: x.label, position: x.position }));
  return out
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((x, idx) => ({ ...x, position: idx + 1 }));
};

const ensureDefaultMealPreset = async (user_id) => {
  const { data: presets, error: presetsErr } = await supabase
    .from("nutrition_meal_presets")
    .select("id, name, is_default, created_at, updated_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: true });
  if (presetsErr) throw new Error(presetsErr.message);

  let list = Array.isArray(presets) ? presets : [];
  if (list.length === 0) {
    const { data: insertedPreset, error: insertPresetErr } = await supabase
      .from("nutrition_meal_presets")
      .insert({
        user_id,
        name: "Standard",
        is_default: true
      })
      .select("id, name, is_default, created_at, updated_at")
      .single();
    if (insertPresetErr) throw new Error(insertPresetErr.message);

    const presetId = insertedPreset.id;
    const segmentPayload = DEFAULT_MEAL_SEGMENTS.map((seg) => ({
      preset_id: presetId,
      segment_key: seg.key,
      label: seg.label,
      position: seg.position
    }));
    const { error: segErr } = await supabase.from("nutrition_meal_preset_segments").insert(segmentPayload);
    if (segErr) throw new Error(segErr.message);
    list = [insertedPreset];
  }

  const presetIds = list.map((p) => p.id).filter(Boolean);
  const { data: segmentRows, error: segmentErr } = await supabase
    .from("nutrition_meal_preset_segments")
    .select("id, preset_id, segment_key, label, position")
    .in("preset_id", presetIds)
    .order("position", { ascending: true });
  if (segmentErr) throw new Error(segmentErr.message);

  const segByPreset = new Map();
  for (const row of segmentRows || []) {
    if (!segByPreset.has(row.preset_id)) segByPreset.set(row.preset_id, []);
    segByPreset.get(row.preset_id).push({
      id: row.id,
      key: row.segment_key,
      label: row.label,
      position: Number(row.position || 0)
    });
  }

  const normalized = list.map((preset) => {
    const segs = segByPreset.get(preset.id) || [];
    const finalSegments = segs.length > 0
      ? segs.sort((a, b) => Number(a.position) - Number(b.position)).map((s, idx) => ({ ...s, position: idx + 1 }))
      : DEFAULT_MEAL_SEGMENTS.map((seg) => ({ key: seg.key, label: seg.label, position: seg.position }));
    return {
      id: preset.id,
      name: preset.name,
      is_default: Boolean(preset.is_default),
      segments: finalSegments
    };
  });

  if (!normalized.some((p) => p.is_default) && normalized[0]) {
    const first = normalized[0];
    await supabase.from("nutrition_meal_presets").update({ is_default: true }).eq("id", first.id).eq("user_id", user_id);
    first.is_default = true;
  }

  return normalized;
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

  const [userFoodsNameRes, userFoodsBrandRes, foodsNameRes, foodsBrandRes, userFoodsTokenNameRes, userFoodsTokenBrandRes, foodsTokenNameRes, foodsTokenBrandRes] = await Promise.all([
    user_id
      ? supabase
          .from("user_foods")
          .select("id, name, brand")
          .eq("user_id", user_id)
          .ilike("name", fullPattern)
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    user_id
      ? supabase
          .from("user_foods")
          .select("id, name, brand")
          .eq("user_id", user_id)
          .ilike("brand", fullPattern)
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("foods")
      .select("id, name, brand")
      .ilike("name", fullPattern)
      .limit(24),
    supabase
      .from("foods")
      .select("id, name, brand")
      .ilike("brand", fullPattern)
      .limit(24),
    user_id && token
      ? supabase
          .from("user_foods")
          .select("id, name, brand")
          .eq("user_id", user_id)
          .ilike("name", tokenPattern)
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    user_id && token
      ? supabase
          .from("user_foods")
          .select("id, name, brand")
          .eq("user_id", user_id)
          .ilike("brand", tokenPattern)
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    token
      ? supabase
          .from("foods")
          .select("id, name, brand")
          .ilike("name", tokenPattern)
          .limit(24)
      : Promise.resolve({ data: [], error: null }),
    token
      ? supabase
          .from("foods")
          .select("id, name, brand")
          .ilike("brand", tokenPattern)
          .limit(24)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (userFoodsNameRes.error) throw new Error(userFoodsNameRes.error.message);
  if (userFoodsBrandRes.error) throw new Error(userFoodsBrandRes.error.message);
  if (foodsNameRes.error) throw new Error(foodsNameRes.error.message);
  if (foodsBrandRes.error) throw new Error(foodsBrandRes.error.message);
  if (userFoodsTokenNameRes.error) throw new Error(userFoodsTokenNameRes.error.message);
  if (userFoodsTokenBrandRes.error) throw new Error(userFoodsTokenBrandRes.error.message);
  if (foodsTokenNameRes.error) throw new Error(foodsTokenNameRes.error.message);
  if (foodsTokenBrandRes.error) throw new Error(foodsTokenBrandRes.error.message);

  const mergeUniqueById = (rows = []) => {
    const m = new Map();
    for (const row of rows) {
      if (row?.id && !m.has(row.id)) m.set(row.id, row);
    }
    return Array.from(m.values());
  };

  const userFoods = mergeUniqueById([
    ...(userFoodsNameRes.data || []),
    ...(userFoodsBrandRes.data || []),
    ...(userFoodsTokenNameRes.data || []),
    ...(userFoodsTokenBrandRes.data || [])
  ]);
  const foods = mergeUniqueById([
    ...(foodsNameRes.data || []),
    ...(foodsBrandRes.data || []),
    ...(foodsTokenNameRes.data || []),
    ...(foodsTokenBrandRes.data || [])
  ]);
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
    .select("id, food_name, amount, unit, grams, cooked_state, source, source_text, food_id, user_food_id, calories, protein_g, carbs_g, fats_g")
    .eq("user_id", user_id)
    .eq("log_date", log_date)
    .order("created_at", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);

  const items = (Array.isArray(itemRows) ? itemRows : []).map((row) => {
    const meta = parseSourceTextMeta(row?.source_text);
    const meal_segment = normalizeMealSegmentKey(meta?.meal_segment || "snacks");
    const meal_instance_id = sanitizeMetaValue(meta?.meal_instance_id || "", 80) || null;
    const meal_name = sanitizeMetaValue(meta?.meal_name || "", 120) || null;
    return { ...row, meal_segment, meal_instance_id, meal_name };
  });
  const itemById = new Map(items.map((it) => [it.id, it]));
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
          .select("item_id, nutrient_code, amount")
          .in("item_id", itemIds)
      : { data: [], error: null };
  if (nErr) throw new Error(nErr.message);

  const amountByCode = new Map();
  const segmentAmountByCode = new Map();
  for (const row of nRows || []) {
    const itemId = row?.item_id;
    const code = String(row?.nutrient_code || "");
    if (!code) continue;
    amountByCode.set(code, toNum(amountByCode.get(code)) + toNum(row?.amount));

    const item = itemId ? itemById.get(itemId) : null;
    const seg = normalizeMealSegmentKey(item?.meal_segment || "snacks");
    if (!segmentAmountByCode.has(seg)) segmentAmountByCode.set(seg, new Map());
    const segMap = segmentAmountByCode.get(seg);
    segMap.set(code, toNum(segMap.get(code)) + toNum(row?.amount));
  }

  totals.alcohol_g = Math.max(0, Math.round(toNum(amountByCode.get("alcohol_g")) * 10) / 10);

  const segmentTotalsByKey = {};
  for (const it of items) {
    const seg = normalizeMealSegmentKey(it?.meal_segment || "snacks");
    if (!segmentTotalsByKey[seg]) {
      segmentTotalsByKey[seg] = { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, alcohol_g: 0 };
    }
    segmentTotalsByKey[seg].calories += Math.max(0, Math.round(toNum(it?.calories)));
    segmentTotalsByKey[seg].protein_g += Math.max(0, Math.round(toNum(it?.protein_g)));
    segmentTotalsByKey[seg].carbs_g += Math.max(0, Math.round(toNum(it?.carbs_g)));
    segmentTotalsByKey[seg].fats_g += Math.max(0, Math.round(toNum(it?.fats_g)));
  }
  for (const [seg, segMap] of segmentAmountByCode.entries()) {
    if (!segmentTotalsByKey[seg]) {
      segmentTotalsByKey[seg] = { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, alcohol_g: 0 };
    }
    segmentTotalsByKey[seg].alcohol_g = Math.max(0, Math.round(toNum(segMap.get("alcohol_g")) * 10) / 10);
  }

  const fallbackUnitForCode = (code) => {
    if (code.endsWith("_mg")) return "mg";
    if (code.endsWith("_ug")) return "ug";
    if (code.endsWith("_kcal")) return "kcal";
    return "g";
  };
  const fallbackSortGroupForCode = (code) => {
    if (["energy_kcal", "alcohol_g", "caffeine_mg", "water_g"].includes(code)) return "General";
    if (["carbs_g", "fiber_g", "starch_g", "sugars_g", "added_sugars_g", "net_carbs_g"].includes(code)) return "Carbohydrates";
    if (["fat_g", "monounsaturated_g", "polyunsaturated_g", "omega3_g", "omega6_g", "sat_fat_g", "trans_fat_g", "cholesterol_mg"].includes(code)) return "Lipids";
    if (["protein_g", "cystine_g", "histidine_g", "isoleucine_g", "leucine_g", "lysine_g", "methionine_g", "phenylalanine_g", "threonine_g", "tryptophan_g", "tyrosine_g", "valine_g"].includes(code)) return "Protein";
    if (["thiamin_b1_mg", "riboflavin_b2_mg", "vitamin_b3_mg", "pantothenic_b5_mg", "vitamin_b6_mg", "vitamin_b12_ug", "folate_ug", "vitamin_a_ug", "vitamin_c_mg", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug"].includes(code)) return "Vitamins";
    if (["calcium_mg", "copper_mg", "iron_mg", "magnesium_mg", "manganese_mg", "phosphorus_mg", "potassium_mg", "selenium_ug", "sodium_mg", "zinc_mg"].includes(code)) return "Minerals";
    return "Other";
  };

  const nutrientCodes = new Set([
    ...Array.from(ALLOWED_TRACKED_NUTRIENT_CODES),
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
        unit: meta.unit || fallbackUnitForCode(code),
        sort_group: meta.sort_group || fallbackSortGroupForCode(code),
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

  const segmentNutrientsByKey = {};
  for (const [seg, segMap] of segmentAmountByCode.entries()) {
    const segmentNutrients = Array.from(nutrientCodes)
      .filter((code) => Boolean(code) && ALLOWED_TRACKED_NUTRIENT_CODES.has(String(code)))
      .map((code) => {
        const meta = metaByCode.get(code) || {};
        return {
          code,
          label: meta.label || code,
          unit: meta.unit || fallbackUnitForCode(code),
          sort_group: meta.sort_group || fallbackSortGroupForCode(code),
          sort_order: Number.isFinite(Number(meta.sort_order)) ? Number(meta.sort_order) : 9999,
          amount: toNum(segMap.get(code))
        };
      })
      .sort((a, b) => {
        if (String(a.sort_group) !== String(b.sort_group)) {
          return String(a.sort_group).localeCompare(String(b.sort_group));
        }
        return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      });
    segmentNutrientsByKey[seg] = segmentNutrients;
  }

  return { totals, nutrients, items, segment_totals: segmentTotalsByKey, segment_nutrients: segmentNutrientsByKey };
};

const searchUsdaFoods = async ({ term, limit = 8, signal = undefined }) => {
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
    body: JSON.stringify(payload),
    signal
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

const normalizeOffUnit = (u) =>
  String(u || "")
    .replace("µ", "u")
    .trim()
    .toLowerCase();

const convertOffAmountToTargetUnit = ({ amount, fromUnit, targetUnit }) => {
  const n = toNum(amount);
  if (!Number.isFinite(n)) return 0;
  const from = normalizeOffUnit(fromUnit);
  const target = normalizeOffUnit(targetUnit);
  if (!target || from === target || !from) return n;

  const gramsLike = new Set(["g", "gram", "grams"]);
  const mgLike = new Set(["mg", "milligram", "milligrams"]);
  const ugLike = new Set(["ug", "mcg", "microgram", "micrograms"]);

  if (gramsLike.has(from) && mgLike.has(target)) return n * 1000;
  if (gramsLike.has(from) && ugLike.has(target)) return n * 1000000;
  if (mgLike.has(from) && gramsLike.has(target)) return n / 1000;
  if (mgLike.has(from) && ugLike.has(target)) return n * 1000;
  if (ugLike.has(from) && gramsLike.has(target)) return n / 1000000;
  if (ugLike.has(from) && mgLike.has(target)) return n / 1000;
  return n;
};

const parseOffNutrimentsToCanonicalMap = (nutriments = {}) => {
  const out = new Map();
  const add = (key100g, code, targetUnit = "g", fallbackUnit = "g") => {
    const raw = nutriments?.[key100g];
    if (raw == null || raw === "") return;
    const unitKey = String(key100g).replace(/_100g$/, "_unit");
    const fromUnit = nutriments?.[unitKey] || fallbackUnit;
    const converted = convertOffAmountToTargetUnit({ amount: raw, fromUnit, targetUnit });
    out.set(code, Math.max(0, toNum(out.get(code)) + toNum(converted)));
  };

  add("energy-kcal_100g", "energy_kcal", "kcal", "kcal");
  add("proteins_100g", "protein_g", "g", "g");
  add("carbohydrates_100g", "carbs_g", "g", "g");
  add("fat_100g", "fat_g", "g", "g");
  add("fiber_100g", "fiber_g", "g", "g");
  add("sugars_100g", "sugars_g", "g", "g");
  add("sodium_100g", "sodium_mg", "mg", "g");
  add("salt_100g", "salt_g", "g", "g");
  add("saturated-fat_100g", "sat_fat_g", "g", "g");
  add("trans-fat_100g", "trans_fat_g", "g", "g");
  add("cholesterol_100g", "cholesterol_mg", "mg", "g");
  add("monounsaturated-fat_100g", "monounsaturated_g", "g", "g");
  add("polyunsaturated-fat_100g", "polyunsaturated_g", "g", "g");
  add("omega-3-fat_100g", "omega3_g", "g", "g");
  add("omega-6-fat_100g", "omega6_g", "g", "g");

  add("vitamin-a_100g", "vitamin_a_ug", "ug", "ug");
  add("vitamin-c_100g", "vitamin_c_mg", "mg", "mg");
  add("vitamin-d_100g", "vitamin_d_ug", "ug", "ug");
  add("vitamin-e_100g", "vitamin_e_mg", "mg", "mg");
  add("vitamin-k_100g", "vitamin_k_ug", "ug", "ug");
  add("vitamin-b1_100g", "thiamin_b1_mg", "mg", "mg");
  add("vitamin-b2_100g", "riboflavin_b2_mg", "mg", "mg");
  add("vitamin-b6_100g", "vitamin_b6_mg", "mg", "mg");
  add("vitamin-b12_100g", "vitamin_b12_ug", "ug", "ug");
  add("vitamin-pp_100g", "vitamin_b3_mg", "mg", "mg");
  add("pantothenic-acid_100g", "pantothenic_b5_mg", "mg", "mg");
  add("folates_100g", "folate_ug", "ug", "ug");

  add("calcium_100g", "calcium_mg", "mg", "mg");
  add("copper_100g", "copper_mg", "mg", "mg");
  add("iron_100g", "iron_mg", "mg", "mg");
  add("magnesium_100g", "magnesium_mg", "mg", "mg");
  add("manganese_100g", "manganese_mg", "mg", "mg");
  add("phosphorus_100g", "phosphorus_mg", "mg", "mg");
  add("potassium_100g", "potassium_mg", "mg", "mg");
  add("selenium_100g", "selenium_ug", "ug", "ug");
  add("zinc_100g", "zinc_mg", "mg", "mg");
  add("caffeine_100g", "caffeine_mg", "mg", "mg");
  add("water_100g", "water_g", "g", "g");

  if (toNum(out.get("net_carbs_g")) <= 0) {
    const carbs = toNum(out.get("carbs_g"));
    const fiber = toNum(out.get("fiber_g"));
    if (carbs > 0 || fiber > 0) out.set("net_carbs_g", Math.max(0, carbs - fiber));
  }
  if (toNum(out.get("sodium_mg")) <= 0 && toNum(out.get("salt_g")) > 0) {
    out.set("sodium_mg", toNum(out.get("salt_g")) * 393.4);
  }

  return normalizeTrackedNutrientAmountMap(out);
};

const searchOpenFoodFactsFoods = async ({ term, limit = 8, country = "united-kingdom", signal = undefined }) => {
  const q = String(term || "").trim();
  if (!q) return [];
  const normalizeWords = (x) =>
    String(x || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  const queryTokensRaw = tokenizeSearchQuery(q);
  const queryTokens = queryTokensRaw.length > 0 ? queryTokensRaw : normalizeWords(q).map(singularizeWord);
  const queryNorm = queryTokens.join(" ");
  const queryTokenGroups = queryTokens.map((token) => expandSearchAliases(token));
  const requiredHits = queryTokenGroups.length >= 3 ? 2 : 1;
  const countryFilter = String(country || "").trim();
  let url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${Math.min(80, Math.max(20, Number(limit) * 4))}`;
  if (countryFilter) {
    url += `&tagtype_0=countries&tag_contains_0=contains&tag_0=${encodeURIComponent(countryFilter)}`;
  }
  const r = await fetch(url, {
    headers: {
      "User-Agent": "PhysiquePilot/1.0 (nutrition search; contact: support@physiquepilot.com)"
    },
    signal
  });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  const products = Array.isArray(j?.products) ? j.products : [];
  return products
    .map((p) => {
      const name = String(p?.product_name_en || p?.product_name || "").trim();
      const brand = String(p?.brands || "").split(",")[0]?.trim() || null;
      const text = `${name} ${brand || ""}`.toLowerCase();
      const textTokens = new Set(normalizeWords(text).map(singularizeWord));
      const tokenHits = queryTokenGroups.reduce((acc, group) => {
        const hit = group.some((alias) => textTokens.has(alias));
        return acc + (hit ? 1 : 0);
      }, 0);
      const phraseHit = queryNorm ? text.includes(queryNorm) : false;
      return {
      off_code: String(p?.code || "").trim(),
      name,
      brand,
      source_name: "openfoodfacts",
      source: "off_remote",
      locale: "en-gb",
      kcal_per_100g: toNum(p?.nutriments?.["energy-kcal_100g"]) || null,
      nutrient_coverage_count: null,
      nutrient_coverage_ratio: null,
      _token_hits: tokenHits,
      _phrase_hit: phraseHit ? 1 : 0
    };
    })
    .filter((x) => x.off_code && x.name)
    .filter((x) => x._phrase_hit > 0 || x._token_hits >= requiredHits)
    .sort((a, b) => {
      if (a._phrase_hit !== b._phrase_hit) return b._phrase_hit - a._phrase_hit;
      if (a._token_hits !== b._token_hits) return b._token_hits - a._token_hits;
      return String(a.name).localeCompare(String(b.name));
    })
    .slice(0, Math.max(1, Number(limit)))
    .map(({ _token_hits, _phrase_hit, ...rest }) => rest);
};

const safeSearchUsdaFoods = async ({ timeoutMs = 3800, ...args }) =>
  withTimeout((signal) => searchUsdaFoods({ ...args, signal }), timeoutMs, []);

const safeSearchOpenFoodFactsFoods = async ({ timeoutMs = 3800, ...args }) =>
  withTimeout((signal) => searchOpenFoodFactsFoods({ ...args, signal }), timeoutMs, []);

const fetchOpenFoodFactsProductByCode = async (code) => {
  const c = String(code || "").trim();
  if (!c) throw new Error("off_code is required");
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(c)}.json`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "PhysiquePilot/1.0 (nutrition import; contact: support@physiquepilot.com)"
    }
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`OFF product lookup failed (${r.status}): ${txt || r.statusText}`);
  }
  const j = await r.json().catch(() => ({}));
  if (j?.status !== 1 || !j?.product) throw new Error("Open Food Facts product not found.");
  return j.product;
};

const importOpenFoodFactsProductByCode = async ({ offCode }) => {
  const marker = `off:${String(offCode || "").trim()}`;
  const { data: existing, error: existingErr } = await supabase
    .from("foods")
    .select("id, name")
    .eq("source", "openfoodfacts")
    .eq("barcode", marker)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing?.id) return { food_id: existing.id, name: existing.name, reused: true };

  const product = await fetchOpenFoodFactsProductByCode(offCode);
  const name = String(product?.product_name_en || product?.product_name || "").trim();
  if (!name) throw new Error("OFF product has no name.");
  const brand = String(product?.brands || "").split(",")[0]?.trim() || null;
  const locale = "en-gb";
  const nutrientsMap = parseOffNutrimentsToCanonicalMap(product?.nutriments || {});

  const { data: insertedFood, error: foodErr } = await supabase
    .from("foods")
    .insert({
      name,
      brand,
      barcode: marker,
      locale,
      source: "openfoodfacts"
    })
    .select("id, name")
    .single();
  if (foodErr) throw new Error(foodErr.message);

  const nutrientMetaPayload = [];
  const nutrientValuePayload = [];
  for (const [code, amount] of nutrientsMap.entries()) {
    if (!ALLOWED_TRACKED_NUTRIENT_CODES.has(code)) continue;
    nutrientMetaPayload.push({
      code,
      label: code,
      unit: code.endsWith("_mg") ? "mg" : code.endsWith("_ug") ? "ug" : code.endsWith("_kcal") ? "kcal" : "g",
      sort_group: sortGroupFromUnitAndName({ code, unitName: "", nutrientName: code }),
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

const pickBestCandidateWithAI = async ({ query, candidates = [] }) => {
  if (!OPENAI_API_KEY || !Array.isArray(candidates) || candidates.length === 0) return null;
  const schema = {
    name: "best_food_match",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        selected_index: { type: "integer", minimum: 0 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" }
      },
      required: ["selected_index", "confidence", "reason"]
    }
  };
  const prompt = [
    "Pick the best food match for the user query.",
    "Prefer exact branded UK matches, then closest generic equivalent.",
    `Query: ${query}`,
    `Candidates: ${JSON.stringify(candidates.map((c, idx) => ({ idx, name: c.name, brand: c.brand || null, source: c.source, locale: c.locale || null })))}`,
    "Return selected_index for best candidate."
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
        { role: "system", content: "You choose the best nutrition food database match." },
        { role: "user", content: prompt }
      ],
      text: { format: { type: "json_schema", name: schema.name, schema: schema.schema, strict: true } }
    })
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  const first = j?.output?.[0]?.content?.[0];
  if (!first || first.type !== "output_text" || !first.text) return null;
  const parsed = JSON.parse(first.text);
  const idx = Number(parsed?.selected_index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= candidates.length) return null;
  return { index: idx, confidence: toNum(parsed?.confidence), reason: String(parsed?.reason || "") };
};

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

app.post("/api/nutrition/parse", authenticate, nutritionLimiter, async (req, res) => {
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

app.post("/api/nutrition/log", authenticate, nutritionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const user_id = req.userId;
    const log_date = body.log_date || isoDate(new Date());
    const notes = body.notes || null;
    const water_ml = body.water_ml ?? body.waterMl ?? 0;
    const salt_g = body.salt_g ?? body.saltG ?? 0;
    const items = body.items || body.entries || [];

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
        per100gRows = normalizePer100gNutrientRows(per100gRows);
        nutrientCache.set(cacheKey, per100gRows);
      }

      if (!Array.isArray(per100gRows) || per100gRows.length === 0) {
        warnings.push(`"${resolvedItem.food_name}": no nutrient rows found for selected food, using AI fallback.`);
        aiCandidates.push(resolvedItem);
        continue;
      }

      if (micronutrientRowCount(per100gRows) === 0) {
        warnings.push(`"${resolvedItem.food_name}": deterministic macros found, but micronutrients were unavailable in the selected food profile.`);
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
        const grams = await resolveItemGrams({ item: it, conversionCache });
        const scaledRows = [];
        stagedItems.push({
          ...it,
          grams,
          source: "ai",
          macros,
          scaledRows
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
      const persisted = normalizeItemForPersistence(staged);
      const source_text = mergeSourceTextMeta(persisted.source_text, {
        meal_segment: normalizeMealSegmentKey(staged.meal_segment || "snacks"),
        meal_instance_id: sanitizeMetaValue(staged.meal_instance_id || "", 80),
        meal_name: sanitizeMetaValue(staged.meal_name || "", 120)
      });
      const row = {
        id: itemId,
        user_id,
        log_date,
        food_name: staged.food_name,
        amount: persisted.amount,
        unit: persisted.unit,
        cooked_state: staged.cooked_state,
        source_text,
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

      if (staged.source === "db") dbItemCount += 1;
      if (staged.source === "ai") aiItemCount += 1;

      if (staged.scaledRows.length > 0) {
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

    const combinedWarnings = Array.from(new Set([...warnings, ...aiWarnings].filter(Boolean)));

    return res.json({
      ok: true,
      log_date,
      calories: totalCalories,
      protein_g: totalProtein,
      carbs_g: totalCarbs,
      fats_g: totalFats,
      alcohol_g: Math.max(0, Math.round(totalAlcohol * 10) / 10),
      warnings: combinedWarnings,
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

app.get("/api/foods/typeahead", optionalAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const qRaw = String(req.query.q || "").trim();
    const user_id = req.userId || String(req.query.user_id || req.query.userId || "").trim();
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 10)));
    if (qRaw.length < 2) return res.json({ ok: true, items: [] });

    const q = normalizeUkFoodQuery(qRaw);
    const cacheKey = `typeahead|${qRaw.toLowerCase()}|${user_id}|${limit}`;
    const cached = foodSearchCache.get(cacheKey);
    if (cached) return res.json(cached);

    const rawQueryTokens = String(qRaw || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map(singularizeWord);
    const rawQueryTokenSet = new Set(rawQueryTokens);
    const queryMentionsPreparation = rawQueryTokens.some((t) => SEARCH_PREPARATION_WORDS.has(t));
    const queryHasEgg = rawQueryTokenSet.has("egg");
    const queryHasEggWhite = rawQueryTokenSet.has("white");
    const queryHasEggYolk = rawQueryTokenSet.has("yolk");
    const queryHasAltEggSpecies = rawQueryTokens.some((t) => SEARCH_EGG_ALT_SPECIES_WORDS.has(t));

    const words = q.split(/[^a-z0-9]+/).filter(Boolean);
    const baseTerms = tokenizeSearchQuery(q);
    const queryTermGroups = (baseTerms.length > 0 ? baseTerms : words.map(singularizeWord))
      .slice(0, 4)
      .map((token) => expandSearchAliases(token));
    const tokenTerms = Array.from(new Set(queryTermGroups.flat())).slice(0, 6);
    const pattern = `%${q.replace(/[%_]/g, " ")}%`;
    const tokenPatterns = tokenTerms.map((t) => `%${t.replace(/[%_]/g, " ")}%`);
    const tokenQueryLimit = Math.max(24, limit * 5);

    const mergeUniqueById = (rows = []) => {
      const m = new Map();
      for (const row of rows || []) {
        if (row?.id && !m.has(row.id)) m.set(row.id, row);
      }
      return Array.from(m.values());
    };

    const [foodsByName, foodsByBrand, foodTokenRows, userByName, userByBrand, userTokenRows] = await Promise.all([
      supabase.from("foods").select("id,name,brand,locale,source,barcode").ilike("name", pattern).limit(limit * 2),
      supabase.from("foods").select("id,name,brand,locale,source,barcode").ilike("brand", pattern).limit(limit),
      tokenPatterns.length > 0
        ? Promise.all(
            tokenPatterns.map((p) =>
              supabase.from("foods").select("id,name,brand,locale,source,barcode").ilike("name", p).limit(tokenQueryLimit)
            )
          )
        : Promise.resolve([]),
      user_id
        ? supabase.from("user_foods").select("id,name,brand").eq("user_id", user_id).ilike("name", pattern).limit(limit * 2)
        : Promise.resolve({ data: [], error: null }),
      user_id
        ? supabase.from("user_foods").select("id,name,brand").eq("user_id", user_id).ilike("brand", pattern).limit(limit)
        : Promise.resolve({ data: [], error: null }),
      user_id && tokenPatterns.length > 0
        ? Promise.all(
            tokenPatterns.map((p) =>
              supabase.from("user_foods").select("id,name,brand").eq("user_id", user_id).ilike("name", p).limit(tokenQueryLimit)
            )
          )
        : Promise.resolve([])
    ]);

    const firstErr =
      foodsByName.error ||
      foodsByBrand.error ||
      (foodTokenRows || []).find((r) => r?.error)?.error ||
      userByName.error ||
      userByBrand.error ||
      (userTokenRows || []).find((r) => r?.error)?.error ||
      null;
    if (firstErr) return res.status(400).json({ ok: false, error: firstErr.message });

    const localFoods = mergeUniqueById([
      ...(foodsByName.data || []),
      ...(foodsByBrand.data || []),
      ...(foodTokenRows || []).flatMap((r) => r?.data || [])
    ]).map((x) => ({
      id: x.id,
      name: x.name,
      brand: x.brand || null,
      source: "global",
      source_name: x.source || "db",
      food_id: x.id,
      user_food_id: null,
      usda_fdc_id: String(x?.barcode || "").startsWith("fdc:") ? String(x.barcode).slice(4) : null
    }));

    const userFoods = mergeUniqueById([
      ...(userByName.data || []),
      ...(userByBrand.data || []),
      ...(userTokenRows || []).flatMap((r) => r?.data || [])
    ]).map((x) => ({
      id: x.id,
      name: x.name,
      brand: x.brand || null,
      source: "user",
      source_name: "user",
      food_id: null,
      user_food_id: x.id
    }));

    const normalizeWords = (x) => String(x || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(singularizeWord);
    const localCoverageRows = [...userFoods, ...localFoods];
    const uncoveredQueryGroups = queryTermGroups.filter(
      (group) =>
        !localCoverageRows.some((row) => {
          const tokens = new Set([...normalizeWords(row?.name), ...normalizeWords(row?.brand)]);
          return group.some((alias) => tokens.has(alias));
        })
    );
    const queryHasUncoveredTerms = uncoveredQueryGroups.length > 0;

    let remoteOff = [];
    if (localFoods.length + userFoods.length < Math.ceil(limit / 2) || queryHasUncoveredTerms) {
      let offRows = await safeSearchOpenFoodFactsFoods({
        term: qRaw,
        limit: Math.min(8, limit),
        country: "united-kingdom",
        timeoutMs: 900
      });
      if ((!offRows || offRows.length === 0) && queryHasUncoveredTerms) {
        offRows = await safeSearchOpenFoodFactsFoods({
          term: qRaw,
          limit: Math.min(10, limit + 2),
          country: "",
          timeoutMs: 1200
        });
      }
      remoteOff = (offRows || []).map((x) => ({
        id: `off:${x.off_code}`,
        name: x.name,
        brand: x.brand,
        source: "off_remote",
        source_name: "openfoodfacts",
        food_id: null,
        user_food_id: null,
        off_code: String(x.off_code)
      }));
    }

    const requiredHits = queryTermGroups.length >= 3 ? 2 : 1;

    const dedupeByNameBrand = (rows = []) => {
      const m = new Map();
      for (const row of rows) {
        const key = `${normalizedFoodKey(row?.name)}|${normalizedFoodKey(row?.brand || "")}`;
        if (!m.has(key)) m.set(key, row);
      }
      return Array.from(m.values());
    };

    const scored = dedupeByNameBrand([...userFoods, ...localFoods, ...remoteOff])
      .map((item) => {
        const name = String(item?.name || "").toLowerCase();
        const brand = String(item?.brand || "").toLowerCase();
        const nameTokens = normalizeWords(name);
        const brandTokens = normalizeWords(brand);
        const tokens = new Set([...nameTokens, ...brandTokens]);
        const tokenHits = queryTermGroups.reduce((acc, group) => {
          const hit = group.some((alias) => tokens.has(alias));
          return acc + (hit ? 1 : 0);
        }, 0);
        const allTermsHit = queryTermGroups.length > 0 && tokenHits >= queryTermGroups.length;
        const phraseHit = name.includes(q) || name.includes(qRaw.toLowerCase()) ? 1 : 0;
        const exact = normalizedFoodKey(name) === normalizedFoodKey(q) || normalizedFoodKey(name) === normalizedFoodKey(qRaw) ? 1 : 0;
        const firstToken = nameTokens[0] || "";
        const firstTokenHit =
          queryTermGroups.length > 0 && queryTermGroups[0].some((alias) => alias === firstToken) ? 1 : 0;
        let prefixHits = 0;
        for (let i = 0; i < Math.min(queryTermGroups.length, nameTokens.length); i += 1) {
          if (queryTermGroups[i].some((alias) => alias === nameTokens[i])) {
            prefixHits += 1;
          } else {
            break;
          }
        }
        const tokenCoverage = queryTermGroups.length > 0 ? tokenHits / queryTermGroups.length : 0;
        const uncoveredHits = uncoveredQueryGroups.reduce((acc, group) => {
          const hit = group.some((alias) => tokens.has(alias));
          return acc + (hit ? 1 : 0);
        }, 0);
        const uncoveredMisses = Math.max(0, uncoveredQueryGroups.length - uncoveredHits);
        const uncoveredBoost = uncoveredHits * 30 - uncoveredMisses * 12;
        const missingTerms = Math.max(0, queryTermGroups.length - tokenHits);
        const missingTermPenalty = (queryTermGroups.length >= 3 ? 18 : 8) * missingTerms;
        const simpleIngredientQuery = queryTermGroups.length <= 2;
        const dishLike = nameTokens.some((t) => SEARCH_DISH_HINT_WORDS.has(t));
        const dishPenalty =
          (simpleIngredientQuery && dishLike && tokenHits <= 1 ? 12 : 0) +
          (!simpleIngredientQuery && dishLike && missingTerms > 0 ? 10 : 0);
        const itemHasPreparationWord = nameTokens.some((t) => SEARCH_PREPARATION_WORDS.has(t));
        const itemIsRaw = nameTokens.includes("raw");
        const prepPenalty = !queryMentionsPreparation && itemHasPreparationWord && !itemIsRaw ? 10 : 0;
        const rawBoost = !queryMentionsPreparation && itemIsRaw ? 6 : 0;
        const isEggRow = tokens.has("egg");
        const isEggWhite = isEggRow && tokens.has("white");
        const isEggYolk = isEggRow && tokens.has("yolk");
        const isEggWhole = isEggRow && tokens.has("whole");
        const isAltEggSpecies = isEggRow && Array.from(SEARCH_EGG_ALT_SPECIES_WORDS).some((s) => tokens.has(s));
        const isChickenEgg = isEggRow && tokens.has("chicken");
        let eggAdjustment = 0;
        if (queryHasEgg) {
          if (isEggRow) eggAdjustment += 10;
          if (isChickenEgg) eggAdjustment += 8;
          if (!queryHasEggWhite && isEggWhite) eggAdjustment -= 16;
          if (!queryHasEggYolk && isEggYolk) eggAdjustment -= 16;
          if (!queryHasEggWhite && !queryHasEggYolk && isEggWhole) eggAdjustment += 12;
          if (!queryHasAltEggSpecies && isAltEggSpecies) eggAdjustment -= 14;
        }
        const sourceBonus = item.source === "user" ? 20 : item.source === "global" ? 10 : 0;
        const score =
          exact * 120 +
          phraseHit * 35 +
          tokenHits * 26 +
          (allTermsHit ? 48 : 0) +
          firstTokenHit * 24 +
          prefixHits * 15 +
          tokenCoverage * 20 +
          uncoveredBoost +
          rawBoost +
          eggAdjustment +
          sourceBonus -
          dishPenalty -
          prepPenalty -
          missingTermPenalty;
        const confidence = Math.max(0, Math.min(100, Math.round(38 + score * 0.45)));
        const relevant =
          allTermsHit ||
          tokenHits >= requiredHits ||
          phraseHit === 1 ||
          exact === 1 ||
          uncoveredHits > 0 ||
          (firstTokenHit === 1 && tokenHits >= Math.max(1, requiredHits - 1));
        const disallowDishFallback =
          queryTermGroups.length >= 3 &&
          dishLike &&
          missingTerms > 0 &&
          uncoveredHits === 0 &&
          phraseHit === 0 &&
          exact === 0;
        return { ...item, match_confidence: confidence, _score: score, _relevant: relevant && !disallowDishFallback };
      })
      .sort((a, b) => b._score - a._score || String(a.name || "").length - String(b.name || "").length);

    const strict = scored.filter((x) => x._relevant);
    const relaxed = strict.length > 0 ? strict : scored.filter((x) => x._score > 0);
    const out = relaxed.slice(0, limit).map(({ _score, _relevant, ...rest }) => rest);

    const payload = { ok: true, items: out };
    foodSearchCache.set(cacheKey, payload, { ttl: 1000 * 45 });
    return res.json(payload);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/foods/search", optionalAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const term = String(req.query.q || "").trim();
    const user_id = req.userId || String(req.query.user_id || req.query.userId || "").trim();
    const localeRaw = String(req.query.locale || "any").trim().toLowerCase();
    const locale =
      localeRaw === "us" ? "en-us" :
      localeRaw === "uk" ? "en-gb" :
      localeRaw;
    const limit = Math.min(30, Math.max(1, Number(req.query.limit || 12)));
    const fastMode = String(req.query.fast || "0") === "1";
    const includeUsda = String(req.query.include_usda || "1") !== "0";
    const includeOff = String(req.query.include_off || "1") !== "0";
    const searchCacheKey = [
      "v2",
      term.toLowerCase(),
      user_id || "",
      locale,
      String(limit),
      includeUsda ? "1" : "0",
      includeOff ? "1" : "0",
      fastMode ? "1" : "0"
    ].join("|");
    const cachedSearch = foodSearchCache.get(searchCacheKey);
    if (cachedSearch) return res.json(cachedSearch);

    if (!term) return res.json({ ok: true, items: [] });

    const normalizeWords = (x) =>
      String(x || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    const singularize = (w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w);
    const normalizedTerm = term.toLowerCase();
    const normalizedTermWords = normalizeWords(normalizedTerm);
    const localeFilter = locale === "any" ? null : locale.toLowerCase();

    const safePattern = `%${term.replace(/[%_]/g, " ").trim()}%`;
    const informativeWordsRaw = normalizedTermWords.map(singularize).filter((w) => !SEARCH_STOP_WORDS.has(w));
    const effectiveWords = informativeWordsRaw.length > 0 ? informativeWordsRaw : normalizedTermWords.map(singularize);
    const tokenPatterns = Array.from(new Set(effectiveWords))
      .slice(0, 3)
      .map((token) => `%${token.replace(/[%_]/g, " ").trim()}%`)
      .filter(Boolean);
    const mergeUniqueById = (rows = []) => {
      const m = new Map();
      for (const row of rows || []) {
        if (row?.id && !m.has(row.id)) m.set(row.id, row);
      }
      return Array.from(m.values());
    };

    const [foodsNameRes, foodsBrandRes, foodsTokenNameResList, foodsTokenBrandResList] = await Promise.all([
      supabase
        .from("foods")
        .select("id, name, brand, locale, source, barcode")
        .ilike("name", safePattern)
        .limit(limit * 3),
      supabase
        .from("foods")
        .select("id, name, brand, locale, source, barcode")
        .ilike("brand", safePattern)
        .limit(limit * 2),
      tokenPatterns.length > 0
        ? Promise.all(
            tokenPatterns.map((p) =>
              supabase
                .from("foods")
                .select("id, name, brand, locale, source, barcode")
                .ilike("name", p)
                .limit(limit * 2)
            )
          )
        : Promise.resolve([]),
      tokenPatterns.length > 0
        ? Promise.all(
            tokenPatterns.map((p) =>
              supabase
                .from("foods")
                .select("id, name, brand, locale, source, barcode")
                .ilike("brand", p)
                .limit(limit)
            )
          )
        : Promise.resolve([]),
    ]);
    const flattenData = (resList = []) => resList.flatMap((r) => (Array.isArray(r?.data) ? r.data : []));
    const firstError = (...errs) => errs.find(Boolean) || null;
    const tokenFoodError = (foodsTokenNameResList || []).find((r) => r?.error)?.error || (foodsTokenBrandResList || []).find((r) => r?.error)?.error || null;
    const foodsRes = {
      data: mergeUniqueById([
        ...(foodsNameRes.data || []),
        ...(foodsBrandRes.data || []),
        ...flattenData(foodsTokenNameResList),
        ...flattenData(foodsTokenBrandResList)
      ]),
      error: firstError(foodsNameRes.error, foodsBrandRes.error, tokenFoodError)
    };
    const foods = foodsRes.data;
    const fErr = foodsRes.error;

    if (fErr) return res.status(400).json({ ok: false, error: fErr.message });

    let userFoods = [];
    if (user_id) {
      const [uNameRes, uBrandRes, uTokenNameResList, uTokenBrandResList] = await Promise.all([
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
          .limit(limit * 2),
        tokenPatterns.length > 0
          ? Promise.all(
              tokenPatterns.map((p) =>
                supabase
                  .from("user_foods")
                  .select("id, name, brand")
                  .eq("user_id", user_id)
                  .ilike("name", p)
                  .limit(limit * 2)
              )
            )
          : Promise.resolve([]),
        tokenPatterns.length > 0
          ? Promise.all(
              tokenPatterns.map((p) =>
                supabase
                  .from("user_foods")
                  .select("id, name, brand")
                  .eq("user_id", user_id)
                  .ilike("brand", p)
                  .limit(limit)
              )
            )
          : Promise.resolve([])
      ]);
      const tokenUserError = (uTokenNameResList || []).find((r) => r?.error)?.error || (uTokenBrandResList || []).find((r) => r?.error)?.error || null;
      if (uNameRes.error || uBrandRes.error || tokenUserError) {
        return res.status(400).json({
          ok: false,
          error: String(uNameRes.error?.message || uBrandRes.error?.message || tokenUserError?.message || "Food search failed")
        });
      }
      userFoods = mergeUniqueById([
        ...(uNameRes.data || []),
        ...(uBrandRes.data || []),
        ...flattenData(uTokenNameResList),
        ...flattenData(uTokenBrandResList)
      ]);
    }

    const localCandidateCount = (foods || []).length + (userFoods || []).length;
    const shouldFetchRemote = (includeUsda || includeOff) && (!fastMode || localCandidateCount === 0);
    let usdaRemote = [];
    let offRemote = [];
    if (shouldFetchRemote) {
      const variants = buildSearchTermVariants(term).slice(0, fastMode ? 2 : 3);
      const country = locale === "en-gb" ? "united-kingdom" : "united-states";
      const remoteTimeoutMs = fastMode ? 1400 : 3800;
      const remoteRuns = await Promise.all(
        variants.map(async (variantTerm) => {
          const [usdaRows, offRows] = await Promise.all([
            includeUsda ? safeSearchUsdaFoods({ term: variantTerm, limit: Math.min(8, limit), timeoutMs: remoteTimeoutMs }) : Promise.resolve([]),
            includeOff ? safeSearchOpenFoodFactsFoods({ term: variantTerm, limit: Math.min(8, limit), country, timeoutMs: remoteTimeoutMs }) : Promise.resolve([])
          ]);
          return { usdaRows, offRows };
        })
      );
      const usdaById = new Map();
      const offByCode = new Map();
      for (const run of remoteRuns) {
        for (const row of run.usdaRows || []) {
          const key = String(row?.usda_fdc_id || "");
          if (key && !usdaById.has(key)) usdaById.set(key, row);
        }
        for (const row of run.offRows || []) {
          const key = String(row?.off_code || "");
          if (key && !offByCode.has(key)) offByCode.set(key, row);
        }
      }
      usdaRemote = Array.from(usdaById.values()).slice(0, Math.min(8, limit));
      offRemote = Array.from(offByCode.values()).slice(0, Math.min(8, limit));
    }
    const termWordSet = new Set(effectiveWords);
    const queryTerms = Array.from(termWordSet);

    const filteredFoods = (foods || []).filter((row) => {
      if (!localeFilter) return true;
      return String(row?.locale || "").toLowerCase() === localeFilter;
    });

    const foodIds = filteredFoods.map((x) => x.id).filter(Boolean);
    const userFoodIds = userFoods.map((x) => x.id).filter(Boolean);

    let foodEnergyRows = [];
    let foodCoverageRows = [];
    let userFoodEnergyRows = [];
    let userFoodCoverageRows = [];
    if (!fastMode) {
      if (foodIds.length > 0) {
        const { data: eRows, error: eErr } = await supabase
          .from("food_nutrients")
          .select("food_id, amount_per_100g")
          .in("food_id", foodIds)
          .eq("nutrient_code", "energy_kcal");
        if (eErr) return res.status(400).json({ ok: false, error: eErr.message });
        foodEnergyRows = Array.isArray(eRows) ? eRows : [];
      }

      if (foodIds.length > 0) {
        const { data: cRows, error: cErr } = await supabase
          .from("food_nutrients")
          .select("food_id, nutrient_code")
          .in("food_id", foodIds)
          .in("nutrient_code", KEY_NUTRIENT_CODES);
        if (cErr) return res.status(400).json({ ok: false, error: cErr.message });
        foodCoverageRows = Array.isArray(cRows) ? cRows : [];
      }

      if (userFoodIds.length > 0) {
        const { data: ueRows, error: ueErr } = await supabase
          .from("user_food_nutrients")
          .select("user_food_id, amount_per_100g")
          .in("user_food_id", userFoodIds)
          .eq("nutrient_code", "energy_kcal");
        if (ueErr) return res.status(400).json({ ok: false, error: ueErr.message });
        userFoodEnergyRows = Array.isArray(ueRows) ? ueRows : [];
      }

      if (userFoodIds.length > 0) {
        const { data: ucRows, error: ucErr } = await supabase
          .from("user_food_nutrients")
          .select("user_food_id, nutrient_code")
          .in("user_food_id", userFoodIds)
          .in("nutrient_code", KEY_NUTRIENT_CODES);
        if (ucErr) return res.status(400).json({ ok: false, error: ucErr.message });
        userFoodCoverageRows = Array.isArray(ucRows) ? ucRows : [];
      }
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
      })),
      ...(offRemote || []).map((x) => ({
        id: `off:${x.off_code}`,
        name: x.name,
        brand: x.brand,
        locale: x.locale,
        source_name: "openfoodfacts",
        kcal_per_100g: x.kcal_per_100g,
        nutrient_coverage_count: null,
        nutrient_coverage_ratio: null,
        source: "off_remote",
        food_id: null,
        user_food_id: null,
        off_code: String(x.off_code)
      }))
    ];

    // BM25-style lexical ranking across candidate names/brands to improve relevance ordering.
    const buildDocTokens = (item) => {
      const nameWords = normalizeWords(item?.name).map(singularize);
      const brandWords = normalizeWords(item?.brand).map(singularize);
      // Name carries more semantic weight than brand.
      return [...nameWords, ...nameWords, ...brandWords];
    };

    const docs = items.map((item) => ({
      item,
      tokens: buildDocTokens(item)
    }));
    const N = docs.length || 1;
    const avgdl = docs.reduce((acc, d) => acc + d.tokens.length, 0) / N || 1;
    const df = new Map();
    for (const q of queryTerms) {
      let count = 0;
      for (const d of docs) {
        if (d.tokens.includes(q)) count += 1;
      }
      df.set(q, count);
    }

    const bm25Score = (doc) => {
      const k1 = 1.2;
      const b = 0.75;
      const dl = doc.tokens.length || 1;
      let s = 0;
      for (const q of queryTerms) {
        const tf = doc.tokens.reduce((acc, t) => acc + (t === q ? 1 : 0), 0);
        if (tf <= 0) continue;
        const dfi = df.get(q) || 0;
        const idf = Math.log(1 + (N - dfi + 0.5) / (dfi + 0.5));
        s += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgdl))));
      }
      return s;
    };

    const bm25ById = new Map(docs.map((d) => [d.item.id, bm25Score(d)]));

    const queryHasEgg = termWordSet.has("egg");
    const queryHasWhite = termWordSet.has("white");
    const queryHasYolk = termWordSet.has("yolk");

    const withRank = items.map((item) => {
      const name = String(item?.name || "").toLowerCase();
      const nameWords = normalizeWords(name).map(singularize);
      const nameWordSet = new Set(nameWords);
      const brand = String(item?.brand || "").trim();
      const brandWords = normalizeWords(brand).map(singularize);
      const brandWordSet = new Set(brandWords);
      const itemLocale = String(item?.locale || "").toLowerCase();
      const exact = name === normalizedTerm ? 1 : 0;
      const startsWith = name.startsWith(normalizedTerm) ? 1 : 0;
      const includes = normalizedTerm && name.includes(normalizedTerm) ? 1 : 0;
      const tokenHitsName = Array.from(termWordSet).reduce((acc, token) => acc + (nameWordSet.has(token) ? 1 : 0), 0);
      const tokenHitsBrand = Array.from(termWordSet).reduce((acc, token) => acc + (brandWordSet.has(token) ? 1 : 0), 0);
      const tokenHits = tokenHitsName + tokenHitsBrand * 0.6;
      const allTermsHit = queryTerms.length > 0 && queryTerms.every((token) => nameWordSet.has(token) || brandWordSet.has(token));
      const tokenMisses = Math.max(0, termWordSet.size - tokenHitsName);
      const exactWordCoverage = termWordSet.size > 0 ? tokenHitsName / termWordSet.size : 0;
      const wholeFood = brand ? 1 : 0;
      const localePenalty = localeFilter ? (itemLocale === localeFilter ? 0 : 1) : 0;
      const sourcePenalty = item.source === "user" ? -1 : 0;
      const usdaRemotePenalty = item.source === "usda_remote" ? 0.1 : 0;
      const offRemotePenalty = item.source === "off_remote" ? 0.05 : 0;
      const usdaBoost = String(item.source_name || "").toLowerCase() === "usda" ? -2 : 0;
      const offBoost = String(item.source_name || "").toLowerCase() === "openfoodfacts" ? -2.5 : 0;
      const coveragePenalty = fastMode ? 0 : 1 - Math.min(1, toNum(item.nutrient_coverage_ratio));
      const bm25 = toNum(bm25ById.get(item.id));
      const eggWhitePenalty = queryHasEgg && !queryHasWhite && name.includes("egg, white") ? 12 : 0;
      const eggYolkPenalty = queryHasEgg && !queryHasYolk && name.includes("egg, yolk") ? 12 : 0;
      const wholeEggBoost = queryHasEgg && !queryHasWhite && !queryHasYolk && name.includes("egg, whole") ? -14 : 0;
      const minimumNameTokenHits = queryTerms.length >= 2 ? 2 : 1;
      const strongLexical =
        exact === 1 ||
        startsWith === 1 ||
        includes === 1 ||
        tokenHitsName >= minimumNameTokenHits ||
        (queryTerms.length <= 1 && tokenHitsName >= 1 && bm25 >= 0.6);
      const isRemote = item.source === "off_remote" || item.source === "usda_remote";
      const isRelevant = isRemote
        ? strongLexical
        : strongLexical || (queryTerms.length <= 1 && tokenHitsBrand >= 1);
      const lexicalHardMissPenalty =
        (item.source === "off_remote" || item.source === "usda_remote") &&
        exact === 0 &&
        startsWith === 0 &&
        includes === 0 &&
        tokenHits <= 0
          ? 35
          : 0;
      return {
        ...item,
        match_confidence: Math.max(
          0,
          Math.min(
            100,
            Math.round(
              100 -
                (wholeFood * 10 + startsWith * 7 + includes * 6 + coveragePenalty * 16 + localePenalty * 8 + tokenMisses * 11) +
                sourcePenalty * 5 +
                usdaBoost * 3 +
                offBoost * 3 +
                exact * 20 +
                tokenHits * 11 +
                exactWordCoverage * 18 +
                (allTermsHit ? 28 : 0) +
                bm25 * 12 -
                lexicalHardMissPenalty -
                wholeEggBoost +
                eggWhitePenalty +
                eggYolkPenalty
            )
          )
        ),
        _rank:
          sourcePenalty * 120 +
          usdaRemotePenalty * 8 +
          offRemotePenalty * 6 +
          usdaBoost * 40 +
          offBoost * 40 +
          wholeFood * 12 +
          localePenalty * 5 +
          coveragePenalty * 18 +
          startsWith * 6 +
          includes * 4 -
          exact * 26 -
          tokenHits * 12 -
          (allTermsHit ? 22 : 0) -
          exactWordCoverage * 20 +
          tokenMisses * 8 -
          bm25 * 20 +
          lexicalHardMissPenalty +
          eggWhitePenalty +
          eggYolkPenalty +
          wholeEggBoost,
        _is_relevant: isRelevant
      };
    });

    withRank.sort((a, b) => {
      if (a._rank !== b._rank) return a._rank - b._rank;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    const dedupByNameBrand = new Map();
    const sourcePriority = { user: 1, global: 2, off_remote: 3, usda_remote: 4 };
    for (const item of withRank) {
      const key = `${normalizedFoodKey(item.name)}|${normalizedFoodKey(item.brand || "")}`;
      const existing = dedupByNameBrand.get(key);
      if (!existing) {
        dedupByNameBrand.set(key, item);
        continue;
      }
      const curPriority = sourcePriority[item.source] || 99;
      const oldPriority = sourcePriority[existing.source] || 99;
      if (curPriority < oldPriority || (curPriority === oldPriority && toNum(item._rank) < toNum(existing._rank))) {
        dedupByNameBrand.set(key, item);
      }
    }

    const dedupedRanked = Array.from(dedupByNameBrand.values()).sort((a, b) => a._rank - b._rank);
    const relevantRanked = dedupedRanked.filter((it) => it._is_relevant);
    let rankPool = relevantRanked.length > 0 ? relevantRanked : dedupedRanked;
    if (queryTerms.length >= 2 && relevantRanked.length === 0) {
      rankPool = [];
    }
    // If strict local relevance yields nothing in fast mode, try remote once to avoid false empty results.
    if (rankPool.length === 0 && fastMode && (includeOff || includeUsda)) {
      const variants = buildSearchTermVariants(term).slice(0, 2);
      const country = locale === "en-gb" ? "united-kingdom" : "united-states";
      const remoteRuns = await Promise.all(
        variants.map(async (variantTerm) => {
          const [usdaRows, offRows] = await Promise.all([
            includeUsda ? safeSearchUsdaFoods({ term: variantTerm, limit: Math.min(8, limit), timeoutMs: 1400 }) : Promise.resolve([]),
            includeOff ? safeSearchOpenFoodFactsFoods({ term: variantTerm, limit: Math.min(8, limit), country, timeoutMs: 1400 }) : Promise.resolve([])
          ]);
          return { usdaRows, offRows };
        })
      );
      const remoteItemsFallback = [
        ...remoteRuns.flatMap((r) => (r.usdaRows || []).map((x) => ({
          id: `usda:${x.usda_fdc_id}`,
          name: x.name,
          brand: x.brand,
          locale: x.locale,
          source_name: "usda",
          source: "usda_remote",
          food_id: null,
          user_food_id: null,
          usda_fdc_id: String(x.usda_fdc_id)
        }))),
        ...remoteRuns.flatMap((r) => (r.offRows || []).map((x) => ({
          id: `off:${x.off_code}`,
          name: x.name,
          brand: x.brand,
          locale: x.locale,
          source_name: "openfoodfacts",
          source: "off_remote",
          food_id: null,
          user_food_id: null,
          off_code: String(x.off_code)
        })))
      ];
      if (remoteItemsFallback.length > 0) {
        const seen = new Set();
        rankPool = remoteItemsFallback.filter((it) => {
          const k = `${normalizedFoodKey(it.name)}|${normalizedFoodKey(it.brand || "")}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }
    }

    const ranked = rankPool.slice(0, limit).map(({ _rank, _is_relevant, ...rest }) => rest);
    const payload = { ok: true, items: ranked };
    foodSearchCache.set(searchCacheKey, payload, { ttl: fastMode ? 1000 * 30 : 1000 * 60 });
    return res.json(payload);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/foods/resolve-off", async (req, res) => {
  try {
    const body = req.body || {};
    const off_code = String(body.off_code || body.offCode || "").trim();
    if (!off_code) return res.status(400).json({ ok: false, error: "off_code is required" });
    const imported = await importOpenFoodFactsProductByCode({ offCode: off_code });
    return res.json({ ok: true, ...imported, off_code });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/foods/resolve-best", optionalAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const query = String(body.query || body.food || "").trim();
    const user_id = req.userId || String(body.user_id || body.userId || "").trim();
    const localeRaw = String(body.locale || "uk").trim().toLowerCase();
    const locale = localeRaw === "uk" ? "en-gb" : localeRaw === "us" ? "en-us" : localeRaw;
    const useAiPick = String(body.use_ai || body.useAi || "0") === "1";
    const preferRemote = String(body.prefer_remote || body.preferRemote || "0") === "1";
    if (!query) return res.status(400).json({ ok: false, error: "query is required" });
    const queryTokens = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    if (queryTokens.length <= 1 && query.length < 4) {
      return res.json({
        ok: true,
        resolved: null,
        fallback: null,
        warning: "Query too short for safe auto-resolution. Type more characters or select a result."
      });
    }

    const forwardAuth = req.headers["authorization"]
      ? { Authorization: req.headers["authorization"] }
      : {};

    let items = [];
    const typeaheadR = await fetch(
      `http://127.0.0.1:${PORT}/api/foods/typeahead?q=${encodeURIComponent(query)}&limit=10`,
      { headers: forwardAuth }
    );
    const typeaheadJ = await typeaheadR.json().catch(() => ({}));
    if (typeaheadR.ok && typeaheadJ?.ok) {
      items = Array.isArray(typeaheadJ.items) ? typeaheadJ.items : [];
    }

    if (items.length === 0) {
      const searchPasses = preferRemote
        ? [
            { locale: locale || "en-gb", include_usda: 0, include_off: 1, limit: 10 },
            { locale: "any", include_usda: 0, include_off: 0, limit: 8 },
            { locale: locale || "en-gb", include_usda: 1, include_off: 1, limit: 10 }
          ]
        : [
            { locale: "any", include_usda: 0, include_off: 0, limit: 8 },
            { locale: locale || "en-gb", include_usda: 0, include_off: 1, limit: 10 },
            { locale: locale || "en-gb", include_usda: 1, include_off: 1, limit: 10 }
          ];
      for (const pass of searchPasses) {
        const searchR = await fetch(
          `http://127.0.0.1:${PORT}/api/foods/search?q=${encodeURIComponent(query)}&locale=${encodeURIComponent(pass.locale)}&limit=${encodeURIComponent(pass.limit)}&include_usda=${encodeURIComponent(pass.include_usda)}&include_off=${encodeURIComponent(pass.include_off)}&fast=1`,
          { headers: forwardAuth }
        );
        const searchJ = await searchR.json().catch(() => ({}));
        if (!searchR.ok || !searchJ?.ok) continue;
        items = Array.isArray(searchJ.items) ? searchJ.items : [];
        if (items.length > 0) break;
      }
    }
    if (items.length === 0) {
      return res.json({ ok: true, resolved: null, fallback: null, warning: "No database match found." });
    }

    const aiPick = useAiPick ? await pickBestCandidateWithAI({ query, candidates: items }) : null;
    const picked = items[Math.max(0, Math.min(items.length - 1, aiPick?.index ?? 0))];
    const fallback = items[0] || null;
    const singularize = (w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w);
    const effectiveQueryTokens = queryTokens.map(singularize).filter(Boolean);
    const isStrongLexicalMatch = (candidate) => {
      const text = `${String(candidate?.name || "").toLowerCase()} ${String(candidate?.brand || "").toLowerCase()}`;
      const textTokens = new Set(text.split(/[^a-z0-9]+/).filter(Boolean).map(singularize));
      const hits = effectiveQueryTokens.reduce((acc, t) => acc + (textTokens.has(t) ? 1 : 0), 0);
      const needed = effectiveQueryTokens.length >= 2 ? 2 : 1;
      return hits >= needed;
    };
    if (!isStrongLexicalMatch(picked)) {
      return res.json({
        ok: true,
        resolved: null,
        fallback: fallback || null,
        warning: "No high-confidence match; please select from search results."
      });
    }

    if (picked?.source === "usda_remote" && picked?.usda_fdc_id) {
      try {
        const imported = await importUsdaFoodByFdcId({ fdcId: picked.usda_fdc_id });
        return res.json({
          ok: true,
          resolved: {
            name: imported.name,
            food_id: imported.food_id,
            user_food_id: null,
            source: "usda"
          },
          fallback,
          ai: aiPick
        });
      } catch (_e) {
        // fall through to fallback/local candidate
      }
    }

    if (picked?.source === "off_remote" && picked?.off_code) {
      try {
        const imported = await importOpenFoodFactsProductByCode({ offCode: picked.off_code });
        return res.json({
          ok: true,
          resolved: {
            name: imported.name,
            food_id: imported.food_id,
            user_food_id: null,
            source: "openfoodfacts"
          },
          fallback,
          ai: aiPick
        });
      } catch (_e) {
        // fall through to fallback/local candidate
      }
    }

    const chosen = picked && (picked.food_id || picked.user_food_id) ? picked : fallback;
    return res.json({
      ok: true,
      resolved: {
        name: chosen?.name || query,
        food_id: chosen?.food_id || null,
        user_food_id: chosen?.user_food_id || null,
        source: chosen?.source || "global"
      },
      fallback,
      ai: aiPick
    });
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

app.get("/api/nutrition/micro-targets", authenticate, async (req, res) => {
  try {
    const user_id = req.userId;

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

    const filteredNutrients = (nutrientsRes.data || []).filter((n) =>
      ALLOWED_TRACKED_NUTRIENT_CODES.has(String(n?.code || "").trim())
    );

    const items = filteredNutrients.map((n) => {
      const code = String(n.code || "");
      const overrideVal = overridesMap.get(code);
      let target_amount = null;
      let basis = mode;

      if (INHERIT_FROM_MACRO_CODES.has(code)) {
        target_amount = null;
        basis = "macro_goal";
      } else
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

app.post("/api/nutrition/micro-targets", authenticate, async (req, res) => {
  try {
    const body = req.body || {};
    const user_id = req.userId;
    const mode = normalizeMode(body.mode || "rdi");
    const overrides = Array.isArray(body.overrides) ? body.overrides : [];
    const replaceOverrides = Boolean(body.replace_overrides);

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

app.get("/api/nutrition/day-summary", authenticate, async (req, res) => {
  try {
    const user_id = req.userId;
    const log_date = String(req.query.log_date || req.query.logDate || isoDate(new Date())).trim();

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
      segment_totals: summary.segment_totals || {},
      segment_nutrients: summary.segment_nutrients || {},
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

const isMissingNutritionMealsRelationError = (errLike) =>
  /relation .*nutrition_meal_/i.test(String(errLike?.message || errLike || "")) ||
  /relation .*nutrition_saved_meal/i.test(String(errLike?.message || errLike || ""));

app.get("/api/nutrition/meal-presets", authenticate, async (req, res) => {
  try {
    const user_id = req.userId;

    const presets = await ensureDefaultMealPreset(user_id);
    return res.json({ ok: true, items: presets });
  } catch (e) {
    if (isMissingNutritionMealsRelationError(e)) {
      return res.status(400).json({
        ok: false,
        error: "Saved meals schema is missing. Run backend/sql/nutrition_saved_meals.sql in Supabase, then retry."
      });
    }
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/nutrition/meal-presets", authenticate, async (req, res) => {
  try {
    const body = req.body || {};
    const user_id = req.userId;
    const preset_id = String(body.preset_id || body.presetId || "").trim();
    const nameRaw = String(body.name || "").trim();
    const name = (nameRaw || (preset_id ? "Standard" : "Enter Preset Name")).slice(0, 80);
    const makeDefault = Boolean(body.make_default ?? body.makeDefault ?? false);
    const segments = normalizeMealSegmentsInput(body.segments || []);

    let targetId = preset_id;
    if (targetId) {
      const { data: existing, error: existingErr } = await supabase
        .from("nutrition_meal_presets")
        .select("id")
        .eq("id", targetId)
        .eq("user_id", user_id)
        .maybeSingle();
      if (existingErr) throw new Error(existingErr.message);
      if (!existing?.id) return res.status(404).json({ ok: false, error: "Meal preset not found" });

      const { error: updErr } = await supabase
        .from("nutrition_meal_presets")
        .update({ name })
        .eq("id", targetId)
        .eq("user_id", user_id);
      if (updErr) throw new Error(updErr.message);

      const { error: delSegErr } = await supabase
        .from("nutrition_meal_preset_segments")
        .delete()
        .eq("preset_id", targetId);
      if (delSegErr) throw new Error(delSegErr.message);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("nutrition_meal_presets")
        .insert({ user_id, name, is_default: false })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      targetId = inserted?.id;
    }

    if (!targetId) throw new Error("Unable to determine preset id.");

    const segmentPayload = segments.map((seg, idx) => ({
      preset_id: targetId,
      segment_key: normalizeMealSegmentKey(seg.segment_key || seg.key || seg.label),
      label: String(seg.label || "").trim() || "Segment",
      position: idx + 1
    }));
    const { error: segInsErr } = await supabase
      .from("nutrition_meal_preset_segments")
      .insert(segmentPayload);
    if (segInsErr) throw new Error(segInsErr.message);

    if (makeDefault) {
      const { error: clearErr } = await supabase
        .from("nutrition_meal_presets")
        .update({ is_default: false })
        .eq("user_id", user_id);
      if (clearErr) throw new Error(clearErr.message);
      const { error: setErr } = await supabase
        .from("nutrition_meal_presets")
        .update({ is_default: true })
        .eq("id", targetId)
        .eq("user_id", user_id);
      if (setErr) throw new Error(setErr.message);
    }

    const presets = await ensureDefaultMealPreset(user_id);
    return res.json({ ok: true, preset_id: targetId, items: presets });
  } catch (e) {
    if (isMissingNutritionMealsRelationError(e)) {
      return res.status(400).json({
        ok: false,
        error: "Saved meals schema is missing. Run backend/sql/nutrition_saved_meals.sql in Supabase, then retry."
      });
    }
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.delete("/api/nutrition/meal-presets/:preset_id", authenticate, async (req, res) => {
  try {
    const preset_id = String(req.params.preset_id || "").trim();
    const user_id = req.userId;
    if (!preset_id) {
      return res.status(400).json({ ok: false, error: "preset_id is required" });
    }

    const { data: existing, error: existingErr } = await supabase
      .from("nutrition_meal_presets")
      .select("id")
      .eq("id", preset_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (!existing?.id) return res.status(404).json({ ok: false, error: "Meal preset not found" });

    const { error: delErr } = await supabase
      .from("nutrition_meal_presets")
      .delete()
      .eq("id", preset_id)
      .eq("user_id", user_id);
    if (delErr) throw new Error(delErr.message);

    const presets = await ensureDefaultMealPreset(user_id);
    return res.json({ ok: true, items: presets });
  } catch (e) {
    if (isMissingNutritionMealsRelationError(e)) {
      return res.status(400).json({
        ok: false,
        error: "Saved meals schema is missing. Run backend/sql/nutrition_saved_meals.sql in Supabase, then retry."
      });
    }
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/nutrition/saved-meals", authenticate, async (req, res) => {
  try {
    const user_id = req.userId;

    const { data: meals, error: mealsErr } = await supabase
      .from("nutrition_saved_meals")
      .select("id, name, preset_id, segment_key, created_at, updated_at")
      .eq("user_id", user_id)
      .order("updated_at", { ascending: false });
    if (mealsErr) throw new Error(mealsErr.message);

    const rows = Array.isArray(meals) ? meals : [];
    const mealIds = rows.map((m) => m.id).filter(Boolean);

    const { data: items, error: itemsErr } = mealIds.length > 0
      ? await supabase
          .from("nutrition_saved_meal_items")
          .select("id, saved_meal_id, position, food_name, amount, unit, cooked_state, food_id, user_food_id")
          .in("saved_meal_id", mealIds)
          .order("position", { ascending: true })
      : { data: [], error: null };
    if (itemsErr) throw new Error(itemsErr.message);

    const byMeal = new Map();
    for (const it of items || []) {
      if (!byMeal.has(it.saved_meal_id)) byMeal.set(it.saved_meal_id, []);
      byMeal.get(it.saved_meal_id).push({
        id: it.id,
        food: it.food_name,
        qty: toNum(it.amount),
        unit: it.unit,
        state: it.cooked_state,
        food_id: it.food_id || null,
        user_food_id: it.user_food_id || null
      });
    }

    const payload = rows.map((meal) => ({
      id: meal.id,
      name: meal.name,
      preset_id: meal.preset_id || null,
      segment_key: normalizeMealSegmentKey(meal.segment_key || "snacks"),
      items: byMeal.get(meal.id) || []
    }));

    return res.json({ ok: true, items: payload });
  } catch (e) {
    if (isMissingNutritionMealsRelationError(e)) {
      return res.status(400).json({
        ok: false,
        error: "Saved meals schema is missing. Run backend/sql/nutrition_saved_meals.sql in Supabase, then retry."
      });
    }
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/nutrition/saved-meals", authenticate, async (req, res) => {
  try {
    const body = req.body || {};
    const user_id = req.userId;
    const saved_meal_id = String(body.saved_meal_id || body.savedMealId || "").trim();
    const name = String(body.name || "").trim().slice(0, 80);
    const preset_id = String(body.preset_id || body.presetId || "").trim() || null;
    const segment_key = normalizeMealSegmentKey(body.segment_key || body.segmentKey || "snacks");
    const items = normalizeLogItems(body.items || []);
    if (!name) return res.status(400).json({ ok: false, error: "name is required" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ ok: false, error: "items are required" });

    let targetMealId = saved_meal_id;
    if (targetMealId) {
      const { data: existing, error: existingErr } = await supabase
        .from("nutrition_saved_meals")
        .select("id")
        .eq("id", targetMealId)
        .eq("user_id", user_id)
        .maybeSingle();
      if (existingErr) throw new Error(existingErr.message);
      if (!existing?.id) return res.status(404).json({ ok: false, error: "Saved meal not found" });

      const { error: updErr } = await supabase
        .from("nutrition_saved_meals")
        .update({ name, preset_id, segment_key })
        .eq("id", targetMealId)
        .eq("user_id", user_id);
      if (updErr) throw new Error(updErr.message);

      const { error: clearErr } = await supabase
        .from("nutrition_saved_meal_items")
        .delete()
        .eq("saved_meal_id", targetMealId);
      if (clearErr) throw new Error(clearErr.message);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("nutrition_saved_meals")
        .insert({ user_id, name, preset_id, segment_key })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      targetMealId = inserted?.id;
    }

    if (!targetMealId) throw new Error("Unable to determine saved meal id.");

    const payload = items.map((it, idx) => ({
      saved_meal_id: targetMealId,
      position: idx + 1,
      food_name: it.food_name,
      amount: it.amount,
      unit: it.unit,
      cooked_state: it.cooked_state,
      food_id: it.food_id || null,
      user_food_id: it.user_food_id || null
    }));

    const { error: insItemsErr } = await supabase.from("nutrition_saved_meal_items").insert(payload);
    if (insItemsErr) throw new Error(insItemsErr.message);

    return res.json({ ok: true, saved_meal_id: targetMealId });
  } catch (e) {
    if (isMissingNutritionMealsRelationError(e)) {
      return res.status(400).json({
        ok: false,
        error: "Saved meals schema is missing. Run backend/sql/nutrition_saved_meals.sql in Supabase, then retry."
      });
    }
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.delete("/api/nutrition/saved-meals/:saved_meal_id", authenticate, async (req, res) => {
  try {
    const saved_meal_id = String(req.params.saved_meal_id || "").trim();
    const user_id = req.userId;
    if (!saved_meal_id) {
      return res.status(400).json({ ok: false, error: "saved_meal_id is required" });
    }

    const { error: delErr } = await supabase
      .from("nutrition_saved_meals")
      .delete()
      .eq("id", saved_meal_id)
      .eq("user_id", user_id);
    if (delErr) throw new Error(delErr.message);

    return res.json({ ok: true });
  } catch (e) {
    if (isMissingNutritionMealsRelationError(e)) {
      return res.status(400).json({
        ok: false,
        error: "Saved meals schema is missing. Run backend/sql/nutrition_saved_meals.sql in Supabase, then retry."
      });
    }
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

// ─── TDEE & Macro Calculations (Mifflin-St Jeor) ────────────────────────────

const ACTIVITY_MULTIPLIERS = {
  inactive: 1.2,
  light: 1.375,
  moderate: 1.55,
  heavy: 1.725,
  extreme: 1.9,
};

const getAgeFromDOB = (dateOfBirth) => {
  if (!dateOfBirth) return 30;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return Math.max(15, Math.min(100, age));
};

const calculateBMR = ({ weightKg, heightCm, ageYears, sex }) => {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === "female" ? base - 161 : base + 5);
};

const macrosFromCalories = ({ calories, weightKg, bodyFatPct }) => {
  const cal = Math.round(calories);
  // Protein: 2.4g/kg lean mass if BF% known, else 2.0g/kg bodyweight
  let proteinG;
  if (bodyFatPct != null && bodyFatPct >= 3 && bodyFatPct <= 60) {
    const leanMassKg = weightKg * (1 - bodyFatPct / 100);
    proteinG = Math.round(leanMassKg * 2.4);
  } else {
    proteinG = Math.round(weightKg * 2.0);
  }
  // Fat: at least 0.8g/kg bodyweight, minimum 20% of calories
  const fatFloor = Math.round(weightKg * 0.8);
  const fatFromCals = Math.round((cal * 0.20) / 9);
  const fatG = Math.max(fatFloor, fatFromCals);
  const carbsG = Math.max(0, Math.round((cal - proteinG * 4 - fatG * 9) / 4));
  return { calories: cal, proteinG, carbsG, fatG };
};

const suggestCalories = ({ goalType, weeklyRateKg, weightKg, heightCm, sex, dateOfBirth, activityLevel, calorieMode, customCalories }) => {
  if (calorieMode === "custom" && customCalories) {
    return Math.round(Math.min(6000, Math.max(1200, Number(customCalories))));
  }
  const ageYears = getAgeFromDOB(dateOfBirth);
  const bmr = calculateBMR({ weightKg, heightCm: heightCm || weightKg * 2.5, ageYears, sex: sex || "male" });
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? ACTIVITY_MULTIPLIERS.moderate;
  const tdee = Math.round(bmr * multiplier);

  if (!goalType || goalType === "maintain") return tdee;

  const rate = Math.abs(Number(weeklyRateKg || 0));
  const dailyDelta = Math.round((rate * 7700) / 7);

  if (goalType === "lose" || goalType === "cut") return Math.max(1200, tdee - dailyDelta);
  if (goalType === "gain" || goalType === "bulk") return Math.min(6000, tdee + dailyDelta);

  return tdee;
};

app.post("/api/profile/init", authenticate, async (req, res) => {
  try {
    const body = req.body || {};

    const user_id = req.userId;
    const email = body.email;

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

app.post("/api/nutrition/init", authenticate, async (req, res) => {
  const user_id = req.userId;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("current_weight_kg, goal_type, weekly_weight_change_target_kg, height_cm, sex, date_of_birth, activity_level, body_fat_pct, calorie_mode, custom_calories, rest_day_deficit, high_day_surplus")
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
  const heightCm = Number(profile?.height_cm || 0) || null;
  const sex = profile?.sex || "male";
  const dateOfBirth = profile?.date_of_birth || null;
  const activityLevel = profile?.activity_level || "moderate";
  const bodyFatPct = profile?.body_fat_pct != null ? Number(profile.body_fat_pct) : null;
  const calorieMode = profile?.calorie_mode || "ai";
  const customCalories = profile?.custom_calories ? Number(profile.custom_calories) : null;
  const restDayDeficit = profile?.rest_day_deficit != null ? Number(profile.rest_day_deficit) : 250;
  const highDaySurplus = profile?.high_day_surplus != null ? Number(profile.high_day_surplus) : 200;

  const baseCalories = suggestCalories({
    goalType,
    weeklyRateKg,
    weightKg,
    heightCm,
    sex,
    dateOfBirth,
    activityLevel,
    calorieMode,
    customCalories,
  });

  const trainingCals = baseCalories;
  const restCals = Math.max(1200, baseCalories - restDayDeficit);
  const highCals = Math.min(6000, baseCalories + highDaySurplus);

  const training = macrosFromCalories({ calories: trainingCals, weightKg, bodyFatPct });
  const rest = macrosFromCalories({ calories: restCals, weightKg, bodyFatPct });
  const high = macrosFromCalories({ calories: highCals, weightKg, bodyFatPct });

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

// ─── Meal Plan: helper functions ─────────────────────────────────────────────

function getWeekDates(weekStart) {
  const dates = [];
  const start = new Date(weekStart + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function computeDayTypeForPlan(profile, dateStr) {
  const date = new Date(dateStr + "T00:00:00Z");

  // High day schedule check
  const hds = profile?.high_day_schedule;
  if (hds && hds !== "none") {
    if (hds === "fixed_days" && Array.isArray(profile.high_day_weekdays)) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      if (profile.high_day_weekdays.includes(dayNames[date.getUTCDay()])) return "high";
    } else if (hds === "interval" && profile.high_day_interval && profile.high_day_start_date) {
      const start = new Date(profile.high_day_start_date + "T00:00:00Z");
      const diffDays = Math.floor((date - start) / 86400000);
      if (diffDays >= 0 && diffDays % Number(profile.high_day_interval) === 0) return "high";
    }
  }

  // Training day check
  if (profile?.split_mode === "fixed") {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = dayNames[date.getUTCDay()];
    const trainingDays = Array.isArray(profile.training_days) ? profile.training_days : [];
    return trainingDays.includes(dayName) ? "training" : "rest";
  }

  if (profile?.split_mode === "rolling" && profile.rolling_start_date && profile.training_days_per_week) {
    const start = new Date(profile.rolling_start_date + "T00:00:00Z");
    const diffDays = Math.floor((date - start) / 86400000);
    const posInCycle = ((diffDays % 7) + 7) % 7;
    return posInCycle < Number(profile.training_days_per_week) ? "training" : "rest";
  }

  return "rest";
}

// ─── Meal Plan: GET saved plan for a week ────────────────────────────────────
app.get("/api/nutrition/meal-plan", authenticate, async (req, res) => {
  const user_id = req.userId;
  const { week_start } = req.query;
  if (!week_start) return res.status(400).json({ ok: false, error: "week_start required" });

  const { data, error } = await supabase
    .from("nutrition_meal_plans")
    .select("plan_json, created_at, updated_at")
    .eq("user_id", user_id)
    .eq("week_start", week_start)
    .maybeSingle();

  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true, plan: data?.plan_json || null, updated_at: data?.updated_at || null });
});

// ─── Meal Plan: Generate 7-day AI plan ───────────────────────────────────────
app.post("/api/nutrition/meal-plan/generate", authenticate, nutritionLimiter, async (req, res) => {
  const user_id = req.userId;
  const { week_start } = req.body;
  if (!week_start) return res.status(400).json({ ok: false, error: "week_start required (YYYY-MM-DD, Monday)" });

  try {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "goal_type, dietary_preference, food_allergies, dislikes, dietary_additional, " +
        "meals_per_day, training_time_hour, split_mode, training_days, training_days_per_week, " +
        "rolling_start_date, high_day_schedule, high_day_weekdays, high_day_interval, high_day_start_date, " +
        "experience_level, sex, current_weight_kg"
      )
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileErr || !profile) return res.status(400).json({ ok: false, error: profileErr?.message || "Profile not found" });

    const { data: targets } = await supabase
      .from("nutrition_day_targets")
      .select("day_type, calories, protein_g, carbs_g, fats_g")
      .eq("user_id", user_id);

    const targetsByType = {};
    for (const t of targets || []) targetsByType[t.day_type] = t;

    const weekDates = getWeekDates(week_start);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const fullDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const scheduleLines = weekDates.map((dateStr) => {
      const dt = computeDayTypeForPlan(profile, dateStr);
      const d = new Date(dateStr + "T00:00:00Z");
      const dayName = fullDayNames[d.getUTCDay()];
      const t = targetsByType[dt];
      const tStr = t ? ` — ${t.calories} kcal | P${t.protein_g}g C${t.carbs_g}g F${t.fats_g}g` : "";
      return `  ${dayName} ${dateStr} (${dt} day)${tStr}`;
    }).join("\n");

    const trainingHour = Number(profile.training_time_hour ?? 17);
    const trainingTimeStr = `${String(trainingHour).padStart(2, "0")}:00`;
    const mealsPerDay = Number(profile.meals_per_day ?? 4);
    const goalLabel = profile.goal_type === "lose" ? "fat loss" : profile.goal_type === "gain" ? "muscle gain (bulking)" : "maintenance";
    const dietLabel = profile.dietary_preference || "omnivore";
    const allergies = String(profile.food_allergies || "").trim() || "none";
    const dislikes = String(profile.dislikes || "").trim() || "none";
    const additionalNotes = String(profile.dietary_additional || "").trim();

    const systemPrompt = `You are an elite sports nutritionist specialising in competitive bodybuilding. Generate practical, realistic meal plans with real foods and accurate macros. Always output valid JSON only — no markdown, no extra text.`;

    const userPrompt = `Generate a complete 7-day meal plan for an athlete with these details:

Goal: ${goalLabel}
Dietary preference: ${dietLabel}
Food allergies (hard exclude): ${allergies}
Dislikes (avoid): ${dislikes}
${additionalNotes ? `Additional notes: ${additionalNotes}` : ""}
Meals per day: ${mealsPerDay}
Typical training time: ${trainingTimeStr}

Weekly schedule with macro targets:
${scheduleLines}

CARB TIMING RULES (follow strictly for training days):
1. Pre-workout meal (2-3 hrs before training): HIGH carbs (35-55g), moderate protein (25-35g), LOW fat (<10g). Label timing_label: "pre_workout"
2. Post-workout meal (within 60 min after training): HIGH protein (40-55g), HIGH carbs (50-70g), VERY low fat (<8g). Label timing_label: "post_workout"
3. Meals far from training window: Can be higher in fat. Keep protein spread evenly.
4. Protein: Distribute evenly across all ${mealsPerDay} meals (aim for equal portions).
5. Rest days: Replace workout-specific meals with regular meals — higher fat, moderate carbs.
6. High days: Prioritise complex carbs throughout. Keep all meals carb-focused.
7. Use realistic UK and international foods. Include specific brands where helpful (e.g. "Quaker Oats", "Tesco Greek Yoghurt").
8. Hit the macro targets for each day within ±5% tolerance.

Output format (JSON only):
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "day_type": "training|rest|high",
      "meals": [
        {
          "name": "Breakfast",
          "timing_label": null,
          "approximate_time": "08:00",
          "foods": [
            {"name": "Rolled Oats", "amount": "80g"},
            {"name": "Whole milk", "amount": "200ml"},
            {"name": "Whey protein powder", "amount": "30g"}
          ],
          "estimated": {"calories": 520, "protein_g": 38, "carbs_g": 62, "fat_g": 11}
        }
      ],
      "totals": {"calories": 2100, "protein_g": 172, "carbs_g": 198, "fat_g": 58}
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";
    const planJson = JSON.parse(rawContent);

    if (!Array.isArray(planJson?.days) || planJson.days.length === 0) {
      return res.status(500).json({ ok: false, error: "AI returned an invalid plan structure. Please try again." });
    }

    await supabase
      .from("nutrition_meal_plans")
      .upsert(
        { user_id, week_start, plan_json: planJson, updated_at: new Date().toISOString() },
        { onConflict: "user_id,week_start" }
      );

    return res.json({ ok: true, plan: planJson });
  } catch (e) {
    console.error("meal-plan/generate error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
