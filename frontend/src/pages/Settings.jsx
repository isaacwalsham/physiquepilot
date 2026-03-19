import { useEffect, useMemo, useState } from "react";
import { useProfile } from "../context/ProfileContext";
import { supabase } from "../supabaseClient";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";
import PageHeader from "../components/PageHeader";

const API_URL = (
  String(import.meta.env.VITE_API_URL || "")
    .trim()
    .replace(/\/$/, "") ||
  (import.meta.env.DEV ? "http://localhost:4000" : "https://physiquepilot.onrender.com")
);

const activityOptions = [
  { value: "inactive", label: "Inactive", desc: "Mostly sitting, little walking" },
  { value: "light", label: "Lightly active", desc: "Some walking, low daily movement" },
  { value: "moderate", label: "Moderately active", desc: "Regular walking, active job or lifestyle" },
  { value: "heavy", label: "Heavily active", desc: "High daily movement, physical job" },
  { value: "extreme", label: "Extreme", desc: "Very high daily activity (rare)" },
];

const dietaryOptions = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto", label: "Keto" },
  { value: "other", label: "Other" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function Settings() {
  const { profile, loading, updateProfile, restartTour } = useProfile();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── UI-only prefs (localStorage) ─────────────────────────────────────────
  const [uiMotion, setUiMotion] = useState("medium");
  const [uiContrast, setUiContrast] = useState("normal");

  // ── General ──────────────────────────────────────────────────────────────
  const [unitSystem, setUnitSystem] = useState("metric");
  const [checkInDay, setCheckInDay] = useState("Monday");

  // ── Body metrics (explicit Save) ─────────────────────────────────────────
  const [heightInput, setHeightInput] = useState("");
  const [startingWeightInput, setStartingWeightInput] = useState("");
  const [bodyFatPctInput, setBodyFatPctInput] = useState("");

  // ── Goal ─────────────────────────────────────────────────────────────────
  const [goalType, setGoalType] = useState("maintain"); // lose | maintain | gain
  const [weeklyRateInput, setWeeklyRateInput] = useState("");

  // ── Activity level ────────────────────────────────────────────────────────
  const [activityLevel, setActivityLevel] = useState("moderate");

  // ── Dietary preferences ──────────────────────────────────────────────────
  const [dietaryPreference, setDietaryPreference] = useState("omnivore");
  const [dietaryAdditional, setDietaryAdditional] = useState("");
  const [dislikes, setDislikes] = useState("");

  // ── Allergies ─────────────────────────────────────────────────────────────
  const [foodAllergies, setFoodAllergies] = useState("");

  // ── Nutrition display ─────────────────────────────────────────────────────
  const [nutritionViewMode, setNutritionViewMode] = useState("macros");
  const [showMealMacros, setShowMealMacros] = useState(true);
  const [showDayMacros, setShowDayMacros] = useState(true);

  // ── Training ──────────────────────────────────────────────────────────────
  const [splitMode, setSplitMode] = useState("fixed");

  // ── Initialise state from profile ────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;

    if (profile.unit_system) setUnitSystem(profile.unit_system);
    if (profile.check_in_day) setCheckInDay(profile.check_in_day);

    // Body metrics — display in user's unit system
    const isImperial = (profile.unit_system || "metric") === "imperial";
    if (profile.height_cm != null) {
      const val = isImperial
        ? String(Math.round(profile.height_cm * 0.393701 * 10) / 10) // total inches
        : String(profile.height_cm);
      setHeightInput(val);
    }
    if (profile.starting_weight_kg != null) {
      const val = isImperial
        ? String(Math.round(profile.starting_weight_kg * 2.20462 * 10) / 10)
        : String(profile.starting_weight_kg);
      setStartingWeightInput(val);
    }
    if (profile.body_fat_pct != null) setBodyFatPctInput(String(profile.body_fat_pct));

    // Goal
    if (profile.goal_type) setGoalType(profile.goal_type);
    if (profile.weekly_weight_change_target_kg != null) {
      const isImperialNow = (profile.unit_system || "metric") === "imperial";
      const val = isImperialNow
        ? String(Math.round(profile.weekly_weight_change_target_kg * 2.20462 * 100) / 100)
        : String(profile.weekly_weight_change_target_kg);
      setWeeklyRateInput(val);
    }

    // Activity
    if (profile.activity_level) setActivityLevel(profile.activity_level);

    // Dietary
    if (profile.dietary_preference) setDietaryPreference(profile.dietary_preference);
    if (profile.dietary_additional != null) setDietaryAdditional(profile.dietary_additional);
    if (profile.dislikes != null) setDislikes(profile.dislikes);

    // Allergies
    if (profile.food_allergies != null) setFoodAllergies(profile.food_allergies);

    // Nutrition display
    if (profile.nutrition_view_mode) setNutritionViewMode(profile.nutrition_view_mode);
    if (typeof profile.show_meal_macros === "boolean") setShowMealMacros(profile.show_meal_macros);
    if (typeof profile.show_day_macros === "boolean") setShowDayMacros(profile.show_day_macros);

    // Training
    if (profile.split_mode) setSplitMode(profile.split_mode);
  }, [profile]);

  // ── Load UI prefs from localStorage ──────────────────────────────────────
  useEffect(() => {
    const storedMotion = localStorage.getItem("pp_ui_motion") || "medium";
    const storedContrast = localStorage.getItem("pp_ui_contrast") || "normal";
    setUiMotion(storedMotion);
    setUiContrast(storedContrast);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const triggerNutritionRecalc = async () => {
    if (!profile?.user_id) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    fetch(`${API_URL}/api/nutrition/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ user_id: profile.user_id }),
    }).catch(() => {
      // silent — recalc is best-effort
    });
  };

  const saveUiPrefs = (next = {}) => {
    const motion = next.motion !== undefined ? next.motion : uiMotion;
    const contrast = next.contrast !== undefined ? next.contrast : uiContrast;
    localStorage.setItem("pp_ui_motion", motion);
    localStorage.setItem("pp_ui_contrast", contrast);
    document.documentElement.dataset.motion = motion;
    document.documentElement.dataset.contrast = contrast;
  };

  const saveProfilePatch = async (patch, { recalc = false } = {}) => {
    setError("");
    setSaving(true);
    const { error: e } = await updateProfile(patch);
    setSaving(false);
    if (e) {
      setError(typeof e === "string" ? e : String(e));
    } else if (recalc) {
      triggerNutritionRecalc();
    }
  };

  const isImperial = unitSystem === "imperial";

  const statusText = useMemo(() => {
    if (saving) return "Saving...";
    return "Saved";
  }, [saving]);

  // ── Save body metrics ─────────────────────────────────────────────────────
  const saveBodyMetrics = async () => {
    const heightNum = parseFloat(heightInput);
    const weightNum = parseFloat(startingWeightInput);
    const bfNum = parseFloat(bodyFatPctInput);

    const patch = {};

    if (!isNaN(heightNum) && heightNum > 0) {
      patch.height_cm = isImperial
        ? Math.round((heightNum / 0.393701) * 10) / 10
        : heightNum;
    }
    if (!isNaN(weightNum) && weightNum > 0) {
      patch.starting_weight_kg = isImperial
        ? Math.round((weightNum / 2.20462) * 100) / 100
        : weightNum;
    }
    if (!isNaN(bfNum) && bfNum >= 0) {
      patch.body_fat_pct = bfNum;
    }

    if (Object.keys(patch).length === 0) return;
    await saveProfilePatch(patch, { recalc: true });
  };

  // ── Save goal ─────────────────────────────────────────────────────────────
  const saveGoal = async () => {
    const patch = { goal_type: goalType };

    if (goalType !== "maintain") {
      const rateNum = parseFloat(weeklyRateInput);
      if (!isNaN(rateNum) && rateNum > 0) {
        patch.weekly_weight_change_target_kg = isImperial
          ? Math.round((rateNum / 2.20462) * 1000) / 1000
          : rateNum;
      }
    } else {
      patch.weekly_weight_change_target_kg = 0;
    }

    await saveProfilePatch(patch, { recalc: true });
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  if (loading) return <PhysiquePilotLoader />;

  const card = {
    background: "#050507",
    border: "1px solid #2a1118",
    padding: "1rem",
  };

  const label = { color: "#aaa", fontSize: "0.9rem" };

  const selectStyle = {
    width: "100%",
    padding: "0.6rem",
    background: "#111",
    color: "#fff",
    border: "1px solid #2a1118",
  };

  const inputStyle = {
    width: "100%",
    padding: "0.6rem",
    background: "#111",
    color: "#fff",
    border: "1px solid #2a1118",
    boxSizing: "border-box",
  };

  const toggleRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    border: "1px solid #2a1118",
    background: "#111",
    padding: "0.75rem",
    marginTop: "0.6rem",
  };

  const pillBtn = (active) => ({
    padding: "0.5rem 0.75rem",
    border: "1px solid #2a1118",
    background: active ? "#0b0b10" : "transparent",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer",
  });

  const saveBtn = {
    marginTop: "0.75rem",
    padding: "0.5rem 1.25rem",
    background: "#1a0a10",
    border: "1px solid #2a1118",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
  };

  const responsiveStyle = `
    @media (max-width: 980px) {
      .pp-settings-grid {
        grid-template-columns: 1fr !important;
      }
      .pp-toggle-row {
        flex-direction: column;
        align-items: flex-start;
      }
      .pp-toggle-row input[type="checkbox"] {
        margin-left: auto;
      }
    }
    @media (max-width: 520px) {
      .pp-settings-page h1 {
        font-size: 1.9rem;
      }
    }
  `;

  const heightUnit = isImperial ? "in (total)" : "cm";
  const weightUnit = isImperial ? "lbs" : "kg";
  const rateUnit = isImperial ? "lbs/wk" : "kg/wk";

  return (
    <div className="pp-settings-page" style={{ width: "100%", maxWidth: "1400px", margin: "0 auto" }}>
      <style>{responsiveStyle}</style>

      <PageHeader
        title="SETTINGS"
        subtitle="PREFERENCES & TARGETS"
        right={statusText ? <span style={{ fontFamily:"var(--font-display)", fontSize:"0.65rem", letterSpacing:"0.1em", color:"var(--text-3)" }}>{statusText}</span> : undefined}
      />

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

      {/* Row 1: General + Body metrics */}
      <div
        className="pp-settings-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}
      >
        {/* General */}
        <div style={card}>
          <div style={{ fontWeight: 700 }}>General</div>

          <div style={{ marginTop: "0.9rem" }}>
            <div style={label}>Unit system</div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                style={pillBtn(unitSystem === "metric")}
                onClick={() => {
                  setUnitSystem("metric");
                  saveProfilePatch({ unit_system: "metric" });
                }}
              >
                Metric
              </button>
              <button
                type="button"
                style={pillBtn(unitSystem === "imperial")}
                onClick={() => {
                  setUnitSystem("imperial");
                  saveProfilePatch({ unit_system: "imperial" });
                }}
              >
                Imperial
              </button>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <div style={label}>Weekly check-in day</div>
              <select
                value={checkInDay}
                onChange={(e) => {
                  setCheckInDay(e.target.value);
                  saveProfilePatch({ check_in_day: e.target.value });
                }}
                style={{ ...selectStyle, marginTop: "0.5rem" }}
              >
                {DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <div style={{ color: "#666", marginTop: "0.5rem", fontSize: "0.9rem" }}>
                This sets which day your "weekly check-in" week starts on.
              </div>
            </div>
          </div>
        </div>

        {/* Body metrics */}
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Body metrics</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Used to calculate your calorie and macro targets.
          </div>

          <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
            <div>
              <div style={label}>Height ({heightUnit})</div>
              <input
                type="number"
                min="0"
                step="0.1"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                style={{ ...inputStyle, marginTop: "0.4rem" }}
                placeholder={isImperial ? "e.g. 70" : "e.g. 178"}
              />
            </div>

            <div>
              <div style={label}>Starting weight ({weightUnit})</div>
              <input
                type="number"
                min="0"
                step="0.1"
                value={startingWeightInput}
                onChange={(e) => setStartingWeightInput(e.target.value)}
                style={{ ...inputStyle, marginTop: "0.4rem" }}
                placeholder={isImperial ? "e.g. 185" : "e.g. 84"}
              />
            </div>

            <div>
              <div style={label}>Body fat % (optional)</div>
              <input
                type="number"
                min="0"
                max="70"
                step="0.1"
                value={bodyFatPctInput}
                onChange={(e) => setBodyFatPctInput(e.target.value)}
                style={{ ...inputStyle, marginTop: "0.4rem" }}
                placeholder="e.g. 18"
              />
            </div>
          </div>

          <button type="button" style={saveBtn} onClick={saveBodyMetrics}>
            Save body metrics
          </button>
        </div>
      </div>

      {/* Row 2: Goal + Activity level */}
      <div
        className="pp-settings-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}
      >
        {/* Goal */}
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Goal</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Drives your calorie target and macro split.
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={label}>Goal type</div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              {[
                { value: "lose", label: "Lose fat" },
                { value: "maintain", label: "Maintain" },
                { value: "gain", label: "Gain muscle" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  style={pillBtn(goalType === opt.value)}
                  onClick={() => setGoalType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {goalType !== "maintain" && (
              <div style={{ marginTop: "1rem" }}>
                <div style={label}>Weekly rate ({rateUnit})</div>
                <input
                  type="number"
                  min="0"
                  step="0.05"
                  value={weeklyRateInput}
                  onChange={(e) => setWeeklyRateInput(e.target.value)}
                  style={{ ...inputStyle, marginTop: "0.4rem" }}
                  placeholder={isImperial ? "e.g. 0.5" : "e.g. 0.25"}
                />
                <div style={{ color: "#666", marginTop: "0.4rem", fontSize: "0.85rem" }}>
                  {goalType === "lose"
                    ? "Rate of fat loss per week"
                    : "Rate of weight gain per week"}
                </div>
              </div>
            )}
          </div>

          <button type="button" style={saveBtn} onClick={saveGoal}>
            Save goal
          </button>
        </div>

        {/* Activity level */}
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Activity level</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Your baseline daily movement outside of planned workouts.
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={label}>Activity level</div>
            <select
              value={activityLevel}
              onChange={(e) => {
                setActivityLevel(e.target.value);
                saveProfilePatch({ activity_level: e.target.value }, { recalc: true });
              }}
              style={{ ...selectStyle, marginTop: "0.5rem" }}
            >
              {activityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <div style={{ color: "#666", marginTop: "0.6rem", fontSize: "0.9rem" }}>
              {activityOptions.find((x) => x.value === activityLevel)?.desc}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Dietary preferences + Allergies */}
      <div
        className="pp-settings-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}
      >
        {/* Dietary preferences */}
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Dietary preferences</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Used when generating meal plans and food suggestions.
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={label}>Diet type</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
              {dietaryOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  style={pillBtn(dietaryPreference === opt.value)}
                  onClick={() => {
                    setDietaryPreference(opt.value);
                    saveProfilePatch({ dietary_preference: opt.value });
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={label}>Additional notes (optional)</div>
            <input
              type="text"
              value={dietaryAdditional}
              onChange={(e) => setDietaryAdditional(e.target.value)}
              onBlur={() => {
                if (dietaryAdditional !== (profile?.dietary_additional ?? "")) {
                  saveProfilePatch({ dietary_additional: dietaryAdditional });
                }
              }}
              style={{ ...inputStyle, marginTop: "0.4rem" }}
              placeholder="e.g. no red meat, halal, kosher"
            />
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={label}>Dislikes (optional)</div>
            <input
              type="text"
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
              onBlur={() => {
                if (dislikes !== (profile?.dislikes ?? "")) {
                  saveProfilePatch({ dislikes });
                }
              }}
              style={{ ...inputStyle, marginTop: "0.4rem" }}
              placeholder="e.g. mushrooms, cilantro, olives"
            />
          </div>
        </div>

        {/* Allergies */}
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Allergies</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Food allergies or intolerances the AI will avoid in suggestions.
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={label}>Food allergies / intolerances</div>
            <textarea
              value={foodAllergies}
              onChange={(e) => setFoodAllergies(e.target.value)}
              onBlur={() => {
                if (foodAllergies !== (profile?.food_allergies ?? "")) {
                  saveProfilePatch({ food_allergies: foodAllergies });
                }
              }}
              rows={5}
              style={{
                ...inputStyle,
                marginTop: "0.4rem",
                resize: "vertical",
                fontFamily: "inherit",
              }}
              placeholder="e.g. peanuts, tree nuts, shellfish, gluten, dairy"
            />
            <div style={{ color: "#666", marginTop: "0.4rem", fontSize: "0.85rem" }}>
              Separate items with commas. Saved automatically when you click away.
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Nutrition display + Training preferences */}
      <div
        className="pp-settings-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}
      >
        {/* Nutrition display */}
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Nutrition display</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            This only changes what the UI shows — AI-based meal plans come later.
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={label}>Default view</div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                style={pillBtn(nutritionViewMode === "macros")}
                onClick={() => {
                  setNutritionViewMode("macros");
                  saveProfilePatch({ nutrition_view_mode: "macros" });
                }}
              >
                Macros
              </button>
              <button
                type="button"
                style={pillBtn(nutritionViewMode === "meal_plan")}
                onClick={() => {
                  setNutritionViewMode("meal_plan");
                  saveProfilePatch({ nutrition_view_mode: "meal_plan" });
                }}
              >
                Meal plan
              </button>
            </div>

            <div className="pp-toggle-row" style={toggleRow}>
              <div>
                <div style={{ fontWeight: 600 }}>Show meal macros</div>
                <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                  When meal plans exist, show macros per meal.
                </div>
              </div>
              <input
                type="checkbox"
                checked={showMealMacros}
                onChange={(e) => {
                  setShowMealMacros(e.target.checked);
                  saveProfilePatch({ show_meal_macros: e.target.checked });
                }}
              />
            </div>

            <div className="pp-toggle-row" style={toggleRow}>
              <div>
                <div style={{ fontWeight: 600 }}>Show full-day macros</div>
                <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                  Show totals for the day even in meal plan mode.
                </div>
              </div>
              <input
                type="checkbox"
                checked={showDayMacros}
                onChange={(e) => {
                  setShowDayMacros(e.target.checked);
                  saveProfilePatch({ show_day_macros: e.target.checked });
                }}
              />
            </div>
          </div>
        </div>

        {/* Training preferences */}
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Training preferences</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            These affect the calendar logic (fixed vs rolling). Training block editing lives in Training.
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={label}>Split mode</div>
            <select
              value={splitMode}
              onChange={(e) => {
                setSplitMode(e.target.value);
                saveProfilePatch({ split_mode: e.target.value });
              }}
              style={{ ...selectStyle, marginTop: "0.5rem" }}
            >
              <option value="fixed">Weekly (fixed days)</option>
              <option value="rolling">Rolling (cycle repeats)</option>
            </select>

            <div style={{ color: "#666", marginTop: "0.6rem", fontSize: "0.9rem" }}>
              You can still override "today = rest day" inside Training (and it should also switch nutrition day type).
            </div>
          </div>
        </div>
      </div>

      {/* Accessibility & motion */}
      <div style={{ marginTop: "1rem", ...card }}>
        <div style={{ fontWeight: 700 }}>Accessibility & motion</div>
        <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
          Visual comfort controls for animation and contrast.
        </div>

        <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
          <div>
            <div style={label}>Motion</div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                style={pillBtn(uiMotion === "low")}
                onClick={() => {
                  setUiMotion("low");
                  saveUiPrefs({ motion: "low" });
                }}
              >
                Reduced
              </button>
              <button
                type="button"
                style={pillBtn(uiMotion === "medium")}
                onClick={() => {
                  setUiMotion("medium");
                  saveUiPrefs({ motion: "medium" });
                }}
              >
                Medium
              </button>
            </div>
          </div>

          <div>
            <div style={label}>Contrast</div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                style={pillBtn(uiContrast === "normal")}
                onClick={() => {
                  setUiContrast("normal");
                  saveUiPrefs({ contrast: "normal" });
                }}
              >
                Normal
              </button>
              <button
                type="button"
                style={pillBtn(uiContrast === "high")}
                onClick={() => {
                  setUiContrast("high");
                  saveUiPrefs({ contrast: "high" });
                }}
              >
                High
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div style={{ marginTop: "1rem", ...card }}>
        <div style={{ fontWeight: 700 }}>Account</div>
        <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
          More account controls (billing, plan, deletions) later.
        </div>

        <div style={{ marginTop: "1rem", color: "#666", fontSize: "0.9rem" }}>
          For now: logout is in the sidebar.
        </div>
      </div>

      {/* App tour */}
      <div style={{ marginTop: "1rem", ...card }}>
        <div style={{ fontWeight: 700 }}>App tour</div>
        <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
          Run the guided walkthrough again to revisit what each section does.
        </div>
        <button
          type="button"
          style={{ ...saveBtn, marginTop: "1rem" }}
          onClick={async () => {
            // Reset tour_completed so useTour picks it up
            if (profile?.user_id) {
              await supabase
                .from("profiles")
                .update({ tour_completed: false })
                .eq("user_id", profile.user_id);
            }
            restartTour();
          }}
        >
          Replay tour
        </button>
      </div>
    </div>
  );
}

export default Settings;
