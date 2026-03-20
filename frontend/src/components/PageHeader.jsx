/**
 * PageHeader — shared page header used across every page in the app.
 *
 * Props:
 *   title : string    — page name, displayed uppercase with ◈ prefix (e.g. "TRAINING")
 *   right : ReactNode — optional; tabs, badges, or status indicators on the right
 */
export default function PageHeader({ title, right }) {
  return (
    <>
      <style>{CSS}</style>
      <div className="ph-wrap">
        <span className="ph-title">
          <span className="ph-bar" />
          {title}
        </span>
        {right && <div className="ph-right">{right}</div>}
      </div>
    </>
  );
}

/* Shared tab helpers — import these alongside PageHeader when a page has tabs */
export function PageTabs({ tabs, active, onChange }) {
  return (
    <>
      {tabs.map(([key, label]) => (
        <button
          key={key}
          className={`ph-tab${active === key ? " ph-tab--active" : ""}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </>
  );
}

const CSS = `
  .ph-wrap { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; }
  .ph-title { font-family:var(--font-display); font-size:1rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--accent-3); display:flex; align-items:center; gap:0.55rem; }
  .ph-bar { display:inline-block; width:28px; height:2px; background:var(--accent-1); border-radius:999px; flex-shrink:0; }
  .ph-right { display:flex; gap:0.25rem; align-items:center; flex-wrap:wrap; }
  .ph-tab { background:transparent; border:1px solid var(--line-1); color:var(--text-3); cursor:pointer; font-size:0.72rem; font-family:var(--font-display); letter-spacing:0.1em; padding:0.4rem 0.9rem; border-radius:var(--radius-sm); transition:all var(--motion-fast); white-space:nowrap; }
  .ph-tab:hover { border-color:var(--line-2); color:var(--text-2); }
  .ph-tab--active { background:var(--surface-3); border-color:var(--accent-2); color:var(--text-1); box-shadow:0 0 10px rgba(204,32,32,0.12); }
`;
