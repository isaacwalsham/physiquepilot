import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const dayNameToIndex = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

const formatISO = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (iso, n) => {
  const dt = new Date(`${iso}T00:00:00`);
  dt.setDate(dt.getDate() + n);
  return formatISO(dt);
};

const startOfCheckInWeek = (todayIso, checkInDayName) => {
  const target = dayNameToIndex[checkInDayName] ?? 1;
  const dt = new Date(`${todayIso}T00:00:00`);
  const todayIdx = dt.getDay();
  const diff = (todayIdx - target + 7) % 7;
  dt.setDate(dt.getDate() - diff);
  return formatISO(dt);
};

const round1 = (n) => Math.round(n * 10) / 10;

const CSS = `
  .ci-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    font-family: var(--font-body);
  }

  /* ── Page header ── */
  .ci-page-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .ci-page-title-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .ci-accent-prefix {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .ci-accent-line {
    width: 28px;
    height: 2px;
    background: var(--accent-3);
    flex-shrink: 0;
  }

  .ci-page-label {
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent-3);
    font-weight: 600;
  }

  .ci-page-title {
    font-family: var(--font-display);
    font-size: 1.55rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-1);
    margin: 0;
    line-height: 1;
  }

  .ci-status-badge {
    font-family: var(--font-display);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--line-1);
    color: var(--text-3);
    background: transparent;
  }

  .ci-status-badge.submitted {
    border-color: var(--ok);
    color: var(--ok);
    box-shadow: 0 0 10px rgba(40, 183, 141, 0.15);
  }

  /* ── Error bar ── */
  .ci-error {
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--bad);
    padding: 0.7rem 1rem;
    border: 1px solid var(--bad);
    background: rgba(255, 79, 115, 0.07);
  }

  /* ── Panel shell ── */
  .ci-panel {
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    overflow: hidden;
  }

  .ci-panel-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 1rem;
    background: var(--surface-2);
    border-bottom: 1px solid var(--line-1);
  }

  .ci-panel-topbar-title {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-2);
    font-weight: 600;
  }

  .ci-panel-topbar-meta {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .ci-panel-body {
    padding: 1rem;
  }

  /* ── Two-column layout ── */
  .ci-main-grid {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1rem;
    align-items: start;
  }

  .ci-form-column {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ── Weekly stats readout grid ── */
  .ci-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .ci-readout-cell {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    padding: 0.75rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    position: relative;
    overflow: hidden;
  }

  .ci-readout-cell::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 2px;
    height: 100%;
    background: var(--line-2);
  }

  .ci-readout-value {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-1);
    line-height: 1;
    letter-spacing: 0.02em;
  }

  .ci-readout-value.dim {
    color: var(--text-3);
  }

  .ci-readout-label {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    font-weight: 600;
  }

  .ci-readout-sub {
    font-size: 0.72rem;
    color: var(--text-3);
    margin-top: 0.1rem;
  }

  .ci-readout-sub.positive {
    color: var(--ok);
  }

  .ci-readout-sub.negative {
    color: var(--bad);
  }

  .ci-stat-note {
    font-size: 0.78rem;
    color: var(--text-3);
    margin-top: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--line-1);
  }

  /* ── Pilot assessment (subjective ratings) ── */
  .ci-rating-rows {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .ci-rating-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .ci-rating-factor {
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-2);
    font-weight: 600;
    width: 90px;
    flex-shrink: 0;
  }

  .ci-rating-pills {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .ci-pill {
    font-family: var(--font-display);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.38rem 0.7rem;
    border: 1px solid var(--line-1);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: all 160ms ease;
    border-radius: 0;
  }

  .ci-pill:hover {
    border-color: var(--line-2);
    color: var(--text-2);
    background: var(--surface-2);
    transform: translateY(0) !important;
  }

  .ci-pill.active {
    background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
    border-color: var(--accent-2);
    color: #fff;
    box-shadow: 0 0 12px rgba(181, 21, 60, 0.35);
    transform: translateY(0) !important;
  }

  /* ── Mission notes textarea ── */
  .ci-notes-textarea {
    width: 100%;
    min-height: 110px;
    padding: 0.75rem;
    background: var(--surface-2) !important;
    border: 1px solid var(--line-1) !important;
    border-radius: 0 !important;
    color: var(--text-1) !important;
    font-family: var(--font-body);
    font-size: 0.9rem;
    resize: vertical;
    box-sizing: border-box;
    line-height: 1.55;
  }

  .ci-notes-textarea:focus {
    border-color: var(--accent-3) !important;
    box-shadow: 0 0 0 2px rgba(222, 41, 82, 0.18), 0 0 14px rgba(222, 41, 82, 0.12) !important;
    outline: none;
  }

  /* ── Save button ── */
  .ci-save-btn {
    width: 100%;
    padding: 0.8rem 1.25rem;
    font-family: var(--font-display);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
    color: #fff;
    border: 1px solid var(--accent-2);
    cursor: pointer;
    border-radius: 0;
    box-shadow: 0 0 18px rgba(181, 21, 60, 0.3);
    transition: all 160ms ease;
  }

  .ci-save-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--accent-2), var(--accent-3));
    box-shadow: 0 0 24px rgba(222, 41, 82, 0.45);
    transform: translateY(-1px);
  }

  .ci-save-btn:disabled {
    opacity: 0.5;
    cursor: default;
    transform: none;
  }

  /* ── History (history sidebar) ── */
  .ci-history-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-height: 580px;
    overflow-y: auto;
  }

  .ci-history-item {
    padding: 0.65rem 0.875rem;
    border: 1px solid var(--line-1);
    background: var(--surface-2);
    cursor: pointer;
    transition: all 160ms ease;
    position: relative;
    border-left: 3px solid transparent;
  }

  .ci-history-item:hover {
    border-color: var(--line-2);
    background: var(--surface-3);
  }

  .ci-history-item.active {
    border-left-color: var(--accent-2);
    background: var(--surface-3);
    border-color: var(--line-2);
    box-shadow: inset 3px 0 12px rgba(181, 21, 60, 0.12);
  }

  .ci-history-date {
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-1);
  }

  .ci-history-meta {
    font-size: 0.72rem;
    color: var(--text-3);
    margin-top: 0.25rem;
    line-height: 1.4;
  }

  .ci-empty-state {
    font-size: 0.85rem;
    color: var(--text-3);
    font-style: italic;
    padding: 0.5rem 0;
  }

  /* ── Debrief detail panel ── */
  .ci-detail-metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
    margin-top: 0.75rem;
  }

  .ci-detail-cell {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    padding: 0.65rem 0.75rem;
  }

  .ci-detail-cell-label {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .ci-detail-cell-value {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-1);
    margin-top: 0.25rem;
  }

  .ci-detail-ratings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .ci-detail-rating-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    padding: 0.5rem 0.75rem;
    gap: 0.2rem;
    flex: 1;
    min-width: 70px;
  }

  .ci-detail-rating-chip-label {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .ci-detail-rating-chip-val {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--accent-3);
  }

  .ci-detail-notes {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    font-size: 0.875rem;
    color: var(--text-2);
    line-height: 1.6;
    white-space: pre-wrap;
    min-height: 48px;
  }

  .ci-detail-section-label {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-top: 0.875rem;
    margin-bottom: 0;
  }

  .ci-detail-week-range {
    font-family: var(--font-display);
    font-size: 0.78rem;
    color: var(--text-2);
    letter-spacing: 0.06em;
    margin-bottom: 0.25rem;
  }

  /* ── Visual Log (photos) ── */
  .ci-photo-upload-fields {
    display: grid;
    gap: 0.65rem;
  }

  .ci-field-label {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
    display: block;
    margin-bottom: 0.35rem;
  }

  .ci-field-input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: var(--surface-2) !important;
    border: 1px solid var(--line-1) !important;
    border-radius: 0 !important;
    color: var(--text-1) !important;
    font-family: var(--font-body);
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  .ci-file-upload-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.7rem 1rem;
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: transparent;
    color: var(--text-2);
    border: 1px dashed var(--line-2);
    cursor: pointer;
    border-radius: 0;
    transition: all 160ms ease;
    position: relative;
  }

  .ci-file-upload-btn:hover:not(:disabled) {
    border-color: var(--accent-2);
    color: var(--accent-3);
    box-shadow: 0 0 14px rgba(181, 21, 60, 0.18);
    background: rgba(181, 21, 60, 0.06);
    transform: translateY(-1px);
  }

  .ci-file-upload-btn:disabled {
    opacity: 0.45;
    cursor: default;
    transform: none;
  }

  .ci-upload-status {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
    text-align: center;
    padding: 0.35rem 0;
  }

  .ci-upload-status.active {
    color: var(--accent-3);
  }

  /* ── Photo grid ── */
  .ci-photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  .ci-photo-thumb {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .ci-photo-thumb:hover {
    border-color: var(--line-2);
    box-shadow: 0 0 16px rgba(181, 21, 60, 0.2);
  }

  .ci-photo-thumb-btn {
    width: 100%;
    aspect-ratio: 1 / 1;
    background: var(--surface-3);
    border: none;
    cursor: pointer;
    padding: 0;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--line-1);
  }

  .ci-photo-thumb-btn:hover {
    transform: none;
  }

  .ci-photo-thumb-inner {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    color: var(--text-3);
    transition: color 160ms ease;
  }

  .ci-photo-thumb-btn:hover .ci-photo-thumb-inner {
    color: var(--accent-3);
  }

  .ci-photo-thumb-icon {
    font-size: 1.5rem;
    opacity: 0.5;
  }

  .ci-photo-thumb-view-label {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .ci-photo-thumb-date-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.3rem 0.4rem;
    background: linear-gradient(transparent, rgba(0,0,0,0.75));
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.8);
    text-align: right;
  }

  .ci-photo-thumb-meta {
    padding: 0.4rem 0.5rem 0.45rem;
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
    flex: 1;
  }

  .ci-photo-thumb-taken {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    color: var(--text-2);
  }

  .ci-photo-thumb-caption {
    font-size: 0.7rem;
    color: var(--text-3);
    line-height: 1.35;
  }

  .ci-photo-delete-btn {
    width: 100%;
    padding: 0.38rem;
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: transparent;
    color: var(--bad);
    border: none;
    border-top: 1px solid var(--line-1);
    cursor: pointer;
    border-radius: 0;
    transition: all 160ms ease;
  }

  .ci-photo-delete-btn:hover {
    background: rgba(255, 79, 115, 0.1);
    transform: none;
  }

  /* ── Photo modal ── */
  .ci-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: 200;
    backdrop-filter: blur(4px);
  }

  .ci-modal-box {
    max-width: 1060px;
    width: 100%;
    background: var(--surface-1);
    border: 1px solid var(--line-2);
    box-shadow: 0 0 60px rgba(181, 21, 60, 0.18), 0 24px 60px rgba(0,0,0,0.7);
    overflow: hidden;
  }

  .ci-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    background: var(--surface-2);
    border-bottom: 1px solid var(--line-1);
  }

  .ci-modal-title {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .ci-modal-close {
    font-family: var(--font-display);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: transparent;
    color: var(--text-2);
    border: 1px solid var(--line-1);
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    border-radius: 0;
    transition: all 160ms ease;
  }

  .ci-modal-close:hover {
    border-color: var(--accent-2);
    color: var(--accent-3);
    box-shadow: 0 0 10px rgba(222, 41, 82, 0.2);
  }

  .ci-modal-img {
    width: 100%;
    display: block;
    border: none;
    max-height: 80vh;
    object-fit: contain;
    background: #000;
  }

  /* ── Separator line ── */
  .ci-divider {
    border: none;
    border-top: 1px solid var(--line-1);
    margin: 0;
  }

  /* ── Loading state ── */
  .ci-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .ci-loading-dot {
    width: 6px;
    height: 6px;
    background: var(--accent-3);
    border-radius: 50%;
    animation: ci-pulse 1.1s ease-in-out infinite alternate;
  }

  .ci-loading-dot:nth-child(2) { animation-delay: 0.18s; }
  .ci-loading-dot:nth-child(3) { animation-delay: 0.36s; }

  @keyframes ci-pulse {
    0% { opacity: 0.2; transform: scale(0.8); }
    100% { opacity: 1; transform: scale(1.15); }
  }

  /* ── Responsive ── */
  @media (max-width: 980px) {
    .ci-main-grid {
      grid-template-columns: 1fr;
    }
    .ci-stat-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .ci-detail-metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .ci-photo-grid {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    }
  }

  @media (max-width: 600px) {
    .ci-stat-grid {
      grid-template-columns: 1fr 1fr;
    }
    .ci-rating-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.4rem;
    }
    .ci-rating-factor {
      width: auto;
    }
    .ci-detail-metrics-grid {
      grid-template-columns: 1fr 1fr;
    }
    .ci-photo-grid {
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    }
  }
`;

function CheckIns() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);
  const [checkInDay, setCheckInDay] = useState("Monday");

  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");

  const [metrics, setMetrics] = useState({
    avgWeightKg: null,
    weightChangeKg: null,
    avgCalories: null,
    trainingCompleted: 0,
    avgSteps: 0,
    cardioSessions: 0
  });

  const [form, setForm] = useState({
    hunger: 3,
    energy: 3,
    performance: 3,
    recovery: 3,
    adherence: 3,
    notes: ""
  });

  const [existingThisWeek, setExistingThisWeek] = useState(null);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoTakenOn, setPhotoTakenOn] = useState(formatISO(new Date()));
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(null);

  const todayIso = useMemo(() => formatISO(new Date()), []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("check_in_day")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pErr && pErr.code !== "PGRST116") {
        setError(pErr.message);
        setLoading(false);
        return;
      }

      const cid = profile?.check_in_day || "Monday";
      setCheckInDay(cid);

      const ws = startOfCheckInWeek(todayIso, cid);
      const we = addDays(ws, 6);
      setWeekStart(ws);
      setWeekEnd(we);

      await Promise.all([
        loadWeekState(user.id, ws, we),
        loadHistory(user.id),
        loadPhotos(user.id)
      ]);

      setLoading(false);
    };

    load();
  }, [todayIso]);

  const loadHistory = async (uid) => {
    const { data, error: e } = await supabase
      .from("weekly_check_ins")
      .select("*")
      .eq("user_id", uid)
      .order("week_start", { ascending: false })
      .limit(30);

    if (e) {
      setError(e.message);
      return;
    }

    setHistory(data || []);
  };

  const loadWeekState = async (uid, ws, we) => {
    setExistingThisWeek(null);
    setSelected(null);
    setSelectedPhotoUrl(null);

    const { data: existing, error: exErr } = await supabase
      .from("weekly_check_ins")
      .select("*")
      .eq("user_id", uid)
      .eq("week_start", ws)
      .maybeSingle();

    if (exErr && exErr.code !== "PGRST116") {
      setError(exErr.message);
      return;
    }

    if (existing) {
      setExistingThisWeek(existing);
      setSelected(existing);
      setForm({
        hunger: existing.hunger_rating ?? 3,
        energy: existing.energy_rating ?? 3,
        performance: existing.performance_rating ?? 3,
        recovery: existing.recovery_rating ?? 3,
        adherence: existing.adherence_rating ?? 3,
        notes: existing.notes || ""
      });
      setMetrics({
        avgWeightKg: existing.avg_weight_kg ?? null,
        weightChangeKg: existing.weight_change_kg ?? null,
        avgCalories: existing.avg_calories ?? null,
        trainingCompleted: existing.training_sessions_completed ?? 0,
        avgSteps: existing.avg_steps ?? 0,
        cardioSessions: existing.cardio_sessions ?? 0
      });
      return;
    }

    const weight = await computeWeightMetrics(uid, ws, we);
    const nutrition = await computeCaloriesAvg(uid, ws, we);
    const training = await computeTrainingCompleted(uid, ws, we);
    const steps = await computeStepsAvg(uid, ws, we);
    const cardio = await computeCardioCount(uid, ws, we);

    setMetrics({
      avgWeightKg: weight.avgWeightKg,
      weightChangeKg: weight.weightChangeKg,
      avgCalories: nutrition.avgCalories,
      trainingCompleted: training.completed,
      avgSteps: steps.avgSteps,
      cardioSessions: cardio.count
    });

    setForm((f) => ({ ...f, notes: "" }));
  };

  const loadPhotos = async (uid) => {
    const { data, error: e } = await supabase
      .from("progress_photos")
      .select("id, taken_on, image_path, caption, created_at")
      .eq("user_id", uid)
      .order("taken_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60);

    if (e) {
      setError(e.message);
      return;
    }

    setPhotos(data || []);
  };

  const getPhotoSignedUrl = async (imagePath) => {
    const { data, error: e } = await supabase.storage
      .from("progress-photos")
      .createSignedUrl(imagePath, 60 * 10);

    if (e) {
      setError(e.message);
      return null;
    }

    return data?.signedUrl || null;
  };

  const uploadProgressPhoto = async (file) => {
    if (!userId || !file) return;

    setUploadingPhoto(true);
    setError("");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const taken =
      photoTakenOn && /^\d{4}-\d{2}-\d{2}$/.test(photoTakenOn)
        ? photoTakenOn
        : formatISO(new Date());

    const filename = `${crypto.randomUUID()}.${safeExt}`;
    const path = `${userId}/${taken}/${filename}`;

    const { error: upErr } = await supabase.storage
      .from("progress-photos")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg"
      });

    if (upErr) {
      setUploadingPhoto(false);
      setError(upErr.message);
      return;
    }

    const { error: rowErr } = await supabase
      .from("progress_photos")
      .insert({
        user_id: userId,
        taken_on: taken,
        image_path: path,
        caption: photoCaption || null
      });

    setUploadingPhoto(false);

    if (rowErr) {
      setError(rowErr.message);
      return;
    }

    setPhotoCaption("");
    await loadPhotos(userId);
  };

  const deletePhoto = async (photo) => {
    if (!userId || !photo?.id) return;
    setError("");

    const { error: delRowErr } = await supabase
      .from("progress_photos")
      .delete()
      .eq("id", photo.id)
      .eq("user_id", userId);

    if (delRowErr) {
      setError(delRowErr.message);
      return;
    }

    const { error: delObjErr } = await supabase.storage
      .from("progress-photos")
      .remove([photo.image_path]);

    if (delObjErr) {
      setError(delObjErr.message);
    }

    await loadPhotos(userId);
  };

  const computeWeightMetrics = async (uid, ws, we) => {
    const { data: logs, error: e } = await supabase
      .from("weight_logs")
      .select("log_date, weight_kg")
      .eq("user_id", uid)
      .gte("log_date", ws)
      .lte("log_date", we)
      .order("log_date", { ascending: true });

    if (e) return { avgWeightKg: null, weightChangeKg: null };

    const arr = (logs || [])
      .map((l) => Number(l.weight_kg))
      .filter((n) => isFinite(n));
    const avg = arr.length
      ? arr.reduce((a, b) => a + b, 0) / arr.length
      : null;

    const prevWs = addDays(ws, -7);
    const prevWe = addDays(ws, -1);

    const { data: prevLogs } = await supabase
      .from("weight_logs")
      .select("weight_kg")
      .eq("user_id", uid)
      .gte("log_date", prevWs)
      .lte("log_date", prevWe);

    const prevArr = (prevLogs || [])
      .map((l) => Number(l.weight_kg))
      .filter((n) => isFinite(n));
    const prevAvg = prevArr.length
      ? prevArr.reduce((a, b) => a + b, 0) / prevArr.length
      : null;

    const change =
      avg !== null && prevAvg !== null ? avg - prevAvg : null;

    return {
      avgWeightKg: avg !== null ? round1(avg) : null,
      weightChangeKg: change !== null ? round1(change) : null
    };
  };

  const computeCaloriesAvg = async (uid, ws, we) => {
    const { data, error: e } = await supabase
      .from("daily_nutrition")
      .select("log_date, calories")
      .eq("user_id", uid)
      .gte("log_date", ws)
      .lte("log_date", we);

    if (e) return { avgCalories: null };

    const arr = (data || [])
      .map((r) => Number(r.calories))
      .filter((n) => isFinite(n) && n > 0);
    const avg = arr.length
      ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
      : null;
    return { avgCalories: avg };
  };

  const computeTrainingCompleted = async (uid, ws, we) => {
    const { data, error: e } = await supabase
      .from("training_sessions")
      .select("id")
      .eq("user_id", uid)
      .gte("session_date", ws)
      .lte("session_date", we)
      .eq("completed", true);

    if (e) return { completed: 0 };
    return { completed: (data || []).length };
  };

  const computeStepsAvg = async (uid, ws, we) => {
    const { data, error: e } = await supabase
      .from("steps_logs")
      .select("log_date, steps")
      .eq("user_id", uid)
      .gte("log_date", ws)
      .lte("log_date", we);

    if (e) return { avgSteps: 0 };

    const arr = (data || [])
      .map((r) => Number(r.steps))
      .filter((n) => isFinite(n) && n >= 0);
    const avg = arr.length
      ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
      : 0;
    return { avgSteps: avg };
  };

  const computeCardioCount = async (uid, ws, we) => {
    const { data, error: e } = await supabase
      .from("cardio_logs")
      .select("id")
      .eq("user_id", uid)
      .gte("log_date", ws)
      .lte("log_date", we);

    if (e) return { count: 0 };
    return { count: (data || []).length };
  };

  const submit = async () => {
    if (!userId || !weekStart || !weekEnd) return;
    setSubmitting(true);
    setError("");

    const payload = {
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,

      avg_weight_kg: metrics.avgWeightKg,
      weight_change_kg: metrics.weightChangeKg,
      avg_calories: metrics.avgCalories,
      training_sessions_completed: metrics.trainingCompleted,
      avg_steps: metrics.avgSteps,
      cardio_sessions: metrics.cardioSessions,

      hunger_rating: Number(form.hunger),
      energy_rating: Number(form.energy),
      performance_rating: Number(form.performance),
      recovery_rating: Number(form.recovery),
      adherence_rating: Number(form.adherence),
      notes: form.notes || ""
    };

    const { data, error: e } = await supabase
      .from("weekly_check_ins")
      .upsert(payload, { onConflict: "user_id,week_start" })
      .select("*")
      .maybeSingle();

    setSubmitting(false);

    if (e) {
      setError(e.message);
      return;
    }

    setExistingThisWeek(data);
    setSelected(data);
    await loadHistory(userId);
  };

  if (loading) {
    return (
      <div className="ci-loading">
        <style>{CSS}</style>
        <div className="ci-loading-dot" />
        <div className="ci-loading-dot" />
        <div className="ci-loading-dot" />
        <span>Loading...</span>
      </div>
    );
  }

  const weightSubClass =
    metrics.weightChangeKg === null
      ? ""
      : metrics.weightChangeKg > 0
      ? "positive"
      : metrics.weightChangeKg < 0
      ? "negative"
      : "";

  const ratingFactors = [
    { key: "hunger", label: "Hunger" },
    { key: "energy", label: "Energy" },
    { key: "performance", label: "Perf." },
    { key: "recovery", label: "Recovery" },
    { key: "adherence", label: "Adherence" }
  ];

  return (
    <div className="ci-page">
      <style>{CSS}</style>

      {/* ── Page header ── */}
      <div className="ci-page-header">
        <div className="ci-page-title-group">
          <div className="ci-accent-prefix">
            <div className="ci-accent-line" />
            <span className="ci-page-label">Check-ins</span>
          </div>
          <h1 className="ci-page-title">Check-Ins</h1>
        </div>
        <div
          className={`ci-status-badge${existingThisWeek ? " submitted" : ""}`}
        >
          {existingThisWeek ? "Submitted" : "Not Submitted"}
        </div>
      </div>

      {error && <div className="ci-error">{error}</div>}

      {/* ── Main two-column layout ── */}
      <div className="ci-main-grid">

        {/* ── LEFT: History (history) ── */}
        <div className="ci-panel">
          <div className="ci-panel-topbar">
            <span className="ci-panel-topbar-title">History</span>
            <span className="ci-panel-topbar-meta">{history.length} entries</span>
          </div>
          <div className="ci-panel-body">
            <div className="ci-history-list">
              {history.length === 0 && (
                <p className="ci-empty-state">No check-ins filed yet.</p>
              )}
              {history.map((c) => (
                <div
                  key={c.id}
                  className={`ci-history-item${selected?.id === c.id ? " active" : ""}`}
                  onClick={() => setSelected(c)}
                >
                  <div className="ci-history-date">{c.week_start}</div>
                  <div className="ci-history-meta">
                    Wt: {c.avg_weight_kg ?? "—"} kg &nbsp;·&nbsp;
                    Cal: {c.avg_calories ?? "—"} &nbsp;·&nbsp;
                    Train: {c.training_sessions_completed ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: form column ── */}
        <div className="ci-form-column">

          {/* WK-STAT // Weekly metrics */}
          <div className="ci-panel">
            <div className="ci-panel-topbar">
              <span className="ci-panel-topbar-title">WK-STAT // Weekly Summary</span>
              <span className="ci-panel-topbar-meta">
                {weekStart} &rarr; {weekEnd}
              </span>
            </div>
            <div className="ci-panel-body">
              <div className="ci-stat-grid">
                <div className="ci-readout-cell">
                  <div className={`ci-readout-value${metrics.avgWeightKg === null ? " dim" : ""}`}>
                    {metrics.avgWeightKg !== null ? `${metrics.avgWeightKg}` : "—"}
                  </div>
                  <div className="ci-readout-label">Avg Weight (kg)</div>
                  {metrics.weightChangeKg !== null && (
                    <div className={`ci-readout-sub ${weightSubClass}`}>
                      {metrics.weightChangeKg > 0 ? "+" : ""}
                      {metrics.weightChangeKg} kg vs prev wk
                    </div>
                  )}
                </div>

                <div className="ci-readout-cell">
                  <div className={`ci-readout-value${metrics.avgCalories === null ? " dim" : ""}`}>
                    {metrics.avgCalories !== null ? metrics.avgCalories : "—"}
                  </div>
                  <div className="ci-readout-label">Avg Calories</div>
                  <div className="ci-readout-sub">from daily logs</div>
                </div>

                <div className="ci-readout-cell">
                  <div className="ci-readout-value">{metrics.trainingCompleted}</div>
                  <div className="ci-readout-label">Training Sessions</div>
                  <div className="ci-readout-sub">completed</div>
                </div>

                <div className="ci-readout-cell">
                  <div className={`ci-readout-value${!metrics.avgSteps ? " dim" : ""}`}>
                    {metrics.avgSteps || "—"}
                  </div>
                  <div className="ci-readout-label">Avg Steps</div>
                  <div className="ci-readout-sub">daily average</div>
                </div>

                <div className="ci-readout-cell">
                  <div className="ci-readout-value">{metrics.cardioSessions}</div>
                  <div className="ci-readout-label">Cardio Sessions</div>
                  <div className="ci-readout-sub">logged</div>
                </div>
              </div>

              <div className="ci-stat-note">
                Readouts showing "—" indicate no data logged for that metric this week.
              </div>
            </div>
          </div>

          {/* PILOT ASSESSMENT // Subjective ratings */}
          <div className="ci-panel">
            <div className="ci-panel-topbar">
              <span className="ci-panel-topbar-title">Self Assessment</span>
              <span className="ci-panel-topbar-meta">subjective 1–5 scale</span>
            </div>
            <div className="ci-panel-body">
              <div className="ci-rating-rows">
                {ratingFactors.map(({ key, label }) => (
                  <div key={key} className="ci-rating-row">
                    <div className="ci-rating-factor">{label}</div>
                    <div className="ci-rating-pills">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          className={`ci-pill${Number(form[key]) === val ? " active" : ""}`}
                          onClick={() =>
                            setForm((f) => ({ ...f, [key]: val }))
                          }
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* NOTES */}
          <div className="ci-panel">
            <div className="ci-panel-topbar">
              <span className="ci-panel-topbar-title">Notes</span>
            </div>
            <div className="ci-panel-body">
              <textarea
                className="ci-notes-textarea"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Anything command should know — sleep quality, stress, appetite, schedule disruptions, cravings, etc."
              />
            </div>
          </div>

          {/* Save */}
          <button
            className="ci-save-btn"
            onClick={submit}
            disabled={submitting}
          >
            {submitting
              ? "Transmitting..."
              : existingThisWeek
              ? "Update Debrief"
              : "File Debrief"}
          </button>

          {/* DEBRIEF detail (selected history item) */}
          {selected && (
            <div className="ci-panel">
              <div className="ci-panel-topbar">
                <span className="ci-panel-topbar-title">
                  Debrief // {selected.week_start}
                </span>
                <span className="ci-panel-topbar-meta">
                  {selected.week_start} &rarr; {selected.week_end}
                </span>
              </div>
              <div className="ci-panel-body">
                <div className="ci-detail-metrics-grid">
                  <div className="ci-detail-cell">
                    <div className="ci-detail-cell-label">Avg Weight</div>
                    <div className="ci-detail-cell-value">
                      {selected.avg_weight_kg ?? "—"} kg
                    </div>
                  </div>
                  <div className="ci-detail-cell">
                    <div className="ci-detail-cell-label">Wt Change</div>
                    <div className="ci-detail-cell-value">
                      {selected.weight_change_kg !== null &&
                      selected.weight_change_kg !== undefined
                        ? `${selected.weight_change_kg > 0 ? "+" : ""}${selected.weight_change_kg} kg`
                        : "—"}
                    </div>
                  </div>
                  <div className="ci-detail-cell">
                    <div className="ci-detail-cell-label">Avg Calories</div>
                    <div className="ci-detail-cell-value">
                      {selected.avg_calories ?? "—"}
                    </div>
                  </div>
                  <div className="ci-detail-cell">
                    <div className="ci-detail-cell-label">Training</div>
                    <div className="ci-detail-cell-value">
                      {selected.training_sessions_completed ?? 0}
                    </div>
                  </div>
                  <div className="ci-detail-cell">
                    <div className="ci-detail-cell-label">Avg Steps</div>
                    <div className="ci-detail-cell-value">
                      {selected.avg_steps ?? 0}
                    </div>
                  </div>
                  <div className="ci-detail-cell">
                    <div className="ci-detail-cell-label">Cardio</div>
                    <div className="ci-detail-cell-value">
                      {selected.cardio_sessions ?? 0}
                    </div>
                  </div>
                </div>

                <div className="ci-detail-section-label">Ratings</div>
                <div className="ci-detail-ratings">
                  {[
                    { label: "Hunger", val: selected.hunger_rating },
                    { label: "Energy", val: selected.energy_rating },
                    { label: "Perf.", val: selected.performance_rating },
                    { label: "Recovery", val: selected.recovery_rating },
                    { label: "Adherence", val: selected.adherence_rating }
                  ].map(({ label, val }) => (
                    <div key={label} className="ci-detail-rating-chip">
                      <div className="ci-detail-rating-chip-label">{label}</div>
                      <div className="ci-detail-rating-chip-val">
                        {val ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ci-detail-section-label">Notes</div>
                <div className="ci-detail-notes">
                  {selected.notes || "—"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Visual Log (photos) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: "1rem",
          alignItems: "start"
        }}
        className="ci-main-grid"
      >
        {/* Upload panel */}
        <div className="ci-panel">
          <div className="ci-panel-topbar">
            <span className="ci-panel-topbar-title">Visual Log // Upload</span>
          </div>
          <div className="ci-panel-body">
            <div className="ci-photo-upload-fields">
              <div>
                <label className="ci-field-label">Taken on</label>
                <input
                  type="date"
                  className="ci-field-input"
                  value={photoTakenOn}
                  onChange={(e) => setPhotoTakenOn(e.target.value)}
                />
              </div>

              <div>
                <label className="ci-field-label">Caption (optional)</label>
                <input
                  type="text"
                  className="ci-field-input"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="e.g. morning fasted, post-carb-up"
                />
              </div>

              <div>
                <label className="ci-field-label">Choose Image</label>
                <label
                  className={`ci-file-upload-btn${uploadingPhoto ? " disabled" : ""}`}
                  style={{ pointerEvents: uploadingPhoto ? "none" : "auto" }}
                >
                  <span style={{ fontSize: "1rem", opacity: 0.7 }}>+</span>
                  <span>Select file</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadProgressPhoto(f);
                      e.target.value = "";
                    }}
                    disabled={uploadingPhoto}
                  />
                </label>
                <div className="ci-upload-status" style={{ marginTop: "0.4rem" }}>
                  JPG / PNG / WEBP &nbsp;·&nbsp; max 50 MB
                </div>
              </div>

              <div className={`ci-upload-status${uploadingPhoto ? " active" : ""}`}>
                {uploadingPhoto ? "Uploading image..." : "\u00a0"}
              </div>
            </div>
          </div>
        </div>

        {/* Photo grid */}
        <div className="ci-panel">
          <div className="ci-panel-topbar">
            <span className="ci-panel-topbar-title">Visual Log</span>
            <span className="ci-panel-topbar-meta">
              {photos.length} {photos.length === 1 ? "photo" : "photos"}
            </span>
          </div>
          <div className="ci-panel-body">
            {photos.length === 0 ? (
              <p className="ci-empty-state">No photos uploaded yet.</p>
            ) : (
              <div className="ci-photo-grid">
                {photos.map((p) => (
                  <div key={p.id} className="ci-photo-thumb">
                    <button
                      className="ci-photo-thumb-btn"
                      onClick={async () => {
                        const url = await getPhotoSignedUrl(p.image_path);
                        if (url) setSelectedPhotoUrl(url);
                      }}
                      title="Open photo"
                    >
                      <div className="ci-photo-thumb-inner">
                        <span className="ci-photo-thumb-icon">&#9654;</span>
                        <span className="ci-photo-thumb-view-label">View</span>
                      </div>
                      <div className="ci-photo-thumb-date-overlay">
                        {p.taken_on}
                      </div>
                    </button>

                    <div className="ci-photo-thumb-meta">
                      <div className="ci-photo-thumb-taken">{p.taken_on}</div>
                      {p.caption && (
                        <div className="ci-photo-thumb-caption">
                          {p.caption}
                        </div>
                      )}
                    </div>

                    <button
                      className="ci-photo-delete-btn"
                      onClick={() => deletePhoto(p)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Photo modal ── */}
      {selectedPhotoUrl && (
        <div
          className="ci-modal-overlay"
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <div
            className="ci-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ci-modal-header">
              <span className="ci-modal-title">Visual Log // Progress Photo</span>
              <button
                className="ci-modal-close"
                onClick={() => setSelectedPhotoUrl(null)}
              >
                Close
              </button>
            </div>
            <img
              src={selectedPhotoUrl}
              alt="Progress"
              className="ci-modal-img"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckIns;
