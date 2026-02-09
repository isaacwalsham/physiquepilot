import { useEffect, useMemo, useState } from "react";
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

const calcCalories = (p, c, f) => p * 4 + c * 4 + f * 9;

const UNIT_OPTIONS = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "l" },
  { value: "oz", label: "oz" },
  { value: "lb", label: "lb" },
  { value: "serv", label: "serv" }
];

const isPositiveNumber = (v) => {
  const n = Number(String(v || "").trim());
  return Number.isFinite(n) && n > 0;
};

export default function Nutrition() {
  const [tab, setTab] = useState("log");
  const [planTab, setPlanTab] = useState("targets");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState(null);

  const [todayType, setTodayType] = useState("rest");
  const [targets, setTargets] = useState({
    training: null,
    rest: null,
    high: null
  });

  const [logNotes, setLogNotes] = useState("");

  const [entryFood, setEntryFood] = useState("");
  const [entryQty, setEntryQty] = useState("");
  const [entryUnit, setEntryUnit] = useState("g");
  const [entryState, setEntryState] = useState("");
  const [entries, setEntries] = useState([]);

  const [entryFoodId, setEntryFoodId] = useState(null); // uuid of foods
  const [entryUserFoodId, setEntryUserFoodId] = useState(null); // uuid of user_foods
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState([]);
  const [foodSearching, setFoodSearching] = useState(false);
  const [foodDropdownOpen, setFoodDropdownOpen] = useState(false);

  const [dayNutrients, setDayNutrients] = useState([]); // [{code,label,unit,sort_group,sort_order,amount}]
  const [dayNutrientsLoading, setDayNutrientsLoading] = useState(false);

  const [logTotals, setLogTotals] = useState(null);
  const [logWarnings, setLogWarnings] = useState([]);

  const [waterMl, setWaterMl] = useState(0);
  const [saltG, setSaltG] = useState(0);

  const [editTargets, setEditTargets] = useState({
    training: null,
    rest: null,
    high: null
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) {
        setError(uErr.message);
        setLoading(false);
        return;
      }

      const user = userData?.user;
      if (!user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // Load today's saved log + items (so refresh doesn't wipe the UI)
      const todayIsoForLog = new Date().toISOString().slice(0, 10);
      const { data: logRow, error: logErr } = await supabase
        .from("daily_nutrition_logs")
        .select("calories, protein_g, carbs_g, fats_g, notes, water_ml, salt_g")
        .eq("user_id", user.id)
        .eq("log_date", todayIsoForLog)
        .maybeSingle();

      if (!logErr && logRow) {
        setLogTotals({
          calories: logRow.calories ?? 0,
          protein_g: logRow.protein_g ?? 0,
          carbs_g: logRow.carbs_g ?? 0,
          fats_g: logRow.fats_g ?? 0
        });
        setLogNotes(logRow.notes ?? "");
        setWaterMl(Number.isFinite(Number(logRow.water_ml)) ? Number(logRow.water_ml) : 0);
        setSaltG(logRow.salt_g == null ? 0 : Number(logRow.salt_g));
      }

      const { data: itemRows, error: itemsErr } = await supabase
        .from("daily_nutrition_items")
        .select("id, food_name, amount, unit, cooked_state, food_id, user_food_id")
        .eq("user_id", user.id)
        .eq("log_date", todayIsoForLog)
        .order("created_at", { ascending: true });

      if (!itemsErr && Array.isArray(itemRows) && itemRows.length > 0) {
        setEntries(
          itemRows.map((r) => ({
            id: r.id,
            food: r.food_name,
            qty: Number(r.amount),
            unit: r.unit,
            state: r.cooked_state,
            food_id: r.food_id ?? null,
            user_food_id: r.user_food_id ?? null
          }))
        );
      }

      await loadDayNutrients(user.id, todayIsoForLog);
  const normalizeFoodResult = (row, kind) => {
    const name = String(row?.name || "").trim();
    const brand = String(row?.brand || "").trim();
    const label = brand ? `${name} — ${brand}` : name;
    return {
      kind, // 'food' | 'user_food'
      id: row.id,
      name,
      brand: brand || null,
      label
    };
  };

  const searchFoods = async (uid, term) => {
    const q = String(term || "").trim();
    if (!q) {
      setFoodResults([]);
      setFoodDropdownOpen(false);
      return;
    }

    setFoodSearching(true);
    try {
      // Simple ilike-based search (no pg_trgm required). We do two queries and merge.
      const limit = 8;

      const { data: globalFoods, error: gfErr } = await supabase
        .from("foods")
        .select("id, name, brand")
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(limit);

      if (gfErr) throw gfErr;

      const { data: userFoods, error: ufErr } = await supabase
        .from("user_foods")
        .select("id, name, brand")
        .eq("user_id", uid)
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(limit);

      if (ufErr) throw ufErr;

      const merged = [
        ...(Array.isArray(userFoods) ? userFoods.map((r) => normalizeFoodResult(r, "user_food")) : []),
        ...(Array.isArray(globalFoods) ? globalFoods.map((r) => normalizeFoodResult(r, "food")) : [])
      ];

      // Deduplicate by (kind,id)
      const seen = new Set();
      const deduped = [];
      for (const it of merged) {
        const k = `${it.kind}:${it.id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        deduped.push(it);
      }

      setFoodResults(deduped);
      setFoodDropdownOpen(true);
    } catch (e) {
      // Don't hard-fail the page for search errors
      console.error(e);
      setFoodResults([]);
      setFoodDropdownOpen(false);
    } finally {
      setFoodSearching(false);
    }
  };

  const pickFoodResult = (res) => {
    if (!res) return;
    setEntryFood(res.label || res.name || "");
    setFoodQuery(res.label || res.name || "");
    setFoodDropdownOpen(false);

    if (res.kind === "food") {
      setEntryFoodId(res.id);
      setEntryUserFoodId(null);
    } else {
      setEntryUserFoodId(res.id);
      setEntryFoodId(null);
    }
  };

  const loadDayNutrients = async (uid, isoDate) => {
    if (!uid || !isoDate) return;
    setDayNutrientsLoading(true);
    try {
      // Join via FK item_id -> daily_nutrition_items.id. Filter through embedded inner join.
      const { data, error: nErr } = await supabase
        .from("daily_nutrition_item_nutrients")
        .select(
          "nutrient_code, amount, nutrients(label, unit, sort_group, sort_order), daily_nutrition_items!inner(user_id, log_date)"
        )
        .eq("daily_nutrition_items.user_id", uid)
        .eq("daily_nutrition_items.log_date", isoDate);

      if (nErr) throw nErr;

      const map = new Map();
      for (const row of data || []) {
        const code = row?.nutrient_code;
        if (!code) continue;
        const meta = row?.nutrients || {};
        const prev = map.get(code) || {
          code,
          label: meta.label || code,
          unit: meta.unit || "",
          sort_group: meta.sort_group || "Other",
          sort_order: Number.isFinite(Number(meta.sort_order)) ? Number(meta.sort_order) : 9999,
          amount: 0
        };
        prev.amount += Number(row?.amount || 0);
        map.set(code, prev);
      }

      const arr = Array.from(map.values()).sort((a, b) => {
        if (a.sort_group !== b.sort_group) return String(a.sort_group).localeCompare(String(b.sort_group));
        return (a.sort_order || 0) - (b.sort_order || 0);
      });

      setDayNutrients(arr);

      // Also keep the old macro totals display in sync if we can.
      const byCode = (c) => arr.find((x) => x.code === c)?.amount ?? 0;
      const calories = Math.round(byCode("energy_kcal"));
      const protein = Math.round(byCode("protein_g"));
      const carbs = Math.round(byCode("carbs_g"));
      const fats = Math.round(byCode("fat_g"));
      if (calories || protein || carbs || fats) {
        setLogTotals({ calories, protein_g: protein, carbs_g: carbs, fats_g: fats });
      }
    } catch (e) {
      console.error(e);
      // keep existing UI; just clear nutrient list
      setDayNutrients([]);
    } finally {
      setDayNutrientsLoading(false);
    }
  };

      // Read profile to infer today type (fallback rest)
      const todayIso = new Date().toISOString().slice(0, 10);
      const { data: pData, error: pErr } = await supabase
        .from("profiles")
        .select("training_days, today_day_type, today_day_type_date")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pErr) {
        setError(pErr.message);
        setLoading(false);
        return;
      }

      const trainingDays = Array.isArray(pData?.training_days) ? pData.training_days : [];
      const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const todayShort = dayMap[new Date().getDay()];
      const inferred = trainingDays.includes(todayShort) ? "training" : "rest";
      const storedType = pData?.today_day_type_date === todayIso ? pData?.today_day_type : null;
      setTodayType(storedType || inferred);

      // Read targets
      const { data: tData, error: tErr } = await supabase
        .from("nutrition_day_targets")
        .select("day_type, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", user.id);

      if (tErr) {
        setError(tErr.message);
        setLoading(false);
        return;
      }

      if (!tData || tData.length === 0) {
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

        const { data: tData2, error: tErr2 } = await supabase
          .from("nutrition_day_targets")
          .select("day_type, calories, protein_g, carbs_g, fats_g")
          .eq("user_id", user.id);

        if (tErr2) {
          setError(tErr2.message);
          setLoading(false);
          return;
        }

        const mapped2 = {
          training: { day_type: "training", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
          rest: { day_type: "rest", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
          high: { day_type: "high", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
        };
        (tData2 || []).forEach((row) => {
          if (row?.day_type && mapped2[row.day_type]) mapped2[row.day_type] = row;
        });
        setTargets(mapped2);
        setEditTargets({
          training: { ...mapped2.training },
          rest: { ...mapped2.rest },
          high: { ...mapped2.high }
        });

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
      setEditTargets({
        training: { ...mapped.training },
        rest: { ...mapped.rest },
        high: { ...mapped.high }
      });

      setLoading(false);
    };

    load();
  }, []);

  const todaysTargets = useMemo(() => {
    return targets?.[todayType] || null;
  }, [targets, todayType]);

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

  const updateEditField = (dayType, field, value) => {
    const maxCalories = 6000;
    const minCalories = 800;

    const maxProtein = 400;
    const maxCarbs = 800;
    const maxFats = 250;

    setEditTargets((prev) => {
      const cur = prev?.[dayType];
      if (!cur) return prev;

      const next = { ...cur };

      if (field === "calories") next.calories = clampInt(value, minCalories, maxCalories);
      if (field === "protein_g") next.protein_g = clampInt(value, 0, maxProtein);
      if (field === "carbs_g") next.carbs_g = clampInt(value, 0, maxCarbs);
      if (field === "fats_g") next.fats_g = clampInt(value, 0, maxFats);

      if (field === "protein_g" || field === "carbs_g" || field === "fats_g") {
        next.calories = clampInt(calcCalories(next.protein_g, next.carbs_g, next.fats_g), minCalories, maxCalories);
      }

      return { ...prev, [dayType]: next };
    });
  };

  const saveTargets = async () => {
    if (!userId) return;
    setError("");
    setSaving(true);

    try {
      const rows = ["training", "rest", "high"].map((dayType) => {
        const t = editTargets[dayType];
        return {
          user_id: userId,
          day_type: dayType,
          calories: t?.calories ?? 0,
          protein_g: t?.protein_g ?? 0,
          carbs_g: t?.carbs_g ?? 0,
          fats_g: t?.fats_g ?? 0
        };
      });

      const { error: e } = await supabase
        .from("nutrition_day_targets")
        .upsert(rows, { onConflict: "user_id,day_type" });

      if (e) {
        setError(e.message);
        setSaving(false);
        return;
      }

      const mapped = {
        training: { ...rows[0], day_type: "training" },
        rest: { ...rows[1], day_type: "rest" },
        high: { ...rows[2], day_type: "high" }
      };
      setTargets(mapped);
      setSaving(false);
    } catch (err) {
      setError(String(err?.message || err));
      setSaving(false);
    }
  };

  const saveLog = async () => {
    if (!userId) return;
    setError("");
    setSaving(true);

    const todayIso = new Date().toISOString().slice(0, 10);

    try {
      const r = await fetch(`${API_URL}/api/nutrition/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          log_date: todayIso,
          notes: logNotes || null,
          water_ml: waterMl || 0,
          salt_g: saltG || 0,
          items: (entries || []).map((it) => ({
            ...it,
            food_id: it.food_id ?? null,
            user_food_id: it.user_food_id ?? null
          }))
        })
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        setError(j?.error || "Failed to save nutrition log.");
        setSaving(false);
        return;
      }

      setLogTotals({
        calories: j.calories ?? 0,
        protein_g: j.protein_g ?? 0,
        carbs_g: j.carbs_g ?? 0,
        fats_g: j.fats_g ?? 0
      });
      setLogWarnings(Array.isArray(j.warnings) ? j.warnings : []);

      await loadDayNutrients(userId, todayIso);

      setSaving(false);
    } catch (err) {
      setError(String(err?.message || err));
      setSaving(false);
    }
  };

  const card = {
    background: "#1e1e1e",
    border: "1px solid #222",
    padding: "1rem",
    borderRadius: "10px"
  };

  const field = {
    width: "100%",
    padding: "0.65rem",
    background: "#111",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "10px"
  };

  const tabBtn = (active) => ({
    padding: "0.6rem 0.9rem",
    border: "1px solid #222",
    background: active ? "#1e1e1e" : "transparent",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer",
    borderRadius: "10px"
  });

  const shell = {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: "1rem",
    alignItems: "start"
  };

  const sidebarCard = {
    ...card,
    position: "sticky",
    top: "0.75rem",
    zIndex: 5
  };

  const pill = (active) => ({
    padding: "0.4rem 0.65rem",
    borderRadius: "999px",
    border: "1px solid #333",
    background: active ? "#2a2a2a" : "transparent",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer",
    fontSize: "0.9rem"
  });

  const primaryBtn = (disabled) => ({
    padding: "0.65rem 1rem",
    background: disabled ? "transparent" : "#2a2a2a",
    color: disabled ? "#666" : "#fff",
    border: "1px solid #333",
    borderRadius: "10px",
    cursor: disabled ? "default" : "pointer"
  });

  const subtleBtn = {
    padding: "0.55rem 0.8rem",
    background: "transparent",
    color: "#aaa",
    border: "1px solid #333",
    borderRadius: "10px",
    cursor: "pointer"
  };

  if (loading) return <div style={{ padding: "1rem" }}>Loading...</div>;

  return (
    <div className="nutrition-page" style={{ width: "100%" }}>
      <div
        className="nutrition-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Nutrition</h1>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>Log daily. Plan your targets and (soon) generate meal plans.</div>
        </div>

        <div className="nutrition-tabs" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="button" onClick={() => setTab("log")} style={tabBtn(tab === "log")}>
            Log
          </button>
          <button type="button" onClick={() => setTab("plan")} style={tabBtn(tab === "plan")}>
            Plan
          </button>
          <div style={{ color: "#666", minWidth: "90px", textAlign: "right" }}>{saving ? "Saving..." : "Saved"}</div>
        </div>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

      <div className="nutrition-shell nutrition-log-grid" style={{ ...shell, marginTop: "1rem" }}>
        {/* MAIN */}
        <div className="nutrition-main" style={{ minWidth: 0 }}>
          {tab === "log" && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Food log</div>
                    <div style={{ color: "#aaa", marginTop: "0.35rem" }}>
                      Log your food by typing it.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEntries([]);
                      setEntryFood("");
                      setEntryQty("");
                      setEntryUnit("g");
                      setEntryState("");
                      setFoodQuery("");
                      setEntryFoodId(null);
                      setEntryUserFoodId(null);
                      setFoodResults([]);
                      setFoodDropdownOpen(false);
                    }}
                    style={subtleBtn}
                  >
                    Clear
                  </button>
                </div>

                <div
                  className="nutrition-entry-row"
                  style={{
                    marginTop: "0.9rem",
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 120px 110px 170px 120px",
                    gap: "0.6rem",
                    alignItems: "center"
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <input
                      className="nutrition-entry-food"
                      value={foodQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFoodQuery(v);
                        setEntryFood(v);
                        setEntryFoodId(null);
                        setEntryUserFoodId(null);
                        if (String(v || "").trim().length >= 2 && userId) {
                          searchFoods(userId, v);
                        } else {
                          setFoodResults([]);
                          setFoodDropdownOpen(false);
                        }
                      }}
                      onFocus={() => {
                        if (foodResults.length > 0) setFoodDropdownOpen(true);
                      }}
                      onBlur={() => {
                        // allow click selection
                        setTimeout(() => setFoodDropdownOpen(false), 150);
                      }}
                      placeholder="e.g. rice, chicken breast, olive oil"
                      style={field}
                    />

                    {foodDropdownOpen && (foodSearching || foodResults.length > 0) && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          right: 0,
                          background: "#111",
                          border: "1px solid #333",
                          borderRadius: "10px",
                          zIndex: 20,
                          overflow: "hidden"
                        }}
                      >
                        {foodSearching ? (
                          <div style={{ padding: "0.65rem", color: "#888" }}>Searching…</div>
                        ) : (
                          foodResults.map((r) => (
                            <button
                              key={`${r.kind}:${r.id}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickFoodResult(r)}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "0.65rem",
                                background: "transparent",
                                border: "none",
                                color: "#fff",
                                cursor: "pointer"
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{r.label}</div>
                              <div style={{ color: "#666", fontSize: "0.85rem", marginTop: "0.15rem" }}>
                                {r.kind === "user_food" ? "Your food" : "Global food"}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <input value={entryQty} onChange={(e) => setEntryQty(e.target.value)} placeholder="Qty" inputMode="decimal" style={field} />

                  <select value={entryUnit} onChange={(e) => setEntryUnit(e.target.value)} style={field}>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>

                  <div className="nutrition-entry-state" style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-start" }}>
                    <button type="button" onClick={() => setEntryState("raw")} style={pill(entryState === "raw")}>
                      Raw
                    </button>
                    <button type="button" onClick={() => setEntryState("cooked")} style={pill(entryState === "cooked")}>
                      Cooked
                    </button>
                  </div>

                  <button
                    className="nutrition-entry-add"
                    type="button"
                    disabled={!String(entryFood || "").trim() || !isPositiveNumber(entryQty) || !entryState}
                    onClick={() => {
                      const qty = Number(String(entryQty).trim());
                      if (!String(entryFood || "").trim() || !Number.isFinite(qty) || qty <= 0 || !entryState) return;

                      setEntries((prev) => [
                        ...prev,
                        {
                          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                          food: String(entryFood).trim(),
                          qty,
                          unit: entryUnit,
                          state: entryState,
                          food_id: entryFoodId,
                          user_food_id: entryUserFoodId
                        }
                      ]);

                      setEntryFood("");
                      setEntryQty("");
                      setEntryUnit("g");
                      setEntryState("");
                      setFoodQuery("");
                      setEntryFoodId(null);
                      setEntryUserFoodId(null);
                      setFoodResults([]);
                      setFoodDropdownOpen(false);
                    }}
                    style={primaryBtn(!String(entryFood || "").trim() || !isPositiveNumber(entryQty) || !entryState)}
                  >
                    Add
                  </button>
                </div>

                <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.6rem" }}>
                  Tip: you’ll be able to paste multi-items ("50g rice, 100g chicken") once the parser is wired up.
                </div>

                <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
                  {entries.length === 0 ? (
                    <div style={{ color: "#666" }}>No items yet.</div>
                  ) : (
                    entries.map((it) => (
                      <div
                        key={it.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.65rem 0.75rem",
                          border: "1px solid #2a2a2a",
                          borderRadius: "10px",
                          background: "#151515"
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.food}</div>
                          <div style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                            {it.qty}
                            {it.unit} • {it.state === "raw" ? "Raw" : "Cooked"}
                          </div>
                        </div>

                        <button type="button" onClick={() => setEntries((prev) => prev.filter((x) => x.id !== it.id))} style={subtleBtn}>
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: "1rem", display: "grid", gap: "0.6rem" }}>
                  <div style={{ color: "#aaa" }}>Notes </div>
                  <textarea
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    placeholder="Anything you want to remember about today…"
                    style={{ ...field, minHeight: "110px", resize: "vertical" }}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={saveLog} disabled={saving} style={primaryBtn(saving)}>
                      Save log
                    </button>
                  </div>

                  <div style={{ color: "#666", fontSize: "0.9rem" }}>
                    Save log estimates calories + macros from your items and stores today’s totals.
                  </div>
                </div>
              </div>

              <div className="nutrition-macro-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
                <div style={card}>
                  <div style={{ fontWeight: 800 }}>Macros</div>
                  {logTotals ? (
                    <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.35rem", color: "#aaa" }}>
                      <div>
                        <b style={{ color: "#fff" }}>{logTotals.calories}</b> kcal
                      </div>
                      <div>
                        P: <b style={{ color: "#fff" }}>{logTotals.protein_g}</b>g
                      </div>
                      <div>
                        C: <b style={{ color: "#fff" }}>{logTotals.carbs_g}</b>g
                      </div>
                      <div>
                        F: <b style={{ color: "#fff" }}>{logTotals.fats_g}</b>g
                      </div>
                      {dayNutrients.length > 0 && (
                        <div style={{ marginTop: "0.35rem", color: "#666", fontSize: "0.9rem" }}>
                          {(() => {
                            const by = (c) => dayNutrients.find((x) => x.code === c)?.amount;
                            const fiber = by("fiber_g");
                            const sugars = by("sugars_g");
                            const net = by("net_carbs_g");
                            return (
                              <div style={{ display: "grid", gap: "0.2rem" }}>
                                {fiber != null && <div>Fibre: {Math.round(fiber * 10) / 10}g</div>}
                                {sugars != null && <div>Sugars: {Math.round(sugars * 10) / 10}g</div>}
                                {net != null && <div>Net carbs: {Math.round(net * 10) / 10}g</div>}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {logWarnings?.length > 0 && (
                        <div style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                          {logWarnings.map((w, idx) => (
                            <div key={idx}>• {w}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: "#666", marginTop: "0.5rem" }}>Save your log to calculate macros.</div>
                  )}
                  {/* mount point for a future chart */}
                  <div className="nutrition-macros-chart" style={{ marginTop: "0.85rem" }} />
                </div>
                <div style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800 }}>Micros</div>
                    <div style={{ color: "#666", fontSize: "0.9rem" }}>{dayNutrientsLoading ? "Loading…" : ""}</div>
                  </div>

                  {dayNutrients.length === 0 ? (
                    <div style={{ color: "#666", marginTop: "0.5rem" }}>Save your log to see micronutrients.</div>
                  ) : (
                    <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem" }}>
                      {Array.from(
                        dayNutrients
                          .filter((n) => !["energy_kcal", "protein_g", "carbs_g", "fat_g"].includes(n.code))
                          .reduce((acc, n) => {
                            const key = n.sort_group || "Other";
                            if (!acc.has(key)) acc.set(key, []);
                            acc.get(key).push(n);
                            return acc;
                          }, new Map())
                      ).map(([group, items]) => (
                        <div key={group} style={{ border: "1px solid #2a2a2a", borderRadius: "10px", padding: "0.65rem", background: "#151515" }}>
                          <div style={{ fontWeight: 800, marginBottom: "0.35rem" }}>{group}</div>
                          <div style={{ display: "grid", gap: "0.25rem", color: "#aaa", fontSize: "0.95rem" }}>
                            {items
                              .slice()
                              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                              .map((n) => (
                                <div key={n.code} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                                  <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</div>
                                  <div style={{ color: "#fff", flexShrink: 0 }}>
                                    {Math.round((Number(n.amount) || 0) * 100) / 100} {n.unit}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "plan" && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div className="nutrition-plan-tabs nutrition-plan-subtabs" style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={() => setPlanTab("targets")} style={tabBtn(planTab === "targets")}>
                  Targets
                </button>
                <button type="button" onClick={() => setPlanTab("meal_plan")} style={tabBtn(planTab === "meal_plan")}>
                  Meal plan
                </button>
              </div>

              {planTab === "targets" && (
                <div className="nutrition-targets-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
                  {["training", "rest", "high"].map((dayType) => {
                    const t = editTargets?.[dayType];
                    if (!t) return null;

                    return (
                      <div key={dayType} style={card}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <div style={{ fontWeight: 800 }}>{dayLabel[dayType]}</div>
                          <div style={{ color: "#666" }}>{dayType === "high" ? "+ carbs day" : ""}</div>
                        </div>

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

                          <div style={{ color: "#666", fontSize: "0.9rem" }}>Calories auto-sync to macros (to satisfy your DB constraints). Saving is manual.</div>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={saveTargets} style={primaryBtn(false)}>
                      Save targets
                    </button>
                  </div>
                </div>
              )}

              {planTab === "meal_plan" && (
                <div style={card}>
                  <div style={{ fontWeight: 800 }}>Meal plan</div>
                  <div style={{ color: "#aaa", marginTop: "0.5rem" }}>Next step: generate meals based on today’s targets, preferences, and training time.</div>
                  <div style={{ marginTop: "1rem", color: "#666" }}>
                    Placeholder for now — we’ll implement the meal blocks + alternatives after the logging and targets flows are solid.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="nutrition-sidebar" style={{ minWidth: 0 }}>
          <div className="nutrition-sidebar-card nutrition-sticky" style={sidebarCard}>
            <div className="nutrition-sticky-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <div>
                <div style={{ fontWeight: 800 }}>Today’s target</div>
                <div style={{ color: "#666", marginTop: "0.25rem" }}>{dayLabel[todayType] || "Today"}</div>
              </div>

              <select value={todayType} onChange={(e) => saveTodayType(e.target.value)} style={{ ...field, width: "170px" }}>
                <option value="training">Training day</option>
                <option value="rest">Rest day</option>
                <option value="high">High day</option>
              </select>
            </div>

            <div
              className="nutrition-sidebar-targets-grid nutrition-sticky-grid"
              style={{ marginTop: "0.85rem", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}
            >
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

            <div style={{ height: "1px", background: "#2a2a2a", margin: "0.9rem 0" }} />

            <div>
              <div style={{ fontWeight: 800 }}>Water & salt</div>
              <div style={{ color: "#aaa", marginTop: "0.35rem" }}></div>

              <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.75rem" }}>
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
      </div>
    </div>
  );
}