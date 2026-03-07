import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useProfile } from "../context/ProfileContext";
import TrainingSetup   from "./training/TrainingSetup";
import TrainingCalendar from "./training/TrainingCalendar";
import ActiveSession   from "./training/ActiveSession";
import SplitBuilder    from "./training/SplitBuilder";
import ExerciseLibrary from "./training/ExerciseLibrary";

const CSS = `
  .trn-shell { display:flex; flex-direction:column; gap:0; min-height:calc(100vh - 80px); }

  /* ── Tab bar ── */
  .trn-tabs {
    display:flex; gap:0; border-bottom:1px solid var(--line-1);
    margin-bottom:1.5rem; flex-shrink:0;
  }
  .trn-tab {
    padding:0.65rem 1.2rem;
    font-family:var(--font-display); font-size:0.72rem;
    letter-spacing:0.12em; text-transform:uppercase;
    color:var(--text-3); background:transparent;
    border:none; border-bottom:2px solid transparent;
    cursor:pointer; transition:color 160ms, border-color 160ms;
    margin-bottom:-1px;
  }
  .trn-tab:hover  { color:var(--text-2); }
  .trn-tab.active { color:var(--accent-3); border-bottom-color:var(--accent-3); }

  /* ── Page label ── */
  .trn-page-label {
    display:flex; align-items:center; gap:0.6rem;
    font-family:var(--font-display); font-size:0.62rem;
    letter-spacing:0.18em; text-transform:uppercase;
    color:var(--accent-3); margin-bottom:1rem;
  }
  .trn-page-label::after {
    content:''; flex:1; height:1px;
    background:linear-gradient(to right, var(--accent-1), transparent);
  }

  /* ── Cockpit loader ── */
  .trn-loader {
    display:flex; flex-direction:column; align-items:center;
    justify-content:center; height:60vh; gap:0.5rem;
  }
  .trn-loader-text {
    font-family:var(--font-display); font-size:0.75rem;
    letter-spacing:0.2em; color:var(--accent-3);
  }
`;

const TABS = [
  { id:'schedule', label:'◈ Schedule' },
  { id:'program',  label:'◈ Program'  },
  { id:'library',  label:'◈ Library'  },
];

export default function Training() {
  const { profile, loading: profileLoading } = useProfile();
  const [tab,           setTab]           = useState('schedule');
  const [loading,       setLoading]       = useState(true);
  const [program,       setProgram]       = useState(null);   // active training_programs row
  const [programDays,   setProgramDays]   = useState([]);      // training_program_days rows
  const [activeSession, setActiveSession] = useState(null);   // {programDay, sessionDate}

  const fetchProgram = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: prog } = await supabase
      .from('training_programs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (prog) {
      const { data: days } = await supabase
        .from('training_program_days')
        .select('*')
        .eq('program_id', prog.id)
        .order('day_order');
      setProgram(prog);
      setProgramDays(days || []);
    } else {
      setProgram(null);
      setProgramDays([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!profileLoading) fetchProgram();
  }, [profileLoading, fetchProgram]);

  // ── Active session overlay ──────────────────────────────────────────────
  if (activeSession) {
    return (
      <>
        <style>{CSS}</style>
        <ActiveSession
          programDay={activeSession.programDay}
          sessionDate={activeSession.sessionDate}
          program={program}
          onExit={() => setActiveSession(null)}
        />
      </>
    );
  }

  if (loading || profileLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="trn-loader">
          <div className="trn-loader-text">LOADING TRAINING DATA...</div>
        </div>
      </>
    );
  }

  // ── No program → setup wizard ───────────────────────────────────────────
  if (!program) {
    return (
      <>
        <style>{CSS}</style>
        <div className="trn-shell">
          <div className="trn-page-label">◈ TRAINING ENGINE</div>
          <TrainingSetup
            profile={profile}
            onComplete={fetchProgram}
          />
        </div>
      </>
    );
  }

  // ── Program exists → tabbed layout ─────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="trn-shell">
        <div className="trn-page-label">◈ TRAINING ENGINE</div>

        <div className="trn-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`trn-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'schedule' && (
          <TrainingCalendar
            program={program}
            programDays={programDays}
            onStartSession={(programDay, sessionDate) =>
              setActiveSession({ programDay, sessionDate })
            }
            onProgramUpdated={fetchProgram}
          />
        )}
        {tab === 'program' && (
          <SplitBuilder
            program={program}
            programDays={programDays}
            profile={profile}
            onUpdated={fetchProgram}
          />
        )}
        {tab === 'library' && (
          <ExerciseLibrary />
        )}
      </div>
    </>
  );
}
