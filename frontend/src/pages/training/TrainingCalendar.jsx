import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { buildScheduleRange, todayISO, formatLocalDate } from './trainingUtils';

// ── helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COL_HEADERS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getMondayOf(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return formatLocalDate(d);
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return formatLocalDate(d);
}

function dayNum(isoDate) {
  return new Date(isoDate + 'T00:00:00').getDate();
}

function weekLabel(mondayISO) {
  const mon = new Date(mondayISO + 'T00:00:00');
  const sun = new Date(mondayISO + 'T00:00:00');
  sun.setDate(sun.getDate() + 6);
  if (mon.getMonth() === sun.getMonth()) {
    return `${MONTHS[mon.getMonth()]} ${mon.getFullYear()}`;
  }
  return `${MONTHS_SHORT[mon.getMonth()]} – ${MONTHS_SHORT[sun.getMonth()]} ${sun.getFullYear()}`;
}

function prettyShort(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function weeksActive(startISO, todayISO) {
  if (!startISO) return null;
  const diff = new Date(todayISO + 'T00:00:00') - new Date(startISO + 'T00:00:00');
  return Math.floor(diff / (7 * 86400000)) + 1;
}

// ── styles ────────────────────────────────────────────────────────────────────

const TC_CSS = `
.tc-shell {
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-family: var(--font-body);
  color: var(--text-1);
}

/* ── Program banner ── */
.tc-banner {
  position: relative;
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  padding: 18px 20px 18px 22px;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Red accent bar on left */
.tc-banner::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #dc143c 0%, #8a0f2e 100%);
  border-radius: 0 2px 2px 0;
}

/* Soft red glow from left */
.tc-banner::after {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 200px;
  background: linear-gradient(90deg, rgba(220,20,60,0.1) 0%, transparent 100%);
  pointer-events: none;
}

.tc-banner-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative; /* sit above ::after */
  z-index: 1;
}

.tc-program-name {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.1;
}

.tc-banner-stats {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: var(--text-3);
}

.tc-stat-sep {
  margin: 0 8px;
  opacity: 0.4;
}

.tc-level-badge {
  position: relative;
  z-index: 1;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 4px 10px;
  border-radius: 99px;
  white-space: nowrap;
  flex-shrink: 0;
  background: rgba(181,21,60,0.2);
  color: var(--accent-3);
  border: 1px solid rgba(181,21,60,0.35);
}

.tc-level-badge.intermediate {
  background: rgba(124,48,0,0.25);
  color: #e87832;
  border-color: rgba(124,48,0,0.45);
}

.tc-level-badge.advanced {
  background: rgba(59,15,112,0.35);
  color: #b07ef8;
  border-color: rgba(59,15,112,0.55);
}

/* ── Week navigation ── */
.tc-week-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tc-week-label {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: 0.02em;
}

.tc-week-btn {
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-size: 1rem;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color var(--motion-fast), color var(--motion-fast), background var(--motion-fast);
  line-height: 1;
  flex-shrink: 0;
}

.tc-week-btn:hover {
  border-color: var(--accent-2);
  color: var(--text-1);
  background: rgba(220,20,60,0.08);
}

/* ── Calendar grid ── */
.tc-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.tc-col-header {
  text-align: center;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  padding-bottom: 4px;
}

/* Base cell */
.tc-cell {
  border-radius: var(--radius-sm);
  min-height: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px 10px;
  gap: 5px;
  transition: border-color var(--motion-fast), background var(--motion-fast), box-shadow var(--motion-fast);
  position: relative;
  overflow: hidden;
}

/* Rest day — ghost with dashed border */
.tc-cell.rest {
  border: 1px dashed rgba(255,255,255,0.08);
  background: transparent;
}

/* Training day — solid card */
.tc-cell.training {
  border: 1px solid var(--line-1);
  background: var(--surface-2);
}

/* Today — red ring */
.tc-cell.today {
  border: 1.5px solid #dc143c !important;
  background: rgba(220,20,60,0.08) !important;
  box-shadow: 0 0 0 1px rgba(220,20,60,0.25), 0 0 14px rgba(220,20,60,0.12);
}

/* Past training — clickable */
.tc-cell.past.training {
  cursor: pointer;
}

.tc-cell.past.training:hover {
  border-color: rgba(220,20,60,0.45);
  background: rgba(220,20,60,0.06);
}

/* Future training — slightly muted */
.tc-cell.future.training {
  opacity: 0.65;
}

/* Date number */
.tc-cell-date {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-3);
}

.tc-cell.rest .tc-cell-date {
  opacity: 0.35;
}

.tc-cell.training .tc-cell-date {
  color: var(--text-2);
}

.tc-cell.today .tc-cell-date {
  color: #dc143c;
}

/* Day name label */
.tc-cell-day-name {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #dc143c;
  text-align: center;
  line-height: 1.3;
  word-break: break-word;
  padding: 0 3px;
}

/* Logged badge */
.tc-cell-logged {
  margin-top: auto;
  font-size: 0.57rem;
  font-weight: 700;
  color: #28b78d;
  background: rgba(40,183,141,0.12);
  border: 1px solid rgba(40,183,141,0.28);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

/* ── Recent sessions horizontal scroll ── */
.tc-recent-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tc-recent-heading {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-3);
  text-transform: uppercase;
}

.tc-recent-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--line-2) transparent;
}

.tc-recent-scroll::-webkit-scrollbar {
  height: 3px;
}

.tc-recent-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.tc-recent-scroll::-webkit-scrollbar-thumb {
  background: var(--line-2);
  border-radius: 99px;
}

.tc-recent-card {
  flex-shrink: 0;
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 140px;
  cursor: pointer;
  transition: border-color var(--motion-fast), background var(--motion-fast);
}

.tc-recent-card:hover {
  border-color: rgba(220,20,60,0.4);
  background: rgba(220,20,60,0.05);
}

.tc-recent-card-date {
  font-size: 0.68rem;
  color: var(--text-3);
}

.tc-recent-card-name {
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tc-recent-card-vol {
  font-size: 0.7rem;
  color: var(--accent-3);
  font-weight: 600;
}

.tc-empty-recent {
  font-size: 0.8rem;
  color: var(--text-3);
  font-style: italic;
  padding: 6px 0;
}
`;

// ── component ─────────────────────────────────────────────────────────────────

export default function TrainingCalendar({ program, programDays, onProgramUpdated, onDayClick, onSessionClick }) {
  const today = todayISO();
  const [weekStart, setWeekStart] = useState(() => getMondayOf(today));
  const [completedDates, setCompletedDates] = useState(new Set());
  const [recentSessions, setRecentSessions] = useState([]);
  const [sessionVolumes, setSessionVolumes] = useState({});

  const fetchSessions = useCallback(async () => {
    if (!program?.id) return;

    const { data } = await supabase
      .from('workout_sessions')
      .select('session_date, id, program_day_id, duration_minutes')
      .eq('program_id', program.id)
      .order('session_date', { ascending: false });

    const sessions = data || [];
    setCompletedDates(new Set(sessions.map(s => s.session_date)));
    const recent = sessions.slice(0, 6);
    setRecentSessions(recent);

    // Fetch volumes for recent sessions
    if (recent.length > 0) {
      const ids = recent.map(s => s.id);
      const { data: logs } = await supabase
        .from('session_exercise_logs')
        .select('workout_session_id, weight_kg, reps')
        .in('workout_session_id', ids);

      const volMap = {};
      for (const log of logs || []) {
        volMap[log.workout_session_id] = (volMap[log.workout_session_id] || 0) + (log.weight_kg || 0) * (log.reps || 0);
      }
      setSessionVolumes(volMap);
    }
  }, [program?.id]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const schedule = buildScheduleRange(program, programDays, weekStart, 7);
  const scheduleMap = Object.fromEntries(schedule.map(e => [e.date, e]));

  function findDayName(session) {
    const pd = programDays?.find(d => d.id === session.program_day_id);
    return pd?.day_name ?? 'Workout';
  }

  function cellClasses(date, entry) {
    const c = ['tc-cell'];
    c.push(entry?.isTraining ? 'training' : 'rest');
    if (date === today) c.push('today');
    else if (date < today) c.push('past');
    else c.push('future');
    return c.join(' ');
  }

  function handleCellClick(date, entry) {
    if (!entry?.isTraining || date > today) return;
    if (onDayClick) onDayClick(date);
  }

  // Banner stats
  const weeksIn = weeksActive(program?.start_date, today);
  const daysPerWeek = program?.training_days?.length
    || programDays?.filter(d => !d.is_rest).length
    || null;

  function levelClass(lvl) {
    const l = (lvl || '').toLowerCase();
    if (l === 'intermediate') return 'intermediate';
    if (l === 'advanced') return 'advanced';
    return '';
  }

  function fmtVol(wsId) {
    const vol = sessionVolumes[wsId];
    if (!vol) return null;
    return vol >= 1000 ? `${(vol / 1000).toFixed(1)}t` : `${Math.round(vol)}kg`;
  }

  return (
    <>
      <style>{TC_CSS}</style>
      <div className="tc-shell">

        {/* ── Program banner ── */}
        <div className="tc-banner">
          <div className="tc-banner-info">
            <div className="tc-program-name">{program?.name ?? 'Training Program'}</div>
            <div className="tc-banner-stats">
              {program?.start_date && (
                <span>Started {prettyShort(program.start_date)}</span>
              )}
              {weeksIn != null && weeksIn > 0 && (
                <>
                  <span className="tc-stat-sep">·</span>
                  <span>Week {weeksIn}</span>
                </>
              )}
              {daysPerWeek != null && daysPerWeek > 0 && (
                <>
                  <span className="tc-stat-sep">·</span>
                  <span>{daysPerWeek}×/week</span>
                </>
              )}
            </div>
          </div>
          {program?.experience_level && (
            <span className={`tc-level-badge ${levelClass(program.experience_level)}`}>
              {program.experience_level.toUpperCase()}
            </span>
          )}
        </div>

        {/* ── Week navigation ── */}
        <div className="tc-week-nav">
          <button className="tc-week-btn" onClick={() => setWeekStart(w => addDays(w, -7))}>‹</button>
          <span className="tc-week-label">{weekLabel(weekStart)}</span>
          <button className="tc-week-btn" onClick={() => setWeekStart(w => addDays(w, 7))}>›</button>
        </div>

        {/* ── Calendar grid ── */}
        <div className="tc-grid">
          {COL_HEADERS.map(h => (
            <div key={h} className="tc-col-header">{h}</div>
          ))}

          {weekDays.map(date => {
            const entry = scheduleMap[date];
            const isLogged = completedDates.has(date);
            const isClickable = entry?.isTraining && date <= today;

            return (
              <div
                key={date}
                className={cellClasses(date, entry)}
                onClick={() => handleCellClick(date, entry)}
                title={isClickable ? 'Open in Log' : undefined}
              >
                <span className="tc-cell-date">{dayNum(date)}</span>

                {entry?.isTraining && entry.splitDay?.day_name && (
                  <span className="tc-cell-day-name">{entry.splitDay.day_name}</span>
                )}

                {entry?.isTraining && isLogged && (
                  <span className="tc-cell-logged">✓ Logged</span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Recent sessions ── */}
        <div className="tc-recent-section">
          <div className="tc-recent-heading">Recent Sessions</div>
          {recentSessions.length === 0 ? (
            <span className="tc-empty-recent">No sessions logged yet.</span>
          ) : (
            <div className="tc-recent-scroll">
              {recentSessions.map(session => {
                const vol = fmtVol(session.id);
                return (
                  <div
                    key={session.id}
                    className="tc-recent-card"
                    onClick={() => onSessionClick?.()}
                  >
                    <div className="tc-recent-card-date">{prettyShort(session.session_date)}</div>
                    <div className="tc-recent-card-name">{findDayName(session)}</div>
                    {vol && <div className="tc-recent-card-vol">{vol}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
