# Onboarding Overhaul — Reference Document

> **Purpose:** This is the authoritative spec for the full rewrite of the onboarding flow and how profile data feeds the rest of the app.
> Use this as the reference for every implementation decision.

---

## 1. The Core Problem

**Onboarding data is collected but never used.**

Right now, a user fills in their dietary preferences, activity baselines, training schedule, allergies, and goal — and then the app largely ignores all of it. The Nutrition page shows no awareness of their diet. The Cardio & Steps page has no pre-set targets. The Training page has no pre-built schedule. The coach / meal plan doesn't filter by their allergies.

This overhaul fixes that by:
1. Rewiring every onboarding field to actually drive the UI it belongs to
2. Building a global ProfileContext so the whole app reads from one source of truth
3. Rewriting the onboarding itself as an engaging, one-question-at-a-time experience

---

## 2. New Architecture — Global ProfileContext

### 2.1 The Problem with Current Architecture

Every page (Dashboard, Nutrition, Training, etc.) independently fetches `profiles.*` from Supabase on mount. There is no shared state. When a user updates their settings, other pages don't know until they remount. The `RequireOnboardingComplete` guard also fires a separate DB query on every route change.

### 2.2 Solution: ProfileContext

Create a single `ProfileContext` that wraps the entire app:

```
frontend/src/context/ProfileContext.jsx
frontend/src/hooks/useProfile.js
```

**What it does:**
- Fetches the profile **once** after login
- Exposes `{ profile, updateProfile, refreshProfile, loading, error }`
- `updateProfile(patch)` does an optimistic local update immediately, then persists to Supabase in background
- `RequireOnboardingComplete` reads from this context — no extra DB call
- When Settings saves a change, it calls `updateProfile()` and all pages reflect the change instantly

**Context shape:**
```js
const ProfileContext = {
  profile: Profile | null,
  loading: boolean,
  error: string | null,
  updateProfile: (patch: Partial<Profile>) => Promise<void>,
  refreshProfile: () => Promise<void>
}
```

**File structure:**
```
frontend/src/
  context/
    ProfileContext.jsx        ← provider + context definition
  hooks/
    useProfile.js             ← useContext(ProfileContext) wrapper
  lib/
    units.js                  ← all unit conversions (shared everywhere)
    tdee.js                   ← TDEE calculation, macro splits
    dayType.js                ← getDayType() — single canonical function
```

### 2.3 Route Guard Changes

`App.jsx` currently runs two DB calls per route change. After:

```
RequireAuth           → reads from ProfileContext.profile (already loaded)
RequireOnboarding     → reads from ProfileContext.profile.onboarding_complete
```

No additional DB queries on navigation.

---

## 3. Onboarding UX — Conversational Single-Question Style

### 3.1 Design Principle

Each screen shows **one question at a time**, centered on the screen. The experience should feel light, quick, and intentional — not like a form.

- Full-screen layout, clean and spacious
- Animated slide transition between questions
- Previous answers are NOT visible (forward-only progress during the flow)
- A progress bar at the top (e.g. "3 of 9")
- A "back" button always available
- Auto-advance on tap for option-based questions (no separate "Next" needed)
- Text input questions have a visible "Continue" button

### 3.2 Question Sequence (15 Steps) — Final

Personal info comes **first** so sex and DOB are available before the calorie calculation step. Each step is its own screen — no merging. Users can navigate back to edit any previous answer.

| Step | Question | Input Type | Field(s) |
|------|----------|-----------|---------|
| 1 | "What's your name?" | Two text inputs (first + last) | `first_name`, `last_name` |
| 2 | "When were you born?" | Date picker | `date_of_birth` |
| 3 | "Which best describes you?" | Two large button options | `sex` (male / female) |
| 4 | "Which units do you prefer?" | Two large button options | `unit_system` (metric / imperial) |
| 5 | "Tell us about your body" | Height + current weight + goal weight + body fat % | `height_cm`, `starting_weight_kg`, `goal_weight_kg`, `body_fat_pct` |
| 6 | "What's your main goal?" | Three button options | `goal_type` (lose / maintain / gain) — auto-inferred from step 5, user can override |
| 7 | "How fast do you want to progress?" | Slider or segmented buttons | `weekly_weight_change_target_kg` — **skip this step entirely if goal is maintain** |
| 8 | "How would you like your calories set?" | Two options with live macros preview | `calorie_mode`, `custom_calories` |
| 9 | "How active are you day-to-day?" | Five descriptive button options | `activity_level` |
| 10 | "How do you structure your training?" | Toggle (fixed/rolling) + day picker or frequency | `split_mode`, `training_days`, `training_days_per_week`, `training_frequency_range`, `rolling_start_date` |
| 11 | "Tell us about your gym setup" | Button selects | `experience_level`, `gym_type`, `gym_chain` |
| 12 | "Set your starting baselines" | Optional number inputs | `baseline_steps_per_day`, `baseline_cardio_minutes_per_week`, `baseline_cardio_avg_hr`, `default_liss_opt_in` |
| 13 | "Any dietary requirements?" | Multi-button + optional text areas | `dietary_preference`, `dietary_additional`, `dislikes` |
| 14 | "Any food allergies?" | Text input (free text) | `food_allergies` |
| 15 | "Almost done — one important note" | Checkbox | health disclaimer |

> **High day scheduling is not in onboarding.** Users configure this in Settings after they've used the app.
> Step 7 is conditionally skipped: if `goal_type === 'maintain'`, progress bar jumps from step 6 to step 8.

### 3.3 Calorie Preview on Step 8

When the user reaches the calorie step, show a live full-macro preview calculated from what they've already entered (steps 1–7). This is shown **before** the user picks AI vs Custom, so they understand what they're choosing.

```
Your estimated targets:

  2,040 kcal / day
  ──────────────────────────────
  Protein   172g   ████████████░░
  Carbs     198g   ████████████████░░
  Fats       58g   ████░░
```

- Calculated using Mifflin-St Jeor + activity level (from step 9 — if not yet reached, use `moderate` as default)
- If goal is lose/gain, show the adjusted target (not just maintenance)
- Updates live if user goes back and changes any upstream value
- "AI" option = use these calculated values. "Custom" option = enter your own calories, macros recalculate around protein/fat floors

### 3.4 Resumability

- `onboarding_step` is saved after every step advance
- On re-entry, the user is told "Welcome back — you left off at step 7"
- Fields pre-populate from saved profile data

---

## 4. Data Connections — Onboarding → App Sections

This is the core of the overhaul. Every field collected in onboarding must be consumed somewhere.

### 4.1 → Nutrition Page

| Onboarding Field | How it feeds Nutrition |
|-----------------|----------------------|
| `dietary_preference` | AI meal plan generator uses this as the primary diet filter. Default meal suggestions, AI-generated meal plans, and food search results respect this. User can override in Nutrition Settings. |
| `dietary_additional` | Passed as context to AI meal plan prompts ("also prefers low sodium, etc.") |
| `dislikes` | AI meal plan excludes these foods. Food search can optionally hide them. |
| `food_allergies` | **Hard filter** — allergen warning is shown on food items matching the allergy. Meal plan generation treats these as absolute exclusions. |
| `calorie_mode` + targets | Nutrition page displays the correct target (AI-calculated or custom) based on today's day type |
| `unit_system` | All nutrition quantities displayed in user's preferred units |

**Nutrition Settings page** becomes the place where users refine these after onboarding. It should show the current onboarding values as defaults, and saving them updates the profile via `updateProfile()`.

### 4.2 → Cardio & Steps Page

| Onboarding Field | How it feeds Cardio & Steps |
|-----------------|---------------------------|
| `baseline_steps_per_day` | Pre-populates the **daily step goal** target. Shown as a ring/bar to fill. |
| `baseline_cardio_minutes_per_week` | Pre-populates the **weekly cardio minutes** target |
| `baseline_cardio_avg_hr` | Used in calorie burn estimates for cardio sessions |
| `default_liss_opt_in` | If true, a default LISS session (15 min) is pre-added on training days |

**"Starting point" reference:** Display the user's onboarding baselines as a benchmark line on charts — e.g. a dotted line at 8,000 steps/day showing their stated baseline, so progress above baseline is visible.

### 4.3 → Training Page

| Onboarding Field | How it feeds Training |
|-----------------|----------------------|
| `split_mode` + `training_days` | **Auto-generates the weekly schedule** on first load. Training page shows the week with training/rest days pre-populated from onboarding. |
| `training_days_per_week` + `rolling_start_date` | Used for rolling split schedule generation |
| `experience_level` | Used to inform workout template suggestions (beginner vs advanced programs) |
| `gym_type` | Pre-selects gym type in workout logging. Home gym users get home-appropriate exercise suggestions. |

**Schedule generation:** On first entry to Training page after onboarding, the schedule should be pre-built — not empty. The user sees their week laid out and can adjust from there.

### 4.4 → Dashboard

| Onboarding Field | How it feeds Dashboard |
|-----------------|----------------------|
| `split_mode` + training schedule | Determines today's day type (training / rest / high) shown on dashboard |
| `goal_type` + `goal_weight_kg` | Drives the goal progress widget |
| `unit_system` | All weight/measurement displays |

**Today's day type is calculated once via `getDayType(profile, today)` in ProfileContext and passed down.** No page recalculates it independently.

### 4.5 → Coach / AI Features

| Onboarding Field | How it feeds Coach |
|-----------------|------------------|
| `dietary_preference`, `food_allergies`, `dislikes`, `dietary_additional` | Injected into every AI prompt as user context |
| `experience_level`, `goal_type`, `activity_level` | Inform coaching tone and recommendations |
| `gym_type` | Informs exercise suggestions |

---

## 5. TDEE Calculation — Fix the Math

### 5.1 Current Problem

The backend currently uses `weightKg * 33` as maintenance calories. This ignores sex, age, height, and activity level — all of which are collected in onboarding but never used.

### 5.2 New Formula — Mifflin-St Jeor + Activity Multiplier

**Step 1: BMR**
```
Male:   BMR = (10 × weightKg) + (6.25 × heightCm) − (5 × age) + 5
Female: BMR = (10 × weightKg) + (6.25 × heightCm) − (5 × age) − 161
```

Age is derived from `date_of_birth`.

**Step 2: Activity Multiplier**

| `activity_level` | Multiplier |
|-----------------|-----------|
| `inactive`      | 1.2       |
| `light`         | 1.375     |
| `moderate`      | 1.55      |
| `heavy`         | 1.725     |
| `extreme`       | 1.9       |

`TDEE = BMR × multiplier`

**Step 3: Goal Adjustment**
```
lose:     target = TDEE − (weeklyRateKg × 7700 / 7)
gain:     target = TDEE + (weeklyRateKg × 7700 / 7)
maintain: target = TDEE
```

Hard floor: 1,200 kcal. Hard ceiling: 6,000 kcal.

### 5.3 Macro Split (Updated)

Body fat % is used here to improve protein targeting:

```
If body_fat_pct is known:
  lean_mass_kg = weightKg × (1 − body_fat_pct / 100)
  protein_g = lean_mass_kg × 2.4   (2.4g per kg lean mass)
Else:
  protein_g = weightKg × 2.0       (2g per kg bodyweight fallback)

fat_g  = max(weightKg × 0.8, calories × 0.20 / 9)  (at least 0.8g/kg)
carbs_g = (calories − protein_g×4 − fat_g×9) / 4
```

### 5.4 Day-Type Splits

Add two new configurable profile fields: `rest_day_deficit` and `high_day_surplus`.

| Day Type | Default | User-Configurable? |
|----------|---------|-------------------|
| Training | Base target (0 delta) | — |
| Rest     | Base − `rest_day_deficit` (default 250 kcal) | Yes, in Settings |
| High     | Base + `high_day_surplus` (default 200 kcal) | Yes, in Settings |

Macro splits recalculate for each day type.

### 5.5 When Recalculation is Triggered

The backend `/api/nutrition/init` endpoint is re-called whenever any of these profile fields change:

- `current_weight_kg`
- `goal_type`
- `weekly_weight_change_target_kg`
- `calorie_mode` / `custom_calories`
- `activity_level`
- `sex`
- `date_of_birth`
- `height_cm`
- `body_fat_pct`
- `rest_day_deficit`
- `high_day_surplus`

This is triggered silently on save — the user does not need to take a separate action.

---

## 6. High Days — Add Scheduling

### 6.1 The Problem

The `nutrition_day_targets` table already has a `high` day type, but there is no scheduling logic. High days are effectively unreachable unless manually assigned somewhere.

### 6.2 Proposed Scheduling

Add a high day schedule as part of the training setup (or Settings). Options to present to the user:

- **Every N days** — e.g. every 5th day from a start date (refeed schedule)
- **Specific weekdays** — e.g. every Saturday
- **Manual only** — user taps to mark today as a high day from the dashboard

Add a profile field: `high_day_schedule: 'none' | 'interval' | 'fixed_days' | 'manual'`
And supporting fields: `high_day_interval` (integer), `high_day_weekdays` (string[]), `high_day_start_date` (date)

`getDayType()` in `lib/dayType.js` incorporates high day schedule into its return value.

---

## 7. Day Type Resolution — Single Canonical Function

**Rule:** `getDayType(profile, date)` is the **only place** day type is calculated in the entire app. It lives in `frontend/src/lib/dayType.js` and is used by:
- ProfileContext (calculates `todayDayType` once per session)
- Dashboard
- Nutrition page
- Training page
- Anywhere else that needs to know today's or a specific date's day type

**Logic:**
```
1. Check high day schedule first (if configured and today matches → 'high')
2. Check split_mode:
   - 'fixed':   is today in training_days[] → 'training' else 'rest'
   - 'rolling': calculate position in rolling cycle → 'training' or 'rest'
3. Default: 'rest'
```

Remove `today_day_type` and `today_day_type_date` from the profiles table — this should never be stored, only calculated.

---

## 8. Profile Schema — Canonical Definition

```js
/**
 * @typedef {Object} Profile
 *
 * // Identity
 * @property {string}  user_id
 * @property {string}  email
 * @property {string}  first_name
 * @property {string}  last_name
 * @property {string}  date_of_birth          // YYYY-MM-DD
 * @property {'male'|'female'} sex
 *
 * // Account
 * @property {string}  subscription_status    // 'active'|'inactive'|'trial'
 * @property {boolean} is_suspended
 * @property {boolean} onboarding_complete
 * @property {number}  onboarding_step        // 1–15
 *
 * // Units
 * @property {'metric'|'imperial'} unit_system
 *
 * // Body
 * @property {number}       height_cm
 * @property {number}       starting_weight_kg
 * @property {number}       current_weight_kg
 * @property {number}       goal_weight_kg
 * @property {number|null}  body_fat_pct       // 3–60
 *
 * // Goal
 * @property {'maintain'|'lose'|'gain'} goal_type
 * @property {number|null}  weekly_weight_change_target_kg
 *
 * // Calories
 * @property {'ai'|'custom'} calorie_mode
 * @property {number|null}   custom_calories
 * @property {number}        rest_day_deficit   // default 250 kcal
 * @property {number}        high_day_surplus   // default 200 kcal
 *
 * // Training
 * @property {'fixed'|'rolling'} split_mode
 * @property {string[]|null}     training_days           // ['Mon','Wed','Fri']
 * @property {number|null}       training_days_per_week
 * @property {'1-2'|'2-4'|'5-6'|'7'|null} training_frequency_range
 * @property {string|null}       rolling_start_date      // YYYY-MM-DD
 * @property {'beginner'|'intermediate'|'advanced'} experience_level
 * @property {'home'|'commercial'|'independent'|'other'} gym_type
 * @property {string|null}       gym_chain
 *
 * // High day scheduling
 * @property {'none'|'interval'|'fixed_days'|'manual'} high_day_schedule
 * @property {number|null}   high_day_interval           // days between high days
 * @property {string[]|null} high_day_weekdays           // ['Sat']
 * @property {string|null}   high_day_start_date         // YYYY-MM-DD
 *
 * // Activity
 * @property {'inactive'|'light'|'moderate'|'heavy'|'extreme'} activity_level
 * @property {number|null}  baseline_steps_per_day
 * @property {number|null}  baseline_cardio_minutes_per_week
 * @property {number|null}  baseline_cardio_avg_hr
 * @property {boolean}      default_liss_opt_in
 *
 * // Nutrition preferences
 * @property {'omnivore'|'vegetarian'|'vegan'|'pescatarian'|'halal'|'gluten_free'|'lactose_free'} dietary_preference
 * @property {string}  dietary_additional
 * @property {string}  food_allergies
 * @property {string}  dislikes
 *
 * // UI state (NOT day type — that is always calculated)
 * @property {string}  check_in_day
 * @property {'macros'|'meal_plan'} nutrition_view_mode
 * @property {boolean} show_meal_macros
 * @property {boolean} show_day_macros
 */
```

**Remove from profiles table:**
- `today_day_type` — always calculate via `getDayType()`, never store
- `today_day_type_date` — same reason
- `lifestyle_activity` — duplicate of `activity_level`

---

## 9. Settings Page — Post-Onboarding Editing

Users edit all their onboarding data through Settings. No re-onboarding wizard.

### 9.1 Settings Sections (Mirror Onboarding Topics)

| Section | Fields | Triggers Nutrition Recalc? |
|---------|--------|--------------------------|
| Profile | name, DOB, sex | Yes (sex/age affect BMR) |
| Body | height, current weight, body fat % | Yes |
| Goal | goal type, weekly rate | Yes |
| Calories | calorie mode, custom calories, rest deficit, high surplus | Yes |
| Training | split mode, training days, frequency, rolling start, high day schedule | No |
| Gym & Experience | gym type, chain, experience level | No |
| Activity | activity level, baselines, LISS opt-in | Yes (activity affects TDEE) |
| Nutrition Preferences | dietary preference, additional notes, dislikes | No |
| Allergies | food allergies | No |
| Units | unit system | No (display only) |
| App Preferences | check-in day, view modes, motion/contrast | No |

### 9.2 Settings Flow

1. User edits a field
2. `updateProfile(patch)` called optimistically (UI updates instantly)
3. Supabase update fires in background
4. If section is in "triggers recalc" column → automatically call `/api/nutrition/init`
5. Success: silent. Error: toast notification

---

## 10. Validation Rules (Canonical)

Lives in `frontend/src/pages/onboarding/validation.js` as pure functions, reused in Settings.

```js
export const CAPS = {
  height_cm:                 { min: 120, max: 230 },
  weight_kg:                 { min: 30,  max: 300 },
  weekly_loss_kg:            { min: 0.1, max: 1.0 },
  weekly_gain_kg:            { min: 0.05,max: 0.3 },
  body_fat_pct:              { min: 3,   max: 60  },
  custom_calories:           { min: 1200,max: 6000 },
  steps_per_day:             { min: 0,   max: 20000 },
  cardio_minutes_per_week:   { min: 0,   max: 600  },
  cardio_avg_hr:             { min: 0,   max: 220  },
  rest_day_deficit:          { min: 0,   max: 800  },
  high_day_surplus:          { min: 0,   max: 800  },
};

// Each returns { valid: boolean, field: string | null, message: string | null }
export function validatePersonalInfo(fields) { ... }
export function validateBodyMetrics(fields) { ... }
export function validateGoal(fields) { ... }
export function validateCalories(fields) { ... }
export function validateTrainingSetup(fields) { ... }
export function validateGymExperience(fields) { ... }
export function validateActivityBaseline(fields) { ... }
export function validateNutritionPreferences(fields) { ... }  // always valid
export function validateSafety(fields) { ... }
```

Errors are **field-level**, not step-level. Each field highlights individually.

---

## 11. Unit Conversion Utilities (Canonical)

Lives in `frontend/src/lib/units.js`. No component does raw conversion math.

```js
// Parse: display input → internal storage (always metric)
export const parseHeightToCm     = (input, unitSystem) => number | null
export const parseWeightToKg     = (input, unitSystem) => number | null
export const parseWeeklyRateToKg = (input, unitSystem) => number | null

// Format: storage → display string
export const displayWeight       = (kg, unitSystem, decimals = 1) => string
export const displayHeight       = (cm, unitSystem) => string
export const displayWeeklyRate   = (kg, unitSystem) => string

// Constants
export const KG_TO_LB = 2.20462
export const LB_TO_KG = 0.453592
export const CM_TO_IN = 0.393701
export const IN_TO_CM = 2.54
```

---

## 12. File Structure — After Overhaul

```
frontend/src/
  context/
    ProfileContext.jsx          ← NEW: global profile state
  hooks/
    useProfile.js               ← NEW: thin wrapper
  lib/
    units.js                    ← NEW: all unit conversions
    tdee.js                     ← NEW: TDEE + macro calculations
    dayType.js                  ← NEW: getDayType() canonical function
  pages/
    onboarding/
      index.jsx                 ← NEW: wizard shell (step state, progress bar, nav)
      useOnboardingForm.js      ← NEW: all form state as single object/reducer
      validation.js             ← NEW: all validateStep() as pure functions
      steps/
        Step01_Name.jsx             ← first_name, last_name
        Step02_DateOfBirth.jsx      ← date_of_birth
        Step03_Sex.jsx              ← sex
        Step04_Units.jsx            ← unit_system
        Step05_BodyMetrics.jsx      ← height_cm, starting/goal weight, body_fat_pct
        Step06_Goal.jsx             ← goal_type (auto-inferred + override)
        Step07_WeeklyRate.jsx       ← weekly_weight_change_target_kg (skip if maintain)
        Step08_Calories.jsx         ← calorie_mode + live macros preview
        Step09_ActivityLevel.jsx    ← activity_level
        Step10_TrainingSchedule.jsx ← split_mode, days, frequency, rolling start
        Step11_GymExperience.jsx    ← experience_level, gym_type, gym_chain
        Step12_Baselines.jsx        ← steps, cardio mins, avg HR, LISS opt-in
        Step13_NutritionPrefs.jsx   ← dietary_preference, additional, dislikes
        Step14_Allergies.jsx        ← food_allergies
        Step15_Safety.jsx           ← health disclaimer checkbox
    Dashboard.jsx               ← updated: uses useProfile(), uses getDayType()
    Nutrition.jsx               ← updated: uses dietary prefs from profile
    Training.jsx                ← updated: auto-generates schedule from profile
    CardioSteps.jsx             ← updated: uses baseline targets from profile
    Settings.jsx                ← updated: calls updateProfile(), triggers recalc
  App.jsx                       ← updated: wrapped in ProfileProvider, guards read context
```

---

## 13. Implementation Sequence

### Phase 1 — Foundation (no visible change to users)
1. Create `lib/units.js` with all conversion functions
2. Create `lib/tdee.js` — Mifflin-St Jeor + activity multiplier + macro split
3. Create `lib/dayType.js` — `getDayType()` with high day schedule support
4. Create `ProfileContext.jsx` + `useProfile.js`
5. Wrap `App.jsx` in `<ProfileProvider>`, update route guards to use context

### Phase 2 — Fix the Calorie Math (backend)
6. Update `backend/server.js` `/api/nutrition/init`:
   - Read `sex`, `date_of_birth`, `height_cm`, `activity_level`, `body_fat_pct`
   - Use Mifflin-St Jeor BMR + activity multiplier
   - Use lean mass protein if body fat % available
   - Apply `rest_day_deficit` and `high_day_surplus` from profile (with defaults)
7. Add `rest_day_deficit`, `high_day_surplus` columns to `profiles` table
8. Add high day scheduling columns to `profiles` table

### Phase 3 — Wire Onboarding Data Into App Pages
9. **Nutrition:** Feed `dietary_preference`, `dislikes`, `food_allergies` into AI meal plan; add allergen warnings
10. **Cardio & Steps:** Pre-populate step goal + weekly cardio targets from baselines; show baseline reference line
11. **Training:** Auto-generate weekly schedule from `split_mode` + `training_days` on first load
12. **Dashboard:** Use `getDayType()` from context, not local calculation
13. **Coach:** Inject full dietary profile into AI system prompts

### Phase 4 — Onboarding Rewrite
14. Build `useOnboardingForm.js` — flat form state object replacing 25 individual useState calls
15. Build `validation.js` as pure functions
16. Build step components (start with simplest: Step01_Name through Step04_Units)
17. Build wizard shell (`index.jsx`) with progress bar + animated transitions
18. Wire up all remaining step components
19. Update `handleSubmit` to use new ProfileContext + trigger recalc

### Phase 5 — Settings Page
20. Add sections mirroring onboarding topics
21. Each section uses the same validation functions as onboarding
22. Changes call `updateProfile()` and trigger nutrition recalc where needed

### Phase 6 — Polish
23. Calorie preview on the calories step during onboarding
24. High day scheduling UI in Settings
25. "Starting point" baseline reference lines in Cardio & Steps charts

---

## 14. Decisions — Locked In

| # | Question | Decision |
|---|----------|---------|
| Q1 | Merge name/DOB/sex into one intro screen or keep separate? | **Keep separate.** Each question is its own screen. Users can navigate back to edit. The UI should be polished and interactive — use the existing dark/crimson design system (Chakra Petch + Space Grotesk, deep backgrounds, crimson accents). No fighter pilot language, but keep the sharp, precise, performance aesthetic. |
| Q2 | High day scheduling in onboarding or Settings only? | **Settings only.** Skip from onboarding to keep the flow lean. Users configure high days in Settings once they understand the app. |
| Q3 | Allergen food handling — hard exclude or warn? | **Warning badge.** Allergen-matching foods appear in search results and meal plans but are flagged with a visible allergen warning. User has full control. |
| Q4 | Calorie step preview — calories only or full macros? | **Full macros.** Show the estimated calories + protein / carbs / fat breakdown live as the user fills in their profile. |
| Q5 | High days on rolling splits? | **Both fixed and rolling.** Full high day schedule support across both split types from the start. |

## 15. Design System Reference

The onboarding UI must use the existing design system — do not introduce new colours or fonts.

**Colours:**
```
--bg-0: #090506          dark base
--bg-1: #11090c          page background
--bg-2: #1a0d12          elevated surface
--surface-1 → 3          cards / panels
--accent-1: #8a0f2e
--accent-2: #b5153c      primary interactive
--accent-3: #de2952      hover / active
--text-1: #f7edf0        primary text
--text-2: #cfbbc3        secondary text
--text-3: #9a7f89        muted / helper text
--ok: #28b78d            success / confirm
--warn: #e5a100          caution
--bad: #ff4f73           error
```

**Typography:**
- Headers / step titles: `font-family: var(--font-display)` — Chakra Petch
- Body / labels / inputs: `font-family: var(--font-body)` — Space Grotesk

**Motion:**
- Fast transitions: `var(--motion-fast)` (160ms)
- Question slide animations: `var(--motion-med)` (260ms)
- Respect `data-motion="low"` — set all motion vars to 0ms when active

**Tone (copy/UX writing):**
- Precise, direct, performance-focused
- No filler words ("Great!", "Awesome!", "Let's go!")
- No fighter pilot / aviation metaphors or terminology
- Short, clear questions. Short, clear button labels.
