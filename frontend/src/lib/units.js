// ─── Unit conversion utilities ───────────────────────────────────────────────
// All storage is metric (kg, cm). These functions convert between display and storage.

export const KG_TO_LB = 2.20462;
export const LB_TO_KG = 0.453592;
export const CM_TO_IN = 0.393701;
export const IN_TO_CM = 2.54;

// ─── Parse: display input → internal metric storage ──────────────────────────

/**
 * Parse a height string to centimetres.
 * Metric input: "180" → 180
 * Imperial input: "5'11\"" or "5'11" or "71" (inches) → cm
 * Returns null if invalid or out of range.
 */
export function parseHeightToCm(input, unitSystem) {
  if (!input && input !== 0) return null;
  const str = String(input).trim();
  if (!str) return null;

  let cm;

  if (unitSystem === "imperial") {
    // Try feet'inches" format first
    const match = str.replace(/[^0-9'" ]/g, "").match(/^(\d+)'\s*(\d+)/);
    if (match) {
      const feet = Number(match[1]);
      const inches = Number(match[2]);
      cm = Math.round((feet * 12 + inches) * IN_TO_CM);
    } else {
      // Fall back to treating input as total inches
      const inches = Number(str);
      if (!Number.isFinite(inches) || inches <= 0) return null;
      cm = Math.round(inches * IN_TO_CM);
    }
  } else {
    cm = Math.round(Number(str));
  }

  if (!Number.isFinite(cm) || cm < 120 || cm > 230) return null;
  return cm;
}

/**
 * Parse a weight string to kilograms.
 * Returns null if invalid or out of range (30–300 kg).
 */
export function parseWeightToKg(input, unitSystem) {
  if (input === null || input === undefined) return null;
  const str = String(input).trim();
  if (!str) return null;

  const num = Number(str);
  if (!Number.isFinite(num) || num <= 0) return null;

  const kg = unitSystem === "imperial" ? num * LB_TO_KG : num;
  const rounded = Math.round(kg * 10) / 10;
  if (rounded < 30 || rounded > 300) return null;
  return rounded;
}

/**
 * Parse a weekly rate of change string to kilograms.
 * No range enforcement here — caller applies goal-specific clamp.
 */
export function parseWeeklyRateToKg(input, unitSystem) {
  if (input === null || input === undefined) return null;
  const str = String(input).trim();
  if (!str) return null;

  const num = Number(str);
  if (!Number.isFinite(num) || num <= 0) return null;

  const kg = unitSystem === "imperial" ? num * LB_TO_KG : num;
  return Math.round(kg * 100) / 100;
}

// ─── Format: metric storage → display string ─────────────────────────────────

/**
 * Format kg to display string.
 * @param {number} kg
 * @param {'metric'|'imperial'} unitSystem
 * @param {number} decimals
 * @returns {string}  e.g. "82.5 kg" or "181.9 lb"
 */
export function displayWeight(kg, unitSystem, decimals = 1) {
  if (kg == null || !Number.isFinite(Number(kg))) return "—";
  if (unitSystem === "imperial") {
    return `${(kg * KG_TO_LB).toFixed(decimals)} lb`;
  }
  return `${Number(kg).toFixed(decimals)} kg`;
}

/**
 * Format cm to display string.
 * @param {number} cm
 * @param {'metric'|'imperial'} unitSystem
 * @returns {string}  e.g. "180 cm" or "5'11\""
 */
export function displayHeight(cm, unitSystem) {
  if (cm == null || !Number.isFinite(Number(cm))) return "—";
  if (unitSystem === "imperial") {
    const totalInches = cm * CM_TO_IN;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}

/**
 * Format a weekly rate kg value for display.
 * @param {number} kg
 * @param {'metric'|'imperial'} unitSystem
 * @returns {string}  e.g. "0.5 kg/wk" or "1.1 lb/wk"
 */
export function displayWeeklyRate(kg, unitSystem) {
  if (kg == null || !Number.isFinite(Number(kg))) return "—";
  if (unitSystem === "imperial") {
    return `${(kg * KG_TO_LB).toFixed(2)} lb/wk`;
  }
  return `${Number(kg).toFixed(2)} kg/wk`;
}

/**
 * Return the weight unit label only.
 * @param {'metric'|'imperial'} unitSystem
 * @returns {'kg'|'lb'}
 */
export function weightUnit(unitSystem) {
  return unitSystem === "imperial" ? "lb" : "kg";
}

/**
 * Return the height unit label only.
 * @param {'metric'|'imperial'} unitSystem
 * @returns {'cm'|'ft/in'}
 */
export function heightUnit(unitSystem) {
  return unitSystem === "imperial" ? "ft / in" : "cm";
}

/**
 * Convert a stored kg value to the display unit number (no label).
 * Useful for pre-populating inputs.
 */
export function kgToDisplay(kg, unitSystem, decimals = 1) {
  if (kg == null) return "";
  if (unitSystem === "imperial") return String((kg * KG_TO_LB).toFixed(decimals));
  return String(Number(kg).toFixed(decimals));
}

/**
 * Convert stored cm to a display string suitable for a text input.
 * Imperial: "5'11\""   Metric: "180"
 */
export function cmToDisplayInput(cm, unitSystem) {
  if (cm == null) return "";
  if (unitSystem === "imperial") {
    const totalInches = cm * CM_TO_IN;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  }
  return String(Math.round(cm));
}
