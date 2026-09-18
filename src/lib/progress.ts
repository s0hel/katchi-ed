"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { applyAnswer, emptySkillState, type SkillState } from "./smartscore";
import type { Subject } from "./types";

/**
 * Learner progress.
 *
 * localStorage is an external store, so it's read through useSyncExternalStore
 * rather than copied into state inside an effect: the server render and the
 * hydration render both see the empty profile, then React re-renders once with
 * the stored one. That also gets cross-tab sync for free via the storage event.
 *
 * Everything goes through this module's API, so swapping localStorage for a
 * database later means changing `load`/`save` and the mutators, not the pages.
 */

const STORAGE_KEY = "katchi:profile:v1";

export interface DiagnosticRecord {
  id: string;
  subject: Subject;
  takenAt: number;
  overall: number;
  strands: { strand: string; score: number; asked: number; correct: number }[];
}

export interface AssessmentRecord {
  id: string;
  subject: Subject;
  grade: number;
  takenAt: number;
  correct: number;
  total: number;
  byStrand: { strand: string; correct: number; total: number }[];
}

export interface DayActivity {
  /** YYYY-MM-DD in the learner's local time */
  date: string;
  answered: number;
  correct: number;
  timeMs: number;
}

export interface Profile {
  version: 1;
  name: string | null;
  grade: number;
  skills: Record<string, SkillState>;
  diagnostics: DiagnosticRecord[];
  assessments: AssessmentRecord[];
  activity: DayActivity[];
}

export function emptyProfile(): Profile {
  return { version: 1, name: null, grade: 4, skills: {}, diagnostics: [], assessments: [], activity: [] };
}

/** Stable identity so the server snapshot never triggers a re-render loop. */
const EMPTY: Profile = emptyProfile();

function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function read(): Profile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (parsed.version !== 1) return EMPTY;
    return { ...emptyProfile(), ...parsed };
  } catch {
    // corrupt, or storage blocked in private mode
    return EMPTY;
  }
}

/* ------------------------------------------------------------------ store */

let snapshot: Profile = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    snapshot = read();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Profile {
  if (!hydrated) {
    hydrated = true;
    snapshot = read();
  }
  return snapshot;
}

function getServerSnapshot(): Profile {
  return EMPTY;
}

function commit(next: Profile): void {
  snapshot = next;
  hydrated = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota or private mode: the change still applies for this session
  }
  emit();
}

function mutate(fn: (profile: Profile) => Profile): Profile {
  const next = fn(getSnapshot());
  commit(next);
  return next;
}

/* ------------------------------------------------------------- mutators */

export function recordAnswerFor(skillId: string, correct: boolean, elapsedMs: number): SkillState {
  const prev = getSnapshot().skills[skillId] ?? emptySkillState();
  const { state } = applyAnswer(prev, correct, elapsedMs);

  mutate((profile) => {
    const date = dayKey();
    const activity = [...profile.activity];
    const index = activity.findIndex((a) => a.date === date);
    const day = activity[index] ?? { date, answered: 0, correct: 0, timeMs: 0 };
    const updated: DayActivity = {
      date,
      answered: day.answered + 1,
      correct: day.correct + (correct ? 1 : 0),
      timeMs: day.timeMs + Math.max(0, elapsedMs),
    };
    if (index >= 0) activity[index] = updated;
    else activity.push(updated);

    return { ...profile, skills: { ...profile.skills, [skillId]: state }, activity: activity.slice(-365) };
  });

  return state;
}

export function recordDiagnosticResult(record: Omit<DiagnosticRecord, "id" | "takenAt">): void {
  mutate((profile) => ({
    ...profile,
    diagnostics: [...profile.diagnostics, { ...record, id: `dx-${Date.now().toString(36)}`, takenAt: Date.now() }].slice(-25),
  }));
}

export function recordAssessmentResult(record: Omit<AssessmentRecord, "id" | "takenAt">): void {
  mutate((profile) => ({
    ...profile,
    assessments: [...profile.assessments, { ...record, id: `as-${Date.now().toString(36)}`, takenAt: Date.now() }].slice(-50),
  }));
}

export function setStoredGrade(grade: number): void {
  mutate((profile) => (profile.grade === grade ? profile : { ...profile, grade }));
}

export function setStoredName(name: string): void {
  mutate((profile) => ({ ...profile, name: name || null }));
}

export function resetProfile(): void {
  commit(emptyProfile());
}

export function exportProfileJson(): string {
  return JSON.stringify(getSnapshot(), null, 2);
}

export function importProfileJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as Profile;
    if (parsed.version !== 1 || typeof parsed.skills !== "object") return false;
    commit({ ...emptyProfile(), ...parsed });
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- hooks */

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** False on the server and during hydration, true once the store is live. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export interface ProgressApi {
  profile: Profile;
  ready: boolean;
  skillState: (skillId: string) => SkillState;
  recordAnswer: typeof recordAnswerFor;
  recordDiagnostic: typeof recordDiagnosticResult;
  recordAssessment: typeof recordAssessmentResult;
  setGrade: typeof setStoredGrade;
  setName: typeof setStoredName;
  resetAll: typeof resetProfile;
  exportProfile: typeof exportProfileJson;
  importProfile: typeof importProfileJson;
  streakDays: number;
}

export function useProgress(): ProgressApi {
  const profile = useProfile();
  const ready = useHydrated();

  const skillState = useCallback(
    (skillId: string) => profile.skills[skillId] ?? emptySkillState(),
    [profile.skills],
  );

  const streakDays = useMemo(() => countStreak(profile.activity), [profile.activity]);

  return useMemo(
    () => ({
      profile,
      ready,
      skillState,
      streakDays,
      recordAnswer: recordAnswerFor,
      recordDiagnostic: recordDiagnosticResult,
      recordAssessment: recordAssessmentResult,
      setGrade: setStoredGrade,
      setName: setStoredName,
      resetAll: resetProfile,
      exportProfile: exportProfileJson,
      importProfile: importProfileJson,
    }),
    [profile, ready, skillState, streakDays],
  );
}

/** SmartScore for one skill, without subscribing to unrelated profile changes. */
export function useSkillState(skillId: string): SkillState {
  const profile = useProfile();
  return profile.skills[skillId] ?? emptySkillState();
}

/** Consecutive days of practice ending today or yesterday. */
function countStreak(activity: DayActivity[]): number {
  if (!activity.length) return 0;
  const days = new Set(activity.filter((a) => a.answered > 0).map((a) => a.date));
  const cursor = new Date();

  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Totals for the dashboard. */
export function summarize(profile: Profile) {
  const states = Object.values(profile.skills);
  const answered = states.reduce((n, s) => n + s.asked, 0);
  const correct = states.reduce((n, s) => n + s.correct, 0);
  return {
    skillsStarted: states.length,
    skillsMastered: states.filter((s) => s.score >= 100).length,
    skillsProficient: states.filter((s) => s.score >= 80).length,
    answered,
    correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    timeMs: states.reduce((n, s) => n + s.timeMs, 0),
  };
}
