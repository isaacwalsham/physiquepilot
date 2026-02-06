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

const nutritionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const parseCache = new LRUCache({ max: 500, ttl: 1000 * 60 * 60 }); // 1 hour

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

const isoDate = (d = new Date()) => {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const normalizeItemsForPrompt = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      food: String(it?.food || "").trim(),
      qty: Number(it?.qty),
      unit: String(it?.unit || "").trim().toLowerCase(),
      state: String(it?.state || "").trim().toLowerCase() // raw|cooked
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

  // Cache by normalized items + notes to reduce duplicate OpenAI calls.
  const cacheKey = hashPayload(safeItems, notes);
  const cached = parseCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      warnings: [...(cached.warnings || []), "Used cached estimate."]
    };
  }

  // Use Structured Outputs so we can reliably JSON.parse the model result.
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

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

// Parses a list of food items into estimated calories/macros (does not write to DB)
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

// Saves today's log totals (writes calories/macros + notes to daily_nutrition_logs)
app.post("/api/nutrition/log", nutritionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const user_id = body.user_id || body.userId;
    const log_date = body.log_date || isoDate(new Date());
    const notes = body.notes || null;
    const items = body.items || body.entries || [];

    if (!user_id) {
      return res.status(400).json({ ok: false, error: "user_id (or userId) is required" });
    }

    const parsed = await parseNutritionWithAI({ items, notes });

    const { error: upsertErr } = await supabase
      .from("daily_nutrition_logs")
      .upsert(
        {
          user_id,
          log_date,
          notes,
          calories: parsed.calories,
          protein_g: parsed.protein_g,
          carbs_g: parsed.carbs_g,
          fats_g: parsed.fats_g
        },
        { onConflict: "user_id,log_date" }
      );

    if (upsertErr) {
      return res.status(400).json({ ok: false, error: upsertErr.message });
    }

    return res.json({ ok: true, log_date, ...parsed });
  } catch (e) {
    const status = e?.statusCode || 500;
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
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