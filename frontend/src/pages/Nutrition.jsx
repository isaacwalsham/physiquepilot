import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const API_URL = (
  String(import.meta.env.VITE_API_URL || "")
    .trim()
    .replace(/\/$/, "") ||
  (import.meta.env.DEV ? "http://localhost:4000" : "https://physiquepilot.onrender.com")
);

const dayLabel = {
  training: "Training day",
  rest: "Rest day",
  high: "High day"
};

// --- Macro ratio helpers ---
const round0 = (n) => Math.max(0, Math.round(Number(n) || 0));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const kgToLb = (kg) => Number(kg) * 2.2046226218;

function Nutrition() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);
  const [todayType, setTodayType] = useState("rest");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("pp_nutrition_view_mode") || "macros");
  const [macroDisplay, setMacroDisplay] = useState(() => localStorage.getItem("pp_mealplan_macro_display") || "both");
  // New state for tab, baselineRatios, logDate, dailyLog, savingLog
  const [tab, setTab] = useState(() => localStorage.getItem("pp_nutrition_tab") || "macros");
  const [baselineRatios, setBaselineRatios] = useState({ training: null, rest: null, high: null });
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyLog, setDailyLog] = useState({ calories: "", protein_g: "", carbs_g: "", fats_g: "", notes: "", finalized: false });
  const [savingLog, setSavingLog] = useState(false);
  // State for selected log date's resolved day type
  const [logDayType, setLogDayType] = useState("rest");
  const [logIsHigh, setLogIsHigh] = useState(false);
  // Helper to resolve a day type for any date.
  // Prefers explicit overrides (training_day_overrides), otherwise falls back to profiles.training_days.
  const resolveDayTypeForDate = async (uid, isoDate, fallbackTrainingDays) => {
    // 1) Explicit override (e.g. user changed the day type in Training)
    try {
      const { data: ov, error: ovErr } = await supabase
        .from("training_day_overrides")
        .select("override_type")
        .eq("user_id", uid)
        .eq("date", isoDate)
        .maybeSingle();

      if (!ovErr && ov?.override_type) {
        const t = String(ov.override_type);
        if (t === "high") return { dayType: "high", isHigh: true };
        if (t === "training") return { dayType: "training", isHigh: false };
        if (t === "rest") return { dayType: "rest", isHigh: false };
        // Unknown override_type → ignore
      }
    } catch {
      // ignore and fall back
    }

    // 2) Fallback: infer from weekly fixed training_days
    const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dow = dayMap[new Date(isoDate + "T00:00:00").getDay()];
    const inferred = (fallbackTrainingDays || []).includes(dow) ? "training" : "rest";
    return { dayType: inferred, isHigh: false };
  };


  const [targets, setTargets] = useState({
    training: null,
    rest: null,
    high: null
  });

  // Draft editing (no autosave)
  const [draftTargets, setDraftTargets] = useState({ training: null, rest: null, high: null });
  const [dirtyTargets, setDirtyTargets] = useState({ training: false, rest: false, high: false });

  const NUTRITION_CAPS = {
    calories: { min: 0, max: 6000 },
    protein_g: { min: 0, max: 350 },
    carbs_g: { min: 0, max: 900 },
    fats_g: { min: 0, max: 250 }
  };

  const clampInt = (v, min, max) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  };

  const recalcCalories = (row) => {
    const p = Number(row.protein_g || 0);
    const c = Number(row.carbs_g || 0);
    const f = Number(row.fats_g || 0);
    return Math.max(0, Math.round(p * 4 + c * 4 + f * 9));
  };

  const markDirty = (dayType) =>
    setDirtyTargets((prev) => ({ ...prev, [dayType]: true }));

  const updateDraftField = (dayType, field, value) => {
    setDraftTargets((prev) => {
      const current = prev[dayType] || {
        day_type: dayType,
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fats_g: 0
      };

      const cap = NUTRITION_CAPS[field] || { min: 0, max: 999999 };
      const clean = clampInt(value, cap.min, cap.max);
      const nextRow = { ...current, [field]: clean };

      // Keep calories consistent if any macro changes.
      if (field === "protein_g" || field === "carbs_g" || field === "fats_g") {
        nextRow.calories = clampInt(recalcCalories(nextRow), NUTRITION_CAPS.calories.min, NUTRITION_CAPS.calories.max);
      }

      return { ...prev, [dayType]: nextRow };
    });

    markDirty(dayType);
  };

  const applyRatiosToDraft = (dayType, nextRatios) => {
    if (!weightLb) {
      setError("Set a current weight to use ratio sliders.");
      return;
    }

    const p = clampInt(round0(nextRatios.protein * weightLb), NUTRITION_CAPS.protein_g.min, NUTRITION_CAPS.protein_g.max);
    const c = clampInt(round0(nextRatios.carbs * weightLb), NUTRITION_CAPS.carbs_g.min, NUTRITION_CAPS.carbs_g.max);
    const f = clampInt(round0(nextRatios.fats * weightLb), NUTRITION_CAPS.fats_g.min, NUTRITION_CAPS.fats_g.max);
    const calories = clampInt(round0(p * 4 + c * 4 + f * 9), NUTRITION_CAPS.calories.min, NUTRITION_CAPS.calories.max);

    setDraftTargets((prev) => {
      const current = prev[dayType] || {
        day_type: dayType,
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fats_g: 0
      };
      return { ...prev, [dayType]: { ...current, calories, protein_g: p, carbs_g: c, fats_g: f } };
    });

    markDirty(dayType);
  };

  const saveDayTypeTargets = async (dayType) => {
    if (!userId) return;
    setError("");
    setSavingTarget(true);

    const row = draftTargets[dayType];
    if (!row) {
      setSavingTarget(false);
      return;
    }

    // Final sanitize + compute calories if needed
    const payload = {
      user_id: userId,
      day_type: dayType,
      protein_g: clampInt(row.protein_g, NUTRITION_CAPS.protein_g.min, NUTRITION_CAPS.protein_g.max),
      carbs_g: clampInt(row.carbs_g, NUTRITION_CAPS.carbs_g.min, NUTRITION_CAPS.carbs_g.max),
      fats_g: clampInt(row.fats_g, NUTRITION_CAPS.fats_g.min, NUTRITION_CAPS.fats_g.max)
    };
    payload.calories = clampInt(recalcCalories(payload), NUTRITION_CAPS.calories.min, NUTRITION_CAPS.calories.max);

    const { error: e } = await supabase
      .from("nutrition_day_targets")
      .upsert(payload, { onConflict: "user_id,day_type" });

    setSavingTarget(false);

    if (e) {
      setError(e.message);
      return;
    }

    // Persisted -> update saved targets and clear dirty
    setTargets((prev) => ({ ...prev, [dayType]: { ...payload, day_type: dayType } }));
    setDraftTargets((prev) => ({ ...prev, [dayType]: { ...payload, day_type: dayType } }));
    setDirtyTargets((prev) => ({ ...prev, [dayType]: false }));
  };

  const resetDayTypeTargets = (dayType) => {
    setDraftTargets((prev) => ({ ...prev, [dayType]: targets[dayType] }));
    setDirtyTargets((prev) => ({ ...prev, [dayType]: false }));
  };

  const [flex, setFlex] = useState(null);

  const [savingTarget, setSavingTarget] = useState(false);
  const [savingFlex, setSavingFlex] = useState(false);

  const ratioSaveTimersRef = useRef({});

  useEffect(() => {
    return () => {
      Object.values(ratioSaveTimersRef.current || {}).forEach((t) => {
        if (t) clearTimeout(t);
      });
    };
  }, []);

  // --- Bodyweight and macro ratios state ---
  const [weightKg, setWeightKg] = useState(null);

  const [macroRatios, setMacroRatios] = useState(() => {
    const read = (k, fallback) => {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : fallback;
      } catch {
        return fallback;
      }
    };
    return {
      training: read("pp_macro_ratios_training", { protein: 1.0, carbs: 1.0, fats: 0.3 }),
      rest: read("pp_macro_ratios_rest", { protein: 1.0, carbs: 0.8, fats: 0.3 }),
      high: read("pp_macro_ratios_high", { protein: 1.0, carbs: 1.2, fats: 0.3 })
    };
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data: tData, error: tErr } = await supabase
        .from("nutrition_day_targets")
        .select("day_type, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", user.id);

      if (tErr) {
        setError(tErr.message);
        setLoading(false);
        return;
      }

      const mapped = {
        training: { day_type: "training", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
        rest: { day_type: "rest", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
        high: { day_type: "high", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
      };
      (tData || []).forEach((row) => {
        if (row?.day_type && mapped[row.day_type]) mapped[row.day_type] = row;
      });
      setTargets(mapped);
      setDraftTargets(mapped);
      setDirtyTargets({ training: false, rest: false, high: false });

      const todayIso = new Date().toISOString().slice(0, 10);

      const { data: pData } = await supabase
        .from("profiles")
        .select(
          "training_days, today_day_type, today_day_type_date, current_weight_kg, nutrition_view_mode, show_meal_macros, show_day_macros, baseline_ratio_training, baseline_ratio_rest, baseline_ratio_high"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      const trainingDays = Array.isArray(pData?.training_days) ? pData.training_days : [];
      const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const todayShort = dayMap[new Date().getDay()];
      const inferred = trainingDays.includes(todayShort) ? "training" : "rest";

      const storedType = pData?.today_day_type_date === todayIso ? pData?.today_day_type : null;
      setTodayType(storedType || inferred);

      if (pData?.current_weight_kg) setWeightKg(pData.current_weight_kg);

      if (pData?.nutrition_view_mode) {
        setViewMode(pData.nutrition_view_mode);
      }

      if (typeof pData?.show_meal_macros === "boolean" || typeof pData?.show_day_macros === "boolean") {
        const perMeal = pData?.show_meal_macros === true;
        const perDay = pData?.show_day_macros === true;
        const nextDisplay = perMeal && perDay ? "both" : perMeal ? "per_meal" : perDay ? "per_day" : "none";
        setMacroDisplay(nextDisplay);
      }

      // Set baseline ratios from profile
      setBaselineRatios({
        training: pData?.baseline_ratio_training || null,
        rest: pData?.baseline_ratio_rest || null,
        high: pData?.baseline_ratio_high || null
      });

      // Resolve day type for the selected log date (used in the Log tab goal display)
      const resolvedLog = await resolveDayTypeForDate(user.id, logDate, trainingDays);
      setLogDayType(resolvedLog.dayType);
      setLogIsHigh(resolvedLog.isHigh);

      const { data: fData, error: fErr } = await supabase
        .from("weekly_flex_rules")
        .select("base_cheat_meals, banked_cheat_meals, used_cheat_meals, alcohol_units_week, week_start")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fErr) {
        setError(fErr.message);
        setLoading(false);
        return;
      }

      if (!fData) {
        const r = await fetch(`${API_URL}/api/nutrition/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id })
        });

        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(j?.error || "Failed to initialize nutrition.");
          setLoading(false);
          return;
        }

        const { data: fData2, error: fErr2 } = await supabase
          .from("weekly_flex_rules")
          .select("base_cheat_meals, banked_cheat_meals, used_cheat_meals, alcohol_units_week, week_start")
          .eq("user_id", user.id)
          .maybeSingle();

        if (fErr2) {
          setError(fErr2.message);
          setLoading(false);
          return;
        }

        setFlex(fData2);
        // Load daily nutrition log for selected date
        const { data: dLog, error: dErr } = await supabase
          .from("daily_nutrition_logs")
          .select("calories, protein_g, carbs_g, fats_g, notes, finalized, finalized_at")
          .eq("user_id", user.id)
          .eq("log_date", logDate)
          .maybeSingle();

        if (!dErr && dLog) {
          setDailyLog({
            calories: dLog.calories ?? "",
            protein_g: dLog.protein_g ?? "",
            carbs_g: dLog.carbs_g ?? "",
            fats_g: dLog.fats_g ?? "",
            notes: dLog.notes ?? "",
            finalized: !!dLog.finalized
          });
        } else {
          setDailyLog({ calories: "", protein_g: "", carbs_g: "", fats_g: "", notes: "", finalized: false });
        }
        setLoading(false);
        return;
      }

      setFlex(fData);
      // Load daily nutrition log for selected date
      const { data: dLog, error: dErr } = await supabase
        .from("daily_nutrition_logs")
        .select("calories, protein_g, carbs_g, fats_g, notes, finalized, finalized_at")
        .eq("user_id", user.id)
        .eq("log_date", logDate)
        .maybeSingle();

      if (!dErr && dLog) {
        setDailyLog({
          calories: dLog.calories ?? "",
          protein_g: dLog.protein_g ?? "",
          carbs_g: dLog.carbs_g ?? "",
          fats_g: dLog.fats_g ?? "",
          notes: dLog.notes ?? "",
          finalized: !!dLog.finalized
        });
      } else {
        setDailyLog({ calories: "", protein_g: "", carbs_g: "", fats_g: "", notes: "", finalized: false });
      }
      setLoading(false);
    };

    load();
  }, []);
  // Reload daily log when userId or logDate changes
  useEffect(() => {
    const run = async () => {
      if (!userId || !logDate) return;
      setError("");

      // Resolve day type for this log date
      try {
        const { data: pData } = await supabase
          .from("profiles")
          .select("training_days")
          .eq("user_id", userId)
          .maybeSingle();
        const trainingDays = Array.isArray(pData?.training_days) ? pData.training_days : [];
        const resolved = await resolveDayTypeForDate(userId, logDate, trainingDays);
        setLogDayType(resolved.dayType);
        setLogIsHigh(resolved.isHigh);
      } catch {
        // ignore
      }

      const { data: dLog, error: dErr } = await supabase
        .from("daily_nutrition_logs")
        .select("calories, protein_g, carbs_g, fats_g, notes, finalized, finalized_at")
        .eq("user_id", userId)
        .eq("log_date", logDate)
        .maybeSingle();

      if (dErr) {
        // If the table/column isn't present yet, show error clearly
        setError(dErr.message);
        return;
      }

      if (dLog) {
        setDailyLog({
          calories: dLog.calories ?? "",
          protein_g: dLog.protein_g ?? "",
          carbs_g: dLog.carbs_g ?? "",
          fats_g: dLog.fats_g ?? "",
          notes: dLog.notes ?? "",
          finalized: !!dLog.finalized
        });
      } else {
        setDailyLog({ calories: "", protein_g: "", carbs_g: "", fats_g: "", notes: "", finalized: false });
      }
    };

    run();
  }, [userId, logDate]);

  // Keep in sync if another page (e.g. Training calendar) overrides today's day type.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`pp-nutrition-profiles-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const next = payload?.new;
          if (!next) return;

          const todayIso = new Date().toISOString().slice(0, 10);

          if (next.today_day_type_date === todayIso && next.today_day_type) {
            setTodayType(next.today_day_type);
          }

          if (typeof next.current_weight_kg === "number" || typeof next.current_weight_kg === "string") {
            const w = Number(next.current_weight_kg);
            if (Number.isFinite(w) && w > 0) setWeightKg(w);
          }

          if (next.nutrition_view_mode) {
            setViewMode(next.nutrition_view_mode);
            try {
              localStorage.setItem("pp_nutrition_view_mode", next.nutrition_view_mode);
            } catch {}
          }

          if (typeof next.show_meal_macros === "boolean" || typeof next.show_day_macros === "boolean") {
            const perMeal = next.show_meal_macros === true;
            const perDay = next.show_day_macros === true;
            const nextDisplay = perMeal && perDay ? "both" : perMeal ? "per_meal" : perDay ? "per_day" : "none";
            setMacroDisplay(nextDisplay);
            try {
              localStorage.setItem("pp_mealplan_macro_display", nextDisplay);
            } catch {}
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem("pp_macro_ratios_training", JSON.stringify(macroRatios.training));
      localStorage.setItem("pp_macro_ratios_rest", JSON.stringify(macroRatios.rest));
      localStorage.setItem("pp_macro_ratios_high", JSON.stringify(macroRatios.high));
    } catch {}
  }, [macroRatios]);

  // --- Nutrition UI prefs persistence helpers ---
  const persistNutritionPrefs = async (nextViewMode, nextMacroDisplay) => {
    if (!userId) return;
    const showMeal = nextMacroDisplay === "per_meal" || nextMacroDisplay === "both";
    const showDay = nextMacroDisplay === "per_day" || nextMacroDisplay === "both";

    const { error: e } = await supabase
      .from("profiles")
      .update({
        nutrition_view_mode: nextViewMode,
        show_meal_macros: showMeal,
        show_day_macros: showDay
      })
      .eq("user_id", userId);

    if (e) setError(e.message);
  };

  const setAndPersistViewMode = async (next) => {
    setViewMode(next);
    try {
      localStorage.setItem("pp_nutrition_view_mode", next);
    } catch {}
    await persistNutritionPrefs(next, macroDisplay);
  };

  const setAndPersistMacroDisplay = async (next) => {
    setMacroDisplay(next);
    try {
      localStorage.setItem("pp_mealplan_macro_display", next);
    } catch {}
    await persistNutritionPrefs(viewMode, next);
  };

  const totalCheatsAllowed = useMemo(() => {
    if (!flex) return 0;
    return Number(flex.base_cheat_meals || 0) + Number(flex.banked_cheat_meals || 0);
  }, [flex]);

  const cheatsRemaining = useMemo(() => {
    if (!flex) return 0;
    return Math.max(0, totalCheatsAllowed - Number(flex.used_cheat_meals || 0));
  }, [flex, totalCheatsAllowed]);

  const weightLb = useMemo(() => {
    if (!weightKg) return null;
    const lb = kgToLb(weightKg);
    return Number.isFinite(lb) && lb > 0 ? lb : null;
  }, [weightKg]);

  // Helper: clamp and ratioBounds, saveDailyLog
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const ratioBounds = useMemo(() => {
    const build = (dayType, key, fallbackVal) => {
      const base = baselineRatios?.[dayType]?.[key];
      const center = Number.isFinite(Number(base)) ? Number(base) : Number(fallbackVal);
      const min = round2(center - 0.5);
      const max = round2(center + 0.5);
      return { center, min, max };
    };

    return {
      training: {
        protein: build("training", "protein", macroRatios.training.protein),
        carbs: build("training", "carbs", macroRatios.training.carbs),
        fats: build("training", "fats", macroRatios.training.fats)
      },
      rest: {
        protein: build("rest", "protein", macroRatios.rest.protein),
        carbs: build("rest", "carbs", macroRatios.rest.carbs),
        fats: build("rest", "fats", macroRatios.rest.fats)
      },
      high: {
        protein: build("high", "protein", macroRatios.high.protein),
        carbs: build("high", "carbs", macroRatios.high.carbs),
        fats: build("high", "fats", macroRatios.high.fats)
      }
    };
  }, [baselineRatios, macroRatios]);

  const saveDailyLog = async (finalize = false) => {
    if (!userId || !logDate) return;
    setSavingLog(true);
    setError("");

    const cleanIntOrNull = (v) => {
      const s = String(v ?? "").trim();
      if (!s) return null;
      const n = Math.round(Number(s));
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const payload = {
      user_id: userId,
      log_date: logDate,
      calories: cleanIntOrNull(dailyLog.calories),
      protein_g: cleanIntOrNull(dailyLog.protein_g),
      carbs_g: cleanIntOrNull(dailyLog.carbs_g),
      fats_g: cleanIntOrNull(dailyLog.fats_g),
      notes: String(dailyLog.notes || ""),
      finalized: finalize ? true : !!dailyLog.finalized,
      finalized_at: finalize ? new Date().toISOString() : null
    };

    const { error: e } = await supabase
      .from("daily_nutrition_logs")
      .upsert(payload, { onConflict: "user_id,log_date" });

    setSavingLog(false);
    if (e) {
      setError(e.message);
      return;
    }

    setDailyLog((prev) => ({ ...prev, finalized: finalize ? true : prev.finalized }));
  };

  // REMOVE applyRatiosToDay and updateTargetField

  const updateRatio = (dayType, key, value) => {
    const bounds = ratioBounds?.[dayType]?.[key];
    const min = bounds ? bounds.min : value;
    const max = bounds ? bounds.max : value;
    const clean = round2(clamp(value, min, max));

    const nextRatios = { ...macroRatios[dayType], [key]: clean };
    setMacroRatios((prev) => ({ ...prev, [dayType]: nextRatios }));

    // No autosave: apply to local draft only
    applyRatiosToDraft(dayType, nextRatios);
  };

  const updateFlexField = async (field, value) => {
    if (!userId) return;
    setError("");
    setSavingFlex(true);

    const clean = Math.max(0, Math.round(Number(value) || 0));
    const next = { ...flex, [field]: clean };
    setFlex(next);

    const { error: e } = await supabase.from("weekly_flex_rules").update({ [field]: clean }).eq("user_id", userId);

    setSavingFlex(false);
    if (e) setError(e.message);
  };

  const useCheatMeal = async () => {
    if (!flex || !userId) return;
    if (cheatsRemaining <= 0) return;

    const nextUsed = Number(flex.used_cheat_meals || 0) + 1;
    setFlex({ ...flex, used_cheat_meals: nextUsed });

    const { error: e } = await supabase.from("weekly_flex_rules").update({ used_cheat_meals: nextUsed }).eq("user_id", userId);
    if (e) setError(e.message);
  };

  const saveTodayType = async (nextType) => {
    if (!userId) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    setTodayType(nextType);

    const { error: e } = await supabase
      .from("profiles")
      .update({
        today_day_type: nextType,
        today_day_type_date: todayIso,
        training_day_type_override: true,
        nutrition_day_type_override: true
      })
      .eq("user_id", userId);

    if (e) setError(e.message);
  };

  const todaysTargets = targets[todayType];

  if (loading) return <div>Loading...</div>;

  const sectionCard = {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: "16px",
    padding: "1.25rem",
    width: "100%"
  };

  const sectionTitle = { fontWeight: 800, margin: 0, fontSize: "1.05rem" };
  const sectionSub = { color: "#aaa", marginTop: "0.45rem", lineHeight: 1.55 };

  const input = {
    width: "100%",
    padding: "0.6rem",
    background: "#111",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "12px"
  };

  const pill = (active) => ({
    padding: "0.55rem 0.85rem",
    background: active ? "#1e1e1e" : "transparent",
    color: active ? "#fff" : "#aaa",
    border: "1px solid #222",
    cursor: "pointer",
    borderRadius: "12px"
  });

  const responsive = `
    .pp-stack { display: grid; gap: 1rem; margin-top: 1rem; }
    .pp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .pp-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .pp-metrics-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }

    @media (max-width: 1050px) {
      .pp-metrics-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 980px) {
      .pp-grid-3 { grid-template-columns: 1fr; }
    }

    @media (max-width: 820px) {
      .pp-grid-2 { grid-template-columns: 1fr; }
    }

    @media (max-width: 520px) {
      .pp-page-header { flex-direction: column; align-items: flex-start !important; }
      .pp-actions { width: 100%; justify-content: flex-start !important; flex-wrap: wrap; }
      .pp-actions-right { width: 100%; justify-content: space-between !important; }
    }
  `;

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ width: "100%" }}>
      <style>{responsive}</style>

      {/* PAGE HEADER */}
      <div className="pp-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Nutrition</h1>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            {tab === "macros"
              ? "Daily targets can differ by training day, rest day, and high day."
              : tab === "meal_plan"
              ? "Meal plans will be generated by the coach based on your targets and preferences."
              : "Log what you ate today (macros) or leave notes. Finalize at the end of the day."}
          </div>
        </div>

        <div className="pp-actions" style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => {
                setTab("macros");
                try { localStorage.setItem("pp_nutrition_tab", "macros"); } catch {}
                setAndPersistViewMode("macros");
              }}
              style={pill(tab === "macros")}
            >
              Macros
            </button>

            <button
              type="button"
              onClick={() => {
                setTab("meal_plan");
                try { localStorage.setItem("pp_nutrition_tab", "meal_plan"); } catch {}
                setAndPersistViewMode("meal_plan");
              }}
              style={pill(tab === "meal_plan")}
            >
              Meal plan
            </button>

            <button
              type="button"
              onClick={() => {
                setTab("log");
                try { localStorage.setItem("pp_nutrition_tab", "log"); } catch {}
              }}
              style={pill(tab === "log")}
            >
              Log
            </button>
          </div>

          {tab === "meal_plan" && (
            <select
              value={macroDisplay}
              onChange={(e) => setAndPersistMacroDisplay(e.target.value)}
              style={{
                background: "#111",
                color: "#fff",
                border: "1px solid #222",
                padding: "0.55rem 0.7rem",
                borderRadius: "12px"
              }}
            >
              <option value="none">Hide macros</option>
              <option value="per_meal">Macros per meal</option>
              <option value="per_day">Macros per day</option>
              <option value="both">Macros per meal + day</option>
            </select>
          )}

            <div style={{ color: "#666", minWidth: "120px", textAlign: "right" }}>
              {savingTarget || savingFlex
                ? "Saving..."
                : (dirtyTargets.training || dirtyTargets.rest || dirtyTargets.high)
                ? "Unsaved targets"
                : "Saved"}
            </div>
        </div>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

      {/* MACROS VIEW */}
      {tab === "macros" && (
        <div className="pp-stack">
          {/* SECTION: TODAY */}
          <section style={sectionCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
              <div>
                <div style={sectionTitle}>Today</div>
                <div style={sectionSub}>Choose which target you're following today. Default is inferred from your training days.</div>
              </div>
              <div style={{ color: "#666" }}>{dayLabel[todayType]}</div>
            </div>

            {/* Goal for the day */}
            <div
              style={{
                marginTop: "1rem",
                border: "1px solid #222",
                background: "#111",
                borderRadius: "16px",
                padding: "1rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
                <div style={{ fontWeight: 800 }}>Goal for {todayIso}</div>

                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ color: "#aaa" }}>Day type</div>
                  <select
                    value={todayType}
                    onChange={(e) => saveTodayType(e.target.value)}
                    style={{ ...input, width: "auto", padding: "0.6rem 0.7rem" }}
                  >
                    <option value="training">Training day</option>
                    <option value="rest">Rest day</option>
                    <option value="high">High day</option>
                  </select>
                </div>
              </div>

              <div style={{ color: "#aaa", marginTop: "0.5rem", lineHeight: 1.55 }}>
                Use these targets as your aim for the day.
              </div>

              <div className="pp-metrics-4" style={{ marginTop: "0.85rem" }}>
                <div>
                  <div style={{ color: "#aaa" }}>Calories</div>
                  <div style={{ marginTop: "0.25rem", fontSize: "1.15rem" }}>{todaysTargets?.calories ?? "—"}</div>
                </div>
                <div>
                  <div style={{ color: "#aaa" }}>Protein</div>
                  <div style={{ marginTop: "0.25rem", fontSize: "1.15rem" }}>{todaysTargets ? `${todaysTargets.protein_g}g` : "—"}</div>
                </div>
                <div>
                  <div style={{ color: "#aaa" }}>Carbs</div>
                  <div style={{ marginTop: "0.25rem", fontSize: "1.15rem" }}>{todaysTargets ? `${todaysTargets.carbs_g}g` : "—"}</div>
                </div>
                <div>
                  <div style={{ color: "#aaa" }}>Fats</div>
                  <div style={{ marginTop: "0.25rem", fontSize: "1.15rem" }}>{todaysTargets ? `${todaysTargets.fats_g}g` : "—"}</div>
                </div>
              </div>

              <div style={{ color: "#666", marginTop: "0.75rem", fontSize: "0.9rem" }}>
                Note: right now this uses your current day-type selection. If you log future dates, you can switch the day type here.
              </div>
            </div>

          </section>

          {/* SECTION: DAY TYPE TARGETS */}
          <section style={sectionCard}>
            <div style={sectionTitle}>Day-type targets</div>
            <div style={sectionSub}>Edit calories/macros for each day type. Ratios update macros & calories automatically.</div>

            <div className="pp-grid-3" style={{ marginTop: "1rem" }}>
              {["training", "rest", "high"].map((dayType) => {
                const t = draftTargets[dayType];
                if (!t) return null;

                return (
                  <div key={dayType} style={{ border: "1px solid #222", background: "#111", borderRadius: "16px", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem" }}>
                      <div style={{ fontWeight: 800 }}>{dayLabel[dayType]}</div>
                      <div style={{ color: "#666", fontSize: "0.9rem" }}>{dayType === "high" ? "+ carbs day" : ""}</div>
                    </div>

                    <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      {dirtyTargets[dayType] ? (
                        <div style={{ color: "#ffb86b", fontSize: "0.9rem" }}>Unsaved changes</div>
                      ) : (
                        <div style={{ color: "#666", fontSize: "0.9rem" }}>Saved</div>
                      )}

                      <div style={{ flex: 1 }} />

                      <button
                        type="button"
                        onClick={() => resetDayTypeTargets(dayType)}
                        disabled={savingTarget || !dirtyTargets[dayType]}
                        style={{
                          padding: "0.5rem 0.75rem",
                          borderRadius: "12px",
                          border: "1px solid #333",
                          background: "transparent",
                          color: !dirtyTargets[dayType] ? "#666" : "#fff",
                          cursor: !dirtyTargets[dayType] ? "default" : "pointer"
                        }}
                      >
                        Reset
                      </button>

                      <button
                        type="button"
                        onClick={() => saveDayTypeTargets(dayType)}
                        disabled={savingTarget || !dirtyTargets[dayType]}
                        style={{
                          padding: "0.5rem 0.75rem",
                          borderRadius: "12px",
                          border: "1px solid #333",
                          background: !dirtyTargets[dayType] ? "transparent" : "#2a2a2a",
                          color: !dirtyTargets[dayType] ? "#666" : "#fff",
                          cursor: !dirtyTargets[dayType] ? "default" : "pointer"
                        }}
                      >
                        {savingTarget ? "Saving…" : "Save"}
                      </button>
                    </div>

                    <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.65rem" }}>
                      <div>
                        <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Calories</div>
                        <input
                          type="number"
                          min="0"
                          value={t.calories}
                          onChange={(e) => updateDraftField(dayType, "calories", e.target.value)}
                          style={input}
                        />
                      </div>

                      <div className="pp-grid-3" style={{ gap: "0.5rem" }}>
                        <div>
                          <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Protein (g)</div>
                          <input
                            type="number"
                            min="0"
                            value={t.protein_g}
                            onChange={(e) => updateDraftField(dayType, "protein_g", e.target.value)}
                            style={input}
                          />
                        </div>

                        <div>
                          <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Carbs (g)</div>
                          <input
                            type="number"
                            min="0"
                            value={t.carbs_g}
                            onChange={(e) => updateDraftField(dayType, "carbs_g", e.target.value)}
                            style={input}
                          />
                        </div>

                        <div>
                          <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Fats (g)</div>
                          <input
                            type="number"
                            min="0"
                            value={t.fats_g}
                            onChange={(e) => updateDraftField(dayType, "fats_g", e.target.value)}
                            style={input}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Ratios */}
                    <div style={{ borderTop: "1px solid #222", marginTop: "0.9rem", paddingTop: "0.9rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem" }}>
                        <div style={{ fontWeight: 800 }}>Ratios (g/lb)</div>
                        <div style={{ color: "#666", fontSize: "0.9rem" }}>
                          {weightLb ? `Using ~${Math.round(weightLb)} lb` : "Set current weight"}
                        </div>
                      </div>

                      <div style={{ color: "#aaa", marginTop: "0.4rem", fontSize: "0.9rem" }}>
                        Adjust in 0.05 g/lb steps. Sliders are capped to ±0.5 g/lb from your baseline.
                      </div>

                      <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.7rem" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: "0.9rem" }}>
                            <span>Protein</span>
                            <span>{macroRatios[dayType].protein.toFixed(2)} g/lb</span>
                          </div>
                          <input
                            type="range"
                            min={ratioBounds[dayType].protein.min}
                            max={ratioBounds[dayType].protein.max}
                            step="0.05"
                            value={macroRatios[dayType].protein}
                            onChange={(e) => updateRatio(dayType, "protein", Number(e.target.value))}
                            style={{ width: "100%" }}
                            disabled={!weightLb}
                          />
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: "0.9rem" }}>
                            <span>Carbs</span>
                            <span>{macroRatios[dayType].carbs.toFixed(2)} g/lb</span>
                          </div>
                          <input
                            type="range"
                            min={ratioBounds[dayType].carbs.min}
                            max={ratioBounds[dayType].carbs.max}
                            step="0.05"
                            value={macroRatios[dayType].carbs}
                            onChange={(e) => updateRatio(dayType, "carbs", Number(e.target.value))}
                            style={{ width: "100%" }}
                            disabled={!weightLb}
                          />
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: "0.9rem" }}>
                            <span>Fats</span>
                            <span>{macroRatios[dayType].fats.toFixed(2)} g/lb</span>
                          </div>
                          <input
                            type="range"
                            min={ratioBounds[dayType].fats.min}
                            max={ratioBounds[dayType].fats.max}
                            step="0.05"
                            value={macroRatios[dayType].fats}
                            onChange={(e) => updateRatio(dayType, "fats", Number(e.target.value))}
                            style={{ width: "100%" }}
                            disabled={!weightLb}
                          />
                        </div>

                        {!weightLb && (
                          <div style={{ color: "#ffb86b", fontSize: "0.9rem" }}>
                            Set your current weight (onboarding/weight logs) to enable ratio sliders.
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ color: "#666", marginTop: "0.85rem", fontSize: "0.9rem" }}>
                      These are day-type targets. The app will apply them automatically based on your plan.
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION: FLEXIBILITY */}
          <section style={sectionCard}>
            <div style={sectionTitle}>Weekly flexibility</div>
            <div style={sectionSub}>Cheat meals + alcohol live here. Each block uses full width on mobile.</div>

            <div className="pp-grid-2" style={{ marginTop: "1rem" }}>
              {/* Cheat meals */}
              <div style={{ border: "1px solid #222", background: "#111", borderRadius: "16px", padding: "1rem" }}>
                <div style={{ fontWeight: 800 }}>Cheat meals</div>
                <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
                  Cheat meals can be planned or used on any day. Banking is capped at +1.
                </div>

                {flex && (
                  <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
                    <div className="pp-grid-2" style={{ gap: "0.75rem" }}>
                      <div>
                        <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Base cheat meals/week</div>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          value={flex.base_cheat_meals}
                          onChange={(e) => updateFlexField("base_cheat_meals", e.target.value)}
                          style={input}
                        />
                      </div>

                      <div>
                        <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Banked (max +1)</div>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          value={flex.banked_cheat_meals}
                          onChange={(e) => updateFlexField("banked_cheat_meals", e.target.value)}
                          style={input}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
                      <div style={{ color: "#aaa" }}>
                        Remaining this week:{" "}
                        <span style={{ color: "#fff", fontWeight: 800 }}>{cheatsRemaining}</span>
                      </div>

                      <button
                        onClick={useCheatMeal}
                        disabled={cheatsRemaining <= 0}
                        style={{
                          padding: "0.55rem 0.9rem",
                          background: cheatsRemaining <= 0 ? "transparent" : "#2a2a2a",
                          color: cheatsRemaining <= 0 ? "#666" : "#fff",
                          border: "1px solid #333",
                          cursor: cheatsRemaining <= 0 ? "default" : "pointer",
                          borderRadius: "12px"
                        }}
                      >
                        Use 1 cheat meal
                      </button>
                    </div>

                    <div style={{ color: "#666", fontSize: "0.9rem" }}>Week start: {flex.week_start}</div>
                  </div>
                )}
              </div>

              {/* Alcohol */}
              <div style={{ border: "1px solid #222", background: "#111", borderRadius: "16px", padding: "1rem" }}>
                <div style={{ fontWeight: 800 }}>Alcohol</div>
                <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
                  Track UK units for the week. If this gets high, the app will prompt you to reassess.
                </div>

                {flex && (
                  <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
                    <div>
                      <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Units this week</div>
                      <input
                        type="number"
                        min="0"
                        value={flex.alcohol_units_week}
                        onChange={(e) => updateFlexField("alcohol_units_week", e.target.value)}
                        style={input}
                      />
                    </div>

                    {Number(flex.alcohol_units_week || 0) >= 20 && (
                      <div style={{ color: "#ffb86b" }}>
                        That’s quite high. If fat loss stalls or recovery drops, consider reducing alcohol for a week.
                      </div>
                    )}

                    <div style={{ color: "#666", fontSize: "0.9rem" }}>
                      This resets weekly. Banking does not apply to alcohol.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* MEAL PLAN VIEW */}
      {tab === "meal_plan" && (
        <div className="pp-stack">
          <section style={sectionCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
              <div>
                <div style={sectionTitle}>Meal plan</div>
                <div style={sectionSub}>This will be generated by the coach in the next version.</div>
              </div>
              <div style={{ color: "#666" }}>{dayLabel[todayType]}</div>
            </div>

            <div className="pp-grid-2" style={{ marginTop: "1rem" }}>
              <div>
                <div style={{ color: "#aaa", marginBottom: "0.35rem" }}>Today’s day type</div>
                <select
                  value={todayType}
                  onChange={(e) => saveTodayType(e.target.value)}
                  style={{ ...input, padding: "0.7rem" }}
                >
                  <option value="training">Training day</option>
                  <option value="rest">Rest day</option>
                  <option value="high">High day</option>
                </select>

                <div style={{ color: "#666", marginTop: "0.75rem", fontSize: "0.9rem" }}>
                  Your meal plan will be generated from your targets and preferences.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800 }}>Today’s meal plan</div>
                <div style={{ marginTop: "0.75rem", color: "#aaa" }}>
                  Meal plans will be generated by the coach in the next version.
                </div>

                <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled
                    style={{
                      padding: "0.6rem 0.9rem",
                      background: "transparent",
                      color: "#666",
                      border: "1px solid #333",
                      cursor: "not-allowed",
                      borderRadius: "12px"
                    }}
                  >
                    Generate meal plan
                  </button>

                  <button
                    type="button"
                    disabled
                    style={{
                      padding: "0.6rem 0.9rem",
                      background: "transparent",
                      color: "#666",
                      border: "1px solid #333",
                      cursor: "not-allowed",
                      borderRadius: "12px"
                    }}
                  >
                    Regenerate
                  </button>
                </div>

                {macroDisplay !== "none" && (
                  <div style={{ marginTop: "1rem", borderTop: "1px solid #222", paddingTop: "1rem" }}>
                    {macroDisplay !== "per_meal" && (
                      <div className="pp-metrics-4">
                        <div>
                          <div style={{ color: "#aaa" }}>Calories</div>
                          <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todaysTargets?.calories ?? "—"}</div>
                        </div>
                        <div>
                          <div style={{ color: "#aaa" }}>Protein</div>
                          <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>
                            {todaysTargets ? `${todaysTargets.protein_g}g` : "—"}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: "#aaa" }}>Carbs</div>
                          <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>
                            {todaysTargets ? `${todaysTargets.carbs_g}g` : "—"}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: "#aaa" }}>Fats</div>
                          <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>
                            {todaysTargets ? `${todaysTargets.fats_g}g` : "—"}
                          </div>
                        </div>
                      </div>
                    )}

                    {macroDisplay !== "per_day" && (
                      <div style={{ marginTop: "0.9rem", color: "#666", fontSize: "0.9rem" }}>
                        When meal plans are enabled, macros can be shown per-meal and/or for the full day.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* LOG VIEW */}
      {tab === "log" && (
        <div className="pp-stack">
          <section style={sectionCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
              <div>
                <div style={sectionTitle}>Daily nutrition log</div>
                <div style={sectionSub}>
                  Enter your day totals (quick) or write notes. Finalize when you're done for the day.
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ color: "#aaa" }}>Date</div>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  style={{ ...input, width: "auto" }}
                />
              </div>
            </div>

            <div className="pp-grid-2" style={{ marginTop: "1rem" }}>
              <div>
                {/* Goal for the day block */}
                <div style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #222", background: "#111", borderRadius: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>Goal for {logDate}</div>
                    <div style={{ color: "#666", fontSize: "0.9rem" }}>
                      {logDayType === "high" ? "High day" : logDayType === "training" ? "Training day" : "Rest day"}
                      {logIsHigh ? " (high)" : ""}
                    </div>
                  </div>

                  <div style={{ color: "#aaa", marginTop: "0.4rem", fontSize: "0.9rem", lineHeight: 1.4 }}>
                    These targets are synced from your training calendar. If you need to change the day type, do it in Training.
                  </div>

                  <div className="pp-metrics-4" style={{ marginTop: "0.75rem" }}>
                    <div>
                      <div style={{ color: "#aaa" }}>Calories</div>
                      <div style={{ marginTop: "0.25rem", fontSize: "1.15rem" }}>
                        {(targets[logDayType]?.calories ?? "—")}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#aaa" }}>Protein</div>
                      <div style={{ marginTop: "0.25rem", fontSize: "1.15rem" }}>
                        {targets[logDayType] ? `${targets[logDayType].protein_g}g` : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#aaa" }}>Carbs</div>
                      <div style={{ marginTop: "0.25rem", fontSize: "1.15rem" }}>
                        {targets[logDayType] ? `${targets[logDayType].carbs_g}g` : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#aaa" }}>Fats</div>
                      <div style={{ marginTop: "0.25rem", fontSize: "1.15rem" }}>
                        {targets[logDayType] ? `${targets[logDayType].fats_g}g` : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ fontWeight: 800 }}>Totals</div>
                <div style={{ color: "#666", marginTop: "0.35rem", fontSize: "0.9rem" }}>
                  You can log totals even if you don't know the exact foods yet.
                </div>

                <div className="pp-metrics-4" style={{ marginTop: "0.9rem" }}>
                  <div>
                    <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Calories</div>
                    <input
                      type="number"
                      min="0"
                      value={dailyLog.calories}
                      onChange={(e) => setDailyLog((p) => ({ ...p, calories: e.target.value }))}
                      style={input}
                      disabled={dailyLog.finalized}
                    />
                  </div>
                  <div>
                    <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Protein (g)</div>
                    <input
                      type="number"
                      min="0"
                      value={dailyLog.protein_g}
                      onChange={(e) => setDailyLog((p) => ({ ...p, protein_g: e.target.value }))}
                      style={input}
                      disabled={dailyLog.finalized}
                    />
                  </div>
                  <div>
                    <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Carbs (g)</div>
                    <input
                      type="number"
                      min="0"
                      value={dailyLog.carbs_g}
                      onChange={(e) => setDailyLog((p) => ({ ...p, carbs_g: e.target.value }))}
                      style={input}
                      disabled={dailyLog.finalized}
                    />
                  </div>
                  <div>
                    <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Fats (g)</div>
                    <input
                      type="number"
                      min="0"
                      value={dailyLog.fats_g}
                      onChange={(e) => setDailyLog((p) => ({ ...p, fats_g: e.target.value }))}
                      style={input}
                      disabled={dailyLog.finalized}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => saveDailyLog(false)}
                    disabled={savingLog || dailyLog.finalized}
                    style={{ ...pill(true), background: "#2a2a2a", borderColor: "#333" }}
                  >
                    {savingLog ? "Saving…" : "Save"}
                  </button>

                  <button
                    type="button"
                    onClick={() => saveDailyLog(true)}
                    disabled={savingLog || dailyLog.finalized}
                    style={pill(false)}
                  >
                    Finalize day
                  </button>

                  {dailyLog.finalized && (
                    <div style={{ color: "#ffb86b", alignSelf: "center" }}>
                      Finalized — unlock by editing in the database for now.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800 }}>Notes / chat log</div>
                <div style={{ color: "#666", marginTop: "0.35rem", fontSize: "0.9rem" }}>
                  Type what you ate (free text). Later the coach can parse and structure this.
                </div>

                <textarea
                  value={dailyLog.notes}
                  onChange={(e) => setDailyLog((p) => ({ ...p, notes: e.target.value }))}
                  style={{ ...input, minHeight: "220px", resize: "vertical", padding: "0.85rem" }}
                  disabled={dailyLog.finalized}
                  placeholder="Example: Breakfast: oats + whey..."
                />

                <div style={{ marginTop: "0.75rem", color: "#666", fontSize: "0.9rem" }}>
                  This will be included in your weekly check-in.
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Nutrition;