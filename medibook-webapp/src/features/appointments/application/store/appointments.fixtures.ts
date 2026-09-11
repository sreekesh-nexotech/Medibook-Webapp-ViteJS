/**
 * Seed appointments + initial queue state, transcribed verbatim from the
 * design prototype (`data.jsx` `SEED` / `initStore()`). Ids materialize the
 * prototype's `"AP" + (1000 + i)` mapping. A spread of every state so all
 * actions are demoable.
 */

import { formatReceiptNo } from './appointments.logic';
import type { Appointment, DoctorStatus, PaymentState } from './appointments.types';

export const SEED_APPOINTMENTS: readonly Appointment[] = [
  {
    id: 'AP1000',
    mrn: 'AP847201',
    name: 'Ellen Kinderson',
    age: 32,
    gender: 'Female',
    phone: '9876543210',
    dept: 'Cardiology',
    doctor: 'Dr. Thomas K.',
    source: 'Online',
    date: 'Today',
    time: '8:30 am',
    amount: 800,
    payment: 'Paid',
    token: 'T-001',
    status: 'Scheduled',
    remark: '',
  },
  {
    id: 'AP1001',
    mrn: 'AP847202',
    name: 'John Miller',
    age: 45,
    gender: 'Male',
    phone: '9876543211',
    dept: 'Cardiology',
    doctor: 'Dr. Thomas K.',
    source: 'Walk-in',
    date: 'Today',
    time: '9:00 am',
    amount: 800,
    payment: 'Pending',
    token: null,
    status: 'Scheduled',
    remark: 'Senior citizen',
  },
  {
    id: 'AP1002',
    mrn: 'AP847203',
    name: 'Maya Rao',
    age: 29,
    gender: 'Female',
    phone: '9876543212',
    dept: 'Pediatrics',
    doctor: 'Dr. Kumar V.',
    source: 'Online',
    date: 'Today',
    time: '9:15 am',
    amount: 600,
    payment: 'Paid',
    token: 'T-002',
    status: 'In Queue',
    remark: '',
  },
  {
    id: 'AP1003',
    mrn: 'AP847204',
    name: 'Arun Patel',
    age: 51,
    gender: 'Male',
    phone: '9876543213',
    dept: 'Orthopedics',
    doctor: 'Dr. Geetha R.',
    source: 'Walk-in',
    date: 'Today',
    time: '9:30 am',
    amount: 700,
    payment: 'Paid',
    token: 'T-003',
    status: 'In Queue',
    remark: '',
  },
  {
    id: 'AP1004',
    mrn: 'AP847205',
    name: 'Sara Iqbal',
    age: 38,
    gender: 'Female',
    phone: '9876543214',
    dept: 'Cardiology',
    doctor: 'Dr. Anil R.',
    source: 'Walk-in',
    date: 'Today',
    time: '9:45 am',
    amount: 800,
    payment: 'Pending',
    token: null,
    status: 'Scheduled',
    remark: '',
  },
  {
    id: 'AP1005',
    mrn: 'AP847206',
    name: 'Vikram Das',
    age: 60,
    gender: 'Male',
    phone: '9876543215',
    dept: 'Neurology',
    doctor: 'Dr. Maya S.',
    source: 'Online',
    date: 'Today',
    time: '10:00 am',
    amount: 1000,
    payment: 'Paid',
    token: 'T-004',
    status: 'Scheduled',
    remark: '',
    needsApproval: true,
  },
  {
    id: 'AP1006',
    mrn: 'AP847207',
    name: 'Nisha Roy',
    age: 24,
    gender: 'Female',
    phone: '9876543216',
    dept: 'Pediatrics',
    doctor: 'Dr. Kumar V.',
    source: 'Online',
    date: 'Today',
    time: '10:15 am',
    amount: 600,
    payment: 'Paid',
    token: 'T-005',
    status: 'No-show',
    remark: '',
  },
  {
    id: 'AP1007',
    mrn: 'AP847208',
    name: 'Imran Sheikh',
    age: 41,
    gender: 'Male',
    phone: '9876543217',
    dept: 'ENT',
    doctor: 'Dr. Arun B.',
    source: 'Walk-in',
    date: 'Today',
    time: '10:30 am',
    amount: 500,
    payment: 'Paid',
    token: 'T-006',
    status: 'Completed',
    remark: '',
  },
  {
    id: 'AP1008',
    mrn: 'AP847209',
    name: 'Priya Nair',
    age: 35,
    gender: 'Female',
    phone: '9876543218',
    dept: 'Dermatology',
    doctor: 'Dr. Leela P.',
    source: 'Walk-in',
    date: 'Today',
    time: '10:45 am',
    amount: 650,
    payment: 'Pending',
    token: null,
    status: 'Scheduled',
    remark: '',
  },
  {
    id: 'AP1009',
    mrn: 'AP847210',
    name: 'George Thomas',
    age: 58,
    gender: 'Male',
    phone: '9876543219',
    dept: 'Cardiology',
    doctor: 'Dr. Thomas K.',
    source: 'Online',
    date: 'Today',
    time: '11:00 am',
    amount: 800,
    payment: 'Paid',
    token: 'T-007',
    status: 'Scheduled',
    remark: '',
    needsApproval: true,
  },
  {
    id: 'AP1010',
    mrn: 'AP847211',
    name: 'Fatima Begum',
    age: 27,
    gender: 'Female',
    phone: '9876543220',
    dept: 'Orthopedics',
    doctor: 'Dr. Geetha R.',
    source: 'Walk-in',
    date: 'Tomorrow',
    time: '9:00 am',
    amount: 700,
    payment: 'Pending',
    token: null,
    status: 'Scheduled',
    remark: 'Future booking',
  },
  {
    id: 'AP1011',
    mrn: 'AP847212',
    name: 'Daniel Joseph',
    age: 49,
    gender: 'Male',
    phone: '9876543221',
    dept: 'Neurology',
    doctor: 'Dr. Maya S.',
    source: 'Online',
    date: 'Today',
    time: '11:15 am',
    amount: 1000,
    payment: 'Refunded',
    token: null,
    status: 'Cancelled',
    remark: 'Patient cancelled',
  },
];

/** Each doctor's token currently in consultation (design `serving` seed). */
export const INITIAL_SERVING: Readonly<Record<string, string | null>> = {
  'Dr. Geetha R.': 'T-003',
  'Dr. Kumar V.': 'T-002',
};

/** Live doctor statuses at seed time (design `docStatus` seed). */
export const INITIAL_DOC_STATUS: Readonly<Record<string, DoctorStatus>> = {
  'Dr. Thomas K.': 'Available',
  'Dr. Anil R.': 'Available',
  'Dr. Geetha R.': 'Consulting',
  'Dr. Kumar V.': 'Consulting',
  'Dr. Maya S.': 'Waiting',
  'Dr. Arun B.': 'Available',
  'Dr. Leela P.': 'On Break',
};

/** Hospital-wide token sequence already consumed by the seed (next issue = T-008). */
export const INITIAL_TOKEN_SEQ = 7;

/** Payment states that mean money changed hands, so a receipt exists. */
const RECEIPTED_STATES: readonly PaymentState[] = ['Paid', 'Refunded'];

/**
 * Receipt numbers already issued by the seed — so the financial-year series
 * (`MB/R/2026-27/000123`) starts from a realistic figure rather than 1, and the
 * store's next mint continues it.
 */
export const INITIAL_RECEIPT_SEQ = SEED_APPOINTMENTS.filter((a) =>
  RECEIPTED_STATES.includes(a.payment),
).length;

const MINUTE_MS = 60_000;

/**
 * How long ago each currently-serving token was called, relative to "now"
 * (design: T-003 called 12 minutes ago, T-002 called 5 minutes ago).
 */
export const CALLED_AT_OFFSETS_MS: Readonly<Record<string, number>> = {
  'T-003': 12 * MINUTE_MS,
  'T-002': 5 * MINUTE_MS,
};

/**
 * The seed rows with `calledAt` applied exactly as the prototype's
 * `initStore()` does at startup. The store calls this once at init.
 */
export function seedAppointments(now: number = Date.now()): readonly Appointment[] {
  let receiptSeq = 0;
  return SEED_APPOINTMENTS.map((a) => {
    const offset = a.token == null ? undefined : CALLED_AT_OFFSETS_MS[a.token];
    const calledAt = offset == null ? {} : { calledAt: now - offset };
    // Already-paid seed rows carry a receipt number, in seed order, so the
    // series is continuous and re-opening a receipt never renumbers it.
    const receipt = RECEIPTED_STATES.includes(a.payment)
      ? { receiptNo: formatReceiptNo((receiptSeq += 1)) }
      : {};
    return { ...a, ...calledAt, ...receipt };
  });
}
