import { create } from 'zustand';

import { toast } from '@/shared/ui/toast/toast.store';

import { recordAudit } from '@/features/audit/application/store/audit.store';

import { SEED_BRANCHES, SEED_HOLIDAYS, SEED_PATIENT_BANNERS } from './profile.fixtures';
import type { HospitalBranch, HospitalHoliday, PatientBanner } from './profile.types';

/**
 * Hospital-profile store — branches, the holiday calendar and the banners the
 * hospital publishes to the patient app (audit HA-03). Every mutation writes
 * an audit-trail entry, so the new Audit Trail screen shows real activity
 * rather than seed rows only.
 *
 * ## For slot generation
 *
 * The holiday calendar is the closure source of truth. Read it with
 * `selectHolidays` and ask the pure helpers in `profile.logic.ts`:
 *
 * ```ts
 * const holidays = useHospitalProfileStore(selectHolidays);
 * if (isClosedOn(holidays, { date, department })) return [];  // no slots
 * ```
 */

/** Branch / holiday / banner payload — a missing id means "create". */
export type BranchDraft = Omit<HospitalBranch, 'id' | 'primary'> & { readonly id?: string };
export type HolidayDraft = Omit<HospitalHoliday, 'id'> & { readonly id?: string };
export type PatientBannerDraft = Omit<PatientBanner, 'id' | 'active'> & { readonly id?: string };

/** `prefix + n`, continuing past whatever the seed and session already used. */
function mintId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

interface ProfileState {
  branches: readonly HospitalBranch[];
  holidays: readonly HospitalHoliday[];
  banners: readonly PatientBanner[];
}

interface ProfileActions {
  /** Upsert a branch (create keeps `primary: false`). Returns the id. */
  saveBranch: (draft: BranchDraft) => string;
  /** Remove a branch. The primary branch is protected and never deleted. */
  deleteBranch: (id: string) => void;
  /** Make one branch primary; the previous primary becomes secondary. */
  setPrimaryBranch: (id: string) => void;
  /** Upsert a closure in the holiday calendar. Returns the id. */
  saveHoliday: (draft: HolidayDraft) => string;
  deleteHoliday: (id: string) => void;
  /** Upsert a published banner (create is active). Returns the id. */
  saveBanner: (draft: PatientBannerDraft) => string;
  deleteBanner: (id: string) => void;
  /** Take a banner out of rotation / put it back, keeping its schedule. */
  toggleBanner: (id: string) => void;
  /** Reorder the rotation: swap the banner at `index` with `index + dir`. */
  moveBanner: (index: number, dir: -1 | 1) => void;
}

export type HospitalProfileStore = ProfileState & ProfileActions;

/** What the selectors below read — the store, or any snapshot of it. */
export interface HospitalProfileSnapshot {
  readonly branches: readonly HospitalBranch[];
  readonly holidays: readonly HospitalHoliday[];
  readonly banners: readonly PatientBanner[];
}

export const useHospitalProfileStore = create<HospitalProfileStore>()((set, get) => ({
  branches: SEED_BRANCHES,
  holidays: SEED_HOLIDAYS,
  banners: SEED_PATIENT_BANNERS,

  saveBranch: (draft) => {
    const existing = draft.id ? get().branches.find((b) => b.id === draft.id) : undefined;
    const id =
      draft.id ??
      mintId(
        'br-',
        get().branches.map((b) => b.id),
      );
    set((s) => {
      const record: HospitalBranch = {
        id,
        name: draft.name,
        address: draft.address,
        city: draft.city,
        phone: draft.phone,
        departments: draft.departments,
        primary: existing?.primary ?? false,
      };
      return {
        branches: existing
          ? s.branches.map((b) => (b.id === id ? record : b))
          : [...s.branches, record],
      };
    });
    recordAudit({
      action: existing ? 'Update' : 'Create',
      entity: 'Branch',
      entityId: id,
      summary: existing ? `Branch updated — ${draft.name}` : `Branch added — ${draft.name}`,
      before: existing ? `${existing.name} · ${existing.departments.length} departments` : null,
      after: `${draft.name} · ${draft.departments.length} departments`,
      sev: 'Warning',
    });
    toast(existing ? 'Branch saved' : 'Branch added', 'success');
    return id;
  },

  deleteBranch: (id) => {
    const branch = get().branches.find((b) => b.id === id);
    if (!branch || branch.primary) return;
    set((s) => ({ branches: s.branches.filter((b) => b.id !== id) }));
    recordAudit({
      action: 'Delete',
      entity: 'Branch',
      entityId: id,
      summary: `Branch removed — ${branch.name}`,
      before: `${branch.name} · ${branch.city}`,
      after: null,
      sev: 'Critical',
    });
    toast('Branch removed', 'info');
  },

  setPrimaryBranch: (id) => {
    const previous = get().branches.find((b) => b.primary);
    const next = get().branches.find((b) => b.id === id);
    if (!next || next.primary) return;
    set((s) => ({ branches: s.branches.map((b) => ({ ...b, primary: b.id === id })) }));
    recordAudit({
      action: 'Update',
      entity: 'Branch',
      entityId: id,
      summary: `Primary branch changed — ${next.name}`,
      before: previous?.name ?? null,
      after: next.name,
      sev: 'Warning',
    });
    toast(`${next.name} is now the primary branch`, 'success');
  },

  saveHoliday: (draft) => {
    const existing = draft.id ? get().holidays.find((h) => h.id === draft.id) : undefined;
    const id =
      draft.id ??
      mintId(
        'hol-',
        get().holidays.map((h) => h.id),
      );
    set((s) => {
      const record: HospitalHoliday = { ...draft, id };
      const next = existing
        ? s.holidays.map((h) => (h.id === id ? record : h))
        : [...s.holidays, record];
      return { holidays: [...next].sort((a, b) => a.from.localeCompare(b.from)) };
    });
    recordAudit({
      action: existing ? 'Update' : 'Create',
      entity: 'Holiday',
      entityId: id,
      summary: existing
        ? `Holiday updated — ${draft.name}`
        : `Holiday added to the calendar — ${draft.name}`,
      before: existing ? `${existing.from} → ${existing.to} · ${existing.scope}` : null,
      after: `${draft.from} → ${draft.to} · ${draft.scope}${draft.scopeRef ? ` (${draft.scopeRef})` : ''}`,
      sev: 'Warning',
    });
    toast(existing ? 'Holiday saved' : 'Holiday added — slots will not be generated', 'success');
    return id;
  },

  deleteHoliday: (id) => {
    const holiday = get().holidays.find((h) => h.id === id);
    if (!holiday) return;
    set((s) => ({ holidays: s.holidays.filter((h) => h.id !== id) }));
    recordAudit({
      action: 'Delete',
      entity: 'Holiday',
      entityId: id,
      summary: `Holiday removed — ${holiday.name}`,
      before: `${holiday.from} → ${holiday.to} · ${holiday.scope}`,
      after: null,
      sev: 'Warning',
    });
    toast('Holiday removed — the day is bookable again', 'info');
  },

  saveBanner: (draft) => {
    const existing = draft.id ? get().banners.find((b) => b.id === draft.id) : undefined;
    const id =
      draft.id ??
      mintId(
        'pb-',
        get().banners.map((b) => b.id),
      );
    set((s) => {
      const record: PatientBanner = {
        id,
        title: draft.title,
        body: draft.body,
        img: draft.img,
        from: draft.from,
        to: draft.to,
        audience: draft.audience,
        audienceDept: draft.audienceDept,
        active: existing?.active ?? true,
      };
      return {
        banners: existing
          ? s.banners.map((b) => (b.id === id ? record : b))
          : [...s.banners, record],
      };
    });
    recordAudit({
      action: existing ? 'Update' : 'Create',
      entity: 'Banner',
      entityId: id,
      summary: existing
        ? `Patient-app banner updated — ${draft.title}`
        : `Patient-app banner published — ${draft.title}`,
      before: existing ? `${existing.title} · ${existing.from} → ${existing.to}` : null,
      after: `${draft.title} · ${draft.from} → ${draft.to} · ${draft.audience}`,
      sev: 'Info',
    });
    toast(
      existing ? 'Banner saved' : 'Banner scheduled — it goes live on its start date',
      'success',
    );
    return id;
  },

  deleteBanner: (id) => {
    const banner = get().banners.find((b) => b.id === id);
    if (!banner) return;
    set((s) => ({ banners: s.banners.filter((b) => b.id !== id) }));
    recordAudit({
      action: 'Delete',
      entity: 'Banner',
      entityId: id,
      summary: `Patient-app banner deleted — ${banner.title}`,
      before: `${banner.title} · ${banner.from} → ${banner.to}`,
      after: null,
      sev: 'Warning',
    });
    toast('Banner deleted — it is off the patient app', 'info');
  },

  toggleBanner: (id) => {
    const banner = get().banners.find((b) => b.id === id);
    if (!banner) return;
    const nowActive = !banner.active;
    set((s) => ({
      banners: s.banners.map((b) => (b.id === id ? { ...b, active: nowActive } : b)),
    }));
    recordAudit({
      action: 'Update',
      entity: 'Banner',
      entityId: id,
      summary: `Patient-app banner ${nowActive ? 'resumed' : 'paused'} — ${banner.title}`,
      before: banner.active ? 'In rotation' : 'Paused',
      after: nowActive ? 'In rotation' : 'Paused',
      sev: 'Info',
    });
    toast(nowActive ? 'Banner resumed' : 'Banner paused', 'info');
  },

  moveBanner: (index, dir) =>
    set((s) => {
      const to = index + dir;
      if (index < 0 || to < 0 || index >= s.banners.length || to >= s.banners.length) return s;
      const next = [...s.banners];
      [next[index], next[to]] = [next[to], next[index]];
      return { banners: next };
    }),
}));

/* ------------------------------------------------------------- selectors */

export function selectBranches(s: HospitalProfileSnapshot): readonly HospitalBranch[] {
  return s.branches;
}

/** The primary branch — the address the patient app shows first. */
export function selectPrimaryBranch(s: HospitalProfileSnapshot): HospitalBranch | null {
  return s.branches.find((b) => b.primary) ?? s.branches[0] ?? null;
}

/**
 * The holiday calendar, ascending by start date. **This is the closure list
 * slot generation must respect** — pair it with `isClosedOn()` from
 * `profile.logic.ts`.
 */
export function selectHolidays(s: HospitalProfileSnapshot): readonly HospitalHoliday[] {
  return s.holidays;
}

/** Banners in rotation order (index 0 shows first in the patient app). */
export function selectPatientBanners(s: HospitalProfileSnapshot): readonly PatientBanner[] {
  return s.banners;
}
