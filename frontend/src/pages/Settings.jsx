import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const activityOptions = [
  { value: "inactive", label: "Inactive", desc: "Mostly sitting, little walking" },
  { value: "light", label: "Lightly active", desc: "Some walking, low daily movement" },
  { value: "moderate", label: "Moderately active", desc: "Regular walking, active job or lifestyle" },
  { value: "heavy", label: "Heavily active", desc: "High daily movement, physical job" },
  { value: "extreme", label: "Extreme", desc: "Very high daily activity (rare)" }
];

function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);

  // Profile fields we care about
  const [unitSystem, setUnitSystem] = useState("metric"); // metric | imperial
  const [checkInDay, setCheckInDay] = useState("Monday");

  // Baseline lifestyle (used later by AI for steps/cardio targets)
  const [lifestyleActivity, setLifestyleActivity] = useState("moderate");

  // Nutrition display preferences
  const [nutritionViewMode, setNutritionViewMode] = useState("macros"); // macros | meal_plan
  const [showMealMacros, setShowMealMacros] = useState(true); // show macros per meal (when meal plan mode exists)
  const [showDayMacros, setShowDayMacros] = useState(true); // show full-day macros

  // Split preferences (optional: keep editable here)
  const [splitMode, setSplitMode] = useState("fixed"); // fixed | rolling
  const [uiMotion, setUiMotion] = useState("medium"); // low | medium
  const [uiContrast, setUiContrast] = useState("normal"); // normal | high

  const statusText = useMemo(() => {
    if (saving) return "Saving...";
    return "Saved";
  }, [saving]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData?.user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      const user = userData.user;
      setUserId(user.id);

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select(
          [
            "unit_system",
            "check_in_day",
            "lifestyle_activity",
            "nutrition_view_mode",
            "show_meal_macros",
            "show_day_macros",
            "split_mode"
          ].join(",")
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (pErr && pErr.code !== "PGRST116") {
        setError(pErr.message);
        setLoading(false);
        return;
      }

      if (profile?.unit_system) setUnitSystem(profile.unit_system);
      if (profile?.check_in_day) setCheckInDay(profile.check_in_day);

      if (profile?.lifestyle_activity) setLifestyleActivity(profile.lifestyle_activity);

      if (profile?.nutrition_view_mode) setNutritionViewMode(profile.nutrition_view_mode);
      if (typeof profile?.show_meal_macros === "boolean") setShowMealMacros(profile.show_meal_macros);
      if (typeof profile?.show_day_macros === "boolean") setShowDayMacros(profile.show_day_macros);

      if (profile?.split_mode) setSplitMode(profile.split_mode);

      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    const storedMotion = localStorage.getItem("pp_ui_motion") || "medium";
    const storedContrast = localStorage.getItem("pp_ui_contrast") || "normal";
    setUiMotion(storedMotion);
    setUiContrast(storedContrast);
  }, []);

  const saveUiPrefs = (next = {}) => {
    const motion = next.motion || uiMotion;
    const contrast = next.contrast || uiContrast;
    localStorage.setItem("pp_ui_motion", motion);
    localStorage.setItem("pp_ui_contrast", contrast);
    document.documentElement.dataset.motion = motion;
    document.documentElement.dataset.contrast = contrast;
  };

  const saveProfilePatch = async (patch) => {
    if (!userId) return;
    setError("");
    setSaving(true);

    const { error: e } = await supabase
      .from("profiles")
      .update(patch)
      .eq("user_id", userId);

    setSaving(false);

    if (e) setError(e.message);
  };

  if (loading) return <div>Loading...</div>;

  const card = {
    background: "#050507",
    border: "1px solid #2a1118",
    padding: "1rem"
  };

  const label = { color: "#aaa", fontSize: "0.9rem" };

  const select = {
    width: "100%",
    padding: "0.6rem",
    background: "#111",
    color: "#fff",
    border: "1px solid #2a1118"
  };

  const toggleRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    border: "1px solid #2a1118",
    background: "#111",
    padding: "0.75rem",
    marginTop: "0.6rem"
  };

  const pillBtn = (active) => ({
    padding: "0.5rem 0.75rem",
    border: "1px solid #2a1118",
    background: active ? "#0b0b10" : "transparent",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer"
  });

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

  return (
    <div className="pp-settings-page" style={{ width: "100%", maxWidth: "1400px", margin: "0 auto" }}>
      <style>{responsiveStyle}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Settings</h1>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Preferences for tracking, targets, and what you see in the app.
          </div>
        </div>
        <div style={{ color: "#666" }}>{statusText}</div>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

      <div className="pp-settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
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
                style={{ ...select, marginTop: "0.5rem" }}
              >
                <option>Monday</option>
                <option>Tuesday</option>
                <option>Wednesday</option>
                <option>Thursday</option>
                <option>Friday</option>
                <option>Saturday</option>
                <option>Sunday</option>
              </select>
              <div style={{ color: "#666", marginTop: "0.5rem", fontSize: "0.9rem" }}>
                This sets which day your “weekly check-in” week starts on.
              </div>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700 }}>Baseline lifestyle (non-weight-training)</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Used later for steps/cardio targets and overall plan difficulty.
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={label}>Activity level</div>
            <select
              value={lifestyleActivity}
              onChange={(e) => {
                setLifestyleActivity(e.target.value);
                saveProfilePatch({ lifestyle_activity: e.target.value });
              }}
              style={{ ...select, marginTop: "0.5rem" }}
            >
              {activityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <div style={{ color: "#666", marginTop: "0.6rem", fontSize: "0.9rem" }}>
              {activityOptions.find((x) => x.value === lifestyleActivity)?.desc}
            </div>
          </div>
        </div>
      </div>

      <div className="pp-settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
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
              style={{ ...select, marginTop: "0.5rem" }}
            >
              <option value="fixed">Weekly (fixed days)</option>
              <option value="rolling">Rolling (cycle repeats)</option>
            </select>

            <div style={{ color: "#666", marginTop: "0.6rem", fontSize: "0.9rem" }}>
              You can still override “today = rest day” inside Training (and it should also switch nutrition day type).
            </div>
          </div>
        </div>
      </div>

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

      <div style={{ marginTop: "1rem", ...card }}>
        <div style={{ fontWeight: 700 }}>Account</div>
        <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
          More account controls (billing, plan, deletions) later.
        </div>

        <div style={{ marginTop: "1rem", color: "#666", fontSize: "0.9rem" }}>
          For now: logout is in the sidebar.
        </div>
      </div>
    </div>
  );
}

export default Settings;
