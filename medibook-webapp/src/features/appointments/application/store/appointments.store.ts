import { create } from 'zustand';

import { formatToken, money } from '@/shared/lib/format';
import { toast } from '@/shared/ui/toast/toast.store';

import { usePatientsStore, mintMrn } from '@/features/patients/application/store/patients.store';

import {
  INITIAL_DOC_STATUS,
  INITIAL_RECEIPT_SEQ,
  INITIAL_SERVING,
  INITIAL_TOKEN_SEQ,
  seedAppointments,
} from './appointments.fixtures';
import { doctorLoad, formatReceiptNo, grossAmount } from './appointments.logic';
import type { DoctorLoad } from './appointments.logic';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import { selectFee } from '@/features/doctors/application/store/catalog.selectors';
import type {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
  Department,
  DoctorStatus,
  Gender,
  PaymentMode,
  RefundChannel,
} from './appointments.types';

/**
 * Live appointment + token-queue store, ported 1:1 from the design
 * prototype's `Store`/`Actions` (`data.jsx`). Every toast string is verbatim.
 * Cross-store: walk-in/online creation inserts brand-new MRNs into the
 * patients store (the future shared query cache link).
 */

/**
 * Appointment id counter — replaces the prototype's
 * `"AP" + Math.floor(1000 + Math.random() * 9000)`; the seed occupies
 * AP1000–AP1011, so new ids continue the same AP#### style from AP1012.
 */
let apptIdSeq = 1011;

function mintApptId(): string {
  apptIdSeq += 1;
  return `AP${apptIdSeq}`;
}

/** Payment details captured by the Mark Payment flow. */
export interface PaymentDetails {
  readonly mode?: PaymentMode;
  readonly ref?: string;
}

/** A refund the desk or Medibook has pushed back to the patient (HA-09). */
export interface RefundDetails {
  /** Rupees actually returned — may be a part of the gross paid. */
  readonly amount: number;
  /** Why the money went back. Required for the audit trail. */
  readonly reason: string;
  readonly via: RefundChannel;
}

/** Reschedule payload (design `Actions.reschedule`). */
export interface ReschedulePayload {
  readonly date: string;
  readonly time: string;
  readonly remark?: string | null;
}

/** New-appointment payload (design `Actions.create(data)`). */
export interface CreateAppointmentData {
  readonly mrn?: string;
  readonly name: string;
  readonly age: number;
  readonly gender: Gender;
  readonly phone: string;
  readonly dept: Department;
  readonly doctor: string;
  readonly source: AppointmentSource;
  readonly date: string;
  readonly time: string;
  readonly remark?: string;
  readonly email?: string;
  readonly address?: string;
}

/** Re-exported so existing call sites keep importing it from the store. */
export type { DoctorLoad };

interface AppointmentsState {
  appts: readonly Appointment[];
  /** Each doctor's token currently in consultation. */
  serving: Readonly<Record<string, string | null>>;
  docStatus: Readonly<Record<string, DoctorStatus>>;
  tokenSeq: number;
  /** Receipt-series counter behind `MB/R/<FY>/<seq>` — monotonic, never reused. */
  receiptSeq: number;
  activeDept: string;
  lastReceipt: Appointment | null;
  /** MRN handed to the Create Appointment screen by "Book Appointment". */
  bookMrn: string | null;
}

interface AppointmentsActions {
  patch: (id: string, patch: Partial<Appointment>) => void;
  /** Next hospital-wide token (dept arg kept for call-site compatibility). */
  nextToken: (dept?: string) => string;
  checkIn: (id: string) => string;
  markPaid: (id: string, details?: PaymentDetails) => string;
  issueToken: (id: string) => string;
  cancel: (id: string, reason?: string, refund?: RefundDetails | null) => void;
  /** Refund without cancelling — reachable for online bookings too (HA-09). */
  refund: (id: string, details: RefundDetails) => void;
  /** Write off the consultation fee, with the reason that makes it auditable. */
  waiveFee: (id: string, reason: string) => void;
  /** Desk confirmation for a booking that arrived unconfirmed (HA-05). */
  approve: (id: string) => void;
  /**
   * The appointment's receipt number, minting one from the series if this is
   * the first time a receipt is opened for it. Stable from then on.
   */
  ensureReceiptNo: (id: string) => string;
  noShow: (id: string) => void;
  reschedule: (id: string, payload: ReschedulePayload) => void;
  editAppt: (id: string, patch: Partial<Appointment>) => void;
  undoCheckIn: (id: string) => void;
  revertToScheduled: (id: string) => void;
  /** Combined payment for several consultations — one payment, a token each. */
  markPaidMany: (ids: readonly string[], details?: PaymentDetails) => Appointment[];
  /**
   * Department queue, per doctor: today's appts for `doctor` with a token,
   * not finished, not currently serving (selector-style read on state).
   */
  queueForDoctor: (doctor: string) => Appointment[];
  callNext: (doctor: string) => void;
  complete: (doctor: string) => void;
  /** Patient not present — send to the end of the queue to recall later. */
  skip: (doctor: string) => void;
  setDocStatus: (doctor: string, status: DoctorStatus) => void;
  setDept: (dept: string) => void;
  create: (data: CreateAppointmentData) => Appointment;
  startBooking: (mrn: string) => void;
  /** Read + clear the pending "book for this patient" MRN. */
  consumeBooking: () => string | null;
  /** Front-desk capacity signal: booked load + live status for a doctor. */
  doctorLoadToday: (doctor: string) => DoctorLoad;
}

const FINISHED_STATUSES: readonly AppointmentStatus[] = ['Completed', 'Cancelled', 'No-show'];

export const useAppointmentsStore = create<AppointmentsState & AppointmentsActions>()(
  (set, get) => ({
    appts: seedAppointments(),
    serving: INITIAL_SERVING,
    docStatus: INITIAL_DOC_STATUS,
    tokenSeq: INITIAL_TOKEN_SEQ,
    receiptSeq: INITIAL_RECEIPT_SEQ,
    activeDept: 'All Departments',
    lastReceipt: null,
    bookMrn: null,

    patch: (id, patch) =>
      set((s) => ({ appts: s.appts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),

    nextToken: (_dept) => {
      const seq = get().tokenSeq + 1;
      set({ tokenSeq: seq });
      return formatToken(seq);
    },

    ensureReceiptNo: (id) => {
      const a = get().appts.find((x) => x.id === id);
      if (!a) return '';
      if (a.receiptNo) return a.receiptNo;
      const seq = get().receiptSeq + 1;
      const receiptNo = formatReceiptNo(seq);
      set({ receiptSeq: seq });
      get().patch(id, { receiptNo });
      return receiptNo;
    },

    checkIn: (id) => {
      const a = get().appts.find((x) => x.id === id);
      if (!a) return '';
      const token = a.token ?? get().nextToken(a.dept);
      get().patch(id, { token, status: 'In Queue' });
      toast(`${a.name} checked in · Token ${token}`, 'success');
      return token;
    },

    markPaid: (id, details = {}) => {
      const a = get().appts.find((x) => x.id === id);
      if (!a) return '';
      const token = a.token ?? get().nextToken(a.dept);
      const receiptSeq = get().receiptSeq + 1;
      const receiptNo = a.receiptNo ?? formatReceiptNo(receiptSeq);
      if (!a.receiptNo) set({ receiptSeq });
      get().patch(id, {
        payment: 'Paid',
        token,
        status: 'In Queue',
        payMode: details.mode,
        payRef: details.ref,
        receiptNo,
      });
      set({
        lastReceipt: {
          ...a,
          payment: 'Paid',
          token,
          payMode: details.mode,
          payRef: details.ref,
          receiptNo,
        },
      });
      toast(`Payment recorded · Token ${token} issued`, 'success');
      return token;
    },

    issueToken: (id) => {
      const a = get().appts.find((x) => x.id === id);
      if (!a) return '';
      const token = a.token ?? get().nextToken(a.dept);
      get().patch(id, { token, status: 'In Queue' });
      toast(`Token ${token} issued for ${a.name}`, 'success');
      return token;
    },

    cancel: (id, reason, refundDetails) => {
      const refunded = refundDetails && refundDetails.amount > 0;
      get().patch(id, {
        status: 'Cancelled',
        cancelReason: reason ?? '',
        ...(refunded
          ? {
              payment: 'Refunded' as const,
              refundVia: refundDetails.via,
              refundAmount: refundDetails.amount,
              refundReason: refundDetails.reason,
              refundedAt: Date.now(),
            }
          : {}),
      });
      toast(
        refunded
          ? `Appointment cancelled · ${refundDetails.via === 'Desk' ? 'desk' : 'Medibook'} refund of ${money(refundDetails.amount)} recorded`
          : 'Appointment cancelled',
        'info',
      );
    },

    refund: (id, { amount, reason, via }) => {
      const a = get().appts.find((x) => x.id === id);
      if (!a) return;
      const paid = grossAmount(a);
      // Never hand back more than was taken — the modal validates too, but the
      // store is the last line of defence for a refund figure.
      const safe = Math.min(Math.max(0, amount), paid);
      if (safe <= 0) {
        toast('Enter a refund amount greater than zero', 'error');
        return;
      }
      get().patch(id, {
        payment: 'Refunded',
        refundVia: via,
        refundAmount: safe,
        refundReason: reason,
        refundedAt: Date.now(),
      });
      toast(
        safe < paid
          ? `Partial refund of ${money(safe)} recorded · ${money(paid - safe)} retained`
          : `Full refund of ${money(safe)} recorded`,
        'success',
      );
    },

    waiveFee: (id, reason) => {
      const a = get().appts.find((x) => x.id === id);
      if (!a) return;
      if (!reason.trim()) {
        toast('A fee waiver needs a reason', 'error');
        return;
      }
      get().patch(id, {
        payment: 'Waived',
        waivedAmount: grossAmount(a),
        waiveReason: reason.trim(),
        waivedAt: Date.now(),
      });
      toast(`Fee of ${money(grossAmount(a))} waived for ${a.name}`, 'success');
    },

    approve: (id) => {
      const a = get().appts.find((x) => x.id === id);
      if (!a) return;
      if (!a.needsApproval) return;
      get().patch(id, { needsApproval: false, approvedAt: Date.now() });
      toast(`${a.name}'s booking approved`, 'success');
    },

    noShow: (id) => {
      get().patch(id, { status: 'No-show' });
      toast('Marked as no-show', 'info');
    },

    reschedule: (id, { date, time, remark }) => {
      get().patch(id, { date, time, ...(remark != null ? { remark } : {}) });
      toast('Appointment rescheduled', 'success');
    },

    editAppt: (id, patch) => {
      const cur = get().appts.find((a) => a.id === id);
      const next = { ...patch };
      // The catalogue's fee for the new department (a doctor's own fee wins),
      // falling back to whatever was already charged (audit 2.6.3).
      if (patch.dept)
        next.amount =
          selectFee(useCatalogStore.getState(), patch.doctor ?? patch.dept) || cur?.amount;
      get().patch(id, next);
      toast('Appointment updated', 'success');
    },

    undoCheckIn: (id) => {
      const a = get().appts.find((x) => x.id === id);
      if (!a) return;
      get().patch(id, {
        status: 'Scheduled',
        ...(a.source === 'Walk-in' ? { token: null } : {}),
      });
      set((s) => ({
        serving: Object.fromEntries(
          Object.entries(s.serving).map(([d, t]) => [d, t === a.token ? null : t]),
        ),
      }));
      toast('Check-in undone · back to Scheduled', 'info');
    },

    revertToScheduled: (id) => {
      get().patch(id, { status: 'Scheduled' });
      toast('Reverted to Scheduled', 'info');
    },

    markPaidMany: (ids, details = {}) => {
      const updated: Appointment[] = [];
      // One payment, one receipt number — every consultation on the combined
      // receipt shares it, which is what makes the series reconcilable.
      const receiptSeq = get().receiptSeq + 1;
      const receiptNo = formatReceiptNo(receiptSeq);
      set({ receiptSeq });
      ids.forEach((id) => {
        const a = get().appts.find((x) => x.id === id);
        if (!a) return;
        const token = a.token ?? get().nextToken(a.dept);
        get().patch(id, {
          payment: 'Paid',
          token,
          status: 'In Queue',
          payMode: details.mode,
          payRef: details.ref,
          receiptNo,
        });
        const fresh = get().appts.find((x) => x.id === id);
        if (fresh) updated.push(fresh);
      });
      toast(
        `Payment recorded · ${ids.length} token${ids.length === 1 ? '' : 's'} issued`,
        'success',
      );
      return updated;
    },

    queueForDoctor: (doctor) => {
      const s = get();
      return s.appts
        .filter(
          (a) =>
            a.doctor === doctor &&
            a.date === 'Today' &&
            a.token &&
            !FINISHED_STATUSES.includes(a.status) &&
            a.token !== s.serving[doctor],
        )
        .sort(
          (x, y) =>
            (x.qorder ?? 0) - (y.qorder ?? 0) || (x.token ?? '').localeCompare(y.token ?? ''),
        );
    },

    callNext: (doctor) => {
      const next = get().queueForDoctor(doctor)[0];
      if (!next) {
        toast('No one waiting for ' + doctor, 'info');
        return;
      }
      get().patch(next.id, { status: 'In Queue', calledAt: Date.now() });
      set((st) => ({
        serving: { ...st.serving, [doctor]: next.token },
        docStatus: { ...st.docStatus, [doctor]: 'Consulting' },
      }));
      toast(`Now consulting ${next.token} · ${next.name}`, 'success');
    },

    complete: (doctor) => {
      const tok = get().serving[doctor];
      if (!tok) {
        toast('No active patient for ' + doctor, 'info');
        return;
      }
      const appt = get().appts.find((a) => a.token === tok && a.doctor === doctor);
      if (appt) get().patch(appt.id, { status: 'Completed' });
      const nextUp = get()
        .queueForDoctor(doctor)
        .filter((a) => a.token !== tok);
      set((st) => ({
        serving: { ...st.serving, [doctor]: null },
        docStatus: { ...st.docStatus, [doctor]: nextUp.length ? 'Waiting' : 'Available' },
      }));
      toast(`${tok} completed`, 'success');
    },

    skip: (doctor) => {
      const tok = get().serving[doctor];
      if (!tok) {
        toast('No patient is being seen', 'info');
        return;
      }
      const appt = get().appts.find((a) => a.token === tok && a.doctor === doctor);
      if (appt) get().patch(appt.id, { status: 'In Queue', qorder: Date.now(), calledAt: null });
      const more = get()
        .queueForDoctor(doctor)
        .filter((a) => a.token !== tok);
      set((st) => ({
        serving: { ...st.serving, [doctor]: null },
        docStatus: { ...st.docStatus, [doctor]: more.length ? 'Waiting' : 'Available' },
      }));
      toast(`${tok} skipped · moved to the end of the queue`, 'info');
    },

    setDocStatus: (doctor, status) =>
      set((st) => ({ docStatus: { ...st.docStatus, [doctor]: status } })),

    setDept: (dept) => set({ activeDept: dept }),

    create: (data) => {
      const isOnline = data.source === 'Online';
      const appt: Appointment = {
        id: mintApptId(),
        mrn: data.mrn || mintMrn(),
        name: data.name,
        age: data.age,
        gender: data.gender,
        phone: data.phone,
        dept: data.dept,
        doctor: data.doctor,
        source: data.source,
        date: data.date,
        time: data.time,
        amount: selectFee(useCatalogStore.getState(), data.doctor || data.dept) || 600,
        payment: isOnline ? 'Paid' : 'Pending',
        // online bookings get a token auto-assigned at booking; walk-ins get it at payment
        token: isOnline && data.date === 'Today' ? get().nextToken(data.dept) : null,
        status: 'Scheduled',
        remark: data.remark ?? '',
      };
      set((s) => ({ appts: [appt, ...s.appts] }));
      // Cross-store: brand-new MRNs become patient records too.
      const patients = usePatientsStore.getState();
      if (!patients.patients.some((p) => p.mrn === appt.mrn)) {
        patients.patAdd({
          mrn: appt.mrn,
          name: appt.name,
          age: appt.age,
          gender: appt.gender,
          phone: appt.phone,
          email: data.email ?? '',
          address: data.address ?? '',
        });
      }
      return appt;
    },

    startBooking: (mrn) => set({ bookMrn: mrn }),

    consumeBooking: () => {
      const mrn = get().bookMrn;
      if (mrn != null) set({ bookMrn: null });
      return mrn;
    },

    doctorLoadToday: (doctor) => {
      const s = get();
      return doctorLoad(s.appts, s.docStatus, doctor);
    },
  }),
);
