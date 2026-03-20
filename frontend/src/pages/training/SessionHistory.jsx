import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { prettyDate, todayISO } from './trainingUtils';

// ── helpers ───────────────────────────────────────────────────────────────────

const TODAY = todayISO();

const TIME_RANGES = [
  { key: '1W',  label: '1W',  days: 7   },
  { key: '2W',  label: '2W',  days: 14  },
  { key: '4W',  label: '4W',  days: 28  },
  { key: '3M',  label: '3M',  days: 90  },
  { key: '6M',  label: '6M',  days: 182 },
  { key: '1Y',  label: '1Y',  days: 365 },
];

function getCutoff(rangeKey) {
  const range = TIME_RANGES.find(r => r.key === rangeKey);
  if (!range) return '2000-01-01';
  const d = new Date(TODAY + 'T00:00:00');
  d.setDate(d.getDate() - range.days);
  return d.toISOString().slice(0, 10);
}

function fmtAxisDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${M[d.getMonth()]}`;
}

function computeProgressionBadge(recentSessions) {
  if (!recentSessions?.length) return null;
  const targets = recentSessions[0]?.targets;
  if (!targets || targets.target_reps_min == null) return null;
  const { target_reps_min, target_reps_max, set_2_reps_min, set_2_reps_max } = targets;

  const last = recentSessions[0];
  const lastSets = last.sets || [];
  if (lastSets.length > 0) {
    let missedMin = 0;
    for (const s of lastSets) {
      const min = s.set_number === 1 ? (target_reps_min ?? 0) : (set_2_reps_min ?? target_reps_min ?? 0);
      if (s.reps != null && s.reps < min) missedMin++;
    }
    if (missedMin > lastSets.length / 2) return { type: 'down', label: '↓ Reduce weight' };
  }
  if (recentSessions.length >= 2) {
    let allHitTop = true;
    for (const sess of recentSessions.slice(0, 2)) {
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

function formatSet(s) {
  if (s.weight_kg != null && s.reps != null) return `${s.weight_kg}×${s.reps}`;
  if (s.reps != null) return `${s.reps} reps`;
  return '—';
}

// ── chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload;
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--line-2)',
      borderRadius: '6px',
      padding: '10px 14px',
      fontSize: '0.78rem',
      color: 'var(--text-1)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-3)' }}>{pt?.label}</div>
      {pt?.set1Weight != null && (
        <div style={{ color: '#dc143c', marginBottom: 2 }}>
          Set 1: {pt.set1Weight}kg{pt.set1Reps != null ? ` × ${pt.set1Reps} reps` : ''}
        </div>
      )}
      {pt?.set2Weight != null && (
        <div style={{ color: 'rgba(220,20,60,0.7)', marginBottom: 2 }}>
          Set 2: {pt.set2Weight}kg{pt.set2Reps != null ? ` × ${pt.set2Reps} reps` : ''}
        </div>
      )}
      {pt?.bodyweight != null && (
        <div style={{ color: 'var(--text-3)', marginTop: 4, borderTop: '1px solid var(--line-1)', paddingTop: 4 }}>
          Bodyweight: {pt.bodyweight}kg
        </div>
      )}
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const SH_CSS = `
.sh-shell {
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-family: var(--font-body);
  color: var(--text-1);
}

.sh-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-1);
  margin: 0;
}

/* ── Summary stats ── */
.sh-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 600px) {
  .sh-stats-grid { grid-template-columns: 1fr; }
}

.sh-stat-card {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sh-stat-label {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 4px;
}

.sh-stat-value {
  font-size: 1.5rem;
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1;
}

.sh-stat-name {
  font-family: var(--font-display);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-1);
}

.sh-stat-sub {
  font-size: 0.72rem;
  color: var(--text-3);
  margin-top: 2px;
}

.sh-stat-empty {
  font-size: 0.78rem;
  color: var(--text-3);
  font-style: italic;
}

.sh-delta-up {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: #28b78d;
}

.sh-delta-down {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent-3);
}

.sh-delta-neutral {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-3);
}

/* ── Chart card ── */
.sh-chart-card {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sh-chart-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: space-between;
}

.sh-chart-title {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-1);
}

.sh-chart-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.sh-exercise-select {
  font-family: var(--font-body);
  font-size: 0.82rem;
  color: var(--text-1);
  background: var(--surface-3);
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  outline: none;
  cursor: pointer;
  max-width: 200px;
}

.sh-exercise-select:focus {
  border-color: var(--accent-2);
}

.sh-range-pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.sh-range-pill {
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--line-2);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: background var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast);
}

.sh-range-pill:hover { color: var(--text-1); border-color: var(--line-2); }

.sh-range-pill.active {
  background: var(--accent-2);
  border-color: var(--accent-2);
  color: #fff;
}

.sh-chart-empty {
  font-size: 0.82rem;
  color: var(--text-3);
  text-align: center;
  padding: 32px 0;
}

/* ── Section title ── */
.sh-section-title {
  font-family: var(--font-display);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: -8px;
}

/* ── Session rows ── */
.sh-session-row {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--motion-fast);
}

.sh-session-row.open { border-color: var(--line-2); }

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

.sh-session-row.open .sh-chevron { transform: rotate(180deg); }

.sh-session-body {
  border-top: 1px solid var(--line-1);
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--surface-3);
}

/* ── Exercise block ── */
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

.sh-badge-up   { background: rgba(40,183,141,0.15); color: #28b78d; border: 1px solid rgba(40,183,141,0.3); }
.sh-badge-maintain { background: var(--surface-2); color: var(--text-3); border: 1px solid var(--line-2); }
.sh-badge-down { background: rgba(165,21,21,0.15); color: var(--accent-3); border: 1px solid rgba(165,21,21,0.3); }

/* ── Mini history table ── */
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

.sh-mini-table tr:last-child td { border-bottom: none; }
.sh-mini-table .sh-td-date { color: var(--text-3); font-size: 0.7rem; }

/* ── Empty / loading ── */
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

// ── component ─────────────────────────────────────────────────────────────────

export default function SessionHistory() {
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [targetsMap, setTargetsMap] = useState({});
  const [weightLogs, setWeightLogs] = useState([]);
  const [openSessionId, setOpenSessionId] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [timeRange, setTimeRange] = useState('4W');

  // ── data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: sessionR } = await supabase.auth.getSession();
      const user = sessionR?.session?.user;
      if (!user) { setLoading(false); return; }

      // Active program
      const { data: prog } = await supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      setProgram(prog);

      // All sessions — no completed_at filter (sessions are saved explicitly)
      const { data: sessData } = await supabase
        .from('workout_sessions')
        .select('id, session_date, training_program_days(day_name)')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false })
        .limit(200);

      const sessList = sessData || [];
      setSessions(sessList);

      if (sessList.length > 0) {
        const sessionIds = sessList.map(s => s.id);

        // All exercise logs in one query
        const { data: logs } = await supabase
          .from('session_exercise_logs')
          .select('exercise_name, exercise_id, set_number, weight_kg, reps, workout_session_id, program_day_exercise_id')
          .in('workout_session_id', sessionIds)
          .order('set_number');

        // Enrich logs with session_date
        const dateMap = {};
        for (const s of sessList) dateMap[s.id] = s.session_date;
        const enriched = (logs || []).map(l => ({ ...l, session_date: dateMap[l.workout_session_id] || null }));
        setAllLogs(enriched);

        // Batch-fetch all targets
        const pdeIds = [...new Set(enriched.map(l => l.program_day_exercise_id).filter(Boolean))];
        if (pdeIds.length) {
          const { data: pdes } = await supabase
            .from('program_day_exercises')
            .select('id, target_reps_min, target_reps_max, set_2_reps_min, set_2_reps_max')
            .in('id', pdeIds);
          const tmap = {};
          for (const p of pdes || []) tmap[p.id] = p;
          setTargetsMap(tmap);
        }
      }

      // Bodyweight logs since program start
      const sinceDate = prog?.start_date || '2000-01-01';
      const { data: wlogs } = await supabase
        .from('weight_logs')
        .select('log_date, weight_kg')
        .eq('user_id', user.id)
        .gte('log_date', sinceDate)
        .order('log_date', { ascending: true });
      setWeightLogs(wlogs || []);

      setLoading(false);
    }
    init();
  }, []);

  // ── derived data ───────────────────────────────────────────────────────────

  // wsId → logs[]
  const sessionLogsMap = useMemo(() => {
    const map = {};
    for (const log of allLogs) {
      if (!map[log.workout_session_id]) map[log.workout_session_id] = [];
      map[log.workout_session_id].push(log);
    }
    return map;
  }, [allLogs]);

  // wsId → total volume (kg)
  const sessionVolumeMap = useMemo(() => {
    const map = {};
    for (const [id, logs] of Object.entries(sessionLogsMap)) {
      map[id] = logs.reduce((sum, l) => sum + (l.weight_kg || 0) * (l.reps || 0), 0);
    }
    return map;
  }, [sessionLogsMap]);

  // Unique exercise names (sorted)
  const exerciseOptions = useMemo(() =>
    [...new Set(allLogs.map(l => l.exercise_name).filter(Boolean))].sort(),
    [allLogs]
  );

  // Auto-select first exercise when options load
  useEffect(() => {
    if (exerciseOptions.length > 0 && !selectedExercise) {
      setSelectedExercise(exerciseOptions[0]);
    }
  }, [exerciseOptions, selectedExercise]);

  // Chart data for selected exercise + time range
  const chartData = useMemo(() => {
    if (!selectedExercise) return [];
    const cutoff = getCutoff(timeRange);
    const filtered = allLogs.filter(l =>
      l.exercise_name === selectedExercise &&
      l.session_date &&
      l.session_date >= cutoff
    );
    const sessMap = {};
    for (const log of filtered) {
      const key = log.workout_session_id;
      if (!sessMap[key]) sessMap[key] = { date: log.session_date, sets: [] };
      sessMap[key].sets.push(log);
    }
    return Object.values(sessMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => {
        const set1 = s.sets.find(l => l.set_number === 1);
        const set2 = s.sets.find(l => l.set_number === 2);
        // Closest bodyweight on or before this date
        const bw = [...weightLogs].filter(w => w.log_date <= s.date).slice(-1)[0]?.weight_kg ?? null;
        return {
          date: s.date,
          label: fmtAxisDate(s.date),
          set1Weight: set1?.weight_kg ?? null,
          set1Reps: set1?.reps ?? null,
          set2Weight: set2?.weight_kg ?? null,
          set2Reps: set2?.reps ?? null,
          bodyweight: bw,
        };
      });
  }, [allLogs, selectedExercise, timeRange, weightLogs]);

  // Summary stats
  const stats = useMemo(() => {
    // Bodyweight change
    let bwChange = null;
    if (weightLogs.length >= 2) {
      const from = weightLogs[0].weight_kg;
      const to = weightLogs[weightLogs.length - 1].weight_kg;
      const diff = (to - from).toFixed(1);
      bwChange = { from, to, diff };
    } else if (weightLogs.length === 1) {
      bwChange = { from: null, to: weightLogs[0].weight_kg, diff: null };
    }

    // Per-exercise: first vs latest top set weight → % progression
    const exPts = {};
    for (const log of allLogs) {
      if (log.set_number !== 1 || !log.exercise_name || !log.session_date || log.weight_kg == null) continue;
      if (!exPts[log.exercise_name]) exPts[log.exercise_name] = [];
      exPts[log.exercise_name].push({ date: log.session_date, weight: log.weight_kg });
    }
    const progressions = [];
    for (const [name, pts] of Object.entries(exPts)) {
      if (pts.length < 2) continue;
      const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date));
      const from = sorted[0].weight;
      const to = sorted[sorted.length - 1].weight;
      if (!from) continue;
      const pct = ((to - from) / from * 100).toFixed(1);
      progressions.push({ name, pct: parseFloat(pct), from, to });
    }
    progressions.sort((a, b) => b.pct - a.pct);

    return {
      bwChange,
      mostProgressed: progressions[0] || null,
      leastProgressed: progressions.length > 1 ? progressions[progressions.length - 1] : null,
    };
  }, [allLogs, weightLogs]);

  // ── session detail helpers ─────────────────────────────────────────────────

  function getExerciseRecentSessions(exerciseName) {
    const logs = allLogs.filter(l => l.exercise_name === exerciseName);
    const sessMap = {};
    for (const log of logs) {
      const key = log.workout_session_id;
      if (!sessMap[key]) sessMap[key] = { date: log.session_date, sets: [] };
      sessMap[key].sets.push({ set_number: log.set_number, weight_kg: log.weight_kg, reps: log.reps });
    }
    const pdeId = logs[0]?.program_day_exercise_id;
    const targets = pdeId ? (targetsMap[pdeId] || null) : null;
    return Object.values(sessMap)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4)
      .map(s => ({ ...s, targets }));
  }

  function getSessionExercises(wsId) {
    const logs = sessionLogsMap[wsId] || [];
    const byEx = {};
    for (const log of logs) {
      if (!log.exercise_name) continue;
      if (!byEx[log.exercise_name]) {
        byEx[log.exercise_name] = { name: log.exercise_name, pdeId: log.program_day_exercise_id, sets: [] };
      }
      byEx[log.exercise_name].sets.push({ set_number: log.set_number, weight_kg: log.weight_kg, reps: log.reps });
    }
    return Object.values(byEx).map(ex => {
      const recentSessions = getExerciseRecentSessions(ex.name);
      const badge = computeProgressionBadge(recentSessions);
      return { ...ex, recentSessions, badge };
    });
  }

  function bwOnDate(date) {
    return [...weightLogs].filter(w => w.log_date <= date).slice(-1)[0]?.weight_kg ?? null;
  }

  // ── render ─────────────────────────────────────────────────────────────────

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

        <h2 className="sh-title">Training History</h2>

        {/* ── Summary stats ── */}
        {sessions.length > 0 && (
          <div className="sh-stats-grid">

            {/* Bodyweight change */}
            <div className="sh-stat-card">
              <div className="sh-stat-label">Bodyweight Change</div>
              {stats.bwChange ? (
                <>
                  {stats.bwChange.diff != null ? (
                    <div className={parseFloat(stats.bwChange.diff) >= 0 ? 'sh-delta-up' : 'sh-delta-down'}>
                      {parseFloat(stats.bwChange.diff) >= 0 ? '+' : ''}{stats.bwChange.diff} kg
                    </div>
                  ) : (
                    <div className="sh-delta-neutral">{stats.bwChange.to} kg</div>
                  )}
                  {stats.bwChange.from != null && (
                    <div className="sh-stat-sub">{stats.bwChange.from} kg → {stats.bwChange.to} kg since start</div>
                  )}
                </>
              ) : (
                <div className="sh-stat-empty">No weight logs yet</div>
              )}
            </div>

            {/* Most progressed */}
            <div className="sh-stat-card">
              <div className="sh-stat-label">Most Progressed Lift</div>
              {stats.mostProgressed ? (
                <>
                  <div className="sh-stat-name">{stats.mostProgressed.name}</div>
                  <div className="sh-delta-up">+{stats.mostProgressed.pct}%</div>
                  <div className="sh-stat-sub">{stats.mostProgressed.from} kg → {stats.mostProgressed.to} kg</div>
                </>
              ) : (
                <div className="sh-stat-empty">Need 2+ sessions per exercise</div>
              )}
            </div>

            {/* Least progressed / needs attention */}
            <div className="sh-stat-card">
              <div className="sh-stat-label">Needs Attention</div>
              {stats.leastProgressed ? (
                <>
                  <div className="sh-stat-name">{stats.leastProgressed.name}</div>
                  <div className={stats.leastProgressed.pct >= 0 ? 'sh-delta-up' : 'sh-delta-down'}>
                    {stats.leastProgressed.pct >= 0 ? '+' : ''}{stats.leastProgressed.pct}%
                  </div>
                  <div className="sh-stat-sub">{stats.leastProgressed.from} kg → {stats.leastProgressed.to} kg</div>
                </>
              ) : (
                <div className="sh-stat-empty">Need 2+ sessions per exercise</div>
              )}
            </div>

          </div>
        )}

        {/* ── Exercise progress chart ── */}
        {exerciseOptions.length > 0 && (
          <div className="sh-chart-card">
            <div className="sh-chart-header">
              <div className="sh-chart-title">Exercise Progress</div>
              <div className="sh-chart-controls">
                <select
                  className="sh-exercise-select"
                  value={selectedExercise}
                  onChange={e => setSelectedExercise(e.target.value)}
                >
                  {exerciseOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <div className="sh-range-pills">
                  {TIME_RANGES.map(r => (
                    <button
                      key={r.key}
                      className={`sh-range-pill${timeRange === r.key ? ' active' : ''}`}
                      onClick={() => setTimeRange(r.key)}
                    >{r.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {chartData.length < 2 ? (
              <div className="sh-chart-empty">
                {chartData.length === 0
                  ? 'No data for this exercise in the selected time range.'
                  : 'Log at least 2 sessions to see the progress chart.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--line-1)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                    axisLine={{ stroke: 'var(--line-1)' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="lift"
                    tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v}kg`}
                    width={50}
                  />
                  {weightLogs.length > 0 && (
                    <YAxis
                      yAxisId="bw"
                      orientation="right"
                      tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}kg`}
                      width={50}
                    />
                  )}
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '0.72rem', paddingTop: 8 }}
                    formatter={v => <span style={{ color: 'var(--text-2)' }}>{v}</span>}
                  />
                  <Line
                    yAxisId="lift"
                    type="monotone"
                    dataKey="set1Weight"
                    name="Set 1"
                    stroke="#dc143c"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#dc143c', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="lift"
                    type="monotone"
                    dataKey="set2Weight"
                    name="Set 2"
                    stroke="rgba(220,20,60,0.5)"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={{ r: 3, fill: 'rgba(220,20,60,0.5)', strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                  {weightLogs.length > 0 && (
                    <Line
                      yAxisId="bw"
                      type="monotone"
                      dataKey="bodyweight"
                      name="Bodyweight"
                      stroke="var(--text-3)"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* ── Session feed ── */}
        <div className="sh-section-title">Sessions</div>

        {sessions.length === 0 ? (
          <div className="sh-empty">
            No sessions logged yet. Complete a workout in the Log tab.
          </div>
        ) : (
          sessions.map(session => {
            const isOpen = openSessionId === session.id;
            const dayName = session.training_program_days?.day_name ?? 'Workout';
            const volume = sessionVolumeMap[session.id] || 0;
            const bw = bwOnDate(session.session_date);
            const exercises = isOpen ? getSessionExercises(session.id) : null;

            return (
              <div key={session.id} className={`sh-session-row${isOpen ? ' open' : ''}`}>
                <div
                  className="sh-session-header"
                  onClick={() => setOpenSessionId(isOpen ? null : session.id)}
                >
                  <span className="sh-session-date">{prettyDate(session.session_date)}</span>
                  <span className="sh-session-name">{dayName}</span>
                  <span className="sh-session-meta">
                    {volume > 0 ? `${(volume / 1000).toFixed(1)}t` : ''}
                    {bw ? ` · ${bw}kg BW` : ''}
                  </span>
                  <span className="sh-chevron">▼</span>
                </div>

                {isOpen && exercises && (
                  <div className="sh-session-body">
                    {exercises.length === 0 && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>
                        No exercise data recorded for this session.
                      </div>
                    )}
                    {exercises.map(ex => (
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
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

      </div>
    </>
  );
}
