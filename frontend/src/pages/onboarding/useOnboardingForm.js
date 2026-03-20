import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../context/ProfileContext";
import { supabase } from "../../supabaseClient";
import { parseHeightToCm, parseWeightToKg, parseWeeklyRateToKg, cmToDisplayInput, kgToDisplay } from "../../lib/units";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:4000" : "https://physiquepilot.onrender.com")
).replace(/\/$/, "");

const TOTAL_STEPS = 14;

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
  // Step 8 (experience)
  experienceLevel: "beginner",
  // Step 9 (reasons)
  signingUpReasons: [],
  // Step 10 (calories)
  calorieMode: "ai",
  customCalories: "",
  // Step 11 (training schedule)
  splitMode: "fixed",
  trainingDaysSelected: [],
  trainingFrequencyRange: "2-4",
  rollingStartDate: "",
  // Step 12 (baselines)
  baselineStepsInput: "",
  baselineStepsNotSure: false,
  baselineCardioMinutesInput: "",
  baselineCardioType: "",
  baselineCardioHrInput: "",
  // Step 13 (nutrition + allergies)
  dietaryPreference: "omnivore",
  dietaryAdditional: "",
  dislikes: "",
  foodAllergies: "",
  // Step 14 (disclaimer)
  disclaimerAccepted: false,
  // Retained with defaults (not asked, used by backend)
  activityLevel: "moderate",
  gymType: "commercial",
  gymChain: "",

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
  const { refreshProfile } = useProfile();
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
      const { data: sessionRes } = await supabase.auth.getSession();
      const user = sessionRes?.session?.user;
      if (!user) { setLoading(false); return; }

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!p) {
        // Create bare profile if missing and hydrate state so handleSubmit can run
        const minimalProfile = { user_id: user.id, email: user.email, subscription_status: "inactive", is_suspended: false, onboarding_complete: false };
        await supabase.from("profiles").upsert(minimalProfile, { onConflict: "user_id" });
        setProfile(minimalProfile);
        setLoading(false);
        return;
      }

      setProfile(p);

      if (p.onboarding_complete) {
        navigate("/app", { replace: true });
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
        experienceLevel: p.experience_level || "beginner",
        signingUpReasons: p.signing_up_reasons || [],
        calorieMode: p.calorie_mode || "ai",
        customCalories: p.custom_calories ? String(p.custom_calories) : "",
        splitMode: p.split_mode || "fixed",
        trainingDaysSelected: p.training_days || [],
        trainingFrequencyRange: p.training_frequency_range || "2-4",
        rollingStartDate: p.rolling_start_date ? String(p.rolling_start_date) : "",
        baselineStepsInput: p.baseline_steps_per_day != null ? String(p.baseline_steps_per_day) : "",
        baselineStepsNotSure: p.baseline_steps_not_sure ?? false,
        baselineCardioMinutesInput: p.baseline_cardio_minutes_per_week != null ? String(p.baseline_cardio_minutes_per_week) : "",
        baselineCardioType: p.baseline_cardio_type || "",
        baselineCardioHrInput: p.baseline_cardio_avg_hr != null ? String(p.baseline_cardio_avg_hr) : "",
        dietaryPreference: p.dietary_preference || "omnivore",
        dietaryAdditional: p.dietary_additional || "",
        dislikes: p.dislikes || "",
        foodAllergies: p.food_allergies || "",
        disclaimerAccepted: false,
        activityLevel: p.activity_level || "moderate",
        gymType: p.gym_type || "commercial",
        gymChain: p.gym_chain || "",

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
        experience_level: form.experienceLevel,
        signing_up_reasons: form.signingUpReasons,
        calorie_mode: form.calorieMode,
        custom_calories: form.calorieMode === "custom" ? Number(form.customCalories) || null : null,
        split_mode: form.splitMode,
        training_days: form.splitMode === "fixed" ? form.trainingDaysSelected : null,
        training_days_per_week: form.splitMode === "fixed" ? form.trainingDaysSelected.length : null,
        training_frequency_range: form.splitMode === "rolling" ? form.trainingFrequencyRange : null,
        rolling_start_date: form.splitMode === "rolling" ? (form.rollingStartDate || new Date().toISOString().slice(0, 10)) : null,
        baseline_steps_per_day: form.baselineStepsNotSure ? null : (form.baselineStepsInput !== "" ? Math.round(Number(form.baselineStepsInput)) || null : null),
        baseline_steps_not_sure: form.baselineStepsNotSure,
        baseline_cardio_minutes_per_week: form.baselineCardioMinutesInput !== "" ? Math.round(Number(form.baselineCardioMinutesInput)) || null : null,
        baseline_cardio_type: form.baselineCardioType || null,
        baseline_cardio_avg_hr: form.baselineCardioHrInput !== "" ? Math.round(Number(form.baselineCardioHrInput)) || null : null,
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
    if (!profile?.user_id) {
      setError("Session expired — please refresh the page.");
      return { error: "No profile." };
    }
    setSaving(true);
    setError("");

    const finalPayload = {
      onboarding_step: TOTAL_STEPS,
      onboarding_complete: true,
      current_weight_kg: form._startingWeightKg,
      unit_system: form.unitSystem,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      date_of_birth: form.dateOfBirth || null,
      sex: form.sex,
      height_cm: form._heightCm,
      starting_weight_kg: form._startingWeightKg,
      goal_weight_kg: form._goalWeightKg,
      goal_type: form.goalType,
      weekly_weight_change_target_kg: form.goalType === "maintain" ? null : form._weeklyRateKg,
      body_fat_pct: form._bodyFatPct,
      experience_level: form.experienceLevel,
      signing_up_reasons: form.signingUpReasons,
      calorie_mode: form.calorieMode,
      custom_calories: form.calorieMode === "custom" ? Number(form.customCalories) || null : null,
      split_mode: form.splitMode,
      training_days: form.splitMode === "fixed" ? form.trainingDaysSelected : null,
      training_days_per_week: form.splitMode === "fixed" ? form.trainingDaysSelected.length : null,
      training_frequency_range: form.splitMode === "rolling" ? form.trainingFrequencyRange : null,
      rolling_start_date: form.splitMode === "rolling" ? (form.rollingStartDate || new Date().toISOString().slice(0, 10)) : null,
      baseline_steps_per_day: form.baselineStepsNotSure ? null : (form.baselineStepsInput !== "" ? Math.round(Number(form.baselineStepsInput)) || null : null),
      baseline_steps_not_sure: form.baselineStepsNotSure,
      baseline_cardio_minutes_per_week: form.baselineCardioMinutesInput !== "" ? Math.round(Number(form.baselineCardioMinutesInput)) || null : null,
      baseline_cardio_type: form.baselineCardioType || null,
      baseline_cardio_avg_hr: form.baselineCardioHrInput !== "" ? Math.round(Number(form.baselineCardioHrInput)) || null : null,
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

    // Trigger nutrition init (backend calculates day targets with new TDEE formula)
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    // Fire nutrition init — non-blocking. A failure logs a warning but never
    // prevents the user from reaching the dashboard.
    fetch(`${API_URL}/api/nutrition/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ user_id: profile.user_id }),
    }).then(async (r) => {
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.warn("nutrition/init warning (non-fatal):", j?.error || r.status);
      }
    }).catch((err) => {
      console.warn("nutrition/init network error (non-fatal):", err);
    });

    // Refresh ProfileContext so RequireOnboardingComplete sees onboarding_complete: true
    await refreshProfile();
    setSaving(false);
    navigate("/app", { replace: true });
    return { error: null };
  }, [profile, form, navigate, refreshProfile]);

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
