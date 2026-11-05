import { describe, expect, it } from 'vitest';

import { HOSPITAL_CANCEL_REFUND_SENTENCE } from '@/shared/lib/refundCopy';

const STALE = [
  /convenience fee is not refunded/i,
  /refunds the doctor['’]s booking fee/i,
  /patient is refunded the doctor['’]s booking fee/i,
];

// User-facing files that word a hospital-side cancellation (UAT part 2 issue 7).
const FILES = [
  '/src/features/appointments/presentation/components/appointments.view.ts',
  '/src/features/appointments/presentation/components/AppointmentDrawer.tsx',
  '/src/features/payments/presentation/components/payments.view.ts',
  '/src/features/payments/presentation/screens/PaymentsScreen.tsx',
  '/src/features/settings/presentation/components/SettingsBookingSection.tsx',
  '/src/features/doctors/presentation/components/scheduleConfirm.ts',
];

const sources = import.meta.glob<string>(
  [
    '/src/features/appointments/presentation/components/{appointments.view.ts,AppointmentDrawer.tsx}',
    '/src/features/payments/presentation/components/payments.view.ts',
    '/src/features/payments/presentation/screens/PaymentsScreen.tsx',
    '/src/features/settings/presentation/components/SettingsBookingSection.tsx',
    '/src/features/doctors/presentation/components/scheduleConfirm.ts',
  ],
  { eager: true, query: '?raw', import: 'default' },
);

describe('hospital-cancel refund copy', () => {
  it('says the convenience fee is refunded', () => {
    expect(HOSPITAL_CANCEL_REFUND_SENTENCE).toMatch(/including the convenience fee/);
  });

  it.each(FILES)(
    '%s never says the convenience fee is kept or only the doctor’s fee is refunded',
    (file) => {
      const text = sources[file];
      expect(text, `${file} was not loaded`).toBeTypeOf('string');
      for (const pattern of STALE) expect(text ?? '', String(pattern)).not.toMatch(pattern);
    },
  );
});
