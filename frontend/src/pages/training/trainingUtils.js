// ─── Training Utilities ────────────────────────────────────────────────────
import { MOVEMENT_PATTERNS, DAY_PATTERNS, getDayType } from './movementPatterns';

export const DAY_KEYS  = ['mon','tue','wed','thu','fri','sat','sun'];
export const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const DAY_FULL  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// JS getDay() → 0=Sun. We use 0=Mon internally.
export function jsDayToIdx(d) { return d.getDay() === 0 ? 6 : d.getDay() - 1; }

export function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function todayISO() { return formatLocalDate(new Date()); }

export function prettyDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_SHORT[jsDayToIdx(d)]} ${d.getDate()} ${MON_SHORT[d.getMonth()]}`;
}

// ─── "Choose for me" scheduling presets ─────────────────────────────────────
export function suggestTrainingDays(n) {
  const presets = {
    1: ['wed'],
    2: ['mon','thu'],
    3: ['mon','wed','fri'],
    4: ['mon','tue','thu','fri'],
    5: ['mon','tue','wed','fri','sat'],
    6: ['mon','tue','wed','thu','fri','sat'],
    7: ['mon','tue','wed','thu','fri','sat','sun'],
  };
  return presets[Math.min(7, Math.max(1, n))] || presets[3];
}

// ─── Universal ordered split list ───────────────────────────────────────────
// Two categories: fixed weekly splits, then rolling splits. Custom always last.
export const ORDERED_SPLITS = [
  // ── Fixed weekly splits ──────────────────────────────────────────────────
  {
    id: 'fullbody_2x', name: 'Full Body 2×/Week', type: 'fullbody',
    days_per_week: 2, recommended: false,
    description: 'Two full-body sessions per week, alternating A and B. Plenty of recovery between sessions.',
    who: 'Perfect for beginners easing into structured training or anyone with limited time.',
    days: [
      { name: 'Full Body A', muscle_focus: ['chest','back','shoulders','quadriceps','hamstrings','core'], color: '#dc143c' },
      { name: 'Full Body B', muscle_focus: ['chest','back','shoulders','quadriceps','glutes','core'], color: '#b5153c' },
    ],
  },
  {
    id: 'fullbody_3', name: 'Full Body 3×/Week', type: 'fullbody',
    days_per_week: 3, recommended: true,
    description: 'Train every muscle group three times per week with rest days between sessions. Ideal for learning movement patterns and building a solid base.',
    who: 'The best starting point for beginners — build confidence with compound lifts and see consistent progress.',
    days: [
      { name: 'Full Body A', muscle_focus: ['chest','back','shoulders','quadriceps','hamstrings','core'], color: '#dc143c' },
      { name: 'Full Body B', muscle_focus: ['chest','back','shoulders','quadriceps','hamstrings','core'], color: '#b5153c' },
      { name: 'Full Body C', muscle_focus: ['chest','back','shoulders','quadriceps','hamstrings','core'], color: '#8a0f2e' },
    ],
  },
  {
    id: 'upper_lower_3', name: 'Upper / Lower 3-Day', type: 'upper_lower',
    days_per_week: 3, recommended: false,
    description: 'Alternates upper and lower body sessions across 3 days — A/B/A one week, B/A/B the next.',
    who: 'Beginners ready to step beyond full-body training, or intermediates who can only commit to 3 days.',
    days: [
      { name: 'Upper A', muscle_focus: ['chest','back','shoulders','biceps','triceps'], color: '#dc143c' },
      { name: 'Lower A', muscle_focus: ['quadriceps','hamstrings','glutes','calves'], color: '#b5153c' },
      { name: 'Upper B', muscle_focus: ['chest','back','shoulders','biceps','triceps'], color: '#b5153c' },
    ],
  },
  {
    id: 'ppl_3', name: 'Push / Pull / Legs', type: 'ppl',
    days_per_week: 3, recommended: false,
    description: 'Dedicated sessions for pushing muscles, pulling muscles, and legs. One training day followed by one rest day throughout the week.',
    who: 'Intermediates who want clear muscle focus per session with proper recovery built in.',
    days: [
      { name: 'Push',  muscle_focus: ['chest','shoulders','triceps'],               color: '#dc143c' },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Pull',  muscle_focus: ['back','biceps','traps'],                     color: '#b5153c' },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Legs',  muscle_focus: ['quadriceps','hamstrings','glutes','calves'], color: '#8a0f2e' },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
    ],
  },
  {
    id: 'chest_back_arms_legs', name: 'Chest & Back / Arms / Legs', type: 'bro',
    days_per_week: 3, recommended: false,
    description: 'Chest and back together, a dedicated arms and shoulders day, then legs. A clean 3-day structure with balanced volume.',
    who: 'Intermediate lifters who want a simple 3-day split with clear muscle focus each session.',
    days: [
      { name: 'Chest & Back',     muscle_focus: ['chest','back'],                           color: '#dc143c' },
      { name: 'Arms & Shoulders', muscle_focus: ['biceps','triceps','shoulders'],            color: '#8a0f2e' },
      { name: 'Legs',             muscle_focus: ['quadriceps','hamstrings','glutes','calves'], color: '#8a0f2e' },
    ],
  },
  {
    id: 'upper_lower_4', name: 'Upper / Lower', type: 'upper_lower',
    days_per_week: 4, recommended: false,
    enforce_rest_between_pairs: true,
    description: 'Two upper body and two lower body sessions per week, with a mandatory rest day between each pair of sessions.',
    who: 'A solid choice for intermediate trainees — higher volume with built-in recovery between paired sessions.',
    days: [
      { name: 'Upper A', muscle_focus: ['chest','back','shoulders','biceps','triceps'], color: '#dc143c' },
      { name: 'Lower A', muscle_focus: ['quadriceps','hamstrings','glutes','calves'],   color: '#b5153c' },
      { name: 'Rest',    muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Upper B', muscle_focus: ['chest','back','shoulders','biceps','triceps'], color: '#b5153c' },
      { name: 'Lower B', muscle_focus: ['quadriceps','hamstrings','glutes','calves'],   color: '#8a0f2e' },
      { name: 'Rest',    muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Rest',    muscle_focus: [], color: '#2a2a2a', is_rest: true },
    ],
  },
  {
    id: 'anterior_posterior', name: 'Anterior / Posterior', type: 'upper_lower',
    days_per_week: 4, recommended: false,
    enforce_rest_between_pairs: true,
    description: 'Splits the body into front-chain (anterior) and back-chain (posterior) sessions, with a rest day between each pair.',
    who: 'Intermediates who want an athletic, movement-based approach with balanced push/pull patterns.',
    days: [
      { name: 'Anterior A', muscle_focus: ['chest','shoulders','quadriceps','biceps','core'], color: '#dc143c' },
      { name: 'Posterior A', muscle_focus: ['back','glutes','hamstrings','triceps','traps'],  color: '#b5153c' },
      { name: 'Rest',        muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Anterior B', muscle_focus: ['chest','shoulders','quadriceps','biceps','core'], color: '#dc143c' },
      { name: 'Posterior B', muscle_focus: ['back','glutes','hamstrings','triceps','traps'],  color: '#b5153c' },
      { name: 'Rest',        muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Rest',        muscle_focus: [], color: '#2a2a2a', is_rest: true },
    ],
  },
  {
    id: 'arnold_5', name: 'Arnold Split', type: 'arnold',
    days_per_week: 5, recommended: false,
    description: "Push, Pull, Legs, then Chest & Back, then Shoulders & Arms. Arnold Schwarzenegger's classic 5-day structure.",
    who: 'Advanced lifters who want high session variety and are recovering well on 5 training days per week.',
    days: [
      { name: 'Push',             muscle_focus: ['chest','shoulders','triceps'],               color: '#dc143c' },
      { name: 'Pull',             muscle_focus: ['back','biceps','traps'],                     color: '#b5153c' },
      { name: 'Legs',             muscle_focus: ['quadriceps','hamstrings','glutes','calves'], color: '#8a0f2e' },
      { name: 'Chest & Back',     muscle_focus: ['chest','back'],                             color: '#b5153c' },
      { name: 'Shoulders & Arms', muscle_focus: ['shoulders','biceps','triceps'],             color: '#b5153c' },
    ],
  },
  {
    id: 'bro_5', name: 'Classic Bro Split', type: 'bro',
    days_per_week: 5, recommended: false,
    description: 'Each major muscle group gets its own dedicated session per week. Maximum volume per muscle per session.',
    who: 'Advanced lifters with dialled-in recovery, sleep, and nutrition who want the highest per-session volume.',
    days: [
      { name: 'Chest',     muscle_focus: ['chest'],                                       color: '#dc143c' },
      { name: 'Back',      muscle_focus: ['back','traps'],                                color: '#b5153c' },
      { name: 'Shoulders', muscle_focus: ['shoulders'],                                   color: '#b5153c' },
      { name: 'Arms',      muscle_focus: ['biceps','triceps','forearms'],                 color: '#8a0f2e' },
      { name: 'Legs',      muscle_focus: ['quadriceps','hamstrings','glutes','calves'],   color: '#8a0f2e' },
    ],
  },

  // ── Rolling splits ───────────────────────────────────────────────────────
  {
    id: 'upper_lower_rolling', name: 'Upper / Lower', type: 'upper_lower',
    days_per_week: null, is_rolling: true, recommended: false,
    description: 'Upper and Lower sessions cycle continuously with a built-in rest slot — no fixed weekly pattern.',
    who: 'Intermediates with an irregular schedule who still want to run an effective upper/lower structure.',
    days: [
      { name: 'Upper', muscle_focus: ['chest','back','shoulders','biceps','triceps'], color: '#dc143c' },
      { name: 'Lower', muscle_focus: ['quadriceps','hamstrings','glutes','calves'],   color: '#b5153c' },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
    ],
  },
  {
    id: 'ppl_rolling', name: 'Push / Pull / Legs', type: 'ppl',
    days_per_week: null, is_rolling: true, recommended: false,
    description: 'Push, Pull, and Legs sessions cycle continuously with a rest slot after each full round.',
    who: 'Intermediates who want PPL frequency without a fixed weekly schedule.',
    days: [
      { name: 'Push',  muscle_focus: ['chest','shoulders','triceps'],               color: '#dc143c' },
      { name: 'Pull',  muscle_focus: ['back','biceps','traps'],                     color: '#b5153c' },
      { name: 'Legs',  muscle_focus: ['quadriceps','hamstrings','glutes','calves'], color: '#8a0f2e' },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
    ],
  },
  {
    id: 'ppl_rest_rolling', name: 'Push / Pull / Legs (rest days)', type: 'ppl',
    days_per_week: null, is_rolling: true, recommended: false,
    description: 'A rest day built in after every session — Push, rest, Pull, rest, Legs, rest, rest, then repeat.',
    who: 'Those who need more recovery time between sessions or prefer a relaxed training pace.',
    days: [
      { name: 'Push',  muscle_focus: ['chest','shoulders','triceps'],               color: '#dc143c' },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Pull',  muscle_focus: ['back','biceps','traps'],                     color: '#b5153c' },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Legs',  muscle_focus: ['quadriceps','hamstrings','glutes','calves'], color: '#8a0f2e' },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Rest',  muscle_focus: [], color: '#2a2a2a', is_rest: true },
    ],
  },
  {
    id: 'anterior_posterior_rolling', name: 'Anterior / Posterior', type: 'upper_lower',
    days_per_week: null, is_rolling: true, recommended: false,
    description: 'Front-chain and back-chain sessions alternate continuously with rest days between. A and B sessions cycle through automatically.',
    who: 'Intermediates who want an athletic training approach without committing to specific days of the week.',
    days: [
      { name: 'Anterior A', muscle_focus: ['chest','shoulders','quadriceps','biceps','core'], color: '#dc143c' },
      { name: 'Rest',        muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Posterior A', muscle_focus: ['back','glutes','hamstrings','triceps','traps'],  color: '#b5153c' },
      { name: 'Rest',        muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Anterior B', muscle_focus: ['chest','shoulders','quadriceps','biceps','core'], color: '#dc143c' },
      { name: 'Rest',        muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Posterior B', muscle_focus: ['back','glutes','hamstrings','triceps','traps'],  color: '#b5153c' },
      { name: 'Rest',        muscle_focus: [], color: '#2a2a2a', is_rest: true },
    ],
  },
  {
    id: 'fullbody_abcd_rolling', name: 'Full Body ABCD', type: 'fullbody',
    days_per_week: null, is_rolling: true, recommended: false,
    description: 'Four distinct full-body sessions (A, B, C, D) cycle continuously with rest days between each. 4 rotations keep training varied.',
    who: 'Those who enjoy full-body training but want more variety across sessions without a fixed weekly schedule.',
    days: [
      { name: 'Full Body A', muscle_focus: ['chest','back','shoulders','quadriceps','hamstrings','core'], color: '#dc143c' },
      { name: 'Rest',         muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Full Body B', muscle_focus: ['chest','back','shoulders','quadriceps','glutes','core'],     color: '#b5153c' },
      { name: 'Rest',         muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Full Body C', muscle_focus: ['chest','back','shoulders','quadriceps','hamstrings','core'], color: '#8a0f2e' },
      { name: 'Rest',         muscle_focus: [], color: '#2a2a2a', is_rest: true },
      { name: 'Full Body D', muscle_focus: ['chest','back','shoulders','quadriceps','glutes','core'],     color: '#6b0b24' },
      { name: 'Rest',         muscle_focus: [], color: '#2a2a2a', is_rest: true },
    ],
  },
];

// ─── Split templates by experience level ────────────────────────────────────
// Derived from ORDERED_SPLITS — keyed by level for backward compatibility.
const _levelOf = {
  fullbody_2x: 'beginner',
  fullbody_3: 'beginner',
  upper_lower_3: 'beginner',
  ppl_3: 'intermediate',
  chest_back_arms_legs: 'intermediate',
  upper_lower_4: 'intermediate',
  anterior_posterior: 'intermediate',
  upper_lower_rolling: 'intermediate',
  ppl_rolling: 'intermediate',
  ppl_rest_rolling: 'intermediate',
  anterior_posterior_rolling: 'intermediate',
  fullbody_abcd_rolling: 'intermediate',
  arnold_5: 'advanced',
  bro_5: 'advanced',
  custom: 'advanced',
};

export const SPLIT_TEMPLATES = {
  beginner:     ORDERED_SPLITS.filter(t => _levelOf[t.id] === 'beginner'),
  intermediate: ORDERED_SPLITS.filter(t => _levelOf[t.id] === 'intermediate'),
  advanced:     ORDERED_SPLITS.filter(t => _levelOf[t.id] === 'advanced'),
};

// ─── Build a schedule for any date range (past or future) ───────────────────
export function buildScheduleRange(program, programDays, fromISO, numDays = 7) {
  if (!program || !programDays?.length) return [];

  const trainingDayKeys = program.training_days || [];
  const activeDays = [...programDays]
    .filter(d => !d.is_rest)
    .sort((a, b) => a.day_order - b.day_order);

  if (!activeDays.length || !trainingDayKeys.length) return [];

  const startDate = program.start_date
    ? new Date(program.start_date + 'T00:00:00')
    : new Date();
  startDate.setHours(0, 0, 0, 0);

  const fromDate = new Date(fromISO + 'T00:00:00');
  fromDate.setHours(0, 0, 0, 0);

  const ms = 86400000;
  // Count how many training days occurred between program start and fromDate
  const daysDiff = Math.floor((fromDate - startDate) / ms);
  let elapsed = 0;
  if (daysDiff > 0) {
    for (let i = 0; i < daysDiff; i++) {
      const d = new Date(startDate.getTime() + i * ms);
      if (trainingDayKeys.includes(DAY_KEYS[jsDayToIdx(d)])) elapsed++;
    }
  }

  const schedule = [];
  for (let i = 0; i < numDays; i++) {
    const date = new Date(fromDate.getTime() + i * ms);
    const key = DAY_KEYS[jsDayToIdx(date)];
    if (trainingDayKeys.includes(key) && activeDays.length) {
      const idx = ((elapsed % activeDays.length) + activeDays.length) % activeDays.length;
      schedule.push({ date: formatLocalDate(date), dayKey: key, splitDay: activeDays[idx], isTraining: true, cycleIndex: elapsed });
      elapsed++;
    } else {
      schedule.push({ date: formatLocalDate(date), dayKey: key, splitDay: null, isTraining: false, cycleIndex: null });
    }
  }
  return schedule;
}

// ─── Build a 14-day schedule from an active program ─────────────────────────
export function buildSchedule(program, programDays, numDays = 14) {
  if (!program || !programDays?.length) return [];

  const trainingDayKeys = program.training_days || [];
  const activeDays = [...programDays]
    .filter(d => !d.is_rest)
    .sort((a, b) => a.day_order - b.day_order);

  if (!activeDays.length || !trainingDayKeys.length) return [];

  const startDate = program.start_date
    ? new Date(program.start_date + 'T00:00:00')
    : new Date();
  startDate.setHours(0,0,0,0);

  const today = new Date(); today.setHours(0,0,0,0);
  const ms = 86400000;
  const daysSinceStart = Math.max(0, Math.floor((today - startDate) / ms));

  // Count training days that elapsed before today
  let elapsed = 0;
  for (let i = 0; i < daysSinceStart; i++) {
    const d = new Date(startDate.getTime() + i * ms);
    if (trainingDayKeys.includes(DAY_KEYS[jsDayToIdx(d)])) elapsed++;
  }

  const schedule = [];
  for (let i = 0; i < numDays; i++) {
    const date = new Date(today.getTime() + i * ms);
    const key  = DAY_KEYS[jsDayToIdx(date)];
    if (trainingDayKeys.includes(key) && activeDays.length) {
      const idx = elapsed % activeDays.length;
      schedule.push({ date: formatLocalDate(date), dayKey: key, splitDay: activeDays[idx], isTraining: true,  cycleIndex: elapsed });
      elapsed++;
    } else {
      schedule.push({ date: formatLocalDate(date), dayKey: key, splitDay: null, isTraining: false, cycleIndex: null });
    }
  }
  return schedule;
}

// ─── Auto-assign exercises to a program day based on muscle focus ────────────
// Returns array of {exercise_id, name, order_index, target_sets, target_reps_min, target_reps_max, target_rir}
export function autoAssignExercises(muscleFocusList, experienceLevel, allExercises, dayName) {
  // For beginners, use curated beginner defaults from movement patterns
  if (experienceLevel === 'beginner' && dayName) {
    const dayType = getDayType(dayName);
    const patternIds = dayType ? DAY_PATTERNS[dayType] : [];
    if (patternIds.length > 0) {
      return patternIds.slice(0, 8).map((pid, idx) => {
        const pattern = MOVEMENT_PATTERNS[pid];
        if (!pattern) return null;
        // Try to find a matching exercise in Supabase pool by name
        const match = allExercises.find(e =>
          e.name?.toLowerCase() === pattern.beginner_default.toLowerCase()
        );
        return {
          exercise_id: match?.id ?? null,
          custom_name: match ? null : pattern.beginner_default,
          movement_pattern_id: pid,
          order_index: idx,
          target_sets: 2,
          target_reps_min: 9,
          target_reps_max: 12,
          set_2_reps_min: 12,
          set_2_reps_max: 15,
          target_rir: 2,
          notes: null,
        };
      }).filter(Boolean);
    }
  }

  // Intermediate / Advanced: existing muscle-group-based logic (unchanged)
  const allowed = {
    beginner:     ['beginner'],
    intermediate: ['beginner', 'intermediate'],
    advanced:     ['beginner', 'intermediate', 'advanced'],
  }[experienceLevel] || ['beginner'];

  const result = [];
  let order = 0;
  for (const muscle of muscleFocusList) {
    const pool = allExercises.filter(e =>
      e.primary_group_name === muscle && allowed.includes(e.difficulty)
    );
    const compounds = pool.filter(e => e.is_compound).slice(0, 1);
    const isolation = pool.filter(e => !e.is_compound).slice(0, 1);
    for (const ex of [...compounds, ...isolation]) {
      result.push({
        exercise_id: ex.id,
        custom_name: null,
        movement_pattern_id: null,
        order_index: order++,
        target_sets: 2,
        target_reps_min: ex.is_compound ? 6 : 9,
        target_reps_max: ex.is_compound ? 9 : 12,
        set_2_reps_min:  ex.is_compound ? 9 : 12,
        set_2_reps_max:  ex.is_compound ? 12 : 15,
        target_rir: 2,
        notes: null,
      });
    }
  }
  return result.slice(0, 10);
}

// ─── Colour map for muscle groups ───────────────────────────────────────────
export const MUSCLE_COLORS = {
  chest:'#dc143c', back:'#b5153c', shoulders:'#b5153c',
  biceps:'#8a0f2e', triceps:'#11aa66', forearms:'#aa7700',
  quadriceps:'#8a0f2e', hamstrings:'#8833dd', glutes:'#ff6633',
  calves:'#33aacc', core:'#ffcc00', traps:'#cc5500',
};
export const MUSCLE_DISPLAY = {
  chest:'Chest', back:'Back', shoulders:'Shoulders',
  biceps:'Biceps', triceps:'Triceps', forearms:'Forearms',
  quadriceps:'Quads', hamstrings:'Hamstrings', glutes:'Glutes',
  calves:'Calves', core:'Core', traps:'Traps',
};

// ─── Validation helper ───────────────────────────────────────────────────────
// Returns true if any 3 consecutive week-days (Mon=0...Sun=6) are all in selectedDays
// Used to validate Upper/Lower and Anterior/Posterior 4-day splits
export function hasConsecutiveTriple(selectedDays) {
  const ORDER = ['mon','tue','wed','thu','fri','sat','sun'];
  const set = new Set(selectedDays);
  for (let i = 0; i <= 4; i++) {
    if (set.has(ORDER[i]) && set.has(ORDER[i+1]) && set.has(ORDER[i+2])) return true;
  }
  return false;
}
