/**
 * Seed data for subscription plans — the design prototype's `OpsDB.plans` /
 * `OpsDB.planChanges` (Ops.jsx), extended with the yearly price and the six
 * per-dimension ceilings audit SA-02 asks for. `hid` values are materialized
 * from the prototype's `OPS_NAME_TO_ID` back-fill.
 */
import { UNLIMITED } from '@/features/ops-plans/application/store/plans.limits';
import type { Plan, PlanChange } from '@/features/ops-plans/application/store/plans.types';

export const OPS_PLANS: readonly Plan[] = [
  {
    id: 1,
    name: 'Starter',
    price: 9999,
    yearlyPrice: 99990,
    limits: {
      bookings: 1500,
      staff: 25,
      doctors: 10,
      branches: 1,
      storageGb: 20,
      messageCredits: 2000,
    },
    quota: 1500,
    support: 'Email support',
    extra: 'Standard reports',
    popular: false,
    custom: false,
  },
  {
    id: 2,
    name: 'Growth',
    price: 24999,
    yearlyPrice: 249990,
    limits: {
      bookings: 5000,
      staff: 120,
      doctors: 40,
      branches: 3,
      storageGb: 100,
      messageCredits: 10000,
    },
    quota: 5000,
    support: 'Priority support',
    extra: 'Advanced analytics',
    popular: true,
    custom: false,
  },
  {
    id: 3,
    name: 'Enterprise',
    price: 49999,
    yearlyPrice: 479990,
    limits: {
      bookings: 8000,
      staff: UNLIMITED,
      doctors: UNLIMITED,
      branches: 10,
      storageGb: 500,
      messageCredits: 50000,
    },
    quota: 8000,
    support: 'Dedicated success manager',
    extra: 'Custom integrations',
    popular: false,
    custom: false,
  },
  {
    id: 4,
    name: 'Custom — Trinity Care',
    price: 59999,
    yearlyPrice: null,
    limits: {
      bookings: 10000,
      staff: UNLIMITED,
      doctors: UNLIMITED,
      branches: UNLIMITED,
      storageGb: 1000,
      messageCredits: UNLIMITED,
    },
    quota: 10000,
    support: 'Dedicated success manager',
    extra: 'Negotiated SLA & integrations',
    popular: false,
    custom: true,
  },
];

export const OPS_PLAN_CHANGES: readonly PlanChange[] = [
  {
    id: 1,
    hid: 7,
    hospital: 'Vasudha Medical Centre',
    email: 'care@vasudhamed.in',
    change: 'Starter → Growth',
    requested: 'June 12, 2026',
    status: 'Completed',
  },
  {
    id: 2,
    hid: 12,
    hospital: 'Charak Institute of Medicine',
    email: 'admin@charakim.in',
    change: 'Growth → Enterprise',
    requested: 'June 10, 2026',
    status: 'Pending',
  },
  {
    id: 3,
    hid: 10,
    hospital: 'Padma Eye Foundation',
    email: 'appointments@padmaeye.in',
    change: 'Growth → Starter',
    requested: 'June 06, 2026',
    status: 'Completed',
  },
  {
    id: 4,
    hid: 9,
    hospital: 'Girnar Multispeciality',
    email: 'admin@girnarmsp.in',
    change: 'Starter → Growth',
    requested: 'June 02, 2026',
    status: 'Cancelled',
  },
];
