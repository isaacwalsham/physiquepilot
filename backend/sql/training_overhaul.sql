-- ═══════════════════════════════════════════════════════════════════
-- TRAINING SYSTEM OVERHAUL — Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add training experience to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_experience TEXT DEFAULT 'beginner';
-- Values: 'beginner' | 'intermediate' | 'advanced'

-- ───────────────────────────────────────────────────────────────────
-- EXERCISE LIBRARY TABLES
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  sort_order  INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercise_muscle_regions (
  id             SERIAL PRIMARY KEY,
  group_id       INT NOT NULL REFERENCES exercise_muscle_groups(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  scientific_name TEXT,
  sort_order     INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercises (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  primary_group_id    INT REFERENCES exercise_muscle_groups(id),
  primary_region_id   INT REFERENCES exercise_muscle_regions(id),
  equipment           TEXT DEFAULT 'any',
  is_compound         BOOLEAN DEFAULT false,
  difficulty          TEXT DEFAULT 'beginner',
  prompt_machine_brand BOOLEAN DEFAULT false,
  is_bilateral        BOOLEAN DEFAULT true,
  is_global           BOOLEAN DEFAULT true,
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────
-- TRAINING PROGRAM TABLES
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS training_programs (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  split_type       TEXT NOT NULL DEFAULT 'custom',
  is_active        BOOLEAN DEFAULT false,
  start_date       DATE,
  training_days    TEXT[] DEFAULT '{}',   -- e.g. ['mon','wed','fri']
  experience_level TEXT DEFAULT 'beginner',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_program_days (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id   UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  day_name     TEXT NOT NULL,
  day_label    TEXT,
  day_order    INT NOT NULL,
  is_rest      BOOLEAN DEFAULT false,
  muscle_focus TEXT[] DEFAULT '{}',
  color        TEXT DEFAULT '#b5153c',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS program_day_exercises (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_day_id  UUID NOT NULL REFERENCES training_program_days(id) ON DELETE CASCADE,
  exercise_id     INT REFERENCES exercises(id) ON DELETE SET NULL,
  custom_name     TEXT,
  order_index     INT NOT NULL,
  target_sets     INT DEFAULT 2,
  target_reps_min INT DEFAULT 6,
  target_reps_max INT DEFAULT 12,
  target_rir      INT DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────
-- SESSION LOGGING TABLES
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_day_id  UUID REFERENCES training_program_days(id) ON DELETE SET NULL,
  program_id      UUID REFERENCES training_programs(id) ON DELETE SET NULL,
  session_date    DATE NOT NULL,
  cycle_index     INT DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  is_rest_override BOOLEAN DEFAULT false,
  duration_minutes INT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_exercise_logs (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_session_id      UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  program_day_exercise_id UUID REFERENCES program_day_exercises(id) ON DELETE SET NULL,
  exercise_id             INT REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name           TEXT,
  set_number              INT NOT NULL,
  weight_kg               NUMERIC(7,2),
  reps                    INT,
  rir                     INT,
  execution_score         INT CHECK (execution_score BETWEEN 1 AND 10),
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE training_programs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_program_days      ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_day_exercises      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercise_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_muscle_groups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_muscle_regions    ENABLE ROW LEVEL SECURITY;

-- Training programs
DROP POLICY IF EXISTS "tp_own" ON training_programs;
CREATE POLICY "tp_own" ON training_programs FOR ALL USING (auth.uid() = user_id);

-- Program days (via program ownership)
DROP POLICY IF EXISTS "tpd_own" ON training_program_days;
CREATE POLICY "tpd_own" ON training_program_days FOR ALL USING (
  program_id IN (SELECT id FROM training_programs WHERE user_id = auth.uid())
);

-- Program day exercises
DROP POLICY IF EXISTS "pde_own" ON program_day_exercises;
CREATE POLICY "pde_own" ON program_day_exercises FOR ALL USING (
  program_day_id IN (
    SELECT id FROM training_program_days
    WHERE program_id IN (SELECT id FROM training_programs WHERE user_id = auth.uid())
  )
);

-- Workout sessions
DROP POLICY IF EXISTS "ws_own" ON workout_sessions;
CREATE POLICY "ws_own" ON workout_sessions FOR ALL USING (auth.uid() = user_id);

-- Session exercise logs
DROP POLICY IF EXISTS "sel_own" ON session_exercise_logs;
CREATE POLICY "sel_own" ON session_exercise_logs FOR ALL USING (
  workout_session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid())
);

-- Global exercises: read by all; user exercises: by owner
DROP POLICY IF EXISTS "ex_read" ON exercises;
DROP POLICY IF EXISTS "ex_insert" ON exercises;
DROP POLICY IF EXISTS "ex_update" ON exercises;
DROP POLICY IF EXISTS "ex_delete" ON exercises;
CREATE POLICY "ex_read"   ON exercises FOR SELECT USING (is_global = true OR auth.uid() = user_id);
CREATE POLICY "ex_insert" ON exercises FOR INSERT WITH CHECK (auth.uid() = user_id AND is_global = false);
CREATE POLICY "ex_update" ON exercises FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ex_delete" ON exercises FOR DELETE USING (auth.uid() = user_id);

-- Muscle groups / regions: read-only for all
DROP POLICY IF EXISTS "emg_read" ON exercise_muscle_groups;
DROP POLICY IF EXISTS "emr_read" ON exercise_muscle_regions;
CREATE POLICY "emg_read" ON exercise_muscle_groups FOR SELECT USING (true);
CREATE POLICY "emr_read" ON exercise_muscle_regions FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA — MUSCLE GROUPS
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO exercise_muscle_groups (name, display_name, sort_order) VALUES
  ('chest',      'Chest',       1),
  ('back',       'Back',        2),
  ('shoulders',  'Shoulders',   3),
  ('biceps',     'Biceps',      4),
  ('triceps',    'Triceps',     5),
  ('forearms',   'Forearms',    6),
  ('quadriceps', 'Quadriceps',  7),
  ('hamstrings', 'Hamstrings',  8),
  ('glutes',     'Glutes',      9),
  ('calves',     'Calves',     10),
  ('core',       'Core / Abs', 11),
  ('traps',      'Traps',      12)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA — MUSCLE REGIONS
-- ═══════════════════════════════════════════════════════════════════

-- CHEST
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Upper Chest', 'Pectoralis Major — Clavicular Fibres',    1),
       ('Mid Chest',   'Pectoralis Major — Sternocostal Fibres',  2),
       ('Lower Chest', 'Pectoralis Major — Abdominal Fibres',     3),
       ('Inner Chest', 'Pectoralis Minor',                        4)
     ) AS v(name,sci,ord)
WHERE g.name = 'chest'
ON CONFLICT DO NOTHING;

-- BACK
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Upper Lats',          'Latissimus Dorsi — Upper Fibres',      1),
       ('Lower Lats',          'Latissimus Dorsi — Lower Fibres',      2),
       ('Mid Back / Rhomboids','Rhomboids & Mid Trapezius',            3),
       ('Lower Back',          'Erector Spinae',                       4)
     ) AS v(name,sci,ord)
WHERE g.name = 'back'
ON CONFLICT DO NOTHING;

-- SHOULDERS
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Front Delt',    'Deltoid — Anterior Head',  1),
       ('Side Delt',     'Deltoid — Lateral Head',   2),
       ('Rear Delt',     'Deltoid — Posterior Head', 3),
       ('Rotator Cuff',  'Infraspinatus & Supraspinatus', 4)
     ) AS v(name,sci,ord)
WHERE g.name = 'shoulders'
ON CONFLICT DO NOTHING;

-- BICEPS
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Long Head',      'Biceps Brachii — Long Head',  1),
       ('Short Head',     'Biceps Brachii — Short Head', 2),
       ('Brachialis',     'Brachialis',                  3),
       ('Brachioradialis','Brachioradialis',              4)
     ) AS v(name,sci,ord)
WHERE g.name = 'biceps'
ON CONFLICT DO NOTHING;

-- TRICEPS
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Long Head',    'Triceps Brachii — Long Head',    1),
       ('Lateral Head', 'Triceps Brachii — Lateral Head', 2),
       ('Medial Head',  'Triceps Brachii — Medial Head',  3)
     ) AS v(name,sci,ord)
WHERE g.name = 'triceps'
ON CONFLICT DO NOTHING;

-- QUADS
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Rectus Femoris',   'Rectus Femoris',      1),
       ('Vastus Lateralis', 'Vastus Lateralis',    2),
       ('Vastus Medialis',  'Vastus Medialis (VMO)',3),
       ('Vastus Intermedius','Vastus Intermedius', 4)
     ) AS v(name,sci,ord)
WHERE g.name = 'quadriceps'
ON CONFLICT DO NOTHING;

-- HAMSTRINGS
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Biceps Femoris',   'Biceps Femoris — Long & Short Head', 1),
       ('Semitendinosus',   'Semitendinosus',                     2),
       ('Semimembranosus',  'Semimembranosus',                    3)
     ) AS v(name,sci,ord)
WHERE g.name = 'hamstrings'
ON CONFLICT DO NOTHING;

-- GLUTES
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Gluteus Maximus', 'Gluteus Maximus', 1),
       ('Gluteus Medius',  'Gluteus Medius',  2),
       ('Gluteus Minimus', 'Gluteus Minimus', 3)
     ) AS v(name,sci,ord)
WHERE g.name = 'glutes'
ON CONFLICT DO NOTHING;

-- CALVES
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Gastrocnemius','Gastrocnemius — Medial & Lateral Head', 1),
       ('Soleus',       'Soleus',                                2)
     ) AS v(name,sci,ord)
WHERE g.name = 'calves'
ON CONFLICT DO NOTHING;

-- TRAPS
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Upper Traps',  'Trapezius — Upper Fibres',  1),
       ('Middle Traps', 'Trapezius — Middle Fibres', 2),
       ('Lower Traps',  'Trapezius — Lower Fibres',  3)
     ) AS v(name,sci,ord)
WHERE g.name = 'traps'
ON CONFLICT DO NOTHING;

-- CORE
INSERT INTO exercise_muscle_regions (group_id, name, scientific_name, sort_order)
SELECT g.id, v.name, v.sci, v.ord
FROM exercise_muscle_groups g,
     (VALUES
       ('Rectus Abdominis',   'Rectus Abdominis',              1),
       ('Obliques',           'External & Internal Obliques',  2),
       ('Transverse Abdominis','Transversus Abdominis',        3)
     ) AS v(name,sci,ord)
WHERE g.name = 'core'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA — EXERCISES
-- Uses a single INSERT per group of related exercises for brevity
-- ═══════════════════════════════════════════════════════════════════

-- CHEST — Upper
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Upper Chest',
(VALUES
  ('Incline Barbell Bench Press',   'barbell',  'true',  'intermediate', 'false'),
  ('Incline Dumbbell Bench Press',  'dumbbell', 'true',  'beginner',     'false'),
  ('Incline Dumbbell Flye',         'dumbbell', 'false', 'intermediate', 'false'),
  ('High-to-Low Cable Crossover',   'cable',    'false', 'intermediate', 'false'),
  ('Incline Machine Press',         'machine',  'true',  'beginner',     'true')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'chest';

-- CHEST — Mid
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Mid Chest',
(VALUES
  ('Flat Barbell Bench Press',     'barbell',  'true',  'beginner',     'false'),
  ('Flat Dumbbell Bench Press',    'dumbbell', 'true',  'beginner',     'false'),
  ('Flat Dumbbell Flye',           'dumbbell', 'false', 'intermediate', 'false'),
  ('Pec Deck / Chest Flye',        'machine',  'false', 'beginner',     'true'),
  ('Machine Chest Press',          'machine',  'true',  'beginner',     'true'),
  ('Cable Crossover (Neutral)',     'cable',    'false', 'intermediate', 'false'),
  ('Cable Chest Fly',              'cable',    'false', 'beginner',     'false')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'chest';

-- CHEST — Lower
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Lower Chest',
(VALUES
  ('Decline Barbell Bench Press', 'barbell',    'true',  'intermediate', 'false'),
  ('Dips (Chest-Focused)',        'bodyweight', 'true',  'intermediate', 'false'),
  ('Low-to-High Cable Crossover', 'cable',      'false', 'intermediate', 'false')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'chest';

-- BACK — Upper Lats
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Upper Lats',
(VALUES
  ('Wide-Grip Lat Pulldown',      'cable',      'true',  'beginner',     'false'),
  ('Pull-Up',                     'bodyweight', 'true',  'intermediate', 'false'),
  ('Chin-Up',                     'bodyweight', 'true',  'intermediate', 'false'),
  ('Straight-Arm Pulldown',       'cable',      'false', 'intermediate', 'false'),
  ('Lat Pulldown Machine',        'machine',    'true',  'beginner',     'true'),
  ('Single-Arm Lat Pulldown',     'cable',      'true',  'intermediate', 'false')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'back';

-- BACK — Lower Lats
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Lower Lats',
(VALUES
  ('Close-Grip Lat Pulldown',         'cable',   'true',  'beginner',     'false'),
  ('Seated Cable Row (Close Grip)',    'cable',   'true',  'beginner',     'false'),
  ('Single-Arm Dumbbell Row',         'dumbbell','true',  'beginner',     'false'),
  ('Barbell Row (Overhand)',           'barbell', 'true',  'intermediate', 'false'),
  ('Barbell Row (Underhand)',          'barbell', 'true',  'intermediate', 'false'),
  ('T-Bar Row',                       'barbell', 'true',  'intermediate', 'false'),
  ('Machine Row',                     'machine', 'true',  'beginner',     'true')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'back';

-- BACK — Mid Back / Rhomboids
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Mid Back / Rhomboids',
(VALUES
  ('Seated Cable Row (Wide)',    'cable',   'true',  'beginner',     'false'),
  ('Face Pull',                 'cable',   'false', 'beginner',     'false'),
  ('Rear Delt Dumbbell Row',    'dumbbell','false', 'beginner',     'false'),
  ('Band Pull-Apart',           'band',    'false', 'beginner',     'false')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'back';

-- BACK — Lower Back
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Lower Back',
(VALUES
  ('Conventional Deadlift',      'barbell',    'true',  'advanced',     'false'),
  ('Romanian Deadlift (RDL)',    'barbell',    'true',  'intermediate', 'false'),
  ('Hyperextension',             'bodyweight', 'false', 'beginner',     'false'),
  ('Good Morning',               'barbell',    'false', 'intermediate', 'false')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'back';

-- SHOULDERS — Front Delt
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Front Delt',
(VALUES
  ('Barbell Overhead Press',    'barbell',  'true',  'intermediate', 'false'),
  ('Dumbbell Shoulder Press',   'dumbbell', 'true',  'beginner',     'false'),
  ('Machine Shoulder Press',    'machine',  'true',  'beginner',     'true'),
  ('Front Dumbbell Raise',      'dumbbell', 'false', 'beginner',     'false'),
  ('Arnold Press',              'dumbbell', 'true',  'intermediate', 'false'),
  ('Landmine Press',            'barbell',  'true',  'intermediate', 'false')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'shoulders';

-- SHOULDERS — Side Delt
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Side Delt',
(VALUES
  ('Dumbbell Lateral Raise',     'dumbbell', 'false', 'beginner',     'false'),
  ('Cable Lateral Raise',        'cable',    'false', 'beginner',     'false'),
  ('Machine Lateral Raise',      'machine',  'false', 'beginner',     'true'),
  ('Leaning Cable Lateral Raise','cable',    'false', 'intermediate', 'false')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'shoulders';

-- SHOULDERS — Rear Delt
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = 'Rear Delt',
(VALUES
  ('Reverse Pec Deck',           'machine',  'false', 'beginner',     'true'),
  ('Cable Rear Delt Flye',       'cable',    'false', 'intermediate', 'false'),
  ('Dumbbell Rear Delt Flye',    'dumbbell', 'false', 'beginner',     'false'),
  ('Face Pull (Rear Delt Focus)','cable',    'false', 'beginner',     'false')
) AS v(name, eq, cmp, diff, brand)
WHERE g.name = 'shoulders';

-- BICEPS
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
CROSS JOIN (VALUES
  ('Barbell Curl',                   'Long Head',       'barbell',  'false', 'beginner',     'false'),
  ('Dumbbell Curl',                  'Long Head',       'dumbbell', 'false', 'beginner',     'false'),
  ('Incline Dumbbell Curl',          'Long Head',       'dumbbell', 'false', 'intermediate', 'false'),
  ('Cable Curl (Bar)',               'Long Head',       'cable',    'false', 'beginner',     'false'),
  ('EZ Bar Curl',                    'Long Head',       'barbell',  'false', 'beginner',     'false'),
  ('Preacher Curl (Machine)',        'Short Head',      'machine',  'false', 'beginner',     'true'),
  ('Scott Curl / Preacher Curl',     'Short Head',      'barbell',  'false', 'intermediate', 'false'),
  ('Concentration Curl',             'Short Head',      'dumbbell', 'false', 'intermediate', 'false'),
  ('Hammer Curl',                    'Brachialis',      'dumbbell', 'false', 'beginner',     'false'),
  ('Cross-Body Hammer Curl',         'Brachialis',      'dumbbell', 'false', 'intermediate', 'false'),
  ('Cable Rope Hammer Curl',         'Brachioradialis', 'cable',    'false', 'intermediate', 'false')
) AS v(name, region, eq, cmp, diff, brand)
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = v.region
WHERE g.name = 'biceps';

-- TRICEPS
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
CROSS JOIN (VALUES
  ('Skull Crushers (EZ Bar)',            'Long Head',    'barbell',    'false', 'intermediate', 'false'),
  ('Overhead Cable Tricep Extension',    'Long Head',    'cable',      'false', 'intermediate', 'false'),
  ('Overhead Dumbbell Extension',        'Long Head',    'dumbbell',   'false', 'beginner',     'false'),
  ('Tricep Pushdown (Rope)',             'Lateral Head', 'cable',      'false', 'beginner',     'false'),
  ('Tricep Pushdown (Bar)',              'Lateral Head', 'cable',      'false', 'beginner',     'false'),
  ('Machine Tricep Extension',          'Medial Head',  'machine',    'false', 'beginner',     'true'),
  ('Close-Grip Bench Press',            'Medial Head',  'barbell',    'true',  'intermediate', 'false'),
  ('Dips (Tricep-Focused)',             'Medial Head',  'bodyweight', 'true',  'intermediate', 'false'),
  ('Diamond Push-Up',                   'Medial Head',  'bodyweight', 'false', 'beginner',     'false')
) AS v(name, region, eq, cmp, diff, brand)
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = v.region
WHERE g.name = 'triceps';

-- QUADRICEPS
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
CROSS JOIN (VALUES
  ('Barbell Back Squat',       'Rectus Femoris',    'barbell',      'true',  'intermediate', 'false'),
  ('Barbell Front Squat',      'Rectus Femoris',    'barbell',      'true',  'advanced',     'false'),
  ('Smith Machine Squat',      'Rectus Femoris',    'smith_machine','true',  'beginner',     'false'),
  ('Dumbbell Goblet Squat',    'Rectus Femoris',    'dumbbell',     'true',  'beginner',     'false'),
  ('Bulgarian Split Squat',    'Rectus Femoris',    'dumbbell',     'true',  'intermediate', 'false'),
  ('Dumbbell Lunges',          'Rectus Femoris',    'dumbbell',     'true',  'beginner',     'false'),
  ('Hack Squat Machine',       'Vastus Lateralis',  'machine',      'true',  'intermediate', 'true'),
  ('Leg Press',                'Vastus Lateralis',  'machine',      'true',  'beginner',     'true'),
  ('Leg Extension Machine',    'Vastus Medialis',   'machine',      'false', 'beginner',     'true'),
  ('Sissy Squat',              'Vastus Medialis',   'bodyweight',   'false', 'advanced',     'false'),
  ('Step-Up (Dumbbell)',       'Vastus Intermedius','dumbbell',     'true',  'beginner',     'false')
) AS v(name, region, eq, cmp, diff, brand)
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = v.region
WHERE g.name = 'quadriceps';

-- HAMSTRINGS
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
CROSS JOIN (VALUES
  ('Lying Leg Curl Machine',          'Biceps Femoris', 'machine',    'false', 'beginner',     'true'),
  ('Seated Leg Curl Machine',         'Biceps Femoris', 'machine',    'false', 'beginner',     'true'),
  ('Romanian Deadlift (RDL)',         'Semitendinosus', 'barbell',    'true',  'intermediate', 'false'),
  ('Dumbbell Romanian Deadlift',      'Semitendinosus', 'dumbbell',   'true',  'beginner',     'false'),
  ('Nordic Hamstring Curl',           'Biceps Femoris', 'bodyweight', 'false', 'advanced',     'false'),
  ('Cable Pull-Through',              'Semimembranosus','cable',      'false', 'beginner',     'false'),
  ('Glute Ham Raise (GHR)',           'Biceps Femoris', 'bodyweight', 'false', 'advanced',     'false')
) AS v(name, region, eq, cmp, diff, brand)
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = v.region
WHERE g.name = 'hamstrings';

-- GLUTES
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
CROSS JOIN (VALUES
  ('Hip Thrust (Barbell)',      'Gluteus Maximus', 'barbell',    'true',  'intermediate', 'false'),
  ('Hip Thrust Machine',       'Gluteus Maximus', 'machine',    'true',  'beginner',     'true'),
  ('Cable Kickback',           'Gluteus Maximus', 'cable',      'false', 'beginner',     'false'),
  ('Sumo Deadlift',            'Gluteus Maximus', 'barbell',    'true',  'advanced',     'false'),
  ('Abduction Machine',        'Gluteus Medius',  'machine',    'false', 'beginner',     'true'),
  ('Lateral Band Walk',        'Gluteus Medius',  'band',       'false', 'beginner',     'false'),
  ('Clamshell',                'Gluteus Minimus', 'band',       'false', 'beginner',     'false')
) AS v(name, region, eq, cmp, diff, brand)
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = v.region
WHERE g.name = 'glutes';

-- CALVES
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
CROSS JOIN (VALUES
  ('Standing Calf Raise (Machine)',  'Gastrocnemius', 'machine',    'false', 'beginner',     'true'),
  ('Standing Calf Raise (Barbell)',  'Gastrocnemius', 'barbell',    'false', 'intermediate', 'false'),
  ('Donkey Calf Raise',             'Gastrocnemius', 'machine',    'false', 'intermediate', 'true'),
  ('Leg Press Calf Raise',          'Gastrocnemius', 'machine',    'false', 'beginner',     'false'),
  ('Seated Calf Raise',             'Soleus',        'machine',    'false', 'beginner',     'true'),
  ('Tibialis Raise',                'Soleus',        'bodyweight', 'false', 'beginner',     'false')
) AS v(name, region, eq, cmp, diff, brand)
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = v.region
WHERE g.name = 'calves';

-- TRAPS
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
CROSS JOIN (VALUES
  ('Barbell Shrug',       'Upper Traps', 'barbell',  'false', 'beginner',     'false'),
  ('Dumbbell Shrug',      'Upper Traps', 'dumbbell', 'false', 'beginner',     'false'),
  ('Cable Shrug',         'Upper Traps', 'cable',    'false', 'beginner',     'false'),
  ('Trap Bar Shrug',      'Upper Traps', 'barbell',  'false', 'intermediate', 'false'),
  ('Rack Pull',           'Upper Traps', 'barbell',  'true',  'intermediate', 'false'),
  ('Prone Y-Raise',       'Lower Traps', 'dumbbell', 'false', 'beginner',     'false')
) AS v(name, region, eq, cmp, diff, brand)
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = v.region
WHERE g.name = 'traps';

-- CORE
INSERT INTO exercises (name, primary_group_id, primary_region_id, equipment, is_compound, difficulty, prompt_machine_brand)
SELECT v.name, g.id, r.id, v.eq, v.cmp::boolean, v.diff, v.brand::boolean
FROM exercise_muscle_groups g
CROSS JOIN (VALUES
  ('Cable Crunch',              'Rectus Abdominis',    'cable',      'false', 'beginner',     'false'),
  ('Hanging Leg Raise',         'Rectus Abdominis',    'bodyweight', 'false', 'intermediate', 'false'),
  ('Ab Crunch Machine',         'Rectus Abdominis',    'machine',    'false', 'beginner',     'true'),
  ('Decline Sit-Up',            'Rectus Abdominis',    'bodyweight', 'false', 'beginner',     'false'),
  ('Ab Wheel Rollout',          'Transverse Abdominis','bodyweight', 'false', 'intermediate', 'false'),
  ('Plank',                     'Transverse Abdominis','bodyweight', 'false', 'beginner',     'false'),
  ('Cable Oblique Crunch',      'Obliques',            'cable',      'false', 'intermediate', 'false'),
  ('Russian Twist',             'Obliques',            'bodyweight', 'false', 'beginner',     'false'),
  ('Side Plank',                'Obliques',            'bodyweight', 'false', 'beginner',     'false')
) AS v(name, region, eq, cmp, diff, brand)
JOIN exercise_muscle_regions r ON r.group_id = g.id AND r.name = v.region
WHERE g.name = 'core';
