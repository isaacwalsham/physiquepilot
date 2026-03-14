import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { prettyDate } from './trainingUtils';

const SH_CSS = `
.sh-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: var(--font-body);
  color: var(--text-1);
  max-width: 760px;
}

.sh-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-1);
  margin: 0 0 6px;
}

.sh-session-row {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--motion-fast);
}

.sh-session-row.open {
  border-color: var(--line-2);
}

.sh-session-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
}

.sh-session-date {
  font-size: 0.78rem;
  color: var(--text-3);
  min-width: 90px;
  white-space: nowrap;
}

.sh-session-name {
  flex: 1;
  font-family: var(--font-display);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sh-session-meta {
  font-size: 0.72rem;
  color: var(--text-3);
  white-space: nowrap;
}

.sh-chevron {
  font-size: 0.8rem;
  color: var(--text-3);
  flex-shrink: 0;
  transition: transform var(--motion-fast);
}

.sh-session-row.open .sh-chevron {
  transform: rotate(180deg);
}

.sh-session-body {
  border-top: 1px solid var(--line-1);
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--surface-3);
}

.sh-ex-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sh-ex-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sh-ex-name {
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-1);
  flex: 1;
}

.sh-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.sh-badge-up {
  background: rgba(40,183,141,0.15);
  color: #28b78d;
  border: 1px solid rgba(40,183,141,0.3);
}

.sh-badge-maintain {
  background: var(--surface-2);
  color: var(--text-3);
  border: 1px solid var(--line-2);
}

.sh-badge-down {
  background: rgba(181,21,60,0.15);
  color: var(--accent-3);
  border: 1px solid rgba(181,21,60,0.3);
}

.sh-mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.sh-mini-table th {
  font-family: var(--font-display);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid var(--line-1);
}

.sh-mini-table td {
  padding: 4px 8px;
  color: var(--text-2);
  border-bottom: 1px solid var(--line-1);
  white-space: nowrap;
}

.sh-mini-table tr:last-child td {
  border-bottom: none;
}

.sh-mini-table .sh-td-date {
  color: var(--text-3);
  font-size: 0.7rem;
}

.sh-loading {
  font-size: 0.85rem;
  color: var(--text-3);
  padding: 2rem 0;
  text-align: center;
}

.sh-empty {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  padding: 28px 20px;
  text-align: center;
  color: var(--text-3);
  font-size: 0.88rem;
}
`;

// Compute progression badge for an exercise given its logs across sessions
// logs: [ { date, sets: [{setNum, weight_kg, reps}], targets: {target_reps_min, target_reps_max, set_2_reps_min, set_2_reps_max} } ]
function computeProgressionBadge(recentSessions) {
  if (!recentSessions || recentSessions.length < 1) return null;

  const targets = recentSessions[0]?.targets;
  if (!targets || targets.target_reps_min == null) return null;

  const { target_reps_min, target_reps_max, set_2_reps_min, set_2_reps_max } = targets;

  // Check last session for reduce: majority of sets missed minimum
  const last = recentSessions[0];
  const lastSets = last.sets || [];
  if (lastSets.length > 0) {
    let missedMin = 0;
    for (const s of lastSets) {
      const min = s.set_number === 1 ? (target_reps_min ?? 0) : (set_2_reps_min ?? target_reps_min ?? 0);
      if (s.reps != null && s.reps < min) missedMin++;
    }
    if (missedMin > lastSets.length / 2) {
      return { type: 'down', label: '↓ Reduce weight' };
    }
  }

  // Check last 2 sessions for increase: all sets hit top of range
  if (recentSessions.length >= 2) {
    const twoSessions = recentSessions.slice(0, 2);
    let allHitTop = true;
    for (const sess of twoSessions) {
      for (const s of sess.sets || []) {
        const max = s.set_number === 1 ? (target_reps_max ?? 999) : (set_2_reps_max ?? target_reps_max ?? 999);
        if (s.reps == null || s.reps < max) { allHitTop = false; break; }
      }
      if (!allHitTop) break;
    }
    if (allHitTop) return { type: 'up', label: '↑ Add weight' };
  }

  return { type: 'maintain', label: '→ Maintain' };
}

export default function SessionHistory() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]); // list of session objects
  const [openSessionId, setOpenSessionId] = useState(null);
  const [sessionDetails, setSessionDetails] = useState({}); // id -> { exercises: [{name, logs, targets}] }
  const [loadingDetail, setLoadingDetail] = useState(new Set());

  useEffect(() => {
    async function fetchSessions() {
      setLoading(true);
      const { data: sessionR } = await supabase.auth.getSession();
      const user = sessionR?.session?.user;
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('workout_sessions')
        .select(`
          id,
          session_date,
          program_day_id,
          completed_at,
          training_program_days(day_name)
        `)
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('session_date', { ascending: false })
        .limit(50);

      setSessions(data || []);
      setLoading(false);
    }
    fetchSessions();
  }, []);

  async function fetchSessionDetail(sessionId) {
    if (sessionDetails[sessionId] || loadingDetail.has(sessionId)) return;
    setLoadingDetail(prev => new Set(prev).add(sessionId));

    const { data: logs } = await supabase
      .from('session_exercise_logs')
      .select(`
        id,
        exercise_id,
        exercise_name,
        set_number,
        weight_kg,
        reps,
        program_day_exercise_id,
        workout_sessions!inner(session_date)
      `)
      .eq('workout_session_id', sessionId)
      .order('set_number');

    // Also fetch the targets from program_day_exercises for this session's logs
    const pdeIds = [...new Set((logs || []).map(l => l.program_day_exercise_id).filter(Boolean))];
    let targetsMap = {};
    if (pdeIds.length) {
      const { data: pdes } = await supabase
        .from('program_day_exercises')
        .select('id, target_reps_min, target_reps_max, set_2_reps_min, set_2_reps_max')
        .in('id', pdeIds);
      for (const pde of pdes || []) {
        targetsMap[pde.id] = {
          target_reps_min: pde.target_reps_min,
          target_reps_max: pde.target_reps_max,
          set_2_reps_min: pde.set_2_reps_min,
          set_2_reps_max: pde.set_2_reps_max,
        };
      }
    }

    // Group by exercise_name
    const byEx = {};
    for (const log of logs || []) {
      if (!byEx[log.exercise_name]) {
        byEx[log.exercise_name] = {
          name: log.exercise_name,
          exercise_id: log.exercise_id,
          pdeId: log.program_day_exercise_id,
          sets: [],
        };
      }
      byEx[log.exercise_name].sets.push({
        set_number: log.set_number,
        weight_kg: log.weight_kg,
        reps: log.reps,
      });
    }

    // For each exercise, also fetch its last 4 sessions of logs (for mini-table)
    const exercises = [];
    for (const exName of Object.keys(byEx)) {
      const exData = byEx[exName];
      const targets = targetsMap[exData.pdeId] || null;

      // Fetch recent sessions for this exercise
      let recentSessions = [];
      if (exData.exercise_id) {
        const { data: recentLogs } = await supabase
          .from('session_exercise_logs')
          .select(`
            set_number,
            weight_kg,
            reps,
            workout_sessions!inner(session_date, id)
          `)
          .eq('exercise_id', exData.exercise_id)
          .not('workout_sessions.completed_at', 'is', null)
          .order('workout_sessions(session_date)', { ascending: false })
          .limit(40);

        // Group into sessions
        const sessMap = {};
        for (const log of recentLogs || []) {
          const date = log.workout_sessions?.session_date;
          const wsId = log.workout_sessions?.id;
          if (!date) continue;
          const key = `${wsId}`;
          if (!sessMap[key]) sessMap[key] = { date, sets: [] };
          sessMap[key].sets.push({ set_number: log.set_number, weight_kg: log.weight_kg, reps: log.reps });
        }

        recentSessions = Object.values(sessMap)
          .sort((a, b) => (a.date < b.date ? 1 : -1))
          .slice(0, 4)
          .map(s => ({ ...s, targets }));
      }

      const badge = computeProgressionBadge(recentSessions);
      exercises.push({ name: exName, sets: exData.sets, recentSessions, badge, targets });
    }

    setSessionDetails(prev => ({ ...prev, [sessionId]: { exercises } }));
    setLoadingDetail(prev => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
  }

  function toggleSession(sessionId) {
    if (openSessionId === sessionId) {
      setOpenSessionId(null);
    } else {
      setOpenSessionId(sessionId);
      fetchSessionDetail(sessionId);
    }
  }

  function formatSet(s) {
    if (s.weight_kg != null && s.reps != null) return `${s.weight_kg}×${s.reps}`;
    if (s.reps != null) return `${s.reps} reps`;
    return '—';
  }

  if (loading) {
    return (
      <>
        <style>{SH_CSS}</style>
        <div className="sh-shell"><div className="sh-loading">Loading history…</div></div>
      </>
    );
  }

  return (
    <>
      <style>{SH_CSS}</style>
      <div className="sh-shell">
        <h2 className="sh-title">Session History</h2>

        {sessions.length === 0 && (
          <div className="sh-empty">
            No completed sessions yet. Log your first workout in the Log tab.
          </div>
        )}

        {sessions.map(session => {
          const isOpen = openSessionId === session.id;
          const dayName = session.training_program_days?.day_name ?? 'Workout';
          const detail = sessionDetails[session.id];
          const isLoadingDetail = loadingDetail.has(session.id);

          return (
            <div key={session.id} className={`sh-session-row${isOpen ? ' open' : ''}`}>
              <div className="sh-session-header" onClick={() => toggleSession(session.id)}>
                <span className="sh-session-date">{prettyDate(session.session_date)}</span>
                <span className="sh-session-name">{dayName}</span>
                {detail && (
                  <span className="sh-session-meta">{detail.exercises.length} exercise{detail.exercises.length !== 1 ? 's' : ''}</span>
                )}
                <span className="sh-chevron">▼</span>
              </div>

              {isOpen && (
                <div className="sh-session-body">
                  {isLoadingDetail && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>Loading…</div>
                  )}

                  {detail && detail.exercises.map(ex => {
                    // Build columns: up to last 4 session dates
                    const dates = ex.recentSessions.map(s => s.date);

                    return (
                      <div key={ex.name} className="sh-ex-block">
                        <div className="sh-ex-header-row">
                          <span className="sh-ex-name">{ex.name}</span>
                          {ex.badge && (
                            <span className={`sh-badge sh-badge-${ex.badge.type}`}>
                              {ex.badge.label}
                            </span>
                          )}
                        </div>

                        {ex.recentSessions.length > 0 && (
                          <table className="sh-mini-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                {ex.recentSessions[0].sets.map(s => (
                                  <th key={s.set_number}>Set {s.set_number}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {ex.recentSessions.map((sess, i) => (
                                <tr key={i}>
                                  <td className="sh-td-date">{prettyDate(sess.date)}</td>
                                  {sess.sets.map(s => (
                                    <td key={s.set_number}>{formatSet(s)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
