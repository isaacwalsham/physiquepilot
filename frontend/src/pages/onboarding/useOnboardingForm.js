import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { parseHeightToCm, parseWeightToKg, parseWeeklyRateToKg, cmToDisplayInput, kgToDisplay } from "../../lib/units";
import { useProfile } from "../../context/ProfileContext";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:4000" : "https://physiquepilot.onrender.com")
).replace(/\/$/, "");

const TOTAL_STEPS = 15;

// ─── Default form state ───────────────────────────────────────────────────────

const defaultForm = {
  // Step 1
  firstName: "",
  lastName: "",
  // Step 2
  dateOfBirth: "",
  // Step 3
  sex: "male",
  // Step 4
  unitSystem: "metric",
  // Step 5 — display values (string inputs)
  heightInput: "",
  startingWeightInput: "",
  goalWeightInput: "",
  bodyFatPctInput: "",
  // Step 6
  goalType: "maintain",
  // Step 7
  weeklyRateInput: "",
  // Step 8
  calorieMode: "ai",
  customCalories: "",
  // Step 9
  activityLevel: "moderate",
  // Step 10
  splitMode: "fixed",
  trainingDaysSelected: [],
  trainingFrequencyRange: "2-4",
  rollingStartDate: "",
  // Step 11
  experienceLevel: "beginner",
  gymType: "commercial",
  gymChain: "",
  // Step 12
  baselineStepsInput: "",
  baselineCardioMinutesInput: "",
  baselineCardioHrInput: "",
  defaultLissOptIn: true,
  // Step 13
  dietaryPreference: "omnivore",
  dietaryAdditional: "",
  dislikes: "",
  // Step 14
  foodAllergies: "",
  // Step 15
  disclaimerAccepted: false,

  // ─── Computed metric values (derived, prefixed with _) ───────────────────
  // These are recalculated on change and passed to TDEE preview
  _heightCm: null,
  _startingWeightKg: null,
  _goalWeightKg: null,
  _weeklyRateKg: null,
  _bodyFatPct: null,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboardingForm() {
  const navigate = useNavigate();
  const { patchProfileLocal, silentRefreshProfile } = useProfile();
  const [profile, setProfile] = useState(null);
  const [form, setFormState] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedStep, setSavedStep] = useState(1);

  // ─── Load profile + hydrate form ──────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) { setLoading(false); return; }

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!p) {
        // Create bare profile if missing
        await supabase.from("profiles").upsert(
          { user_id: user.id, email: user.email, subscription_status: "inactive", is_suspended: false, onboarding_complete: false },
          { onConflict: "user_id" }
        );
        setLoading(false);
        return;
      }

      setProfile(p);

      if (p.onboarding_complete) {
        navigate("/app/dashboard", { replace: true });
        return;
      }

      const s = Number(p.onboarding_step);
      if (Number.isFinite(s) && s >= 1 && s <= TOTAL_STEPS) {
        setSavedStep(s);
      }

      const unit = p.unit_system || "metric";

      setFormState((prev) => ({
        ...prev,
        firstName: p.first_name || "",
        lastName: p.last_name || "",
        dateOfBirth: p.date_of_birth ? String(p.date_of_birth) : "",
        sex: p.sex || "male",
        unitSystem: unit,
        heightInput: p.height_cm ? cmToDisplayInput(p.height_cm, unit) : "",
        startingWeightInput: p.starting_weight_kg ? kgToDisplay(p.starting_weight_kg, unit) : "",
        goalWeightInput: p.goal_weight_kg ? kgToDisplay(p.goal_weight_kg, unit) : "",
        bodyFatPctInput: p.body_fat_pct != null ? String(p.body_fat_pct) : "",
        goalType: p.goal_type || "maintain",
        weeklyRateInput: p.weekly_weight_change_target_kg ? kgToDisplay(p.weekly_weight_change_target_kg, unit, 2) : "",
        calorieMode: p.calorie_mode || "ai",
        customCalories: p.custom_calories ? String(p.custom_calories) : "",
        activityLevel: p.activity_level || "moderate",
        splitMode: p.split_mode || "fixed",
        trainingDaysSelected: p.training_days || [],
        trainingFrequencyRange: p.training_frequency_range || "2-4",
        rollingStartDate: p.rolling_start_date ? String(p.rolling_start_date) : "",
        experienceLevel: p.experience_level || "beginner",
        gymType: p.gym_type || "commercial",
        gymChain: p.gym_chain || "",
        baselineStepsInput: p.baseline_steps_per_day != null ? String(p.baseline_steps_per_day) : "",
        baselineCardioMinutesInput: p.baseline_cardio_minutes_per_week != null ? String(p.baseline_cardio_minutes_per_week) : "",
        baselineCardioHrInput: p.baseline_cardio_avg_hr != null ? String(p.baseline_cardio_avg_hr) : "",
        defaultLissOptIn: p.default_liss_opt_in ?? true,
        dietaryPreference: p.dietary_preference || "omnivore",
        dietaryAdditional: p.dietary_additional || "",
        dislikes: p.dislikes || "",
        foodAllergies: p.food_allergies || "",
        disclaimerAccepted: false,

        // Derived metric values
        _heightCm: p.height_cm || null,
        _startingWeightKg: p.starting_weight_kg || null,
        _goalWeightKg: p.goal_weight_kg || null,
        _weeklyRateKg: p.weekly_weight_change_target_kg || null,
        _bodyFatPct: p.body_fat_pct || null,
      }));

      setLoading(false);
    };

    load();
  }, [navigate]);

  // ─── setField: update a single field, recalculate derived values ──────────

  const setField = useCallback((name, value) => {
    setError("");
    setFormState((prev) => {
      const next = { ...prev, [name]: value };

      // Recalculate derived metric values whenever display inputs change
      if (["heightInput", "startingWeightInput", "goalWeightInput", "bodyFatPctInput", "weeklyRateInput", "unitSystem"].includes(name)) {
        const unit = name === "unitSystem" ? value : next.unitSystem;
        next._heightCm = parseHeightToCm(next.heightInput, unit);
        next._startingWeightKg = parseWeightToKg(next.startingWeightInput, unit);
        next._goalWeightKg = parseWeightToKg(next.goalWeightInput, unit);
        next._weeklyRateKg = parseWeeklyRateToKg(next.weeklyRateInput, unit);
        const bf = Number(next.bodyFatPctInput);
        next._bodyFatPct = Number.isFinite(bf) && bf >= 3 && bf <= 60 ? bf : null;
      }

      // Auto-infer goal type from weight diff
      if (["startingWeightInput", "goalWeightInput", "unitSystem"].includes(name)) {
        const unit = name === "unitSystem" ? value : next.unitSystem;
        const startKg = parseWeightToKg(next.startingWeightInput, unit);
        const goalKg = parseWeightToKg(next.goalWeightInput, unit);
        if (startKg && goalKg) {
          const diff = goalKg - startKg;
          if (Math.abs(diff) <= 2) next.goalType = "maintain";
          else if (diff < -2) next.goalType = "lose";
          else next.goalType = "gain";
        }
      }

      return next;
    });
  }, []);

  const setFields = useCallback((patch) => {
    setError("");
    setFormState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ─── Save progress ────────────────────────────────────────────────────────

  const saveProgress = useCallback(
    async (nextStep) => {
      if (!profile?.user_id) return;

      const payload = {
        onboarding_step: nextStep,
        onboarding_complete: false,
        unit_system: form.unitSystem,
        first_name: form.firstName.trim() || null,
        last_name: form.lastName.trim() || null,
        date_of_birth: form.dateOfBirth || null,
        sex: form.sex || null,
        height_cm: form._heightCm,
        starting_weight_kg: form._startingWeightKg,
        goal_weight_kg: form._goalWeightKg,
        goal_type: form.goalType,
        weekly_weight_change_target_kg: form.goalType === "maintain" ? null : form._weeklyRateKg,
        body_fat_pct: form._bodyFatPct,
        calorie_mode: form.calorieMode,
        custom_calories: form.calorieMode === "custom" ? Number(form.customCalories) || null : null,
        activity_level: form.activityLevel,
        split_mode: form.splitMode,
        training_days: form.splitMode === "fixed" ? form.trainingDaysSelected : null,
        training_days_per_week: form.splitMode === "fixed" ? form.trainingDaysSelected.length : null,
        training_frequency_range: form.splitMode === "rolling" ? form.trainingFrequencyRange : null,
        rolling_start_date: form.splitMode === "rolling" ? (form.rollingStartDate || new Date().toISOString().slice(0, 10)) : null,
        experience_level: form.experienceLevel,
        gym_type: form.gymType,
        gym_chain: form.gymChain || null,
        baseline_steps_per_day: form.baselineStepsInput !== "" ? Math.round(Number(form.baselineStepsInput)) || null : null,
        baseline_cardio_minutes_per_week: form.baselineCardioMinutesInput !== "" ? Math.round(Number(form.baselineCardioMinutesInput)) || null : null,
        baseline_cardio_avg_hr: form.baselineCardioHrInput !== "" ? Math.round(Number(form.baselineCardioHrInput)) || null : null,
        default_liss_opt_in: form.defaultLissOptIn,
        dietary_preference: form.dietaryPreference,
        dietary_additional: form.dietaryAdditional,
        dislikes: form.dislikes,
        food_allergies: form.foodAllergies,
      };

      const { error: e } = await supabase
        .from("profiles")
        .update(payload)
        .eq("user_id", profile.user_id);

      if (e) console.warn("Progress save warning:", e.message);
    },
    [profile, form]
  );

  // ─── Final submit ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!profile?.user_id) return { error: "No profile." };
    setSaving(true);
    setError("");

    const finalPayload = {
      onboarding_step: TOTAL_STEPS,
      onboarding_complete: true,
      current_weight_kg: form._startingWeightKg,
      unit_system: form.unitSystem,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      date_of_birth: form.dateOfBirth,
      sex: form.sex,
      height_cm: form._heightCm,
      starting_weight_kg: form._startingWeightKg,
      goal_weight_kg: form._goalWeightKg,
      goal_type: form.goalType,
      weekly_weight_change_target_kg: form.goalType === "maintain" ? null : form._weeklyRateKg,
      body_fat_pct: form._bodyFatPct,
      calorie_mode: form.calorieMode,
      custom_calories: form.calorieMode === "custom" ? Number(form.customCalories) || null : null,
      activity_level: form.activityLevel,
      split_mode: form.splitMode,
      training_days: form.splitMode === "fixed" ? form.trainingDaysSelected : null,
      training_days_per_week: form.splitMode === "fixed" ? form.trainingDaysSelected.length : null,
      training_frequency_range: form.splitMode === "rolling" ? form.trainingFrequencyRange : null,
      rolling_start_date: form.splitMode === "rolling" ? (form.rollingStartDate || new Date().toISOString().slice(0, 10)) : null,
      experience_level: form.experienceLevel,
      gym_type: form.gymType,
      gym_chain: form.gymChain || null,
      baseline_steps_per_day: form.baselineStepsInput !== "" ? Math.round(Number(form.baselineStepsInput)) || null : null,
      baseline_cardio_minutes_per_week: form.baselineCardioMinutesInput !== "" ? Math.round(Number(form.baselineCardioMinutesInput)) || null : null,
      baseline_cardio_avg_hr: form.baselineCardioHrInput !== "" ? Math.round(Number(form.baselineCardioHrInput)) || null : null,
      default_liss_opt_in: form.defaultLissOptIn,
      dietary_preference: form.dietaryPreference,
      dietary_additional: form.dietaryAdditional,
      dislikes: form.dislikes,
      food_allergies: form.foodAllergies,
    };

    const { error: updateErr } = await supabase
      .from("profiles")
      .update(finalPayload)
      .eq("user_id", profile.user_id);

    if (updateErr) {
      setSaving(false);
      setError(updateErr.message);
      return { error: updateErr.message };
    }

    // Trigger nutrition init (backend calculates day targets with new TDEE formula).
    // This is best-effort — if the backend is cold-starting or unavailable the
    // profile is already saved with onboarding_complete: true, so we navigate
    // anyway. The dashboard will re-trigger init if targets are missing.
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const r = await fetch(`${API_URL}/api/nutrition/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: profile.user_id }),
        signal: AbortSignal.timeout(25000), // 25 s — enough for a cold Render start
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.warn("Nutrition init non-fatal error:", j?.error || r.status);
      }
    } catch (initErr) {
      // Network error or timeout — log and continue; targets can be recalculated
      console.warn("Nutrition init skipped (will retry on dashboard):", initErr?.message);
    }

    setSaving(false);
    // 1. Immediately patch context so RequireOnboardingComplete sees onboarding_complete: true
    //    the instant we navigate — prevents the replaceState redirect loop.
    patchProfileLocal({ onboarding_complete: true });
    // 2. Silently re-fetch full profile data (no loading flash) so the dashboard
    //    has up-to-date training schedule, macros, etc. from the DB.
    await silentRefreshProfile();
    navigate("/app/dashboard", { replace: true });
    return { error: null };
  }, [profile, form, navigate, patchProfileLocal, silentRefreshProfile]);

  return {
    form,
    setField,
    setFields,
    loading,
    saving,
    error,
    setError,
    profile,
    savedStep,
    saveProgress,
    handleSubmit,
    totalSteps: TOTAL_STEPS,
  };
}
