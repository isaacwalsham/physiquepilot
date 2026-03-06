import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { apiFetch, API_URL } from "../lib/api";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState("log");
  const [showMicronutrientsSection, setShowMicronutrientsSection] = useState(true);

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
      const r = await apiFetch("/api/nutrition/init", {
        method: "POST",
        body: JSON.stringify({})
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
      const r = await apiFetch(`/api/nutrition/day-summary?log_date=${encodeURIComponent(dateIso)}`);
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
    const r = await apiFetch("/api/nutrition/micro-targets");
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
    const r = await apiFetch("/api/nutrition/meal-presets");
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
    const r = await apiFetch("/api/nutrition/saved-meals");
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
      const r = await apiFetch("/api/nutrition/meal-presets", {
        method: "POST",
        body: JSON.stringify({
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
      const r = await apiFetch(`/api/nutrition/meal-presets/${encodeURIComponent(activePresetId)}`, {
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
      const r = await apiFetch("/api/nutrition/saved-meals", {
        method: "POST",
        body: JSON.stringify({
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
      const r = await apiFetch(`/api/nutrition/saved-meals/${encodeURIComponent(savedMealSelection)}`, {
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
  }, []);

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
      const fetchSearchItems = async (path, timeoutMs = 4500) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const r = await apiFetch(path, { cache: "no-store", signal: controller.signal });
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
          `/api/foods/typeahead?q=${encodeURIComponent(q)}&limit=10`
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
        const r = await apiFetch(
          `/api/foods/typeahead?q=${encodeURIComponent(q)}&limit=10`,
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
    const queryTokens = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const isShortAmbiguous = queryTokens.length <= 1 && query.length < 4;
    if (isShortAmbiguous) {
      return { food_id: null, user_food_id: null, food_name: query };
    }

    const bestResp = await apiFetch("/api/foods/resolve-best", {
      method: "POST",
      body: JSON.stringify({
        query,
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

    const r = await apiFetch(
      `/api/foods/typeahead?q=${encodeURIComponent(query)}&limit=8`
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
      const resp = await apiFetch("/api/foods/resolve-usda", {
        method: "POST",
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
      const resp = await apiFetch("/api/foods/resolve-off", {
        method: "POST",
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
        const resp = await apiFetch("/api/foods/resolve-usda", {
          method: "POST",
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
        const resp = await apiFetch("/api/foods/resolve-off", {
          method: "POST",
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
        const resp = await apiFetch("/api/foods/resolve-usda", {
          method: "POST",
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
        const resp = await apiFetch("/api/foods/resolve-off", {
          method: "POST",
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
      const r = await apiFetch("/api/nutrition/log", {
        method: "POST",
        body: JSON.stringify({
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
      const r = await apiFetch("/api/nutrition/micro-targets", {
        method: "POST",
        body: JSON.stringify({
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

      const r = await apiFetch("/api/nutrition/micro-targets", {
        method: "POST",
        body: JSON.stringify({
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


  // ─── Cockpit CSS ─────────────────────────────────────────────────────────────
  const CSS = `
    .nc-page { width: 100%; font-family: var(--font-body); color: var(--text-1); }

    /* Header */
    .nc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
    .nc-label-row { display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.35rem; }
    .nc-accent-line { width: 20px; height: 1px; background: var(--accent-3); flex-shrink: 0; }
    .nc-label-text { font-family: var(--font-display); font-size: 0.65rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent-3); }
    .nc-page-title { font-family: var(--font-display); font-size: 1.9rem; font-weight: 700; margin: 0; color: var(--text-1); line-height: 1.1; }
    .nc-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
    .nc-tab-bar { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .nc-tab { padding: 0.5rem 0.9rem; border: 1px solid var(--line-1); border-radius: var(--radius-sm); background: transparent; color: var(--text-3); cursor: pointer; font-family: var(--font-display); font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; transition: all 0.15s; }
    .nc-tab.active { background: linear-gradient(135deg, var(--accent-1), var(--accent-2)); border-color: transparent; color: #fff; }
    .nc-save-status { font-family: var(--font-display); font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-3); }
    .nc-save-status.saving { color: var(--warn); }

    /* Toast */
    .nc-toast { position: fixed; top: 18px; right: 18px; z-index: 1200; padding: 0.7rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid rgba(181,21,60,0.3); background: var(--surface-2); color: var(--text-1); box-shadow: 0 8px 24px rgba(0,0,0,0.35); max-width: 360px; font-size: 0.88rem; }
    .nc-toast.warn { border-color: rgba(255,180,0,0.3); }

    /* Error */
    .nc-error { margin-bottom: 1rem; padding: 0.65rem 0.85rem; background: rgba(222,41,82,0.06); border: 1px solid rgba(222,41,82,0.22); border-radius: var(--radius-sm); color: var(--bad); font-size: 0.82rem; }

    /* Card */
    .nc-card { background: rgba(8,3,5,0.85); border: 1px solid var(--line-1); border-radius: var(--radius-md); overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    .nc-card-topbar { display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 0.9rem; border-bottom: 1px solid rgba(181,21,60,0.15); background: rgba(181,21,60,0.04); flex-wrap: wrap; min-height: 42px; }
    .nc-card-code { font-family: var(--font-display); font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent-3); flex-shrink: 0; }
    .nc-card-title { font-size: 0.88rem; font-weight: 600; color: var(--text-3); }
    .nc-card-body { padding: 1rem; }
    .nc-topbar-actions { display: flex; gap: 0.5rem; align-items: center; margin-left: auto; }

    /* Field */
    .nc-field { width: 100%; padding: 0.65rem; background: var(--bg-0); color: var(--text-1); border: 1px solid var(--line-1); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 0.88rem; box-sizing: border-box; }
    .nc-field:focus { outline: none; border-color: var(--accent-3); }
    .nc-field option { background: #0c0408; }
    .nc-textarea { width: 100%; padding: 0.65rem; background: var(--bg-0); color: var(--text-1); border: 1px solid var(--line-1); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 0.88rem; box-sizing: border-box; resize: vertical; min-height: 110px; }
    .nc-textarea:focus { outline: none; border-color: var(--accent-3); }

    /* Pills */
    .nc-pill { padding: 0.4rem 0.75rem; border-radius: 999px; border: 1px solid var(--line-1); background: transparent; color: var(--text-3); cursor: pointer; font-size: 0.85rem; transition: all 0.15s; }
    .nc-pill.active { background: linear-gradient(135deg, var(--accent-1), var(--accent-2)); border-color: transparent; color: #fff; }

    /* Buttons */
    .nc-primary-btn { padding: 0.52rem 0.9rem; background: linear-gradient(135deg, var(--accent-1), var(--accent-2)); color: #fff; border: none; border-radius: var(--radius-sm); cursor: pointer; font-family: var(--font-display); font-size: 0.67rem; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; transition: opacity 0.15s; }
    .nc-primary-btn:disabled { opacity: 0.4; cursor: default; }
    .nc-ghost-btn { padding: 0.48rem 0.8rem; background: transparent; color: var(--text-2); border: 1px solid var(--line-1); border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85rem; white-space: nowrap; }
    .nc-ghost-btn:disabled { opacity: 0.4; cursor: default; }
    .nc-collapse-btn { padding: 0.3rem 0.6rem; background: transparent; color: var(--text-3); border: 1px solid var(--line-1); border-radius: var(--radius-sm); cursor: pointer; font-family: var(--font-display); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }

    /* Sub-card (nested) */
    .nc-sub-card { border: 1px solid var(--line-1); border-radius: var(--radius-sm); background: rgba(4,2,3,0.7); overflow: hidden; }
    .nc-sub-card-header { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(181,21,60,0.08); }
    .nc-sub-card-title { font-family: var(--font-display); font-size: 0.67rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-2); }
    .nc-sub-card-body { padding: 0.75rem; display: grid; gap: 0.6rem; }

    /* Progress bars */
    .nc-progress-track { height: 8px; border-radius: 999px; background: var(--bg-0); overflow: hidden; }
    .nc-progress-fill { height: 100%; border-radius: 999px; transition: width 240ms ease; }

    /* Food search dropdown */
    .nc-food-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: var(--surface-2); border: 1px solid var(--line-1); border-radius: var(--radius-sm); z-index: 20; overflow: hidden; }
    .nc-food-result { width: 100%; text-align: left; padding: 0.62rem 0.75rem; background: transparent; border: none; border-bottom: 1px solid rgba(181,21,60,0.07); color: var(--text-1); cursor: pointer; font-family: var(--font-body); font-size: 0.88rem; display: block; }
    .nc-food-result:hover { background: rgba(181,21,60,0.08); }
    .nc-food-no-results { padding: 0.65rem 0.75rem; color: var(--text-3); font-size: 0.88rem; }

    /* Log layout */
    .nc-log-grid { display: grid; gap: 1rem; }
    .nc-log-top-row { display: grid; grid-template-columns: 1fr 300px; gap: 1rem; align-items: start; }
    .nc-macro-micro-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1rem; }
    .nc-entry-row { display: grid; grid-template-columns: 130px 120px 1fr auto; gap: 0.6rem; align-items: center; margin-top: 0.6rem; }
    .nc-food-search-wrap { position: relative; }
    .nc-food-entry-section { display: grid; gap: 0.6rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(181,21,60,0.1); }
    .nc-log-sub-grid { display: grid; gap: 0.75rem; }
    .nc-pill-bar { display: flex; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.75rem; }

    /* Macro rows */
    .nc-macro-label-row { display: flex; justify-content: space-between; font-size: 0.88rem; color: var(--text-2); margin-bottom: 0.25rem; }
    .nc-macro-val { color: var(--text-1); }
    .nc-macro-bars { display: grid; gap: 0.6rem; }
    .nc-macro-extra { margin-top: 0.65rem; color: var(--text-2); font-size: 0.88rem; }
    .nc-pie-wrap { margin-top: 0.9rem; height: 180px; border: 1px solid var(--line-1); border-radius: var(--radius-sm); background: var(--bg-0); padding: 0.4rem; }

    /* Micronutrient rows */
    .nc-micro-row { border: 1px solid rgba(181,21,60,0.12); border-radius: var(--radius-sm); padding: 0.5rem 0.6rem; background: var(--bg-0); }
    .nc-micro-label-row { display: flex; justify-content: space-between; gap: 0.75rem; font-size: 0.88rem; }
    .nc-micro-name { color: var(--text-1); }
    .nc-micro-group-txt { color: var(--text-3); }
    .nc-micro-val { color: var(--text-1); flex-shrink: 0; }
    .nc-micro-scroll { display: grid; gap: 0.6rem; max-height: 360px; overflow-y: auto; padding-right: 0.25rem; margin-top: 0.6rem; }
    .nc-micro-controls { display: grid; gap: 0.5rem; margin-bottom: 0.65rem; }
    .nc-micro-control-row { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; }
    .nc-micro-label { color: var(--text-3); font-size: 0.85rem; }
    .nc-micro-warning { color: var(--text-3); font-size: 0.82rem; }
    .nc-micro-custom-input { margin-top: 0.35rem; display: flex; justify-content: flex-end; }

    /* Log items */
    .nc-log-item { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0.75rem; padding: 0.55rem 0.65rem; border: 1px solid rgba(181,21,60,0.1); border-radius: var(--radius-sm); background: rgba(8,3,5,0.9); }
    .nc-log-item-info { min-width: 0; }
    .nc-log-item-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-1); font-size: 0.9rem; }
    .nc-log-item-qty { color: var(--text-3); font-size: 0.82rem; margin-top: 0.1rem; }
    .nc-meal-group { border: 1px solid rgba(181,21,60,0.12); border-radius: var(--radius-sm); padding: 0.55rem 0.6rem; background: rgba(8,3,5,0.85); }
    .nc-meal-group-header { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; }
    .nc-meal-group-info { min-width: 0; }
    .nc-meal-group-name { font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nc-meal-group-count { color: var(--text-3); font-size: 0.84rem; margin-top: 0.12rem; }
    .nc-meal-group-actions { display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0; }
    .nc-meal-group-items { margin-top: 0.45rem; display: grid; gap: 0.35rem; }
    .nc-meal-sub-item { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0.55rem; padding: 0.4rem 0.5rem; border: 1px solid var(--line-1); border-radius: var(--radius-sm); background: var(--bg-0); }
    .nc-segment-block { border: 1px solid var(--line-1); border-radius: var(--radius-sm); padding: 0.6rem; background: rgba(4,2,3,0.6); }
    .nc-segment-label { font-family: var(--font-display); font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-2); margin-bottom: 0.4rem; }

    /* Day controls */
    .nc-day-readouts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-top: 0.75rem; }
    .nc-day-readout { }
    .nc-day-readout-label { color: var(--text-3); font-family: var(--font-display); font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; }
    .nc-day-readout-value { font-size: 1.1rem; font-weight: 700; color: var(--text-1); margin-top: 0.15rem; }
    .nc-section-rule { height: 1px; background: rgba(181,21,60,0.12); margin: 0.9rem 0; }
    .nc-subsection-title { font-family: var(--font-display); font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent-3); margin-bottom: 0.6rem; }
    .nc-field-label { font-family: var(--font-display); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); margin-bottom: 0.3rem; display: block; }
    .nc-water-salt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

    /* Goals tab */
    .nc-targets-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .nc-targets-field-label { color: var(--text-3); font-size: 0.82rem; margin-bottom: 0.25rem; font-family: var(--font-display); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; }
    .nc-targets-macros-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin-top: 0.5rem; }

    /* Saved meals */
    .nc-saved-meal-actions { display: grid; grid-template-columns: 1fr auto auto; gap: 0.5rem; }
    .nc-saved-meal-preview { border: 1px solid var(--line-1); border-radius: var(--radius-sm); padding: 0.5rem 0.6rem; background: var(--bg-0); display: grid; gap: 0.3rem; max-height: 150px; overflow-y: auto; }
    .nc-saved-meal-item-row { color: var(--text-2); font-size: 0.85rem; }
    .nc-saved-meal-item-name { color: var(--text-1); }
    .nc-custom-meal-section { border: 1px solid var(--line-1); border-radius: var(--radius-sm); padding: 0.7rem; background: rgba(4,2,3,0.5); display: grid; gap: 0.5rem; }
    .nc-custom-meal-title { font-family: var(--font-display); font-size: 0.67rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-2); }
    .nc-custom-meal-header-row { display: grid; grid-template-columns: 1fr 160px; gap: 0.5rem; }
    .nc-custom-meal-add-row { display: grid; grid-template-columns: 110px 110px 1fr; gap: 0.5rem; align-items: center; }
    .nc-custom-meal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .nc-meal-draft-list { display: grid; gap: 0.35rem; max-height: 160px; overflow-y: auto; padding-right: 0.2rem; }
    .nc-meal-draft-item { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; border: 1px solid var(--line-1); border-radius: var(--radius-sm); padding: 0.4rem 0.55rem; background: rgba(4,2,3,0.6); }
    .nc-meal-draft-name { color: var(--text-1); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nc-meal-draft-qty { color: var(--text-3); font-size: 0.82rem; }

    /* Settings tab */
    .nc-preset-section { border: 1px solid var(--line-1); border-radius: var(--radius-sm); padding: 0.75rem; background: rgba(4,2,3,0.6); display: grid; gap: 0.55rem; }
    .nc-preset-section-title { font-family: var(--font-display); font-size: 0.67rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-2); }
    .nc-preset-header-row { display: grid; grid-template-columns: 1fr 140px; gap: 0.55rem; }
    .nc-preset-segments { display: grid; gap: 0.4rem; }
    .nc-preset-segment-row { display: grid; grid-template-columns: 1fr 90px; gap: 0.5rem; }
    .nc-preset-add-row { display: grid; grid-template-columns: 1fr 120px; gap: 0.5rem; }
    .nc-preset-actions { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; }
    .nc-settings-toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; border: 1px solid var(--line-1); border-radius: var(--radius-sm); padding: 0.75rem; }
    .nc-settings-toggle-title { color: var(--text-1); font-weight: 600; font-size: 0.95rem; }
    .nc-settings-toggle-desc { color: var(--text-3); margin-top: 0.2rem; font-size: 0.85rem; }

    /* Misc */
    .nc-loading { display: flex; align-items: center; justify-content: center; padding: 3rem; font-family: var(--font-display); font-size: 0.78rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-3); }
    .nc-coming-soon { color: var(--text-3); font-family: var(--font-display); font-size: 0.75rem; letter-spacing: 0.16em; text-transform: uppercase; text-align: center; padding: 2.5rem; }
    .nc-no-items { color: var(--text-3); font-size: 0.9rem; }
    .nc-micro-groups-count { color: var(--text-3); font-size: 0.85rem; }

    @media (max-width: 960px) {
      .nc-log-top-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 680px) {
      .nc-targets-grid { grid-template-columns: 1fr; }
      .nc-entry-row { grid-template-columns: 1fr 1fr; }
      .nc-entry-row > button { grid-column: 1 / -1; }
      .nc-targets-macros-row { grid-template-columns: 1fr; }
      .nc-saved-meal-actions { grid-template-columns: 1fr; }
      .nc-custom-meal-add-row { grid-template-columns: 1fr 1fr; }
      .nc-custom-meal-add-row > button { grid-column: 1 / -1; }
      .nc-water-salt-grid { grid-template-columns: 1fr; }
      .nc-custom-meal-header-row { grid-template-columns: 1fr; }
    }
  `;

  if (loading) {
    return (
      <div className="nc-loading">
        <style>{CSS}</style>
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="nc-page">
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div className="nc-header">
        <div>
          <div className="nc-label-row">
            <div className="nc-accent-line" />
            <span className="nc-label-text">NUTRITION</span>
          </div>
          <h1 className="nc-page-title">Nutrition</h1>
        </div>
        <div className="nc-header-right">
          <div className="nc-tab-bar">
            <button type="button" onClick={() => setTab("log")} className={`nc-tab${tab === "log" ? " active" : ""}`}>LOG</button>
            <button type="button" onClick={() => setTab("goals")} className={`nc-tab${tab === "goals" ? " active" : ""}`}>GOALS</button>
            <button type="button" onClick={() => setTab("meal_plan")} className={`nc-tab${tab === "meal_plan" ? " active" : ""}`}>MEAL PLAN</button>
            <button type="button" onClick={() => setTab("settings")} className={`nc-tab${tab === "settings" ? " active" : ""}`}>SETTINGS</button>
          </div>
          <span className={`nc-save-status${saving ? " saving" : ""}`}>
            {saving ? "SAVING..." : lastSavedAt ? `SAVED ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast?.message ? (
        <div className={`nc-toast${toast.type === "warning" ? " warn" : ""}`}>
          {toast.message}
        </div>
      ) : null}

      {/* ── Error ── */}
      {error && <div className="nc-error">{error}</div>}

      {/* ══════════════ LOG TAB ══════════════ */}
      {tab === "log" && (
        <div className="nc-log-grid">
          <div className="nc-log-top-row">
            {/* Food Log Card */}
            <div className="nc-card">
              <div className="nc-card-topbar">
                <span className="nc-card-code">NUT-LOG</span>
                <span className="nc-card-title">Food Log</span>
                <div className="nc-topbar-actions">
                  <button type="button" onClick={() => toggleSection("foodLog")} className="nc-collapse-btn">
                    {isCollapsed("foodLog") ? "EXPAND" : "COLLAPSE"}
                  </button>
                  <button type="button" onClick={saveLog} disabled={saving} className="nc-primary-btn">SAVE LOG</button>
                  <button
                    type="button"
                    onClick={() => {
                      setEntries([]);
                      setEntryFood(""); setEntryQty(""); setEntryUnit("g"); setEntryState("raw");
                      setEntryFoodId(null); setEntryUserFoodId(null); setEntryFoodLocked(false);
                      setFoodResults([]); setFoodDropdownOpen(false); setExpandedSavedMealRows({});
                    }}
                    className="nc-ghost-btn"
                  >CLEAR</button>
                </div>
              </div>

              <div className="nc-card-body">
                {!isCollapsed("foodLog") && (
                  <>
                    {/* Food search */}
                    <div className="nc-food-entry-section">
                      <div className="nc-food-search-wrap">
                        <input
                          value={entryFood}
                          onChange={(e) => { setEntryFood(e.target.value); setEntryFoodLocked(false); setEntryFoodId(null); setEntryUserFoodId(null); }}
                          onFocus={() => { if (!entryFoodLocked && foodResults.length > 0) setFoodDropdownOpen(true); }}
                          onBlur={() => setTimeout(() => setFoodDropdownOpen(false), 140)}
                          placeholder="e.g. rice, chicken breast"
                          className="nc-field"
                        />
                        {foodDropdownOpen && (foodSearching || foodResults.length > 0 || foodNoMatches) && (
                          <div className="nc-food-dropdown">
                            {foodSearching ? (
                              <div className="nc-food-no-results">Searching foods...</div>
                            ) : foodResults.length > 0 ? (
                              foodResults.map((r) => (
                                <button key={`${r.source}:${r.id}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectFoodResult(r)} className="nc-food-result">
                                  <div style={{ fontWeight: 700 }}>{r.name}{r.brand ? ` — ${r.brand}` : ""}</div>
                                </button>
                              ))
                            ) : (
                              <div className="nc-food-no-results">
                                {foodNoMatches ? "No matches found yet. Keep typing, or press Add to auto-resolve." : "No suggestions yet."}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="nc-entry-row">
                        <input value={entryQty} onChange={(e) => setEntryQty(e.target.value)} placeholder="Qty" inputMode="decimal" className="nc-field" />
                        <select value={entryUnit} onChange={(e) => setEntryUnit(e.target.value)} className="nc-field">
                          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <select value={entrySegment} onChange={(e) => setEntrySegment(e.target.value)} className="nc-field">
                          {activeSegments.map((seg) => <option key={seg.key} value={seg.key}>{seg.label}</option>)}
                        </select>
                        <button
                          type="button"
                          disabled={!String(entryFood || "").trim() || !isPositiveNumber(entryQty) || entryResolving}
                          onClick={addEntry}
                          className="nc-primary-btn"
                        >
                          {entryResolving ? "RESOLVING..." : "ADD"}
                        </button>
                      </div>
                    </div>

                    <div className="nc-log-sub-grid">
                      {/* Saved Meals */}
                      <div className="nc-sub-card">
                        <div className="nc-sub-card-header">
                          <span className="nc-sub-card-title">Saved Meals</span>
                          <button type="button" onClick={() => toggleSection("savedMeals")} className="nc-collapse-btn">
                            {isCollapsed("savedMeals") ? "EXPAND" : "COLLAPSE"}
                          </button>
                        </div>
                        {!isCollapsed("savedMeals") && (
                          <div className="nc-sub-card-body">
                            <div className="nc-saved-meal-actions">
                              <select value={savedMealSelection} onChange={(e) => setSavedMealSelection(e.target.value)} className="nc-field">
                                <option value="">Select saved meal</option>
                                {savedMeals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                              <button type="button" onClick={addSavedMealToLog} className="nc-ghost-btn">Add to log</button>
                              <button type="button" disabled={savingSavedMeal || !savedMealSelection} onClick={deleteSavedMeal} className="nc-ghost-btn">Delete</button>
                            </div>

                            <div className="nc-custom-meal-section">
                              <div className="nc-custom-meal-title">Build Custom Meal</div>
                              <div className="nc-custom-meal-header-row">
                                <input value={savedMealName} onChange={(e) => setSavedMealName(e.target.value)} placeholder="Meal name (e.g. Protein Oats)" className="nc-field" />
                                <select value={savedMealSegment} onChange={(e) => setSavedMealSegment(e.target.value)} className="nc-field">
                                  {activeSegments.map((seg) => <option key={seg.key} value={seg.key}>{seg.label}</option>)}
                                </select>
                              </div>
                              <div style={{ position: "relative" }}>
                                <input
                                  value={mealEntryFood}
                                  onChange={(e) => { setMealEntryFood(e.target.value); setMealEntryFoodLocked(false); setMealEntryFoodId(null); setMealEntryUserFoodId(null); }}
                                  onFocus={() => { if (!mealEntryFoodLocked && mealFoodResults.length > 0) setMealFoodDropdownOpen(true); }}
                                  onBlur={() => setTimeout(() => setMealFoodDropdownOpen(false), 140)}
                                  placeholder="Add food to custom meal..."
                                  className="nc-field"
                                />
                                {mealFoodDropdownOpen && (mealFoodSearching || mealFoodResults.length > 0 || mealFoodNoMatches) ? (
                                  <div className="nc-food-dropdown">
                                    {mealFoodSearching ? (
                                      <div className="nc-food-no-results">Searching foods...</div>
                                    ) : mealFoodResults.length > 0 ? (
                                      mealFoodResults.map((r) => (
                                        <button key={`${r.source}:${r.id}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectMealFoodResult(r)} className="nc-food-result">
                                          <div style={{ fontWeight: 700 }}>{r.name}{r.brand ? ` — ${r.brand}` : ""}</div>
                                        </button>
                                      ))
                                    ) : (
                                      <div className="nc-food-no-results">
                                        {mealFoodNoMatches ? "No matches found yet." : "No suggestions yet."}
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                              <div className="nc-custom-meal-add-row">
                                <input value={mealEntryQty} onChange={(e) => setMealEntryQty(e.target.value)} placeholder="Qty" inputMode="decimal" className="nc-field" />
                                <select value={mealEntryUnit} onChange={(e) => setMealEntryUnit(e.target.value)} className="nc-field">
                                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <button
                                  type="button"
                                  disabled={!String(mealEntryFood || "").trim() || !isPositiveNumber(mealEntryQty) || mealEntryResolving}
                                  onClick={addMealDraftEntry}
                                  className="nc-primary-btn"
                                >
                                  {mealEntryResolving ? "ADDING..." : "ADD"}
                                </button>
                              </div>
                              {mealDraftEntries.length === 0 ? (
                                <div className="nc-no-items">No foods in custom meal yet.</div>
                              ) : (
                                <div className="nc-meal-draft-list">
                                  {mealDraftEntries.map((it) => (
                                    <div key={it.id} className="nc-meal-draft-item">
                                      <div style={{ minWidth: 0 }}>
                                        <div className="nc-meal-draft-name">{it.food}</div>
                                        <div className="nc-meal-draft-qty">{it.qty}{it.unit}</div>
                                      </div>
                                      <button type="button" onClick={() => setMealDraftEntries((prev) => prev.filter((x) => x.id !== it.id))} className="nc-ghost-btn">Remove</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="nc-custom-meal-footer">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMealDraftEntries([]); setMealEntryFood(""); setMealEntryQty(""); setMealEntryUnit("g");
                                    setMealEntryFoodId(null); setMealEntryUserFoodId(null); setMealEntryFoodLocked(false);
                                    setMealFoodResults([]); setMealFoodDropdownOpen(false);
                                  }}
                                  className="nc-ghost-btn"
                                >Clear Meal</button>
                                <button
                                  type="button"
                                  disabled={savingSavedMeal || mealDraftEntries.length === 0 || !String(savedMealName || "").trim()}
                                  onClick={saveMealDraftAsMeal}
                                  className="nc-primary-btn"
                                >SAVE CUSTOM MEAL</button>
                              </div>
                            </div>

                            {selectedSavedMeal?.items?.length > 0 ? (
                              <div className="nc-saved-meal-preview">
                                {selectedSavedMeal.items.map((it, idx) => (
                                  <div key={`${selectedSavedMeal.id}-${idx}`} className="nc-saved-meal-item-row">
                                    <span className="nc-saved-meal-item-name">{it.food}</span> • {it.qty}{it.unit}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Logged Items */}
                      <div className="nc-sub-card">
                        <div className="nc-sub-card-header">
                          <span className="nc-sub-card-title">Logged Items</span>
                          <button type="button" onClick={() => toggleSection("logEntries")} className="nc-collapse-btn">
                            {isCollapsed("logEntries") ? "EXPAND" : "COLLAPSE"}
                          </button>
                        </div>
                        {!isCollapsed("logEntries") ? (
                          entries.length === 0 ? (
                            <div style={{ padding: "0.75rem" }} className="nc-no-items">No items yet.</div>
                          ) : (
                            <div className="nc-sub-card-body">
                              {displaySegments.map((seg) => {
                                const segRows = groupedRowsBySegment.get(seg.key) || [];
                                return (
                                  <div key={seg.key} className="nc-segment-block">
                                    <div className="nc-segment-label">{seg.label}</div>
                                    {segRows.length === 0 ? (
                                      <div className="nc-no-items">No items.</div>
                                    ) : (
                                      <div style={{ display: "grid", gap: "0.45rem" }}>
                                        {segRows.map((row) => {
                                          if (row.kind === "meal") {
                                            const expanded = Boolean(expandedSavedMealRows?.[row.mealId]);
                                            return (
                                              <div key={`meal-${row.mealId}`} className="nc-meal-group">
                                                <div className="nc-meal-group-header">
                                                  <div className="nc-meal-group-info">
                                                    <div className="nc-meal-group-name">{row.mealName}</div>
                                                    <div className="nc-meal-group-count">{row.items.length} foods</div>
                                                  </div>
                                                  <div className="nc-meal-group-actions">
                                                    <button type="button" onClick={() => setExpandedSavedMealRows((prev) => ({ ...(prev || {}), [row.mealId]: !expanded }))} className="nc-ghost-btn">
                                                      {expanded ? "Hide" : "Show"}
                                                    </button>
                                                    <button type="button" onClick={() => setEntries((prev) => prev.filter((x) => String(x.meal_instance_id || "") !== row.mealId))} className="nc-ghost-btn">
                                                      Remove meal
                                                    </button>
                                                  </div>
                                                </div>
                                                {expanded ? (
                                                  <div className="nc-meal-group-items">
                                                    {row.items.map((it) => (
                                                      <div key={it.id} className="nc-meal-sub-item">
                                                        <div style={{ minWidth: 0 }}>
                                                          <div style={{ color: "var(--text-1)", fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.food}</div>
                                                          <div style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>{it.qty}{it.unit}</div>
                                                        </div>
                                                        <button type="button" onClick={() => setEntries((prev) => prev.filter((x) => x.id !== it.id))} className="nc-ghost-btn">Remove</button>
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : null}
                                              </div>
                                            );
                                          }
                                          const it = row.item;
                                          return (
                                            <div key={it.id} className="nc-log-item">
                                              <div className="nc-log-item-info">
                                                <div className="nc-log-item-name">{it.food}</div>
                                                <div className="nc-log-item-qty">{it.qty}{it.unit}</div>
                                              </div>
                                              <button type="button" onClick={() => setEntries((prev) => prev.filter((x) => x.id !== it.id))} className="nc-ghost-btn">Remove</button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )
                        ) : null}
                      </div>

                      {/* Notes */}
                      <div className="nc-sub-card">
                        <div className="nc-sub-card-header">
                          <span className="nc-sub-card-title">Notes</span>
                          <button type="button" onClick={() => toggleSection("notes")} className="nc-collapse-btn">
                            {isCollapsed("notes") ? "EXPAND" : "COLLAPSE"}
                          </button>
                        </div>
                        {!isCollapsed("notes") ? (
                          <div className="nc-sub-card-body">
                            <textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder="Anything useful to remember today..." className="nc-textarea" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Day Controls Card */}
            <div className="nc-card">
              <div className="nc-card-topbar">
                <span className="nc-card-code">NUT-DAY</span>
                <span className="nc-card-title">Day Controls</span>
              </div>
              <div className="nc-card-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <span style={{ color: "var(--text-3)", fontFamily: "var(--font-display)", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>Day type</span>
                  <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                    <button type="button" onClick={() => toggleSection("dayControls")} className="nc-collapse-btn">
                      {isCollapsed("dayControls") ? "EXPAND" : "COLLAPSE"}
                    </button>
                    <select value={todayType} onChange={(e) => saveTodayType(e.target.value)} className="nc-field" style={{ width: "150px" }}>
                      <option value="training">Training day</option>
                      <option value="rest">Rest day</option>
                      <option value="high">High day</option>
                    </select>
                  </div>
                </div>

                {!isCollapsed("dayControls") ? (
                  <>
                    <div className="nc-day-readouts">
                      <div className="nc-day-readout">
                        <div className="nc-day-readout-label">Calories</div>
                        <div className="nc-day-readout-value">{todaysTargets?.calories ?? "—"}</div>
                      </div>
                      <div className="nc-day-readout">
                        <div className="nc-day-readout-label">Protein</div>
                        <div className="nc-day-readout-value">{todaysTargets ? `${todaysTargets.protein_g}g` : "—"}</div>
                      </div>
                      <div className="nc-day-readout">
                        <div className="nc-day-readout-label">Carbs</div>
                        <div className="nc-day-readout-value">{todaysTargets ? `${todaysTargets.carbs_g}g` : "—"}</div>
                      </div>
                      <div className="nc-day-readout">
                        <div className="nc-day-readout-label">Fats</div>
                        <div className="nc-day-readout-value">{todaysTargets ? `${todaysTargets.fats_g}g` : "—"}</div>
                      </div>
                    </div>

                    <div className="nc-section-rule" />
                    <div className="nc-subsection-title">HYDRATION</div>
                    <div className="nc-water-salt-grid">
                      <div>
                        <label className="nc-field-label">Water (ml)</label>
                        <input type="number" value={waterMl} onChange={(e) => setWaterMl(clampInt(e.target.value, 0, 10000))} className="nc-field" />
                      </div>
                      <div>
                        <label className="nc-field-label">Salt (g)</label>
                        <input type="number" value={saltG} onChange={(e) => setSaltG(clampNumber(e.target.value, 0, 50, 2))} className="nc-field" />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Macros + Micros */}
          <div className="nc-macro-micro-grid">
            {/* Macronutrients */}
            <div className="nc-card">
              <div className="nc-card-topbar">
                <span className="nc-card-code">NUT-MAC</span>
                <span className="nc-card-title">Macronutrients</span>
                <div className="nc-topbar-actions">
                  <button type="button" onClick={() => toggleSection("dailyTotals")} className="nc-collapse-btn">
                    {isCollapsed("dailyTotals") ? "EXPAND" : "COLLAPSE"}
                  </button>
                </div>
              </div>
              <div className="nc-card-body">
                {!isCollapsed("dailyTotals") ? (
                  <>
                    <div className="nc-pill-bar">
                      {summarySegments.map((seg) => (
                        <button key={`macro-${seg.key}`} type="button" onClick={() => setSummarySegment(seg.key)} className={`nc-pill${summarySegment === seg.key ? " active" : ""}`}>
                          {seg.label}
                        </button>
                      ))}
                    </div>
                    <div className="nc-macro-bars">
                      {macroProgress.map((m) => {
                        const progress = pct(m.value, m.target || 0);
                        return (
                          <div key={m.key}>
                            <div className="nc-macro-label-row">
                              <span>{m.label}</span>
                              <span className="nc-macro-val">{m.value}/{m.target || 0} {m.unit}</span>
                            </div>
                            <div className="nc-progress-track">
                              <div className="nc-progress-fill" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${m.color}, ${m.color}cc)` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="nc-macro-extra">
                      Alcohol: <span style={{ color: "var(--text-1)" }}>{round1(effectiveLogTotals.alcohol_g)}g</span> ({Math.round(Number(effectiveLogTotals.alcohol_g || 0) * 7)} kcal)
                    </div>
                    <div className="nc-pie-wrap">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={macroPieDisplayData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2}>
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
                              contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--line-1)", borderRadius: "var(--radius-sm)", color: "var(--text-1)" }}
                              itemStyle={{ color: "var(--text-1)" }}
                              labelStyle={{ color: "var(--text-1)" }}
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
            </div>

            {/* Micronutrients */}
            {showMicronutrientsSection ? (
              <div className="nc-card">
                <div className="nc-card-topbar">
                  <span className="nc-card-code">NUT-MIC</span>
                  <span className="nc-card-title">Micronutrients</span>
                  <div className="nc-topbar-actions">
                    <button type="button" onClick={() => toggleSection("micros")} className="nc-collapse-btn">
                      {isCollapsed("micros") ? "EXPAND" : "COLLAPSE"}
                    </button>
                    <span className="nc-micro-groups-count">{dayNutrientsLoading ? "Loading..." : `${visibleMicroRows.length} shown`}</span>
                  </div>
                </div>
                <div className="nc-card-body">
                  {!isCollapsed("micros") ? (
                    <>
                      <div className="nc-pill-bar">
                        {summarySegments.map((seg) => (
                          <button key={`micro-${seg.key}`} type="button" onClick={() => setSummarySegment(seg.key)} className={`nc-pill${summarySegment === seg.key ? " active" : ""}`}>
                            {seg.label}
                          </button>
                        ))}
                      </div>
                      <div className="nc-micro-controls">
                        <div className="nc-micro-control-row">
                          <span className="nc-micro-label">Target mode</span>
                          <select value={microTargetMode} onChange={(e) => saveMicroMode(e.target.value)} disabled={savingMicroTargets} className="nc-field" style={{ width: "180px", padding: "0.45rem" }}>
                            <option value="rdi">RDI</option>
                            <option value="bodyweight">Bodyweight</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        {microTargetWarnings.length > 0 ? (
                          <div className="nc-micro-warning">{microTargetWarnings[0]}</div>
                        ) : null}
                        <div className="nc-micro-control-row">
                          <span className="nc-micro-label">Group</span>
                          <select value={microGroupFilter} onChange={(e) => setMicroGroupFilter(e.target.value)} className="nc-field" style={{ width: "180px", padding: "0.45rem" }}>
                            <option value="all">All groups</option>
                            {microGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      </div>
                      {visibleMicroRows.length === 0 ? (
                        <div className="nc-no-items">
                          {summarySegment === "all" ? "No micronutrient data available yet." : `No micronutrient data in ${selectedSummaryLabel.toLowerCase()} yet.`}
                        </div>
                      ) : (
                        <div className="nc-micro-scroll">
                          {visibleMicroRows.map((n) => (
                            <div key={n.code} className="nc-micro-row">
                              <div className="nc-micro-label-row">
                                <div style={{ minWidth: 0, whiteSpace: "normal", lineHeight: 1.2 }}>
                                  <span className="nc-micro-name">{displayNutrientLabel(n.code, n.label)}</span>
                                  <span className="nc-micro-group-txt"> • {displayNutrientGroup(n.code, n.sort_group)}</span>
                                </div>
                                <div className="nc-micro-val">
                                  {formatNutrientAmount(n.amount)} {formatNutrientUnit(n.unit)}
                                  {" / "}
                                  {Number(n.target_amount || 0) > 0 ? `${formatNutrientAmount(n.target_amount)} ${formatNutrientUnit(n.unit)}` : "N/T"}
                                </div>
                              </div>
                              {microTargetMode === "custom" ? (
                                <div className="nc-micro-custom-input">
                                  <input
                                    type="number"
                                    value={microTargetDrafts[n.code] ?? 0}
                                    onChange={(e) => setMicroTargetDrafts((prev) => ({ ...prev, [n.code]: Math.max(0, Number(e.target.value || 0)) }))}
                                    className="nc-field"
                                    style={{ width: "130px", padding: "0.45rem" }}
                                  />
                                </div>
                              ) : null}
                              <div style={{ marginTop: "0.35rem" }} className="nc-progress-track">
                                <div
                                  className="nc-progress-fill"
                                  style={{
                                    width: `${Number(n.amount || 0) <= 0 ? 0 : Math.max(2, n.sliderPct)}%`,
                                    background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))"
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {microTargetMode === "custom" ? (
                        <div style={{ marginTop: "0.7rem", display: "flex", justifyContent: "flex-end" }}>
                          <button type="button" onClick={saveCustomMicroTargets} disabled={savingMicroTargets} className="nc-primary-btn">
                            SAVE MICRO TARGETS
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ══════════════ GOALS TAB ══════════════ */}
      {tab === "goals" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="nc-targets-grid">
            {["training", "rest", "high"].map((dayType) => {
              const t = editTargets?.[dayType];
              if (!t) return null;
              const code = dayType === "training" ? "NUT-TRN" : dayType === "rest" ? "NUT-RST" : "NUT-HGH";
              return (
                <div key={dayType} className="nc-card">
                  <div className="nc-card-topbar">
                    <span className="nc-card-code">{code}</span>
                    <span className="nc-card-title">{dayLabel[dayType]}</span>
                  </div>
                  <div className="nc-card-body" style={{ display: "grid", gap: "0.75rem" }}>
                    <div>
                      <label className="nc-targets-field-label">Calories</label>
                      <input type="number" value={t.calories} onChange={(e) => updateEditField(dayType, "calories", e.target.value)} className="nc-field" />
                    </div>
                    <div className="nc-targets-macros-row">
                      <div>
                        <label className="nc-targets-field-label">Protein (g)</label>
                        <input type="number" value={t.protein_g} onChange={(e) => updateEditField(dayType, "protein_g", e.target.value)} className="nc-field" />
                      </div>
                      <div>
                        <label className="nc-targets-field-label">Carbs (g)</label>
                        <input type="number" value={t.carbs_g} onChange={(e) => updateEditField(dayType, "carbs_g", e.target.value)} className="nc-field" />
                      </div>
                      <div>
                        <label className="nc-targets-field-label">Fats (g)</label>
                        <input type="number" value={t.fats_g} onChange={(e) => updateEditField(dayType, "fats_g", e.target.value)} className="nc-field" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={saveTargets} className="nc-primary-btn">SAVE TARGETS</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MEAL PLAN TAB ══════════════ */}
      {tab === "meal_plan" && (
        <div className="nc-card">
          <div className="nc-card-topbar">
            <span className="nc-card-code">NUT-PLN</span>
            <span className="nc-card-title">Meal Plan</span>
          </div>
          <div className="nc-card-body">
            <div className="nc-coming-soon">Coming soon</div>
          </div>
        </div>
      )}

      {/* ══════════════ SETTINGS TAB ══════════════ */}
      {tab === "settings" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="nc-card">
            <div className="nc-card-topbar">
              <span className="nc-card-code">NUT-CFG</span>
              <span className="nc-card-title">Nutrition Settings</span>
            </div>
            <div className="nc-card-body" style={{ display: "grid", gap: "1rem" }}>
              {/* Meal Presets */}
              <div className="nc-preset-section">
                <div className="nc-preset-section-title">Meal Presets</div>
                <div className="nc-preset-header-row">
                  <select value={activePresetId} onChange={(e) => setActivePresetId(e.target.value)} className="nc-field">
                    {mealPresets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button type="button" onClick={resetPresetDraftToCurrent} className="nc-ghost-btn">Reset draft</button>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => { setPresetNameDraft(DEFAULT_PRESET_NAME); setPresetSegmentsDraft(DEFAULT_MEAL_SEGMENTS.map((seg) => ({ ...seg }))); }} className="nc-ghost-btn">
                    Use Standard template
                  </button>
                  <button type="button" onClick={() => { setPresetNameDraft(DEFAULT_CUSTOM_PRESET_NAME); setPresetSegmentsDraft(DEFAULT_CUSTOM_MEAL_SEGMENTS.map((seg) => ({ ...seg }))); }} className="nc-ghost-btn">
                    Use Custom template
                  </button>
                </div>
                <input value={presetNameDraft} onChange={(e) => setPresetNameDraft(e.target.value)} placeholder="Preset name" className="nc-field" />
                <div className="nc-preset-segments">
                  {presetSegmentsDraft.map((seg, idx) => (
                    <div key={`${seg.key}-${idx}`} className="nc-preset-segment-row">
                      <input
                        value={seg.label}
                        onChange={(e) => setPresetSegmentsDraft((prev) => prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row)))}
                        placeholder={`Segment ${idx + 1}`}
                        className="nc-field"
                      />
                      <button type="button" onClick={() => setPresetSegmentsDraft((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))} className="nc-ghost-btn">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="nc-preset-add-row">
                  <input value={newSegmentLabel} onChange={(e) => setNewSegmentLabel(e.target.value)} placeholder="Add segment..." className="nc-field" />
                  <button
                    type="button"
                    onClick={() => {
                      const label = String(newSegmentLabel || "").trim();
                      if (!label) return;
                      const key = normalizeSegmentKey(label);
                      if (presetSegmentsDraft.some((s) => normalizeSegmentKey(s.key) === key)) { setNewSegmentLabel(""); return; }
                      setPresetSegmentsDraft((prev) => [...prev, { key, label, position: prev.length + 1 }]);
                      setNewSegmentLabel("");
                    }}
                    className="nc-ghost-btn"
                  >Add segment</button>
                </div>
                <div className="nc-preset-actions">
                  <button type="button" disabled={savingPreset} onClick={() => upsertPreset({ createNew: true })} className="nc-ghost-btn">Create new</button>
                  <button type="button" disabled={savingPreset || !activePresetId} onClick={deleteActivePreset} className="nc-ghost-btn">Delete preset</button>
                  <button type="button" disabled={savingPreset} onClick={() => upsertPreset({ createNew: false })} className="nc-primary-btn">SAVE PRESET</button>
                </div>
              </div>

              {/* Micronutrient toggle */}
              <div className="nc-settings-toggle-row">
                <div>
                  <div className="nc-settings-toggle-title">Show micronutrients</div>
                  <div className="nc-settings-toggle-desc">Controls micronutrient sliders and targets in the log view.</div>
                </div>
                <button type="button" onClick={() => setShowMicronutrientsSection((prev) => !prev)} className={`nc-pill${showMicronutrientsSection ? " active" : ""}`}>
                  {showMicronutrientsSection ? "On" : "Off"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
