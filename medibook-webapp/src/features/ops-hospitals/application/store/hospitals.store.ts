import { create } from 'zustand';

import { APOLLO_HID, DEMO_TODAY } from '@/core/config/demo';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';
import { useSettingsStore } from '@/features/settings/application/store/settings.store';

import { opsBookingsForSeed, opsDeptsForSeed, opsDocsForSeed } from './hospitals.derive';
import { OPS_HOSPITALS } from './hospitals.fixtures';
import type {
  Bank,
  HospitalSuspension,
  KycRecord,
  OpsBooking,
  OpsDept,
  OpsDoctor,
  OpsHospital,
} from './hospitals.types';
import { opsStampNow, opsTodayIso } from './opsDates';

/**
 * Ops hospital-registry store (design `OpsDB.hospitals` + the Ops.jsx
 * hospital lifecycle mutations). Every mutation writes its exact compliance
 * log line; toasts for these flows come from the screens' `useOpsAct` runs,
 * as in the prototype.
 */

const KYC_ALL_MISSING: KycRecord = {
  reg: 'Missing',
  gst: 'Missing',
  licence: 'Missing',
  bankproof: 'Missing',
};

const KYC_ALL_VERIFIED: KycRecord = {
  reg: 'Verified',
  gst: 'Verified',
  licence: 'Verified',
  bankproof: 'Verified',
};

/** Placeholder phone stamped on newly onboarded hospitals (design value). */
const ONBOARD_PLACEHOLDER_PHONE = '+91 90000 00000';

/** Onboard Hospital modal payload. */
export interface OnboardHospitalForm {
  readonly name: string;
  readonly email: string;
  readonly city: string;
  readonly plan: string;
}

/** Suspension details a caller supplies; `since` and `by` are stamped here. */
export type SuspendInput = Omit<HospitalSuspension, 'since' | 'by'>;

interface HospitalsState {
  hospitals: readonly OpsHospital[];
  /**
   * When the registry snapshot the screens render was last taken — shown next
   * to the Refresh button so that control has a visible effect (audit 3.1.1).
   */
  syncedAt: string;
}

interface HospitalsActions {
  /**
   * Re-read the registry and re-stamp the sync clock. Resolves after the
   * snapshot is in place, so a screen can hold its loading state for the real
   * duration of the work instead of faking one. There is no server yet, so
   * this re-derives the list from the store it already owns; when the API
   * lands it becomes the query invalidation and nothing above it changes.
   */
  resync: () => Promise<void>;
  /** Onboard a new instance in Pending verification with all-Missing KYC. */
  onboardHospital: (f: OnboardHospitalForm) => number;
  /** Approve & go live — KYC becomes all-Verified, any rejection is cleared. */
  approve: (id: number) => void;
  reject: (id: number, reason: string) => void;
  /** Suspend an instance, recording why, since when and by whom. */
  suspend: (id: number, input: SuspendInput) => void;
  /** Lift a suspension — access returns immediately and the record is cleared. */
  unsuspend: (id: number) => void;
  /** Per-hospital payment grace override; `undefined` falls back to the platform default. */
  setGraceDays: (id: number, days: number | undefined) => void;
  /** Cross-store setter used by the plans feature when a change is applied. */
  setPlan: (id: number, plan: string) => void;
  /** Cross-store cascade used by the plans feature on a plan rename. */
  cascadePlanRename: (from: string, to: string) => void;
}

/** Demo operations actor every registry mutation is attributed to. */
const OPS_ACTOR = 'riya.sharma@medibook.in';

export const useHospitalsStore = create<HospitalsState & HospitalsActions>()((set, get) => ({
  hospitals: OPS_HOSPITALS,
  syncedAt: opsStampNow(),

  resync: async () => {
    const snapshot = [...get().hospitals];
    set({ hospitals: snapshot, syncedAt: opsStampNow() });
  },

  onboardHospital: (f) => {
    const id = Math.max(...get().hospitals.map((h) => h.id)) + 1;
    const record: OpsHospital = {
      id,
      name: f.name,
      email: f.email,
      phone: ONBOARD_PLACEHOLDER_PHONE,
      plan: f.plan,
      city: f.city,
      st: '',
      bookings: 0,
      onboarded: DEMO_TODAY,
      status: 'Pending verification',
      kyc: KYC_ALL_MISSING,
    };
    set((s) => ({ hospitals: [record, ...s.hospitals] }));
    useLogsStore.getState().addLog({
      hid: id,
      action: `Hospital onboarded — ${f.name}`,
      module: 'Hospitals',
      sev: 'Info',
    });
    return id;
  },

  approve: (id) => {
    const h = get().hospitals.find((x) => x.id === id);
    if (!h) return;
    set((s) => ({
      hospitals: s.hospitals.map((x) =>
        x.id === id
          ? {
              ...x,
              status: 'Active',
              kyc: KYC_ALL_VERIFIED,
              rejectReason: undefined,
              suspension: undefined,
            }
          : x,
      ),
    }));
    useLogsStore.getState().addLog({
      hid: id,
      action: `Hospital approved — ${h.name}`,
      module: 'Hospitals',
      sev: 'Info',
    });
  },

  reject: (id, reason) => {
    const h = get().hospitals.find((x) => x.id === id);
    if (!h) return;
    set((s) => ({
      hospitals: s.hospitals.map((x) =>
        x.id === id ? { ...x, status: 'Rejected', rejectReason: reason } : x,
      ),
    }));
    useLogsStore.getState().addLog({
      hid: id,
      action: `Hospital rejected — ${h.name}`,
      module: 'Hospitals',
      sev: 'Critical',
    });
  },

  suspend: (id, input) => {
    const h = get().hospitals.find((x) => x.id === id);
    if (!h) return;
    const suspension: HospitalSuspension = {
      ...input,
      since: opsTodayIso(),
      by: OPS_ACTOR,
    };
    set((s) => ({
      hospitals: s.hospitals.map((x) =>
        x.id === id ? { ...x, status: 'Suspended', suspension } : x,
      ),
    }));
    useLogsStore.getState().addLog({
      hid: id,
      action: `Hospital suspended (${input.reason.toLowerCase()}) — ${h.name}`,
      module: 'Hospitals',
      sev: 'Critical',
    });
  },

  unsuspend: (id) => {
    const h = get().hospitals.find((x) => x.id === id);
    if (!h) return;
    set((s) => ({
      hospitals: s.hospitals.map((x) =>
        x.id === id ? { ...x, status: 'Active', suspension: undefined } : x,
      ),
    }));
    useLogsStore.getState().addLog({
      hid: id,
      action: `Hospital reactivated — ${h.name}`,
      module: 'Hospitals',
      sev: 'Critical',
    });
  },

  setGraceDays: (id, days) => {
    const h = get().hospitals.find((x) => x.id === id);
    if (!h) return;
    set((s) => ({
      hospitals: s.hospitals.map((x) => (x.id === id ? { ...x, graceDays: days } : x)),
    }));
    useLogsStore.getState().addLog({
      hid: id,
      action:
        days === undefined
          ? `Payment grace window reset to the platform default — ${h.name}`
          : `Payment grace window set to ${days} day${days === 1 ? '' : 's'} — ${h.name}`,
      module: 'Billing',
      sev: 'Info',
    });
  },

  setPlan: (id, plan) =>
    set((s) => ({ hospitals: s.hospitals.map((x) => (x.id === id ? { ...x, plan } : x)) })),

  cascadePlanRename: (from, to) =>
    set((s) => ({
      hospitals: s.hospitals.map((x) => (x.plan === from ? { ...x, plan: to } : x)),
    })),
}));

/* ------------------------------------------------------------------
 * S1: tenant identity — cross-app records join on `hid`; names, banks
 * and rosters resolve through the live registry + hospital-side stores
 * at read time, exactly as Ops.jsx did. Apollo (APOLLO_HID) resolves
 * against the hospital app's own stores — the live cross-app link.
 * ------------------------------------------------------------------ */

/** Anything that references a hospital: a raw hid or a record with one. */
export interface HospitalRef {
  readonly hid?: number | null;
  readonly hospital?: string;
}

/** Registry lookup by tenant id (design `opsHospById`). */
export function opsHospById(hid: number | null | undefined): OpsHospital | null {
  return useHospitalsStore.getState().hospitals.find((h) => h.id === hid) ?? null;
}

/** Display name for a hospital ref — Apollo reads the live hospital settings. */
export function hospName(ref: number | HospitalRef | null | undefined): string {
  const hid = typeof ref === 'number' ? ref : ref ? ref.hid : null;
  if (hid === APOLLO_HID) {
    const nm = useSettingsStore.getState().settings.name;
    if (nm) return nm;
  }
  const h = opsHospById(hid);
  if (h) return h.name;
  return (typeof ref === 'object' && ref?.hospital) || '—';
}

/** Payout account on file — Apollo reads the live hospital settings bank. */
export function bankOf(hid: number | null | undefined): Bank | undefined {
  if (hid === APOLLO_HID) return useSettingsStore.getState().settings.bank;
  return opsHospById(hid)?.bank;
}

/** GSTIN on file — Apollo reads the live hospital settings GSTIN. */
export function gstinOf(h: OpsHospital | null | undefined): string | undefined {
  if (h && h.id === APOLLO_HID) return useSettingsStore.getState().settings.gstin;
  return h?.gstin;
}

/** Effective KYC record (design `kycOf` — implied states when none stored). */
export function kycOf(h: OpsHospital): KycRecord {
  return (
    h.kyc ??
    (h.status === 'Pending verification' || h.status === 'Rejected'
      ? KYC_ALL_MISSING
      : KYC_ALL_VERIFIED)
  );
}

/** Read-only department roster — Apollo maps the live mbAdmin catalog. */
export function opsDeptsFor(h: OpsHospital): OpsDept[] {
  if (h.id === APOLLO_HID) {
    const cat = useCatalogStore.getState();
    return cat.depts.map((d) => ({
      name: d.name,
      docs: cat.docs.filter((x) => x.depts.includes(d.name)).length,
      fee: d.fee,
      hours: d.hours,
      status: d.status,
    }));
  }
  return opsDeptsForSeed(h);
}

/** Read-only doctor roster — Apollo maps the live mbAdmin catalog. */
export function opsDocsFor(h: OpsHospital): OpsDoctor[] {
  if (h.id === APOLLO_HID) {
    return useCatalogStore.getState().docs.map((d) => ({
      name: d.name,
      spec: d.spec,
      dept: d.depts[0] || '—',
      room: d.room,
      fee: d.fee,
      rating: d.rating.toFixed(1),
      days: d.week.filter((x) => x.on).length,
      status: d.status,
      leave: d.leave[0] ?? null,
    }));
  }
  return opsDocsForSeed(h);
}

/** The concrete date the hospital seed's "Tomorrow" label maps to. */
const DEMO_TOMORROW = 'June 14, 2026';

/** Recent bookings — Apollo maps the hospital app's live appointment store. */
export function opsBookingsFor(h: OpsHospital): OpsBooking[] {
  if (h.id === APOLLO_HID) {
    return useAppointmentsStore
      .getState()
      .appts.slice(0, 5)
      .map((a, i) => ({
        id: i,
        patient: a.name,
        department: a.dept,
        date: a.date === 'Today' ? DEMO_TODAY : a.date === 'Tomorrow' ? DEMO_TOMORROW : a.date,
        status: a.status,
      }));
  }
  return opsBookingsForSeed(h);
}
