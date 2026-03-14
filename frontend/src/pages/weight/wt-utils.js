// wt-utils.js — Pure calculation utilities for Weight Tracking
// No React, no Supabase imports.

// ─── Unit conversions ────────────────────────────────────────────────────────
export const kgToLb = (kg) => kg * 2.2046226218;
export const lbToKg = (lb) => lb / 2.2046226218;

export const kgToStoneLb = (kg) => {
  const totalLb = kgToLb(kg);
  const st = Math.floor(totalLb / 14);
  return { st, lb: totalLb - st * 14 };
};

export const stoneLbToKg = (st, lb) => lbToKg(Number(st) * 14 + Number(lb));

export const round2 = (n) => Math.round(n * 100) / 100;
export const round1 = (n) => Math.round(n * 10) / 10;

// ─── Display weight in user's unit ───────────────────────────────────────────
// unit: 'metric' | 'imperial' | 'stone'
// Returns e.g. "82.4 kg" or "181.7 lb" or "12 st 13.7 lb"
export function displayWeight(kg, unit, withUnit = true) {
  if (kg == null || !isFinite(kg)) return "—";
  if (unit === "imperial") {
    const lb = round1(kgToLb(kg));
    return withUnit ? `${lb} lb` : `${lb}`;
  }
  if (unit === "stone") {
    const { st, lb } = kgToStoneLb(kg);
    const lbRounded = round1(lb);
    return withUnit ? `${st} st ${lbRounded} lb` : `${st} st ${lbRounded}`;
  }
  // metric (default)
  const kgR = round1(kg);
  return withUnit ? `${kgR} kg` : `${kgR}`;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export const todayISO = () => new Date().toISOString().slice(0, 10);

export const daysBetween = (a, b) =>
  Math.round((new Date(b) - new Date(a)) / 86400000);

export const addDays = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const MONTHS_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export const formatDisplayDate = (iso) => {
  if (!iso) return "";
  // parse as local date to avoid UTC offset issues
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
};

// ─── Moving average (Happy Scale EWMA style) ─────────────────────────────────
// entries: [{log_date: 'YYYY-MM-DD', weight_kg: number, ...}] sorted ascending
// Algorithm: trend[i] = trend[i-1] + adjustedAlpha * (weight[i] - trend[i-1])
// adjustedAlpha = 1 - (1 - 0.1)^dayGap   (handles irregular entries)
export function calculateTrend(entries) {
  const ALPHA = 0.1;
  const sorted = [...entries].sort((a, b) =>
    a.log_date < b.log_date ? -1 : 1
  );
  const result = [];
  let prevTrend = null;
  let prevDate = null;

  for (const entry of sorted) {
    const w = Number(entry.weight_kg);
    if (!isFinite(w)) {
      result.push({ ...entry, trend: prevTrend });
      continue;
    }
    if (prevTrend === null) {
      prevTrend = w;
    } else {
      const gap = daysBetween(prevDate, entry.log_date);
      const alpha = 1 - Math.pow(1 - ALPHA, Math.max(1, gap));
      prevTrend = prevTrend + alpha * (w - prevTrend);
    }
    result.push({ ...entry, trend: round2(prevTrend) });
    prevDate = entry.log_date;
  }
  return result;
}

// ─── Linear regression ────────────────────────────────────────────────────────
// points: [{x: number (days from epoch), y: number (kg)}]
// Returns { slope (kg/day), intercept, predictAt(dayX) => kg, predictDay(targetKg) => dayX }
export function linearRegression(points) {
  if (!points || points.length < 2) {
    return {
      slope: 0,
      intercept: points?.[0]?.y ?? 0,
      predictAt: () => points?.[0]?.y ?? 0,
      predictDay: () => null,
    };
  }
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    return {
      slope: 0,
      intercept: sumY / n,
      predictAt: () => sumY / n,
      predictDay: () => null,
    };
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    predictAt: (dayX) => intercept + slope * dayX,
    predictDay: (targetKg) => {
      if (slope === 0) return null;
      return (targetKg - intercept) / slope;
    },
  };
}

// Helper: convert ISO date to days since epoch (integer)
export const dateToDayX = (iso) =>
  Math.floor(new Date(iso).getTime() / 86400000);

export const dayXToISO = (dayX) =>
  new Date(dayX * 86400000).toISOString().slice(0, 10);

// ─── BMI ─────────────────────────────────────────────────────────────────────
export function calcBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  return round1(weightKg / Math.pow(heightCm / 100, 2));
}

export function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: "Underweight", color: "#5b9bf8" };
  if (bmi < 25.0) return { label: "Normal", color: "#28b78d" };
  if (bmi < 30.0) return { label: "Overweight", color: "#f5a623" };
  if (bmi < 35.0) return { label: "Obese I", color: "#e8502a" };
  if (bmi < 40.0) return { label: "Obese II", color: "#c0392b" };
  return { label: "Obese III", color: "#922b21" };
}

// bmiThresholds(heightCm): returns weights at each BMI boundary for user's height
export function bmiThresholds(heightCm) {
  if (!heightCm) return null;
  const h = heightCm / 100;
  const hSq = h * h;
  return {
    underweight: round1(18.5 * hSq),
    normal: round1(25.0 * hSq),
    overweight: round1(30.0 * hSq),
    obese1: round1(35.0 * hSq),
    obese2: round1(40.0 * hSq),
  };
}

// ─── Milestone helpers ────────────────────────────────────────────────────────
// Divides the start→goal journey into 10 equal milestones.
// Returns { milestoneIndex (0-9), progressInMilestone (0-1), overallProgress (0-1), milestoneWeightKg, nextMilestoneWeightKg }
export function getMilestoneProgress(startKg, goalKg, currentTrendKg) {
  if (startKg == null || goalKg == null || currentTrendKg == null) return null;
  const totalChange = goalKg - startKg; // negative if losing
  if (totalChange === 0) return null;

  const milestoneSize = totalChange / 10;
  const traveled = currentTrendKg - startKg;
  const overallProgress = Math.min(1, Math.max(0, traveled / totalChange));
  const rawMilestone = overallProgress * 10;
  const milestoneIndex = Math.min(9, Math.floor(rawMilestone));
  const progressInMilestone = rawMilestone - milestoneIndex;

  const milestoneWeightKg = startKg + milestoneIndex * milestoneSize;
  const nextMilestoneWeightKg = startKg + (milestoneIndex + 1) * milestoneSize;

  return {
    milestoneIndex,
    progressInMilestone,
    overallProgress,
    milestoneWeightKg,
    nextMilestoneWeightKg,
  };
}

// ─── 10-day personal best ─────────────────────────────────────────────────────
// Returns the entry with lowest trend value in the last 10 entries
export function getTenDayBest(entriesWithTrend) {
  if (!entriesWithTrend || entriesWithTrend.length === 0) return null;
  const last10 = entriesWithTrend.slice(-10);
  return last10.reduce(
    (best, e) =>
      e.trend != null && (best === null || e.trend < best.trend) ? e : best,
    null
  );
}

// ─── Weekly rate from regression ─────────────────────────────────────────────
// Takes entries with trend, last N days, returns kg/week (negative = losing)
export function weeklyRateKg(entriesWithTrend, days = 30) {
  if (!entriesWithTrend || entriesWithTrend.length < 2) return null;
  const cutoff = addDays(todayISO(), -days);
  const slice = entriesWithTrend.filter((e) => e.log_date >= cutoff);
  if (slice.length < 2) return null;
  const points = slice.map((e) => ({
    x: dateToDayX(e.log_date),
    y: e.trend,
  }));
  const { slope } = linearRegression(points);
  return round2(slope * 7);
}
