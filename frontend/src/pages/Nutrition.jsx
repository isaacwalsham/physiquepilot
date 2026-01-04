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

    const [targets, setTargets] = useState({
        training: null,
        rest: null,
        high: null
    });

    const [flex, setFlex] = useState(null);

    const [savingTarget, setSavingTarget] = useState(false);
    const [savingFlex, setSavingFlex] = useState(false);

    const ratioSaveTimersRef = useRef({});

    useEffect(() => {
        return () => {
            // cleanup any pending timers on unmount
            Object.values(ratioSaveTimersRef.current || {}).forEach((t) => {
                if (t) clearTimeout(t);
            });
        };
    }, []);

    // --- Bodyweight and macro ratios state ---
    const [weightKg, setWeightKg] = useState(null);

    // Macro ratios are grams per lb bodyweight. Stored per day type.
    // Defaults: protein 1.00 g/lb, carbs 1.00 g/lb, fats 0.30 g/lb
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

            // --- Begin Insert for todayType and profiles ---
            const todayIso = new Date().toISOString().slice(0, 10);

            const { data: pData } = await supabase
                .from("profiles")
                .select("training_days, today_day_type, today_day_type_date, current_weight_kg, nutrition_view_mode, show_meal_macros, show_day_macros")
                .eq("user_id", user.id)
                .maybeSingle();

            const trainingDays = Array.isArray(pData?.training_days) ? pData.training_days : [];
            const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const todayShort = dayMap[new Date().getDay()];
            const inferred = trainingDays.includes(todayShort) ? "training" : "rest";

            const storedType = pData?.today_day_type_date === todayIso ? pData?.today_day_type : null;
            setTodayType(storedType || inferred);
            if (pData?.current_weight_kg) setWeightKg(pData.current_weight_kg);
            // Prefer profile-stored nutrition UI prefs when present
            if (pData?.nutrition_view_mode) {
                setViewMode(pData.nutrition_view_mode);
            }
            if (typeof pData?.show_meal_macros === "boolean" || typeof pData?.show_day_macros === "boolean") {
                const perMeal = pData?.show_meal_macros === true;
                const perDay = pData?.show_day_macros === true;
                const nextDisplay = perMeal && perDay ? "both" : perMeal ? "per_meal" : perDay ? "per_day" : "none";
                setMacroDisplay(nextDisplay);
            }
            // --- End Insert for todayType and profiles ---

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
                setLoading(false);
                return;
            }

            setFlex(fData);
            setLoading(false);
        };

        load();
    }, []);

    // Persist macro ratios to localStorage

    useEffect(() => {
        try {
            localStorage.setItem("pp_macro_ratios_training", JSON.stringify(macroRatios.training));
            localStorage.setItem("pp_macro_ratios_rest", JSON.stringify(macroRatios.rest));
            localStorage.setItem("pp_macro_ratios_high", JSON.stringify(macroRatios.high));
        } catch {
            // ignore
        }
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
        try { localStorage.setItem("pp_nutrition_view_mode", next); } catch {}
        await persistNutritionPrefs(next, macroDisplay);
    };

    const setAndPersistMacroDisplay = async (next) => {
        setMacroDisplay(next);
        try { localStorage.setItem("pp_mealplan_macro_display", next); } catch {}
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

    // --- Bodyweight in lb and ratio application ---
    const weightLb = useMemo(() => {
        if (!weightKg) return null;
        const lb = kgToLb(weightKg);
        return Number.isFinite(lb) && lb > 0 ? lb : null;
    }, [weightKg]);

    const applyRatiosToDay = async (dayType, nextRatios) => {
        if (!userId) return;
        if (!weightLb) {
            setError("Set a current weight to use ratio sliders.");
            return;
        }

        const p = round0(nextRatios.protein * weightLb);
        const c = round0(nextRatios.carbs * weightLb);
        const f = round0(nextRatios.fats * weightLb);
        const calories = round0(p * 4 + c * 4 + f * 9);

        const current = targets[dayType] || {
            day_type: dayType,
            calories: 0,
            protein_g: 0,
            carbs_g: 0,
            fats_g: 0
        };

        const nextRow = { ...current, calories, protein_g: p, carbs_g: c, fats_g: f };
        setTargets((prev) => ({ ...prev, [dayType]: nextRow }));

        setSavingTarget(true);
        const payload = {
            user_id: userId,
            day_type: dayType,
            calories: nextRow.calories,
            protein_g: nextRow.protein_g,
            carbs_g: nextRow.carbs_g,
            fats_g: nextRow.fats_g
        };
        const { error: e } = await supabase
            .from("nutrition_day_targets")
            .upsert(payload, { onConflict: "user_id,day_type" });
        setSavingTarget(false);
        if (e) setError(e.message);
    };
    const updateRatio = (dayType, key, value) => {
        const clean = round2(value);
        const nextRatios = { ...macroRatios[dayType], [key]: clean };

        // Update UI immediately
        setMacroRatios((prev) => ({ ...prev, [dayType]: nextRatios }));

        // Debounce DB write + recalculation so the slider feels smooth
        const k = `${dayType}`;
        const existingTimer = ratioSaveTimersRef.current[k];
        if (existingTimer) clearTimeout(existingTimer);

        ratioSaveTimersRef.current[k] = setTimeout(() => {
            applyRatiosToDay(dayType, nextRatios);
        }, 350);
    };

    const updateTargetField = async (dayType, field, value) => {
        if (!userId) return;
        setError("");
        setSavingTarget(true);

        const clean = Math.max(0, Math.round(Number(value) || 0));

        const current = targets[dayType] || {
            day_type: dayType,
            calories: 0,
            protein_g: 0,
            carbs_g: 0,
            fats_g: 0
        };

        const nextRow = { ...current, [field]: clean };

        if (field === "protein_g" || field === "carbs_g" || field === "fats_g") {
            const p = Number(nextRow.protein_g || 0);
            const c = Number(nextRow.carbs_g || 0);
            const f = Number(nextRow.fats_g || 0);
            nextRow.calories = Math.max(0, Math.round(p * 4 + c * 4 + f * 9));
        }

        const next = {
            ...targets,
            [dayType]: nextRow
        };

        setTargets(next);

        const payload = {
            user_id: userId,
            day_type: dayType,
            calories: nextRow.calories,
            protein_g: nextRow.protein_g,
            carbs_g: nextRow.carbs_g,
            fats_g: nextRow.fats_g
        };

        const { error: e } = await supabase
            .from("nutrition_day_targets")
            .upsert(payload, { onConflict: "user_id,day_type" });

        setSavingTarget(false);

        if (e) {
            setError(e.message);
            return;
        }
    };

    const updateFlexField = async (field, value) => {
        if (!userId) return;
        setError("");
        setSavingFlex(true);

        const clean = Math.max(0, Math.round(Number(value) || 0));
        const next = { ...flex, [field]: clean };
        setFlex(next);

        const { error: e } = await supabase
            .from("weekly_flex_rules")
            .update({ [field]: clean })
            .eq("user_id", userId);

        setSavingFlex(false);

        if (e) {
            setError(e.message);
            return;
        }
    };

    const useCheatMeal = async () => {
        if (!flex || !userId) return;
        if (cheatsRemaining <= 0) return;

        const nextUsed = Number(flex.used_cheat_meals || 0) + 1;
        setFlex({ ...flex, used_cheat_meals: nextUsed });

        const { error: e } = await supabase
            .from("weekly_flex_rules")
            .update({ used_cheat_meals: nextUsed })
            .eq("user_id", userId);

        if (e) setError(e.message);
    };

    const saveTodayType = async (nextType) => {
        if (!userId) return;
        const todayIso = new Date().toISOString().slice(0, 10);
        setTodayType(nextType);
        const { error: e } = await supabase
            .from("profiles")
            .update({ today_day_type: nextType, today_day_type_date: todayIso })
            .eq("user_id", userId);
        if (e) setError(e.message);
    };

    const todaysTargets = targets[todayType];

    if (loading) return <div>Loading...</div>;

    const card = {
        background: "#1e1e1e",
        border: "1px solid #222",
        padding: "1rem"
    };

    const input = {
        width: "100%",
        padding: "0.6rem",
        background: "#111",
        color: "#fff",
        border: "1px solid #333"
    };

    return (
        <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                <div>
                    <h1 style={{ margin: 0 }}>Nutrition</h1>
                    <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
                        {viewMode === "macros"
                            ? "Daily targets can differ by training day, rest day, and high day."
                            : "Meal plans will be generated by the coach based on your targets and preferences."}
                    </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <div style={{ display: "flex", border: "1px solid #222", background: "#111" }}>
                    <button
                        type="button"
                        onClick={() => setAndPersistViewMode("macros")}
                        style={{
                            padding: "0.55rem 0.85rem",
                            background: viewMode === "macros" ? "#1e1e1e" : "transparent",
                            color: viewMode === "macros" ? "#fff" : "#aaa",
                            border: "none",
                            cursor: "pointer"
                        }}
                    >
                        Macros
                    </button>
                    <button
                        type="button"
                        onClick={() => setAndPersistViewMode("meal_plan")}
                        style={{
                            padding: "0.55rem 0.85rem",
                            background: viewMode === "meal_plan" ? "#1e1e1e" : "transparent",
                            color: viewMode === "meal_plan" ? "#fff" : "#aaa",
                            border: "none",
                            cursor: "pointer"
                        }}
                    >
                        Meal plan
                    </button>
                </div>

                    {viewMode === "meal_plan" && (
                        <select
                            value={macroDisplay}
                            onChange={(e) => setAndPersistMacroDisplay(e.target.value)}
                            style={{
                                background: "#111",
                                color: "#fff",
                                border: "1px solid #222",
                                padding: "0.55rem 0.7rem"
                            }}
                        >
                            <option value="none">Hide macros</option>
                            <option value="per_meal">Macros per meal</option>
                            <option value="per_day">Macros per day</option>
                            <option value="both">Macros per meal + day</option>
                        </select>
                    )}

                    <div style={{ color: "#666", minWidth: "70px", textAlign: "right" }}>
                        {savingTarget || savingFlex ? "Saving..." : "Saved"}
                    </div>
                </div>
            </div>

            {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

            {viewMode === "macros" && (
                <>
                    {/* Today card row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem", marginTop: "1rem" }}>
                        <div style={card}>
                            <div style={{ fontWeight: 700 }}>Today</div>
                            <div style={{ color: "#aaa", marginTop: "0.5rem" }}>Select the target you’re following today.</div>
                            <select
                                value={todayType}
                                onChange={(e) => saveTodayType(e.target.value)}
                                style={{ marginTop: "0.75rem", width: "100%", background: "#111", color: "#fff", border: "1px solid #333", padding: "0.6rem" }}
                            >
                                <option value="training">Training day</option>
                                <option value="rest">Rest day</option>
                                <option value="high">High day</option>
                            </select>
                            <div style={{ color: "#666", marginTop: "0.75rem", fontSize: "0.9rem" }}>
                                Default is inferred from your training days. You can override it for today.
                            </div>
                        </div>

                        <div style={card}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <div style={{ fontWeight: 700 }}>Today’s targets</div>
                                <div style={{ color: "#666" }}>{dayLabel[todayType]}</div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginTop: "0.9rem" }}>
                                <div>
                                    <div style={{ color: "#aaa" }}>Calories</div>
                                    <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todaysTargets?.calories ?? "—"}</div>
                                </div>
                                <div>
                                    <div style={{ color: "#aaa" }}>Protein</div>
                                    <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todaysTargets ? `${todaysTargets.protein_g}g` : "—"}</div>
                                </div>
                                <div>
                                    <div style={{ color: "#aaa" }}>Carbs</div>
                                    <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todaysTargets ? `${todaysTargets.carbs_g}g` : "—"}</div>
                                </div>
                                <div>
                                    <div style={{ color: "#aaa" }}>Fats</div>
                                    <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todaysTargets ? `${todaysTargets.fats_g}g` : "—"}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1.5rem" }}>
                        {["training", "rest", "high"].map((dayType) => {
                            const t = targets[dayType];
                            if (!t) return null;

                            return (
                                <div key={dayType} style={card}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                        <div style={{ fontWeight: 700 }}>{dayLabel[dayType]}</div>
                                        <div style={{ color: "#666" }}>{dayType === "high" ? "+ carbs day" : ""}</div>
                                    </div>

                                    <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.65rem" }}>
                                        <div>
                                            <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Calories</div>
                                            <input
                                                type="number"
                                                value={t.calories}
                                                onChange={(e) => updateTargetField(dayType, "calories", e.target.value)}
                                                style={input}
                                            />
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                                            <div>
                                                <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Protein (g)</div>
                                                <input
                                                    type="number"
                                                    value={t.protein_g}
                                                    onChange={(e) => updateTargetField(dayType, "protein_g", e.target.value)}
                                                    style={input}
                                                />
                                            </div>

                                            <div>
                                                <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Carbs (g)</div>
                                                <input
                                                    type="number"
                                                    value={t.carbs_g}
                                                    onChange={(e) => updateTargetField(dayType, "carbs_g", e.target.value)}
                                                    style={input}
                                                />
                                            </div>

                                            <div>
                                                <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Fats (g)</div>
                                                <input
                                                    type="number"
                                                    value={t.fats_g}
                                                    onChange={(e) => updateTargetField(dayType, "fats_g", e.target.value)}
                                                    style={input}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* --- Bodyweight macro ratio sliders --- */}
                                    <div style={{ borderTop: "1px solid #222", marginTop: "0.9rem", paddingTop: "0.9rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                            <div style={{ fontWeight: 700 }}>Ratios (g/lb)</div>
                                            <div style={{ color: "#666", fontSize: "0.9rem" }}>
                                                {weightLb ? `Using ~${Math.round(weightLb)} lb` : "Set current weight"}
                                            </div>
                                        </div>

                                        <div style={{ color: "#aaa", marginTop: "0.4rem", fontSize: "0.9rem" }}>
                                            Adjust in 0.05 g/lb steps. This updates grams + calories.
                                        </div>

                                        <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.7rem" }}>
                                            <div>
                                                <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: "0.9rem" }}>
                                                    <span>Protein</span>
                                                    <span>{macroRatios[dayType].protein.toFixed(2)} g/lb</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.60"
                                                    max="1.50"
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
                                                    min="0.25"
                                                    max="2.50"
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
                                                    min="0.15"
                                                    max="0.60"
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
                                        These are your day-type targets. The app will later apply them automatically based on your plan.
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                        <div style={card}>
                            <div style={{ fontWeight: 700 }}>Weekly flexibility</div>
                            <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
                                Cheat meals can be planned or used on any day. Banking is capped at +1.
                            </div>

                            {flex && (
                                <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
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

                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                        <div style={{ color: "#aaa" }}>
                                            Remaining this week: <span style={{ color: "#fff", fontWeight: 700 }}>{cheatsRemaining}</span>
                                        </div>

                                        <button
                                            onClick={useCheatMeal}
                                            disabled={cheatsRemaining <= 0}
                                            style={{
                                                padding: "0.55rem 0.9rem",
                                                background: cheatsRemaining <= 0 ? "transparent" : "#2a2a2a",
                                                color: cheatsRemaining <= 0 ? "#666" : "#fff",
                                                border: "1px solid #333",
                                                cursor: cheatsRemaining <= 0 ? "default" : "pointer"
                                            }}
                                        >
                                            Use 1 cheat meal
                                        </button>
                                    </div>

                                    <div style={{ color: "#666", fontSize: "0.9rem" }}>
                                        Week start: {flex.week_start}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={card}>
                            <div style={{ fontWeight: 700 }}>Alcohol tracking</div>
                            <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
                                Track UK units for the week. If this gets very high, the app will prompt you to reassess.
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
                </>
            )}

            {viewMode === "meal_plan" && (
                <div style={{ marginTop: "1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem" }}>
                        <div style={card}>
                            <div style={{ fontWeight: 700 }}>Today</div>
                            <div style={{ color: "#aaa", marginTop: "0.5rem" }}>Select the plan you’re following today.</div>
                            <select
                                value={todayType}
                                onChange={(e) => saveTodayType(e.target.value)}
                                style={{
                                    marginTop: "0.75rem",
                                    width: "100%",
                                    background: "#111",
                                    color: "#fff",
                                    border: "1px solid #333",
                                    padding: "0.6rem"
                                }}
                            >
                                <option value="training">Training day</option>
                                <option value="rest">Rest day</option>
                                <option value="high">High day</option>
                            </select>

                            <div style={{ color: "#666", marginTop: "0.75rem", fontSize: "0.9rem" }}>
                                Your meal plan will be generated from your targets and preferences.
                            </div>
                        </div>

                        <div style={card}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <div style={{ fontWeight: 700 }}>Today’s meal plan</div>
                                <div style={{ color: "#666" }}>{dayLabel[todayType]}</div>
                            </div>

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
                                        cursor: "not-allowed"
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
                                        cursor: "not-allowed"
                                    }}
                                >
                                    Regenerate
                                </button>
                            </div>

                            {macroDisplay !== "none" && (
                                <div style={{ marginTop: "1rem", borderTop: "1px solid #222", paddingTop: "1rem" }}>
                                    {macroDisplay !== "per_meal" && (
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
                                            <div>
                                                <div style={{ color: "#aaa" }}>Calories</div>
                                                <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todaysTargets?.calories ?? "—"}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: "#aaa" }}>Protein</div>
                                                <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todaysTargets ? `${todaysTargets.protein_g}g` : "—"}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: "#aaa" }}>Carbs</div>
                                                <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todaysTargets ? `${todaysTargets.carbs_g}g` : "—"}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: "#aaa" }}>Fats</div>
                                                <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todaysTargets ? `${todaysTargets.fats_g}g` : "—"}</div>
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
                </div>
            )}
        </div>
    );
}

export default Nutrition;