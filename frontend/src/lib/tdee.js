// ─── TDEE & Macro Calculations ───────────────────────────────────────────────
// Mifflin-St Jeor BMR + activity multiplier + goal adjustment + macro split.
// This is the single source of truth for all calorie/macro calculations.
// Used by: backend /api/nutrition/init, onboarding calorie preview, Settings.

export const ACTIVITY_MULTIPLIERS = {
  inactive: 1.2,
  light: 1.375,
  moderate: 1.55,
  heavy: 1.725,
  extreme: 1.9,
};

export const CALORIE_FLOOR = 1200;
export const CALORIE_CEILING = 6000;

/**
 * Calculate age in years from a date-of-birth string.
 * @param {string} dateOfBirth  YYYY-MM-DD
 * @returns {number}
 */
export function getAgeFromDOB(dateOfBirth) {
  if (!dateOfBirth) return 30; // sensible fallback
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return Math.max(15, Math.min(100, age));
}

/**
 * Mifflin-St Jeor Basal Metabolic Rate.
 * @param {{ weightKg: number, heightCm: number, ageYears: number, sex: 'male'|'female' }}
 * @returns {number}  BMR in kcal/day
 */
export function calculateBMR({ weightKg, heightCm, ageYears, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === "female" ? base - 161 : base + 5);
}

/**
 * Total Daily Energy Expenditure.
 * @param {{ weightKg: number, heightCm: number, ageYears: number, sex: 'male'|'female', activityLevel: string }}
 * @returns {number}  TDEE in kcal/day
 */
export function calculateTDEE({ weightKg, heightCm, ageYears, sex, activityLevel = "moderate" }) {
  const bmr = calculateBMR({ weightKg, heightCm, ageYears, sex });
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? ACTIVITY_MULTIPLIERS.moderate;
  return Math.round(bmr * multiplier);
}

/**
 * Suggest a daily calorie target based on goal and rate.
 * @param {{ weightKg, heightCm, dateOfBirth, sex, activityLevel, goalType, weeklyRateKg, customCalories, calorieMode }}
 * @returns {number}  target kcal/day (clamped to 1200–6000)
 */
export function suggestCalories({
  weightKg,
  heightCm,
  dateOfBirth,
  sex,
  activityLevel = "moderate",
  goalType = "maintain",
  weeklyRateKg = 0,
  calorieMode = "ai",
  customCalories = null,
}) {
  if (calorieMode === "custom" && customCalories) {
    return Math.round(Math.min(CALORIE_CEILING, Math.max(CALORIE_FLOOR, Number(customCalories))));
  }

  const ageYears = getAgeFromDOB(dateOfBirth);
  const tdee = calculateTDEE({ weightKg, heightCm, ageYears, sex, activityLevel });

  if (!goalType || goalType === "maintain") return tdee;

  const rate = Math.abs(Number(weeklyRateKg) || 0);
  // 1 kg of fat ≈ 7,700 kcal
  const dailyDelta = Math.round((rate * 7700) / 7);

  let target;
  if (goalType === "lose") target = tdee - dailyDelta;
  else if (goalType === "gain") target = tdee + dailyDelta;
  else target = tdee;

  return Math.round(Math.min(CALORIE_CEILING, Math.max(CALORIE_FLOOR, target)));
}

/**
 * Calculate macro targets from a calorie total and body weight.
 * Uses lean mass protein if body fat % is known.
 * @param {{ calories: number, weightKg: number, bodyFatPct?: number }}
 * @returns {{ calories: number, proteinG: number, carbsG: number, fatG: number }}
 */
export function macrosFromCalories({ calories, weightKg, bodyFatPct }) {
  const cal = Math.round(calories);

  // Protein: 2.4g per kg lean mass if BF% known, else 2.0g per kg bodyweight
  let proteinG;
  if (bodyFatPct != null && bodyFatPct >= 3 && bodyFatPct <= 60) {
    const leanMassKg = weightKg * (1 - bodyFatPct / 100);
    proteinG = Math.round(leanMassKg * 2.4);
  } else {
    proteinG = Math.round(weightKg * 2.0);
  }

  // Fat: at least 0.8g/kg bodyweight, minimum 20% of calories
  const fatFloor = Math.round(weightKg * 0.8);
  const fatFromCals = Math.round((cal * 0.20) / 9);
  const fatG = Math.max(fatFloor, fatFromCals);

  // Carbs: remainder
  const carbsG = Math.max(0, Math.round((cal - proteinG * 4 - fatG * 9) / 4));

  return { calories: cal, proteinG, carbsG, fatG };
}

/**
 * Calculate all three day-type macro targets.
 * @param {{ calories: number, weightKg: number, bodyFatPct?: number, restDayDeficit?: number, highDaySurplus?: number }}
 * @returns {{ training, rest, high }}
 */
export function getDayTargets({
  calories,
  weightKg,
  bodyFatPct,
  restDayDeficit = 250,
  highDaySurplus = 200,
}) {
  const trainingCal = calories;
  const restCal = Math.max(CALORIE_FLOOR, calories - restDayDeficit);
  const highCal = Math.min(CALORIE_CEILING, calories + highDaySurplus);

  return {
    training: macrosFromCalories({ calories: trainingCal, weightKg, bodyFatPct }),
    rest: macrosFromCalories({ calories: restCal, weightKg, bodyFatPct }),
    high: macrosFromCalories({ calories: highCal, weightKg, bodyFatPct }),
  };
}

/**
 * Build a preview for the onboarding calorie step.
 * Returns calories + macros using best available data so far.
 * Falls back sensibly if fields aren't yet filled.
 */
export function buildCaloriePreview(form) {
  const weightKg = form._startingWeightKg;
  const heightCm = form._heightCm;

  if (!weightKg || !heightCm) return null;

  const calories = suggestCalories({
    weightKg,
    heightCm,
    dateOfBirth: form.dateOfBirth,
    sex: form.sex || "male",
    activityLevel: form.activityLevel || "moderate",
    goalType: form.goalType || "maintain",
    weeklyRateKg: form._weeklyRateKg,
    calorieMode: "ai",
  });

  return macrosFromCalories({ calories, weightKg, bodyFatPct: form._bodyFatPct });
}
