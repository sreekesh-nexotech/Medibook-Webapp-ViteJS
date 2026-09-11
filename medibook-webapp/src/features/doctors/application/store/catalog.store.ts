import { create } from 'zustand';

import { DEPTS_DATA, DOCS_DATA, SHIFT_PATTERNS_DATA } from './catalog.fixtures';
import type { DateException, Dept, Doctor, DoctorLeave, ShiftPattern } from './catalog.types';

/**
 * Doctors & Departments catalog store — the hospital's own master data
 * (`CANONICAL_MASTER_DATA.md`). Seeded from the canonical fixtures; every
 * screen that needs a department, a doctor, a fee or a bookable window reads
 * it (through `catalog.selectors.ts`) instead of a hardcoded list, so adding a
 * doctor here really does change the rest of the app (audit 2.6.3).
 *
 * Beyond the prototype's four actions this store now owns the whole doctor
 * schedule (audit 2.4 / HA-06 / HA-07): the hospital-wide **shift-pattern
 * library**, per-doctor **leave** entries and per-date **exceptions**, each
 * with a real create / update / delete path, so the controls on the doctor
 * screen change state instead of announcing that they did.
 *
 * Ids are the canonical keys (`cardiology`, `dr-anya-sharma`); records created
 * through the UI mint the same shape by slugifying the name, with a numeric
 * suffix when that slug is taken.
 */

/** Non-alphanumeric runs collapse to a single dash when minting an id. */
const SLUG_SEPARATOR_PATTERN = /[^a-z0-9]+/g;
const SLUG_TRIM_PATTERN = /^-+|-+$/g;

function slugify(value: string): string {
  return value.toLowerCase().replace(SLUG_SEPARATOR_PATTERN, '-').replace(SLUG_TRIM_PATTERN, '');
}

/**
 * `prefix + slug`, suffixed until it does not collide with `taken`. A name that
 * already begins with the prefix keeps it once — "Dr. Asha Verma" mints
 * `dr-asha-verma`, not `dr-dr-asha-verma`.
 */
function mintId(prefix: string, name: string, taken: readonly string[]): string {
  const slug = slugify(name) || 'item';
  const base = prefix && slug.startsWith(prefix) ? slug : `${prefix}${slug}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Doctor payload — a missing id means "create". */
export type DoctorDraft = Omit<Doctor, 'id'> & { readonly id?: string };

/** Department payload — a missing id means "create". */
export type DeptDraft = Omit<Dept, 'id'> & { readonly id?: string };

/** Shift-pattern payload — a missing id means "create". */
export type ShiftPatternDraft = Omit<ShiftPattern, 'id'> & { readonly id?: string };

/** Leave payload — a missing id means "create". */
export type DoctorLeaveDraft = Omit<DoctorLeave, 'id'> & { readonly id?: string };

/** Date-exception payload — a missing id means "create". */
export type DateExceptionDraft = Omit<DateException, 'id'> & { readonly id?: string };

/** Everything the doctor editor may commit in one Save (never the id). */
export type DoctorPatch = Partial<Omit<Doctor, 'id'>>;

interface CatalogState {
  depts: readonly Dept[];
  docs: readonly Doctor[];
  /** Hospital-wide shift-pattern library, referenced by `WeekDay.patternIds`. */
  patterns: readonly ShiftPattern[];
}

interface CatalogActions {
  /** Upsert a doctor profile — replace by id, or prepend a new record. Returns the id. */
  catSaveDoctor: (doc: DoctorDraft) => string;
  /** Merge a partial change into one doctor, leaving every other field alone. */
  catPatchDoctor: (id: string, patch: DoctorPatch) => void;
  catDeleteDoctor: (id: string) => void;
  /** Upsert a department. A rename is propagated to every doctor assigned to it. */
  catSaveDept: (dept: DeptDraft) => string;
  /** Delete a department and drop it from every doctor's assignment list. */
  catDeleteDept: (id: string) => void;
  /** Upsert a shift pattern in the hospital-wide library. Returns the id. */
  catSavePattern: (pattern: ShiftPatternDraft) => string;
  /** Delete a pattern and unassign it from every doctor's weekly grid. */
  catDeletePattern: (id: string) => void;
  /** Upsert one leave entry on a doctor. */
  catSaveLeave: (doctorId: string, leave: DoctorLeaveDraft) => void;
  catDeleteLeave: (doctorId: string, leaveId: string) => void;
  /** Upsert one per-date exception on a doctor. */
  catSaveException: (doctorId: string, exception: DateExceptionDraft) => void;
  catDeleteException: (doctorId: string, exceptionId: string) => void;
}

export const useCatalogStore = create<CatalogState & CatalogActions>()((set, get) => ({
  depts: DEPTS_DATA,
  docs: DOCS_DATA,
  patterns: SHIFT_PATTERNS_DATA,

  catSaveDoctor: (doc) => {
    const id =
      doc.id ||
      mintId(
        'dr-',
        doc.name,
        get().docs.map((x) => x.id),
      );
    set((s) => {
      const record: Doctor = { ...doc, id };
      const exists = s.docs.some((x) => x.id === id);
      return {
        docs: exists ? s.docs.map((x) => (x.id === id ? record : x)) : [record, ...s.docs],
      };
    });
    return id;
  },

  catPatchDoctor: (id, patch) =>
    set((s) => ({ docs: s.docs.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

  catDeleteDoctor: (id) => set((s) => ({ docs: s.docs.filter((x) => x.id !== id) })),

  catSaveDept: (dept) => {
    const id =
      dept.id ||
      mintId(
        '',
        dept.name,
        get().depts.map((x) => x.id),
      );
    set((s) => {
      const previous = s.depts.find((x) => x.id === id);
      const record: Dept = { ...dept, id };
      const renamed = previous && previous.name !== record.name ? previous.name : null;
      return {
        depts: previous ? s.depts.map((x) => (x.id === id ? record : x)) : [...s.depts, record],
        // A renamed department must not orphan the doctors assigned to it:
        // doctors reference departments by name, so the name moves with it.
        docs: renamed
          ? s.docs.map((d) =>
              d.depts.includes(renamed)
                ? { ...d, depts: d.depts.map((n) => (n === renamed ? record.name : n)) }
                : d,
            )
          : s.docs,
      };
    });
    return id;
  },

  catDeleteDept: (id) =>
    set((s) => {
      const gone = s.depts.find((x) => x.id === id);
      return {
        depts: s.depts.filter((x) => x.id !== id),
        docs: gone
          ? s.docs.map((d) =>
              d.depts.includes(gone.name)
                ? { ...d, depts: d.depts.filter((n) => n !== gone.name) }
                : d,
            )
          : s.docs,
      };
    }),

  catSavePattern: (pattern) => {
    const id =
      pattern.id ||
      mintId(
        'sp-',
        pattern.name,
        get().patterns.map((x) => x.id),
      );
    set((s) => {
      const record: ShiftPattern = { ...pattern, id };
      const exists = s.patterns.some((x) => x.id === id);
      return {
        patterns: exists
          ? s.patterns.map((x) => (x.id === id ? record : x))
          : [...s.patterns, record],
      };
    });
    return id;
  },

  catDeletePattern: (id) =>
    set((s) => ({
      patterns: s.patterns.filter((x) => x.id !== id),
      // Leave no dangling assignment behind, or the day would generate slots
      // from a pattern that no longer exists.
      docs: s.docs.map((d) => ({
        ...d,
        week: d.week.map((w) =>
          (w.patternIds ?? []).includes(id)
            ? { ...w, patternIds: (w.patternIds ?? []).filter((p) => p !== id) }
            : w,
        ),
      })),
    })),

  catSaveLeave: (doctorId, leave) =>
    set((s) => ({
      docs: s.docs.map((d) => {
        if (d.id !== doctorId) return d;
        const id =
          leave.id ||
          mintId(
            'lv-',
            `${d.id}-${leave.from}`,
            d.leave.map((x) => x.id),
          );
        const record: DoctorLeave = { ...leave, id };
        const exists = d.leave.some((x) => x.id === id);
        const next = exists ? d.leave.map((x) => (x.id === id ? record : x)) : [...d.leave, record];
        return { ...d, leave: [...next].sort((a, b) => a.from.localeCompare(b.from)) };
      }),
    })),

  catDeleteLeave: (doctorId, leaveId) =>
    set((s) => ({
      docs: s.docs.map((d) =>
        d.id === doctorId ? { ...d, leave: d.leave.filter((x) => x.id !== leaveId) } : d,
      ),
    })),

  catSaveException: (doctorId, exception) =>
    set((s) => ({
      docs: s.docs.map((d) => {
        if (d.id !== doctorId) return d;
        const id =
          exception.id ||
          mintId(
            'ex-',
            `${d.id}-${exception.date}`,
            d.exceptions.map((x) => x.id),
          );
        const record: DateException = { ...exception, id };
        const exists = d.exceptions.some((x) => x.id === id);
        const next = exists
          ? d.exceptions.map((x) => (x.id === id ? record : x))
          : [...d.exceptions, record];
        return { ...d, exceptions: [...next].sort((a, b) => a.date.localeCompare(b.date)) };
      }),
    })),

  catDeleteException: (doctorId, exceptionId) =>
    set((s) => ({
      docs: s.docs.map((d) =>
        d.id === doctorId
          ? { ...d, exceptions: d.exceptions.filter((x) => x.id !== exceptionId) }
          : d,
      ),
    })),
}));
