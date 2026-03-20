import { createPortal } from 'react-dom';
import { SECTIONS, TOUR_STEPS } from './tourSteps';

// ─── Constants ────────────────────────────────────────────────────────────────
const CURTAIN    = 'rgba(0,0,0,0.82)';
const SPOT_PAD   = 14;
const CARD_W     = 420;
const CARD_W_CTR = 490;
const CARD_GAP   = 20;

// Pre-compute non-cinematic steps for progress tracking
const CONTENT_STEPS = TOUR_STEPS.filter(s => !s.isCinematic);

// ─── TourOverlay ──────────────────────────────────────────────────────────────
export function TourOverlay({ active, step, stepIndex, totalSteps, spotlightRect, next, prev, skip }) {
  if (!active || !step) return null;

  // ── Cinematic screens ────────────────────────────────────────────────────────
  if (step.isCinematic) {
    return createPortal(
      <>
        <CinematicScreen type={step.isCinematic} next={next} skip={skip} />
        <TourKeyframes />
      </>,
      document.body
    );
  }

  const isCenter     = !step.selector || step.tooltipPosition === 'center' || !spotlightRect;
  const section      = SECTIONS.find(s => s.key === step.section);
  const contentIndex = CONTENT_STEPS.findIndex(s => s.id === step.id);
  const contentTotal = CONTENT_STEPS.length;

  // ── Centred modal ────────────────────────────────────────────────────────────
  if (isCenter) {
    return createPortal(
      <>
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: CURTAIN,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'tour-fade-in 0.2s ease both',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ animation: 'tour-card-in 0.28s cubic-bezier(0.22,0.68,0,1.2) both' }}>
            <TourCard
              step={step} section={section}
              contentIndex={contentIndex} contentTotal={contentTotal}
              next={next} prev={prev} skip={skip}
              isCenter
            />
          </div>
        </div>
        <TourKeyframes />
      </>,
      document.body
    );
  }

  // ── Spotlight mode ───────────────────────────────────────────────────────────
  if (!spotlightRect) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: CURTAIN }} />,
      document.body
    );
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sTop    = Math.max(0,  spotlightRect.top    - SPOT_PAD);
  const sLeft   = Math.max(0,  spotlightRect.left   - SPOT_PAD);
  const sBottom = Math.min(vh, spotlightRect.bottom + SPOT_PAD);
  const sRight  = Math.min(vw, spotlightRect.right  + SPOT_PAD);
  const sW      = sRight - sLeft;
  const sH      = sBottom - sTop;

  const cardPos = computeCardPosition(step.tooltipPosition, { sTop, sLeft, sBottom, sRight, sW, sH, vw, vh });
  const accentColor = section?.color ?? 'var(--accent-3)';

  return createPortal(
    <>
      {/* ── 4 curtain divs ── */}
      <div style={{ position:'fixed', top:0,       left:0,      right:0,     height:sTop,  background:CURTAIN, zIndex:9997, transition:'all 0.28s ease' }} />
      <div style={{ position:'fixed', top:sBottom, left:0,      right:0,     bottom:0,     background:CURTAIN, zIndex:9997, transition:'all 0.28s ease' }} />
      <div style={{ position:'fixed', top:sTop,    left:0,      width:sLeft, height:sH,    background:CURTAIN, zIndex:9997, transition:'all 0.28s ease' }} />
      <div style={{ position:'fixed', top:sTop,    left:sRight, right:0,     height:sH,    background:CURTAIN, zIndex:9997, transition:'all 0.28s ease' }} />

      {/* ── Spotlight ring ── */}
      <div
        style={{
          position:'fixed', top:sTop, left:sLeft, width:sW, height:sH,
          border:`2px solid ${accentColor}`,
          boxShadow:`0 0 0 1px ${accentColor}44, 0 0 28px ${accentColor}55, inset 0 0 20px ${accentColor}08`,
          borderRadius: 10,
          zIndex: 9998,
          pointerEvents: 'none',
          transition: 'all 0.28s ease',
          animation: 'tour-ring-in 0.3s ease both',
        }}
      />

      {/* ── Tooltip card ── */}
      <div
        style={{
          position:'fixed', ...cardPos, width: CARD_W,
          zIndex: 9999,
          animation: 'tour-card-in 0.28s cubic-bezier(0.22,0.68,0,1.2) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        <TourCard
          step={step} section={section}
          contentIndex={contentIndex} contentTotal={contentTotal}
          next={next} prev={prev} skip={skip}
        />
      </div>

      <TourKeyframes />
    </>,
    document.body
  );
}

// ─── CinematicScreen ──────────────────────────────────────────────────────────
function CinematicScreen({ type, next, skip }) {

  // ── Welcome ──────────────────────────────────────────────────────────────────
  if (type === 'welcome') {
    return (
      <div
        style={{
          position:'fixed', inset:0, zIndex:10000,
          background:`radial-gradient(ellipse 1000px 420px at 50% -8%, rgba(204,32,32,0.20), transparent 60%),
                      radial-gradient(ellipse 600px 300px at 80% 90%, rgba(122,13,13,0.12), transparent 55%),
                      #060303`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'var(--font-display)',
          animation:'tour-fade-in 0.4s ease both',
        }}
      >
        {/* Subtle grid texture */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none', opacity:0.4,
          background:`repeating-linear-gradient(90deg,transparent 0,transparent 36px,rgba(204,32,32,0.032) 37px),
                      repeating-linear-gradient(180deg,transparent 0,transparent 36px,rgba(204,32,32,0.022) 37px)`,
        }} />

        <div style={{ position:'relative', textAlign:'center', maxWidth:580, padding:'0 2.5rem' }}>

          {/* Brand mark */}
          <div style={{
            fontSize:'0.68rem', letterSpacing:'0.28em', color:'var(--accent-3)',
            marginBottom:'1.5rem',
            animation:'tour-fade-up 0.5s ease both', animationDelay:'0s',
          }}>
            ◈ &nbsp; P H Y S I Q U E &nbsp; P I L O T
          </div>

          {/* Accent rule */}
          <div style={{
            width:56, height:2, background:'var(--accent-3)',
            margin:'0 auto 2.5rem',
            animation:'tour-fade-up 0.5s ease both', animationDelay:'0.05s',
          }} />

          {/* Headline */}
          <div style={{
            fontSize:'clamp(2.4rem,5.5vw,3.8rem)', fontWeight:700, lineHeight:1.08,
            color:'var(--text-1)', letterSpacing:'-0.01em',
            marginBottom:'1.5rem',
            animation:'tour-fade-up 0.55s ease both', animationDelay:'0.15s',
          }}>
            Your coaching<br />system is live.
          </div>

          {/* Sub-headline */}
          <div style={{
            fontSize:'1rem', lineHeight:1.7, color:'var(--text-2)',
            maxWidth:420, margin:'0 auto 3rem',
            fontFamily:'var(--font-body)',
            animation:'tour-fade-up 0.55s ease both', animationDelay:'0.28s',
          }}>
            Take 90 seconds to explore every feature.
            You can replay this tour any time from Settings.
          </div>

          {/* Buttons */}
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:'0.8rem',
            animation:'tour-fade-up 0.55s ease both', animationDelay:'0.4s',
          }}>
            <button
              onClick={next}
              style={{
                padding:'0.9rem 3rem',
                background:'var(--accent-3)',
                border:'1px solid var(--accent-3)',
                color:'#fff',
                fontSize:'0.82rem', letterSpacing:'0.15em',
                fontFamily:'var(--font-display)', fontWeight:700,
                cursor:'pointer', borderRadius:8,
                boxShadow:'0 0 40px rgba(204,32,32,0.45), 0 8px 24px rgba(0,0,0,0.55)',
                transition:'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => { e.target.style.transform='translateY(-2px)'; e.target.style.boxShadow='0 0 52px rgba(204,32,32,0.6), 0 12px 28px rgba(0,0,0,0.6)'; }}
              onMouseLeave={e => { e.target.style.transform=''; e.target.style.boxShadow='0 0 40px rgba(204,32,32,0.45), 0 8px 24px rgba(0,0,0,0.55)'; }}
            >
              BEGIN TOUR &nbsp;→
            </button>
            <button
              onClick={skip}
              style={{
                background:'transparent', border:'none',
                color:'var(--text-3)', fontSize:'0.7rem',
                fontFamily:'var(--font-display)', letterSpacing:'0.12em',
                cursor:'pointer', padding:'0.4rem 0',
              }}
            >
              SKIP TOUR
            </button>
          </div>

          {/* Keyboard hint */}
          <div style={{
            marginTop:'2.5rem',
            fontSize:'0.6rem', color:'var(--text-3)', letterSpacing:'0.1em',
            animation:'tour-fade-up 0.55s ease both', animationDelay:'0.5s',
          }}>
            ← → &nbsp;NAVIGATE &nbsp;·&nbsp; ESC &nbsp;SKIP
          </div>
        </div>
      </div>
    );
  }

  // ── Finish ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position:'fixed', inset:0, zIndex:10000,
        background:`radial-gradient(ellipse 800px 360px at 50% 35%, rgba(204,32,32,0.16), transparent 58%),
                    radial-gradient(ellipse 500px 200px at 20% 80%, rgba(34,197,94,0.06), transparent 50%),
                    #060303`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'var(--font-display)',
        animation:'tour-fade-in 0.4s ease both',
      }}
    >
      {/* Grid texture */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none', opacity:0.35,
        background:`repeating-linear-gradient(90deg,transparent 0,transparent 36px,rgba(204,32,32,0.03) 37px),
                    repeating-linear-gradient(180deg,transparent 0,transparent 36px,rgba(204,32,32,0.02) 37px)`,
      }} />

      <div style={{ position:'relative', textAlign:'center', maxWidth:560, padding:'0 2.5rem' }}>

        {/* Brand */}
        <div style={{
          fontSize:'0.68rem', letterSpacing:'0.28em', color:'var(--accent-3)',
          marginBottom:'1rem',
          animation:'tour-fade-up 0.5s ease both', animationDelay:'0s',
        }}>
          ◈ &nbsp; P H Y S I Q U E &nbsp; P I L O T
        </div>

        {/* Complete badge */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:'0.5rem',
          fontSize:'0.68rem', letterSpacing:'0.16em', color:'#22c55e',
          marginBottom:'1.5rem',
          background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)',
          padding:'0.35rem 0.9rem', borderRadius:999,
          animation:'tour-fade-up 0.5s ease both', animationDelay:'0.08s',
        }}>
          <span>✓</span> TOUR COMPLETE
        </div>

        {/* Headline */}
        <div style={{
          fontSize:'clamp(2.8rem,6vw,4.5rem)', fontWeight:700, lineHeight:1.0,
          color:'var(--text-1)', letterSpacing:'-0.02em',
          marginBottom:'2.5rem',
          animation:'tour-fade-up 0.55s ease both', animationDelay:'0.18s',
        }}>
          You're ready.
        </div>

        {/* Setup checklist */}
        <div style={{
          display:'flex', flexDirection:'column', gap:'0.75rem',
          maxWidth:340, margin:'0 auto 3rem', textAlign:'left',
          animation:'tour-fade-up 0.55s ease both', animationDelay:'0.3s',
        }}>
          {[
            { label: 'Dashboard live',                color: '#cc2020' },
            { label: 'Nutrition targets set',         color: '#4d8eff' },
            { label: 'Training programme loaded',     color: '#cc2020' },
            { label: 'Movement & habit tracking on',  color: '#f59e0b' },
            { label: 'Weekly check-ins scheduled',    color: '#14b8a6' },
            { label: 'AI Coach ready',                color: '#fbbf24' },
          ].map((item, i) => (
            <div
              key={item.label}
              style={{ display:'flex', alignItems:'center', gap:'0.75rem',
                animation:'tour-fade-up 0.4s ease both', animationDelay:`${0.32 + i * 0.05}s` }}
            >
              <div style={{
                width:22, height:22, borderRadius:'50%',
                background:`${item.color}18`, border:`1px solid ${item.color}60`,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}>
                <span style={{ color:item.color, fontSize:'0.65rem', fontWeight:700 }}>✓</span>
              </div>
              <span style={{
                fontSize:'0.875rem', color:'var(--text-2)',
                fontFamily:'var(--font-body)', letterSpacing:'0.01em',
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ animation:'tour-fade-up 0.55s ease both', animationDelay:'0.62s' }}>
          <button
            onClick={next}
            style={{
              padding:'0.9rem 3rem',
              background:'var(--accent-3)',
              border:'1px solid var(--accent-3)',
              color:'#fff',
              fontSize:'0.82rem', letterSpacing:'0.15em',
              fontFamily:'var(--font-display)', fontWeight:700,
              cursor:'pointer', borderRadius:8,
              boxShadow:'0 0 40px rgba(204,32,32,0.45), 0 8px 24px rgba(0,0,0,0.55)',
              transition:'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={e => { e.target.style.transform='translateY(-2px)'; e.target.style.boxShadow='0 0 52px rgba(204,32,32,0.6), 0 12px 28px rgba(0,0,0,0.6)'; }}
            onMouseLeave={e => { e.target.style.transform=''; e.target.style.boxShadow='0 0 40px rgba(204,32,32,0.45), 0 8px 24px rgba(0,0,0,0.55)'; }}
          >
            GO CRUSH IT &nbsp;→
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TourCard ─────────────────────────────────────────────────────────────────
function TourCard({ step, section, contentIndex, contentTotal, next, prev, skip, isCenter }) {
  const isFirst      = contentIndex === 0;
  const isLast       = contentIndex === contentTotal - 1;
  const sectionColor = section?.color ?? 'var(--accent-3)';

  // Which section index are we in (for progress bar)?
  const activeSectionIdx = SECTIONS.findIndex(s => s.key === step.section);

  // Steps per section (for segment width weighting)
  const stepsPerSection = SECTIONS.map(sec =>
    CONTENT_STEPS.filter(s => s.section === sec.key).length
  );
  const totalContent = CONTENT_STEPS.length;

  return (
    <div
      style={{
        background: 'var(--surface-1, #0c0606)',
        border: '1px solid var(--line-1, #261414)',
        borderTop: `3px solid ${sectionColor}`,
        borderRadius: 10,
        padding: '1.5rem 1.6rem 1.2rem',
        boxShadow: `0 20px 56px rgba(0,0,0,0.75), 0 0 0 1px ${sectionColor}1a, 0 0 36px ${sectionColor}14`,
        fontFamily: 'var(--font-body, sans-serif)',
        width: isCenter ? CARD_W_CTR : CARD_W,
        maxWidth: '94vw',
      }}
    >
      {/* ── Header row: icon + section + counter ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <SectionIcon sectionKey={step.section} color={sectionColor} size={16} />
          <span style={{
            fontFamily:'var(--font-display)', fontSize:'0.6rem',
            letterSpacing:'0.2em', color:sectionColor, textTransform:'uppercase',
          }}>
            {section?.label ?? 'Physique Pilot'}
          </span>
        </div>
        <span style={{
          fontFamily:'var(--font-display)', fontSize:'0.6rem',
          letterSpacing:'0.12em', color:'var(--text-3)',
        }}>
          {contentIndex + 1} / {contentTotal}
        </span>
      </div>

      {/* ── Section progress bar — one weighted segment per section ── */}
      <div style={{ display:'flex', gap:3, marginBottom:'1.35rem' }}>
        {SECTIONS.map((sec, i) => {
          const segSteps = stepsPerSection[i];
          const weight   = segSteps / totalContent;
          const state    = i < activeSectionIdx ? 'done' : i === activeSectionIdx ? 'active' : 'future';

          // Within the active section, find sub-progress
          let subFill = 1;
          if (state === 'active' && segSteps > 1) {
            const secStepIndex = CONTENT_STEPS.filter(s => s.section === sec.key).findIndex(s => s.id === step.id);
            subFill = (secStepIndex + 1) / segSteps;
          }
          if (state === 'future') subFill = 0;

          return (
            <div
              key={sec.key}
              style={{
                flex: weight, height:4, borderRadius:2,
                background: 'rgba(255,255,255,0.06)',
                overflow:'hidden', position:'relative',
              }}
            >
              <div style={{
                position:'absolute', inset:0,
                width: state === 'done' ? '100%' : state === 'active' ? `${subFill * 100}%` : '0%',
                background: sec.color,
                opacity: state === 'done' ? 0.55 : 1,
                borderRadius:2,
                transition: 'width 0.35s ease',
              }} />
            </div>
          );
        })}
      </div>

      {/* ── Title ── */}
      <div style={{
        fontFamily:'var(--font-display)', fontSize:'1.08rem', fontWeight:700,
        color:'var(--text-1)', letterSpacing:'0.02em', lineHeight:1.25,
        marginBottom:'0.65rem',
      }}>
        {step.title}
      </div>

      {/* ── Body ── */}
      <div style={{
        fontSize:'0.875rem', color:'var(--text-2)', lineHeight:1.68,
        marginBottom:'1.3rem',
      }}>
        {step.body}
      </div>

      {/* ── Buttons ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button
          onClick={skip}
          style={{
            background:'transparent', border:'none',
            color:'var(--text-3)', fontSize:'0.68rem',
            cursor:'pointer', padding:'0.3rem 0',
            fontFamily:'var(--font-display)', letterSpacing:'0.1em',
            textTransform:'uppercase',
          }}
        >
          {isLast ? '' : 'Skip tour'}
        </button>

        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          {!isFirst && (
            <button
              onClick={prev}
              style={{
                padding:'0.48rem 1rem',
                background:'transparent',
                border:'1px solid var(--line-2)',
                color:'var(--text-2)',
                fontSize:'0.72rem', cursor:'pointer',
                borderRadius:6, fontFamily:'var(--font-display)',
                letterSpacing:'0.08em', textTransform:'uppercase',
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={next}
            style={{
              padding:'0.48rem 1.3rem',
              background: isLast ? sectionColor : `${sectionColor}1e`,
              border:`1px solid ${sectionColor}`,
              color: isLast ? '#fff' : sectionColor,
              fontSize:'0.72rem', cursor:'pointer',
              borderRadius:6, fontFamily:'var(--font-display)',
              letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:700,
              boxShadow: isLast ? `0 0 20px ${sectionColor}44` : 'none',
            }}
          >
            {isLast ? "Let's go →" : 'Next →'}
          </button>
        </div>
      </div>

      {/* ── Keyboard hint ── */}
      <div style={{
        marginTop:'0.9rem', textAlign:'center',
        fontSize:'0.56rem', color:'var(--text-3)', letterSpacing:'0.1em', opacity:0.55,
      }}>
        ← → &nbsp;NAVIGATE &nbsp;·&nbsp; ESC &nbsp;SKIP
      </div>
    </div>
  );
}

// ─── Section icons (Feather-style SVG) ───────────────────────────────────────
function SectionIcon({ sectionKey, color, size = 20 }) {
  const p = {
    viewBox:'0 0 24 24', fill:'none', stroke:color,
    strokeWidth:1.85, strokeLinecap:'round', strokeLinejoin:'round',
    style:{ width:size, height:size, flexShrink:0 },
  };

  switch (sectionKey) {
    case 'dashboard':
      return (
        <svg {...p}>
          <rect x="3"  y="3"  width="7" height="7" rx="1" />
          <rect x="14" y="3"  width="7" height="7" rx="1" />
          <rect x="3"  y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'weight':
      return (
        <svg {...p}>
          <polyline points="3,17 9,11 13,15 21,5" />
          <polyline points="16,5 21,5 21,10" />
        </svg>
      );
    case 'nutrition':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" fill={color} stroke="none" />
        </svg>
      );
    case 'training':
      return (
        <svg {...p}>
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" fill={`${color}22`} />
        </svg>
      );
    case 'movement':
      return (
        <svg {...p}>
          <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
        </svg>
      );
    case 'habits':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="8.5,12 10.8,14.8 15.5,9.5" />
        </svg>
      );
    case 'checkins':
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8"  y1="2" x2="8"  y2="6" />
          <line x1="3"  y1="10" x2="21" y2="10" />
          <line x1="8"  y1="15" x2="8"  y2="15" strokeWidth="2.5" />
          <line x1="12" y1="15" x2="12" y2="15" strokeWidth="2.5" />
          <line x1="16" y1="15" x2="16" y2="15" strokeWidth="2.5" />
        </svg>
      );
    case 'coach':
      return (
        <svg {...p}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

// ─── Card position helper ─────────────────────────────────────────────────────
function computeCardPosition(position, { sTop, sLeft, sBottom, sRight, sW, sH, vw, vh }) {
  const margin   = 16;
  const cardH    = 310; // approximate card height for boundary checks

  switch (position) {
    case 'right': {
      const left = Math.min(sRight + CARD_GAP, vw - CARD_W - margin);
      const top  = Math.max(margin, Math.min(sTop, vh - cardH - margin));
      return { left, top };
    }
    case 'left': {
      const left = Math.max(margin, sLeft - CARD_W - CARD_GAP);
      const top  = Math.max(margin, Math.min(sTop, vh - cardH - margin));
      return { left, top };
    }
    case 'bottom': {
      const left = Math.max(margin, Math.min(sLeft + sW / 2 - CARD_W / 2, vw - CARD_W - margin));
      const top  = Math.min(sBottom + CARD_GAP, vh - cardH - margin);
      return { left, top };
    }
    case 'top': {
      const left = Math.max(margin, Math.min(sLeft + sW / 2 - CARD_W / 2, vw - CARD_W - margin));
      const top  = Math.max(margin, sTop - cardH - CARD_GAP);
      return { left, top };
    }
    default: {
      return {
        left: Math.round(vw / 2 - CARD_W / 2),
        top:  Math.round(vh / 2 - cardH / 2),
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
      @keyframes tour-fade-up {
        from { opacity: 0; transform: translateY(14px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
      @keyframes tour-card-in {
        from { opacity: 0; transform: translateY(10px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
      }
      @keyframes tour-ring-in {
        from { opacity: 0; transform: scale(1.04); }
        to   { opacity: 1; transform: scale(1);    }
      }
    `}</style>
  );
}
