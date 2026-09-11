/**
 * The reporting fact table: ~190 appointments over the 45 days up to the demo
 * clock, generated deterministically so every reload — and every reviewer —
 * sees the same numbers.
 *
 * Doctors, departments, fees, statuses, token and receipt formats all follow
 * `CANONICAL_MASTER_DATA` (§1–§7). The generator is a plain LCG rather than
 * `Math.random()` precisely so the report totals are stable and can be checked
 * by hand.
 */

import { DEMO_TODAY_ISO, SETTLE_COMMISSION } from '@/core/config/demo';

import { shiftIsoDays } from '@/features/audit/application/store/audit.clock';

import type { AppointmentSource, FactStatus, PaymentMode, ReportFact } from './reports.types';

/** Days of history the fact table covers, ending on the demo "today". */
const HISTORY_DAYS = 45;

/** Appointments generated per day (before weekend thinning). */
const MIN_PER_DAY = 3;
const MAX_PER_DAY = 6;

/** Canonical doctor roster (CANONICAL_MASTER_DATA §2). */
interface DoctorSeed {
  readonly name: string;
  readonly dept: string;
  readonly fee: number;
}

export const REPORT_DOCTORS: readonly DoctorSeed[] = [
  { name: 'Dr. Anil Kumar', dept: 'General Medicine', fee: 500 },
  { name: 'Dr. Meera Nair', dept: 'General Medicine', fee: 450 },
  { name: 'Dr. Thomas Kurian', dept: 'Cardiology', fee: 800 },
  { name: 'Dr. Anya Sharma', dept: 'Cardiology', fee: 900 },
  { name: 'Dr. Geetha Rao', dept: 'Orthopedics', fee: 700 },
  { name: 'Dr. Kumar Venkat', dept: 'Pediatrics', fee: 600 },
  { name: 'Dr. Maya Suresh', dept: 'Neurology', fee: 1000 },
  { name: 'Dr. Arun Bhat', dept: 'ENT', fee: 500 },
  { name: 'Dr. Leela Pillai', dept: 'Dermatology', fee: 650 },
];

/** Canonical departments, in canonical order (CANONICAL_MASTER_DATA §1). */
export const REPORT_DEPARTMENTS: readonly string[] = [
  'General Medicine',
  'Cardiology',
  'Orthopedics',
  'Pediatrics',
  'Neurology',
  'ENT',
  'Dermatology',
];

/** Desk users who book walk-ins; app bookings are "Patient app". */
export const REPORT_STAFF: readonly string[] = [
  'Riya Menon',
  'Karthik Rao',
  'Dr. S. Nair',
  'Anita Desai',
];

/** The patient roster the facts draw from (name + a stable MRN suffix). */
const PATIENTS: readonly string[] = [
  'Ellen Kinderson',
  'John Miller',
  'Maya Rao',
  'Arun Patel',
  'Sneha Kulkarni',
  'Rahul Verma',
  'Divya Menon',
  'Imran Sheikh',
  'Kavya Iyer',
  'Nikhil Joshi',
  'Preeti Balan',
  'Sanjay Gupta',
  'Lakshmi Narayan',
  'Vivek Menon',
  'Fatima Khan',
  'Rohit Shetty',
  'Anjali Desai',
  'Manoj Pillai',
  'Neha Bhat',
  'Suresh Kamath',
  'Pooja Hegde',
  'Tarun Reddy',
  'Meghna Dutta',
  'Harish Kumar',
  'Shalini Prasad',
  'Zoya Ahmed',
  'Ganesh Iyer',
  'Ritu Chawla',
  'Deepak Nair',
  'Aarti Sinha',
  'Vikram Shenoy',
  'Nisha Varma',
];

const SLOT_TIMES: readonly string[] = [
  '8:30 am',
  '9:00 am',
  '9:30 am',
  '10:00 am',
  '10:30 am',
  '11:00 am',
  '11:30 am',
  '12:00 pm',
  '2:00 pm',
  '2:30 pm',
  '3:00 pm',
  '3:30 pm',
  '4:00 pm',
  '4:30 pm',
  '5:00 pm',
  '5:30 pm',
];

const CANCEL_REASONS: readonly string[] = [
  'Patient request',
  'Doctor unavailable',
  'Rescheduled by patient',
  'Payment not completed',
];

const NO_SHOW_REASON = 'Patient did not arrive';

/** Desk payment modes for a walk-in. */
const DESK_MODES: readonly PaymentMode[] = ['Cash', 'UPI', 'Card'];

/** Refund slab applied to an eligible cancellation: 75% of the fee. */
const REFUND_SLAB = 0.75;

/** Deterministic linear-congruential generator — stable seeds, stable totals. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Pick from a list with the generator. */
function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)] ?? list[0];
}

/** Weekday index of an ISO date, 0 = Monday … 6 = Sunday. */
function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(y, (m ?? 1) - 1, d ?? 1, 12).getDay() + 6) % 7;
}

/** Build the fact table. Exported as a constant below; parameterised for tests. */
function buildFacts(): readonly ReportFact[] {
  const rng = makeRng(20260613);
  const out: ReportFact[] = [];
  let receiptSeq = 0;
  let refSeq = 100;

  for (let back = HISTORY_DAYS - 1; back >= 0; back -= 1) {
    const date = shiftIsoDays(DEMO_TODAY_ISO, -back);
    const weekday = weekdayIndex(date);
    // Sunday is closed (the seeded hospital hours), Saturday is quieter.
    if (weekday === 6) continue;
    const perDay =
      MIN_PER_DAY + Math.floor(rng() * (MAX_PER_DAY - MIN_PER_DAY + 1)) - (weekday === 5 ? 1 : 0);

    for (let i = 0; i < Math.max(1, perDay); i += 1) {
      const doctor = pick(rng, REPORT_DOCTORS);
      const patient = pick(rng, PATIENTS);
      const patientIndex = PATIENTS.indexOf(patient);
      const source: AppointmentSource = rng() < 0.58 ? 'Online' : 'Walk-in';
      const roll = rng();

      const isToday = back === 0;
      let status: FactStatus;
      if (roll < 0.07) status = 'Cancelled';
      else if (roll < 0.11) status = 'No-show';
      else if (isToday) status = rng() < 0.5 ? 'In Queue' : 'Scheduled';
      else status = 'Completed';

      const fee = doctor.fee;
      const paid = status !== 'Cancelled' && (source === 'Online' || rng() < 0.86);
      const mode: PaymentMode = !paid
        ? 'Unpaid'
        : source === 'Online'
          ? 'Online'
          : pick(rng, DESK_MODES);
      const collected = paid ? fee : 0;
      const refund =
        status === 'Cancelled' && source === 'Online' && rng() < 0.72
          ? Math.round(fee * REFUND_SLAB)
          : 0;
      const commission = source === 'Online' && paid ? Math.round(fee * SETTLE_COMMISSION) : 0;

      refSeq += 1;
      if (paid) receiptSeq += 1;

      out.push({
        id: `RF${String(out.length + 1).padStart(4, '0')}`,
        bookingRef: `MB-2026-${String(refSeq).padStart(6, '0')}`,
        date,
        bookedOn: source === 'Online' ? shiftIsoDays(date, -Math.floor(rng() * 9) - 1) : date,
        time: pick(rng, SLOT_TIMES),
        patient,
        mrn: `AP${847200 + patientIndex}`,
        phone: `98765${String(43200 + patientIndex).padStart(5, '0')}`,
        dept: doctor.dept,
        doctor: doctor.name,
        source,
        status,
        fee,
        collected,
        mode,
        refund,
        commission,
        receipt: paid ? `MB/R/2026-27/${String(receiptSeq).padStart(6, '0')}` : null,
        token:
          status === 'In Queue' || status === 'Completed'
            ? `T-${String((i % 40) + 1).padStart(3, '0')}`
            : null,
        rating: status === 'Completed' ? Math.round((3.6 + rng() * 1.4) * 10) / 10 : null,
        bookedBy: source === 'Online' ? 'Patient app' : pick(rng, REPORT_STAFF),
        reason:
          status === 'Cancelled'
            ? pick(rng, CANCEL_REASONS)
            : status === 'No-show'
              ? NO_SHOW_REASON
              : '',
      });
    }
  }
  return out;
}

/** The seeded fact table every report reads. */
export const REPORT_FACTS: readonly ReportFact[] = buildFacts();

/** Earliest date in the fact table, for the date-range hint. */
export const FACTS_FROM: string = REPORT_FACTS[0]?.date ?? DEMO_TODAY_ISO;

/** Latest date in the fact table. */
export const FACTS_TO: string = REPORT_FACTS[REPORT_FACTS.length - 1]?.date ?? DEMO_TODAY_ISO;
