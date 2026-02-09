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

// Helper: convert to number (finite), else 0
const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// Convert common units to grams so we can scale per-100g nutrient values.
// For ml/l we assume water-like density for now (1ml ~= 1g).
const qtyToGrams = ({ qty, unit }) => {
  const q = toNum(qty);
  const u = String(unit || "").trim().toLowerCase();
  if (!Number.isFinite(q) || q <= 0) return null;

  if (u === "g") return q;
  if (u === "kg") return q * 1000;
  if (u === "oz") return q * 28.349523125;
  if (u === "lb") return q * 453.59237;
  if (u === "ml") return q;
  if (u === "l") return q * 1000;

  // servings or unknown units: we can’t normalize deterministically
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

// Saves today's log totals + items
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

    // 1) Parse/estimate totals (kept for now; later you can replace with deterministic rollups)
    const parsed = await parseNutritionWithAI({ items, notes });

    // 2) Upsert daily totals
    const { error: upsertErr } = await supabase
      .from("daily_nutrition_logs")
      .upsert(
        {
          user_id,
          log_date,
          notes,
          water_ml: Math.max(0, Math.round(toNum(water_ml))),
          salt_g: Math.max(0, toNum(salt_g)),
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

    // 3) Rewrite items for the day (simple + deterministic)
    //    (If you want true edits later, we can upsert by item.id from the client.)
    const { error: delErr } = await supabase
      .from("daily_nutrition_items")
      .delete()
      .eq("user_id", user_id)
      .eq("log_date", log_date);

    if (delErr) {
      return res.status(400).json({ ok: false, error: delErr.message });
    }

    // Insert each item and (optionally) its nutrient breakdown
    const warnings = [...(parsed.warnings || [])];

    for (const it of Array.isArray(items) ? items : []) {
      const food_name = String(it?.food || it?.food_name || "").trim();
      const amount = toNum(it?.qty ?? it?.amount);
      const unit = String(it?.unit || "").trim().toLowerCase();
      const cooked_state = String(it?.state || it?.cooked_state || "").trim().toLowerCase();

      // optional DB-backed ids (future UI will set these)
      const food_id = it?.food_id || it?.foodId || null;
      const user_food_id = it?.user_food_id || it?.userFoodId || null;

      if (!food_name || !Number.isFinite(amount) || amount <= 0 || !unit || !cooked_state) continue;

      const grams = qtyToGrams({ qty: amount, unit });
      if (unit === "serv" || grams == null) {
        warnings.push(`"${food_name}": unit "${unit}" can't be normalized to grams yet; micronutrients may be incomplete.`);
      }

      // If the client already sent item macros (later), keep them; else fall back to AI per-item estimates.
      const aiItem = (parsed.items || []).find(
        (x) => String(x?.food || "").toLowerCase() === food_name.toLowerCase() && toNum(x?.qty) === amount
      );

      const itemRow = {
        id: crypto.randomUUID(),
        user_id,
        log_date,
        food_name,
        amount,
        unit,
        cooked_state,
        source_text: null,
        source: food_id || user_food_id ? "db" : "ai",
        food_id,
        user_food_id,
        grams: grams,
        kcal: aiItem ? toNum(aiItem.calories) : null,
        protein_g: aiItem ? toNum(aiItem.protein_g) : null,
        carbs_g: aiItem ? toNum(aiItem.carbs_g) : null,
        fats_g: aiItem ? toNum(aiItem.fats_g) : null
      };

      const { data: inserted, error: insErr } = await supabase
        .from("daily_nutrition_items")
        .insert(itemRow)
        .select("id")
        .single();

      if (insErr) {
        return res.status(400).json({ ok: false, error: insErr.message });
      }

      const item_id = inserted?.id;
      if (!item_id) continue;

      // Persist micros/macros per item when we have a known food + normalized grams
      if (grams != null && (food_id || user_food_id)) {
        // Pull per-100g nutrients
        if (food_id) {
          const { data: rows, error: nErr } = await supabase
            .from("food_nutrients")
            .select("nutrient_code, amount_per_100g")
            .eq("food_id", food_id);

          if (!nErr && Array.isArray(rows) && rows.length > 0) {
            const payload = rows.map((r) => ({
              item_id,
              nutrient_code: r.nutrient_code,
              amount: scalePer100g(r.amount_per_100g, grams)
            }));

            const { error: upErr } = await supabase
              .from("daily_nutrition_item_nutrients")
              .upsert(payload, { onConflict: "item_id,nutrient_code" });

            if (upErr) {
              return res.status(400).json({ ok: false, error: upErr.message });
            }
          }
        } else if (user_food_id) {
          const { data: rows, error: nErr } = await supabase
            .from("user_food_nutrients")
            .select("nutrient_code, amount_per_100g")
            .eq("user_food_id", user_food_id);

          if (!nErr && Array.isArray(rows) && rows.length > 0) {
            const payload = rows.map((r) => ({
              item_id,
              nutrient_code: r.nutrient_code,
              amount: scalePer100g(r.amount_per_100g, grams)
            }));

            const { error: upErr } = await supabase
              .from("daily_nutrition_item_nutrients")
              .upsert(payload, { onConflict: "item_id,nutrient_code" });

            if (upErr) {
              return res.status(400).json({ ok: false, error: upErr.message });
            }
          }
        }
      }
    }

    return res.json({ ok: true, log_date, ...parsed, warnings });
  } catch (e) {
    const status = e?.statusCode || 500;
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

// Search foods (global + user foods)
app.get("/api/foods/search", async (req, res) => {
  try {
    const term = String(req.query.q || "").trim();
    const user_id = String(req.query.user_id || req.query.userId || "").trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

    if (!term) return res.json({ ok: true, items: [] });

    // Prefer RPC if you created it (recommended for ranked search)
    const { data: rpcData, error: rpcErr } = await supabase.rpc("search_foods", {
      term,
      user_id: user_id || null,
      lim: limit
    });

    if (!rpcErr && Array.isArray(rpcData)) {
      return res.json({ ok: true, items: rpcData });
    }

    // Fallback: simple ILIKE (no ranking)
    const { data: foods, error: fErr } = await supabase
      .from("foods")
      .select("id, name, brand, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fats_g_per_100g")
      .ilike("name", `%${term}%`)
      .limit(limit);

    if (fErr) return res.status(400).json({ ok: false, error: fErr.message });

    let userFoods = [];
    if (user_id) {
      const { data: uFoods, error: uErr } = await supabase
        .from("user_foods")
        .select("id, name, brand, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fats_g_per_100g")
        .eq("user_id", user_id)
        .ilike("name", `%${term}%`)
        .limit(limit);
      if (!uErr && Array.isArray(uFoods)) userFoods = uFoods;
    }

    const items = [
      ...(userFoods || []).map((x) => ({ ...x, source: "user" })),
      ...(foods || []).map((x) => ({ ...x, source: "global" }))
    ].slice(0, limit);

    return res.json({ ok: true, items });
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