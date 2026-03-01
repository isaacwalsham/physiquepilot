import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const API_URL = (
  String(import.meta.env.VITE_API_URL || "")
    .trim()
    .replace(/\/$/, "") ||
  (import.meta.env.DEV ? "http://localhost:4000" : "https://physiquepilot.onrender.com")
);
const IS_DEV = Boolean(import.meta.env.DEV);

const dayLabel = {
  training: "Training day",
  rest: "Rest day",
  high: "High day"
};

const UNIT_OPTIONS = ["g", "ml", "l", "oz", "lb", "serv"];
const MACRO_CODES = new Set(["energy_kcal", "protein_g", "carbs_g", "fat_g", "alcohol_g"]);
const HIDDEN_MICRO_CODES = new Set(["net_carbs_g"]);

const clampInt = (v, min, max) => {
  const n = Math.round(Number(v) || 0);
  return Math.min(max, Math.max(min, n));
};

const clampNumber = (v, min, max, decimals = 2) => {
  const nRaw = Number(String(v ?? "").trim());
  const n = Number.isFinite(nRaw) ? nRaw : 0;
  const clamped = Math.min(max, Math.max(min, n));
  const p = 10 ** decimals;
  return Math.round(clamped * p) / p;
};

const isPositiveNumber = (v) => {
  const n = Number(String(v || "").trim());
  return Number.isFinite(n) && n > 0;
};

const calcCalories = (p, c, f) => (Number(p) || 0) * 4 + (Number(c) || 0) * 4 + (Number(f) || 0) * 9;
const pct = (value, total) => {
  if (!Number.isFinite(Number(total)) || Number(total) <= 0) return 0;
  return Math.max(0, Math.min(100, (Number(value) / Number(total)) * 100));
};
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const formatNutrientAmount = (v) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 100) return String(Math.round(n * 10) / 10);
  if (abs >= 10) return String(Math.round(n * 10) / 10);
  if (abs >= 1) return String(Math.round(n * 100) / 100);
  if (abs >= 0.1) return String(Math.round(n * 1000) / 1000);
  return String(Math.round(n * 10000) / 10000);
};

const NUTRIENT_LABEL_OVERRIDES = {
  caffeine_mg: "Caffeine",
  water_g: "Water",
  fiber_g: "Dietary Fibre",
  starch_g: "Starch",
  sugars_g: "Sugars",
  omega3_g: "Omega 3",
  omega6_g: "Omega 6",
  omega_3_g: "Omega 3",
  omega_6_g: "Omega 6",
  cholesterol_mg: "Cholesterol",
  histidine_g: "Histidine",
  isoleucine_g: "Isoleucine",
  leucine_g: "Leucine",
  lysine_g: "Lysine",
  methionine_g: "Methionine",
  cystine_g: "Cystine",
  phenylalanine_g: "Phenylalanine",
  threonine_g: "Threonine",
  tryptophan_g: "Tryptophan",
  tyrosine_g: "Tyrosine",
  valine_g: "Valine",
  thiamin_b1_mg: "B1",
  riboflavin_b2_mg: "B2",
  vitamin_b3_mg: "B3",
  pantothenic_b5_mg: "B5",
  vitamin_b6_mg: "B6",
  folate_ug: "B9",
  vitamin_b12_ug: "B12",
  vitamin_a_ug: "Vitamin A",
  vitamin_c_mg: "Vitamin C",
  vitamin_d_ug: "Vitamin D",
  vitamin_e_mg: "Vitamin E",
  vitamin_k_ug: "Vitamin K",
  calcium_mg: "Calcium",
  copper_mg: "Copper",
  iron_mg: "Iron",
  magnesium_mg: "Magnesium",
  manganese_mg: "Manganese",
  phosphorus_mg: "Phosphorus",
  potassium_mg: "Potassium",
  selenium_ug: "Selenium",
  sodium_mg: "Sodium",
  zinc_mg: "Zinc",
  monounsaturated_g: "Monounsaturated Fat",
  polyunsaturated_g: "Polyunsaturated Fat",
  sat_fat_g: "Saturated Fat",
  trans_fat_g: "Trans Fat",
  added_sugars_g: "Added Sugars",
  net_carbs_g: "Net Carbs"
};

const NUTRIENT_LABEL_TEXT_OVERRIDES = {
  "vitamin e (alpha-tocopherol)": "Vitamin E",
  "vitamin d (d2 + d3)": "Vitamin D",
  "vitamin d (d2 + d3), international units": "Vitamin D",
  "vitamin k (phylloquinone)": "Vitamin K",
  "(phylloquinone)": "Vitamin K",
  "total dietary fiber (aoac 2011.25)": "Dietary Fibre",
  "total ascorbic acid": "Vitamin C",
  "pantothenic acid": "B5",
  "pantheotic acid": "B5"
};

const VITAMIN_B_ORDER = {
  thiamin_b1_mg: 1,
  riboflavin_b2_mg: 2,
  vitamin_b3_mg: 3,
  pantothenic_b5_mg: 5,
  vitamin_b6_mg: 6,
  folate_ug: 9,
  vitamin_b12_ug: 12
};

const GROUP_SORT_ORDER = {
  General: 1,
  Carbohydrates: 2,
  Lipids: 3,
  Protein: 4,
  Vitamins: 5,
  Minerals: 6,
  Other: 7
};

const formatNutrientUnit = (unit) => {
  const u = String(unit || "").trim().toLowerCase();
  if (!u) return "";
  if (u === "international units" || u === "international unit" || u === "iu") return "IU";
  if (u === "microgram" || u === "micrograms") return "ug";
  if (u === "milligram" || u === "milligrams") return "mg";
  return unit;
};

const displayNutrientLabel = (code, label) => {
  const c = String(code || "").trim();
  if (NUTRIENT_LABEL_OVERRIDES[c]) return NUTRIENT_LABEL_OVERRIDES[c];
  const raw = String(label || "").trim();
  const normalizedRaw = raw.toLowerCase();
  if (NUTRIENT_LABEL_TEXT_OVERRIDES[normalizedRaw]) return NUTRIENT_LABEL_TEXT_OVERRIDES[normalizedRaw];
  if (!raw || raw === c) {
    return c
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return raw;
};

const displayNutrientGroup = (code, group) => {
  const g = String(group || "").trim();
  if (g && g.toLowerCase() !== "usda nutrients") return g;
  const c = String(code || "");
  if (["omega3_g", "omega6_g", "omega_3_g", "omega_6_g", "fat_g", "sat_fat_g", "trans_fat_g", "monounsaturated_g", "polyunsaturated_g", "cholesterol_mg"].includes(c)) return "Lipids";
  if (["protein_g", "cystine_g", "histidine_g", "isoleucine_g", "leucine_g", "lysine_g", "methionine_g", "phenylalanine_g", "threonine_g", "tryptophan_g", "tyrosine_g", "valine_g"].includes(c)) return "Protein";
  if (["thiamin_b1_mg", "riboflavin_b2_mg", "vitamin_b3_mg", "pantothenic_b5_mg", "vitamin_b6_mg", "vitamin_b12_ug", "folate_ug", "vitamin_a_ug", "vitamin_c_mg", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug"].includes(c)) return "Vitamins";
  if (["calcium_mg", "copper_mg", "iron_mg", "magnesium_mg", "manganese_mg", "phosphorus_mg", "potassium_mg", "selenium_ug", "sodium_mg", "zinc_mg"].includes(c)) return "Minerals";
  if (["carbs_g", "fiber_g", "starch_g", "sugars_g", "added_sugars_g", "net_carbs_g"].includes(c)) return "Carbohydrates";
  if (["energy_kcal", "alcohol_g", "caffeine_mg", "water_g"].includes(c)) return "General";
  return "Other";
};

const nutrientSortKey = (row) => {
  const group = displayNutrientGroup(row?.code, row?.sort_group);
  return {
    groupOrder: GROUP_SORT_ORDER[group] || 99,
    group,
    sortOrder: Number(row?.sort_order || 0),
    bOrder: VITAMIN_B_ORDER[row?.code] || 999
  };
};

const todayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export default function Nutrition() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState("log");
  const [planTab, setPlanTab] = useState("targets");

  const [todayType, setTodayType] = useState("rest");
  const [targets, setTargets] = useState({ training: null, rest: null, high: null });
  const [editTargets, setEditTargets] = useState({ training: null, rest: null, high: null });

  const [entries, setEntries] = useState([]);
  const [entryFood, setEntryFood] = useState("");
  const [entryQty, setEntryQty] = useState("");
  const [entryUnit, setEntryUnit] = useState("g");
  const [entryState, setEntryState] = useState("raw");
  const [entryFoodId, setEntryFoodId] = useState(null);
  const [entryUserFoodId, setEntryUserFoodId] = useState(null);

  const [foodResults, setFoodResults] = useState([]);
  const [foodSearching, setFoodSearching] = useState(false);
  const [foodDropdownOpen, setFoodDropdownOpen] = useState(false);
  const [entryResolving, setEntryResolving] = useState(false);
  const [entryFoodLocked, setEntryFoodLocked] = useState(false);

  const [logNotes, setLogNotes] = useState("");
  const [waterMl, setWaterMl] = useState(0);
  const [saltG, setSaltG] = useState(0);

  const [logTotals, setLogTotals] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, alcohol_g: 0 });
  const [dayNutrients, setDayNutrients] = useState([]);
  const [dayNutrientsLoading, setDayNutrientsLoading] = useState(false);
  const [logWarnings, setLogWarnings] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [toast, setToast] = useState(null);
  const [microGroupFilter, setMicroGroupFilter] = useState("all");
  const [microTargetMode, setMicroTargetMode] = useState("rdi");
  const [microTargetsByCode, setMicroTargetsByCode] = useState({});
  const [microTargetDrafts, setMicroTargetDrafts] = useState({});
  const [savingMicroTargets, setSavingMicroTargets] = useState(false);
  const [microTargetWarnings, setMicroTargetWarnings] = useState([]);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const todaysTargets = useMemo(() => targets?.[todayType] || null, [targets, todayType]);

  const pushToast = (message, type = "info") => {
    const msg = String(message || "").trim();
    if (!msg) return;
    setToast({ id: Date.now(), message: msg, type });
  };

  const userFacingFoodLookupError = (errLike) => {
    const msg = String(errLike?.message || errLike || "");
    if (
      msg.includes("USDA food lookup failed (404)") ||
      msg.includes("Unable to load USDA food details")
    ) {
      return "Food not found. Try another result or a simpler search term.";
    }
    return "";
  };

  useEffect(() => {
    if (!toast?.id) return;
    const handle = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(handle);
  }, [toast?.id]);

  const groupedMicros = useMemo(() => {
    return Array.from(
      dayNutrients
        .filter((n) => !MACRO_CODES.has(String(n.code || "")))
        .filter((n) => !HIDDEN_MICRO_CODES.has(String(n.code || "")))
        .reduce((acc, n) => {
          const key = n.sort_group || "Other";
          if (!acc.has(key)) acc.set(key, []);
          acc.get(key).push(n);
          return acc;
        }, new Map())
    );
  }, [dayNutrients]);

  const microSliderRows = useMemo(() => {
    const rows = dayNutrients
      .filter((n) => !MACRO_CODES.has(String(n.code || "")))
      .filter((n) => !HIDDEN_MICRO_CODES.has(String(n.code || "")))
      .slice()
      .sort((a, b) => {
        const ka = nutrientSortKey(a);
        const kb = nutrientSortKey(b);
        if (ka.groupOrder !== kb.groupOrder) {
          return ka.groupOrder - kb.groupOrder;
        }
        if (ka.group !== kb.group) {
          return String(ka.group).localeCompare(String(kb.group));
        }
        if (ka.group === "Vitamins" && ka.bOrder !== kb.bOrder) {
          return ka.bOrder - kb.bOrder;
        }
        if (ka.sortOrder !== kb.sortOrder) {
          return ka.sortOrder - kb.sortOrder;
        }
        return String(displayNutrientLabel(a.code, a.label)).localeCompare(String(displayNutrientLabel(b.code, b.label)));
      });

    const maxByGroup = new Map();
    for (const row of rows) {
      const g = String(row.sort_group || "Other");
      const cur = Number(maxByGroup.get(g) || 0);
      maxByGroup.set(g, Math.max(cur, Number(row.amount || 0), 1));
    }

    return rows.map((row) => {
      const group = String(row.sort_group || "Other");
      const max = Number(maxByGroup.get(group) || 1);
      const target = Number(microTargetsByCode[row.code] ?? 0);
      return {
        ...row,
        target_amount: target > 0 ? target : null,
        sliderPct: target > 0 ? pct(Number(row.amount || 0), target) : pct(Number(row.amount || 0), max)
      };
    });
  }, [dayNutrients, microTargetsByCode]);

  const microGroups = useMemo(() => {
    const groups = Array.from(new Set(microSliderRows.map((r) => String(r.sort_group || "Other"))));
    return groups.sort((a, b) => a.localeCompare(b));
  }, [microSliderRows]);

  const visibleMicroRows = useMemo(() => {
    if (microGroupFilter === "all") return microSliderRows;
    return microSliderRows.filter((r) => String(r.sort_group || "Other") === microGroupFilter);
  }, [microSliderRows, microGroupFilter]);

  const macroProgress = useMemo(() => {
    const t = todaysTargets || {};
    const calsTarget = Number(t.calories || 0);
    const proteinTarget = Number(t.protein_g || 0);
    const carbsTarget = Number(t.carbs_g || 0);
    const fatsTarget = Number(t.fats_g || 0);
    return [
      { key: "calories", label: "Calories", value: Number(logTotals.calories || 0), target: calsTarget, unit: "kcal", color: "#ff6b88" },
      { key: "protein_g", label: "Protein", value: Number(logTotals.protein_g || 0), target: proteinTarget, unit: "g", color: "#ff3e6c" },
      { key: "carbs_g", label: "Carbs", value: Number(logTotals.carbs_g || 0), target: carbsTarget, unit: "g", color: "#d61f52" },
      { key: "fats_g", label: "Fats", value: Number(logTotals.fats_g || 0), target: fatsTarget, unit: "g", color: "#9e1338" }
    ];
  }, [logTotals, todaysTargets]);

  const macroPieData = useMemo(() => {
    const proteinKcal = Number(logTotals.protein_g || 0) * 4;
    const carbsKcal = Number(logTotals.carbs_g || 0) * 4;
    const fatsKcal = Number(logTotals.fats_g || 0) * 9;
    const alcoholKcal = Number(logTotals.alcohol_g || 0) * 7;
    return [
      { name: "Protein", value: proteinKcal, grams: Number(logTotals.protein_g || 0), color: "#ff3e6c" },
      { name: "Carbs", value: carbsKcal, grams: Number(logTotals.carbs_g || 0), color: "#d61f52" },
      { name: "Fats", value: fatsKcal, grams: Number(logTotals.fats_g || 0), color: "#9e1338" },
      { name: "Alcohol", value: alcoholKcal, grams: Number(logTotals.alcohol_g || 0), color: "#7a102c" }
    ].filter((x) => x.value > 0);
  }, [logTotals]);

  const hasMacroPieData = macroPieData.length > 0;
  const macroPieDisplayData = hasMacroPieData
    ? macroPieData
    : [
        { name: "Protein", value: 1, color: "#f2f2f2" },
        { name: "Carbs", value: 1, color: "#9c9c9c" },
        { name: "Fats", value: 1, color: "#5a5a5a" },
        { name: "Alcohol", value: 1, color: "#1f1f1f" }
      ];

  const loadTargets = async (uid) => {
    const { data: tData, error: tErr } = await supabase
      .from("nutrition_day_targets")
      .select("day_type, calories, protein_g, carbs_g, fats_g")
      .eq("user_id", uid);
    if (tErr) throw tErr;

    if (!tData || tData.length === 0) {
      const r = await fetch(`${API_URL}/api/nutrition/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to initialize nutrition.");
      }
      const { data: tData2, error: tErr2 } = await supabase
        .from("nutrition_day_targets")
        .select("day_type, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", uid);
      if (tErr2) throw tErr2;
      return tData2 || [];
    }

    return tData;
  };

  const mapTargets = (rows) => {
    const base = {
      training: { day_type: "training", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
      rest: { day_type: "rest", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
      high: { day_type: "high", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
    };
    (rows || []).forEach((row) => {
      if (row?.day_type && base[row.day_type]) base[row.day_type] = row;
    });
    return base;
  };

  const loadDaySummary = async (uid, dateIso) => {
    setDayNutrientsLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/nutrition/day-summary?user_id=${encodeURIComponent(uid)}&log_date=${encodeURIComponent(dateIso)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to load day summary.");

      setEntries(
        (j.items || []).map((it) => ({
          id: it.id,
          food: it.food_name,
          qty: Number(it.amount || 0),
          unit: it.unit,
          state: it.cooked_state,
          food_id: it.food_id || null,
          user_food_id: it.user_food_id || null
        }))
      );
      setLogTotals({
        calories: Number(j?.totals?.calories || 0),
        protein_g: Number(j?.totals?.protein_g || 0),
        carbs_g: Number(j?.totals?.carbs_g || 0),
        fats_g: Number(j?.totals?.fats_g || 0),
        alcohol_g: Number(j?.totals?.alcohol_g || 0)
      });
      setDayNutrients(Array.isArray(j.nutrients) ? j.nutrients : []);
      setLogNotes(String(j.notes || ""));
      setWaterMl(Number.isFinite(Number(j.water_ml)) ? Number(j.water_ml) : 0);
      setSaltG(Number.isFinite(Number(j.salt_g)) ? Number(j.salt_g) : 0);
      setDebugInfo((prev) => ({
        ...(prev || {}),
        summary: j?.debug || null
      }));
    } finally {
      setDayNutrientsLoading(false);
    }
  };

  const loadMicroTargets = async (uid) => {
    const r = await fetch(`${API_URL}/api/nutrition/micro-targets?user_id=${encodeURIComponent(uid)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to load micronutrient targets.");

    const map = {};
    for (const row of j.items || []) {
      map[row.code] = Number(row.target_amount ?? 0);
    }
    setMicroTargetMode(String(j.mode || "rdi"));
    setMicroTargetsByCode(map);
    setMicroTargetDrafts(map);
    setMicroTargetWarnings(Array.isArray(j.warnings) ? j.warnings : []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: userData, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const user = userData?.user;
        if (!user) throw new Error("Not logged in.");
        setUserId(user.id);

        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("training_days, today_day_type, today_day_type_date")
          .eq("user_id", user.id)
          .maybeSingle();
        if (pErr) throw pErr;

        const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const inferred = Array.isArray(pData?.training_days) && pData.training_days.includes(dayMap[new Date().getDay()])
          ? "training"
          : "rest";
        const dateIso = todayIso();
        const storedType = pData?.today_day_type_date === dateIso ? pData?.today_day_type : null;
        setTodayType(storedType || inferred);

        const targetRows = await loadTargets(user.id);
        const mapped = mapTargets(targetRows);
        setTargets(mapped);
        setEditTargets({ training: { ...mapped.training }, rest: { ...mapped.rest }, high: { ...mapped.high } });

        await loadDaySummary(user.id, dateIso);
        await loadMicroTargets(user.id);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (entryFoodLocked) {
      setFoodDropdownOpen(false);
      setFoodSearching(false);
      return;
    }
    const q = String(entryFood || "").trim();
    if (q.length < 2) {
      setFoodResults([]);
      setFoodDropdownOpen(false);
      setFoodSearching(false);
      return;
    }

    const handle = setTimeout(async () => {
      setFoodSearching(true);
      try {
        const r = await fetch(
          `${API_URL}/api/foods/search?q=${encodeURIComponent(q)}&user_id=${encodeURIComponent(userId)}&limit=10`
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) throw new Error(j?.error || "Food search failed.");
        setFoodResults(Array.isArray(j.items) ? j.items : []);
        setFoodDropdownOpen(true);
      } catch (_e) {
        setFoodResults([]);
        setFoodDropdownOpen(false);
      } finally {
        setFoodSearching(false);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [entryFood, userId, entryFoodLocked]);

  const saveTodayType = async (nextType) => {
    if (!userId) return;
    setTodayType(nextType);
    const { error: e } = await supabase
      .from("profiles")
      .update({
        today_day_type: nextType,
        today_day_type_date: todayIso(),
        training_day_type_override: true,
        nutrition_day_type_override: true
      })
      .eq("user_id", userId);
    if (e) setError(e.message);
  };

  const resolveFoodFromInput = async ({ food, currentFoodId, currentUserFoodId }) => {
    if (currentFoodId || currentUserFoodId || !userId) {
      return {
        food_id: currentFoodId || null,
        user_food_id: currentUserFoodId || null,
        food_name: food
      };
    }

    const query = String(food || "").trim();
    if (!query) return { food_id: null, user_food_id: null, food_name: food };

    const r = await fetch(
      `${API_URL}/api/foods/search?q=${encodeURIComponent(query)}&user_id=${encodeURIComponent(userId)}&limit=8`
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) throw new Error(j?.error || "Food search failed.");
    const items = Array.isArray(j.items) ? j.items : [];
    if (items.length === 0) return { food_id: null, user_food_id: null, food_name: food };

    const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const qNorm = norm(query);
    const scored = items.map((it, idx) => {
      const n = norm(it?.name);
      const exact = n === qNorm ? 1 : 0;
      const starts = n.startsWith(qNorm) ? 1 : 0;
      const contains = qNorm && n.includes(qNorm) ? 1 : 0;
      const confidence = Number(it?.match_confidence || 0);
      const sourceBoost = it?.source === "user" ? 2 : String(it?.source_name || "").toLowerCase() === "usda" ? 1 : 0;
      return {
        it,
        idx,
        score: exact * 100 + starts * 30 + contains * 12 + confidence * 0.4 + sourceBoost * 3
      };
    });
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
    const chosen = scored[0]?.it;
    if (!chosen) return { food_id: null, user_food_id: null, food_name: food };

    if (!chosen.food_id && !chosen.user_food_id && chosen.usda_fdc_id) {
      const resp = await fetch(`${API_URL}/api/foods/resolve-usda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fdc_id: chosen.usda_fdc_id })
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok || !body?.food_id) {
        throw new Error(body?.error || "Unable to load USDA food details.");
      }
      return {
        food_id: body.food_id,
        user_food_id: null,
        food_name: String(body.name || chosen.name || food).trim()
      };
    }

    return {
      food_id: chosen.food_id || null,
      user_food_id: chosen.user_food_id || null,
      food_name: String(chosen.name || food).trim()
    };
  };

  const addEntry = async () => {
    const food = String(entryFood || "").trim();
    const qty = Number(String(entryQty || "").trim());
    if (!food || !Number.isFinite(qty) || qty <= 0) return;

    setEntryResolving(true);
    setError("");
    try {
      const resolved = await resolveFoodFromInput({
        food,
        currentFoodId: entryFoodId,
        currentUserFoodId: entryUserFoodId
      });

      setEntries((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          food: resolved.food_name || food,
          qty,
          unit: entryUnit,
          state: entryState,
          food_id: resolved.food_id,
          user_food_id: resolved.user_food_id
        }
      ]);

      setEntryFood("");
      setEntryQty("");
      setEntryUnit("g");
      setEntryState("raw");
      setEntryFoodId(null);
      setEntryUserFoodId(null);
      setEntryFoodLocked(false);
      setFoodResults([]);
      setFoodDropdownOpen(false);
    } catch (e) {
      const friendly = userFacingFoodLookupError(e);
      if (friendly) {
        pushToast(`${friendly} Added as typed item; nutrients will be estimated if needed.`, "warning");
        setError("");
        setEntries((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            food,
            qty,
            unit: entryUnit,
            state: entryState,
            food_id: null,
            user_food_id: null
          }
        ]);
        setEntryFood("");
        setEntryQty("");
        setEntryUnit("g");
        setEntryState("raw");
        setEntryFoodId(null);
        setEntryUserFoodId(null);
        setEntryFoodLocked(false);
        setFoodResults([]);
        setFoodDropdownOpen(false);
      } else {
        setError(String(e?.message || e));
      }
    } finally {
      setEntryResolving(false);
    }
  };

  const selectFoodResult = async (r) => {
    const pickedName = String(r?.name || "").trim();
    setEntryResolving(true);
    setError("");
    try {
      setEntryFoodLocked(true);
      setEntryFood(pickedName);
      setEntryFoodId(r?.food_id || null);
      setEntryUserFoodId(r?.user_food_id || null);

      if (!r?.food_id && !r?.user_food_id && r?.usda_fdc_id) {
        setFoodSearching(true);
        const resp = await fetch(`${API_URL}/api/foods/resolve-usda`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fdc_id: r.usda_fdc_id })
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok || !body?.ok || !body?.food_id) {
          throw new Error(body?.error || "Unable to load USDA food details.");
        }
        setEntryFoodId(body.food_id);
        setEntryUserFoodId(null);
        setEntryFood(String(body.name || pickedName || "").trim());
      }
      setFoodDropdownOpen(false);
    } catch (e) {
      const friendly = userFacingFoodLookupError(e);
      if (friendly) {
        pushToast(`${friendly} You can still add this as a typed item.`, "warning");
        setError("");
        setEntryFood(pickedName);
        setEntryFoodId(null);
        setEntryUserFoodId(null);
        setEntryFoodLocked(false);
      } else {
        setError(String(e?.message || e));
      }
    } finally {
      setFoodSearching(false);
      setFoodDropdownOpen(false);
      setEntryResolving(false);
    }
  };

  const saveLog = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    setLogWarnings([]);

    try {
      const dateIso = todayIso();
      const r = await fetch(`${API_URL}/api/nutrition/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          log_date: dateIso,
          notes: logNotes || null,
          water_ml: waterMl || 0,
          salt_g: saltG || 0,
          items: entries.map((it) => ({
            food: it.food,
            qty: it.qty,
            unit: it.unit,
            state: it.state,
            food_id: it.food_id || null,
            user_food_id: it.user_food_id || null
          }))
        })
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to save nutrition log.");
      setLogWarnings(Array.isArray(j.warnings) ? j.warnings : []);
      setLastSavedAt(new Date());
      setDebugInfo((prev) => ({
        ...(prev || {}),
        save: j?.debug || null
      }));
      await loadDaySummary(userId, dateIso);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const updateEditField = (dayType, field, value) => {
    const maxCalories = 6000;
    const minCalories = 800;

    setEditTargets((prev) => {
      const cur = prev?.[dayType];
      if (!cur) return prev;
      const next = { ...cur };

      if (field === "calories") next.calories = clampInt(value, minCalories, maxCalories);
      if (field === "protein_g") next.protein_g = clampInt(value, 0, 400);
      if (field === "carbs_g") next.carbs_g = clampInt(value, 0, 800);
      if (field === "fats_g") next.fats_g = clampInt(value, 0, 250);
      if (field === "protein_g" || field === "carbs_g" || field === "fats_g") {
        next.calories = clampInt(calcCalories(next.protein_g, next.carbs_g, next.fats_g), minCalories, maxCalories);
      }

      return { ...prev, [dayType]: next };
    });
  };

  const saveTargets = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    try {
      const rows = ["training", "rest", "high"].map((dayType) => ({
        user_id: userId,
        day_type: dayType,
        protein_g: Number(editTargets?.[dayType]?.protein_g || 0),
        carbs_g: Number(editTargets?.[dayType]?.carbs_g || 0),
        fats_g: Number(editTargets?.[dayType]?.fats_g || 0)
      })).map((row) => ({
        ...row,
        calories: calcCalories(row.protein_g, row.carbs_g, row.fats_g)
      }));
      const { error: e } = await supabase.from("nutrition_day_targets").upsert(rows, { onConflict: "user_id,day_type" });
      if (e) throw e;

      const mapped = mapTargets(rows);
      setTargets(mapped);
      setEditTargets({ training: { ...mapped.training }, rest: { ...mapped.rest }, high: { ...mapped.high } });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const saveMicroMode = async (nextMode) => {
    if (!userId) return;
    setSavingMicroTargets(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/api/nutrition/micro-targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          mode: nextMode,
          overrides: []
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to save micronutrient mode.");
      setMicroTargetMode(nextMode);
      await loadMicroTargets(userId);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingMicroTargets(false);
    }
  };

  const saveCustomMicroTargets = async () => {
    if (!userId) return;
    setSavingMicroTargets(true);
    setError("");
    try {
      const overrides = Object.entries(microTargetDrafts)
        .map(([nutrient_code, target_amount]) => ({
          nutrient_code,
          target_amount: Number(target_amount || 0)
        }))
        .filter((x) => Number.isFinite(x.target_amount) && x.target_amount >= 0);

      const r = await fetch(`${API_URL}/api/nutrition/micro-targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          mode: "custom",
          overrides,
          replace_overrides: true
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to save custom micronutrient targets.");
      setMicroTargetMode("custom");
      await loadMicroTargets(userId);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingMicroTargets(false);
    }
  };

  const card = {
    background: "#050507",
    border: "1px solid #2a1118",
    padding: "1rem",
    borderRadius: "10px"
  };

  const field = {
    width: "100%",
    padding: "0.65rem",
    background: "#040406",
    color: "#fff",
    border: "1px solid #2a1118",
    borderRadius: "10px"
  };

  const tabBtn = (active) => ({
    padding: "0.6rem 0.9rem",
    border: "1px solid #2a1118",
    background: active ? "#07080a" : "transparent",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer",
    borderRadius: "10px"
  });

  const pill = (active) => ({
    padding: "0.4rem 0.65rem",
    borderRadius: "999px",
    border: "1px solid #2a1118",
    background: active ? "#111217" : "transparent",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer",
    fontSize: "0.9rem"
  });

  const primaryBtn = (disabled) => ({
    padding: "0.65rem 1rem",
    background: disabled ? "transparent" : "#121318",
    color: disabled ? "#666" : "#fff",
    border: "1px solid #2a1118",
    borderRadius: "10px",
    cursor: disabled ? "default" : "pointer"
  });

  const subtleBtn = {
    padding: "0.55rem 0.8rem",
    background: "transparent",
    color: "#aaa",
    border: "1px solid #2a1118",
    borderRadius: "10px",
    cursor: "pointer"
  };

  if (loading) return <div style={{ padding: "1rem" }}>Loading...</div>;

  return (
    <div className="nutrition-page" style={{ width: "100%" }}>
      <div className="nutrition-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Nutrition</h1>
        </div>

        <div className="nutrition-tabs" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="button" onClick={() => setTab("log")} style={tabBtn(tab === "log")}>Log</button>
          <button type="button" onClick={() => setTab("plan")} style={tabBtn(tab === "plan")}>Plan</button>
          <div style={{ color: "#666", minWidth: "120px", textAlign: "right", fontSize: "0.86rem" }}>
            {saving ? "Saving..." : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </div>
        </div>
      </div>

      {toast?.message ? (
        <div
          style={{
            position: "fixed",
            top: "18px",
            right: "18px",
            zIndex: 1200,
            padding: "0.7rem 0.85rem",
            borderRadius: "10px",
            border: "1px solid #3d1a23",
            background: toast.type === "warning" ? "#2d1217" : "#121318",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            maxWidth: "360px"
          }}
        >
          {toast.message}
        </div>
      ) : null}

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

      <div className="nutrition-shell nutrition-log-grid" style={{ width: "100%", display: "grid", gap: "1rem", marginTop: "1rem" }}>
        <div className="nutrition-main" style={{ minWidth: 0 }}>
          {tab === "log" && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div className="nutrition-log-top" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem", alignItems: "start" }}>
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Food log</div>
                    <div style={{ color: "#aaa", marginTop: "0.35rem" }}>Log your food throughout the day</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button type="button" onClick={saveLog} disabled={saving} style={primaryBtn(saving)}>Save log</button>
                    <button
                      type="button"
                      onClick={() => {
                        setEntries([]);
                        setEntryFood("");
                        setEntryQty("");
                        setEntryUnit("g");
                        setEntryState("raw");
                        setEntryFoodId(null);
                        setEntryUserFoodId(null);
                        setEntryFoodLocked(false);
                        setFoodResults([]);
                        setFoodDropdownOpen(false);
                      }}
                      style={subtleBtn}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.6rem" }}>
                  <div style={{ position: "relative" }}>
                    <input
                      value={entryFood}
                      onChange={(e) => {
                        setEntryFood(e.target.value);
                        setEntryFoodLocked(false);
                        setEntryFoodId(null);
                        setEntryUserFoodId(null);
                      }}
                      onFocus={() => {
                        if (!entryFoodLocked && foodResults.length > 0) setFoodDropdownOpen(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setFoodDropdownOpen(false), 140);
                      }}
                      placeholder="e.g. rice, chicken breast"
                      style={field}
                    />

                    {foodDropdownOpen && (foodSearching || foodResults.length > 0) && (
                      <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#050507", border: "1px solid #2a1118", borderRadius: "10px", zIndex: 20, overflow: "hidden" }}>
                        {foodSearching ? (
                          <div style={{ padding: "0.65rem", color: "#888" }}>Searching...</div>
                        ) : (
                          foodResults.map((r) => (
                            <button
                              key={`${r.source}:${r.id}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectFoodResult(r)}
                              style={{ width: "100%", textAlign: "left", padding: "0.65rem", background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
                            >
                              <div style={{ fontWeight: 700 }}>{r.name}{r.brand ? ` — ${r.brand}` : ""}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="nutrition-entry-row" style={{ display: "grid", gridTemplateColumns: "140px 130px 120px", gap: "0.6rem", alignItems: "center" }}>
                    <input value={entryQty} onChange={(e) => setEntryQty(e.target.value)} placeholder="Qty" inputMode="decimal" style={field} />

                    <select value={entryUnit} onChange={(e) => setEntryUnit(e.target.value)} style={field}>
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={!String(entryFood || "").trim() || !isPositiveNumber(entryQty) || entryResolving}
                      onClick={addEntry}
                      style={primaryBtn(!String(entryFood || "").trim() || !isPositiveNumber(entryQty) || entryResolving)}
                    >
                      {entryResolving ? "Resolving..." : "Add"}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
                  {entries.length === 0 ? (
                    <div style={{ color: "#666" }}>No items yet.</div>
                  ) : (
                    entries.map((it) => (
                      <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.75rem", border: "1px solid #2a1118", borderRadius: "10px", background: "#050507" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.food}</div>
                          <div style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                            {it.qty}{it.unit}
                          </div>
                        </div>
                        <button type="button" onClick={() => setEntries((prev) => prev.filter((x) => x.id !== it.id))} style={subtleBtn}>Remove</button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: "1rem", display: "grid", gap: "0.6rem" }}>
                  <div style={{ color: "#aaa" }}>Notes</div>
                  <textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder="Anything useful to remember today..." style={{ ...field, minHeight: "110px", resize: "vertical" }} />
                </div>
              </div>
              <div style={{ ...card, background: "#040406", padding: "0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Day controls</div>
                    <div style={{ color: "#666", marginTop: "0.25rem" }}>{dayLabel[todayType] || "Today"}</div>
                  </div>

                  <select value={todayType} onChange={(e) => saveTodayType(e.target.value)} style={{ ...field, width: "170px" }}>
                    <option value="training">Training day</option>
                    <option value="rest">Rest day</option>
                    <option value="high">High day</option>
                  </select>
                </div>

                <div style={{ marginTop: "0.85rem", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
                  <div><div style={{ color: "#aaa" }}>Calories</div><div style={{ marginTop: "0.2rem", fontSize: "1.05rem" }}>{todaysTargets?.calories ?? "—"}</div></div>
                  <div><div style={{ color: "#aaa" }}>Protein</div><div style={{ marginTop: "0.2rem", fontSize: "1.05rem" }}>{todaysTargets ? `${todaysTargets.protein_g}g` : "—"}</div></div>
                  <div><div style={{ color: "#aaa" }}>Carbs</div><div style={{ marginTop: "0.2rem", fontSize: "1.05rem" }}>{todaysTargets ? `${todaysTargets.carbs_g}g` : "—"}</div></div>
                  <div><div style={{ color: "#aaa" }}>Fats</div><div style={{ marginTop: "0.2rem", fontSize: "1.05rem" }}>{todaysTargets ? `${todaysTargets.fats_g}g` : "—"}</div></div>
                </div>

                <div style={{ height: "1px", background: "#2a1118", margin: "0.9rem 0" }} />
                <div>
                  <div style={{ fontWeight: 800 }}>Water & salt</div>
                  <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.75rem" }}>
                    <div>
                      <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Water (ml)</div>
                      <input type="number" value={waterMl} onChange={(e) => setWaterMl(clampInt(e.target.value, 0, 10000))} style={field} />
                    </div>
                    <div>
                      <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Salt (g)</div>
                      <input type="number" value={saltG} onChange={(e) => setSaltG(clampNumber(e.target.value, 0, 50, 2))} style={field} />
                    </div>
                  </div>
                </div>
              </div>
              </div>

              <div className="nutrition-macro-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1rem" }}>
                <div style={card}>
                  <div style={{ fontWeight: 800 }}>Daily totals</div>
                  <div style={{ marginTop: "0.8rem", display: "grid", gap: "0.55rem" }}>
                    {macroProgress.map((m) => {
                      const progress = pct(m.value, m.target || 0);
                      return (
                        <div key={m.key}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#bbb", marginBottom: "0.25rem" }}>
                            <span>{m.label}</span>
                            <span style={{ color: "#fff" }}>
                              {m.value}/{m.target || 0} {m.unit}
                            </span>
                          </div>
                          <div style={{ height: "10px", borderRadius: "999px", background: "#0f1014", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${progress}%`,
                                height: "100%",
                                background: `linear-gradient(90deg, ${m.color}, ${m.color}cc)`,
                                transition: "width 240ms ease"
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: "0.65rem", color: "#bbb", fontSize: "0.92rem" }}>
                    Alcohol: <span style={{ color: "#fff" }}>{round1(logTotals.alcohol_g)}g</span> ({Math.round(Number(logTotals.alcohol_g || 0) * 7)} kcal)
                  </div>

                  <div style={{ marginTop: "0.9rem", height: "180px", border: "1px solid #2a1118", borderRadius: "10px", background: "#050507", padding: "0.4rem" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={macroPieDisplayData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={42}
                          outerRadius={68}
                          paddingAngle={2}
                        >
                          {macroPieDisplayData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        {hasMacroPieData ? (
                          <Tooltip
                            formatter={(value, name, ctx) => {
                              const grams = Number(ctx?.payload?.grams || 0);
                              return [`${Math.round(Number(value || 0))} kcal • ${round1(grams)} g`, String(name || "")];
                            }}
                            contentStyle={{ background: "#050507", border: "1px solid #2a1118", borderRadius: "8px", color: "#fff" }}
                            itemStyle={{ color: "#fff" }}
                            labelStyle={{ color: "#fff" }}
                            wrapperStyle={{ zIndex: 30, pointerEvents: "none" }}
                            cursor={false}
                          />
                        ) : null}
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {logWarnings.length > 0 && (
                    <div style={{ marginTop: "0.6rem", color: "#666", fontSize: "0.9rem" }}>
                      {logWarnings.map((w, idx) => (
                        <div key={idx}>• {w}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.8rem" }}>
                    <div style={{ fontWeight: 800 }}>Micronutrients</div>
                    <div style={{ color: "#666", fontSize: "0.9rem" }}>
                      {dayNutrientsLoading ? "Loading..." : `${visibleMicroRows.length} shown`}
                    </div>
                  </div>

                  <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
                      <div style={{ color: "#888", fontSize: "0.85rem" }}>Target mode</div>
                      <select
                        value={microTargetMode}
                        onChange={(e) => saveMicroMode(e.target.value)}
                        disabled={savingMicroTargets}
                        style={{ ...field, width: "180px", padding: "0.45rem" }}
                      >
                        <option value="rdi">RDI</option>
                        <option value="bodyweight">Bodyweight</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    {microTargetWarnings.length > 0 ? (
                      <div style={{ color: "#8a8a8a", fontSize: "0.83rem" }}>{microTargetWarnings[0]}</div>
                    ) : null}
                  </div>

                  <div style={{ marginTop: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{ color: "#888", fontSize: "0.85rem" }}>Group</div>
                    <select
                      value={microGroupFilter}
                      onChange={(e) => setMicroGroupFilter(e.target.value)}
                      style={{ ...field, width: "180px", padding: "0.45rem" }}
                    >
                      <option value="all">All groups</option>
                      {microGroups.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {groupedMicros.length === 0 ? (
                    <div style={{ color: "#666", marginTop: "0.5rem" }}>
                      No micronutrients saved for today yet.
                      {IS_DEV && (debugInfo?.save || debugInfo?.summary) ? (
                        <div style={{ marginTop: "0.45rem", fontSize: "0.85rem", color: "#8a8a8a" }}>
                          <button
                            type="button"
                            onClick={() => setShowDiagnostics((prev) => !prev)}
                            style={{ ...subtleBtn, padding: "0.35rem 0.55rem", fontSize: "0.8rem" }}
                          >
                            {showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
                          </button>
                          {showDiagnostics ? (
                            <div style={{ marginTop: "0.4rem" }}>
                              Save debug: DB items {debugInfo?.save?.db_item_count ?? 0}, AI items {debugInfo?.save?.ai_item_count ?? 0}, inserted micro rows {debugInfo?.save?.micronutrient_rows_inserted ?? 0}
                              <br />
                              Summary debug: micronutrient rows loaded {debugInfo?.summary?.micronutrient_row_count ?? 0}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          marginTop: "0.75rem",
                          display: "grid",
                          gap: "0.6rem",
                          maxHeight: "360px",
                          overflowY: "auto",
                          paddingRight: "0.25rem"
                        }}
                      >
                      {visibleMicroRows.map((n) => (
                        <div key={n.code} style={{ border: "1px solid #231018", borderRadius: "10px", padding: "0.5rem 0.6rem", background: "#050507" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", color: "#aaa", fontSize: "0.9rem" }}>
                            <div style={{ minWidth: 0, whiteSpace: "normal", lineHeight: 1.2 }}>
                              <span style={{ color: "#fff" }}>{displayNutrientLabel(n.code, n.label)}</span>
                              <span style={{ color: "#777" }}> • {displayNutrientGroup(n.code, n.sort_group)}</span>
                            </div>
                            <div style={{ color: "#fff", flexShrink: 0 }}>
                              {formatNutrientAmount(n.amount)} {formatNutrientUnit(n.unit)}
                              {" / "}
                              {Number(n.target_amount || 0) > 0 ? `${formatNutrientAmount(n.target_amount)} ${formatNutrientUnit(n.unit)}` : "N/T"}
                            </div>
                          </div>
                          {microTargetMode === "custom" ? (
                            <div style={{ marginTop: "0.35rem", display: "flex", justifyContent: "flex-end" }}>
                              <input
                                type="number"
                                value={microTargetDrafts[n.code] ?? 0}
                                onChange={(e) =>
                                  setMicroTargetDrafts((prev) => ({
                                    ...prev,
                                    [n.code]: Math.max(0, Number(e.target.value || 0))
                                  }))
                                }
                                style={{ ...field, width: "130px", padding: "0.45rem" }}
                              />
                            </div>
                          ) : null}
                          <div style={{ marginTop: "0.35rem", height: "10px", background: "#101217", borderRadius: "999px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Number(n.amount || 0) <= 0 ? 0 : Math.max(2, n.sliderPct)}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #8a0f2e, #de2952)",
                                transition: "width 240ms ease"
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      </div>
                    </>
                  )}
                  {microTargetMode === "custom" ? (
                    <div style={{ marginTop: "0.7rem", display: "flex", justifyContent: "flex-end" }}>
                      <button type="button" onClick={saveCustomMicroTargets} disabled={savingMicroTargets} style={primaryBtn(savingMicroTargets)}>
                        Save custom micronutrient targets
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {tab === "plan" && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div className="nutrition-plan-tabs nutrition-plan-subtabs" style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={() => setPlanTab("targets")} style={tabBtn(planTab === "targets")}>Targets</button>
                <button type="button" onClick={() => setPlanTab("meal_plan")} style={tabBtn(planTab === "meal_plan")}>Meal plan</button>
              </div>

              {planTab === "targets" && (
                <div className="nutrition-targets-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
                  {["training", "rest", "high"].map((dayType) => {
                    const t = editTargets?.[dayType];
                    if (!t) return null;
                    return (
                      <div key={dayType} style={card}>
                        <div style={{ fontWeight: 800 }}>{dayLabel[dayType]}</div>
                        <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.65rem" }}>
                          <div>
                            <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Calories</div>
                            <input type="number" value={t.calories} onChange={(e) => updateEditField(dayType, "calories", e.target.value)} style={field} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
                            <div>
                              <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Protein (g)</div>
                              <input type="number" value={t.protein_g} onChange={(e) => updateEditField(dayType, "protein_g", e.target.value)} style={field} />
                            </div>
                            <div>
                              <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Carbs (g)</div>
                              <input type="number" value={t.carbs_g} onChange={(e) => updateEditField(dayType, "carbs_g", e.target.value)} style={field} />
                            </div>
                            <div>
                              <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Fats (g)</div>
                              <input type="number" value={t.fats_g} onChange={(e) => updateEditField(dayType, "fats_g", e.target.value)} style={field} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={saveTargets} style={primaryBtn(false)}>Save targets</button>
                  </div>
                </div>
              )}

              {planTab === "meal_plan" && (
                <div style={card}>
                  <div style={{ fontWeight: 800 }}>Meal plan</div>
                  <div style={{ color: "#aaa", marginTop: "0.5rem" }}>Meal plan generation can be layered on top now that deterministic logging is in place.</div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
