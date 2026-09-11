/**
 * Default hospital settings, transcribed verbatim from the design
 * prototype (`data.jsx` `DEFAULT_SETTINGS`).
 */

import { CANONICAL_TOKEN_SCHEME } from './settings.rules';
import type { HospitalSettings } from './settings.types';

export const DEFAULT_SETTINGS: HospitalSettings = {
  name: 'Apollo Hospital',
  regNo: 'KA-HOSP-20194',
  gstin: '29AAACA4033H1Z5',
  phone: '080 4567 8900',
  email: 'contact@apollo.med',
  about:
    'Apollo Hospital is a multi-speciality hospital offering cardiology, orthopedics, pediatrics and more, with 24/7 emergency care.',
  address: '154 Bannerghatta Road, Bengaluru 560076',
  lat: '12.9088',
  lng: '77.5975',
  logo: null,
  pin: { x: 50, y: 50 },
  hoursOpen: '8:00 am',
  hoursClose: '8:00 pm',
  hoursDays: [true, true, true, true, true, true, false],
  bank: {
    accountName: 'Apollo Hospital Pvt Ltd',
    bank: 'HDFC Bank',
    account: '50200048112233',
    ifsc: 'HDFC0001234',
    upi: 'apollohospital@hdfcbank',
  },
  rules: {
    duration: '15 mins',
    onlineBooking: true,
    horizon: '30 days',
    maxPerSlot: '15 slots',
    buffer: '15 mins',
    allowCancel: true,
    cancelBefore: '2 hours',
    autoNoShow: '1 hour',
    tokenGen: 'Auto',
    tokenScheme: CANONICAL_TOKEN_SCHEME,
    showToken: true,
    allowHold: true,
    holdTimeout: '30 mins',
    grace: '30 mins',
    afterGrace: 'Auto Mark No-show',
    opFee: '500',
    feeValidity: '10',
    applyAllDepts: true,
  },
  notify: {
    confirm: true,
    reminder: true,
    settleReceived: true,
    settleOverdue: true,
    quotaLow: true,
  },
};
