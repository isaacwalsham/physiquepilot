import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useProfile } from "../context/ProfileContext";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";
import TrainingSetup from "./training/TrainingSetup";
import TrainingCalendar from "./training/TrainingCalendar";
import SplitBuilder from "./training/SplitBuilder";
import SessionLog from "./training/SessionLog";
import SessionHistory from "./training/SessionHistory";
import PageHeader, { PageTabs } from "../components/PageHeader";

const TRAINING_CSS = `
/* ── Program sub-tabs ── */
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
  { id: 'program', label: 'Program' },
  { id: 'log', label: 'Log' },
  { id: 'history', label: 'History' },
];

export default function Training() {
  const { profile } = useProfile();
  const [activeTab, setActiveTab] = useState('program');
  const [logDate, setLogDate] = useState(null);

  // Program sub-state
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

  function renderProgram() {
    if (loading) {
      return <PhysiquePilotLoader />;
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
        {/* Program sub-tabs */}
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
            Program Builder
          </button>
        </div>

        {progView === 'calendar' && (
          <TrainingCalendar
            program={program}
            programDays={programDays}
            onProgramUpdated={fetchProgram}
            onDayClick={(date) => { setLogDate(date); setActiveTab('log'); }}
            onSessionClick={() => { setActiveTab('history'); }}
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

        <PageHeader
          title="TRAINING"
          right={
            <PageTabs
              tabs={TABS.map(t => [t.id, t.label])}
              active={activeTab}
              onChange={setActiveTab}
            />
          }
        />

        {/* Tab content */}
        {activeTab === 'program' && renderProgram()}
        {activeTab === 'log' && <SessionLog initialDate={logDate} />}
        {activeTab === 'history' && <SessionHistory />}

      </div>
    </>
  );
}
