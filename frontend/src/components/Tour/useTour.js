import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { TOUR_STEPS } from './tourSteps';

// ─── useTour ──────────────────────────────────────────────────────────────────
// Manages the product tour: step state, navigation, spotlight measurement,
// and persisting completion to Supabase.
//
// Usage: const tour = useTour(profile);
// Pass `tour` directly to <TourOverlay {...tour} />

export function useTour(profile) {
  const navigate = useNavigate();
  const location = useLocation();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const frameRef = useRef(null);

  const step = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];

  // ── Auto-start when profile loads and tour hasn't been completed ──────────
  // treat null / undefined the same as false — the column may not exist yet
  useEffect(() => {
    if (profile && profile.tour_completed !== true) {
      setActive(true);
      setStepIndex(0);
    }
  }, [profile?.user_id, profile?.tour_completed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Measure the target element whenever step or route changes ─────────────
  const measureTarget = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    if (!step?.selector) {
      setSpotlightRect(null);
      return;
    }

    // rAF + small delay to ensure the DOM has painted after a route change
    frameRef.current = requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.querySelector(step.selector);
        if (el) {
          setSpotlightRect(el.getBoundingClientRect());
        } else {
          setSpotlightRect(null);
        }
      }, 80);
    });
  }, [step]);

  useEffect(() => {
    if (!active) return;

    // Navigate to the required route if we're not already there
    if (step.route !== location.pathname) {
      navigate(step.route);
      return; // wait for re-render after navigation
    }

    measureTarget();
  }, [active, stepIndex, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure on window resize
  useEffect(() => {
    if (!active) return;
    window.addEventListener('resize', measureTarget);
    return () => window.removeEventListener('resize', measureTarget);
  }, [active, measureTarget]);

  // ── Persist tour completion to Supabase ───────────────────────────────────
  const markComplete = useCallback(async () => {
    if (!profile?.user_id) return;
    await supabase
      .from('profiles')
      .update({ tour_completed: true })
      .eq('user_id', profile.user_id);
  }, [profile?.user_id]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const next = useCallback(() => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      setActive(false);
      markComplete();
      navigate('/app/dashboard');
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, markComplete, navigate]);

  const prev = useCallback(() => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }, [stepIndex]);

  const skip = useCallback(() => {
    setActive(false);
    markComplete();
  }, [markComplete]);

  // Called from Settings "Replay Tour" button
  const restart = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  return {
    active,
    step,
    stepIndex,
    totalSteps: TOUR_STEPS.length,
    spotlightRect,
    next,
    prev,
    skip,
    restart,
  };
}
