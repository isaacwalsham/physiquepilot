// ─── Training Utilities ────────────────────────────────────────────────────

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

// ─── Split templates by experience level ────────────────────────────────────
export const SPLIT_TEMPLATES = {
  beginner: [
    {
      id: 'fullbody_3', name: 'Full Body 3×/Week', type: 'fullbody',
      days_per_week: 3, recommended: true,
      description: 'Train every muscle group 3 times per week with a full rest day between each session. Perfect for learning movement patterns and building base strength.',
      who: 'Best for complete beginners who want to build confidence with compound lifts and see consistent progress.',
      days: [
        { name:'Full Body A', muscle_focus:['chest','back','shoulders','quadriceps','hamstrings','core'], color:'#dc143c' },
        { name:'Full Body B', muscle_focus:['chest','back','shoulders','quadriceps','hamstrings','core'], color:'#b5153c' },
        { name:'Full Body C', muscle_focus:['chest','back','shoulders','quadriceps','hamstrings','core'], color:'#8a0f2e' },
      ],
    },
    {
      id: 'upper_lower_4', name: 'Upper / Lower (4 Day)', type: 'upper_lower',
      days_per_week: 4, recommended: false,
      description: '2 upper body sessions and 2 lower body sessions per week. Good variety with adequate recovery per muscle group.',
      who: "Great once you're comfortable with the basics and want to start specialising muscle groups.",
      days: [
        { name:'Upper A', muscle_focus:['chest','back','shoulders','biceps','triceps'], color:'#dc143c' },
        { name:'Lower A', muscle_focus:['quadriceps','hamstrings','glutes','calves'],   color:'#4d8eff' },
        { name:'Upper B', muscle_focus:['chest','back','shoulders','biceps','triceps'], color:'#b5153c' },
        { name:'Lower B', muscle_focus:['quadriceps','hamstrings','glutes','calves'],   color:'#2255bb' },
      ],
    },
  ],
  intermediate: [
    {
      id: 'ppl_3', name: 'Push / Pull / Legs (3 Day)', type: 'ppl',
      days_per_week: 3, recommended: false,
      description: 'Dedicated Push (chest/shoulders/triceps), Pull (back/biceps), and Legs sessions. Classic and effective.',
      who: 'Good if you train 3 days and want to maximise each session with volume for specific muscle groups.',
      days: [
        { name:'Push',  muscle_focus:['chest','shoulders','triceps'],              color:'#ff6633' },
        { name:'Pull',  muscle_focus:['back','biceps','traps'],                    color:'#4d8eff' },
        { name:'Legs',  muscle_focus:['quadriceps','hamstrings','glutes','calves'],color:'#22cc88' },
      ],
    },
    {
      id: 'ppl_6', name: 'Push / Pull / Legs (6 Day)', type: 'ppl',
      days_per_week: 6, recommended: true,
      description: 'Run the PPL cycle twice per week — each muscle group gets trained 2× weekly. High frequency, high volume.',
      who: 'Best for intermediates who want maximum muscle stimulus with sufficient recovery between sessions.',
      days: [
        { name:'Push A', muscle_focus:['chest','shoulders','triceps'],              color:'#ff6633' },
        { name:'Pull A', muscle_focus:['back','biceps','traps'],                    color:'#4d8eff' },
        { name:'Legs A', muscle_focus:['quadriceps','hamstrings','glutes','calves'],color:'#22cc88' },
        { name:'Push B', muscle_focus:['chest','shoulders','triceps'],              color:'#cc4422' },
        { name:'Pull B', muscle_focus:['back','biceps','traps'],                    color:'#2255bb' },
        { name:'Legs B', muscle_focus:['quadriceps','hamstrings','glutes','calves'],color:'#11aa66' },
      ],
    },
    {
      id: 'upper_lower_4', name: 'Upper / Lower (4 Day)', type: 'upper_lower',
      days_per_week: 4, recommended: false,
      description: 'Upper and lower body trained twice each per week. Excellent for hypertrophy with manageable session length.',
      who: 'Great balance of frequency and volume. Popular choice for intermediate hypertrophy programs.',
      days: [
        { name:'Upper A', muscle_focus:['chest','back','shoulders','biceps','triceps'], color:'#dc143c' },
        { name:'Lower A', muscle_focus:['quadriceps','hamstrings','glutes','calves'],   color:'#4d8eff' },
        { name:'Upper B', muscle_focus:['chest','back','shoulders','biceps','triceps'], color:'#b5153c' },
        { name:'Lower B', muscle_focus:['quadriceps','hamstrings','glutes','calves'],   color:'#2255bb' },
      ],
    },
    {
      id: 'arnold', name: 'Arnold Split (6 Day)', type: 'arnold',
      days_per_week: 6, recommended: false,
      description: 'Chest+Back / Shoulders+Arms / Legs — run twice per week. Arnold Schwarzenegger\'s classic structure.',
      who: 'For intermediate-to-advanced lifters who enjoy high volume and are recovering well from 6-day training.',
      days: [
        { name:'Chest + Back A',     muscle_focus:['chest','back'],                    color:'#dc143c' },
        { name:'Shoulders + Arms A', muscle_focus:['shoulders','biceps','triceps'],    color:'#b5153c' },
        { name:'Legs A',             muscle_focus:['quadriceps','hamstrings','glutes','calves'], color:'#22cc88' },
        { name:'Chest + Back B',     muscle_focus:['chest','back'],                    color:'#8a0f2e' },
        { name:'Shoulders + Arms B', muscle_focus:['shoulders','biceps','triceps'],    color:'#6d0824' },
        { name:'Legs B',             muscle_focus:['quadriceps','hamstrings','glutes','calves'], color:'#11aa66' },
      ],
    },
  ],
  advanced: [
    {
      id: 'bro_5', name: 'Classic Bro Split (5 Day)', type: 'bro',
      days_per_week: 5, recommended: true,
      description: 'Each major muscle group gets its own dedicated session per week. Maximum volume per session.',
      who: 'Advanced lifters who have dialled in their recovery, sleep and nutrition and want maximal per-session volume.',
      days: [
        { name:'Chest',      muscle_focus:['chest'],                                    color:'#dc143c' },
        { name:'Back',       muscle_focus:['back','traps'],                             color:'#4d8eff' },
        { name:'Shoulders',  muscle_focus:['shoulders'],                               color:'#f59e0b' },
        { name:'Arms',       muscle_focus:['biceps','triceps','forearms'],              color:'#22cc88' },
        { name:'Legs',       muscle_focus:['quadriceps','hamstrings','glutes','calves'],color:'#bb33ff' },
      ],
    },
    {
      id: 'ppl_6', name: 'Push / Pull / Legs (6 Day)', type: 'ppl',
      days_per_week: 6, recommended: false,
      description: 'PPL run twice per week. Each muscle group hit 2× with high volume and advanced exercise selection.',
      who: 'High frequency approach. Works well for advanced lifters who want maximum stimulus with variety.',
      days: [
        { name:'Push A', muscle_focus:['chest','shoulders','triceps'],              color:'#ff6633' },
        { name:'Pull A', muscle_focus:['back','biceps','traps'],                    color:'#4d8eff' },
        { name:'Legs A', muscle_focus:['quadriceps','hamstrings','glutes','calves'],color:'#22cc88' },
        { name:'Push B', muscle_focus:['chest','shoulders','triceps'],              color:'#cc4422' },
        { name:'Pull B', muscle_focus:['back','biceps','traps'],                    color:'#2255bb' },
        { name:'Legs B', muscle_focus:['quadriceps','hamstrings','glutes','calves'],color:'#11aa66' },
      ],
    },
    {
      id: 'custom', name: 'Custom Split', type: 'custom',
      days_per_week: null, recommended: false,
      description: 'Build your program entirely from scratch. Full control over every training day and exercise selection.',
      who: 'For experienced lifters who know exactly what works for their body and want complete customisation.',
      days: [],
    },
  ],
};

// ─── Universal ordered split list (shown to all users regardless of level) ──
export const ORDERED_SPLITS = [
  {
    id: 'fullbody_3', name: 'Full Body 3×/Week', type: 'fullbody',
    days_per_week: 3, recommended: true,
    description: 'Train every muscle group 3 times per week with a full rest day between each session. Perfect for learning movement patterns and building base strength.',
    who: 'The most effective starting point for anyone — beginners build confidence, advanced lifters maintain frequency.',
    days: [
      { name:'Full Body A', muscle_focus:['chest','back','shoulders','quadriceps','hamstrings','core'], color:'#dc143c' },
      { name:'Full Body B', muscle_focus:['chest','back','shoulders','quadriceps','hamstrings','core'], color:'#b5153c' },
      { name:'Full Body C', muscle_focus:['chest','back','shoulders','quadriceps','hamstrings','core'], color:'#8a0f2e' },
    ],
  },
  {
    id: 'upper_lower_4', name: 'Upper / Lower (4 Day)', type: 'upper_lower',
    days_per_week: 4, recommended: false,
    description: 'Upper and lower body trained twice each per week. Excellent frequency with manageable session length.',
    who: 'Great balance of frequency and volume. Works well at any experience level.',
    days: [
      { name:'Upper A', muscle_focus:['chest','back','shoulders','biceps','triceps'], color:'#dc143c' },
      { name:'Lower A', muscle_focus:['quadriceps','hamstrings','glutes','calves'],   color:'#4d8eff' },
      { name:'Upper B', muscle_focus:['chest','back','shoulders','biceps','triceps'], color:'#b5153c' },
      { name:'Lower B', muscle_focus:['quadriceps','hamstrings','glutes','calves'],   color:'#2255bb' },
    ],
  },
  {
    id: 'ppl_6', name: 'Push / Pull / Legs (6 Day)', type: 'ppl',
    days_per_week: 6, recommended: false,
    description: 'Run the PPL cycle twice per week — each muscle group gets trained 2× weekly. High frequency, high volume.',
    who: 'Best for those who want maximum muscle stimulus and can commit to 6 days per week.',
    days: [
      { name:'Push A', muscle_focus:['chest','shoulders','triceps'],              color:'#ff6633' },
      { name:'Pull A', muscle_focus:['back','biceps','traps'],                    color:'#4d8eff' },
      { name:'Legs A', muscle_focus:['quadriceps','hamstrings','glutes','calves'],color:'#22cc88' },
      { name:'Push B', muscle_focus:['chest','shoulders','triceps'],              color:'#cc4422' },
      { name:'Pull B', muscle_focus:['back','biceps','traps'],                    color:'#2255bb' },
      { name:'Legs B', muscle_focus:['quadriceps','hamstrings','glutes','calves'],color:'#11aa66' },
    ],
  },
  {
    id: 'bro_5', name: 'Classic Bro Split (5 Day)', type: 'bro',
    days_per_week: 5, recommended: false,
    description: 'Each major muscle group gets its own dedicated session per week. Maximum volume per session.',
    who: 'For those who have dialled in recovery, sleep and nutrition and want maximal per-session volume.',
    days: [
      { name:'Chest',     muscle_focus:['chest'],                                    color:'#dc143c' },
      { name:'Back',      muscle_focus:['back','traps'],                             color:'#4d8eff' },
      { name:'Shoulders', muscle_focus:['shoulders'],                               color:'#f59e0b' },
      { name:'Arms',      muscle_focus:['biceps','triceps','forearms'],              color:'#22cc88' },
      { name:'Legs',      muscle_focus:['quadriceps','hamstrings','glutes','calves'],color:'#bb33ff' },
    ],
  },
];

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
export function autoAssignExercises(muscleFocusList, experienceLevel, allExercises) {
  const allowed = {
    beginner:     ['beginner'],
    intermediate: ['beginner','intermediate'],
    advanced:     ['beginner','intermediate','advanced'],
  }[experienceLevel] || ['beginner'];

  const result = [];
  let order = 0;

  for (const muscle of muscleFocusList) {
    const pool = allExercises.filter(e =>
      e.primary_group_name === muscle && allowed.includes(e.difficulty)
    );
    const compounds  = pool.filter(e => e.is_compound).slice(0, 1);
    const isolation  = pool.filter(e => !e.is_compound).slice(0, 1);
    for (const ex of [...compounds, ...isolation]) {
      result.push({
        exercise_id: ex.id,
        custom_name: null,
        order_index: order++,
        target_sets: 2,
        target_reps_min: ex.is_compound ? 6 : 10,
        target_reps_max: ex.is_compound ? 9 : 15,
        target_rir: 0,
        notes: null,
      });
    }
  }
  return result.slice(0, 10);
}

// ─── Colour map for muscle groups ───────────────────────────────────────────
export const MUSCLE_COLORS = {
  chest:'#dc143c', back:'#4d8eff', shoulders:'#f59e0b',
  biceps:'#22cc88', triceps:'#11aa66', forearms:'#aa7700',
  quadriceps:'#bb33ff', hamstrings:'#8833dd', glutes:'#ff6633',
  calves:'#33aacc', core:'#ffcc00', traps:'#cc5500',
};
export const MUSCLE_DISPLAY = {
  chest:'Chest', back:'Back', shoulders:'Shoulders',
  biceps:'Biceps', triceps:'Triceps', forearms:'Forearms',
  quadriceps:'Quads', hamstrings:'Hamstrings', glutes:'Glutes',
  calves:'Calves', core:'Core', traps:'Traps',
};
