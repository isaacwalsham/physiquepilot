import { createPortal } from 'react-dom';

// ─── Constants ────────────────────────────────────────────────────────────────
const CURTAIN   = 'rgba(0,0,0,0.78)';
const PAD       = 10;   // px breathing room around the highlighted element
const CARD_W    = 320;  // tooltip card width in px
const CARD_GAP  = 16;   // gap between spotlight edge and tooltip card

// ─── TourOverlay ─────────────────────────────────────────────────────────────
// Renders via a React portal directly into document.body so it always sits
// above all other content regardless of stacking context.
export function TourOverlay({ active, step, stepIndex, totalSteps, spotlightRect, next, prev, skip }) {
  if (!active || !step) return null;

  const isCenter = !step.selector || step.tooltipPosition === 'center';

  // ── Centred modal (no spotlight) ─────────────────────────────────────────
  if (isCenter) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.82)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'tour-fade-in 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <TourCard
          step={step}
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          next={next}
          prev={prev}
          skip={skip}
          style={{ maxWidth: CARD_W + 40 }}
        />
        <TourKeyframes />
      </div>,
      document.body
    );
  }

  // ── Spotlight mode ────────────────────────────────────────────────────────
  // If the element hasn't been measured yet, show a full-dim overlay while waiting
  if (!spotlightRect) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: CURTAIN }} />,
      document.body
    );
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Padded spotlight bounds
  const sTop    = Math.max(0, spotlightRect.top    - PAD);
  const sLeft   = Math.max(0, spotlightRect.left   - PAD);
  const sBottom = Math.min(vh, spotlightRect.bottom + PAD);
  const sRight  = Math.min(vw, spotlightRect.right  + PAD);
  const sW      = sRight - sLeft;
  const sH      = sBottom - sTop;

  // Tooltip position
  const cardPos = computeCardPosition(step.tooltipPosition, { sTop, sLeft, sBottom, sRight, sW, sH, vw, vh });

  return createPortal(
    <>
      {/* ── 4 curtains ── */}
      {/* Top */}
      <div style={{ position: 'fixed', top: 0,      left: 0,     right: 0,            height: sTop,       background: CURTAIN, zIndex: 9997, transition: 'all 0.25s ease' }} />
      {/* Bottom */}
      <div style={{ position: 'fixed', top: sBottom, left: 0,     right: 0,            bottom: 0,          background: CURTAIN, zIndex: 9997, transition: 'all 0.25s ease' }} />
      {/* Left */}
      <div style={{ position: 'fixed', top: sTop,   left: 0,     width: sLeft,        height: sH,         background: CURTAIN, zIndex: 9997, transition: 'all 0.25s ease' }} />
      {/* Right */}
      <div style={{ position: 'fixed', top: sTop,   left: sRight, right: 0,            height: sH,         background: CURTAIN, zIndex: 9997, transition: 'all 0.25s ease' }} />

      {/* ── Glowing highlight ring ── */}
      <div
        style={{
          position: 'fixed',
          top: sTop,
          left: sLeft,
          width: sW,
          height: sH,
          border: '2px solid var(--accent-3, #b5153c)',
          boxShadow: '0 0 0 1px var(--accent-2, #8b1030), 0 0 24px rgba(165,21,21,0.35)',
          borderRadius: 6,
          zIndex: 9998,
          pointerEvents: 'none',
          transition: 'all 0.25s ease',
        }}
      />

      {/* ── Tooltip card ── */}
      <div
        style={{
          position: 'fixed',
          ...cardPos,
          width: CARD_W,
          zIndex: 9999,
          animation: 'tour-card-in 0.22s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <TourCard
          step={step}
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          next={next}
          prev={prev}
          skip={skip}
        />
      </div>

      <TourKeyframes />
    </>,
    document.body
  );
}

// ─── TourCard ─────────────────────────────────────────────────────────────────
function TourCard({ step, stepIndex, totalSteps, next, prev, skip, style = {} }) {
  const isFirst = stepIndex === 0;
  const isLast  = step.isLast || stepIndex === totalSteps - 1;

  return (
    <div
      style={{
        background: '#0b0b10',
        border: '1px solid #2a1118',
        borderRadius: 6,
        padding: '1.25rem 1.5rem',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(165,21,21,0.15)',
        fontFamily: 'var(--font-body, sans-serif)',
        ...style,
      }}
    >
      {/* Step counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div
          style={{
            fontFamily: 'var(--font-display, monospace)',
            fontSize: '0.65rem',
            letterSpacing: '0.18em',
            color: 'var(--accent-3, #b5153c)',
            textTransform: 'uppercase',
          }}
        >
          ◈ PHYSIQUE PILOT
        </div>
        <div style={{ fontSize: '0.72rem', color: '#555', fontFamily: 'var(--font-display, monospace)', letterSpacing: '0.1em' }}>
          {stepIndex + 1} / {totalSteps}
        </div>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 5, marginBottom: '1rem' }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              background: i <= stepIndex ? 'var(--accent-3, #b5153c)' : '#2a1118',
              transition: 'background 0.25s ease',
            }}
          />
        ))}
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-display, monospace)',
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--text-1, #fff)',
          letterSpacing: '0.04em',
          marginBottom: '0.5rem',
        }}
      >
        {step.title}
      </div>

      {/* Body */}
      <div
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-3, #aaa)',
          lineHeight: 1.55,
          marginBottom: '1.1rem',
        }}
      >
        {step.body}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        {/* Left: skip */}
        <button
          type="button"
          onClick={skip}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#555',
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: '0.3rem 0',
            fontFamily: 'var(--font-display, monospace)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {isLast ? '' : 'Skip tour'}
        </button>

        {/* Right: prev + next */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isFirst && (
            <button
              type="button"
              onClick={prev}
              style={{
                padding: '0.45rem 1rem',
                background: 'transparent',
                border: '1px solid #2a1118',
                color: '#888',
                fontSize: '0.8rem',
                cursor: 'pointer',
                borderRadius: 4,
                fontFamily: 'var(--font-display, monospace)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={next}
            style={{
              padding: '0.45rem 1.25rem',
              background: isLast ? 'var(--accent-3, #b5153c)' : '#1a0a10',
              border: '1px solid var(--accent-3, #b5153c)',
              color: '#fff',
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderRadius: 4,
              fontFamily: 'var(--font-display, monospace)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            {isLast ? "Let's go →" : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Position helper ──────────────────────────────────────────────────────────
function computeCardPosition(position, { sTop, sLeft, sBottom, sRight, sW, sH, vw, vh }) {
  const margin = 12;

  switch (position) {
    case 'right': {
      const left = Math.min(sRight + CARD_GAP, vw - CARD_W - margin);
      const top  = Math.max(margin, Math.min(sTop, vh - 260));
      return { left, top };
    }
    case 'left': {
      const left = Math.max(margin, sLeft - CARD_W - CARD_GAP);
      const top  = Math.max(margin, Math.min(sTop, vh - 260));
      return { left, top };
    }
    case 'bottom': {
      const left = Math.max(margin, Math.min(sLeft + sW / 2 - CARD_W / 2, vw - CARD_W - margin));
      const top  = Math.min(sBottom + CARD_GAP, vh - 260);
      return { left, top };
    }
    case 'top': {
      const left = Math.max(margin, Math.min(sLeft + sW / 2 - CARD_W / 2, vw - CARD_W - margin));
      const top  = Math.max(margin, sTop - 220 - CARD_GAP);
      return { left, top };
    }
    default: {
      // Fallback: center of screen
      return {
        left: Math.round(vw / 2 - CARD_W / 2),
        top:  Math.round(vh / 2 - 130),
      };
    }
  }
}

// ─── Keyframes ────────────────────────────────────────────────────────────────
function TourKeyframes() {
  return (
    <style>{`
      @keyframes tour-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes tour-card-in {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}
