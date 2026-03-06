// ─── Onboarding Validation ────────────────────────────────────────────────────
// Pure functions — no side effects, no React. Reused in Settings page too.
// Each function returns { valid: boolean, field: string|null, message: string|null }

import { parseHeightToCm, parseWeightToKg, parseWeeklyRateToKg } from "../../lib/units";

export const CAPS = {
  height_cm: { min: 120, max: 230 },
  weight_kg: { min: 30, max: 300 },
  weekly_loss_kg: { min: 0.1, max: 1.0 },
  weekly_gain_kg: { min: 0.05, max: 0.3 },
  body_fat_pct: { min: 3, max: 60 },
  custom_calories: { min: 1200, max: 6000 },
  steps_per_day: { min: 0, max: 20000 },
  cardio_minutes_per_week: { min: 0, max: 600 },
  cardio_avg_hr: { min: 0, max: 220 },
  rest_day_deficit: { min: 0, max: 800 },
  high_day_surplus: { min: 0, max: 800 },
};

const ok = () => ({ valid: true, field: null, message: null });
const fail = (field, message) => ({ valid: false, field, message });

// ─── Step validators ──────────────────────────────────────────────────────────

/** Step 1: Name */
export function validateName({ firstName, lastName }) {
  if (!firstName?.trim()) return fail("firstName", "Enter your first name.");
  if (!lastName?.trim()) return fail("lastName", "Enter your last name.");
  return ok();
}

/** Step 2: Date of birth */
export function validateDateOfBirth({ dateOfBirth }) {
  if (!dateOfBirth) return fail("dateOfBirth", "Enter your date of birth.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateOfBirth))) {
    return fail("dateOfBirth", "Enter a valid date.");
  }
  const dob = new Date(dateOfBirth);
  const now = new Date();
  const age = now.getFullYear() - dob.getFullYear();
  if (age < 13 || age > 100) return fail("dateOfBirth", "Enter a valid date of birth.");
  return ok();
}

/** Step 3: Sex */
export function validateSex({ sex }) {
  if (!sex || !["male", "female"].includes(sex)) {
    return fail("sex", "Select an option.");
  }
  return ok();
}

/** Step 4: Unit system */
export function validateUnitSystem({ unitSystem }) {
  if (!["metric", "imperial"].includes(unitSystem)) {
    return fail("unitSystem", "Select a unit system.");
  }
  return ok();
}

/** Step 5: Body metrics */
export function validateBodyMetrics({ heightInput, startingWeightInput, goalWeightInput, bodyFatPctInput, unitSystem }) {
  const heightCm = parseHeightToCm(heightInput, unitSystem);
  if (!heightCm) {
    const range = unitSystem === "imperial" ? "4'0\"–7'7\"" : "120–230 cm";
    return fail("height", `Enter a valid height (${range}).`);
  }

  const startKg = parseWeightToKg(startingWeightInput, unitSystem);
  if (!startKg) {
    const range = unitSystem === "imperial" ? "66–661 lb" : "30–300 kg";
    return fail("startingWeight", `Enter a valid current weight (${range}).`);
  }

  const goalKg = parseWeightToKg(goalWeightInput, unitSystem);
  if (!goalKg) {
    const range = unitSystem === "imperial" ? "66–661 lb" : "30–300 kg";
    return fail("goalWeight", `Enter a valid goal weight (${range}).`);
  }

  if (bodyFatPctInput !== "" && bodyFatPctInput !== null && bodyFatPctInput !== undefined) {
    const bf = Number(bodyFatPctInput);
    if (!Number.isFinite(bf) || bf < CAPS.body_fat_pct.min || bf > CAPS.body_fat_pct.max) {
      return fail("bodyFatPct", `Body fat must be between ${CAPS.body_fat_pct.min}% and ${CAPS.body_fat_pct.max}%.`);
    }
  }

  return ok();
}

/** Step 6: Goal type */
export function validateGoal({ goalType }) {
  if (!["lose", "maintain", "gain"].includes(goalType)) {
    return fail("goalType", "Select a goal.");
  }
  return ok();
}

/** Step 7: Weekly rate (only shown if goalType !== 'maintain') */
export function validateWeeklyRate({ weeklyRateInput, goalType, unitSystem }) {
  if (goalType === "maintain") return ok(); // step is skipped

  const kg = parseWeeklyRateToKg(weeklyRateInput, unitSystem);
  if (!kg) {
    return fail("weeklyRate", "Enter a weekly target.");
  }

  if (goalType === "lose") {
    if (kg < CAPS.weekly_loss_kg.min || kg > CAPS.weekly_loss_kg.max) {
      const { min, max } = CAPS.weekly_loss_kg;
      if (unitSystem === "imperial") {
        return fail("weeklyRate", `Enter a loss rate between ${(min * 2.20462).toFixed(2)}–${(max * 2.20462).toFixed(1)} lb/wk.`);
      }
      return fail("weeklyRate", `Enter a loss rate between ${min}–${max} kg/wk.`);
    }
  }

  if (goalType === "gain") {
    if (kg < CAPS.weekly_gain_kg.min || kg > CAPS.weekly_gain_kg.max) {
      const { min, max } = CAPS.weekly_gain_kg;
      if (unitSystem === "imperial") {
        return fail("weeklyRate", `Enter a gain rate between ${(min * 2.20462).toFixed(2)}–${(max * 2.20462).toFixed(1)} lb/wk.`);
      }
      return fail("weeklyRate", `Enter a gain rate between ${min}–${max} kg/wk.`);
    }
  }

  return ok();
}

/** Step 8: Calorie mode */
export function validateCalories({ calorieMode, customCalories }) {
  if (calorieMode === "custom") {
    const cal = Number(customCalories);
    if (!Number.isFinite(cal) || cal < CAPS.custom_calories.min || cal > CAPS.custom_calories.max) {
      return fail("customCalories", `Calories must be between ${CAPS.custom_calories.min}–${CAPS.custom_calories.max} kcal.`);
    }
  }
  return ok();
}

/** Step 9: Activity level */
export function validateActivityLevel({ activityLevel }) {
  const valid = ["inactive", "light", "moderate", "heavy", "extreme"];
  if (!valid.includes(activityLevel)) {
    return fail("activityLevel", "Select an activity level.");
  }
  return ok();
}

/** Step 10: Training schedule */
export function validateTrainingSchedule({ splitMode, trainingDaysSelected, trainingFrequencyRange, rollingStartDate }) {
  if (splitMode === "fixed") {
    if (!trainingDaysSelected || trainingDaysSelected.length === 0) {
      return fail("trainingDays", "Select at least one training day.");
    }
  }

  if (splitMode === "rolling") {
    if (!trainingFrequencyRange) {
      return fail("trainingFrequencyRange", "Select a training frequency.");
    }
    const date = rollingStartDate || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return fail("rollingStartDate", "Enter a valid start date.");
    }
  }

  return ok();
}

/** Step 11: Gym & experience */
export function validateGymExperience({ experienceLevel, gymType }) {
  const levels = ["beginner", "intermediate", "advanced"];
  const types = ["home", "commercial", "independent", "other"];
  if (!levels.includes(experienceLevel)) return fail("experienceLevel", "Select an experience level.");
  if (!types.includes(gymType)) return fail("gymType", "Select a gym type.");
  return ok();
}

/** Step 12: Baselines — all optional, just range-check if provided */
export function validateBaselines({ baselineStepsInput, baselineCardioMinutesInput, baselineCardioHrInput }) {
  if (baselineStepsInput !== "" && baselineStepsInput != null) {
    const n = Math.round(Number(baselineStepsInput));
    if (!Number.isFinite(n) || n < 0 || n > CAPS.steps_per_day.max) {
      return fail("baselineSteps", `Steps must be between 0–${CAPS.steps_per_day.max.toLocaleString()}.`);
    }
  }
  if (baselineCardioMinutesInput !== "" && baselineCardioMinutesInput != null) {
    const n = Math.round(Number(baselineCardioMinutesInput));
    if (!Number.isFinite(n) || n < 0 || n > CAPS.cardio_minutes_per_week.max) {
      return fail("baselineCardioMinutes", `Cardio minutes must be 0–${CAPS.cardio_minutes_per_week.max}.`);
    }
  }
  if (baselineCardioHrInput !== "" && baselineCardioHrInput != null) {
    const n = Math.round(Number(baselineCardioHrInput));
    if (!Number.isFinite(n) || n < 0 || n > CAPS.cardio_avg_hr.max) {
      return fail("baselineCardioHr", `Heart rate must be 0–${CAPS.cardio_avg_hr.max}.`);
    }
  }
  return ok();
}

/** Step 13: Nutrition preferences — always valid (all optional text) */
export function validateNutritionPreferences() {
  return ok();
}

/** Step 14: Allergies — always valid (free text) */
export function validateAllergies() {
  return ok();
}

/** Step 15: Safety disclaimer */
export function validateSafety({ disclaimerAccepted }) {
  if (!disclaimerAccepted) {
    return fail("disclaimer", "You must accept the health disclaimer to continue.");
  }
  return ok();
}

// ─── Dispatcher — used by wizard shell ───────────────────────────────────────

const STEP_VALIDATORS = [
  null,                        // index 0 unused
  validateName,                // 1
  validateDateOfBirth,         // 2
  validateSex,                 // 3
  validateUnitSystem,          // 4
  validateBodyMetrics,         // 5
  validateGoal,                // 6
  validateWeeklyRate,          // 7
  validateCalories,            // 8
  validateActivityLevel,       // 9
  validateTrainingSchedule,    // 10
  validateGymExperience,       // 11
  validateBaselines,           // 12
  validateNutritionPreferences,// 13
  validateAllergies,           // 14
  validateSafety,              // 15
];

/**
 * Validate a specific step against form state.
 * @param {number} step  1–15
 * @param {object} form  full form state object
 * @returns {{ valid: boolean, field: string|null, message: string|null }}
 */
export function validateStep(step, form) {
  const fn = STEP_VALIDATORS[step];
  if (!fn) return ok();
  return fn(form);
}
