/**
 * Seed services catalogue, tax rates and coupons. Departments follow
 * `CANONICAL_MASTER_DATA` §1; prices are whole rupees; the 18% GST line is
 * the canonical exclusive tax the receipts already print (§7).
 */

import { DEMO_TODAY_ISO } from '@/core/config/demo';

import { shiftIsoDays } from '@/features/audit/application/store/audit.clock';

import type { Coupon, HospitalService, TaxRate } from './services.types';

export const SEED_SERVICES: readonly HospitalService[] = [
  {
    id: 'svc-1',
    name: 'General Consultation',
    dept: 'General Medicine',
    durationMinutes: 15,
    description: 'Standard OP consultation with a general physician.',
    price: 500,
    active: true,
  },
  {
    id: 'svc-2',
    name: 'ECG',
    dept: 'Cardiology',
    durationMinutes: 20,
    description: '12-lead electrocardiogram with same-day reporting.',
    price: 700,
    active: true,
  },
  {
    id: 'svc-3',
    name: 'Echocardiogram',
    dept: 'Cardiology',
    durationMinutes: 40,
    description: '2D echo with Doppler, reported by a consultant cardiologist.',
    price: 2400,
    active: true,
  },
  {
    id: 'svc-4',
    name: 'Treadmill Test (TMT)',
    dept: 'Cardiology',
    durationMinutes: 45,
    description: 'Stress test on a graded treadmill protocol.',
    price: 1800,
    active: true,
  },
  {
    id: 'svc-5',
    name: 'Digital X-ray (single view)',
    dept: 'Orthopedics',
    durationMinutes: 15,
    description: 'Single-view digital radiograph with a printed film.',
    price: 450,
    active: true,
  },
  {
    id: 'svc-6',
    name: 'Physiotherapy Session',
    dept: 'Orthopedics',
    durationMinutes: 30,
    description: 'One supervised rehabilitation session.',
    price: 600,
    active: true,
  },
  {
    id: 'svc-7',
    name: 'Child Vaccination',
    dept: 'Pediatrics',
    durationMinutes: 15,
    description: 'Scheduled immunisation with vaccine cost billed separately.',
    price: 350,
    active: true,
  },
  {
    id: 'svc-8',
    name: 'Nerve Conduction Study',
    dept: 'Neurology',
    durationMinutes: 45,
    description: 'NCS for suspected peripheral neuropathy.',
    price: 3200,
    active: true,
  },
  {
    id: 'svc-9',
    name: 'Audiometry',
    dept: 'ENT',
    durationMinutes: 30,
    description: 'Pure-tone audiometry in a sound-treated room.',
    price: 800,
    active: true,
  },
  {
    id: 'svc-10',
    name: 'Chemical Peel',
    dept: 'Dermatology',
    durationMinutes: 30,
    description: 'Superficial glycolic peel, per sitting.',
    price: 2000,
    active: false,
  },
];

export const SEED_TAXES: readonly TaxRate[] = [
  { id: 'tax-1', name: 'GST', percent: 18, mode: 'Exclusive', active: true },
  { id: 'tax-2', name: 'Health cess', percent: 2, mode: 'Exclusive', active: false },
];

export const SEED_COUPONS: readonly Coupon[] = [
  {
    id: 'cpn-1',
    code: 'MONSOON20',
    type: 'Percent',
    value: 20,
    from: shiftIsoDays(DEMO_TODAY_ISO, -10),
    to: shiftIsoDays(DEMO_TODAY_ISO, 20),
    usageCap: 250,
    used: 62,
    minOrder: 500,
    serviceIds: [],
    departments: [],
    active: true,
  },
  {
    id: 'cpn-2',
    code: 'HEART500',
    type: 'Flat',
    value: 500,
    from: shiftIsoDays(DEMO_TODAY_ISO, -3),
    to: shiftIsoDays(DEMO_TODAY_ISO, 27),
    usageCap: 100,
    used: 18,
    minOrder: 1800,
    serviceIds: ['svc-3', 'svc-4'],
    departments: ['Cardiology'],
    active: true,
  },
  {
    id: 'cpn-3',
    code: 'KIDSFREE',
    type: 'Percent',
    value: 100,
    from: shiftIsoDays(DEMO_TODAY_ISO, 7),
    to: shiftIsoDays(DEMO_TODAY_ISO, 14),
    usageCap: 40,
    used: 0,
    minOrder: 0,
    serviceIds: ['svc-7'],
    departments: ['Pediatrics'],
    active: true,
  },
  {
    id: 'cpn-4',
    code: 'SUMMER15',
    type: 'Percent',
    value: 15,
    from: shiftIsoDays(DEMO_TODAY_ISO, -60),
    to: shiftIsoDays(DEMO_TODAY_ISO, -20),
    usageCap: 200,
    used: 200,
    minOrder: 300,
    serviceIds: [],
    departments: [],
    active: true,
  },
];
