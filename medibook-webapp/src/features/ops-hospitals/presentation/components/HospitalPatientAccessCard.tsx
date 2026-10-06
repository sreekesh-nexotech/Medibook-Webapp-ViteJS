import { useId, useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import type { PlatformHospitalDetail } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { useSetHospitalVisibilityMutation } from '@/features/ops-hospitals/application/queries/useSetHospitalVisibilityMutation';
import { useUpdatePlatformHospitalMutation } from '@/features/ops-hospitals/application/queries/useUpdatePlatformHospitalMutation';
import { bookabilityGaps } from '@/features/ops-hospitals/presentation/components/hospitals.view';

/** The switch the operator is about to flip. */
type AccessChange = 'list' | 'unlist' | 'booking-on' | 'booking-off';

const FAILED = 'That did not go through. Please try again.';

interface ConfirmCopy {
  readonly icon: IconName;
  readonly tone: 'success' | 'danger';
  readonly title: string;
  readonly body: string;
  readonly label: string;
  readonly done: string;
}

function confirmCopy(change: AccessChange, h: PlatformHospitalDetail): ConfirmCopy {
  const whenLive = h.status === 'active' ? '' : ' once it is live';
  switch (change) {
    case 'list':
      return {
        icon: 'eye',
        tone: 'success',
        title: 'List this hospital in the patient app?',
        body: `Patients can find ${h.name}, its doctors and timings in the Medibook app${whenLive}.${
          h.onlineBookingEnabled ? '' : ' Online booking is still off, so they cannot book yet.'
        }`,
        label: 'List in App',
        done: `${h.name} is listed in the patient app.`,
      };
    case 'unlist':
      return {
        icon: 'eye-off',
        tone: 'danger',
        title: 'Hide this hospital from the patient app?',
        body: `Patients can no longer find or book ${h.name} in the app. Existing bookings are kept and the front desk keeps working.`,
        label: 'Hide from App',
        done: `${h.name} is hidden from the patient app.`,
      };
    case 'booking-on':
      return {
        icon: 'calendar-check',
        tone: 'success',
        title: 'Turn on online booking?',
        body: `Patients can book and pay for appointments at ${h.name} in the app${
          h.appVisibility === 'visible' ? whenLive : ' once it is listed there'
        }.`,
        label: 'Turn On',
        done: `Online booking is on for ${h.name}.`,
      };
    case 'booking-off':
      return {
        icon: 'calendar-x',
        tone: 'danger',
        title: 'Turn off online booking?',
        body: `Patients can no longer book ${h.name} in the app. Existing bookings are kept, and walk-ins at the desk are not affected.`,
        label: 'Turn Off',
        done: `Online booking is off for ${h.name}.`,
      };
  }
}

interface AccessRowProps {
  icon: IconName;
  title: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}

function AccessRow({ icon, title, description, value, disabled, onChange }: AccessRowProps) {
  const labelId = useId();
  return (
    <div className="border-border flex items-center gap-3.5 border-t py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="bg-blue-soft-bg text-text-navy flex size-10 flex-none items-center justify-center rounded-md">
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div id={labelId} className="text-body text-text-strong font-medium">
          {title}
        </div>
        <div className="text-caption text-text-muted">{description}</div>
      </div>
      <Toggle value={value} onChange={onChange} aria-labelledby={labelId} disabled={disabled} />
    </div>
  );
}

interface HospitalPatientAccessCardProps {
  h: PlatformHospitalDetail;
}

/**
 * Whether patients can find and book the hospital (Q67). Go-live changes only
 * the lifecycle status; listing in the app (`set-visibility`) and online
 * booking (`PATCH online_booking_enabled`) are separate switches, and the
 * backend takes an online booking only when the hospital is active, listed
 * and has booking on. Each change is confirmed — it is what patients see.
 */
export function HospitalPatientAccessCard({ h }: HospitalPatientAccessCardProps) {
  const visibility = useSetHospitalVisibilityMutation();
  const update = useUpdatePlatformHospitalMutation();
  const [change, setChange] = useState<AccessChange | null>(null);

  const busy = visibility.isPending || update.isPending;
  const locked = h.status === 'closed';
  const gaps = bookabilityGaps(h);
  const copy = change ? confirmCopy(change, h) : null;

  const settle = (done: string) => ({
    onSuccess: () => {
      toast(done, 'success');
      setChange(null);
    },
    onError: (error: unknown) => {
      toast(isFailure(error) ? error.message : FAILED, 'error');
      setChange(null);
    },
  });

  const confirm = (): void => {
    if (!change || !copy) return;
    if (change === 'list' || change === 'unlist') {
      visibility.mutate(
        { id: h.id, visibility: change === 'list' ? 'visible' : 'hidden' },
        settle(copy.done),
      );
      return;
    }
    update.mutate(
      { id: h.id, changes: { onlineBookingEnabled: change === 'booking-on' }, version: h.version },
      settle(copy.done),
    );
  };

  return (
    <Card>
      <SectionTitle className="mb-1">Patient App &amp; Booking</SectionTitle>
      <div
        className={cn(
          'text-caption mt-2 mb-4 flex items-start gap-2 rounded-sm px-3 py-2.5',
          gaps.length === 0 ? 'bg-g-100 text-g-700' : 'bg-y-100 text-y-800',
        )}
      >
        <Icon
          name={gaps.length === 0 ? 'circle-check' : 'circle-alert'}
          size={14}
          className="mt-px flex-none"
        />
        <span>
          {gaps.length === 0
            ? `Patients can find and book ${h.name} in the app.`
            : `Patients cannot book ${h.name} online: ${gaps.join(' ')}`}
        </span>
      </div>
      <AccessRow
        icon="smartphone"
        title="Listed in the patient app"
        description="Patients can find the hospital, its doctors and their timings."
        value={h.appVisibility === 'visible'}
        disabled={busy || locked}
        onChange={(on) => setChange(on ? 'list' : 'unlist')}
      />
      <AccessRow
        icon="calendar-check"
        title="Online booking"
        description="Patients can book and pay for appointments in the app. Walk-ins are not affected."
        value={h.onlineBookingEnabled}
        disabled={busy || locked}
        onChange={(on) => setChange(on ? 'booking-on' : 'booking-off')}
      />
      {copy && (
        <OpsConfirm
          open
          onClose={() => setChange(null)}
          icon={copy.icon}
          tone={copy.tone}
          title={copy.title}
          body={copy.body}
          confirmLabel={busy ? 'Saving…' : copy.label}
          confirmVariant={copy.tone === 'danger' ? 'danger' : 'primary'}
          busy={busy}
          onConfirm={confirm}
        />
      )}
    </Card>
  );
}
