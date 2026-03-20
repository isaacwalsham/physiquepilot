import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useProfile } from "../context/ProfileContext";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";
import PageHeader, { PageTabs } from "../components/PageHeader";

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

const UNIT_OPTIONS = ["g", "ml", "l", "oz", "lb", "item", "serv"];
const DEFAULT_MEAL_SEGMENTS = [
  { key: "breakfast", label: "Breakfast", position: 1 },
  { key: "lunch", label: "Lunch", position: 2 },
  { key: "dinner", label: "Dinner", position: 3 },
  { key: "snacks", label: "Snacks", position: 4 }
];
const DEFAULT_PRESET_NAME = "Standard";
const DEFAULT_CUSTOM_PRESET_NAME = "Enter Preset Name";
const DEFAULT_CUSTOM_MEAL_SEGMENTS = [
  { key: "meal_1", label: "Meal 1", position: 1 },
  { key: "meal_2", label: "Meal 2", position: 2 },
  { key: "meal_3", label: "Meal 3", position: 3 },
  { key: "meal_4", label: "Meal 4", position: 4 }
];
const MACRO_CODES = new Set(["energy_kcal", "protein_g", "carbs_g", "fat_g", "alcohol_g"]);
const HIDDEN_MICRO_CODES = new Set(["net_carbs_g"]);
const NUTRITION_UI_PREFS_KEY = "nutrition_ui_prefs_v1";
const MICRO_SCOPE_CODES = new Set([
  "thiamin_b1_mg", "riboflavin_b2_mg", "vitamin_b3_mg", "pantothenic_b5_mg", "vitamin_b6_mg", "vitamin_b12_ug",
  "folate_ug", "vitamin_a_ug", "vitamin_c_mg", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug",
  "calcium_mg", "copper_mg", "iron_mg", "magnesium_mg", "manganese_mg", "phosphorus_mg", "potassium_mg", "selenium_ug", "sodium_mg", "zinc_mg",
  "fiber_g", "starch_g", "sugars_g", "added_sugars_g",
  "cholesterol_mg", "monounsaturated_g", "polyunsaturated_g", "omega3_g", "omega6_g", "sat_fat_g", "trans_fat_g",
  "cystine_g", "histidine_g", "isoleucine_g", "leucine_g", "lysine_g", "methionine_g", "phenylalanine_g", "threonine_g", "tryptophan_g", "tyrosine_g", "valine_g"
]);

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
  fiber_g: "Fibre",
  starch_g: "Starch",
  sugars_g: "Sugars",
  added_sugars_g: "Added Sugars",
  omega3_g: "Omega-3",
  omega6_g: "Omega-6",
  omega_3_g: "Omega-3",
  omega_6_g: "Omega-6",
  cholesterol_mg: "Cholesterol",
  monounsaturated_g: "Fat (Monounsaturated)",
  polyunsaturated_g: "Fat (Polyunsaturated)",
  sat_fat_g: "Fat (Saturated)",
  trans_fat_g: "Fat (Trans)",
  carbs_g: "Carbs (Total)",
  fat_g: "Fat",
  protein_g: "Protein",
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
  thiamin_b1_mg: "B1 (Thiamine)",
  riboflavin_b2_mg: "B2 (Riboflavin)",
  vitamin_b3_mg: "B3 (Niacin)",
  pantothenic_b5_mg: "B5 (Pantothenic Acid)",
  vitamin_b6_mg: "B6 (Pyridoxine)",
  vitamin_b12_ug: "B12 (Cobalamin)",
  folate_ug: "Folate",
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
  net_carbs_g: "Net Carbs"
};

const NUTRIENT_LABEL_TEXT_OVERRIDES = {
  "vitamin e (alpha-tocopherol)": "Vitamin E",
  "vitamin d (d2 + d3)": "Vitamin D",
  "vitamin d (d2 + d3), international units": "Vitamin D",
  "vitamin k (phylloquinone)": "Vitamin K",
  "(phylloquinone)": "Vitamin K",
  "total dietary fiber (aoac 2011.25)": "Fibre",
  "total ascorbic acid": "Vitamin C",
  "pantothenic acid": "B5 (Pantothenic Acid)",
  "pantheotic acid": "B5 (Pantothenic Acid)"
};

const VITAMIN_B_ORDER = {
  thiamin_b1_mg: 1,
  riboflavin_b2_mg: 2,
  vitamin_b3_mg: 3,
  pantothenic_b5_mg: 4,
  vitamin_b6_mg: 5,
  vitamin_b12_ug: 6,
  folate_ug: 7
};

const GROUP_SORT_ORDER = {
  Vitamins: 1,
  Minerals: 2,
  Carbohydrates: 3,
  Lipids: 4,
  Protein: 5,
  General: 6,
  Other: 7
};

const NUTRIENT_DISPLAY_ORDER = {
  thiamin_b1_mg: 1,
  riboflavin_b2_mg: 2,
  vitamin_b3_mg: 3,
  pantothenic_b5_mg: 4,
  vitamin_b6_mg: 5,
  vitamin_b12_ug: 6,
  folate_ug: 7,
  vitamin_a_ug: 8,
  vitamin_c_mg: 9,
  vitamin_d_ug: 10,
  vitamin_e_mg: 11,
  vitamin_k_ug: 12,

  calcium_mg: 101,
  copper_mg: 102,
  iron_mg: 103,
  magnesium_mg: 104,
  manganese_mg: 105,
  phosphorus_mg: 106,
  potassium_mg: 107,
  selenium_ug: 108,
  sodium_mg: 109,
  zinc_mg: 110,

  fiber_g: 201,
  starch_g: 202,
  sugars_g: 203,
  added_sugars_g: 204,

  cholesterol_mg: 301,
  monounsaturated_g: 302,
  polyunsaturated_g: 303,
  omega3_g: 304,
  omega6_g: 305,
  sat_fat_g: 306,
  trans_fat_g: 307,

  cystine_g: 401,
  histidine_g: 402,
  isoleucine_g: 403,
  leucine_g: 404,
  lysine_g: 405,
  methionine_g: 406,
  phenylalanine_g: 407,
  threonine_g: 408,
  tryptophan_g: 409,
  tyrosine_g: 410,
  valine_g: 411
};

const formatNutrientUnit = (unit) => {
  const u = String(unit || "").trim().toLowerCase();
  if (!u) return "";
  if (u === "international units" || u === "international unit" || u === "iu") return "IU";
  if (u === "microgram" || u === "micrograms" || u === "ug" || u === "mcg") return "µg";
  if (u === "milligram" || u === "milligrams") return "mg";
  return unit;
};

const inferUnitFromCode = (code) => {
  const c = String(code || "").trim().toLowerCase();
  if (c.endsWith("_mg")) return "mg";
  if (c.endsWith("_ug")) return "ug";
  if (c.endsWith("_g")) return "g";
  if (c.endsWith("_kcal")) return "kcal";
  return "";
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
  const code = String(row?.code || "");
  return {
    groupOrder: GROUP_SORT_ORDER[group] || 99,
    group,
    customOrder: NUTRIENT_DISPLAY_ORDER[code] || 9999,
    sortOrder: Number(row?.sort_order || 0),
    bOrder: VITAMIN_B_ORDER[code] || 999
  };
};

const todayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const normalizeSegmentKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "snacks";

// Auth-aware fetch — automatically attaches the current Supabase Bearer token
const authFetch = async (url, options = {}) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

export default function Nutrition() {
  const { profile, todayDayType: contextDayType, updateProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState("log");
  const [showMicronutrientsSection, setShowMicronutrientsSection] = useState(true);
  const [calorieView, setCalorieView] = useState(0); // 0=consumed, 1=remaining, 2=macro split

  // Allergen / dietary preference data from onboarding profile
  const foodAllergies = useMemo(() => {
    const raw = profile?.food_allergies || "";
    return raw.split(/[,;\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  }, [profile?.food_allergies]);

  const [todayType, setTodayType] = useState("rest");
  const [targets, setTargets] = useState({ training: null, rest: null, high: null });
  const [editTargets, setEditTargets] = useState({ training: null, rest: null, high: null });

  const [entries, setEntries] = useState([]);
  const [entryFood, setEntryFood] = useState("");
  const [entryQty, setEntryQty] = useState("");
  const [entryUnit, setEntryUnit] = useState("g");
  const [entryState, setEntryState] = useState("raw");
  const [entrySegment, setEntrySegment] = useState("breakfast");
  const [entryFoodId, setEntryFoodId] = useState(null);
  const [entryUserFoodId, setEntryUserFoodId] = useState(null);

  const [foodResults, setFoodResults] = useState([]);
  const [foodSearching, setFoodSearching] = useState(false);
  const [foodDropdownOpen, setFoodDropdownOpen] = useState(false);
  const [foodSearchMode, setFoodSearchMode] = useState("idle"); // idle | local | remote
  const [foodNoMatches, setFoodNoMatches] = useState(false);
  const [entryResolving, setEntryResolving] = useState(false);
  const [entryFoodLocked, setEntryFoodLocked] = useState(false);

  const [logNotes, setLogNotes] = useState("");
  const [waterMl, setWaterMl] = useState(0);
  const [saltG, setSaltG] = useState(0);

  const [logTotals, setLogTotals] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, alcohol_g: 0 });
  const [dayNutrients, setDayNutrients] = useState([]);
  const [dayNutrientsLoading, setDayNutrientsLoading] = useState(false);
  const [logWarnings, setLogWarnings] = useState([]);
  const [toast, setToast] = useState(null);
  const [microGroupFilter, setMicroGroupFilter] = useState("all");
  const [microTargetMode, setMicroTargetMode] = useState("rdi");
  const [microTargetsByCode, setMicroTargetsByCode] = useState({});
  const [microTargetDrafts, setMicroTargetDrafts] = useState({});
  const [savingMicroTargets, setSavingMicroTargets] = useState(false);
  const [microTargetWarnings, setMicroTargetWarnings] = useState([]);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [mealPresets, setMealPresets] = useState([]);
  const [activePresetId, setActivePresetId] = useState("");
  const [presetNameDraft, setPresetNameDraft] = useState(DEFAULT_PRESET_NAME);
  const [presetSegmentsDraft, setPresetSegmentsDraft] = useState(DEFAULT_MEAL_SEGMENTS);
  const [newSegmentLabel, setNewSegmentLabel] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [savedMeals, setSavedMeals] = useState([]);
  const [savedMealName, setSavedMealName] = useState("");
  const [savedMealSelection, setSavedMealSelection] = useState("");
  const [savingSavedMeal, setSavingSavedMeal] = useState(false);
  const [expandedSavedMealRows, setExpandedSavedMealRows] = useState({});
  const [summarySegment, setSummarySegment] = useState("all");
  const [segmentTotalsByKey, setSegmentTotalsByKey] = useState({});
  const [segmentNutrientsByKey, setSegmentNutrientsByKey] = useState({});
  const [mealDraftEntries, setMealDraftEntries] = useState([]);
  const [mealEntryFood, setMealEntryFood] = useState("");
  const [mealEntryQty, setMealEntryQty] = useState("");
  const [mealEntryUnit, setMealEntryUnit] = useState("g");
  const [mealEntryFoodId, setMealEntryFoodId] = useState(null);
  const [mealEntryUserFoodId, setMealEntryUserFoodId] = useState(null);
  const [mealEntryResolving, setMealEntryResolving] = useState(false);
  const [mealEntryFoodLocked, setMealEntryFoodLocked] = useState(false);
  const [mealFoodResults, setMealFoodResults] = useState([]);
  const [mealFoodSearching, setMealFoodSearching] = useState(false);
  const [mealFoodDropdownOpen, setMealFoodDropdownOpen] = useState(false);
  const [mealFoodNoMatches, setMealFoodNoMatches] = useState(false);
  const [savedMealSegment, setSavedMealSegment] = useState("breakfast");
  const [collapsedSections, setCollapsedSections] = useState({
    foodLog: false,
    savedMeals: true,
    logEntries: false,
    notes: true,
    dayControls: false,
    dailyTotals: false,
    micros: false
  });
  const foodSearchSeqRef = useRef(0);
  const mealFoodSearchSeqRef = useRef(0);

  // ── Food modal (replaces inline dropdown) ──────────────────────────────────
  const [foodModalOpen, setFoodModalOpen] = useState(false);

  // ── Meal plan state ────────────────────────────────────────────────────────
  const [mealPlanData, setMealPlanData] = useState(null);
  const [mealPlanLoading, setMealPlanLoading] = useState(false);
  const [mealPlanGenerating, setMealPlanGenerating] = useState(false);
  const [mealPlanError, setMealPlanError] = useState("");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay(); // 0 = Sun
    const diff = day === 0 ? -6 : 1 - day; // offset to Monday
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    return mon.toISOString().split("T")[0];
  });

  const todaysTargets = useMemo(() => targets?.[todayType] || null, [targets, todayType]);
  const isCollapsed = (key) => Boolean(collapsedSections?.[key]);
  const toggleSection = (key) => {
    setCollapsedSections((prev) => ({ ...(prev || {}), [key]: !prev?.[key] }));
  };
  const activePreset = useMemo(
    () => mealPresets.find((p) => p.id === activePresetId) || null,
    [mealPresets, activePresetId]
  );
  const activeSegments = useMemo(() => {
    const segs = Array.isArray(activePreset?.segments) && activePreset.segments.length > 0
      ? activePreset.segments
      : DEFAULT_MEAL_SEGMENTS;
    return segs
      .map((s, idx) => ({
        key: normalizeSegmentKey(s?.key || s?.segment_key || s?.label || `segment_${idx + 1}`),
        label: String(s?.label || s?.name || s?.key || `Segment ${idx + 1}`).trim() || `Segment ${idx + 1}`,
        position: Number(s?.position || idx + 1)
      }))
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  }, [activePreset]);
  const segmentLabelByKey = useMemo(() => {
    const m = new Map(activeSegments.map((s) => [s.key, s.label]));
    return m;
  }, [activeSegments]);
  const entriesBySegment = useMemo(() => {
    const by = new Map();
    for (const seg of activeSegments) by.set(seg.key, []);
    for (const it of entries) {
      const segKey = normalizeSegmentKey(it?.segment || "snacks");
      if (!by.has(segKey)) by.set(segKey, []);
      by.get(segKey).push(it);
    }
    return by;
  }, [entries, activeSegments]);
  const displaySegments = useMemo(() => {
    const seen = new Set(activeSegments.map((s) => s.key));
    const extras = [];
    for (const it of entries) {
      const key = normalizeSegmentKey(it?.segment || "snacks");
      if (seen.has(key)) continue;
      seen.add(key);
      extras.push({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
        position: 999
      });
    }
    return [...activeSegments, ...extras];
  }, [activeSegments, entries]);
  const selectedSavedMeal = useMemo(
    () => savedMeals.find((m) => m.id === savedMealSelection) || null,
    [savedMeals, savedMealSelection]
  );
  const groupedRowsBySegment = useMemo(() => {
    const out = new Map();
    for (const seg of displaySegments) {
      const segItems = entriesBySegment.get(seg.key) || [];
      const rows = [];
      const mealIndexById = new Map();
      for (const it of segItems) {
        const mealId = String(it?.meal_instance_id || "").trim();
        if (!mealId) {
          rows.push({ kind: "item", item: it });
          continue;
        }
        if (!mealIndexById.has(mealId)) {
          mealIndexById.set(mealId, rows.length);
          rows.push({
            kind: "meal",
            mealId,
            mealName: String(it?.meal_name || "Saved meal").trim() || "Saved meal",
            items: []
          });
        }
        const idx = mealIndexById.get(mealId);
        rows[idx].items.push(it);
      }
      out.set(seg.key, rows);
    }
    return out;
  }, [displaySegments, entriesBySegment]);
  const summarySegments = useMemo(() => {
    const keys = new Set();
    for (const seg of activeSegments) keys.add(seg.key);
    for (const key of Object.keys(segmentTotalsByKey || {})) keys.add(normalizeSegmentKey(key));
    for (const key of Object.keys(segmentNutrientsByKey || {})) keys.add(normalizeSegmentKey(key));
    const rows = [{ key: "all", label: "Whole day" }];
    for (const key of Array.from(keys)) {
      rows.push({
        key,
        label: segmentLabelByKey.get(key) || key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
      });
    }
    return rows;
  }, [activeSegments, segmentTotalsByKey, segmentNutrientsByKey, segmentLabelByKey]);
  const selectedSummaryLabel = useMemo(() => {
    if (summarySegment === "all") return "Whole Day";
    return segmentLabelByKey.get(summarySegment) || summarySegment.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }, [summarySegment, segmentLabelByKey]);
  const effectiveLogTotals = useMemo(() => {
    if (summarySegment === "all") return logTotals;
    return segmentTotalsByKey?.[summarySegment] || { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, alcohol_g: 0 };
  }, [summarySegment, logTotals, segmentTotalsByKey]);
  const effectiveDayNutrients = useMemo(() => {
    if (summarySegment === "all") return dayNutrients;
    return segmentNutrientsByKey?.[summarySegment] || [];
  }, [summarySegment, dayNutrients, segmentNutrientsByKey]);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NUTRITION_UI_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.showMicronutrientsSection === "boolean") {
        setShowMicronutrientsSection(parsed.showMicronutrientsSection);
      }
    } catch (_e) {
      // ignore invalid local preference payloads
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        NUTRITION_UI_PREFS_KEY,
        JSON.stringify({
          showMicronutrientsSection
        })
      );
    } catch (_e) {
      // no-op (private mode/storage disabled)
    }
  }, [showMicronutrientsSection]);

  const templateMicroRows = useMemo(() => {
    const fromDay = (dayNutrients || [])
      .filter((n) => !MACRO_CODES.has(String(n.code || "")))
      .filter((n) => !HIDDEN_MICRO_CODES.has(String(n.code || "")))
      .filter((n) => MICRO_SCOPE_CODES.has(String(n.code || "")));
    if (fromDay.length > 0) return fromDay;

    return Object.keys(microTargetsByCode || {})
      .filter((code) => !MACRO_CODES.has(String(code || "")))
      .filter((code) => !HIDDEN_MICRO_CODES.has(String(code || "")))
      .filter((code) => MICRO_SCOPE_CODES.has(String(code || "")))
      .map((code) => ({
        code,
        label: displayNutrientLabel(code, code),
        sort_group: displayNutrientGroup(code, ""),
        sort_order: 999,
        unit: inferUnitFromCode(code),
        amount: 0
      }));
  }, [dayNutrients, microTargetsByCode]);

  const scopedMicroRows = useMemo(() => {
    const scoped = (effectiveDayNutrients || [])
      .filter((n) => !MACRO_CODES.has(String(n.code || "")))
      .filter((n) => !HIDDEN_MICRO_CODES.has(String(n.code || "")))
      .filter((n) => MICRO_SCOPE_CODES.has(String(n.code || "")));
    if (templateMicroRows.length === 0) return scoped;

    const scopedByCode = new Map(scoped.map((row) => [String(row.code || ""), row]));
    const merged = templateMicroRows.map((base) => {
      const code = String(base?.code || "");
      const scopedRow = scopedByCode.get(code);
      if (!scopedRow) return { ...base, amount: 0 };
      return {
        ...base,
        ...scopedRow,
        amount: Number(scopedRow?.amount || 0)
      };
    });

    const mergedCodeSet = new Set(merged.map((row) => String(row.code || "")));
    for (const row of scoped) {
      const code = String(row?.code || "");
      if (!code || mergedCodeSet.has(code)) continue;
      merged.push(row);
    }

    return merged;
  }, [effectiveDayNutrients, templateMicroRows]);

  const microSliderRows = useMemo(() => {
    const rows = scopedMicroRows
      .slice()
      .sort((a, b) => {
        const ka = nutrientSortKey(a);
        const kb = nutrientSortKey(b);
        if (ka.groupOrder !== kb.groupOrder) {
          return ka.groupOrder - kb.groupOrder;
        }
        if (ka.customOrder !== kb.customOrder) {
          return ka.customOrder - kb.customOrder;
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
  }, [scopedMicroRows, microTargetsByCode]);

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
      { key: "calories", label: "Calories", value: Number(effectiveLogTotals.calories || 0), target: calsTarget, unit: "kcal", color: "#ff6b88" },
      { key: "protein_g", label: "Protein", value: Number(effectiveLogTotals.protein_g || 0), target: proteinTarget, unit: "g", color: "#16a34a" },
      { key: "carbs_g", label: "Carbs", value: Number(effectiveLogTotals.carbs_g || 0), target: carbsTarget, unit: "g", color: "#1d4ed8" },
      { key: "fats_g", label: "Fats", value: Number(effectiveLogTotals.fats_g || 0), target: fatsTarget, unit: "g", color: "#dc2626" }
    ];
  }, [effectiveLogTotals, todaysTargets]);

  const macroPieData = useMemo(() => {
    const proteinKcal = Number(effectiveLogTotals.protein_g || 0) * 4;
    const carbsKcal = Number(effectiveLogTotals.carbs_g || 0) * 4;
    const fatsKcal = Number(effectiveLogTotals.fats_g || 0) * 9;
    const alcoholKcal = Number(effectiveLogTotals.alcohol_g || 0) * 7;
    return [
      { name: "Protein", value: proteinKcal, grams: Number(effectiveLogTotals.protein_g || 0), color: "#16a34a" },
      { name: "Carbs",   value: carbsKcal,   grams: Number(effectiveLogTotals.carbs_g   || 0), color: "#1d4ed8" },
      { name: "Fats",    value: fatsKcal,    grams: Number(effectiveLogTotals.fats_g    || 0), color: "#dc2626" },
      { name: "Alcohol", value: alcoholKcal, grams: Number(effectiveLogTotals.alcohol_g || 0), color: "#d97706" }
    ].filter((x) => x.value > 0);
  }, [effectiveLogTotals]);

  const hasMacroPieData = macroPieData.length > 0;
  const macroPieDisplayData = hasMacroPieData
    ? macroPieData
    : [
        { name: "Protein", value: 1, color: "#f2f2f2" },
        { name: "Carbs", value: 1, color: "#9c9c9c" },
        { name: "Fats", value: 1, color: "#5a5a5a" },
        { name: "Alcohol", value: 1, color: "#1f1f1f" }
      ];

  const loadTargets = async (uid, token) => {
    const { data: tData, error: tErr } = await supabase
      .from("nutrition_day_targets")
      .select("day_type, calories, protein_g, carbs_g, fats_g")
      .eq("user_id", uid);
    if (tErr) throw tErr;

    if (!tData || tData.length === 0) {
      // Use passed-in token; fall back to a fresh getSession if not provided
      const authToken = token || (await supabase.auth.getSession().then(r => r.data?.session?.access_token));
      const r = await fetch(`${API_URL}/api/nutrition/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
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
      const r = await authFetch(`${API_URL}/api/nutrition/day-summary?user_id=${encodeURIComponent(uid)}&log_date=${encodeURIComponent(dateIso)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to load day summary.");

      setEntries(
        (j.items || []).map((it) => ({
          id: it.id,
          food: it.food_name,
          qty: Number(it.amount || 0),
          unit: it.unit,
          state: it.cooked_state,
          segment: normalizeSegmentKey(it.meal_segment || "snacks"),
          meal_instance_id: String(it.meal_instance_id || "").trim() || null,
          meal_name: String(it.meal_name || "").trim() || null,
          food_id: it.food_id || null,
          user_food_id: it.user_food_id || null
        }))
      );
      setExpandedSavedMealRows({});
      setLogTotals({
        calories: Number(j?.totals?.calories || 0),
        protein_g: Number(j?.totals?.protein_g || 0),
        carbs_g: Number(j?.totals?.carbs_g || 0),
        fats_g: Number(j?.totals?.fats_g || 0),
        alcohol_g: Number(j?.totals?.alcohol_g || 0)
      });
      const segTotalsRaw = j?.segment_totals && typeof j.segment_totals === "object" ? j.segment_totals : {};
      const segTotals = {};
      for (const [key, row] of Object.entries(segTotalsRaw)) {
        const k = normalizeSegmentKey(key);
        segTotals[k] = {
          calories: Number(row?.calories || 0),
          protein_g: Number(row?.protein_g || 0),
          carbs_g: Number(row?.carbs_g || 0),
          fats_g: Number(row?.fats_g || 0),
          alcohol_g: Number(row?.alcohol_g || 0)
        };
      }
      setSegmentTotalsByKey(segTotals);

      const segNutrientsRaw = j?.segment_nutrients && typeof j.segment_nutrients === "object" ? j.segment_nutrients : {};
      const segNutrients = {};
      for (const [key, rows] of Object.entries(segNutrientsRaw)) {
        segNutrients[normalizeSegmentKey(key)] = Array.isArray(rows) ? rows : [];
      }
      setSegmentNutrientsByKey(segNutrients);
      setDayNutrients(Array.isArray(j.nutrients) ? j.nutrients : []);
      setLogNotes(String(j.notes || ""));
      setWaterMl(Number.isFinite(Number(j.water_ml)) ? Number(j.water_ml) : 0);
      setSaltG(Number.isFinite(Number(j.salt_g)) ? Number(j.salt_g) : 0);
    } finally {
      setDayNutrientsLoading(false);
    }
  };

  const loadMicroTargets = async (uid) => {
    const r = await authFetch(`${API_URL}/api/nutrition/micro-targets?user_id=${encodeURIComponent(uid)}`);
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

  const loadMealPresets = async (uid) => {
    const r = await authFetch(`${API_URL}/api/nutrition/meal-presets?user_id=${encodeURIComponent(uid)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to load meal presets.");
    const items = Array.isArray(j.items) ? j.items : [];
    setMealPresets(items);
    const current =
      items.find((p) => p.id === activePresetId) ||
      items.find((p) => p.is_default) ||
      items[0] ||
      null;
    if (current) {
      setActivePresetId(current.id);
      setPresetNameDraft(current.name || DEFAULT_PRESET_NAME);
      setPresetSegmentsDraft(
        (Array.isArray(current.segments) && current.segments.length > 0 ? current.segments : DEFAULT_MEAL_SEGMENTS).map((s, idx) => ({
          key: normalizeSegmentKey(s?.key || s?.segment_key || s?.label || `segment_${idx + 1}`),
          label: String(s?.label || s?.name || "").trim() || `Segment ${idx + 1}`,
          position: Number(s?.position || idx + 1)
        }))
      );
    }
  };

  const loadSavedMeals = async (uid) => {
    const r = await authFetch(`${API_URL}/api/nutrition/saved-meals?user_id=${encodeURIComponent(uid)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to load saved meals.");
    const items = Array.isArray(j.items) ? j.items : [];
    setSavedMeals(items);
    if (items.length === 0) {
      setSavedMealSelection("");
      return;
    }
    const existing = items.find((m) => m.id === savedMealSelection) || items[0];
    setSavedMealSelection(existing?.id || "");
  };

  const resetPresetDraftToCurrent = () => {
    const current = mealPresets.find((p) => p.id === activePresetId);
    if (!current) {
      setPresetNameDraft(DEFAULT_PRESET_NAME);
      setPresetSegmentsDraft(DEFAULT_MEAL_SEGMENTS);
      return;
    }
    setPresetNameDraft(String(current.name || DEFAULT_PRESET_NAME));
    const segs = Array.isArray(current.segments) && current.segments.length > 0 ? current.segments : DEFAULT_MEAL_SEGMENTS;
    setPresetSegmentsDraft(
      segs.map((s, idx) => ({
        key: normalizeSegmentKey(s?.key || s?.segment_key || s?.label || `segment_${idx + 1}`),
        label: String(s?.label || s?.name || "").trim() || `Segment ${idx + 1}`,
        position: Number(s?.position || idx + 1)
      }))
    );
  };

  useEffect(() => {
    const current = mealPresets.find((p) => p.id === activePresetId);
    if (!current) return;
    setPresetNameDraft(String(current.name || DEFAULT_PRESET_NAME));
    const segs = Array.isArray(current.segments) && current.segments.length > 0 ? current.segments : DEFAULT_MEAL_SEGMENTS;
    setPresetSegmentsDraft(
      segs.map((s, idx) => ({
        key: normalizeSegmentKey(s?.key || s?.segment_key || s?.label || `segment_${idx + 1}`),
        label: String(s?.label || s?.name || "").trim() || `Segment ${idx + 1}`,
        position: Number(s?.position || idx + 1)
      }))
    );
  }, [activePresetId, mealPresets]);

  const upsertPreset = async ({ createNew = false } = {}) => {
    if (!userId) return;
    setSavingPreset(true);
    setError("");
    try {
      const segments = (presetSegmentsDraft || [])
        .map((s, idx) => ({
          key: normalizeSegmentKey(s?.key || s?.label || `segment_${idx + 1}`),
          label: String(s?.label || "").trim(),
          position: idx + 1
        }))
        .filter((s) => s.label);
      const r = await authFetch(`${API_URL}/api/nutrition/meal-presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          preset_id: createNew ? null : activePresetId || null,
          name: String(presetNameDraft || "").trim() || (createNew ? DEFAULT_CUSTOM_PRESET_NAME : DEFAULT_PRESET_NAME),
          make_default: true,
          segments
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to save meal preset.");
      if (Array.isArray(j.items)) {
        setMealPresets(j.items);
        const target = j.items.find((p) => p.id === j.preset_id) || j.items.find((p) => p.is_default) || j.items[0];
        if (target) {
          setActivePresetId(target.id);
          setPresetNameDraft(target.name || DEFAULT_PRESET_NAME);
          setPresetSegmentsDraft(
            (target.segments || DEFAULT_MEAL_SEGMENTS).map((s, idx) => ({
              key: normalizeSegmentKey(s?.key || s?.segment_key || s?.label || `segment_${idx + 1}`),
              label: String(s?.label || s?.name || "").trim() || `Segment ${idx + 1}`,
              position: Number(s?.position || idx + 1)
            }))
          );
        }
      } else {
        await loadMealPresets(userId);
      }
      pushToast("Meal preset saved.", "info");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingPreset(false);
    }
  };

  const deleteActivePreset = async () => {
    if (!userId || !activePresetId) return;
    setSavingPreset(true);
    setError("");
    try {
      const r = await authFetch(`${API_URL}/api/nutrition/meal-presets/${encodeURIComponent(activePresetId)}?user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE"
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to delete meal preset.");
      const items = Array.isArray(j.items) ? j.items : [];
      setMealPresets(items);
      const target = items.find((p) => p.is_default) || items[0] || null;
      if (target) {
        setActivePresetId(target.id);
        setPresetNameDraft(String(target.name || DEFAULT_PRESET_NAME));
        setPresetSegmentsDraft(
          (target.segments || DEFAULT_MEAL_SEGMENTS).map((s, idx) => ({
            key: normalizeSegmentKey(s?.key || s?.segment_key || s?.label || `segment_${idx + 1}`),
            label: String(s?.label || s?.name || "").trim() || `Segment ${idx + 1}`,
            position: Number(s?.position || idx + 1)
          }))
        );
      }
      pushToast("Meal preset deleted.", "info");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingPreset(false);
    }
  };

  const saveEntriesAsMeal = async ({ mealEntries = [], defaultName = "Saved meal", segmentKey = "snacks" }) => {
    if (!userId) return;
    if (!Array.isArray(mealEntries) || mealEntries.length === 0) {
      pushToast("No items to save.", "warning");
      return;
    }
    setSavingSavedMeal(true);
    setError("");
    try {
      const mealName = String(savedMealName || "").trim() || defaultName;
      const r = await authFetch(`${API_URL}/api/nutrition/saved-meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          name: mealName,
          preset_id: activePresetId || null,
          segment_key: segmentKey,
          items: mealEntries.map((it) => ({
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
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to save meal.");
      setSavedMealName("");
      await loadSavedMeals(userId);
      if (j.saved_meal_id) setSavedMealSelection(j.saved_meal_id);
      return j.saved_meal_id || null;
    } catch (e) {
      setError(String(e?.message || e));
      return null;
    } finally {
      setSavingSavedMeal(false);
    }
  };

  const saveMealDraftAsMeal = async () => {
    if (!userId) return;
    if (mealDraftEntries.length === 0) {
      pushToast("Add foods to custom meal first.", "warning");
      return;
    }
    const segmentKey = normalizeSegmentKey(savedMealSegment || activeSegments[0]?.key || "snacks");
    const defaultName = `Custom meal ${new Date().toLocaleDateString()}`;
    const savedId = await saveEntriesAsMeal({
      mealEntries: mealDraftEntries,
      defaultName,
      segmentKey
    });
    if (savedId) {
      setMealDraftEntries([]);
      setMealEntryFood("");
      setMealEntryQty("");
      setMealEntryUnit("g");
      setMealEntryFoodId(null);
      setMealEntryUserFoodId(null);
      setMealEntryFoodLocked(false);
      setMealFoodResults([]);
      setMealFoodDropdownOpen(false);
      pushToast("Saved meal created.", "info");
    }
  };

  const appendSavedMealToEntries = ({ meal, segmentKey }) => {
    if (!meal || !Array.isArray(meal.items) || meal.items.length === 0) {
      return false;
    }
    const fallbackSegment = normalizeSegmentKey(segmentKey || meal.segment_key || activeSegments[0]?.key || "snacks");
    const mealInstanceId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const now = Date.now();
    const appended = meal.items.map((it, idx) => ({
      id: `${now}-${idx}-${Math.random().toString(16).slice(2)}`,
      food: it.food,
      qty: Number(it.qty || 0),
      unit: it.unit || "g",
      state: it.state || "raw",
      segment: fallbackSegment,
      meal_instance_id: mealInstanceId,
      meal_name: String(meal.name || "Saved meal").trim() || "Saved meal",
      food_id: it.food_id || null,
      user_food_id: it.user_food_id || null
    }));
    setEntries((prev) => [...prev, ...appended]);
    setExpandedSavedMealRows((prev) => ({ ...(prev || {}), [mealInstanceId]: false }));
    return true;
  };

  const addSavedMealToLog = () => {
    const meal = savedMeals.find((m) => m.id === savedMealSelection);
    if (!meal) {
      pushToast("No saved meal selected.", "warning");
      return;
    }
    const ok = appendSavedMealToEntries({
      meal,
      segmentKey: entrySegment
    });
    if (!ok) {
      pushToast("Saved meal has no items.", "warning");
      return;
    }
    pushToast("Saved meal added to log.", "info");
  };

  const deleteSavedMeal = async () => {
    if (!userId || !savedMealSelection) return;
    setSavingSavedMeal(true);
    setError("");
    try {
      const r = await authFetch(`${API_URL}/api/nutrition/saved-meals/${encodeURIComponent(savedMealSelection)}?user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE"
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to delete saved meal.");
      await loadSavedMeals(userId);
      pushToast("Saved meal deleted.", "info");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingSavedMeal(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        // getSession() reads from storage synchronously; getUser() hits the server
        // but guarantees a valid, non-null token even after a background refresh.
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) throw new Error("Not logged in.");
        const { data: sessionR } = await supabase.auth.getSession();
        const accessToken = sessionR?.session?.access_token;
        setUserId(user.id);

        const dateIso = todayIso();

        // Day type is computed by ProfileContext via getDayType() — no separate profile fetch needed
        setTodayType(contextDayType || "rest");

        const targetRows = await loadTargets(user.id, accessToken);
        const mapped = mapTargets(targetRows);
        setTargets(mapped);
        setEditTargets({ training: { ...mapped.training }, rest: { ...mapped.rest }, high: { ...mapped.high } });

        await loadDaySummary(user.id, dateIso);
        await loadMicroTargets(user.id);
        try {
          await loadMealPresets(user.id);
          await loadSavedMeals(user.id);
        } catch (mealErr) {
          const fallbackPreset = {
            id: "local-default",
            name: DEFAULT_PRESET_NAME,
            is_default: true,
            segments: DEFAULT_MEAL_SEGMENTS
          };
          setMealPresets([fallbackPreset]);
          setActivePresetId("local-default");
          setPresetNameDraft(DEFAULT_PRESET_NAME);
          setPresetSegmentsDraft(DEFAULT_MEAL_SEGMENTS);
          setSavedMeals([]);
          setSavedMealSelection("");
          setError(String(mealErr?.message || mealErr));
        }
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep todayType in sync when ProfileContext recomputes it (e.g. after training toggle)
  useEffect(() => {
    if (contextDayType) setTodayType(contextDayType);
  }, [contextDayType]);

  useEffect(() => {
    if (!userId) return;
    if (entryFoodLocked) {
      foodSearchSeqRef.current += 1;
      setFoodDropdownOpen(false);
      setFoodSearching(false);
      return;
    }
    const q = String(entryFood || "").trim();
    if (q.length < 2) {
      foodSearchSeqRef.current += 1;
      setFoodResults([]);
      setFoodDropdownOpen(false);
      setFoodSearching(false);
      setFoodSearchMode("idle");
      setFoodNoMatches(false);
      return;
    }

    setFoodResults([]);
    setFoodDropdownOpen(false);
    setFoodNoMatches(false);

    const handle = setTimeout(async () => {
      const seq = ++foodSearchSeqRef.current;
      const isStale = () =>
        seq !== foodSearchSeqRef.current ||
        entryFoodLocked ||
        String(entryFood || "").trim().toLowerCase() !== q.toLowerCase();
      const norm = (x) =>
        String(x || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const singularize = (w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w);
      const dedupeByNameBrand = (rows) => {
        const m = new Map();
        for (const row of Array.isArray(rows) ? rows : []) {
          const k = `${norm(row?.name)}|${norm(row?.brand)}`;
          if (!m.has(k)) m.set(k, row);
        }
        return Array.from(m.values());
      };
      const queryTokens = norm(q).split(/\s+/).filter(Boolean).map(singularize);
      const stopWords = new Set(["a", "an", "and", "or", "the", "with", "without", "in", "on", "at", "to", "for", "of", "from", "by"]);
      const meaningfulTokens = queryTokens.filter((t) => !stopWords.has(t));
      const effectiveTokens = meaningfulTokens.length > 0 ? meaningfulTokens : queryTokens;
      const strictMatch = (item) => {
        const textRaw = `${norm(item?.name)} ${norm(item?.brand)}`.trim();
        const textTokens = new Set(textRaw.split(/\s+/).filter(Boolean).map(singularize));
        if (!textRaw) return false;
        const phrase = effectiveTokens.join(" ");
        if (phrase && textRaw.includes(phrase)) return true;
        const hits = effectiveTokens.reduce((acc, t) => acc + (textTokens.has(t) ? 1 : 0), 0);
        const needed = effectiveTokens.length >= 2 ? 2 : 1;
        return hits >= needed;
      };
      const fetchSearchItems = async (url, timeoutMs = 4500) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const r = await fetch(url, { cache: "no-store", signal: controller.signal });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j?.ok) throw new Error(j?.error || "Food search failed.");
          return dedupeByNameBrand(Array.isArray(j.items) ? j.items : []);
        } finally {
          clearTimeout(timeout);
        }
      };
      setFoodSearching(true);
      setFoodSearchMode("remote");
      setFoodNoMatches(false);
      try {
        const savedMealCandidates = (savedMeals || [])
          .map((meal) => {
            const name = String(meal?.name || "").trim();
            if (!name) return null;
            return {
              id: `saved-meal:${meal.id}`,
              saved_meal_id: meal.id,
              name,
              brand: "Saved Meal",
              source: "saved_meal",
              source_name: "saved_meal",
              match_confidence: 100
            };
          })
          .filter(Boolean)
          .filter(strictMatch);
        const primaryItems = await fetchSearchItems(
          `${API_URL}/api/foods/typeahead?q=${encodeURIComponent(q)}&user_id=${encodeURIComponent(userId)}&limit=10`
        );
        if (isStale()) return;
        let items = dedupeByNameBrand([...savedMealCandidates, ...primaryItems]);
        const strictItems = items.filter(strictMatch);
        if (strictItems.length > 0) items = strictItems;

        if (isStale()) return;
        setFoodResults(items);
        setFoodDropdownOpen(true);
        setFoodNoMatches(items.length === 0);
      } catch (_e) {
        if (isStale()) return;
        setFoodResults([]);
        setFoodNoMatches(true);
        setFoodDropdownOpen(true);
      } finally {
        if (isStale()) return;
        setFoodSearching(false);
        setFoodSearchMode("idle");
      }
    }, 160);

    return () => {
      clearTimeout(handle);
      foodSearchSeqRef.current += 1;
    };
  }, [entryFood, userId, entryFoodLocked, savedMeals]);

  useEffect(() => {
    if (!userId) return;
    if (mealEntryFoodLocked) {
      mealFoodSearchSeqRef.current += 1;
      setMealFoodDropdownOpen(false);
      setMealFoodSearching(false);
      return;
    }
    const q = String(mealEntryFood || "").trim();
    if (q.length < 2) {
      mealFoodSearchSeqRef.current += 1;
      setMealFoodResults([]);
      setMealFoodDropdownOpen(false);
      setMealFoodSearching(false);
      setMealFoodNoMatches(false);
      return;
    }

    setMealFoodResults([]);
    setMealFoodDropdownOpen(false);
    setMealFoodNoMatches(false);

    const handle = setTimeout(async () => {
      const seq = ++mealFoodSearchSeqRef.current;
      const isStale = () =>
        seq !== mealFoodSearchSeqRef.current ||
        mealEntryFoodLocked ||
        String(mealEntryFood || "").trim().toLowerCase() !== q.toLowerCase();
      try {
        setMealFoodSearching(true);
        const r = await fetch(
          `${API_URL}/api/foods/typeahead?q=${encodeURIComponent(q)}&user_id=${encodeURIComponent(userId)}&limit=10`,
          { cache: "no-store" }
        );
        const j = await r.json().catch(() => ({}));
        if (isStale()) return;
        if (!r.ok || !j?.ok) throw new Error(j?.error || "Food search failed.");
        const items = Array.isArray(j.items) ? j.items : [];
        setMealFoodResults(items);
        setMealFoodDropdownOpen(true);
        setMealFoodNoMatches(items.length === 0);
      } catch (_e) {
        if (isStale()) return;
        setMealFoodResults([]);
        setMealFoodNoMatches(true);
        setMealFoodDropdownOpen(true);
      } finally {
        if (isStale()) return;
        setMealFoodSearching(false);
      }
    }, 160);

    return () => {
      clearTimeout(handle);
      mealFoodSearchSeqRef.current += 1;
    };
  }, [mealEntryFood, userId, mealEntryFoodLocked]);

  useEffect(() => {
    if (!Array.isArray(activeSegments) || activeSegments.length === 0) return;
    const exists = activeSegments.some((s) => s.key === normalizeSegmentKey(entrySegment));
    if (!exists) {
      setEntrySegment(activeSegments[0].key);
    }
  }, [activeSegments, entrySegment]);

  useEffect(() => {
    if (!Array.isArray(activeSegments) || activeSegments.length === 0) return;
    const exists = activeSegments.some((s) => s.key === normalizeSegmentKey(savedMealSegment));
    if (!exists) {
      setSavedMealSegment(activeSegments[0].key);
    }
  }, [activeSegments, savedMealSegment]);

  useEffect(() => {
    if (summarySegment === "all") return;
    const exists = summarySegments.some((s) => s.key === summarySegment);
    if (!exists) setSummarySegment("all");
  }, [summarySegment, summarySegments]);

  useEffect(() => {
    resetPresetDraftToCurrent();
  }, [activePresetId]);

  const saveTodayType = async (nextType) => {
    if (!userId) return;
    setTodayType(nextType);
    const { error: e } = await updateProfile({
      today_day_type: nextType,
      today_day_type_date: todayIso(),
      training_day_type_override: true,
      nutrition_day_type_override: true,
    });
    if (e) setError(e);
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
    const queryTokens = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const isShortAmbiguous = queryTokens.length <= 1 && query.length < 4;
    if (isShortAmbiguous) {
      return { food_id: null, user_food_id: null, food_name: query };
    }

    const bestResp = await fetch(`${API_URL}/api/foods/resolve-best`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        user_id: userId,
        locale: "uk",
        prefer_remote: true
      })
    });
    const bestBody = await bestResp.json().catch(() => ({}));
    if (bestResp.ok && bestBody?.ok && bestBody?.resolved) {
      return {
        food_id: bestBody.resolved.food_id || null,
        user_food_id: bestBody.resolved.user_food_id || null,
        food_name: String(bestBody.resolved.name || query).trim()
      };
    }

    const r = await fetch(
      `${API_URL}/api/foods/typeahead?q=${encodeURIComponent(query)}&user_id=${encodeURIComponent(userId)}&limit=8`
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
    if (!chosen.food_id && !chosen.user_food_id && chosen.off_code) {
      const resp = await fetch(`${API_URL}/api/foods/resolve-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ off_code: chosen.off_code })
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok || !body?.food_id) {
        throw new Error(body?.error || "Unable to load OFF food details.");
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
          segment: normalizeSegmentKey(entrySegment || "snacks"),
          meal_instance_id: null,
          meal_name: null,
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
            segment: normalizeSegmentKey(entrySegment || "snacks"),
            meal_instance_id: null,
            meal_name: null,
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
      if (r?.saved_meal_id || r?.source === "saved_meal") {
        const meal = savedMeals.find((m) => m.id === r?.saved_meal_id);
        if (!meal) throw new Error("Saved meal not found.");
        const ok = appendSavedMealToEntries({
          meal,
          segmentKey: entrySegment
        });
        if (!ok) throw new Error("Saved meal has no items.");
        setEntryFood("");
        setEntryQty("");
        setEntryUnit("g");
        setEntryState("raw");
        setEntryFoodId(null);
        setEntryUserFoodId(null);
        setEntryFoodLocked(false);
        setFoodResults([]);
        setFoodDropdownOpen(false);
        pushToast("Saved meal added to log.", "info");
        return;
      }
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
      if (!r?.food_id && !r?.user_food_id && r?.off_code) {
        setFoodSearching(true);
        const resp = await fetch(`${API_URL}/api/foods/resolve-off`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ off_code: r.off_code })
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok || !body?.ok || !body?.food_id) {
          throw new Error(body?.error || "Unable to load OFF food details.");
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

  const selectMealFoodResult = async (r) => {
    const pickedName = String(r?.name || "").trim();
    setMealEntryResolving(true);
    setError("");
    try {
      setMealEntryFoodLocked(true);
      setMealEntryFood(pickedName);
      setMealEntryFoodId(r?.food_id || null);
      setMealEntryUserFoodId(r?.user_food_id || null);

      if (!r?.food_id && !r?.user_food_id && r?.usda_fdc_id) {
        setMealFoodSearching(true);
        const resp = await fetch(`${API_URL}/api/foods/resolve-usda`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fdc_id: r.usda_fdc_id })
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok || !body?.ok || !body?.food_id) {
          throw new Error(body?.error || "Unable to load USDA food details.");
        }
        setMealEntryFoodId(body.food_id);
        setMealEntryUserFoodId(null);
        setMealEntryFood(String(body.name || pickedName || "").trim());
      }
      if (!r?.food_id && !r?.user_food_id && r?.off_code) {
        setMealFoodSearching(true);
        const resp = await fetch(`${API_URL}/api/foods/resolve-off`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ off_code: r.off_code })
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok || !body?.ok || !body?.food_id) {
          throw new Error(body?.error || "Unable to load OFF food details.");
        }
        setMealEntryFoodId(body.food_id);
        setMealEntryUserFoodId(null);
        setMealEntryFood(String(body.name || pickedName || "").trim());
      }
      setMealFoodDropdownOpen(false);
    } catch (e) {
      const friendly = userFacingFoodLookupError(e);
      if (friendly) {
        pushToast(`${friendly} You can still add this as a typed item.`, "warning");
        setError("");
        setMealEntryFood(pickedName);
        setMealEntryFoodId(null);
        setMealEntryUserFoodId(null);
        setMealEntryFoodLocked(false);
      } else {
        setError(String(e?.message || e));
      }
    } finally {
      setMealFoodSearching(false);
      setMealFoodDropdownOpen(false);
      setMealEntryResolving(false);
    }
  };

  const addMealDraftEntry = async () => {
    const food = String(mealEntryFood || "").trim();
    const qty = Number(String(mealEntryQty || "").trim());
    if (!food || !Number.isFinite(qty) || qty <= 0) return;

    setMealEntryResolving(true);
    setError("");
    try {
      const resolved = await resolveFoodFromInput({
        food,
        currentFoodId: mealEntryFoodId,
        currentUserFoodId: mealEntryUserFoodId
      });

      setMealDraftEntries((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          food: resolved.food_name || food,
          qty,
          unit: mealEntryUnit,
          state: "raw",
          food_id: resolved.food_id,
          user_food_id: resolved.user_food_id
        }
      ]);

      setMealEntryFood("");
      setMealEntryQty("");
      setMealEntryUnit("g");
      setMealEntryFoodId(null);
      setMealEntryUserFoodId(null);
      setMealEntryFoodLocked(false);
      setMealFoodResults([]);
      setMealFoodDropdownOpen(false);
    } catch (e) {
      const friendly = userFacingFoodLookupError(e);
      if (friendly) {
        pushToast(`${friendly} Added as typed item; nutrients will be estimated if needed.`, "warning");
        setError("");
        setMealDraftEntries((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            food,
            qty,
            unit: mealEntryUnit,
            state: "raw",
            food_id: null,
            user_food_id: null
          }
        ]);
        setMealEntryFood("");
        setMealEntryQty("");
        setMealEntryUnit("g");
        setMealEntryFoodId(null);
        setMealEntryUserFoodId(null);
        setMealEntryFoodLocked(false);
        setMealFoodResults([]);
        setMealFoodDropdownOpen(false);
      } else {
        setError(String(e?.message || e));
      }
    } finally {
      setMealEntryResolving(false);
    }
  };

  const saveLog = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    setLogWarnings([]);

    try {
      const dateIso = todayIso();
      const r = await authFetch(`${API_URL}/api/nutrition/log`, {
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
            segment: normalizeSegmentKey(it.segment || "snacks"),
            meal_instance_id: it.meal_instance_id || null,
            meal_name: it.meal_name || null,
            food_id: it.food_id || null,
            user_food_id: it.user_food_id || null
          }))
        })
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to save nutrition log.");
      setLogWarnings(Array.isArray(j.warnings) ? j.warnings : []);
      setLastSavedAt(new Date());
      await loadDaySummary(userId, dateIso);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  // ── Macro stepper — calories stay locked, macros compensate each other ───────
  // step: protein/carbs = 5g, fat = 2g. Cap each macro at ±10% of its baseline.
  // Compensation order: protein ↔ carbs; fat ↔ carbs.
  const adjustMacro = (dayType, macro, dir) => {
    setEditTargets((prev) => {
      const cur = prev?.[dayType];
      const base = targets?.[dayType];          // original locked values
      if (!cur || !base) return prev;

      const STEP  = macro === "fats_g" ? 2 : 5; // grams per click
      const delta = dir * STEP;                  // +ve = increase

      // Enforce ±10% of baseline for the adjusted macro
      const baseVal   = Number(base[macro] || 0);
      const maxDelta  = Math.round(baseVal * 0.10);
      const newVal    = Math.round(Number(cur[macro] || 0) + delta);
      const baselineDiff = newVal - baseVal;
      if (Math.abs(baselineDiff) > maxDelta) return prev; // already at limit
      if (newVal < 0) return prev;

      // Calorie impact of the change
      const kcalPerG = macro === "fats_g" ? 9 : 4;
      const kcalDelta = delta * kcalPerG;  // kcal gained by this macro

      // Choose compensation macro
      // protein ↔ carbs (both 4 kcal/g → 1:1 gram trade)
      // fat     ↔ carbs (fat 9 kcal/g, carbs 4 kcal/g)
      const compMacro = macro === "protein_g" ? "carbs_g"
                      : macro === "carbs_g"   ? "protein_g"
                      :                         "carbs_g"; // fat → compensate carbs
      const compKcalPerG = compMacro === "fats_g" ? 9 : 4;
      const compDeltaG   = -Math.round(kcalDelta / compKcalPerG);

      const compBaseVal   = Number(base[compMacro] || 0);
      const compNewVal    = Math.round(Number(cur[compMacro] || 0) + compDeltaG);
      const compBaseDiff  = compNewVal - compBaseVal;
      const compMaxDelta  = Math.round(compBaseVal * 0.10);
      // If compensation macro would also exceed its ±10%, block the adjustment
      if (Math.abs(compBaseDiff) > compMaxDelta) return prev;
      if (compNewVal < 0) return prev;

      const next = { ...cur, [macro]: newVal, [compMacro]: compNewVal };
      // Recalculate calories from macros (should stay ~equal to base)
      next.calories = calcCalories(next.protein_g, next.carbs_g, next.fats_g);

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
        // Preserve the locked calorie value from the baseline; macros may
        // have small rounding drift so we keep calories authoritative.
        calories: Number(targets?.[dayType]?.calories || editTargets?.[dayType]?.calories || 0),
        protein_g: Number(editTargets?.[dayType]?.protein_g || 0),
        carbs_g:   Number(editTargets?.[dayType]?.carbs_g   || 0),
        fats_g:    Number(editTargets?.[dayType]?.fats_g    || 0),
      }));
      const { error: e } = await supabase.from("nutrition_day_targets").upsert(rows, { onConflict: "user_id,day_type" });
      if (e) throw e;

      const mapped = mapTargets(rows);
      setTargets(mapped);
      setEditTargets({ training: { ...mapped.training }, rest: { ...mapped.rest }, high: { ...mapped.high } });
      pushToast("Macro targets saved.");
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
      const r = await authFetch(`${API_URL}/api/nutrition/micro-targets`, {
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

      const r = await authFetch(`${API_URL}/api/nutrition/micro-targets`, {
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

  // ── Meal plan helpers ──────────────────────────────────────────────────────
  const formatWeekRange = (weekStart) => {
    const start = new Date(weekStart + "T00:00:00Z");
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const fmt = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const shiftWeek = (dir) => {
    setCurrentWeekStart((prev) => {
      const d = new Date(prev + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + dir * 7);
      return d.toISOString().split("T")[0];
    });
    setMealPlanData(null);
    setMealPlanError("");
  };

  const loadMealPlan = async (weekStart) => {
    if (!userId) return;
    setMealPlanLoading(true);
    setMealPlanError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const r = await fetch(`${API_URL}/api/nutrition/meal-plan?week_start=${encodeURIComponent(weekStart)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to load meal plan.");
      setMealPlanData(j.plan || null);
    } catch (e) {
      setMealPlanError(String(e?.message || e));
    } finally {
      setMealPlanLoading(false);
    }
  };

  const generateMealPlan = async () => {
    if (!userId) return;
    setMealPlanGenerating(true);
    setMealPlanError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const r = await fetch(`${API_URL}/api/nutrition/meal-plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ week_start: currentWeekStart })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to generate meal plan.");
      setMealPlanData(j.plan);
      pushToast("Meal plan generated.");
    } catch (e) {
      setMealPlanError(String(e?.message || e));
    } finally {
      setMealPlanGenerating(false);
    }
  };

  // Load meal plan when tab or week changes
  useEffect(() => {
    if (tab === "meal_plan" && userId) loadMealPlan(currentWeekStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currentWeekStart, userId]);

  // ── CSS ────────────────────────────────────────────────────────────────────
  const CSS = `
    /* ── Animations ── */
    @keyframes nt-pulse      { 0%,100%{opacity:1} 50%{opacity:0.5} }
    @keyframes nt-glow-ok    { 0%,100%{box-shadow:0 0 5px rgba(40,183,141,0.25)} 50%{box-shadow:0 0 16px rgba(40,183,141,0.75),inset 0 0 6px rgba(40,183,141,0.1)} }
    @keyframes nt-glow-bad   { 0%,100%{box-shadow:0 0 5px rgba(204,32,32,0.2)} 50%{box-shadow:0 0 18px rgba(204,32,32,0.7)} }
    @keyframes nt-flash-bad  { 0%,88%,100%{opacity:1} 94%{opacity:0.35} }
    @keyframes nt-toast-in   { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes nt-sweep      { 0%{background-position:200% center} 100%{background-position:-200% center} }

    /* ── Core layout ── */
    .nt-wrap { display:flex; flex-direction:column; gap:0.55rem; height:calc(100vh - 80px); overflow:hidden; }
    .nt-save-status { font-size:0.65rem; color:var(--text-3); font-family:var(--font-display); letter-spacing:0.08em; min-width:90px; text-align:right; }

    /* ── Panel ── */
    .nt-panel { background:var(--surface-2); border:1px solid var(--line-1); border-radius:var(--radius-md); padding:0.9rem 1rem; position:relative; }
    .nt-section-label { font-family:var(--font-display); font-size:0.65rem; color:var(--accent-3); letter-spacing:0.26em; text-transform:uppercase; margin-bottom:0.72rem; display:flex; align-items:center; gap:0.5rem; }
    .nt-section-label::after { content:""; flex:1; height:1px; background:linear-gradient(90deg,var(--line-2),transparent); }

    /* ── Log split layout ── */
    .nt-log-split { display:grid; grid-template-columns:6fr 4fr; gap:0.55rem; align-items:stretch; flex:1; min-height:0; }
    .nt-hud-col { display:flex; flex-direction:column; gap:0.5rem; height:100%; min-height:0; overflow-y:auto; scrollbar-width:none; padding-right:1px; }
    .nt-hud-col::-webkit-scrollbar { display:none; }
    .nt-meals-col { display:flex; flex-direction:column; gap:0.48rem; height:100%; min-height:0; overflow-y:auto; scrollbar-width:none; }
    .nt-meals-col::-webkit-scrollbar { display:none; }

    /* ── Day bar ── */
    .nt-day-bar { display:flex; justify-content:space-between; align-items:flex-start; gap:0.65rem; flex-wrap:wrap; }
    .nt-day-date { font-family:var(--font-display); font-size:0.92rem; color:var(--text-1); letter-spacing:0.06em; margin-bottom:0.28rem; }
    .nt-day-type-badge { font-family:var(--font-display); font-size:0.64rem; letter-spacing:0.18em; padding:0.18rem 0.58rem; border-radius:999px; text-transform:uppercase; display:inline-block; }
    .nt-day-type-badge--training { background:rgba(204,32,32,0.1); border:1px solid var(--accent-1); color:var(--accent-3); animation:nt-glow-bad 2.5s ease-in-out infinite; }
    .nt-day-type-badge--rest { background:rgba(40,183,141,0.1); border:1px solid rgba(40,183,141,0.3); color:var(--ok); animation:nt-glow-ok 3s ease-in-out infinite; }
    .nt-day-type-badge--high { background:rgba(229,161,0,0.1); border:1px solid rgba(229,161,0,0.3); color:var(--warn); }
    .nt-day-controls { display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; }

    /* ── Calorie HUD ── */
    .nt-calorie-hud { background:var(--surface-2); border:1px solid rgba(165,21,21,0.32); border-radius:var(--radius-md); overflow:hidden; box-shadow:0 0 24px rgba(165,21,21,0.07); position:relative; display:grid; grid-template-columns:1fr 1px 1fr; }
    .nt-calorie-hud::before { content:""; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,var(--accent-3) 50%,transparent); pointer-events:none; z-index:1; }
    .nt-hud-left { display:flex; flex-direction:column; min-height:0; }
    .nt-hud-divider { background:var(--line-1); }
    .nt-hud-right { display:flex; flex-direction:column; }
    .nt-hud-right-header { padding:0.45rem 0.85rem; border-bottom:1px solid var(--line-1); background:linear-gradient(135deg,rgba(20,20,30,0.5),rgba(30,30,44,0.2)); }
    .nt-hud-right-body { padding:0.55rem 0.85rem; display:flex; flex-direction:column; gap:0.38rem; flex:1; }
    .nt-plan-header { font-family:var(--font-display); font-size:0.63rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--text-3); }
    .nt-plan-cals { font-family:var(--font-display); font-size:1.5rem; font-weight:700; color:var(--text-1); line-height:1; letter-spacing:-0.02em; }
    .nt-plan-cals-unit { font-family:var(--font-display); font-size:0.72rem; color:var(--text-3); margin-left:0.22rem; }
    .nt-plan-macros { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.28rem; margin-top:0.12rem; }
    .nt-plan-macro { display:flex; flex-direction:column; gap:0.06rem; }
    .nt-plan-macro-val { font-family:var(--font-display); font-size:0.88rem; font-weight:600; color:var(--text-1); }
    .nt-plan-macro-lbl { font-family:var(--font-display); font-size:0.58rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-3); }
    .nt-hud-header { display:flex; justify-content:space-between; align-items:center; padding:0.45rem 0.85rem; border-bottom:1px solid var(--line-1); background:linear-gradient(135deg,rgba(122,13,13,0.22),rgba(165,21,21,0.06)); }
    .nt-hud-label { font-family:var(--font-display); font-size:0.63rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--accent-3); }
    .nt-hud-nav { display:flex; align-items:center; gap:0.3rem; }
    .nt-hud-nav-dot { display:flex; gap:0.28rem; align-items:center; }
    .nt-hud-dot { width:5px; height:5px; border-radius:50%; background:var(--line-2); transition:all var(--motion-fast); }
    .nt-hud-dot--active { background:var(--accent-3); box-shadow:0 0 8px rgba(204,32,32,0.9); animation:nt-pulse 2s ease-in-out infinite; }
    .nt-hud-arrow { background:transparent; border:1px solid var(--line-1); color:var(--text-3); cursor:pointer; width:22px; height:22px; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; font-size:0.58rem; padding:0; transition:all var(--motion-fast); flex-shrink:0; }
    .nt-hud-arrow:hover { border-color:var(--accent-2); color:var(--accent-3); background:rgba(204,32,32,0.1); box-shadow:0 0 10px rgba(204,32,32,0.25); }
    .nt-hud-body { padding:0.6rem 0.85rem; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.35rem; flex:1; }
    .nt-hud-body::before { content:""; position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(204,32,32,0.012) 4px); pointer-events:none; }
    .nt-calorie-big { font-family:var(--font-display); font-size:3.2rem; font-weight:700; color:var(--text-1); line-height:1; letter-spacing:-0.03em; }
    .nt-calorie-unit { font-family:var(--font-display); font-size:0.82rem; color:var(--text-3); }
    .nt-calorie-sub { font-family:var(--font-display); font-size:0.63rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--text-3); }
    .nt-calorie-meta { display:flex; justify-content:space-between; font-family:var(--font-display); font-size:0.62rem; letter-spacing:0.07em; color:var(--text-3); width:100%; }
    .nt-calorie-meta-val { color:var(--text-2); font-weight:600; }
    .nt-remaining-big { font-family:var(--font-display); font-size:2.2rem; font-weight:700; line-height:1; letter-spacing:-0.03em; }
    .nt-remaining-positive { color:var(--text-1); text-shadow:none; }
    .nt-remaining-negative { color:var(--bad); text-shadow:0 0 28px rgba(255,79,115,0.55); animation:nt-flash-bad 2.5s ease-in-out infinite; }
    .nt-pie-wrap { height:110px; width:100%; position:relative; }
    .nt-pie-legend { display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:center; }
    .nt-pie-legend-item { display:flex; align-items:center; gap:0.28rem; font-family:var(--font-display); font-size:0.62rem; letter-spacing:0.06em; color:var(--text-2); }
    .nt-pie-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

    /* ── Macro chart section (inside macro panel) ── */
    .nt-macro-chart-section { margin-top:0.7rem; padding-top:0.7rem; border-top:1px solid var(--line-1); display:flex; flex:1; min-height:0; gap:0.8rem; align-items:center; }
    .nt-macro-chart-wrap { width:120px; height:120px; flex-shrink:0; position:relative; }
    .nt-macro-chart-inner { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.04rem; pointer-events:none; }
    .nt-macro-chart-total { font-family:var(--font-display); font-size:1.1rem; font-weight:700; color:var(--text-1); line-height:1; letter-spacing:-0.02em; }
    .nt-macro-chart-unit { font-family:var(--font-display); font-size:0.55rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--text-3); }
    .nt-macro-chart-legend { flex:1; display:flex; flex-direction:column; justify-content:center; gap:0.5rem; }
    .nt-macro-legend-row { display:grid; grid-template-columns:8px 1fr 38px 30px; align-items:center; gap:0.4rem; }
    .nt-macro-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .nt-macro-legend-name { font-family:var(--font-display); font-size:0.67rem; letter-spacing:0.06em; color:var(--text-2); }
    .nt-macro-legend-g { font-family:var(--font-display); font-size:0.67rem; color:var(--text-1); font-weight:600; text-align:right; }
    .nt-macro-legend-pct { font-family:var(--font-display); font-size:0.62rem; color:var(--text-3); text-align:right; }

    /* ── Segment pills ── */
    .nt-segment-pills { display:flex; gap:0.25rem; flex-wrap:wrap; margin-bottom:0.65rem; }
    .nt-seg-pill { padding:0.26rem 0.62rem; border-radius:999px; border:1px solid var(--line-1); background:transparent; color:var(--text-3); cursor:pointer; font-size:0.72rem; font-family:var(--font-display); letter-spacing:0.06em; transition:all var(--motion-fast); }
    .nt-seg-pill:hover { border-color:var(--line-2); color:var(--text-2); }
    .nt-seg-pill--active { background:var(--surface-3); border-color:var(--line-2); color:var(--text-1); box-shadow:inset 0 0 8px rgba(204,32,32,0.08); }

    /* ── Macro bars ── */
    .nt-macro-bars { display:grid; gap:0.42rem; }
    .nt-macro-bar-row { display:grid; grid-template-columns:54px 1fr auto; align-items:center; gap:0.48rem; }
    .nt-macro-label { font-size:0.7rem; color:var(--text-2); text-align:right; font-family:var(--font-display); letter-spacing:0.05em; }
    .nt-macro-track { height:8px; border-radius:999px; background:var(--surface-1); overflow:hidden; border:1px solid rgba(255,255,255,0.04); position:relative; }
    .nt-macro-fill { height:100%; border-radius:999px; transition:width 600ms cubic-bezier(.22,.68,0,1.2); position:relative; }
    .nt-macro-fill::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,transparent 55%,rgba(255,255,255,0.18)); border-radius:999px; pointer-events:none; }
    .nt-macro-val { font-size:0.7rem; color:var(--text-2); text-align:right; white-space:nowrap; font-family:var(--font-display); min-width:68px; }
    .nt-macro-over { color:var(--warn) !important; animation:nt-flash-bad 2s ease-in-out infinite; }

    /* ── Hydration ── */
    .nt-hydration-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.65rem; }
    .nt-hydration-label { font-size:0.72rem; color:var(--text-2); font-family:var(--font-display); letter-spacing:0.06em; text-transform:uppercase; }
    .nt-hydration-gauge { height:7px; border-radius:999px; background:var(--surface-1); overflow:hidden; margin:0.3rem 0 0.4rem; border:1px solid rgba(255,255,255,0.04); }
    .nt-hydration-fill-water { height:100%; border-radius:999px; background:linear-gradient(90deg,#4a9eff,#90cdf4); transition:width 500ms ease; }
    .nt-hydration-fill-salt  { height:100%; border-radius:999px; background:linear-gradient(90deg,#f7c547,#fde68a); transition:width 500ms ease; }
    .nt-hydration-pct { font-family:var(--font-display); font-size:0.64rem; color:var(--text-3); text-align:right; }

    /* ── Meal cards ── */
    .nt-meals-grid { display:grid; gap:0.48rem; flex:1; min-height:0; grid-auto-rows:1fr; }
    .nt-meal-card { background:var(--surface-2); border:1px solid var(--line-1); border-radius:var(--radius-md); overflow:hidden; transition:all var(--motion-fast); display:flex; flex-direction:column; min-height:0; }
    .nt-meal-card:hover { border-color:var(--line-2); transform:translateX(2px); }
    .nt-meal-card--breakfast { border-top:3px solid rgba(229,161,0,0.75); }
    .nt-meal-card--breakfast:hover { box-shadow:0 0 14px rgba(229,161,0,0.12); }
    .nt-meal-card--lunch { border-top:3px solid rgba(74,158,255,0.75); }
    .nt-meal-card--lunch:hover { box-shadow:0 0 14px rgba(74,158,255,0.12); }
    .nt-meal-card--dinner { border-top:3px solid rgba(204,32,32,0.85); }
    .nt-meal-card--dinner:hover { box-shadow:0 0 14px rgba(204,32,32,0.14); }
    .nt-meal-card--snacks { border-top:3px solid rgba(40,183,141,0.75); }
    .nt-meal-card--snacks:hover { box-shadow:0 0 14px rgba(40,183,141,0.12); }
    .nt-meal-card--default { border-top:2px solid var(--line-2); }
    .nt-meal-header { display:flex; justify-content:space-between; align-items:center; padding:0.68rem 0.9rem; cursor:pointer; transition:background var(--motion-fast); gap:0.6rem; }
    .nt-meal-header:hover { background:rgba(255,255,255,0.03); }
    .nt-meal-header-left { display:flex; align-items:center; gap:0.55rem; min-width:0; }
    .nt-meal-name { font-family:var(--font-display); font-size:0.7rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--text-1); }
    .nt-meal-kcal { font-size:0.75rem; color:var(--text-3); font-family:var(--font-display); }
    .nt-meal-chevron { font-size:0.68rem; color:var(--text-3); flex-shrink:0; transition:transform var(--motion-fast); }
    .nt-meal-chevron--open { transform:rotate(180deg); }
    .nt-meal-body { border-top:1px solid var(--line-1); padding:0.65rem 0.9rem; display:grid; gap:0.38rem; background:rgba(0,0,0,0.14); flex:1; overflow-y:auto; min-height:0; align-content:start; scrollbar-width:none; }
    .nt-meal-body::-webkit-scrollbar { display:none; }
    .nt-food-row { display:flex; justify-content:space-between; align-items:center; gap:0.55rem; padding:0.4rem 0.52rem; background:var(--surface-3); border-radius:var(--radius-sm); border:1px solid transparent; transition:all var(--motion-fast); }
    .nt-food-row:hover { border-color:var(--line-1); background:rgba(255,255,255,0.025); }
    .nt-food-name { font-size:0.9rem; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nt-food-meta { font-size:0.76rem; color:var(--text-3); margin-top:0.04rem; }
    .nt-food-del { background:transparent; border:none; color:var(--text-3); cursor:pointer; padding:0.14rem 0.3rem; border-radius:4px; font-size:0.76rem; flex-shrink:0; transition:all var(--motion-fast); }
    .nt-food-del:hover { color:var(--bad); background:rgba(255,79,115,0.08); }
    .nt-meal-group-hdr { display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0.5rem; background:var(--surface-1); border-radius:var(--radius-sm); cursor:pointer; transition:background var(--motion-fast); }
    .nt-meal-group-hdr:hover { background:var(--surface-3); }
    .nt-add-food-btn { display:flex; align-items:center; gap:0.38rem; padding:0.46rem 0.7rem; background:transparent; border:1px dashed var(--line-2); border-radius:var(--radius-sm); color:var(--text-3); cursor:pointer; font-size:0.8rem; width:100%; justify-content:center; transition:all var(--motion-fast); margin-top:0.32rem; box-sizing:border-box; }
    .nt-add-food-btn:hover { border-color:var(--accent-2); color:var(--accent-3); background:rgba(204,32,32,0.06); box-shadow:0 0 12px rgba(204,32,32,0.1); }

    /* ── Micronutrients ── */
    .nt-micro-toggle { display:flex; justify-content:space-between; align-items:center; padding:0.74rem 0.9rem; background:var(--surface-2); border:1px solid var(--line-1); border-radius:var(--radius-md); cursor:pointer; transition:all var(--motion-fast); }
    .nt-micro-toggle:hover { background:rgba(255,255,255,0.025); border-color:var(--line-2); }
    .nt-micro-toggle-label { font-family:var(--font-display); font-size:0.67rem; letter-spacing:0.18em; text-transform:uppercase; color:var(--text-2); }
    .nt-micro-item { background:var(--surface-3); border:1px solid var(--line-1); border-radius:var(--radius-sm); padding:0.46rem 0.6rem; transition:border-color var(--motion-fast); }
    .nt-micro-item:hover { border-color:var(--line-2); }
    .nt-micro-item-top { display:flex; justify-content:space-between; align-items:baseline; gap:0.5rem; margin-bottom:0.2rem; }
    .nt-micro-name { font-size:0.84rem; color:var(--text-1); }
    .nt-micro-group { font-size:0.72rem; color:var(--text-3); }
    .nt-micro-amount { font-size:0.82rem; color:var(--text-2); white-space:nowrap; font-family:var(--font-display); }
    .nt-micro-track { height:4px; border-radius:999px; background:var(--surface-1); overflow:hidden; }
    .nt-micro-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--accent-1),var(--accent-3)); transition:width 400ms ease; }
    .nt-micro-fill--ok  { background:linear-gradient(90deg,rgba(40,183,141,0.65),rgba(40,183,141,1)); }
    .nt-micro-fill--over{ background:linear-gradient(90deg,var(--bad),rgba(255,79,115,0.75)); }

    /* ── Modal ── */
    .nt-modal-overlay { position:fixed; inset:0; background:rgba(9,5,6,0.88); z-index:200; display:flex; align-items:flex-start; justify-content:center; padding:5vh 1rem; backdrop-filter:blur(4px); }
    .nt-modal { background:var(--surface-2); border:1px solid var(--line-1); border-top:2px solid var(--accent-2); border-radius:var(--radius-lg); width:100%; max-width:540px; max-height:82vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:var(--shadow-soft),0 0 40px rgba(165,21,21,0.1); }
    .nt-modal-header { padding:0.86rem 1.1rem; border-bottom:1px solid var(--line-1); display:flex; justify-content:space-between; align-items:center; }
    .nt-modal-title { font-family:var(--font-display); font-size:0.66rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--text-2); }
    .nt-modal-close { background:transparent; border:none; color:var(--text-3); cursor:pointer; font-size:1rem; padding:0.18rem 0.38rem; border-radius:4px; transition:all var(--motion-fast); }
    .nt-modal-close:hover { color:var(--text-1); background:rgba(255,255,255,0.05); }
    .nt-modal-search { padding:0.65rem 0.9rem; border-bottom:1px solid var(--line-1); }
    .nt-modal-results { flex:1; overflow-y:auto; padding:0.3rem 0; }
    .nt-modal-result { display:flex; align-items:flex-start; gap:0.62rem; padding:0.55rem 0.9rem; cursor:pointer; border:none; background:transparent; width:100%; text-align:left; transition:background var(--motion-fast); }
    .nt-modal-result:hover { background:var(--surface-3); }
    .nt-modal-result-info { flex:1; min-width:0; }
    .nt-modal-result-name { font-size:0.9rem; color:var(--text-1); margin-bottom:0.06rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nt-modal-result-brand { font-size:0.76rem; color:var(--text-3); }
    .nt-modal-result-macros { font-size:0.74rem; color:var(--text-2); margin-top:0.1rem; }
    .nt-source-badge { font-size:0.56rem; font-family:var(--font-display); letter-spacing:0.1em; text-transform:uppercase; padding:0.1rem 0.38rem; border-radius:999px; flex-shrink:0; margin-top:0.16rem; }
    .nt-source-usda { background:rgba(74,158,255,0.1); border:1px solid rgba(74,158,255,0.3); color:#4a9eff; }
    .nt-source-off { background:rgba(40,183,141,0.1); border:1px solid rgba(40,183,141,0.3); color:var(--ok); }
    .nt-source-mine { background:rgba(204,32,32,0.1); border:1px solid var(--accent-1); color:var(--accent-3); }
    .nt-allergen-badge { font-size:0.56rem; font-family:var(--font-display); letter-spacing:0.05em; text-transform:uppercase; padding:0.1rem 0.36rem; border-radius:999px; background:rgba(255,184,107,0.1); border:1px solid rgba(255,184,107,0.3); color:#ffb86b; flex-shrink:0; }
    .nt-modal-footer { padding:0.78rem 0.95rem; border-top:1px solid var(--line-1); display:grid; gap:0.42rem; }
    .nt-modal-add-row { display:grid; grid-template-columns:1fr 100px 120px auto; gap:0.42rem; align-items:center; }

    /* ── Buttons ── */
    .nt-btn { padding:0.48rem 0.88rem; border-radius:var(--radius-sm); cursor:pointer; font-family:var(--font-display); font-size:0.68rem; letter-spacing:0.1em; text-transform:uppercase; transition:all var(--motion-fast); border:1px solid var(--line-1); background:transparent; color:var(--text-2); }
    .nt-btn:hover:not(:disabled) { border-color:var(--line-2); color:var(--text-1); }
    .nt-btn:disabled { opacity:0.38; cursor:default; }
    .nt-btn--primary { background:linear-gradient(135deg,var(--accent-1),var(--accent-2)); border-color:var(--accent-2); color:#fff; }
    .nt-btn--primary:hover:not(:disabled) { background:linear-gradient(135deg,var(--accent-2),var(--accent-3)); border-color:var(--accent-3); box-shadow:0 0 18px rgba(204,32,32,0.4); }
    .nt-btn--sm { padding:0.3rem 0.6rem; font-size:0.63rem; }
    .nt-btn--danger { border-color:rgba(255,79,115,0.25); color:var(--bad); }
    .nt-btn--danger:hover:not(:disabled) { background:rgba(255,79,115,0.08); border-color:var(--bad); }

    /* ── Toast ── */
    .nt-toast { position:fixed; top:1rem; right:1rem; z-index:300; padding:0.62rem 0.92rem; border-radius:var(--radius-sm); border:1px solid var(--line-2); background:var(--surface-2); color:var(--text-1); font-size:0.86rem; max-width:360px; box-shadow:var(--shadow-soft); animation:nt-toast-in 180ms ease; }
    .nt-toast--warning { border-color:rgba(229,161,0,0.4); }

    /* ── Meal plan ── */
    .nt-week-nav { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; }
    .nt-week-label { font-family:var(--font-display); font-size:0.76rem; color:var(--text-2); letter-spacing:0.08em; }
    .nt-plan-days { display:grid; gap:0.5rem; }
    .nt-plan-day { background:var(--surface-2); border:1px solid var(--line-1); border-radius:var(--radius-md); overflow:hidden; }
    .nt-plan-day--training { border-left:3px solid var(--accent-1); }
    .nt-plan-day--rest { border-left:3px solid rgba(40,183,141,0.4); }
    .nt-plan-day--high { border-left:3px solid rgba(229,161,0,0.45); }
    .nt-plan-day-header { display:flex; justify-content:space-between; align-items:center; padding:0.7rem 0.95rem; cursor:pointer; gap:0.6rem; transition:background var(--motion-fast); }
    .nt-plan-day-header:hover { background:var(--surface-3); }
    .nt-plan-day-left { display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; }
    .nt-plan-day-name { font-family:var(--font-display); font-size:0.76rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-1); }
    .nt-plan-day-totals { font-size:0.74rem; color:var(--text-3); white-space:nowrap; font-family:var(--font-display); }
    .nt-plan-day-body { border-top:1px solid var(--line-1); padding:0.65rem 0.95rem; display:grid; gap:0.42rem; }
    .nt-plan-meal { background:var(--surface-3); border-radius:var(--radius-sm); padding:0.55rem 0.7rem; }
    .nt-plan-meal--pre { border-left:3px solid var(--accent-2); }
    .nt-plan-meal--post { border-left:3px solid var(--ok); }
    .nt-plan-meal-header { display:flex; justify-content:space-between; align-items:baseline; gap:0.5rem; margin-bottom:0.28rem; }
    .nt-plan-meal-name { font-family:var(--font-display); font-size:0.64rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-2); }
    .nt-plan-timing-chip { font-size:0.57rem; font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; padding:0.09rem 0.36rem; border-radius:999px; margin-left:0.28rem; }
    .nt-plan-timing-chip--pre { background:rgba(165,21,21,0.12); border:1px solid var(--accent-1); color:var(--accent-3); }
    .nt-plan-timing-chip--post { background:rgba(40,183,141,0.1); border:1px solid rgba(40,183,141,0.3); color:var(--ok); }
    .nt-plan-food { font-size:0.84rem; color:var(--text-2); }
    .nt-plan-meal-macros { font-size:0.72rem; color:var(--text-3); margin-top:0.24rem; font-family:var(--font-display); }
    .nt-plan-empty { text-align:center; padding:2.5rem 1rem; }
    .nt-plan-empty-icon { font-size:2rem; opacity:0.3; margin-bottom:0.55rem; }
    .nt-plan-empty-title { font-family:var(--font-display); font-size:0.74rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-2); margin-bottom:0.38rem; }
    .nt-plan-empty-sub { font-size:0.86rem; color:var(--text-3); margin-bottom:1.2rem; max-width:360px; margin-left:auto; margin-right:auto; line-height:1.5; }

    /* ── Settings ── */
    .nt-settings-grid { display:grid; gap:0.55rem; grid-template-columns:1fr 1fr; }
    .nt-settings-full { grid-column:1/-1; }
    .nt-targets-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.55rem; }
    .nt-target-day { background:var(--surface-3); border:1px solid var(--line-1); border-radius:var(--radius-sm); padding:0.78rem; }
    .nt-target-day--training { border-top:3px solid rgba(204,32,32,0.55); }
    .nt-target-day--rest { border-top:3px solid rgba(40,183,141,0.45); }
    .nt-target-day--high { border-top:3px solid rgba(229,161,0,0.45); }
    .nt-target-day-name { font-family:var(--font-display); font-size:0.63rem; letter-spacing:0.2em; text-transform:uppercase; color:var(--text-3); margin-bottom:0.55rem; }
    .nt-target-field-label { font-size:0.76rem; color:var(--text-3); margin-bottom:0.16rem; }

    /* ── Locked calories display ── */
    .nt-cal-locked {
      display:flex; align-items:center; justify-content:space-between;
      background:rgba(165,21,21,0.07); border:1px solid rgba(165,21,21,0.2);
      border-radius:var(--radius-sm); padding:0.5rem 0.75rem; margin-bottom:0.75rem;
    }
    .nt-cal-locked-label {
      display:flex; align-items:center; gap:0.4rem;
      font-family:var(--font-display); font-size:0.62rem; letter-spacing:0.14em;
      text-transform:uppercase; color:var(--text-3);
    }
    .nt-cal-locked-label svg { opacity:0.6; }
    .nt-cal-locked-value {
      font-family:var(--font-display); font-size:1rem; font-weight:700; color:var(--text-1);
    }
    .nt-cal-locked-unit { font-size:0.68rem; color:var(--text-3); margin-left:0.25rem; }

    /* ── Macro stepper rows ── */
    .nt-macro-row {
      display:flex; align-items:center; gap:0.5rem;
      padding:0.45rem 0; border-bottom:1px solid var(--line-1);
    }
    .nt-macro-row:last-child { border-bottom:none; }
    .nt-macro-label {
      flex:1; font-family:var(--font-display); font-size:0.68rem;
      letter-spacing:0.1em; text-transform:uppercase; color:var(--text-2);
    }
    .nt-macro-pct {
      font-size:0.68rem; color:var(--text-3); min-width:2.8rem; text-align:right;
    }
    .nt-macro-stepper {
      display:flex; align-items:center; gap:0.35rem;
    }
    .nt-stepper-btn {
      width:24px; height:24px; border-radius:var(--radius-sm);
      border:1px solid var(--line-2); background:var(--surface-2);
      color:var(--text-2); font-size:0.85rem; line-height:1;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:border-color 0.15s, background 0.15s;
      flex-shrink:0;
    }
    .nt-stepper-btn:hover:not(:disabled) { border-color:var(--accent-2); background:rgba(165,21,21,0.12); color:var(--text-1); }
    .nt-stepper-btn:disabled { opacity:0.3; cursor:not-allowed; }
    .nt-stepper-val {
      min-width:3rem; text-align:center;
      font-family:var(--font-display); font-size:0.78rem; color:var(--text-1);
    }
    .nt-macro-drift {
      font-size:0.62rem; min-width:2.8rem; text-align:right;
      font-family:var(--font-display); letter-spacing:0.06em;
    }
    .nt-macro-drift--up   { color:var(--ok); }
    .nt-macro-drift--down { color:var(--bad); }
    .nt-macro-drift--zero { color:var(--text-3); }

    /* ── Responsive ── */
    @media (max-width:1100px) { .nt-log-split { grid-template-columns:3fr 2fr; } }
    @media (max-width:820px)  { .nt-wrap { height:auto; overflow:visible; } .nt-log-split { grid-template-columns:1fr; height:auto; } .nt-hud-col,.nt-meals-col { height:auto; overflow:visible; } .nt-settings-grid,.nt-targets-grid { grid-template-columns:1fr; } }
    @media (max-width:560px)  { .nt-modal-add-row { grid-template-columns:1fr 1fr; } }
  `;

  // ── Shared input style (used for inline inputs) ────────────────────────────
  const inp = { width: "100%", padding: "0.6rem 0.75rem", background: "var(--surface-1)", color: "var(--text-1)", border: "1px solid var(--line-1)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.9rem", boxSizing: "border-box", outline: "none" };
  const sel = { ...inp, cursor: "pointer" };


  if (loading) return <PhysiquePilotLoader />;

  // Helper: meal card colour class by segment key
  const mealCardColorClass = (key) => {
    const k = String(key || "").toLowerCase();
    if (k === "breakfast") return "nt-meal-card--breakfast";
    if (k === "lunch") return "nt-meal-card--lunch";
    if (k === "dinner") return "nt-meal-card--dinner";
    if (k === "snacks") return "nt-meal-card--snacks";
    return "nt-meal-card--default";
  };

  return (
    <div className="nt-wrap">
      <style>{CSS}</style>

      {/* Toast */}
      {toast?.message && (
        <div className={`nt-toast${toast.type === "warning" ? " nt-toast--warning" : ""}`}>
          {toast.message}
        </div>
      )}

      {/* ── Food search modal ──────────────────────────────────────────────── */}
      {foodModalOpen && (
        <div className="nt-modal-overlay" onClick={() => setFoodModalOpen(false)}>
          <div className="nt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nt-modal-header">
              <span className="nt-modal-title">
                ◈ ADD FOOD — {(activeSegments.find((s) => s.key === entrySegment)?.label || entrySegment).toUpperCase()}
              </span>
              <button className="nt-modal-close" onClick={() => setFoodModalOpen(false)}>✕</button>
            </div>

            <div className="nt-modal-search">
              <input
                value={entryFood}
                onChange={(e) => {
                  setEntryFood(e.target.value);
                  setEntryFoodLocked(false);
                  setEntryFoodId(null);
                  setEntryUserFoodId(null);
                }}
                placeholder="Search foods… e.g. chicken breast, oats, whey protein"
                autoFocus
                style={{ ...inp, fontSize: "0.92rem" }}
              />
            </div>

            <div className="nt-modal-results">
              {foodSearching ? (
                <div style={{ padding: "1.2rem", color: "var(--text-3)", textAlign: "center", fontSize: "0.82rem" }}>Searching...</div>
              ) : foodResults.length > 0 ? (
                foodResults.map((r) => {
                  const nameLower = String(r.name || "").toLowerCase();
                  const hasAllergen = foodAllergies.length > 0 && foodAllergies.some((a) => nameLower.includes(a));
                  const src = r.source || "unknown";
                  const srcClass = src === "usda" ? "nt-source-usda" : src === "openfoodfacts" ? "nt-source-off" : "nt-source-mine";
                  const srcLabel = src === "usda" ? "USDA" : src === "openfoodfacts" ? "Open Food Facts" : "My Foods";
                  const p = r.nutrients_per_100g;
                  return (
                    <button
                      key={`${src}:${r.id}`}
                      className="nt-modal-result"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { selectFoodResult(r); setFoodDropdownOpen(false); }}
                    >
                      <div className="nt-modal-result-info">
                        <div className="nt-modal-result-name">{r.name}{r.brand ? ` — ${r.brand}` : ""}</div>
                        {p && (
                          <div className="nt-modal-result-macros">
                            Per 100g: {Math.round(p.energy_kcal || 0)} kcal · P{Math.round(p.protein_g || 0)}g · C{Math.round(p.carbs_g || 0)}g · F{Math.round(p.fat_g || 0)}g
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.26rem", alignItems: "flex-end", flexShrink: 0 }}>
                        <span className={`nt-source-badge ${srcClass}`}>{srcLabel}</span>
                        {hasAllergen && <span className="nt-allergen-badge">⚠ Allergen</span>}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: "1.2rem", color: "var(--text-3)", textAlign: "center", fontSize: "0.82rem" }}>
                  {entryFood.length > 1
                    ? (foodNoMatches ? "No matches. Try a simpler search term." : "Searching…")
                    : "Type to search USDA, Open Food Facts, and your saved foods."}
                </div>
              )}
            </div>

            <div className="nt-modal-footer">
              <div className="nt-modal-add-row">
                <input value={entryQty} onChange={(e) => setEntryQty(e.target.value)} placeholder="Quantity" inputMode="decimal" style={inp} />
                <select value={entryUnit} onChange={(e) => setEntryUnit(e.target.value)} style={sel}>
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <select value={entrySegment} onChange={(e) => setEntrySegment(e.target.value)} style={sel}>
                  {activeSegments.map((seg) => <option key={seg.key} value={seg.key}>{seg.label}</option>)}
                </select>
                <button
                  className="nt-btn nt-btn--primary"
                  disabled={!String(entryFood || "").trim() || !isPositiveNumber(entryQty) || entryResolving}
                  onClick={async () => { await addEntry(); setFoodModalOpen(false); setEntryFood(""); setEntryQty(""); setFoodResults([]); }}
                >
                  {entryResolving ? "…" : "Add"}
                </button>
              </div>
              {logWarnings.length > 0 && (
                <div style={{ fontSize: "0.76rem", color: "var(--warn)" }}>{logWarnings[0]}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <PageHeader
        title="NUTRITION"
        right={
          <>
            <PageTabs
              tabs={[["log","Log Today"],["meal_plan","Meal Plan"],["settings","Settings"]]}
              active={tab}
              onChange={setTab}
            />
            {(saving || lastSavedAt) && (
              <span className="nt-save-status">
                {saving ? "SAVING…" : lastSavedAt ? `SAVED ${lastSavedAt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}` : ""}
              </span>
            )}
          </>
        }
      />

      {error && (
        <div style={{ fontSize: "0.82rem", color: "var(--bad)", padding: "0.55rem 0.9rem", background: "rgba(255,79,115,0.07)", border: "1px solid rgba(255,79,115,0.2)", borderRadius: "var(--radius-sm)" }}>
          {error}
        </div>
      )}

      {/* ══════════════════ LOG TODAY ══════════════════════════════════════ */}
      {tab === "log" && (
        <div className="nt-log-split">

          {/* ── LEFT: HUD column ── */}
          <div className="nt-hud-col">

            {/* Day bar */}
            <div className="nt-panel">
              <div className="nt-day-bar">
                <div>
                  <div className="nt-day-date">
                    {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
                  </div>
                  <span className={`nt-day-type-badge nt-day-type-badge--${todayType}`}>
                    {dayLabel[todayType] || "Today"}
                  </span>
                </div>
                <div className="nt-day-controls">
                  <select
                    value={todayType}
                    onChange={(e) => saveTodayType(e.target.value)}
                    style={{ ...sel, width: "auto", fontSize: "0.72rem", fontFamily: "var(--font-display)", letterSpacing: "0.05em", padding: "0.38rem 0.62rem" }}
                  >
                    <option value="training">Training</option>
                    <option value="rest">Rest</option>
                    <option value="high">High</option>
                  </select>
                  <button className="nt-btn nt-btn--sm nt-btn--primary" onClick={saveLog} disabled={saving}>Save</button>
                  <button className="nt-btn nt-btn--sm" onClick={() => { setEntries([]); setEntryFood(""); setEntryQty(""); setFoodResults([]); }}>Clear</button>
                </div>
              </div>
            </div>

            {/* Calorie HUD — split: left toggleable, right static plan */}
            <div className="nt-calorie-hud">

              {/* Left: toggleable 2-slide panel */}
              <div className="nt-hud-left" onWheel={(e) => { e.preventDefault(); setCalorieView((v) => e.deltaY > 0 ? (v + 1) % 2 : (v + 1) % 2); }}>
                <div className="nt-hud-header">
                  <span className="nt-hud-label">
                    {calorieView === 0 ? "◈ REMAINING" : "◈ CONSUMED"}
                  </span>
                  <div className="nt-hud-nav">
                    <div className="nt-hud-nav-dot">
                      {[0, 1].map((i) => (
                        <span key={i} className={`nt-hud-dot${calorieView === i ? " nt-hud-dot--active" : ""}`} />
                      ))}
                    </div>
                    <button className="nt-hud-arrow" onClick={() => setCalorieView((v) => (v + 1) % 2)}>◀</button>
                    <button className="nt-hud-arrow" onClick={() => setCalorieView((v) => (v + 1) % 2)}>▶</button>
                  </div>
                </div>
                <div className="nt-hud-body">

                  {/* Slide 0: remaining cals + macros remaining */}
                  {calorieView === 0 && (() => {
                    const cals = Math.round(Number(effectiveLogTotals.calories || 0));
                    const target = Number(todaysTargets?.calories || 0);
                    const remaining = target - cals;
                    const isOver = remaining < 0;
                    const pConsumed = effectiveLogTotals.protein_g || 0;
                    const cConsumed = effectiveLogTotals.carbs_g || 0;
                    const fConsumed = effectiveLogTotals.fats_g || 0;
                    const pTarget = todaysTargets?.protein_g || 0;
                    const cTarget = todaysTargets?.carbs_g || 0;
                    const fTarget = todaysTargets?.fats_g || 0;
                    const pRem = Math.max(0, pTarget - pConsumed);
                    const cRem = Math.max(0, cTarget - cConsumed);
                    const fRem = Math.max(0, fTarget - fConsumed);
                    const pPct = pTarget > 0 ? Math.min(100, (pConsumed / pTarget) * 100) : 0;
                    const cPct = cTarget > 0 ? Math.min(100, (cConsumed / cTarget) * 100) : 0;
                    const fPct = fTarget > 0 ? Math.min(100, (fConsumed / fTarget) * 100) : 0;
                    return (
                      <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:"0.38rem" }}>
                        <div style={{ display:"flex", alignItems:"baseline", gap:"0.3rem" }}>
                          <span className={`nt-remaining-big ${isOver ? "nt-remaining-negative" : "nt-remaining-positive"}`}>
                            {isOver ? "+" : ""}{Math.abs(remaining).toLocaleString()}
                          </span>
                          <span className="nt-calorie-unit">{isOver ? "over" : "kcal left"}</span>
                        </div>
                        {[
                          { label:"P", pct: pPct, rem: Math.round(pRem), color:"#16a34a" },
                          { label:"C", pct: cPct, rem: Math.round(cRem), color:"#1d4ed8" },
                          { label:"F", pct: fPct, rem: Math.round(fRem), color:"#dc2626" },
                        ].map(({ label, pct, rem, color }) => (
                          <div key={label} style={{ display:"grid", gridTemplateColumns:"14px 1fr 34px", alignItems:"center", gap:"0.38rem" }}>
                            <span style={{ fontFamily:"var(--font-display)", fontSize:"0.6rem", letterSpacing:"0.1em", color:"var(--text-3)" }}>{label}</span>
                            <div style={{ height:5, borderRadius:999, background:"var(--surface-1)", overflow:"hidden" }}>
                              <div style={{ height:"100%", borderRadius:999, background:color, width:`${pct}%`, transition:"width 600ms cubic-bezier(.22,.68,0,1.2)" }} />
                            </div>
                            <span style={{ fontFamily:"var(--font-display)", fontSize:"0.6rem", color:"var(--text-2)", textAlign:"right" }}>{rem}g</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Slide 1: consumed ring (smaller) */}
                  {calorieView === 1 && (() => {
                    const cals = Math.round(Number(effectiveLogTotals.calories || 0));
                    const target = Number(todaysTargets?.calories || 0);
                    const fillPct = target > 0 ? Math.min(100, (cals / target) * 100) : 0;
                    const isOver = cals > target && target > 0;
                    const R = 42; const C = 2 * Math.PI * R;
                    return (
                      <div style={{ display:"flex", alignItems:"center", gap:"0.65rem", width:"100%" }}>
                        <div style={{ position:"relative", width:104, height:104, flexShrink:0 }}>
                          <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform:"rotate(-90deg)" }}>
                            <defs>
                              <linearGradient id="calGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={isOver ? "#ff3a5c" : "var(--accent-1)"} />
                                <stop offset="100%" stopColor={isOver ? "#ff7c96" : "var(--accent-3)"} />
                              </linearGradient>
                            </defs>
                            <circle cx="52" cy="52" r="48" fill="none" stroke="rgba(204,32,32,0.06)" strokeWidth="1" />
                            <circle cx="52" cy="52" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                            <circle cx="52" cy="52" r={R} fill="none"
                              stroke="url(#calGrad2)" strokeWidth="10" strokeLinecap="round"
                              strokeDasharray={C} strokeDashoffset={C * (1 - fillPct / 100)}
                              style={{ transition:"stroke-dashoffset 700ms cubic-bezier(.22,.68,0,1.2)", filter:`drop-shadow(0 0 ${isOver?'8px rgba(255,58,92,0.85)':'5px rgba(204,32,32,0.65)'})` }}
                            />
                            {[0,45,90,135,180,225,270,315].map(a => {
                              const r1=(a*Math.PI)/180, x1=52+(R-6)*Math.cos(r1), y1=52+(R-6)*Math.sin(r1), x2=52+(R+6)*Math.cos(r1), y2=52+(R+6)*Math.sin(r1);
                              return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />;
                            })}
                          </svg>
                          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"0.04rem" }}>
                            <span className="nt-calorie-big" style={{ fontSize:"1.4rem", color:isOver?"var(--bad)":"var(--text-1)", textShadow:isOver?"0 0 18px rgba(255,58,92,0.55)":"0 0 18px rgba(204,32,32,0.25)" }}>{cals.toLocaleString()}</span>
                            <span className="nt-calorie-unit" style={{ fontSize:"0.56rem" }}>kcal</span>
                          </div>
                        </div>
                        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"0.22rem" }}>
                          <span className="nt-calorie-sub">consumed</span>
                          <div style={{ display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                            <span className="nt-calorie-meta" style={{ flexDirection:"column" }}>
                              <span>TARGET <span className="nt-calorie-meta-val">{target.toLocaleString()}</span></span>
                              <span><span className="nt-calorie-meta-val" style={{ color:isOver?"var(--bad)":fillPct>=90?"var(--warn)":"var(--text-2)" }}>{Math.round(fillPct)}%</span> of goal</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>

              {/* Vertical divider */}
              <div className="nt-hud-divider" />

              {/* Right: static today's plan */}
              <div className="nt-hud-right">
                <div className="nt-hud-right-header">
                  <span className="nt-plan-header">◈ TODAY'S PLAN</span>
                </div>
                <div className="nt-hud-right-body">
                  <div style={{ display:"flex", alignItems:"baseline", gap:"0" }}>
                    <span className="nt-plan-cals">{Math.round(todaysTargets?.calories || 0).toLocaleString()}</span>
                    <span className="nt-plan-cals-unit">kcal</span>
                  </div>
                  <span className={`nt-day-type-badge nt-day-type-badge--${todayType}`} style={{ alignSelf:"flex-start" }}>
                    {dayLabel[todayType] || todayType}
                  </span>
                  <div className="nt-plan-macros">
                    {[
                      { label:"Protein", val: todaysTargets?.protein_g || 0, color:"#16a34a" },
                      { label:"Carbs",   val: todaysTargets?.carbs_g   || 0, color:"#1d4ed8" },
                      { label:"Fats",    val: todaysTargets?.fats_g    || 0, color:"#dc2626" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="nt-plan-macro">
                        <span className="nt-plan-macro-val" style={{ color }}>{Math.round(val)}g</span>
                        <span className="nt-plan-macro-lbl">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Macro bars + pie chart */}
            <div className="nt-panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div className="nt-section-label">◈ MACROS</div>
              <div className="nt-segment-pills">
                {summarySegments.map((seg) => (
                  <button
                    key={seg.key}
                    className={`nt-seg-pill${summarySegment === seg.key ? " nt-seg-pill--active" : ""}`}
                    onClick={() => setSummarySegment(seg.key)}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
              <div className="nt-macro-bars">
                {[
                  { key: "protein_g", label: "Protein", val: effectiveLogTotals.protein_g, target: todaysTargets?.protein_g, color: "#16a34a" },
                  { key: "carbs_g",   label: "Carbs",   val: effectiveLogTotals.carbs_g,   target: todaysTargets?.carbs_g,   color: "#1d4ed8" },
                  { key: "fats_g",    label: "Fats",    val: effectiveLogTotals.fats_g,    target: todaysTargets?.fats_g,    color: "#dc2626" }
                ].map((m) => {
                  const val = round1(m.val || 0);
                  const tgt = Number(m.target || 0);
                  const fillPct = tgt > 0 ? Math.min(100, (val / tgt) * 100) : 0;
                  const over = tgt > 0 && val > tgt * 1.05;
                  return (
                    <div className="nt-macro-bar-row" key={m.key}>
                      <span className="nt-macro-label">{m.label}</span>
                      <div className="nt-macro-track">
                        <div className="nt-macro-fill" style={{ width: `${fillPct}%`, background: over ? "var(--warn)" : m.color }} />
                      </div>
                      <span className={`nt-macro-val${over ? " nt-macro-over" : ""}`}>{val}/{tgt}g</span>
                    </div>
                  );
                })}
              </div>

              {/* Macro split pie chart — fills remaining space */}
              {(() => {
                const totalKcal = Math.round(macroPieDisplayData.reduce((s, d) => s + (d.value || 0), 0));
                return (
                  <div className="nt-macro-chart-section">
                    <div className="nt-macro-chart-wrap">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={macroPieDisplayData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={34}
                            outerRadius={52}
                            paddingAngle={hasMacroPieData ? 3 : 0}
                            startAngle={90}
                            endAngle={-270}
                          >
                            {macroPieDisplayData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={entry.color}
                                stroke="#000"
                                strokeWidth={2}
                                style={{ filter: hasMacroPieData ? `drop-shadow(0 0 5px ${entry.color}66)` : "none", outline: "none" }}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name, ctx) => [`${Math.round(Number(value || 0))} kcal · ${round1(ctx?.payload?.grams || 0)}g`, String(name || "")]}
                            contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--line-1)", borderRadius: "8px", color: "var(--text-1)", fontSize: "0.78rem", padding: "0.35rem 0.6rem" }}
                            itemStyle={{ color: "var(--text-1)" }}
                            cursor={false}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="nt-macro-chart-inner">
                        <span className="nt-macro-chart-total">{hasMacroPieData ? totalKcal.toLocaleString() : "—"}</span>
                        <span className="nt-macro-chart-unit">kcal</span>
                      </div>
                    </div>
                    <div className="nt-macro-chart-legend">
                      {[
                        { name: "Protein", grams: effectiveLogTotals.protein_g || 0, color: "#16a34a" },
                        { name: "Carbs",   grams: effectiveLogTotals.carbs_g   || 0, color: "#1d4ed8" },
                        { name: "Fats",    grams: effectiveLogTotals.fats_g    || 0, color: "#dc2626" },
                        ...(Number(effectiveLogTotals.alcohol_g || 0) > 0 ? [{ name: "Alcohol", grams: effectiveLogTotals.alcohol_g, color: "#d97706" }] : []),
                      ].map(({ name, grams, color }) => {
                        const kcal = name === "Protein" ? grams * 4 : name === "Carbs" ? grams * 4 : name === "Fats" ? grams * 9 : grams * 7;
                        const pct = totalKcal > 0 ? Math.round((kcal / totalKcal) * 100) : 0;
                        return (
                          <div key={name} className="nt-macro-legend-row">
                            <span className="nt-macro-legend-dot" style={{ background: color, boxShadow: hasMacroPieData ? `0 0 6px ${color}99` : "none" }} />
                            <span className="nt-macro-legend-name">{name}</span>
                            <span className="nt-macro-legend-g">{Math.round(grams)}g</span>
                            <span className="nt-macro-legend-pct">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Micronutrients — moved to analytics column */}
            {showMicronutrientsSection && (
              <>
                <div className="nt-micro-toggle" onClick={() => toggleSection("micros")}>
                  <span className="nt-micro-toggle-label">
                    ◈ MICRONUTRIENTS{visibleMicroRows.length > 0 ? ` (${visibleMicroRows.length})` : ""}
                  </span>
                  <span style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>{isCollapsed("micros") ? "Expand ▼" : "Collapse ▲"}</span>
                </div>
                {!isCollapsed("micros") && (
                  <div className="nt-panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem", alignItems: "center" }}>
                      <div className="nt-segment-pills" style={{ margin: 0, flex: 1 }}>
                        {summarySegments.map((seg) => (
                          <button key={`mi-${seg.key}`} className={`nt-seg-pill${summarySegment === seg.key ? " nt-seg-pill--active" : ""}`} onClick={() => setSummarySegment(seg.key)}>
                            {seg.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
                        <select value={microGroupFilter} onChange={(e) => setMicroGroupFilter(e.target.value)} style={{ ...sel, width: "auto", fontSize: "0.78rem", padding: "0.32rem 0.55rem" }}>
                          <option value="all">All groups</option>
                          {microGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <select value={microTargetMode} onChange={(e) => saveMicroMode(e.target.value)} disabled={savingMicroTargets} style={{ ...sel, width: "auto", fontSize: "0.78rem", padding: "0.32rem 0.55rem" }}>
                          <option value="rdi">RDI</option>
                          <option value="bodyweight">Bodyweight</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                    </div>
                    {dayNutrientsLoading ? (
                      <div style={{ color: "var(--text-3)", fontSize: "0.8rem", textAlign: "center", padding: "0.7rem 0" }}>Loading micronutrients...</div>
                    ) : visibleMicroRows.length === 0 ? (
                      <div style={{ color: "var(--text-3)", fontSize: "0.8rem", textAlign: "center", padding: "0.7rem 0" }}>
                        {summarySegment === "all" ? "Log some food to see micronutrients." : `No data in ${selectedSummaryLabel.toLowerCase()} yet.`}
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "0.36rem", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "0.1rem" }}>
                        {visibleMicroRows.map((n) => {
                          const pct = n.amount <= 0 ? 0 : Math.max(2, n.sliderPct);
                          const fillClass = n.sliderPct > 105 ? "nt-micro-fill--over" : n.sliderPct >= 80 ? "nt-micro-fill--ok" : "nt-micro-fill";
                          return (
                            <div className="nt-micro-item" key={n.code}>
                              <div className="nt-micro-item-top">
                                <div>
                                  <span className="nt-micro-name">{displayNutrientLabel(n.code, n.label)}</span>
                                  <span className="nt-micro-group"> · {displayNutrientGroup(n.code, n.sort_group)}</span>
                                </div>
                                <span className="nt-micro-amount">
                                  {formatNutrientAmount(n.amount)} {formatNutrientUnit(n.unit)}
                                  {" / "}
                                  {Number(n.target_amount || 0) > 0 ? `${formatNutrientAmount(n.target_amount)} ${formatNutrientUnit(n.unit)}` : "N/T"}
                                </span>
                              </div>
                              {microTargetMode === "custom" && (
                                <div style={{ marginTop: "0.24rem", display: "flex", justifyContent: "flex-end" }}>
                                  <input type="number" value={microTargetDrafts[n.code] ?? 0}
                                    onChange={(e) => setMicroTargetDrafts((prev) => ({ ...prev, [n.code]: Math.max(0, Number(e.target.value || 0)) }))}
                                    style={{ ...inp, width: "106px", fontSize: "0.8rem", padding: "0.28rem 0.45rem" }} />
                                </div>
                              )}
                              <div className="nt-micro-track" style={{ marginTop: "0.18rem" }}>
                                <div className={fillClass} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {microTargetMode === "custom" && (
                      <div style={{ marginTop: "0.65rem", display: "flex", justifyContent: "flex-end" }}>
                        <button className="nt-btn nt-btn--primary nt-btn--sm" onClick={saveCustomMicroTargets} disabled={savingMicroTargets}>Save Targets</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>{/* end .nt-hud-col */}

          {/* ── RIGHT: Meals column ── */}
          <div className="nt-meals-col">

            {/* Hydration — moved to food log column */}
            <div className="nt-panel">
              <div className="nt-section-label">◈ HYDRATION</div>
              <div className="nt-hydration-grid">
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                    <div className="nt-hydration-label">Water</div>
                    <div className="nt-hydration-pct">{waterMl} / 2500 ml</div>
                  </div>
                  <div className="nt-hydration-gauge">
                    <div className="nt-hydration-fill-water" style={{ width:`${Math.min(100,(waterMl/2500)*100)}%` }} />
                  </div>
                  <input type="number" value={waterMl} onChange={(e) => setWaterMl(clampInt(e.target.value, 0, 10000))} style={inp} />
                </div>
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                    <div className="nt-hydration-label">Salt</div>
                    <div className="nt-hydration-pct">{saltG} / 5 g</div>
                  </div>
                  <div className="nt-hydration-gauge">
                    <div className="nt-hydration-fill-salt" style={{ width:`${Math.min(100,(saltG/5)*100)}%` }} />
                  </div>
                  <input type="number" value={saltG} onChange={(e) => setSaltG(clampNumber(e.target.value, 0, 50, 2))} style={inp} />
                </div>
              </div>
            </div>

            <div className="nt-meals-grid">
              {displaySegments.map((seg) => {
                const rows = groupedRowsBySegment.get(seg.key) || [];
                const segTotals = segmentTotalsByKey?.[seg.key];
                const expanded = !isCollapsed(`seg_${seg.key}`);
                return (
                  <div className={`nt-meal-card ${mealCardColorClass(seg.key)}`} key={seg.key}>
                    <div className="nt-meal-header" onClick={() => toggleSection(`seg_${seg.key}`)}>
                      <div className="nt-meal-header-left">
                        <span className="nt-meal-name">{seg.label}</span>
                        {segTotals && segTotals.calories > 0 && (
                          <span className="nt-meal-kcal">{Math.round(segTotals.calories)} kcal</span>
                        )}
                      </div>
                      <span className={`nt-meal-chevron${expanded ? " nt-meal-chevron--open" : ""}`}>▼</span>
                    </div>

                    {expanded && (
                      <div className="nt-meal-body">
                        {rows.length === 0 && (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-3)", textAlign: "center", padding: "0.2rem 0" }}>
                            Nothing logged yet
                          </div>
                        )}
                        {rows.map((row, rowIdx) => {
                          if (row.kind === "item") {
                            const it = row.item;
                            return (
                              <div className="nt-food-row" key={it.id || rowIdx}>
                                <div style={{ minWidth: 0 }}>
                                  <div className="nt-food-name">{it.food}</div>
                                  <div className="nt-food-meta">{it.qty}{it.unit} · {it.state}</div>
                                </div>
                                <button className="nt-food-del" onClick={() => setEntries((prev) => prev.filter((e) => e.id !== it.id))}>✕</button>
                              </div>
                            );
                          }
                          return (
                            <div key={row.mealId}>
                              <div
                                className="nt-meal-group-hdr"
                                onClick={() => setExpandedSavedMealRows((prev) => ({ ...prev, [row.mealId]: !prev[row.mealId] }))}
                              >
                                <span style={{ fontSize: "0.8rem", color: "var(--text-2)", fontWeight: 600 }}>{row.mealName}</span>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{row.items.length} foods {expandedSavedMealRows[row.mealId] ? "▲" : "▼"}</span>
                              </div>
                              {expandedSavedMealRows[row.mealId] && (
                                <div style={{ display: "grid", gap: "0.26rem", marginTop: "0.26rem" }}>
                                  {row.items.map((it, iti) => (
                                    <div className="nt-food-row" key={it.id || iti}>
                                      <div style={{ minWidth: 0 }}>
                                        <div className="nt-food-name">{it.food}</div>
                                        <div className="nt-food-meta">{it.qty}{it.unit}</div>
                                      </div>
                                      <button className="nt-food-del" onClick={() => setEntries((prev) => prev.filter((e) => e.id !== it.id))}>✕</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          className="nt-add-food-btn"
                          onClick={() => {
                            setEntrySegment(seg.key);
                            setEntryFood("");
                            setEntryQty("");
                            setEntryFoodId(null);
                            setEntryUserFoodId(null);
                            setEntryFoodLocked(false);
                            setFoodResults([]);
                            setFoodModalOpen(true);
                          }}
                        >
                          + Add Food
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>{/* end .nt-meals-col */}

        </div>
      )}

      {/* ══════════════════ MEAL PLAN ════════════════════════════════════════ */}
      {tab === "meal_plan" && (
        <>
          <div className="nt-panel">
            <div className="nt-week-nav">
              <div>
                <div className="nt-section-label">◈ WEEKLY MEAL PLAN</div>
                <div className="nt-week-label">{formatWeekRange(currentWeekStart)}</div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                <button className="nt-btn nt-btn--sm" onClick={() => shiftWeek(-1)}>← Prev</button>
                <button className="nt-btn nt-btn--sm" onClick={() => shiftWeek(1)}>Next →</button>
                <button className="nt-btn nt-btn--primary" onClick={generateMealPlan} disabled={mealPlanGenerating}>
                  {mealPlanGenerating ? "Generating…" : "Generate with AI"}
                </button>
              </div>
            </div>
            {mealPlanError && (
              <div style={{ marginTop: "0.65rem", fontSize: "0.8rem", color: "var(--bad)", padding: "0.45rem 0.7rem", background: "rgba(255,79,115,0.07)", border: "1px solid rgba(255,79,115,0.2)", borderRadius: "var(--radius-sm)" }}>
                {mealPlanError}
              </div>
            )}
          </div>

          {mealPlanLoading ? (
            <div className="nt-panel" style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem", fontSize: "0.8rem" }}>Loading plan...</div>
          ) : !mealPlanData ? (
            <div className="nt-panel">
              <div className="nt-plan-empty">
                <div className="nt-plan-empty-icon">⬡</div>
                <div className="nt-plan-empty-title">No plan for this week</div>
                <div className="nt-plan-empty-sub">
                  Generate a 7-day AI meal plan tailored to your macro targets, training schedule, and dietary preferences.
                  Carbs are automatically timed around your workouts — higher around training, lower on rest days.
                </div>
                <button className="nt-btn nt-btn--primary" onClick={generateMealPlan} disabled={mealPlanGenerating}>
                  {mealPlanGenerating ? "Generating…" : "Generate Week Plan"}
                </button>
              </div>
            </div>
          ) : (
            <div className="nt-plan-days">
              {(mealPlanData.days || []).map((day) => {
                const dateObj = new Date(day.date + "T00:00:00Z");
                const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dateObj.getUTCDay()];
                const dateStr = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
                const isToday = day.date === todayIso();
                const expanded = !isCollapsed(`plan_${day.date}`);
                const dt = day.day_type || "rest";
                return (
                  <div className={`nt-plan-day nt-plan-day--${dt}`} key={day.date}>
                    <div className="nt-plan-day-header" onClick={() => toggleSection(`plan_${day.date}`)}>
                      <div className="nt-plan-day-left">
                        <span className="nt-plan-day-name">{dayName.toUpperCase()} {dateStr}</span>
                        <span className={`nt-day-type-badge nt-day-type-badge--${dt}`} style={{ fontSize: "0.54rem" }}>{dt.toUpperCase()}</span>
                        {isToday && (
                          <span style={{ fontSize: "0.54rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", padding: "0.08rem 0.4rem", borderRadius: "999px", background: "rgba(204,32,32,0.14)", border: "1px solid var(--accent-2)", color: "var(--accent-3)" }}>
                            TODAY
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        {day.totals && (
                          <span className="nt-plan-day-totals">
                            {day.totals.calories} kcal · P{day.totals.protein_g}g C{day.totals.carbs_g}g F{day.totals.fat_g}g
                          </span>
                        )}
                        <span style={{ color: "var(--text-3)", fontSize: "0.7rem" }}>{expanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {expanded && (
                      <div className="nt-plan-day-body">
                        {(day.meals || []).map((meal, mi) => {
                          const isPre = meal.timing_label === "pre_workout";
                          const isPost = meal.timing_label === "post_workout";
                          return (
                            <div className={`nt-plan-meal${isPre ? " nt-plan-meal--pre" : isPost ? " nt-plan-meal--post" : ""}`} key={mi}>
                              <div className="nt-plan-meal-header">
                                <div>
                                  <span className="nt-plan-meal-name">{meal.name}</span>
                                  {isPre && <span className="nt-plan-timing-chip nt-plan-timing-chip--pre">PRE-WORKOUT</span>}
                                  {isPost && <span className="nt-plan-timing-chip nt-plan-timing-chip--post">POST-WORKOUT</span>}
                                </div>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{meal.approximate_time || ""}</span>
                              </div>
                              <div style={{ display: "grid", gap: "0.14rem" }}>
                                {(meal.foods || []).map((f, fi) => (
                                  <div className="nt-plan-food" key={fi}>
                                    · {f.name} <span style={{ color: "var(--text-3)" }}>{f.amount}</span>
                                  </div>
                                ))}
                              </div>
                              {meal.estimated && (
                                <div className="nt-plan-meal-macros">
                                  {meal.estimated.calories} kcal · P{meal.estimated.protein_g}g · C{meal.estimated.carbs_g}g · F{meal.estimated.fat_g}g
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ SETTINGS ═════════════════════════════════════════ */}
      {tab === "settings" && (
        <div className="nt-settings-grid">

          {/* Macro targets — full width */}
          <div className="nt-panel nt-settings-full">
            <div className="nt-section-label">◈ MACRO TARGETS</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginBottom: "0.75rem", lineHeight: 1.5 }}>
              Your calorie targets are set by The Physique Pilot and locked. You can adjust your macro split ±10% in either direction — calories will stay the same.
            </div>
            <div className="nt-targets-grid">
              {["training", "rest", "high"].map((dayType) => {
                const t    = editTargets?.[dayType];
                const base = targets?.[dayType];
                if (!t || !base) return null;

                const totalKcal = Number(t.calories || 0);
                const macros = [
                  { key: "protein_g", label: "Protein", kcalPerG: 4, color: "#16a34a" },
                  { key: "carbs_g",   label: "Carbs",   kcalPerG: 4, color: "#1d4ed8" },
                  { key: "fats_g",    label: "Fat",     kcalPerG: 9, color: "#dc2626" },
                ];

                return (
                  <div key={dayType} className={`nt-target-day nt-target-day--${dayType}`}>
                    <div className="nt-target-day-name">{dayLabel[dayType]}</div>

                    {/* Locked calories */}
                    <div className="nt-cal-locked">
                      <div className="nt-cal-locked-label">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        Calories
                      </div>
                      <div>
                        <span className="nt-cal-locked-value">{totalKcal}</span>
                        <span className="nt-cal-locked-unit">kcal</span>
                      </div>
                    </div>

                    {/* Macro steppers */}
                    <div>
                      {macros.map(({ key, label, kcalPerG, color }) => {
                        const grams      = Number(t[key] || 0);
                        const baseGrams  = Number(base[key] || 0);
                        const pct        = totalKcal > 0 ? Math.round((grams * kcalPerG / totalKcal) * 100) : 0;
                        const drift      = grams - baseGrams;
                        const maxDelta   = Math.round(baseGrams * 0.10);
                        const atMax      = drift >= maxDelta;
                        const atMin      = drift <= -maxDelta;

                        return (
                          <div key={key} className="nt-macro-row">
                            <div className="nt-macro-label" style={{ color }}>{label}</div>
                            <div className="nt-macro-pct">{pct}%</div>
                            <div className="nt-macro-stepper">
                              <button
                                className="nt-stepper-btn"
                                onClick={() => adjustMacro(dayType, key, -1)}
                                disabled={atMin}
                                title={`−${key === "fats_g" ? 2 : 5}g`}
                              >−</button>
                              <div className="nt-stepper-val">{grams}g</div>
                              <button
                                className="nt-stepper-btn"
                                onClick={() => adjustMacro(dayType, key, +1)}
                                disabled={atMax}
                                title={`+${key === "fats_g" ? 2 : 5}g`}
                              >+</button>
                            </div>
                            <div className={`nt-macro-drift ${drift > 0 ? "nt-macro-drift--up" : drift < 0 ? "nt-macro-drift--down" : "nt-macro-drift--zero"}`}>
                              {drift > 0 ? `+${drift}g` : drift < 0 ? `${drift}g` : "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
              <button className="nt-btn nt-btn--primary" onClick={saveTargets}>Save Macro Targets</button>
            </div>
          </div>

          {/* Meal plan preferences */}
          <div className="nt-panel">
            <div className="nt-section-label">◈ MEAL PLAN PREFS</div>
            <div style={{ display: "grid", gap: "0.62rem" }}>
              <div>
                <div className="nt-target-field-label">Meals per day</div>
                <select
                  value={profile?.meals_per_day || 4}
                  onChange={async (e) => { await updateProfile({ meals_per_day: Number(e.target.value) }); pushToast("Updated."); }}
                  style={sel}
                >
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} meals</option>)}
                </select>
              </div>
              <div>
                <div className="nt-target-field-label">Typical training time</div>
                <select
                  value={profile?.training_time_hour ?? 17}
                  onChange={async (e) => { await updateProfile({ training_time_hour: Number(e.target.value) }); pushToast("Updated."); }}
                  style={sel}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Meal presets */}
          <div className="nt-panel">
            <div className="nt-section-label">◈ MEAL PRESETS</div>
            <div style={{ display: "grid", gap: "0.55rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.45rem" }}>
                <select value={activePresetId} onChange={(e) => setActivePresetId(e.target.value)} style={sel}>
                  {mealPresets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="nt-btn nt-btn--sm" onClick={resetPresetDraftToCurrent}>Reset</button>
              </div>
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                <button className="nt-btn nt-btn--sm" onClick={() => { setPresetNameDraft(DEFAULT_PRESET_NAME); setPresetSegmentsDraft(DEFAULT_MEAL_SEGMENTS.map((s) => ({ ...s }))); }}>Standard</button>
                <button className="nt-btn nt-btn--sm" onClick={() => { setPresetNameDraft(DEFAULT_CUSTOM_PRESET_NAME); setPresetSegmentsDraft(DEFAULT_CUSTOM_MEAL_SEGMENTS.map((s) => ({ ...s }))); }}>Custom</button>
              </div>
              <input value={presetNameDraft} onChange={(e) => setPresetNameDraft(e.target.value)} placeholder="Preset name" style={inp} />
              <div style={{ display: "grid", gap: "0.35rem" }}>
                {presetSegmentsDraft.map((seg, idx) => (
                  <div key={`${seg.key}-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.4rem" }}>
                    <input
                      value={seg.label}
                      onChange={(e) => setPresetSegmentsDraft((prev) => prev.map((row, i) => i === idx ? { ...row, label: e.target.value } : row))}
                      placeholder={`Segment ${idx + 1}`}
                      style={{ ...inp, fontSize: "0.86rem" }}
                    />
                    <button className="nt-btn nt-btn--sm" onClick={() => setPresetSegmentsDraft((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.4rem" }}>
                <input
                  value={newSegmentLabel}
                  onChange={(e) => setNewSegmentLabel(e.target.value)}
                  placeholder="Add segment..."
                  style={{ ...inp, fontSize: "0.86rem" }}
                />
                <button className="nt-btn nt-btn--sm" onClick={() => {
                  const label = String(newSegmentLabel || "").trim();
                  if (!label) return;
                  const key = normalizeSegmentKey(label);
                  if (presetSegmentsDraft.some((s) => normalizeSegmentKey(s.key) === key)) { setNewSegmentLabel(""); return; }
                  setPresetSegmentsDraft((prev) => [...prev, { key, label, position: prev.length + 1 }]);
                  setNewSegmentLabel("");
                }}>+ Add</button>
              </div>
              <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="nt-btn nt-btn--sm" disabled={savingPreset} onClick={() => upsertPreset({ createNew: true })}>Create New</button>
                <button className="nt-btn nt-btn--sm nt-btn--danger" disabled={savingPreset || !activePresetId} onClick={deleteActivePreset}>Delete</button>
                <button className="nt-btn nt-btn--primary nt-btn--sm" disabled={savingPreset} onClick={() => upsertPreset({ createNew: false })}>Save Preset</button>
              </div>
            </div>
          </div>

          {/* Saved meals */}
          <div className="nt-panel">
            <div className="nt-section-label">◈ SAVED MEALS</div>
            {savedMeals.length === 0 ? (
              <div style={{ fontSize: "0.82rem", color: "var(--text-3)", lineHeight: 1.5 }}>No saved meals yet. Log meals and save them for quick re-use.</div>
            ) : (
              <div style={{ display: "grid", gap: "0.45rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.45rem", alignItems: "center" }}>
                  <select value={savedMealSelection} onChange={(e) => setSavedMealSelection(e.target.value)} style={sel}>
                    <option value="">Select saved meal</option>
                    {savedMeals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <button className="nt-btn nt-btn--sm nt-btn--primary" onClick={addSavedMealToLog}>Add to Log</button>
                  <button className="nt-btn nt-btn--sm nt-btn--danger" disabled={savingSavedMeal || !savedMealSelection} onClick={deleteSavedMeal}>Delete</button>
                </div>
              </div>
            )}
          </div>

          {/* Micro panel toggle */}
          <div className="nt-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <div>
              <div className="nt-section-label" style={{ marginBottom: "0.18rem" }}>◈ MICRONUTRIENT PANEL</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>Show micronutrient tracking in Log Today.</div>
            </div>
            <button
              className={`nt-btn nt-btn--sm${showMicronutrientsSection ? " nt-btn--primary" : ""}`}
              onClick={() => setShowMicronutrientsSection((prev) => !prev)}
              style={{ flexShrink: 0 }}
            >
              {showMicronutrientsSection ? "On" : "Off"}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
