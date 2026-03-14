import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useProfile } from "../context/ProfileContext";
import TrainingSetup from "./training/TrainingSetup";
import TrainingCalendar from "./training/TrainingCalendar";
import SplitBuilder from "./training/SplitBuilder";
import SessionLog from "./training/SessionLog";
import SessionHistory from "./training/SessionHistory";

const TRAINING_CSS = `
/* ── Tab bar ── */
.tr-tabs {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.75rem;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.tr-tabs::-webkit-scrollbar { display: none; }
.tr-tab {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--line-1);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: all var(--motion-fast);
  white-space: nowrap;
  flex-shrink: 0;
}
.tr-tab.active {
  background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
  border-color: var(--accent-2);
  color: #fff;
  box-shadow: 0 0 12px rgba(181,21,60,0.4);
}
.tr-tab:hover:not(.active) {
  border-color: var(--line-2);
  color: var(--text-2);
}

/* ── Programme sub-tabs ── */
.tr-prog-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1.5px solid var(--line-1);
  margin-bottom: 1.5rem;
}
.tr-prog-tab {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  color: var(--text-3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1.5px;
  cursor: pointer;
  font-family: var(--font-body);
  transition: color var(--motion-fast), border-color var(--motion-fast);
}
.tr-prog-tab.active {
  color: var(--text-1);
  border-bottom-color: var(--accent-3);
}
.tr-prog-tab:hover:not(.active) {
  color: var(--text-2);
}
`;

const TABS = [
  { id: 'programme', label: 'Programme' },
  { id: 'log', label: 'Log' },
  { id: 'history', label: 'History' },
];

export default function Training() {
  const { profile } = useProfile();
  const [activeTab, setActiveTab] = useState('programme');

  // Programme sub-state
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [programDays, setProgramDays] = useState([]);
  const [progView, setProgView] = useState('calendar'); // 'calendar' | 'builder'

  const fetchProgram = useCallback(async () => {
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

    if (!prog) {
      setProgram(null);
      setProgramDays([]);
      setLoading(false);
      return;
    }

    setProgram(prog);

    const { data: days } = await supabase
      .from('training_program_days')
      .select('*')
      .eq('program_id', prog.id)
      .order('day_order');

    setProgramDays(days || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProgram();
  }, [fetchProgram]);

  function renderProgramme() {
    if (loading) {
      return (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
          Loading…
        </div>
      );
    }

    if (!program) {
      return (
        <TrainingSetup
          profile={profile}
          onComplete={fetchProgram}
        />
      );
    }

    return (
      <>
        {/* Programme sub-tabs */}
        <div className="tr-prog-tabs">
          <button
            className={`tr-prog-tab${progView === 'calendar' ? ' active' : ''}`}
            onClick={() => setProgView('calendar')}
          >
            Schedule
          </button>
          <button
            className={`tr-prog-tab${progView === 'builder' ? ' active' : ''}`}
            onClick={() => setProgView('builder')}
          >
            Programme Builder
          </button>
        </div>

        {progView === 'calendar' && (
          <TrainingCalendar
            program={program}
            programDays={programDays}
            onProgramUpdated={fetchProgram}
          />
        )}

        {progView === 'builder' && (
          <SplitBuilder
            program={program}
            programDays={programDays}
            profile={profile}
            onUpdated={fetchProgram}
          />
        )}
      </>
    );
  }

  return (
    <>
      <style>{TRAINING_CSS}</style>
      <div style={{ maxWidth: '100%', fontFamily: 'var(--font-body)', color: 'var(--text-1)' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
            Training
          </h1>
        </div>

        {/* Top-level tabs */}
        <div className="tr-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tr-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'programme' && renderProgramme()}
        {activeTab === 'log' && <SessionLog />}
        {activeTab === 'history' && <SessionHistory />}

      </div>
    </>
  );
}
