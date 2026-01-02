import { useEffect, useMemo, useState } from "react";

import { supabase } from "../supabaseClient";

const API_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? "https://physiquepilot.onrender.com" : "http://localhost:4000");

const dayLabel = {
    training: "Training day",
    rest: "Rest day",
    high: "High day"
};

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

            const mapped = { training: null, rest: null, high: null };
            (tData || []).forEach((row) => {
                mapped[row.day_type] = row;
            });
            setTargets(mapped);

            // --- Begin Insert for todayType and profiles ---
            const todayIso = new Date().toISOString().slice(0, 10);

            const { data: pData } = await supabase
                .from("profiles")
                .select("training_days, today_day_type, today_day_type_date")
                .eq("user_id", user.id)
                .maybeSingle();

            const trainingDays = Array.isArray(pData?.training_days) ? pData.training_days : [];
            const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const todayShort = dayMap[new Date().getDay()];
            const inferred = trainingDays.includes(todayShort) ? "training" : "rest";

            const storedType = pData?.today_day_type_date === todayIso ? pData?.today_day_type : null;
            setTodayType(storedType || inferred);
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
                if (!API_URL) {
                    setError("Missing VITE_API_URL. Set it in your .env (local) and Netlify env vars (prod). Example: VITE_API_URL=https://your-backend-domain");
                    setLoading(false);
                    return;
                }

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

    useEffect(() => {
        localStorage.setItem("pp_nutrition_view_mode", viewMode);
    }, [viewMode]);

    useEffect(() => {
        localStorage.setItem("pp_mealplan_macro_display", macroDisplay);
    }, [macroDisplay]);

    const totalCheatsAllowed = useMemo(() => {
        if (!flex) return 0;
        return Number(flex.base_cheat_meals || 0) + Number(flex.banked_cheat_meals || 0);
    }, [flex]);

    const cheatsRemaining = useMemo(() => {
        if (!flex) return 0;
        return Math.max(0, totalCheatsAllowed - Number(flex.used_cheat_meals || 0));
    }, [flex, totalCheatsAllowed]);

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
                            onClick={() => setViewMode("macros")}
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
                            onClick={() => setViewMode("meal_plan")}
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
                            onChange={(e) => setMacroDisplay(e.target.value)}
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