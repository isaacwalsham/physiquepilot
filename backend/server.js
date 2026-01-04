import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import supabase from "./supabaseClient.js";

dotenv.config();

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

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running" });
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
    const { userId, email } = req.body || {};

    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
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

  // If there's no row yet, create one. If there is one, update it to the current week.
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