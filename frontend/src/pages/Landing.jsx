import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

function Landing() {
  const navigate = useNavigate();
  const slides = [
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
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const i = setInterval(() => {
      setIndex((v) => (v + 1) % slides.length);
    }, 4500);
    return () => clearInterval(i);
  }, []);

  return (
    <div style={{ minHeight: "100vh", width: "100vw", background: "#0f0f0f", color: "#fff" }}>
      <header style={{ borderBottom: "1px solid #1e1e1e" }}>
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "1.25rem 2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.25rem" }}>PhysiquePilot</div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "0.5rem 1rem",
                background: "transparent",
                color: "#fff",
                border: "1px solid #333",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/register")}
              style={{
                padding: "0.5rem 1rem",
                background: "#2a2a2a",
                color: "#fff",
                border: "1px solid #333",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <main>
        <section>
          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              padding: "6rem 2rem 4rem",
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: "3rem",
              alignItems: "center"
            }}
          >
            <div>
              <h1 style={{ fontSize: "2.8rem", margin: 0, lineHeight: 1.15 }}>
                A connected training, nutrition, and progress system.
              </h1>
              <p style={{ marginTop: "1.25rem", fontSize: "1.1rem", lineHeight: 1.7, color: "#aaa" }}>
                PhysiquePilot brings training, nutrition, and progress tracking into one system. As you log data, the platform learns and applies coaching logic to help guide smarter decisions over time.
              </p>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => navigate("/register")}
                  style={{
                    padding: "0.9rem 1.6rem",
                    fontSize: "1rem",
                    background: "#2a2a2a",
                    color: "#fff",
                    border: "1px solid #333",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
                >
                  Create account
                </button>
                <button
                  onClick={() => navigate("/login")}
                  style={{
                    padding: "0.9rem 1.6rem",
                    fontSize: "1rem",
                    background: "transparent",
                    color: "#fff",
                    border: "1px solid #333",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  Log in
                </button>
              </div>
            </div>

            <div
              style={{
                border: "1px solid #222",
                background: "#111",
                padding: "2rem",
                borderRadius: "10px",
                minHeight: "220px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                transition: "all 0.3s ease"
              }}
            >
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                {slides[index].title}
              </div>
              <div style={{ marginTop: "0.75rem", color: "#aaa", lineHeight: 1.7 }}>
                {slides[index].text}
              </div>
              <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.4rem" }}>
                {slides.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: i === index ? "#fff" : "#333"
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section style={{ borderTop: "1px solid #1e1e1e" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "4rem 2rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1.5rem"
              }}
            >
              <div
                style={{
                  border: "1px solid #222",
                  background: "#111",
                  padding: "1.5rem",
                  borderRadius: "10px",
                  transition: "transform 0.2s ease, border-color 0.2s ease"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.borderColor = "#333";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#222";
                }}
              >
                <h3 style={{ marginTop: 0 }}>Training</h3>
                <p style={{ color: "#aaa", lineHeight: 1.7 }}>
                  Plan training blocks, follow structured splits, log sessions, and review performance trends over time.
                </p>
              </div>
              <div
                style={{
                  border: "1px solid #222",
                  background: "#111",
                  padding: "1.5rem",
                  borderRadius: "10px",
                  transition: "transform 0.2s ease, border-color 0.2s ease"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.borderColor = "#333";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#222";
                }}
              >
                <h3 style={{ marginTop: 0 }}>Nutrition</h3>
                <p style={{ color: "#aaa", lineHeight: 1.7 }}>
                  Daily calorie and macro targets that adapt to training load, activity, and recovery — without rigid plans.
                </p>
              </div>
              <div
                style={{
                  border: "1px solid #222",
                  background: "#111",
                  padding: "1.5rem",
                  borderRadius: "10px",
                  transition: "transform 0.2s ease, border-color 0.2s ease"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.borderColor = "#333";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#222";
                }}
              >
                <h3 style={{ marginTop: 0 }}>Progress</h3>
                <p style={{ color: "#aaa", lineHeight: 1.7 }}>
                  See long-term trends across weight, check-ins, photos, steps, and cardio so progress is always visible.
                </p>
              </div>
            </div>
          </div>
        </section>
        {/* How it works section */}
        <section style={{ borderTop: "1px solid #1e1e1e" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "4rem 2rem" }}>
            <h2 style={{ marginTop: 0 }}>How it works</h2>

            <div
              style={{
                marginTop: "2rem",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1.5rem"
              }}
            >
              <div style={{ border: "1px solid #222", background: "#111", padding: "1.75rem", borderRadius: "10px" }}>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>1. Log your data</div>
                <p style={{ marginTop: "0.75rem", color: "#aaa", lineHeight: 1.7 }}>
                  Track training, nutrition, weight, steps, cardio, and check-ins. Everything feeds into one system.
                </p>
              </div>

              <div style={{ border: "1px solid #222", background: "#111", padding: "1.75rem", borderRadius: "10px" }}>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>2. The system learns</div>
                <p style={{ marginTop: "0.75rem", color: "#aaa", lineHeight: 1.7 }}>
                  PhysiquePilot analyses trends across workload, recovery, and progress — not just single data points.
                </p>
              </div>

              <div style={{ border: "1px solid #222", background: "#111", padding: "1.75rem", borderRadius: "10px" }}>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>3. Get guided adjustments</div>
                <p style={{ marginTop: "0.75rem", color: "#aaa", lineHeight: 1.7 }}>
                  Training, nutrition, and recovery decisions are guided by coaching logic that adapts as you progress.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Landing;
