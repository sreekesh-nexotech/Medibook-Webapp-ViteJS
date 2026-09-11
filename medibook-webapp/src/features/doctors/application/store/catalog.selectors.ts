import { useMemo } from 'react';

import { useCatalogStore } from './catalog.store';
import type { Dept, Doctor, ShiftPattern } from './catalog.types';

/**
 * The catalogue's read API — audit 2.6.3: "the hospital app books against a
 * fixed list of six departments and seven doctors rather than its own Doctors
 * and Departments catalogue, so adding a doctor changes nothing anywhere."
 *
 * Every screen that needs a department list, a doctor list or a consultation
 * fee calls one of these instead of importing the hardcoded `DEPARTMENTS` /
 * `DOCTORS` / `FEES` constants. Add a doctor through the UI and the dropdowns
 * that use these selectors show them on the next render.
 *
 * Two flavours of every read:
 *   `useCatalogX(…)`  — the hook, for components.
 *   `selectX(state, …)` — the pure function, for stores, actions and tests
 *                         (call it with `useCatalogStore.getState()`).
 *
 * **Money is in whole rupees**, the unit `money()` formats — not paise. (The
 * mobile app holds the same figures in minor units; only the web app's
 * formatter takes rupees.)
 */

/** The catalogue slice a pure selector needs — `useCatalogStore.getState()` satisfies it. */
export interface CatalogSnapshot {
  readonly depts: readonly Dept[];
  readonly docs: readonly Doctor[];
  readonly patterns: readonly ShiftPattern[];
}

/** Doctor statuses that may still be offered a new appointment. */
const BOOKABLE_STATUSES: readonly string[] = ['Active'];

/** Match a department by canonical id (`cardiology`) or display name ("Cardiology"). */
function findDept(state: CatalogSnapshot, key: string): Dept | undefined {
  return state.depts.find((d) => d.id === key || d.name === key);
}

/** Match a doctor by canonical id (`dr-anya-sharma`) or display name. */
function findDoctor(state: CatalogSnapshot, key: string): Doctor | undefined {
  return state.docs.find((d) => d.id === key || d.name === key);
}

/* ------------------------------------------------------------ pure selectors */

/**
 * Department display names in catalogue order. Inactive departments are
 * included: historical appointments still reference them, so a filter that
 * dropped them could never match those rows. Booking forms that must offer
 * only live departments filter on `status` themselves.
 */
export function selectDepartments(state: CatalogSnapshot): readonly string[] {
  return state.depts.map((d) => d.name);
}

/** Doctor display names, optionally narrowed to one department (id or name). */
export function selectDoctorNames(state: CatalogSnapshot, dept?: string): readonly string[] {
  const name = dept ? (findDept(state, dept)?.name ?? dept) : null;
  return state.docs.filter((d) => !name || d.depts.includes(name)).map((d) => d.name);
}

/** Doctor names that may take a new booking today (status `Active`). */
export function selectBookableDoctorNames(
  state: CatalogSnapshot,
  dept?: string,
): readonly string[] {
  const name = dept ? (findDept(state, dept)?.name ?? dept) : null;
  return state.docs
    .filter((d) => BOOKABLE_STATUSES.includes(d.status))
    .filter((d) => !name || d.depts.includes(name))
    .map((d) => d.name);
}

/**
 * The consultation fee in whole rupees for a doctor **or** a department, by
 * canonical id or display name. A doctor's own fee wins; a doctor without one
 * falls back to their first department's base fee; an unknown key is 0.
 */
export function selectFee(state: CatalogSnapshot, deptOrDoctorId: string): number {
  const doctor = findDoctor(state, deptOrDoctorId);
  if (doctor) {
    if (doctor.fee > 0) return doctor.fee;
    const own = doctor.depts[0] ? findDept(state, doctor.depts[0]) : undefined;
    return own?.fee ?? 0;
  }
  return findDept(state, deptOrDoctorId)?.fee ?? 0;
}

/** One doctor by canonical id (or display name). */
export function selectDoctor(state: CatalogSnapshot, id: string): Doctor | undefined {
  return findDoctor(state, id);
}

/** One department by canonical id (or display name). */
export function selectDept(state: CatalogSnapshot, id: string): Dept | undefined {
  return findDept(state, id);
}

/* -------------------------------------------------------------------- hooks */

/** Department display names in catalogue order. */
export function useCatalogDepartments(): readonly string[] {
  const depts = useCatalogStore((s) => s.depts);
  return useMemo(() => depts.map((d) => d.name), [depts]);
}

/** Doctor display names, optionally narrowed to one department (id or name). */
export function useCatalogDoctorNames(dept?: string): readonly string[] {
  const depts = useCatalogStore((s) => s.depts);
  const docs = useCatalogStore((s) => s.docs);
  return useMemo(() => selectDoctorNames({ depts, docs, patterns: [] }, dept), [depts, docs, dept]);
}

/** Doctor names that may take a new booking (status `Active`). */
export function useCatalogBookableDoctorNames(dept?: string): readonly string[] {
  const depts = useCatalogStore((s) => s.depts);
  const docs = useCatalogStore((s) => s.docs);
  return useMemo(
    () => selectBookableDoctorNames({ depts, docs, patterns: [] }, dept),
    [depts, docs, dept],
  );
}

/** Consultation fee in whole rupees for a doctor or a department. */
export function useCatalogFee(deptOrDoctorId: string): number {
  const depts = useCatalogStore((s) => s.depts);
  const docs = useCatalogStore((s) => s.docs);
  return useMemo(
    () => selectFee({ depts, docs, patterns: [] }, deptOrDoctorId),
    [depts, docs, deptOrDoctorId],
  );
}

/** One doctor by canonical id (or display name). */
export function useCatalogDoctor(id: string): Doctor | undefined {
  const docs = useCatalogStore((s) => s.docs);
  return useMemo(() => docs.find((d) => d.id === id || d.name === id), [docs, id]);
}

/** One department by canonical id (or display name). */
export function useCatalogDept(id: string): Dept | undefined {
  const depts = useCatalogStore((s) => s.depts);
  return useMemo(() => depts.find((d) => d.id === id || d.name === id), [depts, id]);
}
