import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";

function Landing() {
  const navigate = useNavigate();

  const slides = useMemo(
    () => [
      {
        title: "Structured training, not random workouts",
        text: "Build training blocks, follow weekly or rolling splits, and log sets and reps. Your training stays organised and progressive."
      },
      {
        title: "Nutrition that adapts to your workload",
        text: "Calories and macros adjust based on training days, rest days, steps, and cardio — so intake matches output."
      },
      {
        title: "Everything connected in one system",
        text: "Training, nutrition, weight, steps, cardio, check-ins, and photos all live together. Nothing is tracked in isolation."
      },
      {
        title: "AI coaching that learns from your data",
        text: "PhysiquePilot analyses your logs over time and applies coaching logic to guide adjustments as you progress."
      }
    ],
    []
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const i = setInterval(() => {
      setIndex((v) => (v + 1) % slides.length);
    }, 4500);
    return () => clearInterval(i);
  }, [slides.length]);

  const wrap = { minHeight: "100vh" };

  const header = {
    borderBottom: "1px solid #1e1e1e",
    position: "sticky",
    top: 0,
    zIndex: 20,
    backdropFilter: "blur(10px)",
    background: "rgba(15,15,15,0.85)"
  };

  const headerInner = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 0",
    gap: "1rem",
    flexWrap: "wrap"
  };

  const brand = { fontWeight: 750, fontSize: "1.15rem", letterSpacing: "0.2px" };

  const btnBase = {
    padding: "0.55rem 1rem",
    border: "1px solid #333",
    cursor: "pointer",
    transition: "transform 0.18s ease, border-color 0.18s ease, background 0.18s ease",
    borderRadius: "12px"
  };

  const btnGhost = { ...btnBase, background: "transparent", color: "#fff" };
  const btnPrimary = { ...btnBase, background: "#2a2a2a", color: "#fff" };

  const section = { padding: "4.5rem 0" };

  const heroGrid = {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "2.25rem",
    alignItems: "start"
  };

  const heroTitle = {
    fontSize: "clamp(2rem, 3vw, 3rem)",
    margin: 0,
    lineHeight: 1.12,
    letterSpacing: "0.2px"
  };

  const heroText = {
    marginTop: "1.1rem",
    fontSize: "1.08rem",
    lineHeight: 1.7,
    color: "#aaa",
    maxWidth: "60ch"
  };

  const ctas = {
    display: "flex",
    gap: "0.8rem",
    marginTop: "1.6rem",
    flexWrap: "wrap"
  };

  const panel = {
    border: "1px solid #222",
    background: "#111",
    padding: "2rem",
    borderRadius: "16px",
    minHeight: "240px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    transition: "transform 0.2s ease, border-color 0.2s ease"
  };

  const dots = { marginTop: "1.25rem", display: "flex", gap: "0.4rem" };
  const dot = (active) => ({
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: active ? "#fff" : "#333"
  });

  const sectionDivider = { borderTop: "1px solid #1e1e1e" };

  const gridCards = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "1.25rem"
  };

  const card = {
    border: "1px solid #222",
    background: "#111",
    padding: "1.5rem",
    borderRadius: "16px",
    transition: "transform 0.18s ease, border-color 0.18s ease"
  };

  const cardTitle = { marginTop: 0, marginBottom: "0.5rem" };
  const cardText = { color: "#aaa", lineHeight: 1.7, margin: 0 };

  // ✅ Key: proper mobile flow (title first, content underneath, no squash)
  const responsiveStyle = `
    /* Tablet + below */
    @media (max-width: 980px) {
      .pp-hero-grid { 
        grid-template-columns: 1fr !important; 
        gap: 1.25rem !important;
      }
      .pp-cards { grid-template-columns: 1fr !important; }
      .pp-cards-3 { grid-template-columns: 1fr !important; }

      .pp-hero-pad { 
        padding-top: 2.75rem !important; 
        padding-bottom: 2.25rem !important; 
      }
    }

    /* Mobile */
    @media (max-width: 520px) {
      .pp-header-actions {
        width: 100%;
        display: flex !important;
        gap: 0.6rem !important;
        justify-content: flex-start !important;
        flex-wrap: wrap !important;
      }

      .pp-hero-title {
        font-size: 2.05rem !important;
        line-height: 1.12 !important;
      }

      .pp-hero-text {
        font-size: 1rem !important;
        line-height: 1.6 !important;
      }

      .pp-panel {
        padding: 1.25rem !important;
        min-height: 0 !important;
      }

      .pp-section {
        padding: 3.25rem 0 !important;
      }

      .pp-footer {
        padding: 1.5rem 0 !important;
      }
    }
  `;

  const hoverLift = (e) => {
    e.currentTarget.style.transform = "translateY(-4px)";
    e.currentTarget.style.borderColor = "#333";
  };

  const hoverReset = (e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.borderColor = "#222";
  };

  const btnLift = (e) => (e.currentTarget.style.transform = "translateY(-1px)");
  const btnReset = (e) => (e.currentTarget.style.transform = "translateY(0)");

  return (
    <div className="public-page" style={wrap}>
      <style>{`
  ${responsiveStyle}

  @keyframes ppFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes ppGlow {
    0%, 100% { opacity: 0.35; transform: translate(-10%, -10%) scale(1); }
    50%      { opacity: 0.55; transform: translate(-10%, -10%) scale(1.06); }
  }

  @keyframes ppFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  .pp-anim-1 { animation: ppFadeUp 520ms ease both; }
  .pp-anim-2 { animation: ppFadeUp 520ms ease both; animation-delay: 80ms; }
  .pp-anim-3 { animation: ppFadeUp 520ms ease both; animation-delay: 160ms; }
  .pp-anim-4 { animation: ppFadeUp 520ms ease both; animation-delay: 240ms; }

  .pp-panel-float { animation: ppFloat 6s ease-in-out infinite; }
  .pp-card-hover { will-change: transform; }
  .pp-card-hover:hover { transform: translateY(-6px); }

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .pp-anim-1,.pp-anim-2,.pp-anim-3,.pp-anim-4 { animation: none !important; }
    .pp-panel-float { animation: none !important; }
  }
`}</style>

      <div className="public-inner">
        <header style={header}>
          <div style={headerInner}>
            <div style={brand}>PhysiquePilot</div>

            <div className="pp-header-actions" style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => navigate("/login")} style={btnGhost}>
                Log in
              </button>

              <button
                onClick={() => navigate("/register")}
                style={btnPrimary}
                onMouseEnter={btnLift}
                onMouseLeave={btnReset}
              >
                Get started
              </button>
            </div>
          </div>
        </header>

        <main>
          {/* HERO */}
          <section className="pp-section pp-hero-pad" style={{ ...section, paddingTop: "4rem" }}>
            <div className="pp-hero-grid" style={heroGrid}>
              <div className="pp-anim-1">
                <h1 className="pp-hero-title" style={heroTitle}>
                  A connected training, nutrition, and progress system.
                </h1>

                <p className="pp-hero-text" style={heroText}>
                  PhysiquePilot brings training, nutrition, and progress tracking into one system. As you log data,
                  the platform learns and applies coaching logic to help guide smarter decisions over time.
                </p>

                <div style={ctas}>
                  <button
                    onClick={() => navigate("/register")}
                    style={btnPrimary}
                    onMouseEnter={btnLift}
                    onMouseLeave={btnReset}
                  >
                    Create account
                  </button>

                  <button onClick={() => navigate("/login")} style={btnGhost}>
                    Log in
                  </button>
                </div>
              </div>

              <div
                className="pp-panel pp-anim-2 pp-panel-float"
                style={panel}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = "#2f2f2f";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#222";
                }}
              >
                <div style={{ fontSize: "1.25rem", fontWeight: 750 }}>{slides[index].title}</div>
                <div style={{ marginTop: "0.8rem", color: "#aaa", lineHeight: 1.7 }}>{slides[index].text}</div>

                <div style={dots}>
                  {slides.map((_, i) => (
                    <div key={i} style={dot(i === index)} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 3 CORE PILLARS */}
          <section className="pp-section pp-anim-3" style={{ ...sectionDivider, ...section }}>
            <div className="pp-cards-3" style={gridCards}>
              {[
                {
                  title: "Training",
                  text: "Plan training blocks, follow structured splits, log sessions, and review performance trends over time."
                },
                {
                  title: "Nutrition",
                  text: "Daily calorie and macro targets that adapt to training load, activity, and recovery — without rigid plans."
                },
                {
                  title: "Progress",
                  text: "See long-term trends across weight, check-ins, photos, steps, and cardio so progress is always visible."
                }
              ].map((c) => (
                <div
                  key={c.title}
                  className="pp-card-hover"
                  style={card}
                  onMouseEnter={hoverLift}
                  onMouseLeave={hoverReset}
                >
                  <h3 style={cardTitle}>{c.title}</h3>
                  <p style={cardText}>{c.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className="pp-section pp-anim-4" style={{ ...sectionDivider, ...section }}>
            <h2 style={{ marginTop: 0, marginBottom: "1.25rem" }}>How it works</h2>

            <div
              className="pp-cards"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "1.25rem"
              }}
            >
              {[
                {
                  title: "1. Log your data",
                  text: "Track training, nutrition, weight, steps, cardio, and check-ins. Everything feeds into one system."
                },
                {
                  title: "2. The system learns",
                  text: "PhysiquePilot analyses trends across workload, recovery, and progress — not just single data points."
                },
                {
                  title: "3. Get guided adjustments",
                  text: "Training, nutrition, and recovery decisions are guided by coaching logic that adapts as you progress."
                }
              ].map((c) => (
                <div
                  key={c.title}
                  className="pp-card-hover"
                  style={{ ...card, padding: "1.75rem" }}
                  onMouseEnter={hoverLift}
                  onMouseLeave={hoverReset}
                >
                  <div style={{ fontWeight: 750, fontSize: "1.05rem" }}>{c.title}</div>
                  <p style={{ ...cardText, marginTop: "0.75rem" }}>{c.text}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "2rem", display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
              <button
                onClick={() => navigate("/register")}
                style={btnPrimary}
                onMouseEnter={btnLift}
                onMouseLeave={btnReset}
              >
                Start onboarding
              </button>
              <button onClick={() => navigate("/login")} style={btnGhost}>
                I already have an account
              </button>
            </div>
          </section>

          <footer className="pp-footer" style={{ borderTop: "1px solid #1e1e1e", padding: "2rem 0", color: "#777" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>© {new Date().getFullYear()} PhysiquePilot</div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <span style={{ color: "#777" }}>Training</span>
                <span style={{ color: "#777" }}>Nutrition</span>
                <span style={{ color: "#777" }}>Progress</span>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default Landing;