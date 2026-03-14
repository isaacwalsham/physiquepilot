import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { apiFetch } from "../lib/api";

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CAPS = {
  height_cm: { min: 120, max: 230 },
  weight_kg: { min: 30, max: 300 },
  weekly_loss_kg: { min: 0.1, max: 1.0 },
  weekly_gain_kg: { min: 0.05, max: 0.3 },
  custom_calories: { min: 1200, max: 6000 },
  steps_per_day: { min: 0, max: 20000 },
  cardio_minutes_per_week: { min: 0, max: 600 },
  cardio_avg_hr: { min: 0, max: 220 }
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const TOTAL_STEPS = 7;

const STEP_META = [
  { code: "ONBOARDING // BODY METRICS",        label: "Body metrics"           },
  { code: "ONBOARDING // PERSONAL DATA",       label: "About you"              },
  { code: "ONBOARDING // GOAL & CALORIES",     label: "Goal & calories"        },
  { code: "ONBOARDING // TRAINING SETUP",      label: "Training setup"         },
  { code: "ONBOARDING // ACTIVITY BASELINE",   label: "Activity baseline"      },
  { code: "ONBOARDING // NUTRITION PREFS",     label: "Nutrition preferences"  },
  { code: "ONBOARDING // SAFETY & CONFIRM",    label: "Safety"                 },
];

const CSS = `
  @keyframes ldBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.15; }
  }

  .ob-wrap {
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0 1rem 3rem;
    box-sizing: border-box;
  }

  /* ── progress rail ── */
  .ob-progress-rail {
    width: 100%;
    max-width: 520px;
    margin: 2rem auto 0;
  }
  .ob-progress-bar-track {
    width: 100%;
    height: 3px;
    background: var(--line-1);
    border-radius: 99px;
    overflow: hidden;
  }
  .ob-progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-1), var(--accent-3));
    border-radius: 99px;
    transition: width 0.4s ease;
  }
  .ob-progress-label {
    margin-top: 0.45rem;
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  /* ── card ── */
  .ob-card {
    width: 100%;
    max-width: 520px;
    margin: 1.25rem auto 0;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-lg);
    background: rgba(8, 3, 5, 0.92);
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(181, 21, 60, 0.08);
    overflow: hidden;
  }

  /* ── card topbar ── */
  .ob-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 1.1rem;
    border-bottom: 1px solid var(--line-1);
    background: rgba(15, 5, 10, 0.6);
  }
  .ob-topbar-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .ob-topbar-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-3);
    animation: ldBlink 1.4s ease-in-out infinite;
    flex-shrink: 0;
  }
  .ob-topbar-right {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent-3);
  }

  /* ── card body ── */
  .ob-body {
    padding: 1.6rem 1.5rem 1.4rem;
    display: grid;
    gap: 1.25rem;
  }

  .ob-step-heading {
    margin: 0 0 0.15rem;
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-1);
    line-height: 1.2;
  }
  .ob-step-desc {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-2);
    line-height: 1.7;
  }

  /* ── form elements ── */
  .ob-field-group {
    display: grid;
    gap: 0.45rem;
  }
  .ob-label {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .ob-input {
    width: 100%;
    background: rgba(10, 5, 8, 0.9);
    border: 1px solid var(--line-1);
    color: var(--text-1);
    border-radius: var(--radius-sm);
    padding: 0.72rem 0.9rem;
    font-family: var(--font-body);
    font-size: 0.95rem;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.18s, box-shadow 0.18s;
    appearance: none;
    -webkit-appearance: none;
  }
  .ob-input:focus {
    border-color: var(--accent-3);
    box-shadow: 0 0 0 3px rgba(222, 41, 82, 0.16);
  }
  .ob-input::placeholder {
    color: var(--text-3);
    opacity: 0.7;
  }
  .ob-input option {
    background: #0e060a;
    color: var(--text-1);
  }
  .ob-textarea {
    resize: vertical;
    min-height: 100px;
  }
  .ob-help {
    font-size: 0.8rem;
    color: var(--text-3);
    line-height: 1.55;
    margin-top: 0.1rem;
  }

  /* ── grid ── */
  .ob-grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.85rem;
  }

  /* ── pill buttons (option selectors) ── */
  .ob-pills {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.1rem;
  }
  .ob-pill {
    font-family: var(--font-display);
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    border: 1px solid var(--line-1);
    background: transparent;
    color: var(--text-3);
    transition: background 0.18s, border-color 0.18s, color 0.18s;
    line-height: 1.3;
  }
  .ob-pill.active {
    background: linear-gradient(135deg, rgba(181,21,60,0.3), rgba(138,15,46,0.2));
    border-color: var(--accent-2);
    color: var(--text-1);
  }
  .ob-pill:hover:not(.active) {
    border-color: var(--line-2);
    color: var(--text-2);
  }

  /* day pill (slightly smaller) */
  .ob-day-pill {
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    padding: 0.42rem 0.75rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    border: 1px solid var(--line-1);
    background: transparent;
    color: var(--text-3);
    transition: background 0.18s, border-color 0.18s, color 0.18s;
  }
  .ob-day-pill.active {
    background: linear-gradient(135deg, rgba(181,21,60,0.3), rgba(138,15,46,0.2));
    border-color: var(--accent-2);
    color: var(--text-1);
  }
  .ob-day-pill:hover:not(.active) {
    border-color: var(--line-2);
    color: var(--text-2);
  }

  /* ── footer ── */
  .ob-footer {
    padding: 1rem 1.5rem 1.3rem;
    border-top: 1px solid var(--line-1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    background: rgba(15, 5, 10, 0.4);
  }
  .ob-footer-hint {
    font-size: 0.75rem;
    color: var(--text-3);
    font-family: var(--font-display);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .ob-footer-btns {
    display: flex;
    gap: 0.5rem;
  }

  /* primary button */
  .ob-btn-primary {
    background: linear-gradient(135deg, var(--accent-2), var(--accent-1));
    color: #fff;
    font-family: var(--font-display);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.72rem 1.75rem;
    border-radius: var(--radius-sm);
    border: none;
    cursor: pointer;
    font-size: 0.78rem;
    transition: opacity 0.18s, box-shadow 0.18s;
  }
  .ob-btn-primary:hover:not(:disabled) {
    box-shadow: 0 0 18px rgba(181, 21, 60, 0.45);
  }
  .ob-btn-primary:disabled {
    opacity: 0.55;
    cursor: default;
  }

  /* ghost / back button */
  .ob-btn-ghost {
    border: 1px solid var(--line-1);
    background: transparent;
    color: var(--text-2);
    font-family: var(--font-display);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.72rem 1.3rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.78rem;
    transition: border-color 0.18s, color 0.18s;
  }
  .ob-btn-ghost:hover:not(:disabled) {
    border-color: var(--line-2);
    color: var(--text-1);
  }
  .ob-btn-ghost:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* ── error box ── */
  .ob-error {
    padding: 0.8rem 1rem;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255, 79, 115, 0.4);
    background: rgba(255, 79, 115, 0.08);
    color: var(--bad);
    font-size: 0.86rem;
    line-height: 1.5;
  }

  /* ── checkbox row ── */
  .ob-check-row {
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
  }
  .ob-checkbox {
    margin-top: 0.18rem;
    accent-color: var(--accent-2);
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    cursor: pointer;
  }
  .ob-check-label {
    color: var(--text-2);
    font-size: 0.875rem;
    line-height: 1.55;
  }

  /* ── complete step ── */
  .ob-complete-wrap {
    display: grid;
    gap: 1.4rem;
    text-align: center;
    padding: 0.5rem 0 0.25rem;
  }
  .ob-complete-head {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
  }
  .ob-complete-title {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: 0.04em;
    margin: 0;
    text-transform: uppercase;
  }
  .ob-complete-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--ok);
    animation: ldBlink 1s ease-in-out infinite;
    flex-shrink: 0;
  }
  .ob-complete-sub {
    color: var(--text-2);
    font-size: 0.9rem;
    line-height: 1.7;
    margin: 0;
  }
  .ob-mission-btn {
    background: linear-gradient(135deg, var(--accent-2), var(--accent-1));
    color: #fff;
    font-family: var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.9rem 2.5rem;
    border-radius: var(--radius-sm);
    border: none;
    cursor: pointer;
    font-size: 0.88rem;
    margin: 0 auto;
    display: block;
    transition: opacity 0.18s, box-shadow 0.18s;
  }
  .ob-mission-btn:hover:not(:disabled) {
    box-shadow: 0 0 24px rgba(181, 21, 60, 0.55);
  }
  .ob-mission-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  /* ── loading / fatal screens ── */
  .ob-status-card {
    width: 100%;
    max-width: 520px;
    margin: 3rem auto 0;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-lg);
    background: rgba(8, 3, 5, 0.92);
    box-shadow: 0 24px 60px rgba(0,0,0,0.6);
    padding: 2.5rem 2rem;
    text-align: center;
  }
  .ob-status-code {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 1.25rem;
  }
  .ob-status-title {
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--text-1);
    margin: 0 0 0.6rem;
  }
  .ob-status-sub {
    color: var(--text-3);
    font-size: 0.88rem;
  }

  /* ── back to home link ── */
  .ob-home-link {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
    background: transparent;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.85rem;
    cursor: pointer;
    transition: color 0.18s, border-color 0.18s;
  }
  .ob-home-link:hover {
    color: var(--text-2);
    border-color: var(--line-2);
  }

  /* ── saving overlay label ── */
  .ob-saving-badge {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-3);
    animation: ldBlink 1s ease-in-out infinite;
  }

  @media (max-width: 540px) {
    .ob-grid2 {
      grid-template-columns: 1fr;
    }
    .ob-body {
      padding: 1.25rem 1.1rem 1.1rem;
    }
    .ob-footer {
      padding: 0.85rem 1.1rem 1.1rem;
    }
  }
`;

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [hydratedStep, setHydratedStep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState("male");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const [bodyFatPctInput, setBodyFatPctInput] = useState("");
  const [defaultLissOptIn, setDefaultLissOptIn] = useState(true);

  const [unitSystem, setUnitSystem] = useState("metric");
  const [heightInput, setHeightInput] = useState("");
  const [startingWeightInput, setStartingWeightInput] = useState("");
  const [goalWeightInput, setGoalWeightInput] = useState("");

  const [goalType, setGoalType] = useState("maintain");

  const inferGoalTypeFromWeights = () => {
    const startKg = parseWeightToKg(startingWeightInput);
    const goalKg = parseWeightToKg(goalWeightInput);
    if (!startKg || !goalKg) return goalType;

    const diff = goalKg - startKg;

    if (Math.abs(diff) <= 2) return "maintain";

    if (diff < -2) return "lose";

    if (diff > 2) return "gain";

    return goalType;
  };

  useEffect(() => {
    const inferred = inferGoalTypeFromWeights();
    if (inferred !== goalType) {
      setGoalType(inferred);
    }
  }, [startingWeightInput, goalWeightInput, unitSystem]);

  const [weeklyChangeInput, setWeeklyChangeInput] = useState("");
  const [calorieMode, setCalorieMode] = useState("ai");
  const [customCalories, setCustomCalories] = useState("");

  const [trainingDaysSelected, setTrainingDaysSelected] = useState([]);
  const [splitMode, setSplitMode] = useState("fixed");
  const [trainingFrequencyRange, setTrainingFrequencyRange] = useState("2-4");
  const [rollingStartDate, setRollingStartDate] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [gymType, setGymType] = useState("commercial");
  const [gymChain, setGymChain] = useState("");

  const [activityLevel, setActivityLevel] = useState("moderate");
  const [baselineStepsInput, setBaselineStepsInput] = useState("");
  const [baselineCardioMinutesInput, setBaselineCardioMinutesInput] = useState("");
  const [baselineCardioHrInput, setBaselineCardioHrInput] = useState("");

  const [dietaryPreference, setDietaryPreference] = useState("omnivore");
  const [dietaryAdditional, setDietaryAdditional] = useState("");
  const [foodAllergies, setFoodAllergies] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError("");

      const { data: sessionR } = await supabase.auth.getSession(); const userRes = { user: sessionR?.session?.user }; const userError = null;
      const user = userRes?.user;

      if (userError || !user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError && profileError.code !== "PGRST116") {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (!existingProfile) {
        const { error: upsertErr } = await supabase
          .from("profiles")
          .upsert(
            {
              user_id: user.id,
              email: user.email,
              subscription_status: "inactive",
              is_suspended: false,
              onboarding_complete: false
            },
            { onConflict: "user_id" }
          );

        if (upsertErr) {
          setError(upsertErr.message);
          setLoading(false);
          return;
        }

        const { data: createdProfile, error: createdProfileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (createdProfileErr && createdProfileErr.code !== "PGRST116") {
          setError(createdProfileErr.message);
          setLoading(false);
          return;
        }

        if (!createdProfile) {
          setError("Profile could not be created.");
          setLoading(false);
          return;
        }

        setProfile(createdProfile);
        setLoading(false);
        return;
      }

      setProfile(existingProfile);

      // Resume onboarding where the user left off (if supported by schema)
      if (!hydratedStep) {
        const s = Number(existingProfile.onboarding_step);
        if (Number.isFinite(s) && s >= 1 && s <= 7) {
          setStep(s);
        }
        setHydratedStep(true);
      }

      if (existingProfile.onboarding_complete) {
        // Let the main app guard route the user; keep this consistent with AppLayout.
        navigate("/app", { replace: true });
        return;
      }

      if (existingProfile.unit_system) setUnitSystem(existingProfile.unit_system);

      if (existingProfile.height_cm) {
        if (existingProfile.unit_system === "imperial") {
          const inches = existingProfile.height_cm / 2.54;
          const feet = Math.floor(inches / 12);
          const remInches = Math.round(inches - feet * 12);
          setHeightInput(`${feet}'${remInches}"`);
        } else {
          setHeightInput(String(existingProfile.height_cm));
        }
      }

      if (existingProfile.starting_weight_kg) {
        if (existingProfile.unit_system === "imperial") {
          const lbs = Math.round(existingProfile.starting_weight_kg * 2.20462);
          setStartingWeightInput(String(lbs));
        } else {
          setStartingWeightInput(String(existingProfile.starting_weight_kg));
        }
      }

      if (existingProfile.goal_weight_kg) {
        if (existingProfile.unit_system === "imperial") {
          const lbs = Math.round(existingProfile.goal_weight_kg * 2.20462);
          setGoalWeightInput(String(lbs));
        } else {
          setGoalWeightInput(String(existingProfile.goal_weight_kg));
        }
      }

      if (existingProfile.goal_type) setGoalType(existingProfile.goal_type);

      if (existingProfile.weekly_weight_change_target_kg) {
        if (existingProfile.unit_system === "imperial") {
          const lbs = existingProfile.weekly_weight_change_target_kg * 2.20462;
          setWeeklyChangeInput(String(lbs.toFixed(1)));
        } else {
          setWeeklyChangeInput(String(existingProfile.weekly_weight_change_target_kg));
        }
      }

      if (existingProfile.calorie_mode) setCalorieMode(existingProfile.calorie_mode);
      if (existingProfile.custom_calories) setCustomCalories(String(existingProfile.custom_calories));
      if (existingProfile.training_days) setTrainingDaysSelected(existingProfile.training_days);
      if (existingProfile.split_mode) setSplitMode(existingProfile.split_mode);
      if (existingProfile.training_frequency_range) setTrainingFrequencyRange(existingProfile.training_frequency_range);
      if (existingProfile.rolling_start_date) setRollingStartDate(String(existingProfile.rolling_start_date));
      if (existingProfile.experience_level) setExperienceLevel(existingProfile.experience_level);
      if (existingProfile.gym_type) setGymType(existingProfile.gym_type);
      if (existingProfile.gym_chain) setGymChain(existingProfile.gym_chain);
      if (existingProfile.dietary_preference) setDietaryPreference(existingProfile.dietary_preference);
      if (existingProfile.dietary_additional) setDietaryAdditional(existingProfile.dietary_additional);
      if (existingProfile.food_allergies) setFoodAllergies(existingProfile.food_allergies);
      if (existingProfile.dislikes) setDislikes(existingProfile.dislikes);

      if (existingProfile.first_name) setFirstName(existingProfile.first_name);
      if (existingProfile.last_name) setLastName(existingProfile.last_name);
      if (existingProfile.sex) setSex(existingProfile.sex);
      if (existingProfile.date_of_birth) setDateOfBirth(String(existingProfile.date_of_birth));

      if (typeof existingProfile.body_fat_pct === "number") {
        setBodyFatPctInput(String(existingProfile.body_fat_pct));
      }
      if (typeof existingProfile.default_liss_opt_in === "boolean") {
        setDefaultLissOptIn(existingProfile.default_liss_opt_in);
      }

      if (existingProfile.activity_level) setActivityLevel(existingProfile.activity_level);
      if (existingProfile.baseline_steps_per_day !== null && existingProfile.baseline_steps_per_day !== undefined) {
        setBaselineStepsInput(String(existingProfile.baseline_steps_per_day));
      }
      if (
        existingProfile.baseline_cardio_minutes_per_week !== null &&
        existingProfile.baseline_cardio_minutes_per_week !== undefined
      ) {
        setBaselineCardioMinutesInput(String(existingProfile.baseline_cardio_minutes_per_week));
      }
      if (existingProfile.baseline_cardio_avg_hr !== null && existingProfile.baseline_cardio_avg_hr !== undefined) {
        setBaselineCardioHrInput(String(existingProfile.baseline_cardio_avg_hr));
      }

      setLoading(false);
    };

    loadProfile();
  }, [navigate]);

  const validateStep = (s) => {
    setError("");

    if (s === 1) {
      const heightCm = parseHeightToCm();
      const startingWeightKg = parseWeightToKg(startingWeightInput);
      const goalWeightKg = parseWeightToKg(goalWeightInput);
      const bf = parseBodyFatPct();

      if (!heightCm || !startingWeightKg || !goalWeightKg) {
        setError(
          `Please enter valid height and weights. Height must be ${CAPS.height_cm.min}-${CAPS.height_cm.max} cm. Weight must be ${CAPS.weight_kg.min}-${CAPS.weight_kg.max} kg.`
        );
        return false;
      }

      if (bf === null) {
        setError("Please enter an estimated body fat percentage (3–60%).");
        return false;
      }

      return true;
    }

    if (s === 2) {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first and last name.");
        return false;
      }
      if (!sex) {
        setError("Please choose male or female.");
        return false;
      }
      if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateOfBirth))) {
        setError("Please enter your date of birth.");
        return false;
      }
      return true;
    }

    if (s === 3) {
      const weeklyChangeKgRaw = parseWeeklyChangeToKg();
      const weeklyChangeKg = safeWeeklyChangeKg(goalType, weeklyChangeKgRaw);

      if ((goalType === "lose" || goalType === "gain") && !weeklyChangeKg) {
        if (goalType === "lose") {
          setError(`Please choose a weekly loss rate between ${CAPS.weekly_loss_kg.min} and ${CAPS.weekly_loss_kg.max} kg/week.`);
        } else {
          setError(`Please choose a weekly gain rate between ${CAPS.weekly_gain_kg.min} and ${CAPS.weekly_gain_kg.max} kg/week.`);
        }
        return false;
      }

      const cc = Number(customCalories);
      if (calorieMode === "custom") {
        if (!Number.isFinite(cc) || cc < CAPS.custom_calories.min || cc > CAPS.custom_calories.max) {
          setError(`Custom calories must be between ${CAPS.custom_calories.min} and ${CAPS.custom_calories.max}.`);
          return false;
        }
      }

      return true;
    }

    if (s === 4) {
      if (splitMode === "fixed" && trainingDaysSelected.length === 0) {
        setError("Please select at least one training day.");
        return false;
      }

      if (splitMode === "rolling") {
        const d = rollingStartDate || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          setError("Please choose a valid rolling split start date.");
          return false;
        }

        if (!trainingFrequencyRange) {
          setError("Please choose a training frequency range.");
          return false;
        }
      }

      return true;
    }

    if (s === 5) {
      if (!activityLevel) {
        setError("Please choose your lifestyle activity level.");
        return false;
      }

      const baselineSteps = parseOptionalInt(baselineStepsInput, CAPS.steps_per_day);
      const baselineCardioMinutes = parseOptionalInt(baselineCardioMinutesInput, CAPS.cardio_minutes_per_week);
      const baselineCardioHr = parseOptionalInt(baselineCardioHrInput, CAPS.cardio_avg_hr);

      if (baselineStepsInput.trim() && baselineSteps === null) {
        setError("Average steps per day must be a non-negative number.");
        return false;
      }
      if (baselineCardioMinutesInput.trim() && baselineCardioMinutes === null) {
        setError("Cardio minutes per week must be a non-negative number.");
        return false;
      }
      if (baselineCardioHrInput.trim() && baselineCardioHr === null) {
        setError("Typical cardio heart rate must be a non-negative number.");
        return false;
      }

      return true;
    }

    if (s === 6) {
      return true;
    }

    if (s === 7) {
      if (!disclaimerAccepted) {
        setError("You must confirm the disclaimer to continue.");
        return false;
      }
      return true;
    }

    return true;
  };

  const updateWithFallback = async (payload) => {
    const { error: e1 } = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", profile.user_id);

    if (!e1) return { error: null };

    const msg = String(e1.message || "");

    if (!msg.includes("Could not find")) return { error: e1 };

    const cleaned = { ...payload };
    for (const k of Object.keys(cleaned)) {
      if (msg.includes(`'${k}'`)) delete cleaned[k];
    }

    const { error: e2 } = await supabase
      .from("profiles")
      .update(cleaned)
      .eq("user_id", profile.user_id);

    return { error: e2 || null };
  };

  const saveProgress = async (nextStepValue) => {
    if (!profile?.user_id) return;

    const heightCm = parseHeightToCm();
    const startingWeightKg = parseWeightToKg(startingWeightInput);
    const goalWeightKg = parseWeightToKg(goalWeightInput);
    const weeklyChangeKgRaw = parseWeeklyChangeToKg();
    const weeklyChangeKg = safeWeeklyChangeKg(goalType, weeklyChangeKgRaw);
    const bodyFatPct = parseBodyFatPct();

    const baselineSteps = parseOptionalInt(baselineStepsInput, CAPS.steps_per_day);
    const baselineCardioMinutes = parseOptionalInt(baselineCardioMinutesInput, CAPS.cardio_minutes_per_week);
    const baselineCardioHr = parseOptionalInt(baselineCardioHrInput, CAPS.cardio_avg_hr);

    const partialPayload = {
      onboarding_step: nextStepValue,
      onboarding_complete: false,

      unit_system: unitSystem,
      height_cm: heightCm,
      starting_weight_kg: startingWeightKg,
      goal_weight_kg: goalWeightKg,
      goal_type: goalType,
      weekly_weight_change_target_kg: goalType === "maintain" ? null : weeklyChangeKg,

      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      sex: sex || null,
      date_of_birth: dateOfBirth || null,

      split_mode: splitMode,
      training_frequency_range: splitMode === "rolling" ? trainingFrequencyRange : null,
      rolling_start_date: splitMode === "rolling" ? (rollingStartDate || new Date().toISOString().slice(0, 10)) : null,
      training_days: splitMode === "fixed" ? trainingDaysSelected : null,
      training_days_per_week: splitMode === "fixed" ? trainingDaysSelected.length : null,
      experience_level: experienceLevel,
      gym_type: gymType,
      gym_chain: gymChain,

      activity_level: activityLevel,
      baseline_steps_per_day: baselineSteps,
      baseline_cardio_minutes_per_week: baselineCardioMinutes,
      baseline_cardio_avg_hr: baselineCardioHr,

      dietary_preference: dietaryPreference,
      dietary_additional: dietaryAdditional,
      food_allergies: foodAllergies,
      dislikes,

      calorie_mode: calorieMode,
      custom_calories: calorieMode === "custom" ? Number(customCalories) || null : null,

      body_fat_pct: bodyFatPct,
      default_liss_opt_in: defaultLissOptIn
    };

    const res = await updateWithFallback(partialPayload);
    if (res?.error) {
      console.warn("Onboarding progress save skipped:", res.error.message);
    }
  };

  const nextStep = async () => {
    if (saving) return;
    const ok = validateStep(step);
    if (!ok) return;

    const next = Math.min(step + 1, 7);
    setStep(next);
    await saveProgress(next);
  };

  const prevStep = async () => {
    const prev = Math.max(step - 1, 1);
    setStep(prev);
    await saveProgress(prev);
  };

  const toggleTrainingDay = (day) => {
    setTrainingDaysSelected((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const parseHeightToCm = () => {
    if (!heightInput) return null;

    if (unitSystem === "metric") {
      const v = toNum(heightInput);
      if (v === null) return null;
      if (v < CAPS.height_cm.min || v > CAPS.height_cm.max) return null;
      return Math.round(v);
    }

    const cleaned = String(heightInput).replace(/[^0-9'" ]/g, "").trim();
    const match = cleaned.match(/(\d+)'\s*(\d+)"/);

    let cm = null;
    if (match) {
      const feet = Number(match[1]);
      const inches = Number(match[2]);
      if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
      const totalInches = feet * 12 + inches;
      cm = Math.round(totalInches * 2.54);
    } else {
      const inchesOnly = toNum(heightInput);
      if (inchesOnly === null || inchesOnly <= 0) return null;
      cm = Math.round(inchesOnly * 2.54);
    }

    if (cm < CAPS.height_cm.min || cm > CAPS.height_cm.max) return null;
    return cm;
  };

  const parseWeightToKg = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const num = toNum(value);
    if (num === null || num <= 0) return null;

    const kg = unitSystem === "metric" ? num : num / 2.20462;
    if (kg < CAPS.weight_kg.min || kg > CAPS.weight_kg.max) return null;
    return Math.round(kg * 10) / 10;
  };

  const parseWeeklyChangeToKg = () => {
    if (weeklyChangeInput === null || weeklyChangeInput === undefined || String(weeklyChangeInput).trim() === "") return null;
    const num = toNum(weeklyChangeInput);
    if (num === null || num <= 0) return null;
    const kg = unitSystem === "metric" ? num : num / 2.20462;
    return Math.round(kg * 100) / 100;
  };

  const safeWeeklyChangeKg = (goal, kg) => {
    if (!kg || goal === "maintain") return null;

    if (goal === "lose") {
      const capped = clamp(kg, CAPS.weekly_loss_kg.min, CAPS.weekly_loss_kg.max);
      return Math.round(capped * 100) / 100;
    }

    if (goal === "gain") {
      const capped = clamp(kg, CAPS.weekly_gain_kg.min, CAPS.weekly_gain_kg.max);
      return Math.round(capped * 100) / 100;
    }

    return Math.round(kg * 100) / 100;
  };

  const parseOptionalInt = (v, cap) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;

    const n = Math.round(Number(s));
    if (!Number.isFinite(n)) return null;

    const min = cap?.min ?? 0;
    const max = cap?.max ?? Number.POSITIVE_INFINITY;
    if (n < min || n > max) return null;

    return n;
  };

  const parseBodyFatPct = () => {
    const s = String(bodyFatPctInput || "").trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    if (n < 3 || n > 60) return null;
    return Math.round(n * 10) / 10;
  };

  const handleSubmit = async () => {
    if (!profile) return;

    if (!validateStep(7)) return;

    setSaving(true);
    setError("");

    const heightCm = parseHeightToCm();
    const startingWeightKg = parseWeightToKg(startingWeightInput);
    const goalWeightKg = parseWeightToKg(goalWeightInput);
    const weeklyChangeKgRaw = parseWeeklyChangeToKg();
    const weeklyChangeKg = safeWeeklyChangeKg(goalType, weeklyChangeKgRaw);
    const bodyFatPct = parseBodyFatPct();

    const baselineSteps = parseOptionalInt(baselineStepsInput);
    const baselineCardioMinutes = parseOptionalInt(baselineCardioMinutesInput);
    const baselineCardioHr = parseOptionalInt(baselineCardioHrInput);

    const basePayload = {
      unit_system: unitSystem,
      height_cm: heightCm,
      starting_weight_kg: startingWeightKg,
      current_weight_kg: startingWeightKg,
      goal_weight_kg: goalWeightKg,
      goal_type: goalType,
      weekly_weight_change_target_kg: goalType === "maintain" ? null : weeklyChangeKg,
      split_mode: splitMode,
      training_frequency_range: splitMode === "rolling" ? trainingFrequencyRange : null,
      rolling_start_date: splitMode === "rolling" ? rollingStartDate || new Date().toISOString().slice(0, 10) : null,
      training_days: splitMode === "fixed" ? trainingDaysSelected : null,
      training_days_per_week: splitMode === "fixed" ? trainingDaysSelected.length : null,
      experience_level: experienceLevel,
      gym_type: gymType,
      gym_chain: gymChain,
      dietary_preference: dietaryPreference,
      dietary_additional: dietaryAdditional,
      food_allergies: foodAllergies,
      dislikes,
      calorie_mode: calorieMode,
      custom_calories: calorieMode === "custom" ? Number(customCalories) || null : null,
      onboarding_step: 7,
      onboarding_complete: true,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      sex,
      date_of_birth: dateOfBirth || null,
    };

    const optionalPayload = {
      body_fat_pct: bodyFatPct,
      default_liss_opt_in: defaultLissOptIn
    };

    const activityPayload = {
      activity_level: activityLevel,
      baseline_steps_per_day: baselineSteps,
      baseline_cardio_minutes_per_week: baselineCardioMinutes,
      baseline_cardio_avg_hr: baselineCardioHr
    };

    const updateWithFallbackLocal = async (payload) => {
      const { error: e1 } = await supabase
        .from("profiles")
        .update(payload)
        .eq("user_id", profile.user_id);

      if (!e1) return { error: null };

      const msg = String(e1.message || "");

      if (!msg.includes("Could not find")) return { error: e1 };

      const cleaned = { ...payload };
      for (const k of Object.keys(cleaned)) {
        if (msg.includes(`'${k}'`)) delete cleaned[k];
      }

      const { error: e2 } = await supabase
        .from("profiles")
        .update(cleaned)
        .eq("user_id", profile.user_id);

      return { error: e2 || null };
    };

    const coreRes = await updateWithFallbackLocal(basePayload);
    if (coreRes.error) {
      setSaving(false);
      setError(coreRes.error.message);
      return;
    }

    const actRes = await updateWithFallbackLocal(activityPayload);
    if (actRes.error) {
      console.warn("Activity baseline save skipped:", actRes.error.message);
    }

    const optRes = await updateWithFallbackLocal(optionalPayload);
    if (optRes.error) {
      console.warn("Optional profile fields save skipped:", optRes.error.message);
    }

    const { error: initErr } = await apiFetch("/api/nutrition/init", {
      method: "POST",
      body: JSON.stringify({})
    }).then(async (r) => {
      const j = await r.json();
      return r.ok ? { error: null } : { error: j?.error || "Nutrition init failed" };
    });

    if (initErr) {
      setSaving(false);
      setError(String(initErr));
      return;
    }

    try {
      const { data: tRows, error: tErr } = await supabase
        .from("nutrition_day_targets")
        .select("day_type, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", profile.user_id)
        .in("day_type", ["training", "rest", "high"]);

      if (tErr) throw tErr;

      const byType = { training: null, rest: null, high: null };
      (tRows || []).forEach((r) => {
        byType[r.day_type] = r;
      });

      const kgToLb = (kg) => Number(kg) * 2.2046226218;
      const clamp0 = (n) => Math.max(0, Math.round(Number(n) || 0));

      let training = byType.training;
      if (!training) {
        const trainingCalories = calorieMode === "custom" ? Math.round(Number(customCalories) || 0) : 0;

        const defaultCalories = sex === "female" ? 2300 : 2500;
        const safeCalories = trainingCalories >= 1200 ? trainingCalories : defaultCalories;

        const bwLb = kgToLb(startingWeightKg || 0);
        const protein = clamp0(bwLb * 1.0);

        const fatPerLb = sex === "female" ? 0.35 : 0.30;
        const fats = clamp0(bwLb * fatPerLb);
        const carbs = clamp0((safeCalories - protein * 4 - fats * 9) / 4);

        training = {
          user_id: profile.user_id,
          day_type: "training",
          calories: safeCalories,
          protein_g: protein,
          fats_g: fats,
          carbs_g: carbs
        };

        await supabase
          .from("nutrition_day_targets")
          .upsert(training, { onConflict: "user_id,day_type" });
      }

      const trainingCalories = clamp0(training.calories);
      const proteinG = clamp0(training.protein_g);
      const trainingFats = clamp0(training.fats_g);
      const trainingCarbs = clamp0(training.carbs_g);

      const restCalories = clamp0(trainingCalories * 0.90);
      let restFats = clamp0(trainingFats * 1.10);
      let restCarbs = clamp0((restCalories - proteinG * 4 - restFats * 9) / 4);

      if (restCarbs < 25) {
        restCarbs = 25;
        const remaining = restCalories - proteinG * 4 - restCarbs * 4;
        restFats = clamp0(remaining / 9);
      }

      const highCalories = clamp0(trainingCalories * 1.05);
      let highFats = clamp0(trainingFats * 0.95);
      let highCarbs = clamp0((highCalories - proteinG * 4 - highFats * 9) / 4);

      if (highCarbs <= trainingCarbs) {
        highCarbs = clamp0(trainingCarbs * 1.10);
        const remaining = highCalories - proteinG * 4 - highCarbs * 4;
        highFats = clamp0(remaining / 9);
      }

      const upserts = [
        {
          user_id: profile.user_id,
          day_type: "rest",
          calories: restCalories,
          protein_g: proteinG,
          carbs_g: restCarbs,
          fats_g: restFats
        },
        {
          user_id: profile.user_id,
          day_type: "high",
          calories: highCalories,
          protein_g: proteinG,
          carbs_g: highCarbs,
          fats_g: highFats
        }
      ];

      await supabase
        .from("nutrition_day_targets")
        .upsert(upserts, { onConflict: "user_id,day_type" });
    } catch (e) {
      console.warn("Post-init day-target tuning skipped:", e);
    }

    setSaving(false);
    navigate("/app", { replace: true });
  };

  // ── derived UI values ──
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  const meta = STEP_META[step - 1] || STEP_META[0];

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="ob-wrap">
          <div className="ob-status-card">
            <div className="ob-status-code">SETUP · SYSTEM CHECK</div>
            <div className="ob-status-title">Initialising…</div>
            <div className="ob-status-sub">Loading your profile.</div>
          </div>
        </div>
      </>
    );
  }

  if (error && !saving && step === 1 && !profile) {
    return (
      <>
        <style>{CSS}</style>
        <div className="ob-wrap">
          <div className="ob-status-card">
            <div className="ob-status-code">SETUP · ERROR</div>
            <div className="ob-status-title">System fault.</div>
            <div className="ob-status-sub" style={{ color: "var(--bad)", marginTop: "0.75rem" }}>{error}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="ob-wrap">

        {/* ── progress rail ── */}
        <div className="ob-progress-rail">
          <div className="ob-progress-bar-track">
            <div className="ob-progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="ob-progress-label">SETUP · STEP {step} OF {TOTAL_STEPS}</div>
        </div>

        {/* ── main card ── */}
        <div className="ob-card">

          {/* topbar */}
          <div className="ob-topbar">
            <div className="ob-topbar-left">
              <span className="ob-topbar-dot" />
              {meta.code}
            </div>
            <div className="ob-topbar-right">SETUP</div>
          </div>

          {/* body */}
          <div className="ob-body">

            {/* back-to-home row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                {step === 1 && (
                  <p className="ob-step-heading" style={{ fontSize: "1.5rem" }}>
                    {meta.label}.
                  </p>
                )}
              </div>
              <button
                type="button"
                className="ob-home-link"
                onClick={async () => {
                  if (saving) return;
                  await saveProgress(step);
                  navigate("/", { replace: true });
                }}
                disabled={saving}
              >
                Back to home
              </button>
            </div>

            {/* step heading (for steps 2+) */}
            {step > 1 && (
              <div>
                <p className="ob-step-heading">{meta.label}.</p>
              </div>
            )}

            {/* ── STEP 1 — Body metrics ── */}
            {step === 1 && (
              <div style={{ display: "grid", gap: "1.1rem" }}>
                <p className="ob-step-desc">
                  Set your baseline so Physique Pilot can guide training, nutrition, steps and cardio.
                </p>

                <div className="ob-field-group">
                  <div className="ob-label">Unit system</div>
                  <div className="ob-pills">
                    <button
                      type="button"
                      className={`ob-pill${unitSystem === "metric" ? " active" : ""}`}
                      onClick={() => setUnitSystem("metric")}
                    >
                      Metric
                    </button>
                    <button
                      type="button"
                      className={`ob-pill${unitSystem === "imperial" ? " active" : ""}`}
                      onClick={() => setUnitSystem("imperial")}
                    >
                      Imperial
                    </button>
                  </div>
                </div>

                <div className="ob-grid2">
                  <div className="ob-field-group">
                    <div className="ob-label">Height ({unitSystem === "metric" ? "cm" : `e.g. 5'10"`})</div>
                    <input
                      type="text"
                      className="ob-input"
                      value={heightInput}
                      onChange={(e) => setHeightInput(e.target.value)}
                    />
                  </div>

                  <div className="ob-field-group">
                    <div className="ob-label">Starting weight ({unitSystem === "metric" ? "kg" : "lbs"})</div>
                    <input
                      type="number"
                      className="ob-input"
                      value={startingWeightInput}
                      onChange={(e) => setStartingWeightInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="ob-field-group">
                  <div className="ob-label">Goal weight ({unitSystem === "metric" ? "kg" : "lbs"})</div>
                  <input
                    type="number"
                    className="ob-input"
                    value={goalWeightInput}
                    onChange={(e) => setGoalWeightInput(e.target.value)}
                  />
                </div>

                <div className="ob-field-group">
                  <div className="ob-label">Body fat % (estimate)</div>
                  <input
                    type="number"
                    min="3"
                    max="60"
                    step="0.5"
                    className="ob-input"
                    value={bodyFatPctInput}
                    onChange={(e) => setBodyFatPctInput(e.target.value)}
                    placeholder="e.g. 15"
                  />
                  <div className="ob-help">
                    If you're unsure, use reference photos to estimate.{" "}
                    {sex === "female"
                      ? "Women typically carry higher essential body fat than men — your estimate may be higher than you'd guess from male reference images."
                      : ""}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2 — About you ── */}
            {step === 2 && (
              <div style={{ display: "grid", gap: "1.1rem" }}>
                <div className="ob-grid2">
                  <div className="ob-field-group">
                    <div className="ob-label">First name</div>
                    <input
                      type="text"
                      className="ob-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Chris"
                      autoComplete="given-name"
                    />
                  </div>

                  <div className="ob-field-group">
                    <div className="ob-label">Last name</div>
                    <input
                      type="text"
                      className="ob-input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Bumstead"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div className="ob-field-group">
                  <div className="ob-label">Date of birth</div>
                  <input
                    type="date"
                    className="ob-input"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    autoComplete="bday"
                  />
                  <div className="ob-help">Used for calorie calculations. You can change this later in Settings.</div>
                </div>

                <div className="ob-field-group">
                  <div className="ob-label">Sex</div>
                  <div className="ob-pills">
                    <button
                      type="button"
                      className={`ob-pill${sex === "male" ? " active" : ""}`}
                      onClick={() => setSex("male")}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      className={`ob-pill${sex === "female" ? " active" : ""}`}
                      onClick={() => setSex("female")}
                    >
                      Female
                    </button>
                  </div>
                  <div className="ob-help">This helps set more realistic calorie and macro baselines.</div>
                </div>
              </div>
            )}

            {/* ── STEP 3 — Goal & calories ── */}
            {step === 3 && (
              <div style={{ display: "grid", gap: "1.1rem" }}>
                <div className="ob-field-group">
                  <div className="ob-label">Main goal</div>
                  <select
                    className="ob-input"
                    value={goalType}
                    disabled
                    style={{ opacity: 0.7 }}
                  >
                    <option value="maintain">Maintain weight</option>
                    <option value="lose">Lose weight</option>
                    <option value="gain">Gain weight</option>
                  </select>
                  <div className="ob-help">
                    Your goal is inferred from your starting and goal weight.
                    If both are within 2 kg, we assume maintenance.
                  </div>
                </div>

                {goalType !== "maintain" && (
                  <div className="ob-field-group">
                    <div className="ob-label">
                      Target rate per week ({unitSystem === "metric" ? "kg/week" : "lbs/week"})
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      className="ob-input"
                      value={weeklyChangeInput}
                      onChange={(e) => setWeeklyChangeInput(e.target.value)}
                    />
                    <div className="ob-help">Safe defaults: cutting capped at 1 kg/week, gaining capped at 0.2 kg/week.</div>
                  </div>
                )}

                <div className="ob-field-group">
                  <div className="ob-label">Calories</div>
                  <select
                    className="ob-input"
                    value={calorieMode}
                    onChange={(e) => setCalorieMode(e.target.value)}
                  >
                    <option value="ai">Let Physique Pilot calculate for me</option>
                    <option value="custom">I want to enter my own calorie target</option>
                  </select>
                </div>

                {calorieMode === "custom" && (
                  <div className="ob-field-group">
                    <div className="ob-label">Daily calorie target</div>
                    <input
                      type="number"
                      className="ob-input"
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value)}
                    />
                    <div className="ob-help">Minimum 1200 kcal.</div>
                  </div>
                )}

                <div className="ob-help">The more consistent your weight logs, the better the app can guide adjustments.</div>
              </div>
            )}

            {/* ── STEP 4 — Training setup ── */}
            {step === 4 && (
              <div style={{ display: "grid", gap: "1.1rem" }}>
                <div className="ob-field-group">
                  <div className="ob-label">Training split type</div>
                  <select
                    className="ob-input"
                    value={splitMode}
                    onChange={(e) => setSplitMode(e.target.value)}
                  >
                    <option value="fixed">Weekly (fixed days)</option>
                    <option value="rolling">Rolling (cycle repeats)</option>
                  </select>
                </div>

                {splitMode === "fixed" && (
                  <div className="ob-field-group">
                    <div className="ob-label">Which days do you usually train?</div>
                    <div className="ob-pills" style={{ marginTop: "0.2rem" }}>
                      {daysOfWeek.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`ob-day-pill${trainingDaysSelected.includes(d) ? " active" : ""}`}
                          onClick={() => toggleTrainingDay(d)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <div className="ob-help">You can refine the split inside Training later.</div>
                  </div>
                )}

                {splitMode === "rolling" && (
                  <div style={{ display: "grid", gap: "0.85rem" }}>
                    <div className="ob-field-group">
                      <div className="ob-label">How many days per week do you want to train?</div>
                      <select
                        className="ob-input"
                        value={trainingFrequencyRange}
                        onChange={(e) => setTrainingFrequencyRange(e.target.value)}
                      >
                        <option value="1-2">1–2 days</option>
                        <option value="2-4">2–4 days</option>
                        <option value="5-6">5–6 days</option>
                        <option value="7">7 days</option>
                      </select>
                    </div>

                    <div className="ob-field-group">
                      <div className="ob-label">When did you start your current training block?</div>
                      <input
                        type="date"
                        className="ob-input"
                        value={rollingStartDate}
                        onChange={(e) => setRollingStartDate(e.target.value)}
                      />
                    </div>

                    <div className="ob-help">You'll set the exact rolling split pattern (e.g. 8-day cycle) in the Training section.</div>
                  </div>
                )}

                <div className="ob-grid2">
                  <div className="ob-field-group">
                    <div className="ob-label">Experience level</div>
                    <select
                      className="ob-input"
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div className="ob-field-group">
                    <div className="ob-label">Gym type</div>
                    <select
                      className="ob-input"
                      value={gymType}
                      onChange={(e) => setGymType(e.target.value)}
                    >
                      <option value="home">Home gym</option>
                      <option value="commercial">Commercial gym</option>
                      <option value="independent">Independent gym</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="ob-field-group">
                  <div className="ob-label">Gym chain or name (optional)</div>
                  <input
                    type="text"
                    className="ob-input"
                    value={gymChain}
                    onChange={(e) => setGymChain(e.target.value)}
                    placeholder="PureGym, JD, The Gym Group, etc."
                  />
                </div>
              </div>
            )}

            {/* ── STEP 5 — Activity baseline ── */}
            {step === 5 && (
              <div style={{ display: "grid", gap: "1.1rem" }}>
                <div className="ob-field-group">
                  <div className="ob-label">Lifestyle (excluding weight training)</div>
                  <select
                    className="ob-input"
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                  >
                    <option value="inactive">Inactive</option>
                    <option value="light">Lightly active</option>
                    <option value="moderate">Moderately active</option>
                    <option value="heavy">Highly active</option>
                    <option value="extreme">Extreme</option>
                  </select>
                  <div className="ob-help">This is used as your baseline for steps/cardio planning later.</div>
                </div>

                <div className="ob-field-group">
                  <div className="ob-label">Default LISS cardio on training days</div>
                  <div className="ob-pills">
                    <button
                      type="button"
                      className={`ob-pill${defaultLissOptIn === true ? " active" : ""}`}
                      onClick={() => setDefaultLissOptIn(true)}
                    >
                      Include 15 min LISS
                    </button>
                    <button
                      type="button"
                      className={`ob-pill${defaultLissOptIn === false ? " active" : ""}`}
                      onClick={() => setDefaultLissOptIn(false)}
                    >
                      Opt out
                    </button>
                  </div>
                  <div className="ob-help">
                    Recommended for bodybuilding (incline walk, stairmaster). If you opt out, calories will be adjusted later to keep progress consistent.
                  </div>
                </div>

                <div className="ob-grid2">
                  <div className="ob-field-group">
                    <div className="ob-label">Avg steps per day (optional)</div>
                    <input
                      type="number"
                      min="0"
                      className="ob-input"
                      value={baselineStepsInput}
                      onChange={(e) => setBaselineStepsInput(e.target.value)}
                      placeholder="e.g. 8000"
                    />
                  </div>

                  <div className="ob-field-group">
                    <div className="ob-label">Cardio mins/week (optional)</div>
                    <input
                      type="number"
                      min="0"
                      className="ob-input"
                      value={baselineCardioMinutesInput}
                      onChange={(e) => setBaselineCardioMinutesInput(e.target.value)}
                      placeholder="e.g. 60"
                    />
                  </div>
                </div>

                <div className="ob-field-group">
                  <div className="ob-label">Typical cardio heart rate (optional)</div>
                  <input
                    type="number"
                    min="0"
                    className="ob-input"
                    value={baselineCardioHrInput}
                    onChange={(e) => setBaselineCardioHrInput(e.target.value)}
                    placeholder="e.g. 120"
                  />
                  <div className="ob-help">We'll encourage LISS later (incline walk, stairmaster), but for now we just record baseline.</div>
                </div>
              </div>
            )}

            {/* ── STEP 6 — Nutrition preferences ── */}
            {step === 6 && (
              <div style={{ display: "grid", gap: "1.1rem" }}>
                <div className="ob-field-group">
                  <div className="ob-label">Dietary preference</div>
                  <select
                    className="ob-input"
                    value={dietaryPreference}
                    onChange={(e) => setDietaryPreference(e.target.value)}
                  >
                    <option value="omnivore">Omnivore</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="pescatarian">Pescatarian</option>
                    <option value="halal">Halal</option>
                    <option value="gluten_free">Gluten free</option>
                    <option value="lactose_free">Lactose free</option>
                  </select>
                </div>

                <div className="ob-field-group">
                  <div className="ob-label">Additional dietary notes</div>
                  <textarea
                    className="ob-input ob-textarea"
                    value={dietaryAdditional}
                    onChange={(e) => setDietaryAdditional(e.target.value)}
                    placeholder="Any extra preferences you want the app to consider."
                  />
                </div>

                <div className="ob-field-group">
                  <div className="ob-label">Food dislikes</div>
                  <textarea
                    className="ob-input ob-textarea"
                    value={dislikes}
                    onChange={(e) => setDislikes(e.target.value)}
                    placeholder="Foods you strongly prefer to avoid."
                  />
                </div>
              </div>
            )}

            {/* ── STEP 7 — Safety & confirm ── */}
            {step === 7 && (
              <div style={{ display: "grid", gap: "1.1rem" }}>
                <div className="ob-field-group">
                  <div className="ob-label">Food allergies</div>
                  <textarea
                    className="ob-input ob-textarea"
                    value={foodAllergies}
                    onChange={(e) => setFoodAllergies(e.target.value)}
                    placeholder="List any food allergies."
                  />
                </div>

                <div className="ob-check-row">
                  <input
                    type="checkbox"
                    className="ob-checkbox"
                    checked={disclaimerAccepted}
                    onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                    id="ob-disclaimer"
                  />
                  <label htmlFor="ob-disclaimer" className="ob-check-label">
                    I confirm I am healthy enough for exercise and nutrition changes and understand this is not medical advice or an emergency service.
                  </label>
                </div>
              </div>
            )}

            {/* error */}
            {error && <div className="ob-error">{error}</div>}
          </div>

          {/* ── footer ── */}
          <div className="ob-footer">
            <div className="ob-footer-hint">
              {saving
                ? <span className="ob-saving-badge">Saving&hellip;</span>
                : step === 1
                  ? ""
                  : "Editable in settings"}
            </div>

            <div className="ob-footer-btns">
              {step > 1 && (
                <button
                  type="button"
                  className="ob-btn-ghost"
                  onClick={prevStep}
                  disabled={saving}
                >
                  Back
                </button>
              )}

              {step < 7 && (
                <button
                  type="button"
                  className="ob-btn-primary"
                  onClick={nextStep}
                  disabled={saving}
                >
                  Next
                </button>
              )}

              {step === 7 && (
                <button
                  type="button"
                  className="ob-btn-primary"
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Finish setup"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Onboarding;
