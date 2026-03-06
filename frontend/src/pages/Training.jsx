import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const CSS = `
  .trn-page {
    max-width: 100%;
  }

  /* ── Page header ── */
  .trn-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .trn-header-left {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .trn-page-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .trn-page-label-bar {
    width: 20px;
    height: 2px;
    background: var(--accent-2);
    flex-shrink: 0;
    box-shadow: 0 0 8px var(--accent-2);
  }

  .trn-page-title {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-1);
    margin: 0;
  }

  .trn-page-sub {
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text-3);
    letter-spacing: 0.04em;
    padding-left: calc(20px + 0.75rem);
  }

  .trn-status {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    background: rgba(10,5,8,0.6);
    white-space: nowrap;
    align-self: flex-start;
    margin-top: 0.15rem;
  }

  .trn-status.busy {
    color: var(--warn);
    border-color: rgba(229,161,0,0.3);
    box-shadow: 0 0 8px rgba(229,161,0,0.12);
  }

  /* ── Error bar ── */
  .trn-error {
    font-family: var(--font-body);
    font-size: 0.82rem;
    color: var(--bad);
    background: rgba(255,79,115,0.08);
    border: 1px solid rgba(255,79,115,0.25);
    border-radius: var(--radius-sm);
    padding: 0.6rem 0.9rem;
    margin-bottom: 1rem;
  }

  /* ── Day selector — desktop ── */
  .trn-day-strip {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .trn-day-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.6rem 0.9rem 0.55rem;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    min-width: 62px;
    position: relative;
    transition: all var(--motion-fast) ease;
  }

  .trn-day-btn:hover {
    border-color: var(--line-2);
    color: var(--text-2);
    background: rgba(138,15,46,0.1);
  }

  .trn-day-btn.active {
    background: linear-gradient(135deg, rgba(181,21,60,0.35), rgba(138,15,46,0.25));
    border: 1px solid var(--accent-2);
    color: var(--text-1);
    box-shadow: 0 0 12px rgba(181,21,60,0.2);
  }

  .trn-day-abbr {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .trn-day-num {
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1;
  }

  .trn-day-dot-row {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 6px;
    margin-top: 0.1rem;
  }

  .trn-day-dot {
    width: 4px;
    height: 4px;
    border-radius: 99px;
    background: var(--ok);
    box-shadow: 0 0 4px var(--ok);
  }

  .trn-day-dot.rest {
    background: rgba(229,161,0,0.55);
    box-shadow: 0 0 4px rgba(229,161,0,0.3);
  }

  .trn-day-dot.none {
    background: transparent;
  }

  /* ── Day selector — mobile select ── */
  .trn-day-select {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(10,5,8,0.9) !important;
    color: var(--text-1) !important;
    border: 1px solid var(--line-1) !important;
    border-radius: var(--radius-md) !important;
    font-family: var(--font-body);
    font-size: 0.9rem;
    margin-bottom: 1.25rem;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a7f89' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 1rem center !important;
    padding-right: 2.5rem !important;
  }

  .trn-day-select:focus {
    border-color: var(--accent-3) !important;
    box-shadow: 0 0 0 2px rgba(222,41,82,0.18), 0 0 12px rgba(222,41,82,0.15) !important;
    outline: none;
  }

  /* ── Loading state ── */
  .trn-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .trn-loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background: var(--accent-2);
    animation: trnPulse 1.2s ease-in-out infinite;
  }

  @keyframes trnPulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 8px var(--accent-2); }
  }

  /* ── Session card shell ── */
  .trn-session-card {
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    border: 1px solid var(--line-1);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: 0 10px 28px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.015);
  }

  .trn-session-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.7rem 1rem;
    background: rgba(181,21,60,0.07);
    border-bottom: 1px solid var(--line-1);
    flex-wrap: wrap;
  }

  .trn-session-topbar-left {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .trn-session-id {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-3);
    font-weight: 700;
  }

  .trn-session-date {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    color: var(--text-3);
  }

  .trn-day-type-badge {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-3);
    border: 1px solid var(--line-2);
    border-radius: 99px;
    padding: 0.2rem 0.6rem;
    background: rgba(222,41,82,0.07);
    white-space: nowrap;
  }

  .trn-session-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ── Settings section ── */
  .trn-settings-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .trn-settings-label {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .trn-toggle-btn {
    padding: 0.48rem 0.9rem;
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: rgba(10,5,8,0.7);
    color: var(--text-2);
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--motion-fast) ease;
  }

  .trn-toggle-btn:hover:not(:disabled) {
    border-color: var(--accent-3);
    color: var(--text-1);
    box-shadow: 0 0 10px rgba(222,41,82,0.15);
  }

  .trn-toggle-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .trn-field-label {
    font-family: var(--font-display);
    font-size: 0.63rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 0.35rem;
  }

  .trn-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.65rem;
    background: rgba(10,5,8,0.9) !important;
    border: 1px solid var(--line-1) !important;
    color: var(--text-1) !important;
    border-radius: var(--radius-sm) !important;
    font-family: var(--font-body);
    font-size: 0.88rem;
  }

  .trn-input:focus {
    border-color: var(--accent-3) !important;
    box-shadow: 0 0 0 2px rgba(222,41,82,0.16) !important;
    outline: none;
  }

  .trn-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.65rem;
    background: rgba(10,5,8,0.9) !important;
    border: 1px solid var(--line-1) !important;
    color: var(--text-1) !important;
    border-radius: var(--radius-sm) !important;
    font-family: var(--font-body);
    font-size: 0.88rem;
    min-height: 90px;
    resize: vertical;
  }

  .trn-textarea:focus {
    border-color: var(--accent-3) !important;
    box-shadow: 0 0 0 2px rgba(222,41,82,0.16) !important;
    outline: none;
  }

  /* ── Exercises section ── */
  .trn-exercises-section {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    margin-top: 0.25rem;
  }

  .trn-exercises-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .trn-exercises-label {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .trn-exercises-count {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    color: var(--accent-3);
    border: 1px solid rgba(222,41,82,0.2);
    border-radius: 99px;
    padding: 0.1rem 0.45rem;
    background: rgba(222,41,82,0.06);
  }

  /* ── Add exercise row ── */
  .trn-add-exercise-row {
    display: flex;
    gap: 0.5rem;
  }

  .trn-add-exercise-input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.65rem;
    background: rgba(10,5,8,0.9) !important;
    border: 1px solid var(--line-1) !important;
    color: var(--text-1) !important;
    border-radius: var(--radius-sm) !important;
    font-family: var(--font-body);
    font-size: 0.88rem;
  }

  .trn-add-exercise-input:focus {
    border-color: var(--accent-3) !important;
    box-shadow: 0 0 0 2px rgba(222,41,82,0.16) !important;
    outline: none;
  }

  .trn-add-exercise-btn {
    padding: 0.5rem 1.1rem;
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-1), rgba(138,15,46,0.85));
    color: var(--text-1);
    border: 1px solid var(--accent-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 0 12px rgba(181,21,60,0.2);
    transition: all var(--motion-fast) ease;
  }

  .trn-add-exercise-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--accent-2), var(--accent-1));
    box-shadow: 0 0 18px rgba(181,21,60,0.35);
  }

  .trn-add-exercise-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* ── Empty exercises state ── */
  .trn-empty-exercises {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem 1rem;
    border: 1px dashed var(--line-1);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .trn-empty-exercises-label {
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .trn-empty-exercises-sub {
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text-3);
    opacity: 0.7;
  }

  /* ── Exercise sub-card ── */
  .trn-exercise-card {
    background: rgba(10,5,8,0.7);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: border-color var(--motion-fast) ease;
  }

  .trn-exercise-card:hover {
    border-color: var(--line-2);
  }

  .trn-exercise-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: rgba(181,21,60,0.04);
    border-bottom: 1px solid var(--line-1);
  }

  .trn-exercise-name {
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--text-1);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trn-exercise-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .trn-move-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    color: var(--text-3);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all var(--motion-fast) ease;
  }

  .trn-move-btn:hover:not(:disabled) {
    border-color: var(--line-2);
    color: var(--text-2);
  }

  .trn-move-btn:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .trn-delete-exercise-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    color: var(--bad);
    border: 1px solid rgba(255,79,115,0.22);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 700;
    transition: all var(--motion-fast) ease;
  }

  .trn-delete-exercise-btn:hover:not(:disabled) {
    background: rgba(255,79,115,0.1);
    border-color: rgba(255,79,115,0.5);
    box-shadow: 0 0 8px rgba(255,79,115,0.2);
  }

  .trn-delete-exercise-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* ── Sets table ── */
  .trn-sets-body {
    padding: 0.75rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .trn-sets-table-head {
    display: grid;
    grid-template-columns: 44px 1fr 1fr 1fr 32px;
    gap: 0.4rem;
    padding: 0 0 0.35rem 0;
    border-bottom: 1px solid var(--line-1);
    margin-bottom: 0.1rem;
  }

  .trn-sets-th {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .trn-sets-th.center {
    text-align: center;
  }

  .trn-set-row {
    display: grid;
    grid-template-columns: 44px 1fr 1fr 1fr 32px;
    gap: 0.4rem;
    align-items: center;
  }

  .trn-set-num {
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.05em;
    color: var(--accent-3);
    text-align: center;
  }

  .trn-set-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.42rem 0.5rem;
    background: rgba(10,5,8,0.9) !important;
    border: 1px solid var(--line-1) !important;
    color: var(--text-1) !important;
    border-radius: var(--radius-sm) !important;
    font-family: var(--font-body);
    font-size: 0.84rem;
    text-align: center;
  }

  .trn-set-input:focus {
    border-color: var(--accent-3) !important;
    box-shadow: 0 0 0 2px rgba(222,41,82,0.16) !important;
    outline: none;
  }

  .trn-delete-set-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    color: var(--bad);
    border: 1px solid rgba(255,79,115,0.18);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 700;
    flex-shrink: 0;
    transition: all var(--motion-fast) ease;
  }

  .trn-delete-set-btn:hover {
    background: rgba(255,79,115,0.1);
    border-color: rgba(255,79,115,0.45);
  }

  .trn-add-set-btn {
    align-self: flex-start;
    margin-top: 0.25rem;
    padding: 0.38rem 0.85rem;
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    background: transparent;
    color: var(--text-3);
    border: 1px dashed var(--line-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--motion-fast) ease;
  }

  .trn-add-set-btn:hover:not(:disabled) {
    color: var(--accent-3);
    border-color: var(--accent-3);
    border-style: solid;
    background: rgba(222,41,82,0.05);
  }

  .trn-add-set-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* ── Rest day state ── */
  .trn-rest-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3.5rem 1rem;
    gap: 0.5rem;
    text-align: center;
  }

  .trn-rest-label {
    font-family: var(--font-display);
    font-size: 3rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--line-2);
    line-height: 1;
  }

  .trn-rest-sub {
    font-family: var(--font-display);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-top: 0.35rem;
  }

  /* ── No session card ── */
  .trn-no-session-card {
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    border: 1px solid var(--line-1);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    box-shadow: 0 10px 28px rgba(0,0,0,0.4);
  }

  .trn-no-session-title {
    font-family: var(--font-display);
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-2);
    margin-bottom: 0.4rem;
  }

  .trn-no-session-sub {
    font-family: var(--font-body);
    font-size: 0.82rem;
    color: var(--text-3);
    line-height: 1.5;
    margin-bottom: 1rem;
  }

  .trn-no-session-actions {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .trn-create-training-btn {
    padding: 0.6rem 1.1rem;
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-1), rgba(138,15,46,0.8));
    color: var(--text-1);
    border: 1px solid var(--accent-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    box-shadow: 0 0 12px rgba(181,21,60,0.2);
    transition: all var(--motion-fast) ease;
  }

  .trn-create-training-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--accent-2), var(--accent-1));
    box-shadow: 0 0 18px rgba(181,21,60,0.35);
  }

  .trn-create-training-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .trn-create-rest-btn {
    padding: 0.6rem 1.1rem;
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    font-weight: 700;
    background: transparent;
    color: var(--text-2);
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--motion-fast) ease;
  }

  .trn-create-rest-btn:hover:not(:disabled) {
    border-color: rgba(229,161,0,0.45);
    color: var(--warn);
  }

  .trn-create-rest-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* ── Divider line ── */
  .trn-divider {
    height: 1px;
    background: var(--line-1);
    margin: 0 -1rem;
  }

  @media (max-width: 520px) {
    .trn-sets-table-head,
    .trn-set-row {
      grid-template-columns: 36px 1fr 1fr 1fr 28px;
      gap: 0.3rem;
    }

    .trn-rest-label {
      font-size: 2.1rem;
    }

    .trn-exercise-name {
      font-size: 0.85rem;
    }
  }
`;

const todayISO = () => new Date().toISOString().slice(0, 10);

const pad2 = (n) => String(n).padStart(2, "0");

const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const isoToDow = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
};

const DOW_ABBR = {
  Mon: "MON", Tue: "TUE", Wed: "WED", Thu: "THU",
  Fri: "FRI", Sat: "SAT", Sun: "SUN"
};

const fmtDateShort = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function Training() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [weekSessionsByDate, setWeekSessionsByDate] = useState({});

  const [session, setSession] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [setsByExercise, setSetsByExercise] = useState({});

  const [newExerciseName, setNewExerciseName] = useState("");

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const week = useMemo(() => {
    const t = todayISO();
    const start = t;

    return Array.from({ length: 7 }).map((_, i) => {
      const iso = addDaysISO(start, i);
      const d = new Date(`${iso}T00:00:00`);
      const rawLabel = isoToDow(iso);
      return {
        iso,
        label: rawLabel,
        abbr: DOW_ABBR[rawLabel] || rawLabel.toUpperCase().slice(0, 3),
        day: d.getDate(),
        isToday: iso === t
      };
    });
  }, []);

  const daysBetweenISO = (aISO, bISO) => {
    const a = new Date(`${aISO}T00:00:00Z`);
    const b = new Date(`${bISO}T00:00:00Z`);
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const normalizeRollingPattern = (raw) => {
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.pattern)
        ? raw.pattern
        : Array.isArray(raw?.days)
          ? raw.days
          : Array.isArray(raw?.sequence)
            ? raw.sequence
            : null;

    if (!arr) return null;

    const norm = arr
      .map((v) => {
        if (typeof v === "boolean") return v;
        if (typeof v === "number") return v > 0;
        const s = String(v || "").toLowerCase().trim();
        if (!s) return false;
        if (s === "t" || s === "train" || s === "training" || s === "workout" || s === "lift") return true;
        if (s === "r" || s === "rest" || s === "off") return false;
        return false;
      })
      .filter((x) => typeof x === "boolean");

    return norm.length ? norm : null;
  };

  const logSyncErr = (context, err) => {
    console.warn(`[training day-type sync] ${context}`, err);
  };

  const isIgnorableSyncError = (err) => {
    const msg = String(err?.message || err || "");
    return (
      msg.includes("Failed to fetch") ||
      msg.includes("schema cache") ||
      msg.includes("Could not find the table") ||
      msg.includes("permission") ||
      msg.includes("not allowed") ||
      msg.includes("status of 400") ||
      msg.includes("status of 401") ||
      msg.includes("status of 403") ||
      msg.includes("status of 404")
    );
  };

  const persistDayTypeForDate = async (uid, dateISO, dayType) => {
    if (!uid || !dateISO) return;
    if (persistDayTypeForDate._disabled) return;

    const cleanType = dayType === "high" ? "high" : dayType === "training" ? "training" : "rest";
    const row = { user_id: uid, date: dateISO, override_type: cleanType };

    try {
      const { data: existing, error: selErr } = await supabase
        .from("training_day_overrides")
        .select("id")
        .eq("user_id", uid)
        .eq("date", dateISO)
        .maybeSingle();

      if (selErr && selErr.code !== "PGRST116") {
        logSyncErr("select existing override", selErr);
        if (isIgnorableSyncError(selErr)) persistDayTypeForDate._disabled = true;
        return;
      }

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("training_day_overrides")
          .update({ override_type: cleanType })
          .eq("id", existing.id)
          .eq("user_id", uid);

        if (updErr) {
          logSyncErr("update override", updErr);
          if (isIgnorableSyncError(updErr)) persistDayTypeForDate._disabled = true;
        }
        return;
      }

      const { error: insErr } = await supabase.from("training_day_overrides").insert(row);
      if (insErr) {
        logSyncErr("insert override", insErr);
        if (isIgnorableSyncError(insErr)) persistDayTypeForDate._disabled = true;
      }
    } catch (e) {
      logSyncErr("unexpected", e);
      if (isIgnorableSyncError(e)) persistDayTypeForDate._disabled = true;
    }
  };

  const persistManyDayTypes = async (uid, rows) => {
    if (!uid || !Array.isArray(rows) || !rows.length) return;
    if (persistDayTypeForDate._disabled) return;

    const payload = rows.map((r) => ({
      user_id: uid,
      date: r.dateISO,
      override_type: r.dayType === "high" ? "high" : r.dayType === "training" ? "training" : "rest"
    }));

    try {
      const { error: upErr } = await supabase
        .from("training_day_overrides")
        .upsert(payload, { onConflict: "user_id,date" });

      if (upErr) {
        logSyncErr("bulk upsert overrides", upErr);
        if (isIgnorableSyncError(upErr)) persistDayTypeForDate._disabled = true;
      }
    } catch (e) {
      logSyncErr("bulk upsert unexpected", e);
      if (isIgnorableSyncError(e)) persistDayTypeForDate._disabled = true;
    }
  };

  const preloadWeekFromProfile = async (uid) => {
    if (preloadWeekFromProfile._didPersistOnce) return;
    preloadWeekFromProfile._didPersistOnce = true;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select(
        "split_mode, training_days, rolling_start_date, rolling_pattern, rolling_cycle_length, training_frequency_range"
      )
      .eq("user_id", uid)
      .maybeSingle();

    if (pErr && pErr.code !== "PGRST116") {
      setError(pErr.message);
      return;
    }

    const splitMode = profile?.split_mode || "fixed";
    const fixedDays = Array.isArray(profile?.training_days) ? profile.training_days : [];

    const rollingStart = profile?.rolling_start_date
      ? String(profile.rolling_start_date)
      : todayISO();

    const rollingPattern = normalizeRollingPattern(profile?.rolling_pattern);

    if (splitMode === "rolling" && !rollingPattern) {
      return;
    }

    const cycleLen = (() => {
      if (Array.isArray(rollingPattern)) return rollingPattern.length;
      const n = Number(profile?.rolling_cycle_length);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 7;
    })();

    const isTrainingForDate = (dateISO) => {
      if (splitMode !== "rolling") {
        const dow = isoToDow(dateISO);
        return fixedDays.includes(dow);
      }
      const delta = daysBetweenISO(rollingStart, dateISO);
      const idx = ((delta % cycleLen) + cycleLen) % cycleLen;
      return Boolean(rollingPattern[idx]);
    };

    const dates = week.map((d) => d.iso);

    await persistManyDayTypes(
      uid,
      dates.map((d) => ({ dateISO: d, dayType: isTrainingForDate(d) ? "training" : "rest" }))
    );

    const { data: existing, error: exErr } = await supabase
      .from("training_sessions")
      .select("session_date")
      .eq("user_id", uid)
      .in("session_date", dates);

    if (exErr) {
      setError(exErr.message);
      return;
    }

    const existingSet = new Set((existing || []).map((r) => r.session_date));

    const rowsToInsert = dates
      .filter((d) => !existingSet.has(d))
      .filter((d) => isTrainingForDate(d))
      .map((d) => ({
        user_id: uid,
        session_date: d,
        is_rest_day: false,
        name: "Training (Unassigned)",
        notes: ""
      }));

    if (!rowsToInsert.length) return;

    const { error: insErr } = await supabase.from("training_sessions").insert(rowsToInsert);
    if (insErr) {
      setError(insErr.message);
      return;
    }

    await fetchWeekSessions(uid);

    if (selectedDate === todayISO()) {
      await loadDay(uid, selectedDate);
    }
  };

  const fetchWeekSessions = async (uid) => {
    const start = week[0].iso;
    const endExclusive = addDaysISO(week[6].iso, 1);

    const { data, error: e } = await supabase
      .from("training_sessions")
      .select("id, session_date, is_rest_day, name")
      .eq("user_id", uid)
      .gte("session_date", start)
      .lt("session_date", endExclusive);

    if (e) {
      setError(e.message);
      return;
    }

    const map = {};
    (data || []).forEach((s) => {
      map[s.session_date] = s;
    });
    setWeekSessionsByDate(map);
  };

  const loadDay = async (uid, dateISO) => {
    setError("");

    const { data: sData, error: sErr } = await supabase
      .from("training_sessions")
      .select("id, session_date, is_rest_day, notes, name")
      .eq("user_id", uid)
      .eq("session_date", dateISO)
      .maybeSingle();

    if (sErr && sErr.code !== "PGRST116") {
      setError(sErr.message);
      setSession(null);
      setExercises([]);
      setSetsByExercise({});
      return;
    }

    if (!sData) {
      setSession(null);
      setExercises([]);
      setSetsByExercise({});
      await syncTodayDayTypeToProfile(null);
      await persistDayTypeForDate(uid, dateISO, "rest");
      return;
    }

    setSession(sData);

    const { data: eData, error: eErr } = await supabase
      .from("training_exercises")
      .select("id, name, sort_order")
      .eq("user_id", uid)
      .eq("session_id", sData.id)
      .order("sort_order", { ascending: true });

    if (eErr) {
      setError(eErr.message);
      setExercises([]);
      setSetsByExercise({});
      return;
    }

    setExercises(eData || []);

    const exerciseIds = (eData || []).map((e) => e.id);
    if (!exerciseIds.length) {
      setSetsByExercise({});
      return;
    }

    const { data: setData, error: setErr } = await supabase
      .from("training_sets")
      .select("id, exercise_id, set_number, reps, weight, rir")
      .eq("user_id", uid)
      .in("exercise_id", exerciseIds)
      .order("set_number", { ascending: true });

    if (setErr) {
      setError(setErr.message);
      setSetsByExercise({});
      return;
    }

    const grouped = {};
    for (const row of setData || []) {
      if (!grouped[row.exercise_id]) grouped[row.exercise_id] = [];
      grouped[row.exercise_id].push(row);
    }
    setSetsByExercise(grouped);
  };

  const createSession = async (mode) => {
    if (!userId) return;
    setBusy(true);
    setError("");

    const payload = {
      user_id: userId,
      session_date: selectedDate,
      is_rest_day: mode === "rest",
      name: mode === "rest" ? "Rest Day" : "",
      notes: ""
    };

    const { data, error: e } = await supabase
      .from("training_sessions")
      .insert(payload)
      .select("id, session_date, is_rest_day, notes, name")
      .single();

    setBusy(false);

    if (e) {
      setError(e.message);
      return;
    }

    setSession(data);
    setExercises([]);
    setSetsByExercise({});
    await syncTodayDayTypeToProfile(data);
    await persistDayTypeForDate(userId, selectedDate, data.is_rest_day ? "rest" : "training");
    await fetchWeekSessions(userId);
  };

  const syncTodayDayTypeToProfile = async (nextSession) => {
    const t = todayISO();
    if (!userId) return;
    if (selectedDate !== t) return;

    if (!nextSession) {
      await supabase
        .from("profiles")
        .update({
          today_day_type: null,
          today_day_type_date: null,
          training_day_type_override: false,
          nutrition_day_type_override: false
        })
        .eq("user_id", userId);
      return;
    }

    const dayType = nextSession.is_rest_day ? "rest" : "training";

    await supabase
      .from("profiles")
      .update({
        today_day_type: dayType,
        today_day_type_date: t,
        training_day_type_override: true,
        nutrition_day_type_override: true
      })
      .eq("user_id", userId);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError("");

      const { data, error: e } = await supabase.auth.getUser();
      if (e || !data?.user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      await fetchWeekSessions(uid);
      await preloadWeekFromProfile(uid);
      await fetchWeekSessions(uid);
      await loadDay(uid, selectedDate);

      setLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadDay(userId, selectedDate);
  }, [selectedDate, userId]);

  const toggleRestDay = async () => {
    if (!userId || !session) return;
    setBusy(true);
    setError("");

    const next = !session.is_rest_day;

    const { error: e } = await supabase
      .from("training_sessions")
      .update({ is_rest_day: next })
      .eq("id", session.id)
      .eq("user_id", userId);

    setBusy(false);

    if (e) {
      setError(e.message);
      return;
    }

    setSession({ ...session, is_rest_day: next });
    await syncTodayDayTypeToProfile({ ...session, is_rest_day: next });
    await persistDayTypeForDate(userId, selectedDate, next ? "rest" : "training");
    await fetchWeekSessions(userId);
  };

  const saveNotes = async (val) => {
    if (!userId || !session) return;
    setSession({ ...session, notes: val });

    const { error: e } = await supabase
      .from("training_sessions")
      .update({ notes: val })
      .eq("id", session.id)
      .eq("user_id", userId);

    if (e) setError(e.message);
  };

  const addExercise = async () => {
    if (!userId || !session) return;
    const name = newExerciseName.trim();
    if (!name) return;

    setBusy(true);
    setError("");

    const sortOrder = exercises.length
      ? Math.max(...exercises.map((x) => Number(x.sort_order) || 0)) + 1
      : 0;

    const { data, error: e } = await supabase
      .from("training_exercises")
      .insert({
        user_id: userId,
        session_id: session.id,
        name,
        sort_order: sortOrder
      })
      .select("id, name, sort_order")
      .single();

    setBusy(false);

    if (e) {
      setError(e.message);
      return;
    }

    setExercises([...exercises, data]);
    setSetsByExercise({ ...setsByExercise, [data.id]: [] });
    setNewExerciseName("");
  };

  const deleteExercise = async (exerciseId) => {
    if (!userId) return;
    setBusy(true);
    setError("");

    const { error: e } = await supabase
      .from("training_exercises")
      .delete()
      .eq("id", exerciseId)
      .eq("user_id", userId);

    setBusy(false);

    if (e) {
      setError(e.message);
      return;
    }

    const nextExercises = exercises.filter((x) => x.id !== exerciseId);
    const nextSets = { ...setsByExercise };
    delete nextSets[exerciseId];
    setExercises(nextExercises);
    setSetsByExercise(nextSets);
  };

  const moveExercise = async (exerciseId, dir) => {
    const idx = exercises.findIndex((x) => x.id === exerciseId);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= exercises.length) return;

    const a = exercises[idx];
    const b = exercises[j];

    const swapped = exercises.slice();
    swapped[idx] = b;
    swapped[j] = a;

    const normalized = swapped.map((ex, i) => ({ ...ex, sort_order: i }));
    setExercises(normalized);

    setBusy(true);
    setError("");

    const updates = normalized.map((ex) =>
      supabase
        .from("training_exercises")
        .update({ sort_order: ex.sort_order })
        .eq("id", ex.id)
        .eq("user_id", userId)
    );

    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error)?.error;

    setBusy(false);

    if (firstErr) setError(firstErr.message);
  };

  const addSet = async (exerciseId) => {
    if (!userId) return;
    setError("");

    const existing = setsByExercise[exerciseId] || [];
    const nextNumber = existing.length
      ? Math.max(...existing.map((s) => Number(s.set_number) || 0)) + 1
      : 1;

    const { data, error: e } = await supabase
      .from("training_sets")
      .insert({
        user_id: userId,
        exercise_id: exerciseId,
        set_number: nextNumber,
        reps: null,
        weight: null,
        rir: null
      })
      .select("id, exercise_id, set_number, reps, weight, rir")
      .single();

    if (e) {
      setError(e.message);
      return;
    }

    setSetsByExercise({
      ...setsByExercise,
      [exerciseId]: [...existing, data]
    });
  };

  const updateSetLocal = (exerciseId, setId, patch) => {
    const list = setsByExercise[exerciseId] || [];
    const next = list.map((s) => (s.id === setId ? { ...s, ...patch } : s));
    setSetsByExercise({ ...setsByExercise, [exerciseId]: next });
  };

  const saveSet = async (exerciseId, setRow) => {
    if (!userId) return;

    const reps = setRow.reps === "" ? null : Number(setRow.reps);
    const weight = setRow.weight === "" ? null : Number(setRow.weight);
    const rir = setRow.rir === "" ? null : Number(setRow.rir);

    const clean = {
      reps: Number.isFinite(reps) ? reps : null,
      weight: Number.isFinite(weight) ? weight : null,
      rir: Number.isFinite(rir) ? rir : null
    };

    const { error: e } = await supabase
      .from("training_sets")
      .update(clean)
      .eq("id", setRow.id)
      .eq("user_id", userId);

    if (e) setError(e.message);
  };

  const deleteSet = async (exerciseId, setId) => {
    if (!userId) return;
    setError("");

    const { error: e } = await supabase
      .from("training_sets")
      .delete()
      .eq("id", setId)
      .eq("user_id", userId);

    if (e) {
      setError(e.message);
      return;
    }

    const list = setsByExercise[exerciseId] || [];
    const next = list.filter((s) => s.id !== setId);
    const renumbered = next.map((s, i) => ({ ...s, set_number: i + 1 }));
    setSetsByExercise({ ...setsByExercise, [exerciseId]: renumbered });

    const updates = renumbered.map((s) =>
      supabase
        .from("training_sets")
        .update({ set_number: s.set_number })
        .eq("id", s.id)
        .eq("user_id", userId)
    );

    await Promise.all(updates);
  };

  const hasAssignment = (dateISO) => !!weekSessionsByDate[dateISO];

  const dayBadge = (dateISO) => {
    const s = weekSessionsByDate[dateISO];
    if (!s) return "Unassigned";
    if (s.is_rest_day) return "Rest";
    return s.name || "Training";
  };

  const dotClass = (dateISO) => {
    const s = weekSessionsByDate[dateISO];
    if (!s) return "none";
    if (s.is_rest_day) return "rest";
    return "active";
  };

  const sessionDayName = () => {
    if (!session) return "";
    const d = new Date(`${selectedDate}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase();
  };

  const sessionBadgeText = () => {
    if (!session) return null;
    if (session.is_rest_day) return "REST";
    const name = (session.name || "").trim().toUpperCase();
    if (!name || name === "TRAINING (UNASSIGNED)") return null;
    return name;
  };

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="trn-loading">
          <div className="trn-loading-dot" />
          Initialising Training Engine
        </div>
      </>
    );
  }

  const badge = sessionBadgeText();

  return (
    <>
      <style>{CSS}</style>
      <div className="trn-page">

        {/* ── Page header ── */}
        <div className="trn-header">
          <div className="trn-header-left">
            <div className="trn-page-label">
              <div className="trn-page-label-bar" />
              <h1 className="trn-page-title">Training Engine</h1>
            </div>
            <div className="trn-page-sub">
              {selectedDate === todayISO() ? "Today" : fmtDateShort(selectedDate)}
              {" · "}
              {session?.name || dayBadge(selectedDate)}
            </div>
          </div>
          <div className={`trn-status${busy ? " busy" : ""}`}>
            {busy ? "Saving..." : "Synced"}
          </div>
        </div>

        {/* ── Error ── */}
        {error && <div className="trn-error">{error}</div>}

        {/* ── Day selector ── */}
        {isMobile ? (
          <select
            className="trn-day-select"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            {week.map((d) => (
              <option key={d.iso} value={d.iso}>
                {d.abbr} {d.day} — {dayBadge(d.iso)}
              </option>
            ))}
          </select>
        ) : (
          <div className="trn-day-strip">
            {week.map((d) => {
              const dc = dotClass(d.iso);
              return (
                <button
                  key={d.iso}
                  className={`trn-day-btn${d.iso === selectedDate ? " active" : ""}`}
                  onClick={() => setSelectedDate(d.iso)}
                >
                  <span className="trn-day-abbr">{d.abbr}</span>
                  <span className="trn-day-num">{d.day}</span>
                  <div className="trn-day-dot-row">
                    {dc !== "none" && (
                      <div className={`trn-day-dot${dc === "rest" ? " rest" : ""}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── No session ── */}
        {!session && (
          <div className="trn-no-session-card">
            <div className="trn-no-session-title">No Session Assigned</div>
            <div className="trn-no-session-sub">
              Your onboarding schedule preloads the next 7 days. You can still create or edit a day manually here.
            </div>
            <div className="trn-no-session-actions">
              <button
                className="trn-create-training-btn"
                onClick={() => createSession("training")}
                disabled={busy}
              >
                Create Training Day
              </button>
              <button
                className="trn-create-rest-btn"
                onClick={() => createSession("rest")}
                disabled={busy}
              >
                Mark Rest Day
              </button>
            </div>
          </div>
        )}

        {/* ── Session card ── */}
        {session && (
          <div className="trn-session-card">

            {/* Topbar */}
            <div className="trn-session-topbar">
              <div className="trn-session-topbar-left">
                <span className="trn-session-id">
                  TRN // {sessionDayName()} SESSION
                </span>
                <span className="trn-session-date">{fmtDateShort(selectedDate)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {badge && (
                  <span className="trn-day-type-badge">{badge}</span>
                )}
                <button
                  className="trn-toggle-btn"
                  onClick={toggleRestDay}
                  disabled={busy}
                >
                  {session.is_rest_day ? "Switch to Training" : "Switch to Rest"}
                </button>
              </div>
            </div>

            <div className="trn-session-body">

              {/* Session name */}
              <div>
                <div className="trn-field-label">Session Name</div>
                <input
                  className="trn-input"
                  value={session.name || ""}
                  onChange={(e) => setSession({ ...session, name: e.target.value })}
                  onBlur={async (e) => {
                    const val = e.target.value.trim();
                    setSession((s) => ({ ...s, name: val }));
                    const { error: nameErr } = await supabase
                      .from("training_sessions")
                      .update({ name: val })
                      .eq("id", session.id)
                      .eq("user_id", userId);
                    if (nameErr) setError(nameErr.message);
                    await fetchWeekSessions(userId);
                  }}
                  placeholder="e.g. Push, Pull, Legs"
                />
              </div>

              {/* Notes */}
              <div>
                <div className="trn-field-label">Session Notes</div>
                <textarea
                  className="trn-textarea"
                  value={session.notes || ""}
                  onChange={(e) => setSession({ ...session, notes: e.target.value })}
                  onBlur={(e) => saveNotes(e.target.value)}
                  placeholder="Notes for today's session"
                />
              </div>

              {/* Rest day view */}
              {session.is_rest_day && (
                <>
                  <div className="trn-divider" />
                  <div className="trn-rest-state">
                    <div className="trn-rest-label">REST DAY</div>
                    <div className="trn-rest-sub">Rest Day</div>
                  </div>
                </>
              )}

              {/* Exercises section */}
              {!session.is_rest_day && (
                <>
                  <div className="trn-divider" />

                  <div className="trn-exercises-section">
                    <div className="trn-exercises-header">
                      <span className="trn-exercises-label">Exercises</span>
                      {exercises.length > 0 && (
                        <span className="trn-exercises-count">{exercises.length}</span>
                      )}
                    </div>

                    {/* Add exercise row */}
                    <div className="trn-add-exercise-row">
                      <input
                        className="trn-add-exercise-input"
                        value={newExerciseName}
                        onChange={(e) => setNewExerciseName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addExercise(); }}
                        placeholder="Exercise name…"
                      />
                      <button
                        className="trn-add-exercise-btn"
                        onClick={addExercise}
                        disabled={busy}
                      >
                        + Add
                      </button>
                    </div>

                    {/* Empty state */}
                    {exercises.length === 0 && (
                      <div className="trn-empty-exercises">
                        <div className="trn-empty-exercises-label">No Exercises Logged</div>
                        <div className="trn-empty-exercises-sub">Add your first exercise above to start logging sets.</div>
                      </div>
                    )}

                    {/* Exercise cards */}
                    {exercises.map((ex, idx) => {
                      const sets = setsByExercise[ex.id] || [];
                      return (
                        <div key={ex.id} className="trn-exercise-card">

                          {/* Exercise header */}
                          <div className="trn-exercise-header">
                            <div className="trn-exercise-name">{ex.name}</div>
                            <div className="trn-exercise-actions">
                              <button
                                className="trn-move-btn"
                                onClick={() => moveExercise(ex.id, -1)}
                                disabled={busy || idx === 0}
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                className="trn-move-btn"
                                onClick={() => moveExercise(ex.id, 1)}
                                disabled={busy || idx === exercises.length - 1}
                                title="Move down"
                              >
                                ↓
                              </button>
                              <button
                                className="trn-delete-exercise-btn"
                                onClick={() => deleteExercise(ex.id)}
                                disabled={busy}
                                title="Remove exercise"
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          {/* Sets body */}
                          <div className="trn-sets-body">
                            {sets.length > 0 && (
                              <>
                                {/* Table header */}
                                <div className="trn-sets-table-head">
                                  <div className="trn-sets-th center">SET</div>
                                  <div className="trn-sets-th center">REPS</div>
                                  <div className="trn-sets-th center">WEIGHT</div>
                                  <div className="trn-sets-th center">RIR</div>
                                  <div className="trn-sets-th" />
                                </div>

                                {/* Set rows */}
                                {sets.map((s) => (
                                  <div key={s.id} className="trn-set-row">
                                    <div className="trn-set-num">#{s.set_number}</div>

                                    <input
                                      type="number"
                                      className="trn-set-input"
                                      value={s.reps ?? ""}
                                      onChange={(e) => updateSetLocal(ex.id, s.id, { reps: e.target.value })}
                                      onBlur={() => saveSet(ex.id, { ...s, reps: s.reps ?? "" })}
                                      placeholder="—"
                                    />

                                    <input
                                      type="number"
                                      className="trn-set-input"
                                      value={s.weight ?? ""}
                                      onChange={(e) => updateSetLocal(ex.id, s.id, { weight: e.target.value })}
                                      onBlur={() => saveSet(ex.id, { ...s, weight: s.weight ?? "" })}
                                      placeholder="—"
                                    />

                                    <input
                                      type="number"
                                      className="trn-set-input"
                                      value={s.rir ?? ""}
                                      onChange={(e) => updateSetLocal(ex.id, s.id, { rir: e.target.value })}
                                      onBlur={() => saveSet(ex.id, { ...s, rir: s.rir ?? "" })}
                                      placeholder="—"
                                    />

                                    <button
                                      className="trn-delete-set-btn"
                                      onClick={() => deleteSet(ex.id, s.id)}
                                      title="Delete set"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </>
                            )}

                            <button
                              className="trn-add-set-btn"
                              onClick={() => addSet(ex.id)}
                              disabled={busy}
                            >
                              + Add Set
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
