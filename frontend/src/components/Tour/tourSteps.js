// ─── Section definitions ───────────────────────────────────────────────────────
// Each section groups one or more steps and carries its own colour identity.

export const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', color: '#cc2020' },
  { key: 'weight',    label: 'Weight',    color: '#22c55e' },
  { key: 'nutrition', label: 'Nutrition', color: '#4d8eff' },
  { key: 'training',  label: 'Training',  color: '#cc2020' },
  { key: 'movement',  label: 'Movement',  color: '#f59e0b' },
  { key: 'habits',    label: 'Habits',    color: '#a78bfa' },
  { key: 'checkins',  label: 'Check-ins', color: '#14b8a6' },
  { key: 'coach',     label: 'Coach',     color: '#fbbf24' },
];

// ─── Tour step definitions ─────────────────────────────────────────────────────
// isCinematic: 'welcome' | 'finish'  →  full-screen takeover, no card
// section: key from SECTIONS         →  drives colour + progress
// selector: CSS selector to spotlight (null = centred modal)
// tooltipPosition: 'right' | 'left' | 'bottom' | 'top' | 'center'

export const TOUR_STEPS = [

  // ── 0 · Welcome ─────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    isCinematic: 'welcome',
    route: '/app/dashboard',
  },

  // ── 1–5 · Dashboard ─────────────────────────────────────────────────────────
  {
    id: 'db-overview',
    section: 'dashboard',
    route: '/app/dashboard',
    selector: '.db-grid',
    tooltipPosition: 'center',
    title: 'Your command centre',
    body: 'Everything in one view. Each panel is a live snapshot of a different part of your program — tap any of them to go straight in.',
  },
  {
    id: 'db-weight',
    section: 'dashboard',
    route: '/app/dashboard',
    selector: '#tour-weight-panel',
    tooltipPosition: 'right',
    title: 'Weight trend',
    body: 'Your latest weight and a smoothed 7-day trend. Log daily — the trend line cuts through fluctuations so you can see what\'s actually happening, not just noise.',
  },
  {
    id: 'db-nutrition',
    section: 'dashboard',
    route: '/app/dashboard',
    selector: '#tour-nutrition-panel',
    tooltipPosition: 'right',
    title: 'Macro snapshot',
    body: 'Today\'s calories and macros logged vs. target. Updates in real time as you log food — so you always know exactly where you stand.',
  },
  {
    id: 'db-training',
    section: 'dashboard',
    route: '/app/dashboard',
    selector: '#tour-training-panel',
    tooltipPosition: 'left',
    title: 'Today\'s training',
    body: 'Your program tells you what to train today. Training days and rest days automatically adjust your nutrition targets — the whole system is connected.',
  },
  {
    id: 'db-movement',
    section: 'dashboard',
    route: '/app/dashboard',
    selector: '#tour-movement-panel',
    tooltipPosition: 'left',
    title: 'Daily movement',
    body: 'Steps and cardio tracked against your daily target. Small habits compounded — this panel keeps it honest.',
  },

  // ── 6 · Weight page ──────────────────────────────────────────────────────────
  {
    id: 'weight',
    section: 'weight',
    route: '/app/weight',
    selector: null,
    tooltipPosition: 'center',
    title: 'Weight Tracking',
    body: 'Log your weight daily and watch the trend chart smooth out water weight and fluctuations. Set a goal weight and track real progress over time — not just what the scale says on a given morning.',
  },

  // ── 7–8 · Nutrition ──────────────────────────────────────────────────────────
  {
    id: 'nutrition-hud',
    section: 'nutrition',
    route: '/app/nutrition',
    selector: '.nt-calorie-hud',
    tooltipPosition: 'right',
    title: 'Macro command centre',
    body: 'Calories, protein, carbs, and fat — all tracked against your targets in real time. Targets shift automatically between training days, rest days, and high days because your body isn\'t the same every day.',
  },
  {
    id: 'nutrition-log',
    section: 'nutrition',
    route: '/app/nutrition',
    selector: null,
    tooltipPosition: 'center',
    title: 'Log food in plain English',
    body: 'Type what you ate — "200g chicken breast and rice" — and the AI figures out the macros. No barcodes, no hunting through databases. Head to the Meal Plans tab to generate a full day\'s eating based on your exact targets.',
  },

  // ── 9 · Training ──────────────────────────────────────────────────────────────
  {
    id: 'training',
    section: 'training',
    route: '/app/training',
    selector: null,
    tooltipPosition: 'center',
    title: 'Training Hub',
    body: 'Build your program, log every session, and track each set and rep over time. Your training block is what drives rest day vs. training day nutrition — get this set up right and everything else follows.',
  },

  // ── 10 · Movement ─────────────────────────────────────────────────────────────
  {
    id: 'movement',
    section: 'movement',
    route: '/app/cardio-steps',
    selector: '.ac-grid',
    tooltipPosition: 'center',
    title: 'Movement & Cardio',
    body: 'Track your daily step count and log cardio sessions. Hit your step target consistently and it quietly adds up to hundreds of extra calories burned per week — without touching your program.',
  },

  // ── 11 · Habits ───────────────────────────────────────────────────────────────
  {
    id: 'habits',
    section: 'habits',
    route: '/app/habits',
    selector: null,
    tooltipPosition: 'center',
    title: 'Habit Tracker',
    body: 'Create habits and track them daily — sleep, water, stress, whatever matters for your goals. The analytics tab shows streaks, completion rates, and how your habits correlate with your progress metrics over time.',
  },

  // ── 12 · Check-ins ────────────────────────────────────────────────────────────
  {
    id: 'checkins',
    section: 'checkins',
    route: '/app/check-ins',
    selector: null,
    tooltipPosition: 'center',
    title: 'Weekly Check-ins',
    body: 'Every week, submit your weight, measurements, progress photos, and how you\'ve been feeling. Your Pilot reviews it all, spots what\'s working, and adjusts your targets. This feedback loop is what separates real coaching from just logging data.',
  },

  // ── 13 · Coach ────────────────────────────────────────────────────────────────
  {
    id: 'coach',
    section: 'coach',
    route: '/app/coach',
    selector: '.pilot-input-row',
    tooltipPosition: 'top',
    title: 'Your AI Coach',
    body: 'Ask anything. Why has your weight stalled? Should you increase calories? How does your training load look this month? Your Pilot has access to your full data history and gives you answers grounded in your actual numbers — not generic advice.',
  },

  // ── 14 · Finish ───────────────────────────────────────────────────────────────
  {
    id: 'finish',
    isCinematic: 'finish',
    route: '/app/dashboard',
  },
];
