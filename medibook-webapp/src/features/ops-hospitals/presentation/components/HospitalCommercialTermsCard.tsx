import { useState } from 'react';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import type {
  CommissionRate,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { useCommissionHistoryQuery } from '@/features/ops-hospitals/application/queries/useCommissionHistoryQuery';
import { HospitalCommissionModal } from '@/features/ops-hospitals/presentation/components/HospitalCommissionModal';
import { HospitalConvenienceFeeModal } from '@/features/ops-hospitals/presentation/components/HospitalConvenienceFeeModal';
import {
  bpCopy,
  convenienceFeeCopy,
} from '@/features/ops-hospitals/presentation/components/hospitals.view';

/** Commission-history status → [badge status, label]. */
const RATE_STATUS: Readonly<Record<string, readonly [string, string]>> = {
  scheduled: ['Queued', 'Scheduled'],
  current: ['Active', 'In force'],
  past: ['Inactive', 'Past'],
};

/** Shown in the history list at most; older rates stay in the audit log. */
const HISTORY_ROWS = 6;

function RateRow({ rate }: { rate: CommissionRate }) {
  const [badge, label] = RATE_STATUS[rate.status] ?? ['Inactive', rate.status];
  return (
    <li className="border-border-soft flex flex-wrap items-center gap-3 border-b py-2.5 last:border-b-0">
      <span className="text-body text-text-strong w-16 font-semibold tabular-nums">
        {bpCopy(rate.commissionBp)}
      </span>
      <span className="text-caption text-text-muted min-w-40 flex-1">
        from {fmtDate(rate.effectiveFrom)}
        {rate.setByName ? ` · set by ${rate.setByName}` : ''}
        {rate.note ? ` · ${rate.note}` : ''}
      </span>
      <Badge status={badge}>{label}</Badge>
    </li>
  );
}

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
  // A closed hospital, or a role without hospitals.edit (SEC-05), cannot change these.
  const canEdit = useOpsPermission().can('hospitals.edit');
  const locked = h.status === 'closed' || !canEdit;
  // API-01: scheduled (future-dated) and past rates, so a change "from tomorrow"
  // is visible before it applies.
  const history = useCommissionHistoryQuery(h.id);
  const scheduled = history.data?.rates.find((r) => r.status === 'scheduled') ?? null;

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
          sub={
            scheduled
              ? `Changes to ${bpCopy(scheduled.commissionBp)} from ${fmtDate(scheduled.effectiveFrom)}.`
              : 'Of the consultation fee, deducted at settlement.'
          }
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
      {history.data && history.data.rates.length > 0 && (
        <div className="mt-4">
          <div className="text-caption text-text-muted mb-1 font-medium">Commission history</div>
          <ul className="m-0 list-none p-0">
            {history.data.rates.slice(0, HISTORY_ROWS).map((rate) => (
              <RateRow key={rate.id} rate={rate} />
            ))}
          </ul>
        </div>
      )}
      {history.isError && (
        <div className="text-caption text-text-muted mt-3">
          The commission history could not be loaded.
        </div>
      )}
      {modal === 'commission' && <HospitalCommissionModal h={h} onClose={() => setModal(null)} />}
      {modal === 'fee' && <HospitalConvenienceFeeModal h={h} onClose={() => setModal(null)} />}
    </Card>
  );
}
