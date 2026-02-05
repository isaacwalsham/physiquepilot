import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// Keep API_URL logic consistent with the rest of the app
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

const calcCalories = (p, c, f) => p * 4 + c * 4 + f * 9;

export default function Nutrition() {
  // Top-level tabs
  const [tab, setTab] = useState("log"); // 'log' | 'plan'
  const [planTab, setPlanTab] = useState("targets"); // 'targets' | 'meal_plan'

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

  // Daily log input (stub for now; we’ll build the full chat parser next)
  const [logText, setLogText] = useState("");
  const [waterMl, setWaterMl] = useState(0);
  const [saltG, setSaltG] = useState(0);

  // Edit buffers for targets (no autosave)
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

      // If empty, init via backend route
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
    // Hard clamps to prevent negative / nonsense on the client.
    // DB constraints are still the real guardrail.
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

      // Keep calories consistent with macros (so we never violate ndt_calories_match_macros)
      // If user edited macros, recompute calories.
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

      // Sync view state
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

    // For now: save only notes + optional water/salt into daily_nutrition_logs.
    // Next step we’ll parse foods into macros/micros.
    const todayIso = new Date().toISOString().slice(0, 10);

    try {
      const { error: e } = await supabase
        .from("daily_nutrition_logs")
        .upsert(
          {
            user_id: userId,
            log_date: todayIso,
            notes: logText || null,
            // Store summary for now; later we’ll store calculated macros.
            calories: null,
            protein_g: null,
            carbs_g: null,
            fats_g: null
          },
          { onConflict: "user_id,log_date" }
        );

      if (e) {
        setError(e.message);
        setSaving(false);
        return;
      }

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

  if (loading) return <div style={{ padding: "1rem" }}>Loading...</div>;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Nutrition</h1>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Log food daily, then use the Plan tab to adjust targets and generate meal plans.
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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

      {/* Sticky Targets summary (always visible) */}
      <div style={{ ...card, marginTop: "1rem", position: "sticky", top: "0.75rem", zIndex: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <div style={{ fontWeight: 800 }}>Today’s target</div>
            <div style={{ color: "#666", marginTop: "0.25rem" }}>{dayLabel[todayType] || "Today"}</div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <select value={todayType} onChange={(e) => saveTodayType(e.target.value)} style={{ ...field, width: "220px" }}>
              <option value="training">Training day</option>
              <option value="rest">Rest day</option>
              <option value="high">High day</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: "0.85rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.75rem" }}>
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
      </div>

      {/* LOG TAB */}
      {tab === "log" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <div style={card}>
            <div style={{ fontWeight: 800 }}>Food log</div>
            <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
              Paste foods like: <span style={{ color: "#fff" }}>50g uncooked rice, 100g chicken, 5g olive oil</span>.
            </div>

            <textarea
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder="Type or paste your foods here…"
              style={{ ...field, marginTop: "0.75rem", minHeight: "160px", resize: "vertical" }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
              <button
                type="button"
                onClick={saveLog}
                style={{ padding: "0.65rem 1rem", background: "#2a2a2a", color: "#fff", border: "1px solid #333", borderRadius: "10px", cursor: "pointer" }}
              >
                Save log
              </button>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 800 }}>Water & salt</div>
            <div style={{ color: "#aaa", marginTop: "0.5rem" }}>Optional. Keep it out of the way.</div>

            <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.75rem" }}>
              <div>
                <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Water (ml)</div>
                <input type="number" value={waterMl} onChange={(e) => setWaterMl(clampInt(e.target.value, 0, 10000))} style={field} />
              </div>
              <div>
                <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Salt (g)</div>
                <input type="number" value={saltG} onChange={(e) => setSaltG(clampInt(e.target.value, 0, 50))} style={field} />
              </div>

              <div style={{ color: "#666", fontSize: "0.9rem" }}>
                Next: we’ll store these in the daily log table and show your progress vs targets.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAN TAB */}
      {tab === "plan" && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button type="button" onClick={() => setPlanTab("targets")} style={tabBtn(planTab === "targets")}>
              Targets
            </button>
            <button type="button" onClick={() => setPlanTab("meal_plan")} style={tabBtn(planTab === "meal_plan")}>
              Meal plan
            </button>
          </div>

          {planTab === "targets" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
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

                      <div style={{ color: "#666", fontSize: "0.9rem" }}>
                        Calories auto-sync to macros (to satisfy your DB constraints). Saving is manual.
                      </div>
                    </div>
                  </div>
                );
              })}

              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={saveTargets}
                  style={{ padding: "0.7rem 1rem", background: "#2a2a2a", color: "#fff", border: "1px solid #333", borderRadius: "10px", cursor: "pointer" }}
                >
                  Save targets
                </button>
              </div>
            </div>
          )}

          {planTab === "meal_plan" && (
            <div style={card}>
              <div style={{ fontWeight: 800 }}>Meal plan</div>
              <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
                Next step: generate meals based on today’s targets, preferences, and training time.
              </div>

              <div style={{ marginTop: "1rem", color: "#666" }}>
                Placeholder for now — we’ll implement the meal blocks + alternatives after the logging and targets flows are solid.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}