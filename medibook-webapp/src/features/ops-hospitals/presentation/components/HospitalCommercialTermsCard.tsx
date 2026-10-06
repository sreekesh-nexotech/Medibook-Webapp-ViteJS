import { useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import type { PlatformHospitalDetail } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { HospitalCommissionModal } from '@/features/ops-hospitals/presentation/components/HospitalCommissionModal';
import { HospitalConvenienceFeeModal } from '@/features/ops-hospitals/presentation/components/HospitalConvenienceFeeModal';
import {
  bpCopy,
  convenienceFeeCopy,
} from '@/features/ops-hospitals/presentation/components/hospitals.view';

interface TermProps {
  icon: IconName;
  label: string;
  value: string;
  sub: string;
  actionLabel: string;
  disabled: boolean;
  onAction: () => void;
}

function Term({ icon, label, value, sub, actionLabel, disabled, onAction }: TermProps) {
  return (
    <div className="border-border flex items-start gap-3.5 rounded-md border p-4">
      <div className="bg-blue-soft-bg text-text-navy flex size-10 flex-none items-center justify-center rounded-md">
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-caption text-text-muted">{label}</div>
        <div className="text-body text-text-strong font-semibold tabular-nums">{value}</div>
        <div className="text-caption text-text-muted mt-0.5">{sub}</div>
      </div>
      <Button size="sm" variant="secondary" icon="pencil" disabled={disabled} onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

interface HospitalCommercialTermsCardProps {
  h: PlatformHospitalDetail;
}

/**
 * What Medibook charges on the hospital's online bookings: the platform
 * commission (`set-commission`) and the patient convenience fee
 * (`set-convenience-fee`). Both were fixed at onboarding and had no control
 * afterwards; settlements and statements read them from here.
 */
export function HospitalCommercialTermsCard({ h }: HospitalCommercialTermsCardProps) {
  const [modal, setModal] = useState<'commission' | 'fee' | null>(null);
  const locked = h.status === 'closed';

  return (
    <Card>
      <SectionTitle className="mb-1">Commercial Terms</SectionTitle>
      <div className="text-caption text-text-muted mb-4">
        What Medibook charges on this hospital&rsquo;s online bookings. Walk-ins paid at the desk
        carry neither.
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Term
          icon="percent"
          label="Platform commission"
          value={bpCopy(h.commissionBp)}
          sub="Of the consultation fee, deducted at settlement."
          actionLabel="Change"
          disabled={locked}
          onAction={() => setModal('commission')}
        />
        <Term
          icon="indian-rupee"
          label="Patient convenience fee"
          value={convenienceFeeCopy(h.convenienceFeeKind, h.convenienceFeeValue)}
          sub="Added to what the patient pays."
          actionLabel="Change"
          disabled={locked}
          onAction={() => setModal('fee')}
        />
      </div>
      {modal === 'commission' && <HospitalCommissionModal h={h} onClose={() => setModal(null)} />}
      {modal === 'fee' && <HospitalConvenienceFeeModal h={h} onClose={() => setModal(null)} />}
    </Card>
  );
}
