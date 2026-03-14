import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

const STYLE = `
.sb-shell {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 0;
  font-family: var(--font-body);
}

/* ── Header ── */
.sb-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.sb-header-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.sb-program-name {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-1);
  margin: 0;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  line-height: 1.2;
  word-break: break-word;
}

.sb-program-name:hover {
  color: var(--accent-3);
}

.sb-program-name-input {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-1);
  background: var(--surface-3);
  border: 1.5px solid var(--accent-2);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  outline: none;
  width: 100%;
  line-height: 1.2;
}

.sb-header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sb-badge {
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--text-3);
  border: 1px solid var(--line-1);
  white-space: nowrap;
}

.sb-badge-split {
  color: var(--text-2);
  background: transparent;
  border-color: var(--line-2);
}

.sb-delete-btn {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--bad);
  background: transparent;
  border: 1.5px solid var(--bad);
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  align-self: flex-start;
}

.sb-delete-btn:hover {
  background: var(--bad);
  color: #fff;
}

/* ── Section label ── */
.sb-section-label {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
  margin: 0 0 12px 0;
}

/* ── Day card ── */
.sb-day-card {
  border-radius: var(--radius-md);
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  overflow: hidden;
  border-left: 4px solid var(--accent-2);
  transition: border-color 0.15s;
}

.sb-day-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
  flex-wrap: wrap;
}

.sb-day-name-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sb-day-name {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-1);
  cursor: pointer;
  border: none;
  background: none;
  padding: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.sb-day-name-input {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-1);
  background: var(--surface-3);
  border: 1.5px solid var(--accent-2);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  outline: none;
  width: 160px;
}

.sb-muscle-pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.sb-muscle-pill {
  font-family: var(--font-display);
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--text-2);
  border: 1px solid var(--line-2);
  white-space: nowrap;
}

.sb-day-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sb-expand-btn {
  font-size: 0.8rem;
  color: var(--text-3);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  transition: color 0.15s;
}

.sb-expand-btn:hover {
  color: var(--text-1);
}

.sb-delete-day-btn {
  font-family: var(--font-body);
  font-size: 0.72rem;
  color: var(--bad);
  background: transparent;
  border: 1px solid var(--bad);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.sb-delete-day-btn:hover {
  background: var(--bad);
  color: #fff;
}

/* ── Day body ── */
.sb-day-body {
  padding: 0 14px 14px 14px;
  background: var(--surface-3);
  border-top: 1px solid var(--line-1);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sb-ex-subheading {
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  padding-top: 10px;
  margin: 0;
}

.sb-ex-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Exercise row ── */
.sb-ex-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  flex-wrap: wrap;
}

.sb-ex-name {
  font-family: var(--font-body);
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-1);
  flex: 1;
  min-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-ex-targets {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.sb-ex-targets-label {
  font-size: 0.72rem;
  color: var(--text-3);
  white-space: nowrap;
}

.sb-ex-input {
  font-family: var(--font-body);
  font-size: 0.78rem;
  color: var(--text-1);
  background: var(--surface-3);
  border: 1px solid var(--line-2);
  border-radius: 6px;
  padding: 2px 4px;
  width: 36px;
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.sb-ex-input::-webkit-outer-spin-button,
.sb-ex-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.sb-ex-input:focus {
  border-color: var(--accent-2);
}

.sb-ex-row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.sb-order-btn {
  font-size: 0.8rem;
  color: var(--text-3);
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 6px;
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1.2;
  transition: color 0.15s, border-color 0.15s;
}

.sb-order-btn:hover:not(:disabled) {
  color: var(--text-1);
  border-color: var(--line-2);
}

.sb-order-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.sb-remove-btn {
  font-size: 0.85rem;
  color: var(--text-3);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1.2;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}

.sb-remove-btn:hover {
  color: var(--bad);
  background: rgba(255, 79, 115, 0.1);
}

/* ── Add exercise panel ── */
.sb-add-ex-btn {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--accent-3);
  background: transparent;
  border: 1.5px dashed var(--accent-1);
  border-radius: var(--radius-sm);
  padding: 7px 14px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
  width: 100%;
}

.sb-add-ex-btn:hover {
  background: rgba(138, 15, 46, 0.15);
  border-color: var(--accent-2);
}

.sb-add-ex-panel {
  background: var(--surface-2);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sb-ex-search {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--text-1);
  background: var(--surface-3);
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.sb-ex-search:focus {
  border-color: var(--accent-2);
}

.sb-ex-search::placeholder {
  color: var(--text-3);
}

.sb-ex-results {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 220px;
  overflow-y: auto;
}

.sb-ex-result {
  font-family: var(--font-body);
  font-size: 0.82rem;
  color: var(--text-1);
  background: none;
  border: none;
  border-radius: 6px;
  padding: 7px 8px;
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.12s;
}

.sb-ex-result:hover {
  background: var(--surface-3);
}

.sb-ex-result-name {
  flex: 1;
  font-weight: 500;
}

.sb-ex-result-meta {
  font-size: 0.7rem;
  color: var(--text-3);
  white-space: nowrap;
}

.sb-ex-result-compound {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(138, 15, 46, 0.25);
  color: var(--accent-3);
  border: 1px solid var(--accent-1);
  white-space: nowrap;
}

.sb-add-ex-close-btn {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--text-3);
  background: none;
  border: none;
  cursor: pointer;
  align-self: flex-end;
  padding: 2px 4px;
}

.sb-add-ex-close-btn:hover {
  color: var(--text-1);
}

/* ── Add day button ── */
.sb-add-day-btn {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-2);
  background: transparent;
  border: 1.5px dashed var(--line-2);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  cursor: pointer;
  width: 100%;
  text-align: center;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.sb-add-day-btn:hover {
  border-color: var(--accent-2);
  color: var(--text-1);
  background: rgba(138, 15, 46, 0.08);
}

/* ── Settings section ── */
.sb-settings-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sb-settings-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sb-settings-field-label {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}

.sb-day-toggles {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sb-day-toggle {
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-3);
  background: var(--surface-3);
  border: 1.5px solid var(--line-1);
  border-radius: var(--radius-sm);
  padding: 6px 11px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  user-select: none;
}

.sb-day-toggle.active {
  background: var(--accent-1);
  border-color: var(--accent-2);
  color: var(--text-1);
}

.sb-date-input {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--text-1);
  background: var(--surface-3);
  border: 1.5px solid var(--line-1);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  outline: none;
  width: 200px;
  box-sizing: border-box;
  color-scheme: dark;
}

.sb-date-input:focus {
  border-color: var(--accent-2);
}

.sb-save-btn {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: var(--accent-2);
  border: none;
  border-radius: var(--radius-sm);
  padding: 9px 20px;
  cursor: pointer;
  transition: background 0.15s;
  align-self: flex-start;
}

.sb-save-btn:hover:not(:disabled) {
  background: var(--accent-3);
}

.sb-save-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.sb-days-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sb-empty-ex {
  font-size: 0.8rem;
  color: var(--text-3);
  text-align: center;
  padding: 10px 0 4px;
}

.sb-loading-ex {
  font-size: 0.8rem;
  color: var(--text-3);
  padding: 6px 0;
}

.sb-search-empty {
  font-size: 0.8rem;
  color: var(--text-3);
  padding: 8px;
  text-align: center;
}
`;

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ExerciseRow({ pde, index, total, dayId, onReorder, onRemove, onChange }) {
  const [sets, setSets] = useState(pde.target_sets ?? 2);
  const [repsMin, setRepsMin] = useState(pde.target_reps_min ?? 6);
  const [repsMax, setRepsMax] = useState(pde.target_reps_max ?? 9);
  const [set2Min, setSet2Min] = useState(pde.set_2_reps_min ?? 9);
  const [set2Max, setSet2Max] = useState(pde.set_2_reps_max ?? 12);
  const [rir, setRir] = useState(pde.target_rir ?? 2);
  const [machineBrand, setMachineBrand] = useState(pde.machine_brand ?? '');
  const [machineName, setMachineName] = useState(pde.machine_name ?? '');
  const [singleArm, setSingleArm] = useState(() => {
    const notes = pde.equipment_notes ?? '';
    return notes.startsWith('single-arm') || notes.startsWith('single-arm,single-leg');
  });
  const [singleLeg, setSingleLeg] = useState(() => {
    const notes = pde.equipment_notes ?? '';
    return notes.includes('single-leg');
  });
  const [equipmentNotes, setEquipmentNotes] = useState(() => {
    const notes = pde.equipment_notes ?? '';
    // Strip unilateral prefix from notes field
    return notes.replace(/^(single-arm,?|single-leg,?)+/g, '').replace(/^,/, '').trim();
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setSets(pde.target_sets ?? 2);
    setRepsMin(pde.target_reps_min ?? 6);
    setRepsMax(pde.target_reps_max ?? 9);
    setSet2Min(pde.set_2_reps_min ?? 9);
    setSet2Max(pde.set_2_reps_max ?? 12);
    setRir(pde.target_rir ?? 2);
    setMachineBrand(pde.machine_brand ?? '');
    setMachineName(pde.machine_name ?? '');
    const notes = pde.equipment_notes ?? '';
    setSingleArm(notes.startsWith('single-arm'));
    setSingleLeg(notes.includes('single-leg'));
    setEquipmentNotes(notes.replace(/^(single-arm,?|single-leg,?)+/g, '').replace(/^,/, '').trim());
  }, [pde.id]);

  function buildEquipmentNotes(arm, leg, notes) {
    const parts = [];
    if (arm) parts.push('single-arm');
    if (leg) parts.push('single-leg');
    if (notes.trim()) parts.push(notes.trim());
    return parts.join(',');
  }

  async function save(overrides = {}) {
    const arm = overrides.singleArm !== undefined ? overrides.singleArm : singleArm;
    const leg = overrides.singleLeg !== undefined ? overrides.singleLeg : singleLeg;
    const notes = overrides.equipmentNotes !== undefined ? overrides.equipmentNotes : equipmentNotes;
    await supabase
      .from('program_day_exercises')
      .update({
        target_sets: overrides.sets !== undefined ? overrides.sets : sets,
        target_reps_min: overrides.repsMin !== undefined ? overrides.repsMin : repsMin,
        target_reps_max: overrides.repsMax !== undefined ? overrides.repsMax : repsMax,
        set_2_reps_min: overrides.set2Min !== undefined ? overrides.set2Min : set2Min,
        set_2_reps_max: overrides.set2Max !== undefined ? overrides.set2Max : set2Max,
        target_rir: overrides.rir !== undefined ? overrides.rir : rir,
        machine_brand: overrides.machineBrand !== undefined ? overrides.machineBrand : machineBrand,
        machine_name: overrides.machineName !== undefined ? overrides.machineName : machineName,
        is_unilateral: arm || leg,
        equipment_notes: buildEquipmentNotes(arm, leg, notes),
      })
      .eq('id', pde.id);
    onChange();
  }

  const name = pde.custom_name || pde.exercises?.name || 'Unknown Exercise';

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line-1)', borderRadius: 'var(--radius-sm)', marginBottom: 2 }}>
      {/* Main row */}
      <div className="sb-ex-row" style={{ borderRadius: 0, border: 'none', marginBottom: 0 }}>
        <span className="sb-ex-name" title={name}>{name}</span>
        <div className="sb-ex-targets">
          <input
            className="sb-ex-input"
            type="number"
            min={1}
            max={20}
            value={sets}
            onChange={e => setSets(Number(e.target.value))}
            onBlur={() => save()}
            title="Sets"
          />
          <span className="sb-ex-targets-label">sets</span>
          <span className="sb-ex-targets-label" style={{ marginLeft: 4 }}>RIR</span>
          <input
            className="sb-ex-input"
            type="number"
            min={0}
            max={5}
            value={rir}
            onChange={e => setRir(Number(e.target.value))}
            onBlur={() => save()}
            title="RIR"
          />
        </div>
        <div className="sb-ex-row-actions">
          <button
            className="sb-order-btn"
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            title={expanded ? 'Collapse' : 'Expand details'}
            style={{ fontSize: '0.7rem', padding: '2px 7px' }}
          >{expanded ? '▲' : '▼'}</button>
          <button
            className="sb-order-btn"
            onClick={() => onReorder(dayId, index, -1)}
            disabled={index === 0}
            title="Move up"
          >↑</button>
          <button
            className="sb-order-btn"
            onClick={() => onReorder(dayId, index, 1)}
            disabled={index === total - 1}
            title="Move down"
          >↓</button>
          <button
            className="sb-remove-btn"
            onClick={() => onRemove(pde)}
            title="Remove"
          >×</button>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div style={{ padding: '8px 10px 10px', borderTop: '1px solid var(--line-1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Rep ranges row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Set 1:</span>
              <input
                className="sb-ex-input"
                type="number" min={1} max={50}
                value={repsMin}
                onChange={e => setRepsMin(Number(e.target.value))}
                onBlur={() => save()}
                title="Set 1 reps min"
              />
              <span className="sb-ex-targets-label">–</span>
              <input
                className="sb-ex-input"
                type="number" min={1} max={50}
                value={repsMax}
                onChange={e => setRepsMax(Number(e.target.value))}
                onBlur={() => save()}
                title="Set 1 reps max"
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>reps</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Set 2:</span>
              <input
                className="sb-ex-input"
                type="number" min={1} max={50}
                value={set2Min}
                onChange={e => setSet2Min(Number(e.target.value))}
                onBlur={() => save()}
                title="Set 2 reps min"
              />
              <span className="sb-ex-targets-label">–</span>
              <input
                className="sb-ex-input"
                type="number" min={1} max={50}
                value={set2Max}
                onChange={e => setSet2Max(Number(e.target.value))}
                onBlur={() => save()}
                title="Set 2 reps max"
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>reps</span>
            </div>
          </div>

          {/* Machine fields row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Machine brand:</span>
              <input
                style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-1)', background: 'var(--surface-3)', border: '1px solid var(--line-2)', borderRadius: 6, padding: '2px 6px', width: 90, outline: 'none' }}
                type="text"
                value={machineBrand}
                onChange={e => setMachineBrand(e.target.value)}
                onBlur={() => save()}
                placeholder="e.g. Life Fitness"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Machine name:</span>
              <input
                style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-1)', background: 'var(--surface-3)', border: '1px solid var(--line-2)', borderRadius: 6, padding: '2px 6px', width: 110, outline: 'none' }}
                type="text"
                value={machineName}
                onChange={e => setMachineName(e.target.value)}
                onBlur={() => save()}
                placeholder="e.g. Chest Press"
              />
            </div>
          </div>

          {/* Unilateral checkboxes */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={singleArm}
                onChange={e => {
                  setSingleArm(e.target.checked);
                  save({ singleArm: e.target.checked });
                }}
              />
              Single arm
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={singleLeg}
                onChange={e => {
                  setSingleLeg(e.target.checked);
                  save({ singleLeg: e.target.checked });
                }}
              />
              Single leg
            </label>
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Notes:</span>
            <input
              style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-1)', background: 'var(--surface-3)', border: '1px solid var(--line-2)', borderRadius: 6, padding: '2px 6px', flex: 1, outline: 'none', minWidth: 0 }}
              type="text"
              value={equipmentNotes}
              onChange={e => setEquipmentNotes(e.target.value)}
              onBlur={() => save()}
              placeholder="Optional notes"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AddExercisePanel({ dayId, currentCount, onClose, onAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('exercises')
        .select('id, name, is_compound, equipment, exercise_muscle_groups!exercises_primary_group_id_fkey(name)')
        .eq('is_global', true)
        .ilike('name', `%${query.trim()}%`)
        .limit(10);
      setResults(data || []);
      setSearching(false);
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function handleSelect(ex) {
    const nextOrderIndex = currentCount;
    await supabase.from('program_day_exercises').insert({
      program_day_id: dayId,
      exercise_id: ex.id,
      order_index: nextOrderIndex,
      target_sets: 2,
      target_reps_min: ex.is_compound ? 6 : 9,
      target_reps_max: ex.is_compound ? 9 : 12,
      set_2_reps_min: ex.is_compound ? 9 : 12,
      set_2_reps_max: ex.is_compound ? 12 : 15,
      target_rir: 2,
    });
    onAdded();
  }

  return (
    <div className="sb-add-ex-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Search Exercises
        </span>
        <button className="sb-add-ex-close-btn" onClick={onClose}>✕ Close</button>
      </div>
      <input
        ref={inputRef}
        className="sb-ex-search"
        type="text"
        placeholder="Search by name…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="sb-ex-results">
        {searching && <div className="sb-search-empty">Searching…</div>}
        {!searching && query.trim() && results.length === 0 && (
          <div className="sb-search-empty">No exercises found.</div>
        )}
        {results.map(ex => (
          <button key={ex.id} className="sb-ex-result" onClick={() => handleSelect(ex)}>
            <span className="sb-ex-result-name">{ex.name}</span>
            {ex.is_compound && <span className="sb-ex-result-compound">Compound</span>}
            {ex.equipment && <span className="sb-ex-result-meta">{ex.equipment}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function DayCard({ day, expanded, onToggle, dayExercises, loadingExercises, onLoadExercises, onExercisesChanged, onDeleteDay, onDayNameSaved }) {
  const [editingName, setEditingName] = useState(false);
  const [dayName, setDayName] = useState(day.day_name);
  const [addingExercise, setAddingExercise] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    setDayName(day.day_name);
  }, [day.day_name]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  function handleHeaderClick(e) {
    if (editingName) return;
    onToggle();
  }

  async function saveDayName() {
    setEditingName(false);
    const trimmed = dayName.trim() || day.day_name;
    setDayName(trimmed);
    if (trimmed === day.day_name) return;
    await supabase
      .from('training_program_days')
      .update({ day_name: trimmed })
      .eq('id', day.id);
    onDayNameSaved();
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') saveDayName();
    if (e.key === 'Escape') {
      setDayName(day.day_name);
      setEditingName(false);
    }
  }

  async function handleDeleteDay(e) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${day.day_name}"? All exercises in this day will be removed.`)) return;
    await supabase.from('training_program_days').delete().eq('id', day.id);
    onDeleteDay(day.id);
  }

  async function handleReorder(dayId, index, direction) {
    const exercises = [...(dayExercises || [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= exercises.length) return;
    const temp = exercises[index];
    exercises[index] = exercises[newIndex];
    exercises[newIndex] = temp;
    const updates = exercises.map((ex, i) => ({ id: ex.id, order_index: i }));
    for (const u of updates) {
      await supabase.from('program_day_exercises').update({ order_index: u.order_index }).eq('id', u.id);
    }
    onExercisesChanged(dayId);
  }

  async function handleRemoveExercise(pde) {
    const name = pde.custom_name || pde.exercises?.name || 'this exercise';
    if (!window.confirm(`Remove "${name}" from this day?`)) return;
    await supabase.from('program_day_exercises').delete().eq('id', pde.id);
    onExercisesChanged(day.id);
  }

  const exercises = dayExercises || [];
  const borderColor = day.color || '#b5153c';

  return (
    <div className="sb-day-card" style={{ borderLeftColor: borderColor }}>
      <div
        className="sb-day-header"
        onClick={handleHeaderClick}
        style={{ paddingBottom: expanded ? 10 : 12 }}
      >
        <div className="sb-day-name-wrap">
          {editingName ? (
            <input
              ref={nameInputRef}
              className="sb-day-name-input"
              value={dayName}
              onChange={e => setDayName(e.target.value)}
              onBlur={saveDayName}
              onKeyDown={handleNameKeyDown}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <button
              className="sb-day-name"
              title="Double-click to rename"
              onDoubleClick={e => { e.stopPropagation(); setEditingName(true); }}
              onClick={e => e.stopPropagation()}
            >
              {dayName}
            </button>
          )}
          {day.is_rest && (
            <span className="sb-badge" style={{ fontSize: '0.6rem' }}>Rest</span>
          )}
        </div>

        <div className="sb-muscle-pills">
          {(day.muscle_focus || []).map(m => (
            <span key={m} className="sb-muscle-pill">{m}</span>
          ))}
        </div>

        <div className="sb-day-header-actions" onClick={e => e.stopPropagation()}>
          <button
            className="sb-delete-day-btn"
            onClick={handleDeleteDay}
          >
            Delete
          </button>
          <button
            className="sb-expand-btn"
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="sb-day-body">
          <p className="sb-ex-subheading">Exercises</p>

          {loadingExercises ? (
            <div className="sb-loading-ex">Loading…</div>
          ) : (
            <div className="sb-ex-list">
              {exercises.length === 0 && !addingExercise && (
                <div className="sb-empty-ex">No exercises yet. Add one below.</div>
              )}
              {exercises.map((pde, i) => (
                <ExerciseRow
                  key={pde.id}
                  pde={pde}
                  index={i}
                  total={exercises.length}
                  dayId={day.id}
                  onReorder={handleReorder}
                  onRemove={handleRemoveExercise}
                  onChange={() => onExercisesChanged(day.id)}
                />
              ))}
            </div>
          )}

          {addingExercise ? (
            <AddExercisePanel
              dayId={day.id}
              currentCount={exercises.length}
              onClose={() => setAddingExercise(false)}
              onAdded={() => {
                setAddingExercise(false);
                onExercisesChanged(day.id);
              }}
            />
          ) : (
            <button
              className="sb-add-ex-btn"
              onClick={() => setAddingExercise(true)}
            >
              ＋ Add Exercise
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SplitBuilder({ program, programDays, profile, onUpdated }) {
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [dayExercises, setDayExercises] = useState({});
  const [loadingDays, setLoadingDays] = useState(new Set());

  const [editingProgramName, setEditingProgramName] = useState(false);
  const [programName, setProgramName] = useState(program.name);
  const nameInputRef = useRef(null);

  const [trainingDays, setTrainingDays] = useState(program.training_days || []);
  const [startDate, setStartDate] = useState(program.start_date || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProgramName(program.name);
    setTrainingDays(program.training_days || []);
    setStartDate(program.start_date || '');
  }, [program.id]);

  useEffect(() => {
    if (editingProgramName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingProgramName]);

  const loadDayExercises = useCallback(async (dayId, force = false) => {
    if (!force && dayExercises[dayId] !== undefined) return;
    setLoadingDays(prev => new Set(prev).add(dayId));
    const { data } = await supabase
      .from('program_day_exercises')
      .select('*, exercises(id, name, is_compound, equipment)')
      .eq('program_day_id', dayId)
      .order('order_index');
    setDayExercises(prev => ({ ...prev, [dayId]: data || [] }));
    setLoadingDays(prev => {
      const next = new Set(prev);
      next.delete(dayId);
      return next;
    });
  }, [dayExercises]);

  function toggleDay(dayId) {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) {
        next.delete(dayId);
      } else {
        next.add(dayId);
        loadDayExercises(dayId);
      }
      return next;
    });
  }

  function handleExercisesChanged(dayId) {
    setDayExercises(prev => {
      const next = { ...prev };
      delete next[dayId];
      return next;
    });
    loadDayExercises(dayId, true);
  }

  async function saveProgramName() {
    setEditingProgramName(false);
    const trimmed = programName.trim() || program.name;
    setProgramName(trimmed);
    if (trimmed === program.name) return;
    await supabase
      .from('training_programs')
      .update({ name: trimmed })
      .eq('id', program.id);
    onUpdated();
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') saveProgramName();
    if (e.key === 'Escape') {
      setProgramName(program.name);
      setEditingProgramName(false);
    }
  }

  async function handleDeleteProgram() {
    if (!window.confirm('Delete this program? This cannot be undone.')) return;
    await supabase.from('training_programs').delete().eq('id', program.id);
    onUpdated();
  }

  async function handleAddDay() {
    const newOrder = programDays.length;
    await supabase.from('training_program_days').insert({
      program_id: program.id,
      day_name: 'New Day',
      day_order: newOrder,
      is_rest: false,
      muscle_focus: [],
      color: '#b5153c',
    });
    onUpdated();
  }

  function handleDeleteDay(dayId) {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.delete(dayId);
      return next;
    });
    setDayExercises(prev => {
      const next = { ...prev };
      delete next[dayId];
      return next;
    });
    onUpdated();
  }

  function toggleTrainingDay(day) {
    setTrainingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  async function handleSaveSettings() {
    setSaving(true);
    await supabase
      .from('training_programs')
      .update({
        training_days: trainingDays,
        start_date: startDate || null,
      })
      .eq('id', program.id);
    setSaving(false);
    onUpdated();
  }

  const experienceLabel = program.experience_level
    ? program.experience_level.charAt(0).toUpperCase() + program.experience_level.slice(1)
    : null;

  const splitLabel = program.split_type
    ? program.split_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null;

  return (
    <>
      <style>{STYLE}</style>
      <div className="sb-shell">

        {/* ── Program Header ── */}
        <div className="sb-header">
          <div className="sb-header-left">
            {editingProgramName ? (
              <input
                ref={nameInputRef}
                className="sb-program-name-input"
                value={programName}
                onChange={e => setProgramName(e.target.value)}
                onBlur={saveProgramName}
                onKeyDown={handleNameKeyDown}
              />
            ) : (
              <button
                className="sb-program-name"
                title="Click to rename"
                onClick={() => setEditingProgramName(true)}
              >
                {programName}
              </button>
            )}
            <div className="sb-header-meta">
              {experienceLabel && (
                <span className="sb-badge">{experienceLabel}</span>
              )}
              {splitLabel && (
                <span className="sb-badge sb-badge-split">{splitLabel}</span>
              )}
            </div>
          </div>

          <button className="sb-delete-btn" onClick={handleDeleteProgram}>
            Delete Program
          </button>
        </div>

        {/* ── Training Days Section ── */}
        <div>
          <p className="sb-section-label">◈ TRAINING DAYS</p>
          <div className="sb-days-list">
            {programDays.map(day => (
              <DayCard
                key={day.id}
                day={day}
                expanded={expandedDays.has(day.id)}
                onToggle={() => toggleDay(day.id)}
                dayExercises={dayExercises[day.id]}
                loadingExercises={loadingDays.has(day.id)}
                onLoadExercises={loadDayExercises}
                onExercisesChanged={handleExercisesChanged}
                onDeleteDay={handleDeleteDay}
                onDayNameSaved={onUpdated}
              />
            ))}
            <button className="sb-add-day-btn" onClick={handleAddDay}>
              ＋ Add Training Day
            </button>
          </div>
        </div>

        {/* ── Program Settings Section ── */}
        <div>
          <p className="sb-section-label">◈ PROGRAM SETTINGS</p>
          <div className="sb-settings-grid">

            <div className="sb-settings-field">
              <span className="sb-settings-field-label">Training Days</span>
              <div className="sb-day-toggles">
                {WEEK_DAYS.map(d => (
                  <button
                    key={d}
                    className={`sb-day-toggle${trainingDays.includes(d) ? ' active' : ''}`}
                    onClick={() => toggleTrainingDay(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="sb-settings-field">
              <span className="sb-settings-field-label">Start Date</span>
              <input
                className="sb-date-input"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <button
              className="sb-save-btn"
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

          </div>
        </div>

      </div>
    </>
  );
}
