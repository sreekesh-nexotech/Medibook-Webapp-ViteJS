/**
 * Seed hospital profile: three branches, a holiday calendar covering the next
 * few weeks, and three banners published to the patient app (one live, one
 * scheduled, one expired) so every derived state is visible on first load.
 *
 * Departments, cities and hospital names follow `CANONICAL_MASTER_DATA`
 * (§1 departments, §3 hospitals).
 */

import { DEMO_TODAY_ISO } from '@/core/config/demo';

import { shiftIsoDays } from '@/features/audit/application/store/audit.clock';

import type { HospitalBranch, HospitalHoliday, PatientBanner } from './profile.types';

export const SEED_BRANCHES: readonly HospitalBranch[] = [
  {
    id: 'br-main',
    name: 'Apollo Hospital — Bannerghatta',
    address: '154 Bannerghatta Road, Bengaluru 560076',
    city: 'Bengaluru',
    phone: '08045678900',
    departments: [
      'General Medicine',
      'Cardiology',
      'Orthopedics',
      'Pediatrics',
      'Neurology',
      'ENT',
      'Dermatology',
    ],
    primary: true,
  },
  {
    id: 'br-koramangala',
    name: 'Apollo Clinic — Koramangala',
    address: '8th Block, 80 Feet Road, Koramangala, Bengaluru 560095',
    city: 'Bengaluru',
    phone: '08045678911',
    departments: ['General Medicine', 'Pediatrics', 'Dermatology'],
    primary: false,
  },
  {
    id: 'br-whitefield',
    name: 'Apollo Annexe — Whitefield',
    address: 'ITPL Main Road, Whitefield, Bengaluru 560066',
    city: 'Bengaluru',
    phone: '08045678922',
    departments: ['General Medicine', 'Cardiology', 'ENT'],
    primary: false,
  },
];

export const SEED_HOLIDAYS: readonly HospitalHoliday[] = [
  {
    id: 'hol-1',
    name: 'Bakrid',
    from: shiftIsoDays(DEMO_TODAY_ISO, 4),
    to: shiftIsoDays(DEMO_TODAY_ISO, 4),
    scope: 'Whole hospital',
    scopeRef: '',
    note: 'Emergency care only. OPD and online booking closed.',
  },
  {
    id: 'hol-2',
    name: 'Independence Day',
    from: '2026-08-15',
    to: '2026-08-15',
    scope: 'Whole hospital',
    scopeRef: '',
    note: 'Public holiday.',
  },
  {
    id: 'hol-3',
    name: 'Koramangala annual maintenance',
    from: shiftIsoDays(DEMO_TODAY_ISO, 11),
    to: shiftIsoDays(DEMO_TODAY_ISO, 13),
    scope: 'Branch',
    scopeRef: 'br-koramangala',
    note: 'Electrical works — patients redirected to Bannerghatta.',
  },
  {
    id: 'hol-4',
    name: 'Cardiology conference',
    from: shiftIsoDays(DEMO_TODAY_ISO, 20),
    to: shiftIsoDays(DEMO_TODAY_ISO, 21),
    scope: 'Department',
    scopeRef: 'Cardiology',
    note: 'Consultants attending the national cardiology summit.',
  },
  {
    id: 'hol-5',
    name: 'Deepavali',
    from: '2026-11-08',
    to: '2026-11-09',
    scope: 'Whole hospital',
    scopeRef: '',
    note: 'OPD closed both days.',
  },
];

export const SEED_PATIENT_BANNERS: readonly PatientBanner[] = [
  {
    id: 'pb-1',
    title: 'Free BP & sugar check this week',
    body: 'Walk in to the Bannerghatta branch between 9 am and 12 pm for a complimentary blood pressure and random sugar check. No appointment needed.',
    img: null,
    from: shiftIsoDays(DEMO_TODAY_ISO, -3),
    to: shiftIsoDays(DEMO_TODAY_ISO, 4),
    audience: 'All patients',
    audienceDept: '',
    active: true,
  },
  {
    id: 'pb-2',
    title: 'Monsoon paediatric vaccination camp',
    body: 'Book a slot for the seasonal flu and typhoid vaccination camp. Paediatric consultation fee waived for camp bookings.',
    img: null,
    from: shiftIsoDays(DEMO_TODAY_ISO, 7),
    to: shiftIsoDays(DEMO_TODAY_ISO, 21),
    audience: 'Patients of a department',
    audienceDept: 'Pediatrics',
    active: true,
  },
  {
    id: 'pb-3',
    title: 'Summer heart-health checkup — 20% off',
    body: 'Discounted ECG and echo package for returning cardiology patients.',
    img: null,
    from: shiftIsoDays(DEMO_TODAY_ISO, -45),
    to: shiftIsoDays(DEMO_TODAY_ISO, -10),
    audience: 'Returning patients',
    audienceDept: '',
    active: true,
  },
];
