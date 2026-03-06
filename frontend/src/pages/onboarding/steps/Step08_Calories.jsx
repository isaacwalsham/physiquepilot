const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "1.75rem",
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
  flex: 1,
  userSelect: "none",
  WebkitUserSelect: "none",
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

const errorStyle = {
  color: "var(--bad)",
  fontSize: "0.8rem",
  marginTop: "0.4rem",
};

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  color: "var(--text-2)",
  marginBottom: "0.4rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

// --- Preview panel styles ---

const previewPanelStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--line-1)",
  borderRadius: "var(--radius-md)",
  padding: "1.25rem 1.5rem",
  marginBottom: "1.75rem",
};

const previewTitleStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.75rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: "0.75rem",
};

const previewKcalStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "2rem",
  fontWeight: 700,
  color: "var(--text-1)",
  letterSpacing: "-0.02em",
  marginBottom: "1rem",
};

const previewKcalUnitStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "1rem",
  fontWeight: 400,
  color: "var(--text-3)",
  marginLeft: "0.3rem",
};

const dividerStyle = {
  border: "none",
  borderTop: "1px solid var(--line-1)",
  margin: "0 0 0.75rem 0",
};

const macroRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  marginBottom: "0.6rem",
};

const macroNameStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  color: "var(--text-2)",
  width: "3.5rem",
  flexShrink: 0,
};

const macroGStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  color: "var(--text-1)",
  fontWeight: 600,
  width: "2.5rem",
  flexShrink: 0,
  textAlign: "right",
};

const macroBarTrackStyle = {
  flex: 1,
  height: "6px",
  background: "var(--line-1)",
  borderRadius: "3px",
  overflow: "hidden",
};

function MacroBar({ grams, calories, totalCalories, color }) {
  const pct = totalCalories > 0 ? Math.min(100, (calories / totalCalories) * 100) : 0;
  return (
    <div style={macroBarTrackStyle}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: "3px",
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

function PreviewPanel({ preview }) {
  if (!preview) return null;
  const { calories, proteinG, carbsG, fatG } = preview;
  const proteinCal = proteinG * 4;
  const carbsCal = carbsG * 4;
  const fatCal = fatG * 9;

  return (
    <div style={previewPanelStyle}>
      <p style={previewTitleStyle}>Your estimated targets</p>
      <hr style={dividerStyle} />
      <div style={previewKcalStyle}>
        {calories != null ? calories.toLocaleString() : "—"}
        <span style={previewKcalUnitStyle}>kcal</span>
      </div>

      <div style={macroRowStyle}>
        <span style={macroNameStyle}>Protein</span>
        <span style={macroGStyle}>{proteinG != null ? `${proteinG}g` : "—"}</span>
        <MacroBar grams={proteinG} calories={proteinCal} totalCalories={calories} color="var(--accent-2)" />
      </div>

      <div style={macroRowStyle}>
        <span style={macroNameStyle}>Carbs</span>
        <span style={macroGStyle}>{carbsG != null ? `${carbsG}g` : "—"}</span>
        <MacroBar grams={carbsG} calories={carbsCal} totalCalories={calories} color="#c97a2f" />
      </div>

      <div style={macroRowStyle}>
        <span style={macroNameStyle}>Fats</span>
        <span style={macroGStyle}>{fatG != null ? `${fatG}g` : "—"}</span>
        <MacroBar grams={fatG} calories={fatCal} totalCalories={calories} color="#7a9abf" />
      </div>
    </div>
  );
}

// --- Card option styles ---

const cardTitleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  marginBottom: "0.3rem",
};

const cardDescStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  color: "var(--text-3)",
  lineHeight: 1.45,
};

const rowStyle = {
  display: "flex",
  gap: "1rem",
  marginBottom: "1.25rem",
};

const OPTIONS = [
  {
    value: "auto",
    title: "AI-calculated",
    desc: "We calculate and adjust your targets automatically",
  },
  {
    value: "custom",
    title: "Custom",
    desc: "Set your own calorie target",
  },
];

export default function Step08_Calories({
  form,
  setField,
  error,
  preview,
  onAutoAdvance,
}) {
  const hasCalorieError = error && error.field === "customCalories";
  const hasModeError = error && error.field === "calorieMode";

  function handleSelect(value) {
    setField("calorieMode", value);
    if (value === "auto" && onAutoAdvance) {
      setTimeout(() => onAutoAdvance(), 180);
    }
  }

  return (
    <div>
      <h1 style={titleStyle}>How would you like your calories set?</h1>

      <PreviewPanel preview={preview} />

      <div style={rowStyle}>
        {OPTIONS.map((opt) => (
          <div
            key={opt.value}
            style={cardStyle(form.calorieMode === opt.value)}
            onClick={() => handleSelect(opt.value)}
            role="button"
            tabIndex={0}
            aria-pressed={form.calorieMode === opt.value}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelect(opt.value);
              }
            }}
          >
            <div style={cardTitleStyle}>{opt.title}</div>
            <div style={cardDescStyle}>{opt.desc}</div>
          </div>
        ))}
      </div>

      {hasModeError && (
        <p style={errorStyle}>{error.message}</p>
      )}

      {form.calorieMode === "custom" && (
        <div>
          <label style={labelStyle} htmlFor="customCalories">
            Daily calories (kcal)
          </label>
          <input
            id="customCalories"
            type="number"
            inputMode="numeric"
            min="1200"
            max="6000"
            step="10"
            value={form.customCalories || ""}
            onChange={(e) => setField("customCalories", e.target.value)}
            placeholder="e.g. 2000"
            style={inputStyle(hasCalorieError)}
          />
          {hasCalorieError && (
            <p style={errorStyle}>{error.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
