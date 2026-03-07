import { suggestTrainingDays } from "../../training/trainingUtils";

const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "2rem",
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
};

const cardStyle = (selected) => ({
  border: `2px solid ${selected ? "var(--accent-2)" : "var(--line-1)"}`,
  borderRadius: "var(--radius-md)",
  background: selected ? "rgba(181,21,60,0.12)" : "var(--surface-2)",
  padding: "1.25rem 1.5rem",
  cursor: "pointer",
  transition: "border-color var(--motion-fast) ease, background var(--motion-fast) ease",
  color: "var(--text-1)",
});

const inputStyle = (hasError) => ({
  width: "100%",
  background: "var(--surface-2)",
  border: `1.5px solid ${hasError ? "var(--bad)" : "var(--line-1)"}`,
  borderRadius: "var(--radius-sm)",
  color: "var(--text-1)",
  fontFamily: "var(--font-body)",
  fontSize: "1rem",
  padding: "0.75rem 1rem",
  outline: "none",
  boxSizing: "border-box",
});

const errorStyle = { color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.4rem" };

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  color: "var(--text-2)",
  marginBottom: "0.4rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const FREQ_OPTIONS = [
  { value: "1-2", label: "1–2 days/week" },
  { value: "2-4", label: "2–4 days/week" },
  { value: "5-6", label: "5–6 days/week" },
  { value: "7",   label: "7 days/week" },
];

export default function Step10_TrainingSchedule({ form, setField, error }) {
  const splitMode = form.splitMode || "fixed";
  const selectedDays = form.trainingDaysSelected || [];

  function toggleDay(key) {
    const next = selectedDays.includes(key)
      ? selectedDays.filter((d) => d !== key)
      : [...selectedDays, key];
    setField("trainingDaysSelected", next);
  }

  const tabBase = {
    flex: 1,
    padding: "0.6rem 1rem",
    cursor: "pointer",
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    border: "none",
    transition: "background var(--motion-fast) ease, color var(--motion-fast) ease",
  };

  const tabActive = {
    ...tabBase,
    background: "var(--accent-2)",
    color: "#fff",
  };

  const tabInactive = {
    ...tabBase,
    background: "var(--surface-2)",
    color: "var(--text-2)",
  };

  const daysError = error && error.field === "trainingDaysSelected";
  const freqError = error && error.field === "trainingFrequencyRange";
  const dateError = error && error.field === "rollingStartDate";

  return (
    <div>
      <h1 style={titleStyle}>How do you structure your training?</h1>

      {/* Mode toggle */}
      <div
        style={{
          display: "flex",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          border: "1.5px solid var(--line-1)",
          marginBottom: "2rem",
        }}
      >
        <button
          type="button"
          style={splitMode === "fixed" ? tabActive : tabInactive}
          onClick={() => setField("splitMode", "fixed")}
        >
          Fixed days
        </button>
        <button
          type="button"
          style={splitMode === "rolling" ? tabActive : tabInactive}
          onClick={() => setField("splitMode", "rolling")}
        >
          Rolling split
        </button>
      </div>

      {splitMode === "fixed" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "0.5rem",
            }}
          >
            {DAY_KEYS.map((key, i) => {
              const selected = selectedDays.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDay(key)}
                  style={{
                    padding: "0.75rem 0",
                    border: `2px solid ${selected ? "var(--accent-2)" : "var(--line-1)"}`,
                    borderRadius: "var(--radius-sm)",
                    background: selected ? "rgba(181,21,60,0.12)" : "var(--surface-2)",
                    color: selected ? "var(--accent-2)" : "var(--text-2)",
                    fontFamily: "var(--font-display)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition:
                      "border-color var(--motion-fast) ease, background var(--motion-fast) ease, color var(--motion-fast) ease",
                    letterSpacing: "0.02em",
                  }}
                  aria-pressed={selected}
                >
                  {DAYS[i]}
                </button>
              );
            })}
          </div>
          {daysError && <p style={errorStyle}>{error.message}</p>}
          <div style={{ marginTop: "0.9rem" }}>
            <button
              type="button"
              onClick={() => {
                const n = selectedDays.length || 3;
                setField("trainingDaysSelected", suggestTrainingDays(n));
              }}
              style={{
                padding: "0.55rem 1.1rem",
                border: "1.5px solid var(--accent-2)",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                color: "var(--accent-3)",
                fontFamily: "var(--font-display)",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                cursor: "pointer",
                transition: "background var(--motion-fast) ease, color var(--motion-fast) ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(181,21,60,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              ✦ Choose for me
            </button>
            {selectedDays.length > 0 && (
              <span style={{
                marginLeft: "0.75rem",
                fontSize: "0.78rem",
                color: "var(--text-3)",
                fontFamily: "var(--font-body)",
              }}>
                {selectedDays.length} day{selectedDays.length !== 1 ? "s" : ""} selected
              </span>
            )}
          </div>
        </div>
      )}

      {splitMode === "rolling" && (
        <div>
          <label style={labelStyle}>Training frequency</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.75rem",
              marginBottom: "1.5rem",
            }}
          >
            {FREQ_OPTIONS.map((opt) => {
              const selected = form.trainingFrequencyRange === opt.value;
              return (
                <div
                  key={opt.value}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  style={{
                    ...cardStyle(selected),
                    padding: "0.9rem 1rem",
                    textAlign: "center",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.9rem",
                  }}
                  onClick={() => setField("trainingFrequencyRange", opt.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setField("trainingFrequencyRange", opt.value);
                    }
                  }}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>
          {freqError && <p style={errorStyle}>{error.message}</p>}

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={labelStyle} htmlFor="rollingStartDate">
              Rolling start date
            </label>
            <input
              id="rollingStartDate"
              type="date"
              value={form.rollingStartDate || ""}
              onChange={(e) => setField("rollingStartDate", e.target.value)}
              style={inputStyle(dateError)}
            />
            {dateError && <p style={errorStyle}>{error.message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
