import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { buildSchedule, todayISO, DAY_KEYS, prettyDate } from './trainingUtils';

const SL_CSS = `
.sl-shell {
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-family: var(--font-body);
  color: var(--text-1);
  max-width: 700px;
}

.sl-header {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.sl-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-1);
  margin: 0;
  flex: 1;
}

.sl-date-input {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--text-1);
  background: var(--surface-2);
  border: 1.5px solid var(--line-1);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  outline: none;
  color-scheme: dark;
  cursor: pointer;
}

.sl-date-input:focus {
  border-color: var(--accent-2);
}

.sl-day-label {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.sl-day-name {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-1);
}

.sl-rest-msg {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  padding: 24px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.sl-rest-label {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sl-override-btn {
  font-family: var(--font-body);
  font-size: 0.82rem;
  color: var(--accent-3);
  background: transparent;
  border: 1px solid var(--accent-2);
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  cursor: pointer;
  transition: background var(--motion-fast);
}

.sl-override-btn:hover {
  background: rgba(181,21,60,0.1);
}

.sl-ex-card {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.sl-ex-header {
  padding: 11px 14px 9px;
  border-bottom: 1px solid var(--line-1);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sl-ex-name {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-1);
}

.sl-ex-sub {
  font-size: 0.75rem;
  color: var(--text-3);
}

.sl-ex-targets {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.sl-ex-target {
  font-size: 0.72rem;
  color: var(--text-3);
  background: var(--surface-3);
  border: 1px solid var(--line-1);
  border-radius: 4px;
  padding: 2px 7px;
}

.sl-sets-table {
  width: 100%;
  border-collapse: collapse;
}

.sl-sets-table th {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  padding: 7px 14px;
  text-align: left;
  border-bottom: 1px solid var(--line-1);
  background: var(--surface-3);
}

.sl-sets-table td {
  padding: 6px 14px;
  border-bottom: 1px solid var(--line-1);
  vertical-align: middle;
}

.sl-sets-table tr:last-child td {
  border-bottom: none;
}

.sl-set-label {
  font-size: 0.78rem;
  color: var(--text-3);
  white-space: nowrap;
}

.sl-num-input {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--text-1);
  background: var(--surface-3);
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius-sm);
  padding: 5px 8px;
  width: 72px;
  outline: none;
  text-align: center;
  -moz-appearance: textfield;
  appearance: textfield;
}

.sl-num-input::-webkit-outer-spin-button,
.sl-num-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.sl-num-input:focus {
  border-color: var(--accent-2);
}

.sl-add-set-btn {
  font-family: var(--font-body);
  font-size: 0.78rem;
  color: var(--accent-3);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 7px 14px;
  text-align: left;
  transition: color var(--motion-fast);
}

.sl-add-set-btn:hover {
  color: var(--text-1);
}

.sl-remove-set-btn {
  font-size: 0.8rem;
  color: var(--text-3);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color var(--motion-fast), background var(--motion-fast);
}

.sl-remove-set-btn:hover {
  color: var(--bad);
  background: rgba(255,79,115,0.1);
}

.sl-save-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sl-save-btn {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  background: var(--accent-2);
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 24px;
  cursor: pointer;
  transition: background var(--motion-fast);
}

.sl-save-btn:hover:not(:disabled) {
  background: var(--accent-3);
}

.sl-save-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.sl-success {
  font-size: 0.85rem;
  color: var(--ok);
  background: rgba(40,183,141,0.1);
  border: 1px solid rgba(40,183,141,0.28);
  border-radius: var(--radius-sm);
  padding: 8px 14px;
}

.sl-error {
  font-size: 0.85rem;
  color: var(--accent-3);
  background: rgba(139,15,46,0.18);
  border: 1px solid var(--accent-1);
  border-radius: var(--radius-sm);
  padding: 8px 14px;
}

.sl-loading {
  font-size: 0.85rem;
  color: var(--text-3);
  padding: 2rem 0;
  text-align: center;
}

.sl-no-program {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  padding: 28px 20px;
  text-align: center;
  color: var(--text-3);
  font-size: 0.88rem;
  line-height: 1.6;
}
`;

export default function SessionLog() {
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [programDays, setProgramDays] = useState([]);
  const [allExercises, setAllExercises] = useState({}); // dayId -> pde[]

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [scheduledDay, setScheduledDay] = useState(null); // the splitDay for selected date
  const [isRestDay, setIsRestDay] = useState(false);
  const [overrideRest, setOverrideRest] = useState(false);

  // exerciseSets: { [pde.id]: [ { setNum, weight, reps } ] }
  const [exerciseSets, setExerciseSets] = useState({});
  const [pdeList, setPdeList] = useState([]); // exercises for the scheduled day

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Fetch program on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: sessionR } = await supabase.auth.getSession();
      const user = sessionR?.session?.user;
      if (!user) { setLoading(false); return; }

      const { data: prog } = await supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!prog) { setLoading(false); return; }
      setProgram(prog);

      const { data: days } = await supabase
        .from('training_program_days')
        .select('*')
        .eq('program_id', prog.id)
        .order('day_order');

      setProgramDays(days || []);
      setLoading(false);
    }
    init();
  }, []);

  // Resolve scheduled day whenever date or programDays change
  useEffect(() => {
    if (!program || !programDays.length) return;
    const schedule = buildSchedule(program, programDays, 60);
    const entry = schedule.find(e => e.date === selectedDate);
    if (!entry || !entry.isTraining) {
      setScheduledDay(null);
      setIsRestDay(true);
      setOverrideRest(false);
    } else {
      setScheduledDay(entry.splitDay);
      setIsRestDay(false);
      setOverrideRest(false);
    }
  }, [selectedDate, program, programDays]);

  // Fetch exercises for current scheduled day
  const fetchExercisesForDay = useCallback(async (dayId) => {
    if (!dayId) { setPdeList([]); setExerciseSets({}); return; }

    const { data: pdes } = await supabase
      .from('program_day_exercises')
      .select('*, exercises(id, name)')
      .eq('program_day_id', dayId)
      .order('order_index');

    const list = pdes || [];
    setPdeList(list);

    // Fetch last session logs for prefill
    const exerciseIds = list.map(p => p.exercise_id).filter(Boolean);
    let lastWeightByExId = {};

    if (exerciseIds.length) {
      const { data: lastLogs } = await supabase
        .from('session_exercise_logs')
        .select('exercise_id, weight_kg, reps, set_number, workout_sessions!inner(session_date)')
        .in('exercise_id', exerciseIds)
        .order('workout_sessions(session_date)', { ascending: false })
        .limit(100);

      // Group by exercise_id, pick most recent
      const seen = new Set();
      for (const log of lastLogs || []) {
        const key = `${log.exercise_id}-${log.set_number}`;
        if (!seen.has(key)) {
          seen.add(key);
          if (!lastWeightByExId[log.exercise_id]) lastWeightByExId[log.exercise_id] = {};
          lastWeightByExId[log.exercise_id][log.set_number] = { weight: log.weight_kg, reps: log.reps };
        }
      }
    }

    // Build initial sets
    const initialSets = {};
    for (const pde of list) {
      const lastForEx = lastWeightByExId[pde.exercise_id] || {};
      initialSets[pde.id] = [
        {
          setNum: 1,
          weight: lastForEx[1]?.weight ?? '',
          reps: '',
          target: `${pde.target_reps_min ?? '?'}–${pde.target_reps_max ?? '?'}`,
        },
        {
          setNum: 2,
          weight: lastForEx[2]?.weight ?? '',
          reps: '',
          target: `${pde.set_2_reps_min ?? '?'}–${pde.set_2_reps_max ?? '?'}`,
        },
      ];
    }
    setExerciseSets(initialSets);
  }, []);

  useEffect(() => {
    const dayId = scheduledDay?.id;
    fetchExercisesForDay(dayId);
  }, [scheduledDay, fetchExercisesForDay]);

  function updateSet(pdeId, setIdx, field, value) {
    setExerciseSets(prev => {
      const sets = [...(prev[pdeId] || [])];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      return { ...prev, [pdeId]: sets };
    });
  }

  function addSet(pdeId) {
    setExerciseSets(prev => {
      const sets = prev[pdeId] || [];
      const nextNum = sets.length + 1;
      return { ...prev, [pdeId]: [...sets, { setNum: nextNum, weight: '', reps: '', target: '' }] };
    });
  }

  function removeSet(pdeId, setIdx) {
    setExerciseSets(prev => {
      const sets = (prev[pdeId] || []).filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, setNum: i + 1 }));
      return { ...prev, [pdeId]: sets };
    });
  }

  async function handleSave() {
    if (!program) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: sessionR } = await supabase.auth.getSession();
      const user = sessionR?.session?.user;
      if (!user) throw new Error('Not authenticated');

      const dayId = scheduledDay?.id ?? null;

      // Upsert workout_sessions row
      const { data: wsRows, error: wsErr } = await supabase
        .from('workout_sessions')
        .upsert(
          {
            user_id: user.id,
            program_id: program.id,
            program_day_id: dayId,
            session_date: selectedDate,
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,session_date,program_id' }
        )
        .select();

      if (wsErr) throw new Error(wsErr.message);
      const ws = wsRows?.[0];
      if (!ws) throw new Error('Failed to create session record');

      // Delete existing logs for this session to allow re-saving
      await supabase.from('session_exercise_logs').delete().eq('workout_session_id', ws.id);

      // Insert set logs
      const logs = [];
      for (const pde of pdeList) {
        const sets = exerciseSets[pde.id] || [];
        const exName = pde.custom_name || pde.exercises?.name || 'Unknown';
        for (const s of sets) {
          const weight = parseFloat(s.weight);
          const reps = parseInt(s.reps, 10);
          if (!Number.isFinite(reps)) continue; // skip blank rows
          logs.push({
            workout_session_id: ws.id,
            exercise_id: pde.exercise_id,
            program_day_exercise_id: pde.id,
            exercise_name: exName,
            set_number: s.setNum,
            weight_kg: Number.isFinite(weight) ? weight : null,
            reps,
          });
        }
      }

      if (logs.length > 0) {
        const { error: logErr } = await supabase.from('session_exercise_logs').insert(logs);
        if (logErr) throw new Error(logErr.message);
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to save session.');
    } finally {
      setSaving(false);
    }
  }

  const showLog = !isRestDay || overrideRest;

  if (loading) {
    return (
      <>
        <style>{SL_CSS}</style>
        <div className="sl-shell"><div className="sl-loading">Loading…</div></div>
      </>
    );
  }

  if (!program) {
    return (
      <>
        <style>{SL_CSS}</style>
        <div className="sl-shell">
          <div className="sl-no-program">
            No active training program found.<br />
            Set up your programme in the Programme tab first.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{SL_CSS}</style>
      <div className="sl-shell">

        {/* Date picker */}
        <div className="sl-header">
          <h2 className="sl-title">Log Session</h2>
          <input
            type="date"
            className="sl-date-input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>

        {/* Day label */}
        <div className="sl-day-label">
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              {prettyDate(selectedDate)}
            </div>
            {scheduledDay ? (
              <div className="sl-day-name" style={{ color: scheduledDay.color || 'var(--text-1)' }}>
                {scheduledDay.day_name}
              </div>
            ) : (
              <div className="sl-day-name" style={{ color: 'var(--text-3)' }}>Rest Day</div>
            )}
          </div>
        </div>

        {/* Rest day message */}
        {isRestDay && !overrideRest && (
          <div className="sl-rest-msg">
            <div className="sl-rest-label">Rest Day</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', margin: 0 }}>
              This date is a rest day in your programme.
            </p>
            <button className="sl-override-btn" onClick={() => setOverrideRest(true)}>
              Log anyway
            </button>
          </div>
        )}

        {/* Exercise cards */}
        {showLog && pdeList.map(pde => {
          const exName = pde.custom_name || pde.exercises?.name || 'Unknown Exercise';
          const sets = exerciseSets[pde.id] || [];

          return (
            <div key={pde.id} className="sl-ex-card">
              <div className="sl-ex-header">
                <div className="sl-ex-name">{exName}</div>
                {pde.machine_name && (
                  <div className="sl-ex-sub">
                    {pde.machine_brand ? `${pde.machine_brand} — ` : ''}{pde.machine_name}
                  </div>
                )}
                <div className="sl-ex-targets">
                  {pde.target_reps_min && (
                    <span className="sl-ex-target">
                      Set 1: {pde.target_reps_min}–{pde.target_reps_max} reps
                    </span>
                  )}
                  {pde.set_2_reps_min && (
                    <span className="sl-ex-target">
                      Set 2: {pde.set_2_reps_min}–{pde.set_2_reps_max} reps
                    </span>
                  )}
                </div>
              </div>

              <table className="sl-sets-table">
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>Target</th>
                    <th>Weight (kg)</th>
                    <th>Reps</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((s, idx) => (
                    <tr key={idx}>
                      <td className="sl-set-label">#{s.setNum}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{s.target || '—'}</td>
                      <td>
                        <input
                          className="sl-num-input"
                          type="number"
                          min={0}
                          step={0.5}
                          value={s.weight}
                          onChange={e => updateSet(pde.id, idx, 'weight', e.target.value)}
                          placeholder="kg"
                        />
                      </td>
                      <td>
                        <input
                          className="sl-num-input"
                          type="number"
                          min={0}
                          value={s.reps}
                          onChange={e => updateSet(pde.id, idx, 'reps', e.target.value)}
                          placeholder="reps"
                        />
                      </td>
                      <td>
                        <button
                          className="sl-remove-set-btn"
                          onClick={() => removeSet(pde.id, idx)}
                          title="Remove set"
                        >×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button className="sl-add-set-btn" onClick={() => addSet(pde.id)}>
                + Add set
              </button>
            </div>
          );
        })}

        {/* No exercises for an override rest day */}
        {showLog && overrideRest && pdeList.length === 0 && (
          <div className="sl-no-program" style={{ padding: '16px 20px', textAlign: 'left' }}>
            No exercises defined for this day. You can still save the session to mark it as completed.
          </div>
        )}

        {/* Save */}
        {showLog && (
          <div className="sl-save-row">
            <button
              className="sl-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Session'}
            </button>
            {success && <span className="sl-success">Session saved!</span>}
            {error && <span className="sl-error">{error}</span>}
          </div>
        )}

      </div>
    </>
  );
}
