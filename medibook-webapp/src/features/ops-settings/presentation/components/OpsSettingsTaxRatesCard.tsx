import { useState } from 'react';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { CanOps } from '@/shared/ui/CanOps';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { IconBtn } from '@/shared/ui/IconBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useDeleteOpsTaxRateMutation } from '@/features/ops-settings/application/queries/useDeleteOpsTaxRateMutation';
import { useOpsTaxRatesQuery } from '@/features/ops-settings/application/queries/useOpsTaxRatesQuery';
import type { TaxRate } from '@/features/ops-settings/domain/entities/opsSettings.entity';
import {
  APPLIES_TO_LABEL,
  formatRateBp,
} from '@/features/ops-settings/presentation/components/opsSettingsFormat';
import { OpsSettingsTaxRateModal } from '@/features/ops-settings/presentation/components/OpsSettingsTaxRateModal';

const COLUMNS = ['Code', 'Name', 'Rate', 'Applies To', 'Pricing', 'Status', 'Actions'] as const;
const RIGHT_COLS = ['Rate', 'Actions'] as const;

/** Row action button edge, matching the other ops tables. */
const ACTION_BOX = 40;

/** Which modal is open: none, add, or edit one rate. */
type ModalState = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; rate: TaxRate };

/**
 * Platform default tax rates (`/platform/tax-rates`) — the rates hospitals
 * inherit for consultations, services and the convenience fee.
 */
export function OpsSettingsTaxRatesCard() {
  const rates = useOpsTaxRatesQuery();
  const remove = useDeleteOpsTaxRateMutation();
  const canAdd = useOpsPermission().can('settings.add');
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' });
  const [toDelete, setToDelete] = useState<TaxRate | null>(null);

  const handleDelete = () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    remove.mutate(
      { id: target.id, version: target.version },
      {
        onSuccess: () => toast(`${target.code} deleted.`, 'success'),
        onError: (failure) =>
          toast(isFailure(failure) ? failure.message : 'Could not delete that rate.', 'error'),
      },
    );
  };

  let state: TableStateSpec | undefined;
  if (rates.isPending) {
    state = { kind: 'loading', rows: 3 };
  } else if (rates.isError) {
    state = {
      kind: 'error',
      title: 'Could not load tax rates',
      message: isFailure(rates.error) ? rates.error.message : undefined,
      onRetry: () => void rates.refetch(),
    };
  } else if (rates.data.items.length === 0) {
    state = {
      kind: 'empty',
      icon: 'percent',
      title: 'No tax rates yet',
      message: 'Add the platform default rates hospitals inherit.',
      ...(canAdd ? { actionLabel: 'Add Tax Rate', onAction: () => setModal({ kind: 'add' }) } : {}),
    };
  }

  const items = rates.data?.items ?? [];
  const total = rates.data?.total ?? 0;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Tax Rates</SectionTitle>
        <CanOps perm="settings.add">
          <Button size="sm" icon="plus" onClick={() => setModal({ kind: 'add' })}>
            Add Tax Rate
          </Button>
        </CanOps>
      </div>
      <TableShell columns={COLUMNS} rightCols={RIGHT_COLS} state={state} scrollLabel="Tax rates">
        {items.map((rate) => (
          <tr key={rate.id}>
            <td className={tdClass}>
              <span className="text-text-strong font-medium">{rate.code}</span>
            </td>
            <td className={tdClass}>{rate.name}</td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>{formatRateBp(rate.rateBp)}</td>
            <td className={tdClass}>{APPLIES_TO_LABEL[rate.appliesTo]}</td>
            <td className={tdClass}>{rate.isInclusive ? 'Inclusive' : 'Exclusive'}</td>
            <td className={tdClass}>
              <Badge status={rate.isActive ? 'Active' : 'Inactive'} />
            </td>
            <td className={cn(tdClass, 'text-right')}>
              <div className="inline-flex gap-1">
                <CanOps perm="settings.edit">
                  <IconBtn
                    name="pencil"
                    label={`Edit ${rate.code}`}
                    box={ACTION_BOX}
                    onClick={() => setModal({ kind: 'edit', rate })}
                  />
                </CanOps>
                <CanOps perm="settings.del">
                  <IconBtn
                    name="trash-2"
                    label={`Delete ${rate.code}`}
                    box={ACTION_BOX}
                    onClick={() => setToDelete(rate)}
                  />
                </CanOps>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      {total > items.length && (
        <p className="text-caption text-text-faint mt-3">
          Showing {items.length} of {total} rates.
        </p>
      )}

      {modal.kind !== 'closed' && (
        <OpsSettingsTaxRateModal
          rate={modal.kind === 'edit' ? modal.rate : null}
          onClose={() => setModal({ kind: 'closed' })}
        />
      )}

      <ConfirmModal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.code ?? 'this rate'}?`}
        body="The rate is removed from the platform defaults."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
      />
    </Card>
  );
}
