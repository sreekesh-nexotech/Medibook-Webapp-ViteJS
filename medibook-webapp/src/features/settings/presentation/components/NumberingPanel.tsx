import { useState } from 'react';

import { describeFailure } from '@/shared/lib/serverErrors';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import type { NumberingSeries } from '@/features/settings/domain/entities/settings.entities';
import { useNumberingQuery } from '@/features/settings/application/queries/useNumberingQuery';

import { NUMBERING_KIND_LABEL, resetLabel } from './numbering.labels';
import { NumberingModal } from './NumberingModal';
import { SettingsHead } from './SettingsHead';

/** The series a hospital edits, in display order; others it returns are listed after. */
const KIND_ORDER = ['mrn', 'booking', 'receipt'];

/** Why a series cannot be edited from here, or `null` when it can. */
function lockReason(series: NumberingSeries, mayEdit: boolean): string | null {
  if (!mayEdit) return 'Your role can view numbering but not change it.';
  if (series.editableBy !== 'hospital_admin') {
    return 'Set by Medibook for this hospital — contact support to change it (O-02).';
  }
  if (series.locked) {
    return 'Locked: patients already have numbers from this series, and an MRN format never changes after the first one (Q34).';
  }
  return null;
}

interface NumberingPanelProps {
  mayEdit: boolean;
}

/**
 * Settings › Numbering — the MRN, booking-reference and receipt series
 * (`GET /hospital/numbering`, D-25/D-26). Shows each format, the next number
 * the server would issue, and whether the hospital may still change it.
 */
export function NumberingPanel({ mayEdit }: NumberingPanelProps) {
  const numbering = useNumberingQuery();
  const [editing, setEditing] = useState<NumberingSeries | null>(null);
  const rows = [...(numbering.data ?? [])].sort(
    (a, b) =>
      (KIND_ORDER.indexOf(a.kind) + 1 || KIND_ORDER.length + 1) -
      (KIND_ORDER.indexOf(b.kind) + 1 || KIND_ORDER.length + 1),
  );

  return (
    <Card pad={28}>
      <SettingsHead info="Numbers patients and staff see on records, booking confirmations and receipts. Receipts are gapless (D-25): a cancelled payment never uses up a number.">
        Numbering
      </SettingsHead>
      {numbering.isPending ? (
        <SkeletonCards count={3} lines={2} />
      ) : numbering.isError ? (
        <ErrorState
          inline
          title="Numbering did not load"
          message={describeFailure(numbering.error, 'Please try again.')}
          onRetry={() => void numbering.refetch()}
        />
      ) : rows.length === 0 ? (
        <p className="text-body text-text-muted">
          No numbering series are set up for this hospital.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((s) => {
            const reason = lockReason(s, mayEdit);
            return (
              <div
                key={s.kind}
                className="border-border-soft flex flex-wrap items-center gap-4 rounded-md border px-4 py-3.5"
              >
                <div className="min-w-60 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body text-text-strong font-medium">
                      {NUMBERING_KIND_LABEL[s.kind] ?? s.kind}
                    </span>
                    {s.locked && <Badge status="Inactive">Locked</Badge>}
                    {s.gapless && <Badge status="Scheduled">Gapless</Badge>}
                  </div>
                  <div className="text-caption text-text-muted mt-0.5">
                    <span className="font-mono">{s.format}</span>
                    {s.prefix ? ` · prefix ${s.prefix}` : ''} · resets: {resetLabel(s.reset)}
                  </div>
                  {reason && (
                    <div className="text-caption text-text-muted mt-0.5 flex items-center gap-1">
                      <Icon name="lock" size={12} /> {reason}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-caption text-text-muted">Next number</span>
                  <span className="text-body text-text-strong font-semibold tabular-nums">
                    {s.nextPreview}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="pencil"
                  disabled={reason !== null}
                  onClick={() => setEditing(s)}
                >
                  Edit
                </Button>
              </div>
            );
          })}
          <p className="text-caption text-text-muted">
            {rows[0]?.warning ??
              'Changing a format never rewrites numbers already issued; it applies to new numbers only.'}
          </p>
        </div>
      )}
      {editing && (
        <NumberingModal key={editing.kind} series={editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}
