/**
 * Doctors & Departments seed catalog — **the canonical Medibook master data**
 * (`CANONICAL_MASTER_DATA.md` §1–§3): the seven departments, the nine doctors
 * with their canonical ids, specialisations, rooms, per-doctor fees and
 * hospital assignment, and the four hospitals they belong to.
 *
 * This replaces the design prototype's roster (`Catalog.jsx` `DEPTS_DATA` /
 * `DOCS_DATA`), whose abbreviated names ("Dr. Thomas K.") and `dp0`/`dc0` ids
 * disagreed with the patient app on every row — audit 2.6.2. Ids are the
 * canonical keys, so both apps join on the same values.
 *
 * Money is in **whole rupees**, the unit `money()` formats (the mobile app
 * holds the same figures in paise).
 *
 * Colors are concrete hex values because they feed data-driven inline styles
 * (dept card gradients), as in the design.
 */

import { isoFromToday } from '@/features/doctors/domain/calendar';

import type {
  DateException,
  Dept,
  Doctor,
  DoctorLeave,
  ShiftPattern,
  WeekDay,
} from './catalog.types';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * The bookable clock-time vocabulary of the catalog: weekly hours, shift
 * patterns and date exceptions all store one of these labels, so a slot grid
 * built from them always lands on a readable time.
 */
export const TIME_OPTS = [
  '8:00 am',
  '8:30 am',
  '9:00 am',
  '9:30 am',
  '10:00 am',
  '11:00 am',
  '12:00 pm',
  '1:00 pm',
  '2:00 pm',
  '3:00 pm',
  '4:00 pm',
  '5:00 pm',
  '6:00 pm',
  '7:00 pm',
  '8:00 pm',
] as const;

/** Build a weekly-hours grid: `onDays` are indexes into DAYS (0 = Mon). */
export function mkWeek(onDays: readonly number[], from: string, to: string): WeekDay[] {
  return DAYS.map((d, i) => ({ day: d, on: onDays.includes(i), from, to, patternIds: [] }));
}

/** Weekly grid whose open days run on named shift patterns instead of one window. */
function mkPatternWeek(onDays: readonly number[], patternIds: readonly string[]): WeekDay[] {
  return DAYS.map((d, i) => ({
    day: d,
    on: onDays.includes(i),
    from: '9:00 am',
    to: '5:00 pm',
    patternIds: onDays.includes(i) ? patternIds : [],
  }));
}

/** Canonical hospitals (`CANONICAL_MASTER_DATA.md` §3), id → display name. */
export const HOSPITAL_NAMES: Readonly<Record<string, string>> = {
  apollo: 'Apollo Hospital',
  citycare: 'City Care Clinic',
  sunrise: 'Sunrise Multispeciality',
  lakeside: 'Lakeside Hospital',
};

/** Hospital ids offered by the doctor editor, in canonical order. */
export const HOSPITAL_IDS: readonly string[] = ['apollo', 'citycare', 'sunrise', 'lakeside'];

/**
 * The seeded shift-pattern library (HA-06). Hospital-wide and reusable: a
 * weekday references patterns by id, so "Morning OPD" is edited once and every
 * doctor and every generated slot follows.
 */
export const SHIFT_PATTERNS_DATA: readonly ShiftPattern[] = [
  { id: 'sp-morning-opd', name: 'Morning OPD', from: '9:00 am', to: '1:00 pm' },
  { id: 'sp-evening-opd', name: 'Evening OPD', from: '4:00 pm', to: '8:00 pm' },
  { id: 'sp-full-day', name: 'Full day', from: '9:00 am', to: '5:00 pm' },
  { id: 'sp-early-clinic', name: 'Early clinic', from: '8:00 am', to: '11:00 am' },
];

export const DEPTS_DATA: readonly Dept[] = [
  {
    id: 'general-medicine',
    name: 'General Medicine',
    about: 'Primary healthcare — consultations, fever, diabetes and routine check-ups.',
    fee: 500,
    hours: 'Mon–Sat · 9am–6pm',
    status: 'Active',
    color: '#2055ca',
    week: mkWeek([0, 1, 2, 3, 4, 5], '9:00 am', '6:00 pm'),
  },
  {
    id: 'cardiology',
    name: 'Cardiology',
    about: 'Heart specialists — consultations, ECG, echo.',
    fee: 800,
    hours: 'Mon–Sat · 9am–6pm',
    status: 'Active',
    color: '#2563eb',
    week: mkWeek([0, 1, 2, 3, 4, 5], '9:00 am', '6:00 pm'),
  },
  {
    id: 'orthopedics',
    name: 'Orthopedics',
    about: 'Bone & joint care — spine, sports injuries and joint replacement.',
    fee: 700,
    hours: 'Mon–Sat · 10am–6pm',
    status: 'Active',
    color: '#3f5e85',
    week: mkWeek([0, 1, 2, 3, 4, 5], '10:00 am', '6:00 pm'),
  },
  {
    id: 'pediatrics',
    name: 'Pediatrics',
    about: 'Child health — growth, vaccinations and paediatric illness.',
    fee: 600,
    hours: 'Mon–Sat · 9am–4pm',
    status: 'Active',
    color: '#2ecc71',
    week: mkWeek([0, 1, 2, 3, 4, 5], '9:00 am', '4:00 pm'),
  },
  {
    id: 'neurology',
    name: 'Neurology',
    about: 'Brain & nerve care — headache, epilepsy and stroke follow-up.',
    fee: 1000,
    hours: 'Tue–Sat · 10am–5pm',
    status: 'Active',
    color: '#f59e0b',
    week: mkWeek([1, 2, 3, 4, 5], '10:00 am', '5:00 pm'),
  },
  {
    id: 'ent',
    name: 'ENT',
    about: 'Ear, nose & throat — hearing, sinus and voice care.',
    fee: 500,
    hours: 'Mon–Fri · 9am–5pm',
    status: 'Active',
    color: '#8095ae',
    week: mkWeek([0, 1, 2, 3, 4], '9:00 am', '5:00 pm'),
  },
  {
    id: 'dermatology',
    name: 'Dermatology',
    about: 'Skin specialists — skin, hair and nail treatment.',
    fee: 650,
    hours: 'Mon–Sat · 11am–6pm',
    status: 'Active',
    color: '#ea7c2b',
    week: mkWeek([0, 1, 2, 3, 4, 5], '11:00 am', '6:00 pm'),
  },
];

/**
 * Seeded leave / date exceptions are anchored to the **real** clock
 * (`isoFromToday`), not a frozen demo date, so the slot grid always has a
 * live leave block and a live exception to show whenever the demo is opened.
 */
const CONFERENCE_LEAVE: DoctorLeave = {
  id: 'lv-thomas-conf',
  from: isoFromToday(5),
  to: isoFromToday(7),
  type: 'Conference',
  reason: 'Cardiology Society annual meet',
};

const SICK_LEAVE: DoctorLeave = {
  id: 'lv-kumar-sick',
  from: isoFromToday(1),
  to: isoFromToday(3),
  type: 'Sick',
  reason: 'Medical leave',
};

const CASUAL_LEAVE: DoctorLeave = {
  id: 'lv-geetha-casual',
  from: isoFromToday(9),
  to: isoFromToday(9),
  type: 'Casual',
  reason: 'Personal',
};

const EXTRA_SUNDAY_CLINIC: DateException = {
  id: 'ex-anya-sunday',
  date: isoFromToday(4),
  closed: false,
  from: '10:00 am',
  to: '1:00 pm',
  note: 'Extra weekend cardiac clinic',
};

const EARLY_CLOSE: DateException = {
  id: 'ex-leela-early',
  date: isoFromToday(2),
  closed: false,
  from: '11:00 am',
  to: '2:00 pm',
  note: 'Early close — hospital audit',
};

export const DOCS_DATA: readonly Doctor[] = [
  {
    id: 'dr-anil-kumar',
    name: 'Dr. Anil Kumar',
    depts: ['General Medicine'],
    spec: 'General Physician',
    room: '101',
    fee: 500,
    rating: 4.6,
    reviews: 118,
    status: 'Active',
    hospital: 'apollo',
    week: mkPatternWeek([0, 1, 2, 3, 4, 5], ['sp-morning-opd', 'sp-evening-opd']),
    leave: [],
    exceptions: [],
    list: [
      {
        a: 'Ramesh G.',
        r: 5,
        d: '2 days ago',
        t: 'Very thorough and patient. Explained everything clearly.',
      },
      { a: 'Priya N.', r: 4, d: '1 week ago', t: 'Short wait, good consultation.' },
    ],
  },
  {
    id: 'dr-meera-nair',
    name: 'Dr. Meera Nair',
    depts: ['General Medicine'],
    spec: 'General Physician',
    room: '102',
    fee: 450,
    rating: 4.7,
    reviews: 86,
    status: 'Active',
    hospital: 'citycare',
    week: mkWeek([0, 1, 2, 3, 4, 5], '10:00 am', '5:00 pm'),
    leave: [],
    exceptions: [],
    list: [{ a: 'Sara K.', r: 5, d: '3 days ago', t: 'Caring and knowledgeable.' }],
  },
  {
    id: 'dr-thomas-kurian',
    name: 'Dr. Thomas Kurian',
    depts: ['Cardiology'],
    spec: 'Cardiologist',
    room: '201',
    fee: 800,
    rating: 4.9,
    reviews: 128,
    status: 'Active',
    hospital: 'apollo',
    week: mkPatternWeek([0, 1, 2, 3, 4], ['sp-morning-opd']),
    leave: [CONFERENCE_LEAVE],
    exceptions: [],
    list: [
      { a: 'Imran S.', r: 4, d: '2 weeks ago', t: 'Good doctor, clinic was a little busy.' },
      { a: 'Nisha R.', r: 5, d: '5 days ago', t: 'Explained my ECG in plain language.' },
    ],
  },
  {
    id: 'dr-anya-sharma',
    name: 'Dr. Anya Sharma',
    depts: ['Cardiology'],
    spec: 'Cardiologist',
    room: '202',
    fee: 900,
    rating: 4.8,
    reviews: 94,
    status: 'Active',
    hospital: 'apollo',
    week: mkWeek([0, 1, 2, 3, 4, 5], '10:00 am', '6:00 pm'),
    leave: [],
    exceptions: [EXTRA_SUNDAY_CLINIC],
    list: [{ a: 'Vikram D.', r: 5, d: '1 week ago', t: 'Detailed and professional.' }],
  },
  {
    id: 'dr-geetha-rao',
    name: 'Dr. Geetha Rao',
    depts: ['Orthopedics'],
    spec: 'Orthopedic Surgeon',
    room: '301',
    fee: 700,
    rating: 4.7,
    reviews: 91,
    status: 'Active',
    hospital: 'apollo',
    week: mkWeek([0, 1, 2, 3, 4, 5], '10:00 am', '6:00 pm'),
    leave: [CASUAL_LEAVE],
    exceptions: [],
    list: [{ a: 'Arun P.', r: 5, d: '4 days ago', t: 'Fixed my knee pain. Highly recommend.' }],
  },
  {
    id: 'dr-kumar-venkat',
    name: 'Dr. Kumar Venkat',
    depts: ['Pediatrics'],
    spec: 'Pediatrician',
    room: '401',
    fee: 600,
    rating: 4.8,
    reviews: 142,
    status: 'On Leave',
    hospital: 'citycare',
    week: mkWeek([1, 2, 3, 4, 5], '9:00 am', '4:00 pm'),
    leave: [SICK_LEAVE],
    exceptions: [],
    list: [
      { a: 'Fatima S.', r: 5, d: '2 weeks ago', t: 'Gentle and reassuring.' },
      { a: 'Deepa M.', r: 5, d: '6 days ago', t: 'Wonderful with kids.' },
    ],
  },
  {
    id: 'dr-maya-suresh',
    name: 'Dr. Maya Suresh',
    depts: ['Neurology'],
    spec: 'Neurologist',
    room: '501',
    fee: 1000,
    rating: 4.5,
    reviews: 53,
    status: 'Active',
    hospital: 'apollo',
    week: mkWeek([1, 2, 3, 4, 5], '10:00 am', '5:00 pm'),
    leave: [],
    exceptions: [],
    list: [{ a: 'Girish T.', r: 4, d: '1 week ago', t: 'Patient and precise.' }],
  },
  {
    id: 'dr-arun-bhat',
    name: 'Dr. Arun Bhat',
    depts: ['ENT'],
    spec: 'ENT Specialist',
    room: '601',
    fee: 500,
    rating: 4.4,
    reviews: 38,
    status: 'Active',
    hospital: 'citycare',
    week: mkWeek([0, 1, 2, 3, 4], '9:00 am', '5:00 pm'),
    leave: [],
    exceptions: [],
    list: [{ a: 'Daniel J.', r: 4, d: '6 days ago', t: 'Quick and effective.' }],
  },
  {
    id: 'dr-leela-pillai',
    name: 'Dr. Leela Pillai',
    depts: ['Dermatology'],
    spec: 'Dermatologist',
    room: '701',
    fee: 650,
    rating: 4.6,
    reviews: 47,
    status: 'Active',
    hospital: 'apollo',
    week: mkWeek([0, 1, 2, 3, 4, 5], '11:00 am', '6:00 pm'),
    leave: [],
    exceptions: [EARLY_CLOSE],
    list: [{ a: 'Maya R.', r: 5, d: '3 days ago', t: 'Skin cleared up in weeks.' }],
  },
];

/**
 * Palette cycled for newly created departments (design `DEPT_COLORS`,
 * CSS vars replaced with their concrete hex values):
 * blue, p-400, g-500, y-500, blue-strong, p-300, orange.
 */
export const DEPT_COLORS: readonly string[] = [
  '#2563eb',
  '#3f5e85',
  '#2ecc71',
  '#f59e0b',
  '#2055ca',
  '#8095ae',
  '#ea7c2b',
];
