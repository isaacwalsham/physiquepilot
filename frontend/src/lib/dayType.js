// ─── Day Type Resolution ──────────────────────────────────────────────────────
// Single canonical function for determining training/rest/high day type.
// Used by: ProfileContext, Dashboard, Nutrition, Training, CardioSteps.
// NEVER recalculate day type independently — always use getDayType().

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Determine the day type for a given date based on a user's profile.
 *
 * @param {import('../context/ProfileContext').Profile} profile
 * @param {Date} [date]  defaults to today
 * @returns {'training'|'rest'|'high'}
 */
export function getDayType(profile, date = new Date()) {
  if (!profile) return "rest";

  // High day check takes priority over training/rest
  if (profile.high_day_schedule && profile.high_day_schedule !== "none") {
    if (isHighDay(profile, date)) return "high";
  }

  if (profile.split_mode === "fixed") {
    const dayAbbr = DAY_ABBR[date.getDay()];
    return (profile.training_days || []).includes(dayAbbr) ? "training" : "rest";
  }

  if (profile.split_mode === "rolling") {
    return getRollingDayType(profile, date);
  }

  return "rest";
}

/**
 * Determine day type for every day in a given week (Mon–Sun).
 * Useful for rendering weekly schedule views.
 *
 * @param {object} profile
 * @param {Date} [weekStart]  any date in the target week; defaults to current week's Monday
 * @returns {Array<{ date: Date, dayAbbr: string, dayType: 'training'|'rest'|'high' }>}
 */
export function getWeekSchedule(profile, weekStart) {
  const base = weekStart ? new Date(weekStart) : getMondayOfWeek(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      date: d,
      dayAbbr: DAY_ABBR[d.getDay()],
      dayType: getDayType(profile, d),
    };
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isHighDay(profile, date) {
  if (profile.high_day_schedule === "fixed_days") {
    const dayAbbr = DAY_ABBR[date.getDay()];
    return (profile.high_day_weekdays || []).includes(dayAbbr);
  }

  if (
    profile.high_day_schedule === "interval" &&
    profile.high_day_interval > 0 &&
    profile.high_day_start_date
  ) {
    const start = new Date(profile.high_day_start_date);
    const daysSince = Math.floor((date - start) / 86_400_000);
    return daysSince >= 0 && daysSince % profile.high_day_interval === 0;
  }

  // 'manual' — never auto-assigned, user triggers from Dashboard
  return false;
}

function getRollingDayType(profile, date) {
  if (!profile.rolling_start_date) return "rest";

  const start = new Date(profile.rolling_start_date);
  // Normalise both to midnight UTC to avoid DST drift
  const startMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const dateMs = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSince = Math.floor((dateMs - startMs) / 86_400_000);

  if (daysSince < 0) return "rest"; // before rolling start

  const range = profile.training_frequency_range || "2-4";
  const [minStr, maxStr] = range.split("-");
  const min = Number(minStr) || 2;
  const max = Number(maxStr) || 4;
  const trainDaysPerCycle = Math.round((min + max) / 2);
  const cyclePeriod = 7;
  const posInCycle = daysSince % cyclePeriod;

  return posInCycle < trainDaysPerCycle ? "training" : "rest";
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
