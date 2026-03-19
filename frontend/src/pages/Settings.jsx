import { useCallback, useEffect, useRef, useState } from "react";
import { useProfile } from "../context/ProfileContext";
import { supabase } from "../supabaseClient";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";
import PageHeader from "../components/PageHeader";

const BACKEND =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:4000";

const authFetch = async (path, opts = {}) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  return fetch(`${BACKEND}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
};

// ── Constants ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: "profile",  label: "Profile",       icon: "◈" },
  { key: "body",     label: "Body & Goal",    icon: "⬡" },
  { key: "nutrition",label: "Nutrition",      icon: "◉" },
  { key: "training", label: "Training",       icon: "◈" },
  { key: "activity", label: "Activity",       icon: "⬢" },
  { key: "checkins", label: "Check-Ins",      icon: "◇" },
  { key: "pilot",    label: "The Pilot",      icon: "◎" },
  { key: "app",      label: "App",            icon: "⬡" },
  { key: "privacy",  label: "Data & Privacy", icon: "◈" },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const ACTIVITY_OPTIONS = [
  { value: "inactive",  label: "Inactive",          desc: "Mostly sitting, little walking" },
  { value: "light",     label: "Lightly active",     desc: "Some walking, low daily movement" },
  { value: "moderate",  label: "Moderately active",  desc: "Regular walking, active job or lifestyle" },
  { value: "heavy",     label: "Heavily active",     desc: "High daily movement, physical job" },
  { value: "extreme",   label: "Extreme",            desc: "Very high daily activity (rare)" },
];

const DIETARY_OPTIONS = [
  { value: "omnivore",    label: "Omnivore" },
  { value: "vegetarian",  label: "Vegetarian" },
  { value: "vegan",       label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto",        label: "Keto" },
  { value: "other",       label: "Other" },
];

const TRAINING_TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, "0");
  return { value: `${h}:00`, label: `${h}:00` };
});

const MEALS_PER_DAY_OPTIONS = Array.from({ length: 7 }, (_, i) => ({
  value: String(i + 2),
  label: String(i + 2),
}));

// ── Styles string ──────────────────────────────────────────────────────────────

const CSS = `
.st-layout {
  display: flex;
  flex-direction: row;
  gap: 1.5rem;
  min-height: 600px;
  align-items: flex-start;
}
.st-nav {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--line-1);
  padding-right: 0.25rem;
}
.st-nav-btn {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  text-align: left;
  padding: 0.6rem 0.75rem;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  color: var(--text-2);
  font-family: var(--font-display);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.st-nav-btn:hover {
  color: var(--text-1);
  background: rgba(181,21,60,0.04);
}
.st-nav-btn.active {
  border-left-color: var(--accent-2, #b5153c);
  color: var(--accent-2, #b5153c);
  background: rgba(181,21,60,0.08);
}
.st-nav-icon {
  font-family: var(--font-display);
  font-size: 0.75rem;
  color: var(--accent-2, #b5153c);
  opacity: 0.7;
  flex-shrink: 0;
}
.st-nav-btn.active .st-nav-icon {
  opacity: 1;
}
.st-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-bottom: 2rem;
}
.st-section-title {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.7rem;
  color: var(--text-3);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.st-section-title::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--line-1);
}
.st-card {
  background: var(--surface-1);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  margin-bottom: 0.75rem;
}
.st-card-title {
  font-family: var(--font-display);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-2);
  margin-bottom: 0.85rem;
}
.st-field {
  margin-bottom: 0.75rem;
}
.st-field:last-child {
  margin-bottom: 0;
}
.st-label {
  font-family: var(--font-display);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 0.35rem;
  display: block;
}
.st-input {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  color: var(--text-1);
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.st-input:focus {
  border-color: var(--accent-2, #b5153c);
}
.st-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.st-input-row .st-input {
  flex: 1;
}
.st-select {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  color: var(--text-1);
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
  appearance: none;
  transition: border-color 0.15s;
}
.st-select:focus {
  border-color: var(--accent-2, #b5153c);
}
.st-pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.st-pill {
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--line-1);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-family: var(--font-display);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.st-pill:hover {
  border-color: rgba(181,21,60,0.4);
  color: var(--text-1);
}
.st-pill.active {
  border-color: rgba(181,21,60,0.6);
  background: rgba(181,21,60,0.12);
  color: var(--text-1);
}
.st-num-btn-group {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.st-num-btn {
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid var(--line-1);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-family: var(--font-display);
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.st-num-btn.active {
  border-color: rgba(181,21,60,0.6);
  background: rgba(181,21,60,0.12);
  color: var(--text-1);
}
.st-toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--line-1);
}
.st-toggle-row:last-child {
  border-bottom: none;
}
.st-toggle-label {
  font-family: var(--font-display);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-2);
}
.st-toggle {
  position: relative;
  width: 38px;
  height: 22px;
  flex-shrink: 0;
}
.st-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.st-toggle-track {
  position: absolute;
  inset: 0;
  background: var(--surface-3, #1a1020);
  border: 1px solid var(--line-1);
  border-radius: 11px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.st-toggle input:checked + .st-toggle-track {
  background: rgba(181,21,60,0.35);
  border-color: rgba(181,21,60,0.5);
}
.st-toggle-track::after {
  content: "";
  position: absolute;
  width: 14px;
  height: 14px;
  top: 3px;
  left: 3px;
  border-radius: 50%;
  background: var(--text-3);
  transition: transform 0.2s, background 0.2s;
}
.st-toggle input:checked + .st-toggle-track::after {
  transform: translateX(16px);
  background: var(--accent-2, #b5153c);
}
.st-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.2rem;
  background: linear-gradient(135deg, rgba(181,21,60,0.8), rgba(130,10,40,0.9));
  border: 1px solid rgba(181,21,60,0.5);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.st-save-btn:hover {
  opacity: 0.85;
}
.st-save-btn:active {
  transform: scale(0.98);
}
.st-save-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.st-danger-card {
  background: rgba(181,21,60,0.04);
  border: 1px solid rgba(181,21,60,0.3);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  margin-bottom: 0.75rem;
}
.st-danger-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.2rem;
  background: transparent;
  border: 1px solid var(--bad, #e03030);
  border-radius: var(--radius-sm);
  color: var(--bad, #e03030);
  font-family: var(--font-display);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s;
}
.st-danger-btn:hover {
  background: rgba(224,48,48,0.1);
}
.st-danger-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.st-readonly-field {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  color: var(--text-1);
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 0.9rem;
  box-sizing: border-box;
  opacity: 0.55;
  cursor: not-allowed;
}
.st-info-note {
  font-size: 0.75rem;
  color: var(--text-3);
  line-height: 1.6;
  padding: 0.65rem 0.85rem;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-1);
}
.st-toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  font-family: var(--font-display);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  z-index: 9999;
  animation: st-slide-in 0.2s ease;
  max-width: 320px;
}
.st-toast.success {
  background: rgba(30,80,40,0.95);
  border: 1px solid rgba(60,180,80,0.4);
  color: #7be89a;
}
.st-toast.error {
  background: rgba(80,10,20,0.95);
  border: 1px solid rgba(180,30,50,0.5);
  color: #f88;
}
@keyframes st-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.st-badge {
  display: inline-block;
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-sm);
  color: var(--text-2);
}
.st-success-inline {
  font-family: var(--font-display);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: var(--ok, #4caf50);
  margin-left: 0.75rem;
}
.st-section-desc {
  font-size: 0.78rem;
  color: var(--text-3);
  line-height: 1.5;
  margin-bottom: 1rem;
}
.st-pw-success {
  display: block;
  margin-top: 0.5rem;
  font-family: var(--font-display);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: var(--ok, #4caf50);
}
@media (max-width: 760px) {
  .st-layout {
    flex-direction: column;
    gap: 0;
  }
  .st-nav {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--line-1);
    padding-right: 0;
    padding-bottom: 0.5rem;
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    gap: 0.25rem;
    padding: 0 0 0.5rem;
    -webkit-overflow-scrolling: touch;
  }
  .st-nav-btn {
    flex-shrink: 0;
    border-left: none;
    border-bottom: 3px solid transparent;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    white-space: nowrap;
    padding: 0.5rem 0.75rem;
  }
  .st-nav-btn.active {
    border-left-color: transparent;
    border-bottom-color: var(--accent-2, #b5153c);
  }
  .st-content {
    padding-top: 1rem;
  }
}
`;

// ── Toggle component ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, id }) {
  return (
    <label className="st-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <span className="st-toggle-track" />
    </label>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function Settings() {
  const { profile, loading, updateProfile, restartTour } = useProfile();

  const [activeSection, setActiveSection] = useState("profile");
  const [toast, setToast] = useState(null); // { msg, type: "success"|"error" }
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Profile section ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("prefer_not_to_say");
  const [pwResetSent, setPwResetSent] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Body & Goal section ──────────────────────────────────────────────────────
  const [heightInput, setHeightInput] = useState("");
  const [startingWeightInput, setStartingWeightInput] = useState("");
  const [bodyFatPctInput, setBodyFatPctInput] = useState("");
  const [targetWeightInput, setTargetWeightInput] = useState("");
  const [goalType, setGoalType] = useState("maintain");
  const [weeklyRateInput, setWeeklyRateInput] = useState("");
  const [savingBody, setSavingBody] = useState(false);

  // ── Nutrition section ────────────────────────────────────────────────────────
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [dietaryPreference, setDietaryPreference] = useState("omnivore");
  const [dietaryAdditional, setDietaryAdditional] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [foodAllergies, setFoodAllergies] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState("3");
  const [trainingTime, setTrainingTime] = useState("07:00");
  const [nutritionViewMode, setNutritionViewMode] = useState("macros");
  const [showMealMacros, setShowMealMacros] = useState(true);
  const [showDayMacros, setShowDayMacros] = useState(true);

  // ── Training section ─────────────────────────────────────────────────────────
  const [gymExperience, setGymExperience] = useState("intermediate");
  const [trainingDays, setTrainingDays] = useState(4);
  const [splitMode, setSplitMode] = useState("fixed");

  // ── Activity section ─────────────────────────────────────────────────────────
  const [dailyStepTarget, setDailyStepTarget] = useState("10000");
  const [savingSteps, setSavingSteps] = useState(false);

  // ── Check-Ins section ────────────────────────────────────────────────────────
  const [checkInDay, setCheckInDay] = useState("Monday");
  const [checkInReminderTime, setCheckInReminderTime] = useState("08:00");
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  // ── App section ──────────────────────────────────────────────────────────────
  const [unitSystem, setUnitSystem] = useState("metric");
  const [uiMotion, setUiMotion] = useState("medium");
  const [uiContrast, setUiContrast] = useState("normal");

  // ── Privacy section ──────────────────────────────────────────────────────────
  const [exportLoading, setExportLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Pilot section ────────────────────────────────────────────────────────────
  const [clearingConvo, setClearingConvo] = useState(false);
  const [convoClearSuccess, setConvoClearSuccess] = useState(false);

  // ── Load from profile ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;

    if (profile.full_name)     setFullName(profile.full_name);
    if (profile.date_of_birth) setDob(profile.date_of_birth);
    if (profile.sex)           setSex(profile.sex);
    if (profile.unit_system)   setUnitSystem(profile.unit_system);
    if (profile.check_in_day)  setCheckInDay(profile.check_in_day);
    if (profile.check_in_reminder_time) setCheckInReminderTime(profile.check_in_reminder_time);
    if (profile.activity_level) setActivityLevel(profile.activity_level);
    if (profile.dietary_preference) setDietaryPreference(profile.dietary_preference);
    if (profile.dietary_additional != null) setDietaryAdditional(profile.dietary_additional);
    if (profile.dislikes != null) setDislikes(profile.dislikes);
    if (profile.food_allergies != null) setFoodAllergies(profile.food_allergies);
    if (profile.meals_per_day) setMealsPerDay(String(profile.meals_per_day));
    if (profile.typical_training_time) setTrainingTime(profile.typical_training_time);
    if (profile.nutrition_view_mode) setNutritionViewMode(profile.nutrition_view_mode);
    if (typeof profile.show_meal_macros === "boolean") setShowMealMacros(profile.show_meal_macros);
    if (typeof profile.show_day_macros === "boolean") setShowDayMacros(profile.show_day_macros);
    if (profile.gym_experience) setGymExperience(profile.gym_experience);
    if (profile.training_days_per_week) setTrainingDays(profile.training_days_per_week);
    if (profile.split_mode) setSplitMode(profile.split_mode);
    if (profile.daily_step_target) setDailyStepTarget(String(profile.daily_step_target));
    if (profile.goal_type) setGoalType(profile.goal_type);

    const isImperial = (profile.unit_system || "metric") === "imperial";

    if (profile.height_cm != null) {
      setHeightInput(isImperial
        ? String(Math.round(profile.height_cm * 0.393701 * 10) / 10)
        : String(profile.height_cm));
    }
    if (profile.starting_weight_kg != null) {
      setStartingWeightInput(isImperial
        ? String(Math.round(profile.starting_weight_kg * 2.20462 * 10) / 10)
        : String(profile.starting_weight_kg));
    }
    if (profile.body_fat_pct != null) setBodyFatPctInput(String(profile.body_fat_pct));
    if (profile.target_weight_kg != null) {
      setTargetWeightInput(isImperial
        ? String(Math.round(profile.target_weight_kg * 2.20462 * 10) / 10)
        : String(profile.target_weight_kg));
    }
    if (profile.weekly_weight_change_target_kg != null) {
      setWeeklyRateInput(isImperial
        ? String(Math.round(profile.weekly_weight_change_target_kg * 2.20462 * 100) / 100)
        : String(profile.weekly_weight_change_target_kg));
    }
  }, [profile]);

  // ── Load email from Supabase auth ────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  // ── Load UI prefs from localStorage ─────────────────────────────────────────
  useEffect(() => {
    setUiMotion(localStorage.getItem("pp_ui_motion") || "medium");
    setUiContrast(localStorage.getItem("pp_ui_contrast") || "normal");
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const triggerNutritionRecalc = useCallback(async () => {
    if (!profile?.user_id) return;
    authFetch("/api/nutrition/init", {
      method: "POST",
      body: JSON.stringify({ user_id: profile.user_id }),
    }).catch(() => {});
  }, [profile]);

  const patch = useCallback(async (data, { recalc = false } = {}) => {
    const { error: e } = await updateProfile(data);
    if (e) {
      showToast(typeof e === "string" ? e : String(e), "error");
      return false;
    }
    if (recalc) triggerNutritionRecalc();
    return true;
  }, [updateProfile, showToast, triggerNutritionRecalc]);

  const isImperial = unitSystem === "imperial";
  const heightUnit = isImperial ? "in (total)" : "cm";
  const weightUnit = isImperial ? "lbs" : "kg";
  const rateUnit   = isImperial ? "lbs/wk" : "kg/wk";

  const saveUiPrefs = useCallback((next = {}) => {
    const motion   = next.motion   !== undefined ? next.motion   : uiMotion;
    const contrast = next.contrast !== undefined ? next.contrast : uiContrast;
    localStorage.setItem("pp_ui_motion",   motion);
    localStorage.setItem("pp_ui_contrast", contrast);
    document.documentElement.dataset.motion   = motion;
    document.documentElement.dataset.contrast = contrast;
  }, [uiMotion, uiContrast]);

  // ── Section renderers ─────────────────────────────────────────────────────────

  // ── 1. Profile ───────────────────────────────────────────────────────────────
  const renderProfile = () => (
    <>
      <div className="st-card">
        <div className="st-card-title">Identity</div>

        <div className="st-field">
          <label className="st-label">Full name</label>
          <div className="st-input-row">
            <input
              className="st-input"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
            <button
              className="st-save-btn"
              disabled={savingProfile}
              onClick={async () => {
                setSavingProfile(true);
                const ok = await patch({ full_name: fullName });
                setSavingProfile(false);
                if (ok) showToast("Name saved");
              }}
            >
              Save
            </button>
          </div>
        </div>

        <div className="st-field">
          <label className="st-label">Email</label>
          <div className="st-readonly-field">{userEmail || "—"}</div>
        </div>

        <div className="st-field">
          <label className="st-label">Date of birth</label>
          <div className="st-input-row">
            <input
              className="st-input"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
            <button
              className="st-save-btn"
              disabled={savingProfile}
              onClick={async () => {
                setSavingProfile(true);
                const ok = await patch({ date_of_birth: dob });
                setSavingProfile(false);
                if (ok) showToast("Date of birth saved");
              }}
            >
              Save
            </button>
          </div>
        </div>

        <div className="st-field">
          <label className="st-label">Sex</label>
          <div className="st-pill-group">
            {[
              { value: "male",              label: "Male" },
              { value: "female",            label: "Female" },
              { value: "prefer_not_to_say", label: "Prefer not to say" },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`st-pill${sex === opt.value ? " active" : ""}`}
                onClick={async () => {
                  setSex(opt.value);
                  await patch({ sex: opt.value });
                  showToast("Sex updated");
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="st-card">
        <div className="st-card-title">Security</div>
        <div className="st-field">
          <label className="st-label">Password</label>
          <button
            className="st-save-btn"
            onClick={async () => {
              if (!userEmail) return;
              const { error } = await supabase.auth.resetPasswordForEmail(userEmail);
              if (error) {
                showToast(error.message, "error");
              } else {
                setPwResetSent(true);
                showToast("Password reset email sent");
              }
            }}
          >
            Change password
          </button>
          {pwResetSent && (
            <span className="st-pw-success">
              Password reset email sent to {userEmail}
            </span>
          )}
        </div>
      </div>
    </>
  );

  // ── 2. Body & Goal ───────────────────────────────────────────────────────────
  const renderBody = () => (
    <>
      <div className="st-card">
        <div className="st-card-title">Body measurements</div>

        <div className="st-field">
          <label className="st-label">Height ({heightUnit})</label>
          <input
            className="st-input"
            type="number"
            min="0"
            step="0.1"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            placeholder={isImperial ? "e.g. 70" : "e.g. 178"}
          />
        </div>
        <div className="st-field">
          <label className="st-label">Starting weight ({weightUnit})</label>
          <input
            className="st-input"
            type="number"
            min="0"
            step="0.1"
            value={startingWeightInput}
            onChange={(e) => setStartingWeightInput(e.target.value)}
            placeholder={isImperial ? "e.g. 185" : "e.g. 84"}
          />
        </div>
        <div className="st-field">
          <label className="st-label">Body fat % (optional)</label>
          <input
            className="st-input"
            type="number"
            min="0"
            max="70"
            step="0.1"
            value={bodyFatPctInput}
            onChange={(e) => setBodyFatPctInput(e.target.value)}
            placeholder="e.g. 18"
          />
        </div>
        <div className="st-field">
          <label className="st-label">Target weight ({weightUnit})</label>
          <input
            className="st-input"
            type="number"
            min="0"
            step="0.1"
            value={targetWeightInput}
            onChange={(e) => setTargetWeightInput(e.target.value)}
            placeholder={isImperial ? "e.g. 165" : "e.g. 75"}
          />
        </div>
      </div>

      <div className="st-card">
        <div className="st-card-title">Goal</div>

        <div className="st-field">
          <label className="st-label">Goal type</label>
          <div className="st-pill-group">
            {[
              { value: "lose",     label: "Lose Fat" },
              { value: "maintain", label: "Maintain" },
              { value: "gain",     label: "Gain Muscle" },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`st-pill${goalType === opt.value ? " active" : ""}`}
                onClick={() => setGoalType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {goalType !== "maintain" && (
          <div className="st-field">
            <label className="st-label">Weekly rate ({rateUnit})</label>
            <input
              className="st-input"
              type="number"
              min="0"
              step="0.05"
              value={weeklyRateInput}
              onChange={(e) => setWeeklyRateInput(e.target.value)}
              placeholder={isImperial ? "e.g. 0.5" : "e.g. 0.25"}
            />
          </div>
        )}

        <div className="st-info-note" style={{ marginBottom: "0.85rem" }}>
          Saving updates your calorie targets automatically.
        </div>

        <button
          className="st-save-btn"
          disabled={savingBody}
          onClick={async () => {
            setSavingBody(true);
            const p = {};
            const hN = parseFloat(heightInput);
            const wN = parseFloat(startingWeightInput);
            const bN = parseFloat(bodyFatPctInput);
            const tN = parseFloat(targetWeightInput);
            const rN = parseFloat(weeklyRateInput);

            if (!isNaN(hN) && hN > 0)
              p.height_cm = isImperial ? Math.round((hN / 0.393701) * 10) / 10 : hN;
            if (!isNaN(wN) && wN > 0)
              p.starting_weight_kg = isImperial ? Math.round((wN / 2.20462) * 100) / 100 : wN;
            if (!isNaN(bN) && bN >= 0)
              p.body_fat_pct = bN;
            if (!isNaN(tN) && tN > 0)
              p.target_weight_kg = isImperial ? Math.round((tN / 2.20462) * 100) / 100 : tN;

            p.goal_type = goalType;
            if (goalType !== "maintain") {
              if (!isNaN(rN) && rN > 0)
                p.weekly_weight_change_target_kg = isImperial ? Math.round((rN / 2.20462) * 1000) / 1000 : rN;
            } else {
              p.weekly_weight_change_target_kg = 0;
            }

            const ok = await patch(p, { recalc: true });
            setSavingBody(false);
            if (ok) showToast("Body & goal saved — targets recalculated");
          }}
        >
          Save &amp; Recalculate
        </button>
      </div>
    </>
  );

  // ── 3. Nutrition ─────────────────────────────────────────────────────────────
  const renderNutrition = () => (
    <>
      <div className="st-card">
        <div className="st-card-title">Activity & Diet</div>

        <div className="st-field">
          <label className="st-label">Activity level</label>
          <select
            className="st-select"
            value={activityLevel}
            onChange={async (e) => {
              setActivityLevel(e.target.value);
              const ok = await patch({ activity_level: e.target.value }, { recalc: true });
              if (ok) showToast("Activity level saved");
            }}
          >
            {ACTIVITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
            ))}
          </select>
        </div>

        <div className="st-field">
          <label className="st-label">Dietary preference</label>
          <div className="st-pill-group">
            {DIETARY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`st-pill${dietaryPreference === opt.value ? " active" : ""}`}
                onClick={async () => {
                  setDietaryPreference(opt.value);
                  const ok = await patch({ dietary_preference: opt.value });
                  if (ok) showToast("Diet preference saved");
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="st-field">
          <label className="st-label">Additional dietary notes</label>
          <input
            className="st-input"
            type="text"
            value={dietaryAdditional}
            onChange={(e) => setDietaryAdditional(e.target.value)}
            onBlur={async () => {
              if (dietaryAdditional !== (profile?.dietary_additional ?? "")) {
                const ok = await patch({ dietary_additional: dietaryAdditional });
                if (ok) showToast("Notes saved");
              }
            }}
            placeholder="e.g. no red meat, halal, kosher"
          />
        </div>

        <div className="st-field">
          <label className="st-label">Dislikes</label>
          <input
            className="st-input"
            type="text"
            value={dislikes}
            onChange={(e) => setDislikes(e.target.value)}
            onBlur={async () => {
              if (dislikes !== (profile?.dislikes ?? "")) {
                const ok = await patch({ dislikes });
                if (ok) showToast("Dislikes saved");
              }
            }}
            placeholder="e.g. mushrooms, cilantro, olives"
          />
        </div>

        <div className="st-field">
          <label className="st-label">Food allergies / intolerances</label>
          <textarea
            className="st-input"
            rows={3}
            style={{ resize: "vertical" }}
            value={foodAllergies}
            onChange={(e) => setFoodAllergies(e.target.value)}
            onBlur={async () => {
              if (foodAllergies !== (profile?.food_allergies ?? "")) {
                const ok = await patch({ food_allergies: foodAllergies });
                if (ok) showToast("Allergies saved");
              }
            }}
            placeholder="e.g. peanuts, shellfish, gluten, dairy"
          />
        </div>
      </div>

      <div className="st-card">
        <div className="st-card-title">Schedule</div>

        <div className="st-field">
          <label className="st-label">Meals per day</label>
          <select
            className="st-select"
            value={mealsPerDay}
            onChange={async (e) => {
              setMealsPerDay(e.target.value);
              const ok = await patch({ meals_per_day: Number(e.target.value) });
              if (ok) showToast("Meals per day saved");
            }}
          >
            {MEALS_PER_DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="st-field">
          <label className="st-label">Typical training time</label>
          <select
            className="st-select"
            value={trainingTime}
            onChange={async (e) => {
              setTrainingTime(e.target.value);
              const ok = await patch({ typical_training_time: e.target.value });
              if (ok) showToast("Training time saved");
            }}
          >
            {TRAINING_TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="st-card">
        <div className="st-card-title">Display preferences</div>

        <div className="st-field">
          <label className="st-label">Nutrition view mode</label>
          <div className="st-pill-group">
            {[
              { value: "macros",    label: "Macros" },
              { value: "meal_plan", label: "Meal Plan" },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`st-pill${nutritionViewMode === opt.value ? " active" : ""}`}
                onClick={async () => {
                  setNutritionViewMode(opt.value);
                  const ok = await patch({ nutrition_view_mode: opt.value });
                  if (ok) showToast("View mode saved");
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="st-toggle-row">
          <span className="st-toggle-label">Show meal macros</span>
          <Toggle
            id="toggle-meal-macros"
            checked={showMealMacros}
            onChange={async (e) => {
              setShowMealMacros(e.target.checked);
              const ok = await patch({ show_meal_macros: e.target.checked });
              if (ok) showToast(e.target.checked ? "Meal macros on" : "Meal macros off");
            }}
          />
        </div>

        <div className="st-toggle-row">
          <span className="st-toggle-label">Show full-day macros</span>
          <Toggle
            id="toggle-day-macros"
            checked={showDayMacros}
            onChange={async (e) => {
              setShowDayMacros(e.target.checked);
              const ok = await patch({ show_day_macros: e.target.checked });
              if (ok) showToast(e.target.checked ? "Day macros on" : "Day macros off");
            }}
          />
        </div>
      </div>
    </>
  );

  // ── 4. Training ──────────────────────────────────────────────────────────────
  const renderTraining = () => (
    <>
      <div className="st-card">
        <div className="st-card-title">Experience</div>

        <div className="st-field">
          <label className="st-label">Gym experience</label>
          <div className="st-pill-group">
            {[
              { value: "beginner",     label: "Beginner (<1yr)" },
              { value: "intermediate", label: "Intermediate (1–3yr)" },
              { value: "advanced",     label: "Advanced (3+yr)" },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`st-pill${gymExperience === opt.value ? " active" : ""}`}
                onClick={async () => {
                  setGymExperience(opt.value);
                  const ok = await patch({ gym_experience: opt.value });
                  if (ok) showToast("Experience saved");
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="st-card">
        <div className="st-card-title">Schedule</div>

        <div className="st-field">
          <label className="st-label">Training days per week</label>
          <div className="st-num-btn-group">
            {[1,2,3,4,5,6,7].map((n) => (
              <button
                key={n}
                className={`st-num-btn${trainingDays === n ? " active" : ""}`}
                onClick={async () => {
                  setTrainingDays(n);
                  const ok = await patch({ training_days_per_week: n });
                  if (ok) showToast(`${n} training days saved`);
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="st-field">
          <label className="st-label">Split mode</label>
          <div className="st-pill-group">
            {[
              { value: "fixed",   label: "Fixed (weekly)" },
              { value: "rolling", label: "Rolling (cycle)" },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`st-pill${splitMode === opt.value ? " active" : ""}`}
                onClick={async () => {
                  setSplitMode(opt.value);
                  const ok = await patch({ split_mode: opt.value });
                  if (ok) showToast("Split mode saved");
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="st-info-note">
          Your training schedule is managed in the Training page.
        </div>
      </div>
    </>
  );

  // ── 5. Activity ──────────────────────────────────────────────────────────────
  const renderActivity = () => (
    <div className="st-card">
      <div className="st-card-title">Daily steps</div>

      <div className="st-field">
        <label className="st-label">Daily step target</label>
        <div className="st-input-row">
          <input
            className="st-input"
            type="number"
            min="0"
            step="500"
            value={dailyStepTarget}
            onChange={(e) => setDailyStepTarget(e.target.value)}
            placeholder="10000"
          />
          <button
            className="st-save-btn"
            disabled={savingSteps}
            onClick={async () => {
              setSavingSteps(true);
              const n = parseInt(dailyStepTarget, 10);
              if (!isNaN(n) && n >= 0) {
                const ok = await patch({ daily_step_target: n });
                if (ok) showToast("Step target saved");
              }
              setSavingSteps(false);
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="st-field">
        <label className="st-label">Presets</label>
        <div className="st-pill-group">
          {[5000, 7500, 10000, 12500, 15000].map((n) => (
            <button
              key={n}
              className={`st-pill${Number(dailyStepTarget) === n ? " active" : ""}`}
              onClick={() => setDailyStepTarget(String(n))}
            >
              {n.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div className="st-info-note">
        Your step target appears on the Activity page.
      </div>
    </div>
  );

  // ── 6. Check-Ins ─────────────────────────────────────────────────────────────
  const renderCheckIns = () => (
    <>
      <div className="st-card">
        <div className="st-card-title">Schedule</div>

        <div className="st-field">
          <label className="st-label">Check-in day</label>
          <select
            className="st-select"
            value={checkInDay}
            onChange={async (e) => {
              setCheckInDay(e.target.value);
              const ok = await patch({ check_in_day: e.target.value });
              if (ok) showToast("Check-in day saved");
            }}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="st-field">
          <label className="st-label">Check-in reminder time</label>
          <div className="st-input-row">
            <input
              className="st-input"
              type="time"
              value={checkInReminderTime}
              onChange={(e) => setCheckInReminderTime(e.target.value)}
            />
            <button
              className="st-save-btn"
              disabled={savingCheckIn}
              onClick={async () => {
                setSavingCheckIn(true);
                const ok = await patch({ check_in_reminder_time: checkInReminderTime });
                setSavingCheckIn(false);
                if (ok) showToast("Reminder time saved");
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="st-danger-card">
        <div className="st-card-title">Danger zone</div>
        <p className="st-section-desc">
          Permanently clears all your weekly check-in records. This cannot be undone.
        </p>
        <button
          className="st-danger-btn"
          disabled={clearingHistory}
          onClick={async () => {
            if (!window.confirm("Delete all check-in history? This cannot be undone.")) return;
            setClearingHistory(true);
            try {
              const res = await authFetch("/api/checkins/history", { method: "DELETE" });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json.ok) {
                showToast("Check-in history cleared");
              } else {
                showToast(json.error || "Failed to clear history", "error");
              }
            } catch {
              showToast("Network error", "error");
            }
            setClearingHistory(false);
          }}
        >
          {clearingHistory ? "Clearing…" : "Clear check-in history"}
        </button>
      </div>
    </>
  );

  // ── 7. The Pilot ─────────────────────────────────────────────────────────────
  const renderPilot = () => (
    <>
      <div className="st-card">
        <div className="st-card-title">About The Pilot</div>
        <div className="st-info-note" style={{ marginBottom: "0.85rem" }}>
          The Physique Pilot operates as a Supportive Coach — it adapts advice positively
          to your data and goals. PED discussion is not supported. Responses are general
          fitness guidance only.
        </div>

        <div className="st-field">
          <label className="st-label">Coach tone</label>
          <div>
            <span className="st-badge">Supportive</span>
            <span style={{ marginLeft: "0.6rem", fontSize: "0.68rem", color: "var(--text-3)", fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
              — customisation coming soon
            </span>
          </div>
        </div>
      </div>

      <div className="st-danger-card">
        <div className="st-card-title">Danger zone</div>
        <p className="st-section-desc">
          Clears your entire conversation history with The Pilot. Your profile and goals
          are unaffected.
        </p>
        <button
          className="st-danger-btn"
          disabled={clearingConvo}
          onClick={async () => {
            if (!window.confirm("Clear all conversation history with The Pilot?")) return;
            setClearingConvo(true);
            setConvoClearSuccess(false);
            try {
              const res = await authFetch("/api/coach/history", { method: "DELETE" });
              if (res.ok) {
                setConvoClearSuccess(true);
                showToast("Conversation history cleared");
              } else {
                const j = await res.json().catch(() => ({}));
                showToast(j.error || "Failed to clear history", "error");
              }
            } catch {
              showToast("Network error", "error");
            }
            setClearingConvo(false);
          }}
        >
          {clearingConvo ? "Clearing…" : "Clear conversation history"}
        </button>
        {convoClearSuccess && (
          <span className="st-success-inline">Conversation history cleared</span>
        )}
      </div>
    </>
  );

  // ── 8. App ───────────────────────────────────────────────────────────────────
  const renderApp = () => (
    <>
      <div className="st-card">
        <div className="st-card-title">Units</div>
        <div className="st-field">
          <label className="st-label">Unit system</label>
          <div className="st-pill-group">
            {[
              { value: "metric",   label: "Metric" },
              { value: "imperial", label: "Imperial" },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`st-pill${unitSystem === opt.value ? " active" : ""}`}
                onClick={async () => {
                  setUnitSystem(opt.value);
                  const ok = await patch({ unit_system: opt.value });
                  if (ok) showToast(`Units set to ${opt.label}`);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="st-card">
        <div className="st-card-title">Accessibility</div>

        <div className="st-field">
          <label className="st-label">Motion</label>
          <div className="st-pill-group">
            {[
              { value: "low",    label: "Reduced" },
              { value: "medium", label: "Medium" },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`st-pill${uiMotion === opt.value ? " active" : ""}`}
                onClick={() => {
                  setUiMotion(opt.value);
                  saveUiPrefs({ motion: opt.value });
                  showToast(`Motion set to ${opt.label}`);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="st-field">
          <label className="st-label">Contrast</label>
          <div className="st-pill-group">
            {[
              { value: "normal", label: "Normal" },
              { value: "high",   label: "High" },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`st-pill${uiContrast === opt.value ? " active" : ""}`}
                onClick={() => {
                  setUiContrast(opt.value);
                  saveUiPrefs({ contrast: opt.value });
                  showToast(`Contrast set to ${opt.label}`);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="st-card">
        <div className="st-card-title">App tour</div>
        <p className="st-section-desc">Run the guided walkthrough again to revisit what each section does.</p>
        <button
          className="st-save-btn"
          onClick={async () => {
            if (profile?.user_id) {
              await supabase
                .from("profiles")
                .update({ tour_completed: false })
                .eq("user_id", profile.user_id);
            }
            restartTour();
            showToast("Tour restarted");
          }}
        >
          Replay Tour
        </button>
      </div>
    </>
  );

  // ── 9. Data & Privacy ────────────────────────────────────────────────────────
  const renderPrivacy = () => (
    <>
      <div className="st-card">
        <div className="st-card-title">Export</div>
        <p className="st-section-desc">Download all your data as a JSON file.</p>
        <button
          className="st-save-btn"
          disabled={exportLoading}
          onClick={async () => {
            setExportLoading(true);
            try {
              const res = await authFetch("/api/user/export");
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                showToast(j.error || "Export failed", "error");
              } else {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                const date = new Date().toISOString().slice(0, 10);
                a.href = url;
                a.download = `physique-pilot-export-${date}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                showToast("Export downloaded");
              }
            } catch {
              showToast("Network error", "error");
            }
            setExportLoading(false);
          }}
        >
          {exportLoading ? "Exporting…" : "Export as JSON"}
        </button>
      </div>

      <div className="st-danger-card">
        <div className="st-card-title">Reset all progress</div>
        <p className="st-section-desc">
          Deletes all logs — weight, nutrition, training, cardio, steps, check-ins, photos.
          Your account and settings are kept.
        </p>
        <button
          className="st-danger-btn"
          disabled={resetLoading}
          onClick={async () => {
            if (!window.confirm("Reset all progress? This will delete all your logs and cannot be undone.")) return;
            setResetLoading(true);
            try {
              const res = await authFetch("/api/user/reset-progress", { method: "DELETE" });
              const j = await res.json().catch(() => ({}));
              if (res.ok && j.ok) {
                showToast("All progress data cleared");
              } else {
                showToast(j.error || "Reset failed", "error");
              }
            } catch {
              showToast("Network error", "error");
            }
            setResetLoading(false);
          }}
        >
          {resetLoading ? "Resetting…" : "Reset All Progress"}
        </button>
      </div>

      <div className="st-danger-card">
        <div className="st-card-title">Delete account</div>
        <p className="st-section-desc">
          Permanently deletes your account and all data. This cannot be undone.
        </p>

        <div className="st-field">
          <label className="st-label">Enter your password to confirm</label>
          <input
            className="st-input"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </div>

        <button
          className="st-danger-btn"
          disabled={deleteLoading || !deletePassword}
          onClick={async () => {
            if (!window.confirm("Permanently delete your account and all data? This cannot be undone.")) return;
            setDeleteLoading(true);
            try {
              // Verify password
              const { error: signInErr } = await supabase.auth.signInWithPassword({
                email: userEmail,
                password: deletePassword,
              });
              if (signInErr) {
                showToast("Incorrect password", "error");
                setDeleteLoading(false);
                return;
              }
              // Delete account
              const res = await authFetch("/api/user/delete-account", { method: "DELETE" });
              if (res.ok) {
                await supabase.auth.signOut();
              } else {
                const j = await res.json().catch(() => ({}));
                showToast(j.error || "Delete failed", "error");
              }
            } catch {
              showToast("Network error", "error");
            }
            setDeleteLoading(false);
          }}
        >
          {deleteLoading ? "Deleting…" : "Delete My Account"}
        </button>
      </div>
    </>
  );

  // ── Section content map ───────────────────────────────────────────────────────
  const sectionContent = {
    profile:   renderProfile,
    body:      renderBody,
    nutrition: renderNutrition,
    training:  renderTraining,
    activity:  renderActivity,
    checkins:  renderCheckIns,
    pilot:     renderPilot,
    app:       renderApp,
    privacy:   renderPrivacy,
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return <PhysiquePilotLoader />;

  const currentSection = SECTIONS.find((s) => s.key === activeSection);

  return (
    <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto" }}>
      <style>{CSS}</style>

      <PageHeader title="SETTINGS" />

      <div className="st-layout">
        {/* Left nav */}
        <nav className="st-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              className={`st-nav-btn${activeSection === s.key ? " active" : ""}`}
              onClick={() => setActiveSection(s.key)}
            >
              <span className="st-nav-icon">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="st-content">
          <div className="st-section-title">
            {currentSection?.label}
          </div>
          {sectionContent[activeSection]?.()}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`st-toast ${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default Settings;
