// ─── Product tour step definitions ────────────────────────────────────────────
// selector: CSS selector for the element to spotlight (null = centred modal, no spotlight)
// tooltipPosition: 'right' | 'bottom' | 'top' | 'left' | 'center'

export const TOUR_STEPS = [
  {
    id: 'welcome',
    route: '/app/dashboard',
    selector: null,
    title: 'Welcome to Physique Pilot.',
    body: "You're all set up. Let's take 60 seconds to show you around — you can skip at any time.",
    tooltipPosition: 'center',
  },
  {
    id: 'sidebar',
    route: '/app/dashboard',
    selector: '.app-sidebar',
    title: 'Your Control Panel',
    body: 'Every tool lives here. Dashboard, weight, nutrition, training, activity, check-ins, and your AI coach — one click away.',
    tooltipPosition: 'right',
  },
  {
    id: 'dashboard-panels',
    route: '/app/dashboard',
    selector: '.db-grid',
    title: 'Live Dashboard',
    body: "Your daily stats at a glance — weight trend, movement, and training status. Tap any panel to dive straight in.",
    tooltipPosition: 'bottom',
  },
  {
    id: 'dashboard-nutrition',
    route: '/app/dashboard',
    selector: '.db-nutrition',
    title: 'Nutrition Overview',
    body: 'Calorie and macro targets for today, updated in real time as you log meals. Targets shift automatically on training vs. rest days.',
    tooltipPosition: 'top',
  },
  {
    id: 'weight',
    route: '/app/weight',
    selector: '.app-content-inner',
    title: 'Weight Tracking',
    body: 'Log your weight daily. The trend chart smooths out fluctuations so you can see real progress — not just noise.',
    tooltipPosition: 'center',
  },
  {
    id: 'nutrition',
    route: '/app/nutrition',
    selector: '.app-content-inner',
    title: 'Nutrition Engine',
    body: 'Log meals, generate AI meal plans, and track every macro. Everything your diet needs in one place.',
    tooltipPosition: 'center',
  },
  {
    id: 'training',
    route: '/app/training',
    selector: '.app-content-inner',
    title: 'Training Hub',
    body: 'Build your program, log sessions, and track every set and rep. Your training block drives your nutrition targets automatically.',
    tooltipPosition: 'center',
  },
  {
    id: 'coach',
    route: '/app/coach',
    selector: '.app-content-inner',
    title: 'Your AI Coach',
    body: "Ask anything — macros, training advice, recovery, plateau-busting. Your coach knows your full stats and history.",
    tooltipPosition: 'center',
  },
  {
    id: 'finish',
    route: '/app/dashboard',
    selector: null,
    title: "You're ready.",
    body: "That's the full tour. Your program is live and your targets are set. Go crush it.",
    tooltipPosition: 'center',
    isLast: true,
  },
];
