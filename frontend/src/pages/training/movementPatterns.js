export const MOVEMENT_PATTERNS = {
  // NECK (supplementary — not in default day templates)
  neck_flexion:    { id: 'neck_flexion',    label: 'Neck Flexion',         exercises: ['Neck Flexion with Harness', 'Chin Tuck Isometric Hold', '4-Point Neck Flexion'], beginner_default: 'Chin Tuck Isometric Hold' },
  neck_extension:  { id: 'neck_extension',  label: 'Neck Extension',       exercises: ['Neck Extension with Harness', 'Prone Neck Extension', 'Neck Bridge (bench-supported)'], beginner_default: 'Prone Neck Extension' },
  neck_lateral:    { id: 'neck_lateral',    label: 'Neck Lateral Flexion', exercises: ['Lateral Neck Flexion with Harness', 'Side-lying Neck Lateral Flexion'], beginner_default: 'Side-lying Neck Lateral Flexion' },

  // SHOULDER GIRDLE / SCAPULAR
  serratus:        { id: 'serratus',        label: 'Serratus Anterior',    exercises: ['Push-up Plus', 'Cable Serratus Punch', 'Wall Slide', 'Dynamic Hug (cable)'], beginner_default: 'Cable Serratus Punch' },
  upper_trap:      { id: 'upper_trap',      label: 'Upper Traps',          exercises: ['Barbell Shrug', 'Dumbbell Shrug', 'Cable Shrug', "Farmer's Carry"], beginner_default: 'Cable Shrug' },
  mid_trap:        { id: 'mid_trap',        label: 'Mid Traps',            exercises: ['Prone T Raise', 'Cable Face Pull', 'Seated Cable Row (retraction emphasis)'], beginner_default: 'Cable Face Pull' },
  lower_trap:      { id: 'lower_trap',      label: 'Lower Traps',          exercises: ['Prone Y Raise', 'Low-to-High Cable Y Raise'], beginner_default: 'Low-to-High Cable Y Raise' },
  rhomboids:       { id: 'rhomboids',       label: 'Rhomboids',            exercises: ['Seated Cable Row', 'Dumbbell Bent-over Row', 'Chest-supported Row'], beginner_default: 'Seated Cable Row' },

  // ROTATOR CUFF (supplementary)
  supraspinatus:     { id: 'supraspinatus',     label: 'Shoulder Abduction (init)', exercises: ['Full-Can Raise', 'Cable Scapular-Plane Elevation'], beginner_default: 'Full-Can Raise' },
  external_rotation: { id: 'external_rotation', label: 'External Rotation',         exercises: ['Side-lying External Rotation', 'Cable External Rotation', '90/90 Cable External Rotation', 'Face Pull with External Rotation'], beginner_default: 'Cable External Rotation' },
  internal_rotation: { id: 'internal_rotation', label: 'Internal Rotation',         exercises: ['Cable Internal Rotation', 'Prone Internal Rotation'], beginner_default: 'Cable Internal Rotation' },

  // CHEST
  chest_horizontal: {
    id: 'chest_horizontal', label: 'Chest — Horizontal Press',
    exercises: ['Converging Machine Chest Press', 'Dumbbell Press', 'Flat Barbell Bench Press', 'Cable Flye (Seated)', 'Pec Dec'],
    beginner_default: 'Converging Machine Chest Press',
  },
  chest_upper: {
    id: 'chest_upper', label: 'Chest — Upper (Low-to-High)',
    exercises: ['Cable Flye (Low to High)', 'Flat Dumbbell Press (Neutral Grip)', 'Converging Machine Chest Press (Neutral Grip)', 'High Incline Press (Neutral Grip)'],
    beginner_default: 'Cable Flye (Low to High)',
  },

  // ANTERIOR DELTOID
  anterior_delt: {
    id: 'anterior_delt', label: 'Front Delt',
    exercises: ['Cable Front Raise', 'Dumbbell Front Raise', 'Neutral-Grip Overhead Press', 'Incline Seated Flye (cuff attachment)'],
    beginner_default: 'Cable Front Raise',
  },

  // LATERAL DELTOID
  lateral_delt: {
    id: 'lateral_delt', label: 'Side Delt',
    exercises: ['Cable Lateral Raise', 'Machine Lateral Raise', 'Incline Side-lying Dumbbell Lateral Raise', 'Standing Dumbbell Lateral Raise', 'Cable Y Raise', 'Cable Cuffed Lateral Raise', 'Laying Cuffed Lateral Raise'],
    beginner_default: 'Cable Lateral Raise',
  },

  // POSTERIOR DELTOID
  posterior_delt: {
    id: 'posterior_delt', label: 'Rear Delt',
    exercises: ['Reverse Pec Dec (Neutral Grip)', 'Seated Bent-over Rear Lateral Raise (Neutral Grip)', 'Incline Prone Rear Delt Raise'],
    beginner_default: 'Reverse Pec Dec (Neutral Grip)',
  },

  // TRICEPS
  triceps_long: {
    id: 'triceps_long', label: 'Triceps — Overhead',
    exercises: ['Overhead Cable Tricep Extension', 'Seated Overhead Dumbbell Extension', 'Incline Skull Crusher (EZ Bar)'],
    beginner_default: 'Overhead Cable Tricep Extension',
  },
  triceps_lateral: {
    id: 'triceps_lateral', label: 'Triceps — Pushdown',
    exercises: ['Overhand Cable Pushdown (Bar)', 'Machine Dip', 'Close-grip Bench Press', 'Weighted Dip'],
    beginner_default: 'Overhand Cable Pushdown (Bar)',
  },
  triceps_medial: {
    id: 'triceps_medial', label: 'Triceps — Rope Pushdown',
    exercises: ['Rope Cable Pushdown', 'Reverse-grip Cable Pushdown'],
    beginner_default: 'Rope Cable Pushdown',
  },

  // BICEPS
  biceps_long: {
    id: 'biceps_long', label: 'Biceps — Curl',
    exercises: ['Machine Curl', 'Incline Dumbbell Curl', 'Cable Curl', 'Conventional Dumbbell Curl'],
    beginner_default: 'Machine Curl',
  },
  biceps_short: {
    id: 'biceps_short', label: 'Biceps — Preacher',
    exercises: ['Machine Preacher Curl', 'Preacher Curl (EZ Bar)', 'Preacher Curl (Dumbbell)'],
    beginner_default: 'Machine Preacher Curl',
  },
  brachialis: {
    id: 'brachialis', label: 'Brachialis',
    exercises: ['Hammer Curl', 'Reverse Curl'],
    beginner_default: 'Hammer Curl',
  },

  // BACK
  lats_vertical: {
    id: 'lats_vertical', label: 'Back — Vertical Pull',
    exercises: ['Lat Pulldown', 'Weighted Pull-up'],
    beginner_default: 'Lat Pulldown',
  },
  lats_row: {
    id: 'lats_row', label: 'Back — Row (Elbows Tucked)',
    exercises: ['Seated Single-arm Row', 'Single-arm Dumbbell Row', 'Single-arm Pulldown'],
    beginner_default: 'Seated Single-arm Row',
  },
  upper_back_row: {
    id: 'upper_back_row', label: 'Upper Back — Wide Row',
    exercises: ['Seated Wide-grip Row (Elbows Flared)', 'Machine Row', 'Chest-supported Row'],
    beginner_default: 'Seated Wide-grip Row (Elbows Flared)',
  },

  // CORE
  rectus_abdominis: {
    id: 'rectus_abdominis', label: 'Core — Spinal Flexion',
    exercises: ['Cable Crunch', 'Hanging Leg Raise', 'Decline Weighted Sit-up'],
    beginner_default: 'Cable Crunch',
  },

  // SPINAL ERECTORS
  erectors: {
    id: 'erectors', label: 'Lower Back',
    exercises: ['Romanian Deadlift', 'Conventional Deadlift', 'Stiff-leg Deadlift'],
    beginner_default: 'Romanian Deadlift',
  },

  // HIP FLEXORS
  hip_flexors: {
    id: 'hip_flexors', label: 'Hip Flexors',
    exercises: ['Cable Hip Flexion', 'Hanging Knee Raise', 'Lying Leg Raise'],
    beginner_default: 'Cable Hip Flexion',
  },

  // GLUTES
  glutes_max: {
    id: 'glutes_max', label: 'Glutes — Hip Extension',
    exercises: ['Hip Thrust Machine', 'Barbell Hip Thrust', 'Bulgarian Split Squat', 'Cable Glute Kickback', 'Single-leg Hip Thrust'],
    beginner_default: 'Hip Thrust Machine',
  },
  glutes_med: {
    id: 'glutes_med', label: 'Glutes — Abduction',
    exercises: ['Cable Hip Abduction', 'Banded Clamshell', 'Lateral Band Walk', 'Single-leg Romanian Deadlift'],
    beginner_default: 'Cable Hip Abduction',
  },

  // ADDUCTORS
  adductors: {
    id: 'adductors', label: 'Adductors',
    exercises: ['Hip Adduction Machine', 'Cable Hip Adduction', 'Sumo Squat', 'Sumo Deadlift'],
    beginner_default: 'Hip Adduction Machine',
  },

  // HAMSTRINGS
  hamstrings_short: {
    id: 'hamstrings_short', label: 'Hamstrings — Knee Curl',
    exercises: ['Prone Lying Leg Curl', 'Standing Leg Curl'],
    beginner_default: 'Prone Lying Leg Curl',
  },
  hamstrings_long: {
    id: 'hamstrings_long', label: 'Hamstrings — Hip Hinge',
    exercises: ['Seated Leg Curl', 'Romanian Deadlift', 'Nordic Hamstring Curl', 'Single-leg Romanian Deadlift'],
    beginner_default: 'Seated Leg Curl',
  },

  // QUADRICEPS
  quads_press: {
    id: 'quads_press', label: 'Quads — Press / Squat',
    exercises: ['Leg Press', 'Hack Squat', 'Barbell Back Squat', 'Pendulum Squat', 'Bulgarian Split Squat'],
    beginner_default: 'Leg Press',
  },
  quads_extension: {
    id: 'quads_extension', label: 'Quads — Leg Extension',
    exercises: ['Seated Leg Extension', 'Reverse Nordic Curl'],
    beginner_default: 'Seated Leg Extension',
  },

  // CALVES
  calves_gastroc: {
    id: 'calves_gastroc', label: 'Calves — Standing',
    exercises: ['Standing Calf Raise (Machine)', 'Single-leg Standing Calf Raise', 'Leg Press Calf Raise'],
    beginner_default: 'Standing Calf Raise (Machine)',
  },
  calves_soleus: {
    id: 'calves_soleus', label: 'Calves — Seated',
    exercises: ['Seated Calf Raise', 'Donkey Calf Raise'],
    beginner_default: 'Seated Calf Raise',
  },

  // LOWER LEG (supplementary)
  tibialis:  { id: 'tibialis',  label: 'Tibialis',  exercises: ['Tibialis Raise', 'Weighted Tibialis Raise', 'Cable Dorsiflexion'], beginner_default: 'Tibialis Raise' },
  peroneals: { id: 'peroneals', label: 'Peroneals', exercises: ['Cable Ankle Eversion', 'Banded Eversion', 'Single-leg Balance (unstable)'], beginner_default: 'Banded Eversion' },
};

// DAY_PATTERNS: maps day type key → ordered array of pattern IDs
export const DAY_PATTERNS = {
  push:           ['chest_horizontal', 'chest_upper', 'anterior_delt', 'lateral_delt', 'triceps_long', 'triceps_lateral'],
  pull:           ['lats_vertical', 'lats_row', 'upper_back_row', 'posterior_delt', 'biceps_long', 'biceps_short'],
  legs:           ['quads_press', 'quads_extension', 'hamstrings_short', 'hamstrings_long', 'glutes_max', 'glutes_med', 'calves_gastroc'],
  upper_a:        ['chest_horizontal', 'lats_vertical', 'lateral_delt', 'lats_row', 'biceps_long', 'triceps_lateral'],
  upper_b:        ['chest_upper', 'upper_back_row', 'anterior_delt', 'lats_row', 'biceps_short', 'triceps_long'],
  lower_a:        ['quads_press', 'hamstrings_short', 'hamstrings_long', 'glutes_max', 'calves_gastroc'],
  lower_b:        ['quads_extension', 'hamstrings_long', 'glutes_med', 'adductors', 'calves_soleus'],
  chest_back:     ['chest_horizontal', 'chest_upper', 'lats_vertical', 'lats_row', 'upper_back_row', 'posterior_delt'],
  arms_shoulders: ['lateral_delt', 'posterior_delt', 'biceps_long', 'biceps_short', 'triceps_long', 'triceps_lateral'],
  anterior_a:     ['chest_horizontal', 'anterior_delt', 'quads_press', 'biceps_long', 'rectus_abdominis'],
  anterior_b:     ['chest_upper', 'lateral_delt', 'quads_extension', 'biceps_short', 'hip_flexors'],
  posterior_a:    ['lats_vertical', 'upper_back_row', 'hamstrings_long', 'glutes_max', 'triceps_lateral'],
  posterior_b:    ['lats_row', 'posterior_delt', 'hamstrings_short', 'glutes_med', 'triceps_long'],
  fullbody:       ['chest_horizontal', 'lats_vertical', 'lateral_delt', 'quads_press', 'hamstrings_long', 'glutes_max'],
  legs_bro:       ['quads_press', 'quads_extension', 'hamstrings_short', 'hamstrings_long', 'glutes_max', 'glutes_med', 'adductors', 'calves_gastroc', 'calves_soleus'],
  chest:          ['chest_horizontal', 'chest_upper'],
  back:           ['lats_vertical', 'lats_row', 'upper_back_row', 'rhomboids'],
  shoulders:      ['lateral_delt', 'anterior_delt', 'posterior_delt'],
  arms:           ['biceps_long', 'biceps_short', 'brachialis', 'triceps_long', 'triceps_lateral'],
};

// Maps day names (as stored in training_program_days.day_name) to DAY_PATTERNS keys
const DAY_NAME_MAP = {
  'Push':              'push',
  'Pull':              'pull',
  'Legs':              'legs',
  'Upper A':           'upper_a',
  'Upper B':           'upper_b',
  'Lower A':           'lower_a',
  'Lower B':           'lower_b',
  'Chest & Back':      'chest_back',
  'Arms & Shoulders':  'arms_shoulders',
  'Shoulders & Arms':  'arms_shoulders',
  'Anterior A':        'anterior_a',
  'Anterior B':        'anterior_b',
  'Posterior A':       'posterior_a',
  'Posterior B':       'posterior_b',
  'Full Body A':       'fullbody',
  'Full Body B':       'fullbody',
  'Full Body C':       'fullbody',
  'Full Body D':       'fullbody',
  'Chest':             'chest',
  'Back':              'back',
  'Shoulders':         'shoulders',
  'Arms':              'arms',
};

export function getDayType(dayName) {
  return DAY_NAME_MAP[dayName] ?? null;
}
