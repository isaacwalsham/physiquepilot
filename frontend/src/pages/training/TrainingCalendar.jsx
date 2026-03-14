import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  buildSchedule,
  prettyDate,
  todayISO,
  MUSCLE_DISPLAY,
  MUSCLE_COLORS,
  DAY_SHORT,
  DAY_KEYS,
} from './trainingUtils';

const TC_CSS = `
  .tc-shell {
    display: flex;
    flex-direction: column;
    gap: 20px;
    font-family: var(--font-body);
    color: var(--text-1);
  }

  /* ── Program info header ─────────────────────────────── */
  .tc-header {
    background: var(--surface-3);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 18px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tc-header-top {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .tc-program-name {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text-1);
    flex: 1;
    min-width: 0;
  }

  .tc-level-badge {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 3px 9px;
    border-radius: 99px;
    background: var(--accent-1);
    color: var(--text-1);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tc-level-badge.intermediate { background: #a36200; }
  .tc-level-badge.advanced     { background: #4b1fa0; }

  .tc-header-meta {
    font-size: 0.82rem;
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tc-header-meta-sep {
    color: var(--line-2);
  }

  .tc-training-days {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }

  .tc-day-chip {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--surface-2);
    color: var(--text-3);
    border: 1px solid var(--line-1);
  }
  .tc-day-chip.active {
    background: rgba(138,15,46,0.25);
    color: var(--accent-3);
    border-color: var(--accent-2);
  }

  /* ── Schedule list ───────────────────────────────────── */
  .tc-schedule {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tc-section-title {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-3);
    text-transform: uppercase;
    padding: 0 2px;
    margin-bottom: 2px;
  }

  .tc-day-row {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    align-items: center;
    gap: 12px;
    background: var(--surface-3);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    padding: 11px 14px;
    border-left: 3px solid transparent;
    transition: background var(--motion-fast), border-color var(--motion-fast);
    min-height: 54px;
  }

  .tc-day-row.today {
    border-left-color: var(--accent-2);
    background: rgba(138,15,46,0.12);
    border-color: var(--accent-1);
  }

  .tc-day-row.past {
    opacity: 0.65;
  }

  /* ── Date column ─────────────────────────────────────── */
  .tc-day-date {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tc-day-date-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-3);
    text-transform: uppercase;
  }
  .tc-day-row.today .tc-day-date-label {
    color: var(--accent-3);
  }

  .tc-day-date-pretty {
    font-size: 0.78rem;
    color: var(--text-2);
    white-space: nowrap;
  }
  .tc-day-row.today .tc-day-date-pretty {
    color: var(--text-1);
  }

  /* ── Center content ──────────────────────────────────── */
  .tc-day-content {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .tc-day-name {
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tc-rest-label {
    font-size: 0.82rem;
    color: var(--text-3);
    font-style: italic;
  }

  .tc-muscle-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tc-muscle-pill {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 5px;
    letter-spacing: 0.02em;
    opacity: 0.88;
  }

  /* ── Right side actions ──────────────────────────────── */
  .tc-day-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  .tc-session-btn {
    font-family: var(--font-body);
    font-size: 0.82rem;
    font-weight: 700;
    padding: 7px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--motion-fast), box-shadow var(--motion-fast), transform var(--motion-fast);
    white-space: nowrap;
    border: none;
  }

  .tc-session-btn.primary {
    background: var(--accent-2);
    color: #fff;
    box-shadow: 0 0 0 0 rgba(181,21,60,0);
  }
  .tc-session-btn.primary:hover {
    background: var(--accent-3);
    box-shadow: 0 0 14px 3px rgba(222,41,82,0.45);
    transform: translateY(-1px);
  }
  .tc-session-btn.primary:active {
    transform: translateY(0);
    box-shadow: none;
  }

  .tc-session-btn.ghost {
    background: transparent;
    color: var(--text-3);
    border: 1px solid var(--line-2);
    font-weight: 500;
    font-size: 0.75rem;
    padding: 5px 10px;
  }
  .tc-session-btn.ghost:hover {
    color: var(--text-2);
    border-color: var(--text-3);
  }

  .tc-tag-logged {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--ok);
    background: rgba(40,183,141,0.12);
    border: 1px solid rgba(40,183,141,0.28);
    padding: 4px 9px;
    border-radius: 6px;
    white-space: nowrap;
  }

  .tc-tag-scheduled {
    font-size: 0.7rem;
    color: var(--text-3);
    font-style: italic;
  }

  /* ── Recent sessions strip ───────────────────────────── */
  .tc-recent {
    background: var(--surface-3);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tc-recent-title {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-3);
    text-transform: uppercase;
  }

  .tc-recent-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tc-recent-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.8rem;
    color: var(--text-2);
  }

  .tc-recent-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ok);
    flex-shrink: 0;
  }

  .tc-recent-date {
    color: var(--text-3);
    min-width: 90px;
    font-size: 0.75rem;
  }

  .tc-recent-name {
    flex: 1;
    color: var(--text-1);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tc-recent-dur {
    font-size: 0.72rem;
    color: var(--text-3);
    white-space: nowrap;
  }

  .tc-empty-recent {
    font-size: 0.8rem;
    color: var(--text-3);
    font-style: italic;
  }
`;

// ─── helpers ────────────────────────────────────────────────────────────────

function levelClass(lvl) {
  if (!lvl) return '';
  const l = lvl.toLowerCase();
  if (l === 'intermediate') return 'intermediate';
  if (l === 'advanced') return 'advanced';
  return '';
}

function splitLabel(program) {
  const type = (program.split_type || '').toUpperCase().replace('_', '/');
  const days = program.training_days?.length ?? 0;
  if (!type && !days) return null;
  if (!type) return `${days} days/week`;
  if (!days) return type;
  return `${type} · ${days} day${days !== 1 ? 's' : ''}/week`;
}

function formatDuration(minutes) {
  if (!minutes) return null;
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TrainingCalendar({ program, programDays, onProgramUpdated }) {
  const [schedule] = useState(() => buildSchedule(program, programDays));
  const [completedDates, setCompletedDates] = useState(new Set());
  const [recentSessions, setRecentSessions] = useState([]);

  const today = todayISO();

  // ── fetch completed sessions ────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    if (!program?.id) return;

    const { data, error } = await supabase
      .from('workout_sessions')
      .select('session_date, id, program_day_id, duration_minutes')
      .eq('program_id', program.id)
      .not('completed_at', 'is', null)
      .order('session_date', { ascending: false });

    if (error) {
      console.error('TrainingCalendar: failed to fetch sessions', error);
      return;
    }

    const dates = new Set((data || []).map(s => s.session_date));
    setCompletedDates(dates);

    // recent 4 for the history strip
    setRecentSessions((data || []).slice(0, 4));
  }, [program?.id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── row label ───────────────────────────────────────────────────────────
  function rowLabel(iso) {
    if (iso === today) return 'TODAY';
    const tomorrow = new Date(today + 'T00:00:00');
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tIso = tomorrow.toISOString().slice(0, 10);
    if (iso === tIso) return 'Tomorrow';
    return null;
  }

  // ── row class ───────────────────────────────────────────────────────────
  function rowClass(iso) {
    const classes = ['tc-day-row'];
    if (iso === today) classes.push('today');
    else if (iso < today) classes.push('past');
    if (schedule.find(s => s.date === iso)?.isTraining) classes.push('training');
    else classes.push('rest');
    return classes.join(' ');
  }

  // ── find split day name for a recent session ────────────────────────────
  function findDayName(session) {
    const entry = schedule.find(s => s.date === session.session_date);
    if (entry?.splitDay?.day_name) return entry.splitDay.day_name;
    // fallback: look up programDays
    const pd = programDays?.find(d => d.id === session.program_day_id);
    return pd?.day_name ?? 'Workout';
  }

  // ── all 7 day keys for the chips row ───────────────────────────────────
  const trainingDaySet = new Set(program?.training_days || []);

  return (
    <>
      <style>{TC_CSS}</style>

      <div className="tc-shell">

        {/* ── Program header ─────────────────────────────────────────── */}
        <div className="tc-header">
          <div className="tc-header-top">
            <span className="tc-program-name">{program?.name ?? 'Training Program'}</span>
            {program?.experience_level && (
              <span className={`tc-level-badge ${levelClass(program.experience_level)}`}>
                {program.experience_level.toUpperCase()}
              </span>
            )}
          </div>

          <div className="tc-header-meta">
            {splitLabel(program) && (
              <span>{splitLabel(program)}</span>
            )}
            {splitLabel(program) && program?.start_date && (
              <span className="tc-header-meta-sep">·</span>
            )}
            {program?.start_date && (
              <span>Started {prettyDate(program.start_date)}</span>
            )}
          </div>

          <div className="tc-training-days">
            {DAY_KEYS.map((key, idx) => (
              <span
                key={key}
                className={`tc-day-chip${trainingDaySet.has(key) ? ' active' : ''}`}
              >
                {DAY_SHORT[idx]}
              </span>
            ))}
          </div>
        </div>

        {/* ── 14-day schedule ────────────────────────────────────────── */}
        <div className="tc-schedule">
          <div className="tc-section-title">Next 14 Days</div>

          {schedule.map(entry => {
            const { date, splitDay, isTraining } = entry;
            const label = rowLabel(date);
            const isToday = date === today;
            const isPast = date < today;
            const isCompleted = completedDates.has(date);

            return (
              <div key={date} className={rowClass(date)}>

                {/* Date column */}
                <div className="tc-day-date">
                  {label && (
                    <span className="tc-day-date-label">{label}</span>
                  )}
                  <span className="tc-day-date-pretty">{prettyDate(date)}</span>
                </div>

                {/* Center content */}
                <div className="tc-day-content">
                  {isTraining && splitDay ? (
                    <>
                      <span
                        className="tc-day-name"
                        style={{ color: splitDay.color || 'var(--text-1)' }}
                      >
                        {splitDay.day_name}
                      </span>

                      {splitDay.muscle_focus?.length > 0 && (
                        <div className="tc-muscle-pills">
                          {splitDay.muscle_focus.map(m => (
                            <span
                              key={m}
                              className="tc-muscle-pill"
                              style={{
                                background: (MUSCLE_COLORS[m] || '#555') + '28',
                                color: MUSCLE_COLORS[m] || 'var(--text-2)',
                                border: `1px solid ${(MUSCLE_COLORS[m] || '#555')}55`,
                              }}
                            >
                              {MUSCLE_DISPLAY[m] ?? m}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="tc-rest-label">Rest Day</span>
                  )}
                </div>

                {/* Actions */}
                <div className="tc-day-actions">
                  {isToday && isTraining && (
                    <span className="tc-tag-scheduled" style={{ color: 'var(--accent-3)', fontStyle: 'normal', fontWeight: 600 }}>Today</span>
                  )}

                  {!isToday && isPast && isCompleted && (
                    <span className="tc-tag-logged">✓ Logged</span>
                  )}

                  {!isToday && !isPast && isTraining && (
                    <span className="tc-tag-scheduled">Scheduled</span>
                  )}
                </div>

              </div>
            );
          })}
        </div>

        {/* ── Recent sessions strip ──────────────────────────────────── */}
        <div className="tc-recent">
          <div className="tc-recent-title">Recent Sessions</div>

          {recentSessions.length === 0 ? (
            <span className="tc-empty-recent">No completed sessions yet.</span>
          ) : (
            <div className="tc-recent-list">
              {recentSessions.map(session => (
                <div key={session.id} className="tc-recent-row">
                  <div className="tc-recent-dot" />
                  <span className="tc-recent-date">{prettyDate(session.session_date)}</span>
                  <span className="tc-recent-name">{findDayName(session)}</span>
                  {session.duration_minutes != null && (
                    <span className="tc-recent-dur">
                      {formatDuration(session.duration_minutes)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
