import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

const STYLES = `
  .as-shell {
    min-height: 100dvh;
    background: var(--surface-2);
    color: var(--text-1);
    font-family: var(--font-body);
    display: flex;
    flex-direction: column;
  }

  .as-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(20, 12, 16, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line-1);
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 56px;
  }

  .as-header-exit-btn {
    background: none;
    border: 1px solid var(--line-2);
    color: var(--text-2);
    border-radius: var(--radius-sm);
    padding: 6px 12px;
    font-family: var(--font-body);
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s, color 0.15s;
  }
  .as-header-exit-btn:hover {
    border-color: var(--bad);
    color: var(--bad);
  }

  .as-header-center {
    flex: 1;
    text-align: center;
    min-width: 0;
  }
  .as-header-center-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .as-header-center-date {
    font-size: 11px;
    color: var(--text-3);
    margin-top: 1px;
  }

  .as-timer {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-2);
    white-space: nowrap;
    letter-spacing: 0.04em;
    min-width: 60px;
    text-align: right;
  }

  .as-progress-bar {
    height: 3px;
    width: 100%;
  }

  .as-exercises {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 0;
  }

  .as-ex-card {
    background: var(--surface-3);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .as-ex-header {
    padding: 12px 14px 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--line-1);
  }
  .as-ex-name {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    flex: 1;
    min-width: 0;
  }

  .as-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 99px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .as-badge-compound {
    background: rgba(122, 13, 13, 0.3);
    color: var(--accent-3);
    border: 1px solid var(--accent-1);
  }
  .as-badge-isolation {
    background: rgba(47, 26, 34, 0.6);
    color: var(--text-3);
    border: 1px solid var(--line-2);
  }

  .as-ex-target {
    padding: 6px 14px 8px;
    font-size: 12px;
    color: var(--text-3);
    border-bottom: 1px solid var(--line-1);
  }

  .as-set-table {
    width: 100%;
    border-collapse: collapse;
  }
  .as-set-table thead tr th {
    padding: 6px 4px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: center;
    border-bottom: 1px solid var(--line-1);
    background: rgba(20, 12, 16, 0.4);
  }
  .as-set-table thead tr th:first-child {
    padding-left: 10px;
    text-align: left;
    width: 28px;
  }
  .as-set-table thead tr th:last-child {
    padding-right: 6px;
  }

  .as-set-row {
    border-bottom: 1px solid var(--line-1);
  }
  .as-set-row:last-child {
    border-bottom: none;
  }
  .as-set-row.as-set-row--saved {
    background: rgba(40, 183, 141, 0.05);
  }
  .as-set-row td {
    padding: 5px 3px;
    vertical-align: middle;
    text-align: center;
  }
  .as-set-row td:first-child {
    padding-left: 10px;
    text-align: left;
  }
  .as-set-row td:last-child {
    padding-right: 6px;
  }

  .as-set-num {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    min-width: 18px;
  }

  .as-set-input {
    background: var(--surface-2);
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 13px;
    padding: 4px 5px;
    text-align: center;
    width: 52px;
    transition: border-color 0.15s;
    -moz-appearance: textfield;
  }
  .as-set-input::-webkit-outer-spin-button,
  .as-set-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .as-set-input:focus {
    outline: none;
    border-color: var(--accent-2);
  }
  .as-set-input--notes {
    width: 80px;
    text-align: left;
    font-size: 11px;
  }

  .as-set-select {
    background: var(--surface-2);
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 12px;
    padding: 4px 3px;
    width: 46px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .as-set-select:focus {
    outline: none;
    border-color: var(--accent-2);
  }

  .as-set-log-btn {
    background: var(--accent-1);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    padding: 5px 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .as-set-log-btn:hover {
    background: var(--accent-2);
  }
  .as-set-log-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .as-set-logged {
    color: var(--ok);
    font-size: 16px;
    line-height: 1;
  }

  .as-ex-actions {
    display: flex;
    gap: 8px;
    padding: 8px 10px 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .as-add-set-btn {
    background: rgba(122, 13, 13, 0.18);
    border: 1px solid var(--accent-1);
    border-radius: var(--radius-sm);
    color: var(--accent-3);
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .as-add-set-btn:hover {
    background: rgba(165, 21, 21, 0.28);
  }

  .as-fill-btn {
    background: none;
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    color: var(--text-3);
    font-family: var(--font-body);
    font-size: 11px;
    padding: 6px 10px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .as-fill-btn:hover {
    border-color: var(--text-3);
    color: var(--text-2);
  }

  .as-footer {
    position: sticky;
    bottom: 0;
    background: rgba(20, 12, 16, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid var(--line-1);
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 16px;
  }

  .as-session-notes {
    background: var(--surface-3);
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 13px;
    padding: 9px 12px;
    resize: none;
    width: 100%;
    box-sizing: border-box;
    min-height: 60px;
  }
  .as-session-notes::placeholder {
    color: var(--text-3);
  }
  .as-session-notes:focus {
    outline: none;
    border-color: var(--accent-2);
  }

  .as-complete-btn {
    background: var(--accent-2);
    border: none;
    border-radius: var(--radius-md);
    color: #fff;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    padding: 14px 20px;
    cursor: pointer;
    width: 100%;
    letter-spacing: 0.03em;
    transition: background 0.15s, box-shadow 0.15s;
  }
  .as-complete-btn:hover {
    background: var(--accent-3);
    box-shadow: 0 0 22px rgba(204, 32, 32, 0.55);
  }
  .as-complete-btn:disabled {
    opacity: 0.5;
    cursor: default;
    box-shadow: none;
  }

  .as-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-3);
    font-size: 14px;
    gap: 10px;
  }

  .as-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--line-2);
    border-top-color: var(--accent-2);
    border-radius: 50%;
    animation: as-spin 0.7s linear infinite;
  }
  @keyframes as-spin {
    to { transform: rotate(360deg); }
  }
`;

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function makeEmptyRow(overrides = {}) {
  return {
    weight_kg: '',
    reps: '',
    rir: '',
    execution_score: '',
    notes: '',
    saved: false,
    ...overrides,
  };
}

export default function ActiveSession({ programDay, sessionDate, program, onExit }) {
  const [exercises, setExercises] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [logs, setLogs] = useState({});
  const [lastSessionData, setLastSessionData] = useState({});
  const [hasLastSession, setHasLastSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');
  const timerRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Keep sessionIdRef in sync for cleanup
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data: sessionR } = await supabase.auth.getSession(); const user = sessionR?.session?.user;
        if (!user || cancelled) return;

        // 1. Fetch program_day_exercises with exercise join
        const { data: pdes, error: pdeErr } = await supabase
          .from('program_day_exercises')
          .select('*, exercises(id, name, is_compound, equipment)')
          .eq('program_day_id', programDay.id)
          .order('order_index');

        if (pdeErr || cancelled) return;

        // 2. Fetch last session logs for pre-fill
        const { data: lastSession } = await supabase
          .from('workout_sessions')
          .select('id')
          .eq('program_day_id', programDay.id)
          .not('completed_at', 'is', null)
          .order('session_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        let lastLogsMap = {};
        if (lastSession) {
          const { data: lastLogs } = await supabase
            .from('session_exercise_logs')
            .select('*')
            .eq('workout_session_id', lastSession.id);

          if (lastLogs) {
            // Group by program_day_exercise_id, sorted by set_number
            lastLogs.forEach(log => {
              const key = log.program_day_exercise_id;
              if (!lastLogsMap[key]) lastLogsMap[key] = [];
              lastLogsMap[key].push(log);
            });
            Object.keys(lastLogsMap).forEach(key => {
              lastLogsMap[key].sort((a, b) => a.set_number - b.set_number);
            });
          }
        }

        if (cancelled) return;

        // 3. Create workout_session row
        const { data: session, error: sessionErr } = await supabase
          .from('workout_sessions')
          .insert({
            user_id: user.id,
            program_day_id: programDay.id,
            program_id: program.id,
            session_date: sessionDate,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (sessionErr || cancelled) return;

        // Build initial logs state — one empty row per exercise
        const initialLogs = {};
        pdes.forEach(pde => {
          const lastRows = lastLogsMap[pde.id];
          const firstLast = lastRows ? lastRows[0] : null;
          initialLogs[pde.id] = [
            makeEmptyRow(firstLast ? {
              weight_kg: firstLast.weight_kg != null ? String(firstLast.weight_kg) : '',
              reps: firstLast.reps != null ? String(firstLast.reps) : '',
              rir: firstLast.rir != null ? String(firstLast.rir) : '',
              execution_score: firstLast.execution_score != null ? String(firstLast.execution_score) : '',
            } : {})
          ];
        });

        setExercises(pdes || []);
        setLastSessionData(lastLogsMap);
        setHasLastSession(!!lastSession);
        setSessionId(session.id);
        setLogs(initialLogs);
        setLoading(false);

        // Start timer
        timerRef.current = setInterval(() => {
          setElapsed(prev => prev + 1);
        }, 1000);

      } catch (err) {
        console.error('ActiveSession init error:', err);
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [programDay.id, program.id, sessionDate]);

  // --- Log row field change ---
  const handleRowChange = useCallback((pdeId, rowIndex, field, value) => {
    setLogs(prev => {
      const rows = [...(prev[pdeId] || [])];
      rows[rowIndex] = { ...rows[rowIndex], [field]: value };
      return { ...prev, [pdeId]: rows };
    });
  }, []);

  // --- Add set ---
  const handleAddSet = useCallback((pde) => {
    setLogs(prev => {
      const rows = prev[pde.id] || [];
      let prefill = {};
      if (rows.length > 0) {
        const last = rows[rows.length - 1];
        prefill = {
          weight_kg: last.weight_kg,
          reps: last.reps,
          rir: last.rir,
          execution_score: last.execution_score,
        };
      } else {
        const lastRows = lastSessionData[pde.id];
        if (lastRows && lastRows.length > 0) {
          const first = lastRows[0];
          prefill = {
            weight_kg: first.weight_kg != null ? String(first.weight_kg) : '',
            reps: first.reps != null ? String(first.reps) : '',
            rir: first.rir != null ? String(first.rir) : '',
            execution_score: first.execution_score != null ? String(first.execution_score) : '',
          };
        }
      }
      return { ...prev, [pde.id]: [...rows, makeEmptyRow(prefill)] };
    });
  }, [lastSessionData]);

  // --- Fill from last session ---
  const handleFillFromLast = useCallback((pde) => {
    const lastRows = lastSessionData[pde.id];
    if (!lastRows || lastRows.length === 0) return;
    setLogs(prev => {
      const newRows = lastRows.map(lr => makeEmptyRow({
        weight_kg: lr.weight_kg != null ? String(lr.weight_kg) : '',
        reps: lr.reps != null ? String(lr.reps) : '',
        rir: lr.rir != null ? String(lr.rir) : '',
        execution_score: lr.execution_score != null ? String(lr.execution_score) : '',
        notes: lr.notes || '',
      }));
      return { ...prev, [pde.id]: newRows };
    });
  }, [lastSessionData]);

  // --- Log a set ---
  const handleLogSet = useCallback(async (pde, rowIndex) => {
    if (!sessionId) return;
    const rows = logs[pde.id] || [];
    const row = rows[rowIndex];
    if (!row) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('session_exercise_logs').insert({
        workout_session_id: sessionId,
        program_day_exercise_id: pde.id,
        exercise_id: pde.exercise_id,
        exercise_name: pde.exercises?.name,
        set_number: rowIndex + 1,
        weight_kg: parseFloat(row.weight_kg) || null,
        reps: parseInt(row.reps) || null,
        rir: row.rir !== '' ? parseInt(row.rir) : null,
        execution_score: parseInt(row.execution_score) || null,
        notes: row.notes || null,
      });

      if (!error) {
        setLogs(prev => {
          const updated = [...(prev[pde.id] || [])];
          updated[rowIndex] = { ...updated[rowIndex], saved: true };
          return { ...prev, [pde.id]: updated };
        });
      } else {
        console.error('Error logging set:', error);
      }
    } catch (err) {
      console.error('handleLogSet error:', err);
    } finally {
      setSaving(false);
    }
  }, [sessionId, logs]);

  // --- Complete session ---
  const handleComplete = useCallback(async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      await supabase
        .from('workout_sessions')
        .update({
          completed_at: new Date().toISOString(),
          duration_minutes: Math.round(elapsed / 60),
          notes: sessionNotes || null,
        })
        .eq('id', sessionId);

      // Notify HabitsTracker to re-sync inherited habits
      window.dispatchEvent(new CustomEvent('pp_habits_sync'));

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      onExit();
    } catch (err) {
      console.error('handleComplete error:', err);
    } finally {
      setSaving(false);
    }
  }, [sessionId, elapsed, sessionNotes, onExit]);

  // --- Exit without completing ---
  const handleExit = useCallback(() => {
    const ok = window.confirm(
      'Are you sure? Your progress will be saved but the session won\'t be marked complete.'
    );
    if (ok) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      onExit();
    }
  }, [onExit]);

  const barColor = programDay.color || 'var(--accent-2)';

  return (
    <>
      <style>{STYLES}</style>
      <div className="as-shell">
        {/* Header */}
        <div className="as-header">
          <button className="as-header-exit-btn" onClick={handleExit}>
            ✕ Exit
          </button>
          <div className="as-header-center">
            <div className="as-header-center-title">{programDay.day_name}</div>
            <div className="as-header-center-date">{formatDate(sessionDate)}</div>
          </div>
          <div className="as-timer">{formatElapsed(elapsed)}</div>
        </div>

        {/* Progress bar */}
        <div
          className="as-progress-bar"
          style={{ background: `linear-gradient(90deg, ${barColor} 0%, ${barColor}88 100%)` }}
        />

        {/* Content */}
        {loading ? (
          <div className="as-loading">
            <div className="as-spinner" />
            Loading session…
          </div>
        ) : (
          <div className="as-exercises">
            {exercises.map(pde => {
              const exRows = logs[pde.id] || [];
              const lastRows = lastSessionData[pde.id];
              const hasLast = hasLastSession && lastRows && lastRows.length > 0;
              const isCompound = pde.exercises?.is_compound;
              const exName = pde.custom_name || pde.exercises?.name || 'Exercise';

              return (
                <div className="as-ex-card" key={pde.id}>
                  <div className="as-ex-header">
                    <span className="as-ex-name">{exName}</span>
                    <span className={`as-badge ${isCompound ? 'as-badge-compound' : 'as-badge-isolation'}`}>
                      {isCompound ? 'Compound' : 'Isolation'}
                    </span>
                  </div>

                  <div className="as-ex-target">
                    Target: {pde.target_sets}×{pde.target_reps_min}
                    {pde.target_reps_max && pde.target_reps_max !== pde.target_reps_min
                      ? `–${pde.target_reps_max}`
                      : ''
                    }
                    {' '}@ RIR {pde.target_rir ?? '—'}
                    {pde.notes ? ` · ${pde.notes}` : ''}
                  </div>

                  <table className="as-set-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Set</th>
                        <th>kg</th>
                        <th>Reps</th>
                        <th>RIR</th>
                        <th>Exec</th>
                        <th>Notes</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {exRows.map((row, ri) => (
                        <tr
                          key={ri}
                          className={`as-set-row${row.saved ? ' as-set-row--saved' : ''}`}
                        >
                          <td>
                            <span className="as-set-num">{ri + 1}</span>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="as-set-input"
                              placeholder="—"
                              value={row.weight_kg}
                              onChange={e => handleRowChange(pde.id, ri, 'weight_kg', e.target.value)}
                              disabled={row.saved}
                              step="0.5"
                              min="0"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="as-set-input"
                              placeholder="—"
                              value={row.reps}
                              onChange={e => handleRowChange(pde.id, ri, 'reps', e.target.value)}
                              disabled={row.saved}
                              min="0"
                            />
                          </td>
                          <td>
                            <select
                              className="as-set-select"
                              value={row.rir}
                              onChange={e => handleRowChange(pde.id, ri, 'rir', e.target.value)}
                              disabled={row.saved}
                            >
                              <option value="">—</option>
                              {[0, 1, 2, 3, 4, 5].map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="as-set-select"
                              value={row.execution_score}
                              onChange={e => handleRowChange(pde.id, ri, 'execution_score', e.target.value)}
                              disabled={row.saved}
                              title="1 = terrible, 10 = perfect"
                            >
                              <option value="">—</option>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="as-set-input as-set-input--notes"
                              placeholder="notes"
                              value={row.notes}
                              onChange={e => handleRowChange(pde.id, ri, 'notes', e.target.value)}
                              disabled={row.saved}
                            />
                          </td>
                          <td>
                            {row.saved ? (
                              <span className="as-set-logged" title="Logged">✓</span>
                            ) : (
                              <button
                                className="as-set-log-btn"
                                onClick={() => handleLogSet(pde, ri)}
                                disabled={saving || !sessionId}
                              >
                                Log
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="as-ex-actions">
                    <button className="as-add-set-btn" onClick={() => handleAddSet(pde)}>
                      ＋ Add Set
                    </button>
                    {hasLast && (
                      <button className="as-fill-btn" onClick={() => handleFillFromLast(pde)}>
                        ↶ Fill from last session
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Spacer so footer doesn't cover last card */}
            <div style={{ height: 8 }} />
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="as-footer">
            <textarea
              className="as-session-notes"
              placeholder="Session notes (optional)…"
              value={sessionNotes}
              onChange={e => setSessionNotes(e.target.value)}
              rows={2}
            />
            <button
              className="as-complete-btn"
              onClick={handleComplete}
              disabled={saving || !sessionId}
            >
              {saving ? 'Saving…' : 'Complete Session'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
