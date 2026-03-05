import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// ─── Data ─────────────────────────────────────────────────────────────────────

const activityOptions = [
  { value: "inactive", label: "Inactive", desc: "Mostly sitting, little walking" },
  { value: "light", label: "Lightly active", desc: "Some walking, low daily movement" },
  { value: "moderate", label: "Moderately active", desc: "Regular walking, active job or lifestyle" },
  { value: "heavy", label: "Heavily active", desc: "High daily movement, physical job" },
  { value: "extreme", label: "Extreme", desc: "Very high daily activity (rare)" }
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Page wrapper ── */
  .settings-page {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    font-family: var(--font-body);
    color: var(--text-1);
  }

  /* ── Page header ── */
  .settings-page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }

  .settings-page-label-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 0.35rem;
  }

  .settings-page-accent-line {
    width: 20px;
    height: 1px;
    background: var(--accent-3);
    flex-shrink: 0;
  }

  .settings-page-label {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-3);
  }

  .settings-page-title {
    font-family: var(--font-display);
    font-size: 1.9rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-1);
    line-height: 1.1;
  }

  .settings-page-desc {
    font-size: 0.88rem;
    color: var(--text-3);
    margin: 0.4rem 0 0;
  }

  .settings-save-status {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    padding-top: 0.35rem;
    flex-shrink: 0;
  }

  .settings-save-status.saving {
    color: var(--warn);
  }

  /* ── Error banner ── */
  .settings-error {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    margin-bottom: 1rem;
    padding: 0.65rem 0.85rem;
    background: rgba(222,41,82,0.06);
    border: 1px solid rgba(222,41,82,0.22);
    border-radius: var(--radius-sm);
    color: var(--bad);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  /* ── Settings grid ── */
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  /* ── Cockpit card ── */
  .settings-card {
    background: rgba(8,3,5,0.85);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(181,21,60,0.04);
  }

  .settings-card-full {
    margin-bottom: 1rem;
  }

  /* ── Card topbar ── */
  .settings-card-topbar {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 1rem;
    background: rgba(181,21,60,0.04);
    border-bottom: 1px solid var(--line-1);
  }

  .settings-card-code {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent-3);
    opacity: 0.7;
    flex-shrink: 0;
  }

  .settings-card-sep {
    width: 1px;
    height: 10px;
    background: var(--line-2);
    flex-shrink: 0;
  }

  .settings-card-title {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  /* ── Card body ── */
  .settings-card-body {
    padding: 1.25rem;
  }

  /* ── Card description ── */
  .settings-card-desc {
    font-size: 0.8rem;
    color: var(--text-3);
    margin: 0 0 1rem;
    line-height: 1.5;
  }

  /* ── Section label inside card ── */
  .settings-section-label {
    font-family: var(--font-display);
    font-size: 0.78rem;
    color: var(--text-2);
    font-weight: 500;
    margin-bottom: 0.5rem;
    margin-top: 1rem;
  }

  .settings-section-label:first-child {
    margin-top: 0;
  }

  /* ── Hint text ── */
  .settings-hint {
    font-size: 0.78rem;
    color: var(--text-3);
    margin-top: 0.5rem;
    line-height: 1.45;
  }

  /* ── Pill button group ── */
  .settings-pill-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }

  .settings-pill {
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    border-radius: var(--radius-sm);
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    border: 1px solid var(--line-1);
    background: transparent;
    color: var(--text-3);
  }

  .settings-pill:hover {
    border-color: var(--line-2);
    color: var(--text-2);
  }

  .settings-pill.active {
    background: linear-gradient(135deg, rgba(181,21,60,0.3), rgba(138,15,46,0.2));
    border: 1px solid var(--accent-2);
    color: var(--text-1);
  }

  /* ── Select dropdown ── */
  .settings-select {
    width: 100%;
    padding: 0.55rem 0.75rem;
    background: rgba(10,5,8,0.9);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 0.9rem;
    outline: none;
    box-sizing: border-box;
    cursor: pointer;
    transition: border-color 0.15s;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a7f89'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    padding-right: 2rem;
    margin-top: 0.5rem;
  }

  .settings-select:focus {
    border-color: var(--accent-3);
  }

  .settings-select option {
    background: #0e0608;
    color: var(--text-1);
  }

  /* ── Toggle row (checkbox) ── */
  .settings-toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    background: rgba(181,21,60,0.025);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    padding: 0.75rem 1rem;
    margin-top: 0.6rem;
    transition: border-color 0.15s;
  }

  .settings-toggle-row:hover {
    border-color: var(--line-2);
  }

  .settings-toggle-label {
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--text-2);
    font-weight: 500;
    margin-bottom: 0.15rem;
  }

  .settings-toggle-desc {
    font-size: 0.78rem;
    color: var(--text-3);
    line-height: 1.4;
  }

  /* ── Checkbox styling ── */
  .settings-checkbox {
    width: 18px;
    height: 18px;
    accent-color: var(--accent-2);
    flex-shrink: 0;
    cursor: pointer;
  }

  /* ── Loading state ── */
  .settings-loading {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 2rem;
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  /* ── Account placeholder ── */
  .settings-account-placeholder {
    font-size: 0.85rem;
    color: var(--text-3);
    padding: 0.5rem 0;
    line-height: 1.5;
  }

  /* ── Responsive ── */
  @media (max-width: 980px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 520px) {
    .settings-page-title {
      font-size: 1.5rem;
    }

    .settings-card-body {
      padding: 1rem;
    }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

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

  if (loading) {
    return (
      <div className="settings-page">
        <style>{CSS}</style>
        <div className="settings-loading">
          <span>Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <style>{CSS}</style>

      {/* Page header */}
      <div className="settings-page-header">
        <div>
          <div className="settings-page-label-row">
            <div className="settings-page-accent-line" aria-hidden="true" />
            <span className="settings-page-label">System Configuration</span>
          </div>
          <h1 className="settings-page-title">Settings</h1>
          <p className="settings-page-desc">
            Preferences for tracking, targets, and what you see in the app.
          </p>
        </div>
        <div className={`settings-save-status${saving ? " saving" : ""}`}>
          {statusText}
        </div>
      </div>

      {error && (
        <div className="settings-error" role="alert">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Row 1: General + Baseline lifestyle */}
      <div className="settings-grid">

        {/* General */}
        <div className="settings-card">
          <div className="settings-card-topbar">
            <span className="settings-card-code">UNITS</span>
            <div className="settings-card-sep" aria-hidden="true" />
            <span className="settings-card-title">General</span>
          </div>
          <div className="settings-card-body">

            <div className="settings-section-label">Unit system</div>
            <div className="settings-pill-group">
              <button
                type="button"
                className={`settings-pill${unitSystem === "metric" ? " active" : ""}`}
                onClick={() => {
                  setUnitSystem("metric");
                  saveProfilePatch({ unit_system: "metric" });
                }}
              >
                Metric
              </button>
              <button
                type="button"
                className={`settings-pill${unitSystem === "imperial" ? " active" : ""}`}
                onClick={() => {
                  setUnitSystem("imperial");
                  saveProfilePatch({ unit_system: "imperial" });
                }}
              >
                Imperial
              </button>
            </div>

            <div className="settings-section-label">Weekly check-in day</div>
            <select
              className="settings-select"
              value={checkInDay}
              onChange={(e) => {
                setCheckInDay(e.target.value);
                saveProfilePatch({ check_in_day: e.target.value });
              }}
            >
              <option>Monday</option>
              <option>Tuesday</option>
              <option>Wednesday</option>
              <option>Thursday</option>
              <option>Friday</option>
              <option>Saturday</option>
              <option>Sunday</option>
            </select>
            <div className="settings-hint">
              Sets which day your "weekly check-in" week starts on.
            </div>

          </div>
        </div>

        {/* Baseline lifestyle */}
        <div className="settings-card">
          <div className="settings-card-topbar">
            <span className="settings-card-code">SCHED</span>
            <div className="settings-card-sep" aria-hidden="true" />
            <span className="settings-card-title">Baseline Lifestyle</span>
          </div>
          <div className="settings-card-body">

            <p className="settings-card-desc">
              Non-weight-training activity. Used later for steps/cardio targets and overall plan difficulty.
            </p>

            <div className="settings-section-label">Activity level</div>
            <select
              className="settings-select"
              value={lifestyleActivity}
              onChange={(e) => {
                setLifestyleActivity(e.target.value);
                saveProfilePatch({ lifestyle_activity: e.target.value });
              }}
            >
              {activityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <div className="settings-hint">
              {activityOptions.find((x) => x.value === lifestyleActivity)?.desc}
            </div>

          </div>
        </div>

      </div>

      {/* Row 2: Nutrition display + Training preferences */}
      <div className="settings-grid">

        {/* Nutrition display */}
        <div className="settings-card">
          <div className="settings-card-topbar">
            <span className="settings-card-code">NUTR</span>
            <div className="settings-card-sep" aria-hidden="true" />
            <span className="settings-card-title">Nutrition Display</span>
          </div>
          <div className="settings-card-body">

            <p className="settings-card-desc">
              Changes what the UI shows — AI-based meal plans come later.
            </p>

            <div className="settings-section-label">Default view</div>
            <div className="settings-pill-group">
              <button
                type="button"
                className={`settings-pill${nutritionViewMode === "macros" ? " active" : ""}`}
                onClick={() => {
                  setNutritionViewMode("macros");
                  saveProfilePatch({ nutrition_view_mode: "macros" });
                }}
              >
                Macros
              </button>
              <button
                type="button"
                className={`settings-pill${nutritionViewMode === "meal_plan" ? " active" : ""}`}
                onClick={() => {
                  setNutritionViewMode("meal_plan");
                  saveProfilePatch({ nutrition_view_mode: "meal_plan" });
                }}
              >
                Meal plan
              </button>
            </div>

            <div className="settings-toggle-row">
              <div>
                <div className="settings-toggle-label">Show meal macros</div>
                <div className="settings-toggle-desc">
                  When meal plans exist, show macros per meal.
                </div>
              </div>
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={showMealMacros}
                onChange={(e) => {
                  setShowMealMacros(e.target.checked);
                  saveProfilePatch({ show_meal_macros: e.target.checked });
                }}
              />
            </div>

            <div className="settings-toggle-row">
              <div>
                <div className="settings-toggle-label">Show full-day macros</div>
                <div className="settings-toggle-desc">
                  Show totals for the day even in meal plan mode.
                </div>
              </div>
              <input
                type="checkbox"
                className="settings-checkbox"
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
        <div className="settings-card">
          <div className="settings-card-topbar">
            <span className="settings-card-code">TRNG</span>
            <div className="settings-card-sep" aria-hidden="true" />
            <span className="settings-card-title">Training Preferences</span>
          </div>
          <div className="settings-card-body">

            <p className="settings-card-desc">
              Affects calendar logic (fixed vs rolling). Training block editing lives in Training.
            </p>

            <div className="settings-section-label">Split mode</div>
            <select
              className="settings-select"
              value={splitMode}
              onChange={(e) => {
                setSplitMode(e.target.value);
                saveProfilePatch({ split_mode: e.target.value });
              }}
            >
              <option value="fixed">Weekly (fixed days)</option>
              <option value="rolling">Rolling (cycle repeats)</option>
            </select>

            <div className="settings-hint">
              You can still override "today = rest day" inside Training (and it should also switch nutrition day type).
            </div>

          </div>
        </div>

      </div>

      {/* Accessibility & motion */}
      <div className="settings-card settings-card-full">
        <div className="settings-card-topbar">
          <span className="settings-card-code">DISPLAY</span>
          <div className="settings-card-sep" aria-hidden="true" />
          <span className="settings-card-title">Accessibility &amp; Motion</span>
        </div>
        <div className="settings-card-body">

          <p className="settings-card-desc">
            Visual comfort controls for animation and contrast.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div>
              <div className="settings-section-label">Motion</div>
              <div className="settings-pill-group">
                <button
                  type="button"
                  className={`settings-pill${uiMotion === "low" ? " active" : ""}`}
                  onClick={() => {
                    setUiMotion("low");
                    saveUiPrefs({ motion: "low" });
                  }}
                >
                  Reduced
                </button>
                <button
                  type="button"
                  className={`settings-pill${uiMotion === "medium" ? " active" : ""}`}
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
              <div className="settings-section-label">Contrast</div>
              <div className="settings-pill-group">
                <button
                  type="button"
                  className={`settings-pill${uiContrast === "normal" ? " active" : ""}`}
                  onClick={() => {
                    setUiContrast("normal");
                    saveUiPrefs({ contrast: "normal" });
                  }}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={`settings-pill${uiContrast === "high" ? " active" : ""}`}
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
      </div>

      {/* Account */}
      <div className="settings-card settings-card-full">
        <div className="settings-card-topbar">
          <span className="settings-card-code">ACCT</span>
          <div className="settings-card-sep" aria-hidden="true" />
          <span className="settings-card-title">Account</span>
        </div>
        <div className="settings-card-body">

          <p className="settings-card-desc">
            More account controls (billing, plan, deletions) coming later.
          </p>

          <div className="settings-account-placeholder">
            For now: logout is in the sidebar.
          </div>

        </div>
      </div>

    </div>
  );
}

export default Settings;
