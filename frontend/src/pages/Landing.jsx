import { useNavigate } from "react-router-dom";

function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", width: "100vw", background: "#0f0f0f", color: "#fff" }}>
      <header style={{ borderBottom: "1px solid #1e1e1e" }}>
        <div
          style={{
            maxWidth: "1920px",
            margin: "0 auto",
            padding: "1.25rem 2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "1.25rem" }}>PhysiquePilot</div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "0.5rem 1rem",
                background: "transparent",
                color: "#fff",
                border: "1px solid #333",
                cursor: "pointer"
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
                cursor: "pointer"
              }}
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
              maxWidth: "1920px",
              margin: "0 auto",
              padding: "5rem 2rem 3rem",
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: "2rem",
              alignItems: "center"
            }}
          >
            <div>
              <h1 style={{ fontSize: "2.6rem", margin: 0, lineHeight: 1.1 }}>
                AI bodybuilding coaching, without the £200/month price tag.
              </h1>
              <p style={{ marginTop: "1.25rem", fontSize: "1.05rem", lineHeight: 1.7, color: "#aaa" }}>
                PhysiquePilot helps you train with structure, hit nutrition targets, and track progress over time — with data-driven adjustments built around your logs.
              </p>
              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => navigate("/register")}
                  style={{
                    padding: "0.8rem 1.4rem",
                    fontSize: "1rem",
                    background: "#2a2a2a",
                    color: "#fff",
                    border: "1px solid #333",
                    cursor: "pointer"
                  }}
                >
                  Start coaching
                </button>
                <button
                  onClick={() => navigate("/login")}
                  style={{
                    padding: "0.8rem 1.4rem",
                    fontSize: "1rem",
                    background: "transparent",
                    color: "#fff",
                    border: "1px solid #333",
                    cursor: "pointer"
                  }}
                >
                  I already have an account
                </button>
              </div>
              <div style={{ marginTop: "1.25rem", color: "#666", fontSize: "0.95rem" }}>
                18+ only · No PED advice · Privacy-focused by design
              </div>
            </div>

            <div
              style={{
                border: "1px solid #222",
                background: "#111",
                padding: "1.25rem",
                borderRadius: "8px"
              }}
            >
              <div style={{ fontWeight: 700 }}>What you get</div>
              <ul style={{ marginTop: "0.75rem", lineHeight: 1.8, color: "#aaa", paddingLeft: "1.2rem" }}>
                <li>Training split + logbook</li>
                <li>Weight tracking + trends</li>
                <li>Nutrition targets by day type</li>
                <li>Cardio + steps tracking</li>
                <li>Weekly check-ins (photos later)</li>
              </ul>
            </div>
          </div>
        </section>

        <section style={{ borderTop: "1px solid #1e1e1e", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ maxWidth: "1920px", margin: "0 auto", padding: "3rem 2rem" }}>
            <div
              style={{
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
              }}
            >
              <div style={{ border: "1px solid #222", background: "#111", padding: "1.25rem", borderRadius: "8px" }}>
                <h2 style={{ marginTop: 0 }}>Progressive training, not random workouts</h2>
                <p style={{ color: "#aaa", lineHeight: 1.7 }}>
                  Keep key exercises consistent, track reps and load, and build strength over time — the boring stuff that actually grows muscle.
                </p>
              </div>
              <div style={{ border: "1px solid #222", background: "#111", padding: "1.25rem", borderRadius: "8px" }}>
                <h2 style={{ marginTop: 0 }}>Nutrition targets that match the day</h2>
                <p style={{ color: "#aaa", lineHeight: 1.7 }}>
                  Training day, rest day, and high day targets — so performance stays high while progress stays controlled.
                </p>
              </div>
              <div style={{ border: "1px solid #222", background: "#111", padding: "1.25rem", borderRadius: "8px" }}>
                <h2 style={{ marginTop: 0 }}>Accountability without the coach tax</h2>
                <p style={{ color: "#aaa", lineHeight: 1.7 }}>
                  Most people don’t need £100–£500/month DMs. They need structure, feedback, and a system that doesn’t forget their history.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div style={{ maxWidth: "1920px", margin: "0 auto", padding: "3rem 2rem 4rem" }}>
            <h2 style={{ marginTop: 0 }}>Why PhysiquePilot?</h2>
            <ul style={{ marginTop: "1rem", lineHeight: 1.9, color: "#aaa", paddingLeft: "1.2rem" }}>
              <li>Built for lifestyle lifters and serious bodybuilders who want structure.</li>
              <li>No PED advice, no unsafe crash diets, no medical claims.</li>
              <li>More consistent logs → better decisions and adjustments.</li>
              <li>Designed for UK users and GDPR-friendly data handling.</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Landing;
