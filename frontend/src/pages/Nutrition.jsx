import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useProfile } from "../context/ProfileContext";

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

export default function Nutrition() {
  const { profile, todayDayType: contextDayType, updateProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState("log");
  const [showMicronutrientsSection, setShowMicronutrientsSection] = useState(true);

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
      { key: "protein_g", label: "Protein", value: Number(effectiveLogTotals.protein_g || 0), target: proteinTarget, unit: "g", color: "#ff3e6c" },
      { key: "carbs_g", label: "Carbs", value: Number(effectiveLogTotals.carbs_g || 0), target: carbsTarget, unit: "g", color: "#d61f52" },
      { key: "fats_g", label: "Fats", value: Number(effectiveLogTotals.fats_g || 0), target: fatsTarget, unit: "g", color: "#9e1338" }
    ];
  }, [effectiveLogTotals, todaysTargets]);

  const macroPieData = useMemo(() => {
    const proteinKcal = Number(effectiveLogTotals.protein_g || 0) * 4;
    const carbsKcal = Number(effectiveLogTotals.carbs_g || 0) * 4;
    const fatsKcal = Number(effectiveLogTotals.fats_g || 0) * 9;
    const alcoholKcal = Number(effectiveLogTotals.alcohol_g || 0) * 7;
    return [
      { name: "Protein", value: proteinKcal, grams: Number(effectiveLogTotals.protein_g || 0), color: "#ff3e6c" },
      { name: "Carbs", value: carbsKcal, grams: Number(effectiveLogTotals.carbs_g || 0), color: "#d61f52" },
      { name: "Fats", value: fatsKcal, grams: Number(effectiveLogTotals.fats_g || 0), color: "#9e1338" },
      { name: "Alcohol", value: alcoholKcal, grams: Number(effectiveLogTotals.alcohol_g || 0), color: "#7a102c" }
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

  const loadTargets = async (uid) => {
    const { data: tData, error: tErr } = await supabase
      .from("nutrition_day_targets")
      .select("day_type, calories, protein_g, carbs_g, fats_g")
      .eq("user_id", uid);
    if (tErr) throw tErr;

    if (!tData || tData.length === 0) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const r = await fetch(`${API_URL}/api/nutrition/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  const loadMealPresets = async (uid) => {
    const r = await fetch(`${API_URL}/api/nutrition/meal-presets?user_id=${encodeURIComponent(uid)}`);
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
    const r = await fetch(`${API_URL}/api/nutrition/saved-meals?user_id=${encodeURIComponent(uid)}`);
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
      const r = await fetch(`${API_URL}/api/nutrition/meal-presets`, {
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
      const r = await fetch(`${API_URL}/api/nutrition/meal-presets/${encodeURIComponent(activePresetId)}?user_id=${encodeURIComponent(userId)}`, {
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
      const r = await fetch(`${API_URL}/api/nutrition/saved-meals`, {
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
      const r = await fetch(`${API_URL}/api/nutrition/saved-meals/${encodeURIComponent(savedMealSelection)}?user_id=${encodeURIComponent(userId)}`, {
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
        const { data: userData, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const user = userData?.user;
        if (!user) throw new Error("Not logged in.");
        setUserId(user.id);

        const dateIso = todayIso();

        // Day type is computed by ProfileContext via getDayType() — no separate profile fetch needed
        setTodayType(contextDayType || "rest");

        const targetRows = await loadTargets(user.id);
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

  const collapseBtn = {
    padding: "0.35rem 0.6rem",
    background: "transparent",
    color: "#aaa",
    border: "1px solid #2a1118",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.8rem"
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
          <button type="button" onClick={() => setTab("goals")} style={tabBtn(tab === "goals")}>Goals</button>
          <button type="button" onClick={() => setTab("meal_plan")} style={tabBtn(tab === "meal_plan")}>Meal Plan</button>
          <button type="button" onClick={() => setTab("settings")} style={tabBtn(tab === "settings")}>Settings</button>
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
                    <button type="button" onClick={() => toggleSection("foodLog")} style={collapseBtn}>
                      {isCollapsed("foodLog") ? "Expand" : "Collapse"}
                    </button>
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
                        setExpandedSavedMealRows({});
                      }}
                      style={subtleBtn}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {!isCollapsed("foodLog") ? (
                  <>
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

                    {foodDropdownOpen && (foodSearching || foodResults.length > 0 || foodNoMatches) && (
                      <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#050507", border: "1px solid #2a1118", borderRadius: "10px", zIndex: 20, overflow: "hidden" }}>
                        {foodSearching ? (
                          <div style={{ padding: "0.65rem", color: "#888" }}>
                            Searching foods...
                          </div>
                        ) : (
                          foodResults.length > 0 ? (
                            foodResults.map((r) => {
                              const nameLower = String(r.name || "").toLowerCase();
                              const hasAllergen = foodAllergies.length > 0 && foodAllergies.some((a) => nameLower.includes(a));
                              return (
                                <button
                                  key={`${r.source}:${r.id}`}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectFoodResult(r)}
                                  style={{ width: "100%", textAlign: "left", padding: "0.65rem", background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 700 }}>{r.name}{r.brand ? ` — ${r.brand}` : ""}</span>
                                    {hasAllergen && (
                                      <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "4px", background: "rgba(255,184,107,0.15)", color: "#ffb86b", border: "1px solid rgba(255,184,107,0.3)", whiteSpace: "nowrap" }}>
                                        ⚠ Allergen
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div style={{ padding: "0.65rem", color: "#888" }}>
                              {foodNoMatches
                                ? "No matches found yet. Keep typing, or press Add to auto-resolve."
                                : "No suggestions yet."}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="nutrition-entry-row" style={{ display: "grid", gridTemplateColumns: "140px 130px 170px 120px", gap: "0.6rem", alignItems: "center" }}>
                    <input value={entryQty} onChange={(e) => setEntryQty(e.target.value)} placeholder="Qty" inputMode="decimal" style={field} />

                    <select value={entryUnit} onChange={(e) => setEntryUnit(e.target.value)} style={field}>
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>

                    <select value={entrySegment} onChange={(e) => setEntrySegment(e.target.value)} style={field}>
                      {activeSegments.map((seg) => (
                        <option key={seg.key} value={seg.key}>{seg.label}</option>
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

                <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
                  <div style={{ order: 2, border: "1px solid #2a1118", borderRadius: "10px", padding: "0.7rem", background: "#040406", display: "grid", gap: "0.65rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
                      <div style={{ fontWeight: 700 }}>Saved Meals</div>
                      <button type="button" onClick={() => toggleSection("savedMeals")} style={collapseBtn}>
                        {isCollapsed("savedMeals") ? "Expand" : "Collapse"}
                      </button>
                    </div>
                    {!isCollapsed("savedMeals") ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 120px", gap: "0.5rem" }}>
                          <select value={savedMealSelection} onChange={(e) => setSavedMealSelection(e.target.value)} style={field}>
                            <option value="">Select saved meal</option>
                            {savedMeals.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          <button type="button" onClick={addSavedMealToLog} style={subtleBtn}>Add to log</button>
                          <button type="button" disabled={savingSavedMeal || !savedMealSelection} onClick={deleteSavedMeal} style={subtleBtn}>Delete</button>
                        </div>
                        <div style={{ display: "grid", gap: "0.5rem", border: "1px solid #2a1118", borderRadius: "10px", padding: "0.6rem", background: "#050507" }}>
                          <div style={{ color: "#aaa", fontSize: "0.9rem", fontWeight: 700 }}>Build Custom Meal</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 170px", gap: "0.5rem" }}>
                            <input value={savedMealName} onChange={(e) => setSavedMealName(e.target.value)} placeholder="Meal name (e.g. Protein Oats)" style={field} />
                            <select value={savedMealSegment} onChange={(e) => setSavedMealSegment(e.target.value)} style={field}>
                              {activeSegments.map((seg) => (
                                <option key={seg.key} value={seg.key}>{seg.label}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ position: "relative" }}>
                            <input
                              value={mealEntryFood}
                              onChange={(e) => {
                                setMealEntryFood(e.target.value);
                                setMealEntryFoodLocked(false);
                                setMealEntryFoodId(null);
                                setMealEntryUserFoodId(null);
                              }}
                              onFocus={() => {
                                if (!mealEntryFoodLocked && mealFoodResults.length > 0) setMealFoodDropdownOpen(true);
                              }}
                              onBlur={() => setTimeout(() => setMealFoodDropdownOpen(false), 140)}
                              placeholder="Add food to custom meal..."
                              style={field}
                            />
                            {mealFoodDropdownOpen && (mealFoodSearching || mealFoodResults.length > 0 || mealFoodNoMatches) ? (
                              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#050507", border: "1px solid #2a1118", borderRadius: "10px", zIndex: 20, overflow: "hidden" }}>
                                {mealFoodSearching ? (
                                  <div style={{ padding: "0.65rem", color: "#888" }}>Searching foods...</div>
                                ) : mealFoodResults.length > 0 ? (
                                  mealFoodResults.map((r) => (
                                    <button
                                      key={`${r.source}:${r.id}`}
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => selectMealFoodResult(r)}
                                      style={{ width: "100%", textAlign: "left", padding: "0.65rem", background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
                                    >
                                      <div style={{ fontWeight: 700 }}>{r.name}{r.brand ? ` — ${r.brand}` : ""}</div>
                                    </button>
                                  ))
                                ) : (
                                  <div style={{ padding: "0.65rem", color: "#888" }}>
                                    {mealFoodNoMatches ? "No matches found yet." : "No suggestions yet."}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "120px 120px 1fr", gap: "0.5rem", alignItems: "center" }}>
                            <input value={mealEntryQty} onChange={(e) => setMealEntryQty(e.target.value)} placeholder="Qty" inputMode="decimal" style={field} />
                            <select value={mealEntryUnit} onChange={(e) => setMealEntryUnit(e.target.value)} style={field}>
                              {UNIT_OPTIONS.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!String(mealEntryFood || "").trim() || !isPositiveNumber(mealEntryQty) || mealEntryResolving}
                              onClick={addMealDraftEntry}
                              style={primaryBtn(!String(mealEntryFood || "").trim() || !isPositiveNumber(mealEntryQty) || mealEntryResolving)}
                            >
                              {mealEntryResolving ? "Adding..." : "Add"}
                            </button>
                          </div>
                          {mealDraftEntries.length === 0 ? (
                            <div style={{ color: "#666", fontSize: "0.9rem" }}>No foods in custom meal yet.</div>
                          ) : (
                            <div style={{ display: "grid", gap: "0.35rem", maxHeight: "170px", overflowY: "auto", paddingRight: "0.2rem" }}>
                              {mealDraftEntries.map((it) => (
                                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", border: "1px solid #2a1118", borderRadius: "8px", padding: "0.45rem 0.55rem", background: "#040406" }}>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ color: "#fff", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.food}</div>
                                    <div style={{ color: "#888", fontSize: "0.82rem" }}>{it.qty}{it.unit}</div>
                                  </div>
                                  <button type="button" onClick={() => setMealDraftEntries((prev) => prev.filter((x) => x.id !== it.id))} style={subtleBtn}>Remove</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setMealDraftEntries([]);
                                setMealEntryFood("");
                                setMealEntryQty("");
                                setMealEntryUnit("g");
                                setMealEntryFoodId(null);
                                setMealEntryUserFoodId(null);
                                setMealEntryFoodLocked(false);
                                setMealFoodResults([]);
                                setMealFoodDropdownOpen(false);
                              }}
                              style={subtleBtn}
                            >
                              Clear Meal
                            </button>
                            <button
                              type="button"
                              disabled={savingSavedMeal || mealDraftEntries.length === 0 || !String(savedMealName || "").trim()}
                              onClick={saveMealDraftAsMeal}
                              style={primaryBtn(savingSavedMeal || mealDraftEntries.length === 0 || !String(savedMealName || "").trim())}
                            >
                              Save Custom Meal
                            </button>
                          </div>
                        </div>
                        {selectedSavedMeal?.items?.length > 0 ? (
                          <div style={{ border: "1px solid #2a1118", borderRadius: "10px", padding: "0.55rem", background: "#050507", display: "grid", gap: "0.35rem", maxHeight: "160px", overflowY: "auto" }}>
                            {selectedSavedMeal.items.map((it, idx) => (
                              <div key={`${selectedSavedMeal.id}-${idx}`} style={{ color: "#aaa", fontSize: "0.87rem" }}>
                                <span style={{ color: "#fff" }}>{it.food}</span> • {it.qty}{it.unit}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  <div style={{ order: 1, border: "1px solid #2a1118", borderRadius: "10px", padding: "0.7rem", background: "#040406", display: "grid", gap: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
                      <div style={{ fontWeight: 700 }}>Logged Items</div>
                      <button type="button" onClick={() => toggleSection("logEntries")} style={collapseBtn}>
                        {isCollapsed("logEntries") ? "Expand" : "Collapse"}
                      </button>
                    </div>
                    {!isCollapsed("logEntries") ? (
                      entries.length === 0 ? (
                        <div style={{ color: "#666" }}>No items yet.</div>
                      ) : (
                        displaySegments.map((seg) => {
                          const segRows = groupedRowsBySegment.get(seg.key) || [];
                          return (
                            <div key={seg.key} style={{ border: "1px solid #2a1118", borderRadius: "10px", padding: "0.6rem", background: "#040406" }}>
                              <div style={{ fontWeight: 700, marginBottom: "0.45rem" }}>{seg.label}</div>
                              {segRows.length === 0 ? (
                                <div style={{ color: "#666", fontSize: "0.9rem" }}>No items.</div>
                              ) : (
                                <div style={{ display: "grid", gap: "0.45rem" }}>
                                  {segRows.map((row) => {
                                    if (row.kind === "meal") {
                                      const expanded = Boolean(expandedSavedMealRows?.[row.mealId]);
                                      return (
                                        <div key={`meal-${row.mealId}`} style={{ border: "1px solid #2a1118", borderRadius: "10px", background: "#050507", padding: "0.55rem 0.6rem" }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
                                            <div style={{ minWidth: 0 }}>
                                              <div style={{ fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.mealName}</div>
                                              <div style={{ color: "#888", fontSize: "0.86rem", marginTop: "0.15rem" }}>{row.items.length} foods</div>
                                            </div>
                                            <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                                              <button type="button" onClick={() => setExpandedSavedMealRows((prev) => ({ ...(prev || {}), [row.mealId]: !expanded }))} style={subtleBtn}>
                                                {expanded ? "Hide" : "Show"}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setEntries((prev) => prev.filter((x) => String(x.meal_instance_id || "") !== row.mealId))
                                                }
                                                style={subtleBtn}
                                              >
                                                Remove meal
                                              </button>
                                            </div>
                                          </div>
                                          {expanded ? (
                                            <div style={{ marginTop: "0.45rem", display: "grid", gap: "0.35rem" }}>
                                              {row.items.map((it) => (
                                                <div key={it.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "0.55rem", padding: "0.45rem 0.5rem", border: "1px solid #2a1118", borderRadius: "8px", background: "#040406" }}>
                                                  <div style={{ minWidth: 0 }}>
                                                    <div style={{ color: "#fff", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.food}</div>
                                                    <div style={{ color: "#888", fontSize: "0.82rem" }}>{it.qty}{it.unit}</div>
                                                  </div>
                                                  <button type="button" onClick={() => setEntries((prev) => prev.filter((x) => x.id !== it.id))} style={subtleBtn}>Remove</button>
                                                </div>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    }
                                    const it = row.item;
                                    return (
                                      <div key={it.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.75rem", border: "1px solid #2a1118", borderRadius: "10px", background: "#050507" }}>
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.food}</div>
                                          <div style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                                            {it.qty}{it.unit}
                                          </div>
                                        </div>
                                        <button type="button" onClick={() => setEntries((prev) => prev.filter((x) => x.id !== it.id))} style={subtleBtn}>Remove</button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: "1rem", display: "grid", gap: "0.6rem", border: "1px solid #2a1118", borderRadius: "10px", padding: "0.7rem", background: "#040406" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{ color: "#aaa" }}>Notes</div>
                    <button type="button" onClick={() => toggleSection("notes")} style={collapseBtn}>
                      {isCollapsed("notes") ? "Expand" : "Collapse"}
                    </button>
                  </div>
                  {!isCollapsed("notes") ? (
                    <textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder="Anything useful to remember today..." style={{ ...field, minHeight: "110px", resize: "vertical" }} />
                  ) : null}
                </div>
                  </>
                ) : null}
              </div>
              <div style={{ ...card, background: "#040406", padding: "0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Day controls</div>
                    <div style={{ color: "#666", marginTop: "0.25rem" }}>{dayLabel[todayType] || "Today"}</div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button type="button" onClick={() => toggleSection("dayControls")} style={collapseBtn}>
                      {isCollapsed("dayControls") ? "Expand" : "Collapse"}
                    </button>
                    <select value={todayType} onChange={(e) => saveTodayType(e.target.value)} style={{ ...field, width: "170px" }}>
                      <option value="training">Training day</option>
                      <option value="rest">Rest day</option>
                      <option value="high">High day</option>
                    </select>
                  </div>
                </div>

                {!isCollapsed("dayControls") ? (
                  <>
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
                  </>
                ) : null}
              </div>
              </div>

              <div className="nutrition-macro-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1rem" }}>
                <div style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{ fontWeight: 800 }}>Macronutrients</div>
                    <button type="button" onClick={() => toggleSection("dailyTotals")} style={collapseBtn}>
                      {isCollapsed("dailyTotals") ? "Expand" : "Collapse"}
                    </button>
                  </div>
                  {!isCollapsed("dailyTotals") ? (
                    <>
                      <div style={{ marginTop: "0.55rem", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                        {summarySegments.map((seg) => (
                          <button
                            key={`macro-${seg.key}`}
                            type="button"
                            onClick={() => setSummarySegment(seg.key)}
                            style={pill(summarySegment === seg.key)}
                          >
                            {seg.label}
                          </button>
                        ))}
                      </div>

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
                        Alcohol: <span style={{ color: "#fff" }}>{round1(effectiveLogTotals.alcohol_g)}g</span> ({Math.round(Number(effectiveLogTotals.alcohol_g || 0) * 7)} kcal)
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

                    </>
                  ) : null}
                </div>

                {showMicronutrientsSection ? (
                  <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.8rem" }}>
                      <div style={{ fontWeight: 800 }}>Micronutrients</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                        <button type="button" onClick={() => toggleSection("micros")} style={collapseBtn}>
                          {isCollapsed("micros") ? "Expand" : "Collapse"}
                        </button>
                        <div style={{ color: "#666", fontSize: "0.9rem" }}>
                          {dayNutrientsLoading ? "Loading..." : `${visibleMicroRows.length} shown`}
                        </div>
                      </div>
                    </div>

                    {!isCollapsed("micros") ? (
                      <>
                        <div style={{ marginTop: "0.55rem", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                          {summarySegments.map((seg) => (
                            <button
                              key={`micro-${seg.key}`}
                              type="button"
                              onClick={() => setSummarySegment(seg.key)}
                              style={pill(summarySegment === seg.key)}
                            >
                              {seg.label}
                            </button>
                          ))}
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

                        {visibleMicroRows.length === 0 ? (
                          <div style={{ color: "#666", marginTop: "0.5rem" }}>
                            {summarySegment === "all"
                              ? "No micronutrient data available yet."
                              : `No micronutrient data in ${selectedSummaryLabel.toLowerCase()} yet.`}
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
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {tab === "goals" && (
            <div style={{ display: "grid", gap: "1rem" }}>
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
            </div>
          )}

          {tab === "meal_plan" && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={card}>
                <div style={{ fontWeight: 800 }}>Meal Plan</div>
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ ...card, display: "grid", gap: "0.9rem" }}>
                <div style={{ fontWeight: 800 }}>Nutrition Settings</div>

                <div style={{ border: "1px solid #2a1118", borderRadius: "10px", padding: "0.7rem", background: "#040406", display: "grid", gap: "0.65rem" }}>
                  <div style={{ fontWeight: 700 }}>Meal Presets</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: "0.55rem" }}>
                    <select value={activePresetId} onChange={(e) => setActivePresetId(e.target.value)} style={field}>
                      {mealPresets.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={resetPresetDraftToCurrent} style={subtleBtn}>Reset draft</button>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPresetNameDraft(DEFAULT_PRESET_NAME);
                        setPresetSegmentsDraft(DEFAULT_MEAL_SEGMENTS.map((seg) => ({ ...seg })));
                      }}
                      style={subtleBtn}
                    >
                      Use Standard template
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPresetNameDraft(DEFAULT_CUSTOM_PRESET_NAME);
                        setPresetSegmentsDraft(DEFAULT_CUSTOM_MEAL_SEGMENTS.map((seg) => ({ ...seg })));
                      }}
                      style={subtleBtn}
                    >
                      Use Custom template
                    </button>
                  </div>

                  <input
                    value={presetNameDraft}
                    onChange={(e) => setPresetNameDraft(e.target.value)}
                    placeholder="Preset name"
                    style={field}
                  />

                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    {presetSegmentsDraft.map((seg, idx) => (
                      <div key={`${seg.key}-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: "0.5rem" }}>
                        <input
                          value={seg.label}
                          onChange={(e) =>
                            setPresetSegmentsDraft((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row))
                            )
                          }
                          placeholder={`Segment ${idx + 1}`}
                          style={field}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPresetSegmentsDraft((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
                          }
                          style={subtleBtn}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "0.5rem" }}>
                    <input value={newSegmentLabel} onChange={(e) => setNewSegmentLabel(e.target.value)} placeholder="Add segment..." style={field} />
                    <button
                      type="button"
                      onClick={() => {
                        const label = String(newSegmentLabel || "").trim();
                        if (!label) return;
                        const key = normalizeSegmentKey(label);
                        if (presetSegmentsDraft.some((s) => normalizeSegmentKey(s.key) === key)) {
                          setNewSegmentLabel("");
                          return;
                        }
                        setPresetSegmentsDraft((prev) => [...prev, { key, label, position: prev.length + 1 }]);
                        setNewSegmentLabel("");
                      }}
                      style={subtleBtn}
                    >
                      Add segment
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button type="button" disabled={savingPreset} onClick={() => upsertPreset({ createNew: true })} style={subtleBtn}>Create new</button>
                    <button type="button" disabled={savingPreset || !activePresetId} onClick={deleteActivePreset} style={subtleBtn}>Delete preset</button>
                    <button type="button" disabled={savingPreset} onClick={() => upsertPreset({ createNew: false })} style={primaryBtn(savingPreset)}>Save preset</button>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", border: "1px solid #2a1118", borderRadius: "10px", padding: "0.7rem" }}>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700 }}>Show micronutrients</div>
                    <div style={{ color: "#888", marginTop: "0.2rem", fontSize: "0.88rem" }}>Controls micronutrient sliders and targets in the log view.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMicronutrientsSection((prev) => !prev)}
                    style={pill(showMicronutrientsSection)}
                  >
                    {showMicronutrientsSection ? "On" : "Off"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
