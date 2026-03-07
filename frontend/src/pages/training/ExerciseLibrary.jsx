import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { MUSCLE_COLORS, MUSCLE_DISPLAY } from './trainingUtils';

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const STYLES = `
  .el-shell {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0 0 40px;
    min-height: 100%;
    background: var(--surface-2);
  }

  .el-topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--surface-2);
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--line-1);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .el-search {
    position: relative;
    display: flex;
    align-items: center;
  }

  .el-search svg {
    position: absolute;
    left: 12px;
    color: var(--text-3);
    pointer-events: none;
    flex-shrink: 0;
  }

  .el-search input {
    width: 100%;
    background: var(--surface-3);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 14px;
    padding: 9px 12px 9px 38px;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .el-search input::placeholder {
    color: var(--text-3);
  }

  .el-search input:focus {
    border-color: var(--accent-2);
  }

  .el-group-pills {
    display: flex;
    gap: 7px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
  }

  .el-group-pills::-webkit-scrollbar {
    display: none;
  }

  .el-group-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1.5px solid var(--line-1);
    background: var(--surface-3);
    color: var(--text-3);
    font-family: var(--font-body);
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    flex-shrink: 0;
    user-select: none;
  }

  .el-group-pill:hover {
    border-color: var(--line-2);
    color: var(--text-2);
  }

  .el-group-pill.active {
    border-color: var(--accent-2);
    background: rgba(181, 21, 60, 0.12);
    color: var(--text-1);
  }

  .el-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .el-list {
    padding: 16px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .el-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .el-section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 2px;
  }

  .el-section-header span {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    white-space: nowrap;
  }

  .el-section-header::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--line-1);
  }

  .el-exercise-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  @media (max-width: 520px) {
    .el-exercise-grid {
      grid-template-columns: 1fr;
    }
  }

  .el-exercise-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: var(--surface-3);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    transition: border-color 0.15s, background 0.15s;
  }

  .el-exercise-row:hover {
    border-color: var(--line-2);
    background: #1e1118;
  }

  .el-ex-dot-col {
    padding-top: 3px;
    flex-shrink: 0;
  }

  .el-ex-body {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .el-ex-name {
    font-family: var(--font-body);
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-1);
    line-height: 1.3;
  }

  .el-ex-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .el-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border-radius: 999px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    line-height: 1.5;
  }

  .el-badge-equipment {
    background: rgba(47, 26, 34, 0.9);
    color: var(--text-2);
    border: 1px solid var(--line-2);
  }

  .el-badge-compound {
    background: rgba(229, 161, 0, 0.15);
    color: #e5a100;
    border: 1px solid rgba(229, 161, 0, 0.25);
  }

  .el-badge-isolation {
    background: rgba(77, 142, 255, 0.12);
    color: #6fa8ff;
    border: 1px solid rgba(77, 142, 255, 0.2);
  }

  .el-badge-beginner {
    background: rgba(40, 183, 141, 0.12);
    color: var(--ok);
    border: 1px solid rgba(40, 183, 141, 0.22);
  }

  .el-badge-intermediate {
    background: rgba(229, 161, 0, 0.12);
    color: #e5a100;
    border: 1px solid rgba(229, 161, 0, 0.22);
  }

  .el-badge-advanced {
    background: rgba(222, 41, 82, 0.12);
    color: var(--accent-3);
    border: 1px solid rgba(222, 41, 82, 0.22);
  }

  .el-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 60px 24px;
    color: var(--text-3);
    font-family: var(--font-body);
    font-size: 14px;
  }

  .el-spinner {
    width: 28px;
    height: 28px;
    border: 2.5px solid var(--line-2);
    border-top-color: var(--accent-2);
    border-radius: 50%;
    animation: el-spin 0.7s linear infinite;
  }

  @keyframes el-spin {
    to { transform: rotate(360deg); }
  }

  .el-empty {
    padding: 48px 24px;
    text-align: center;
    color: var(--text-3);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.6;
  }
`;

/* ─── Constants ───────────────────────────────────────────────────────────── */
const EQUIPMENT_LABELS = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  any: 'Any',
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function resolveGroupColor(groupName) {
  return MUSCLE_COLORS[groupName] || '#9a7f89';
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ExerciseBadges({ exercise }) {
  const equipLabel = EQUIPMENT_LABELS[exercise.equipment] || capitalize(exercise.equipment);
  const isCompound = exercise.is_compound;
  const diff = exercise.difficulty;

  return (
    <div className="el-ex-badges">
      {equipLabel && (
        <span className="el-badge el-badge-equipment">{equipLabel}</span>
      )}
      {isCompound != null && (
        <span className={`el-badge ${isCompound ? 'el-badge-compound' : 'el-badge-isolation'}`}>
          {isCompound ? 'Compound' : 'Isolation'}
        </span>
      )}
      {diff && (
        <span className={`el-badge el-badge-${diff}`}>{capitalize(diff)}</span>
      )}
    </div>
  );
}

// pinColor: explicit override (used when filtering by a single group).
// Falls back to the exercise's own group color when browsing All / searching.
function ExerciseRow({ exercise, pinColor }) {
  const color = pinColor || resolveGroupColor(exercise._group_name);
  return (
    <div className="el-exercise-row">
      <div className="el-ex-dot-col">
        <div className="el-dot" style={{ backgroundColor: color }} />
      </div>
      <div className="el-ex-body">
        <div className="el-ex-name">{exercise.name}</div>
        <ExerciseBadges exercise={exercise} />
      </div>
    </div>
  );
}

function SectionBlock({ regionName, exercises, pinColor }) {
  return (
    <div className="el-section">
      <div className="el-section-header">
        <span>{regionName}</span>
      </div>
      <div className="el-exercise-grid">
        {exercises.map(ex => (
          <ExerciseRow key={ex.id} exercise={ex} pinColor={pinColor} />
        ))}
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function ExerciseLibrary() {
  const [groups, setGroups] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  /* ── Fetch on mount ── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [groupsRes, exRes] = await Promise.all([
          supabase
            .from('exercise_muscle_groups')
            .select('*')
            .order('sort_order'),
          supabase
            .from('exercises')
            .select(
              '*, exercise_muscle_groups!exercises_primary_group_id_fkey(name, display_name), exercise_muscle_regions!exercises_primary_region_id_fkey(name, scientific_name)'
            )
            .eq('is_global', true)
            .order('name'),
        ]);

        if (cancelled) return;
        if (groupsRes.error) throw groupsRes.error;
        if (exRes.error) throw exRes.error;

        // Flatten joined fields onto top-level for easy access
        const normalised = (exRes.data || []).map(ex => {
          const grpJoin = ex.exercise_muscle_groups;
          const regJoin = ex.exercise_muscle_regions;
          return {
            ...ex,
            _group_name: grpJoin?.name ?? null,
            _group_display: grpJoin?.display_name ?? null,
            _region_name: regJoin?.name ?? null,
            _region_scientific: regJoin?.scientific_name ?? null,
          };
        });

        setGroups(groupsRes.data || []);
        setExercises(normalised);
      } catch (err) {
        console.error('ExerciseLibrary fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Derived display data ── */
  const displayData = useMemo(() => {
    const q = query.trim().toLowerCase();
    const isSearching = q.length > 0;

    let filtered;
    if (isSearching) {
      // Search across all groups; match name or equipment label
      filtered = exercises.filter(ex => {
        const nameMatch = ex.name.toLowerCase().includes(q);
        const equipLabel = (EQUIPMENT_LABELS[ex.equipment] || ex.equipment || '').toLowerCase();
        const equipMatch = equipLabel.includes(q);
        return nameMatch || equipMatch;
      });
    } else if (selectedGroup === 'all') {
      filtered = exercises;
    } else {
      filtered = exercises.filter(ex => ex._group_name === selectedGroup);
    }

    // Group by region; exercises without a region go to "Other"
    const regionMap = new Map();
    for (const ex of filtered) {
      const key = ex._region_name || 'Other';
      if (!regionMap.has(key)) regionMap.set(key, []);
      regionMap.get(key).push(ex);
    }

    return Array.from(regionMap.entries()).map(([regionName, exList]) => ({
      regionName,
      exercises: exList,
    }));
  }, [exercises, selectedGroup, query]);

  // When exactly one group is selected (not searching, not "all"), pin that color
  // so all rows in every region section share the same dot color.
  const isSearching = query.trim().length > 0;
  const pinnedColor =
    !isSearching && selectedGroup !== 'all'
      ? resolveGroupColor(selectedGroup)
      : null;

  /* ── Render ── */
  return (
    <>
      <style>{STYLES}</style>
      <div className="el-shell">
        {/* Top bar */}
        <div className="el-topbar">
          <div className="el-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search exercises..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="el-group-pills">
            <button
              className={`el-group-pill${selectedGroup === 'all' ? ' active' : ''}`}
              onClick={() => setSelectedGroup('all')}
            >
              All
            </button>

            {groups.map(g => {
              const color = resolveGroupColor(g.name);
              const label = MUSCLE_DISPLAY[g.name] || g.display_name || g.name;
              return (
                <button
                  key={g.id}
                  className={`el-group-pill${selectedGroup === g.name ? ' active' : ''}`}
                  onClick={() => setSelectedGroup(g.name)}
                >
                  <span className="el-dot" style={{ backgroundColor: color }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="el-loading">
            <div className="el-spinner" />
            Loading exercise library...
          </div>
        ) : displayData.length === 0 ? (
          <div className="el-empty">
            {query.trim()
              ? `No exercises found matching "${query.trim()}"`
              : 'No exercises found.'}
          </div>
        ) : (
          <div className="el-list">
            {displayData.map(section => (
              <SectionBlock
                key={section.regionName}
                regionName={section.regionName}
                exercises={section.exercises}
                pinColor={pinnedColor}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
