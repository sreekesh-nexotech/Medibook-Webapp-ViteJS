import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { mapServerErrors } from '@/shared/lib/serverErrors';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { Spinner } from '@/shared/ui/Spinner';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  NumberingKind,
  NumberingSeries,
} from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import { useHospitalNumberingQuery } from '@/features/ops-hospitals/application/queries/useHospitalNumberingQuery';
import { useUpdateHospitalNumberingMutation } from '@/features/ops-hospitals/application/queries/useUpdateHospitalNumberingMutation';
import {
  keyOfLabel,
  knownKey,
  labelOf,
  NUMBERING_EDITABLE_LABEL,
  NUMBERING_KIND_LABEL,
  NUMBERING_KINDS,
  NUMBERING_RESET_LABEL,
  numberingFormatProblem,
} from '@/features/ops-hospitals/presentation/components/hospitalSettings.view';

type FormField = 'format' | 'prefix' | 'reset' | 'editableBy';

interface NumberingEditModalProps {
  hospitalId: string;
  kind: NumberingKind;
  series: NumberingSeries;
  onClose: () => void;
}

/** Edit one series. Issued numbers are never rewritten (D-26); MRN locks after its first issue. */
function NumberingEditModal({ hospitalId, kind, series, onClose }: NumberingEditModalProps) {
  const update = useUpdateHospitalNumberingMutation();
  const [format, setFormat] = useState(series.format);
  const [prefix, setPrefix] = useState(series.prefix ?? '');
  const [reset, setReset] = useState(series.reset);
  const [editableBy, setEditableBy] = useState(series.editableBy);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [summary, setSummary] = useState<readonly string[]>([]);

  const submit = () => {
    const problem = numberingFormatProblem(format);
    if (problem) {
      setErrors({ format: problem });
      return;
    }
    setErrors({});
    setSummary([]);
    update.mutate(
      {
        hospitalId,
        kind,
        version: series.version,
        change: {
          ...(format.trim() !== series.format && { format: format.trim() }),
          ...(prefix.trim() !== (series.prefix ?? '') && { prefix: prefix.trim() || null }),
          ...(reset !== series.reset && { reset: knownKey(NUMBERING_RESET_LABEL, reset) }),
          ...(editableBy !== series.editableBy && {
            editableBy: knownKey(NUMBERING_EDITABLE_LABEL, editableBy),
          }),
        },
      },
      {
        onSuccess: () => {
          toast(`${NUMBERING_KIND_LABEL[kind]} format saved.`, 'success');
          onClose();
        },
        onError: (failure) => {
          if (!isFailure(failure)) return;
          if (failure.code === 'NUMBERING_LOCKED') {
            setSummary([
              'The MR number format is locked: numbers have already been issued with it.',
            ]);
            return;
          }
          const mapped = mapServerErrors<FormField>(failure, {
            fields: {
              format: 'format',
              prefix: 'prefix',
              reset: 'reset',
              editable_by: 'editableBy',
            },
          });
          setErrors(mapped.fields);
          setSummary(mapped.fieldCount === 0 ? [mapped.headline] : mapped.summary);
        },
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={`${NUMBERING_KIND_LABEL[kind]} format`}
      width={560}
      onSubmit={submit}
      submitLabel="Save format"
      busy={update.isPending}
    >
      <div className="bg-y-100 text-y-800 text-caption mb-4 flex items-start gap-2 rounded-md px-3 py-2.5">
        <Icon name="triangle-alert" size={15} className="mt-0.5 flex-none" />
        <span>{series.warning || 'Numbers already issued are never rewritten.'}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <OpsField
          label="Format"
          required
          error={errors.format}
          hint="Tokens: {PREFIX} {SEQ:n} {FY} {YY} {YYYY} {MM}"
        >
          <TextInput value={format} onChange={setFormat} maxLength={64} />
        </OpsField>
        <OpsField label="Prefix" error={errors.prefix}>
          <TextInput value={prefix} onChange={setPrefix} maxLength={20} />
        </OpsField>
        <OpsField label="Sequence restarts" error={errors.reset}>
          <Select
            value={labelOf(NUMBERING_RESET_LABEL, reset)}
            options={Object.values(NUMBERING_RESET_LABEL)}
            onChange={(label) => setReset(keyOfLabel(NUMBERING_RESET_LABEL, label) ?? reset)}
          />
        </OpsField>
        <OpsField label="Who may edit it later" error={errors.editableBy}>
          <Select
            value={labelOf(NUMBERING_EDITABLE_LABEL, editableBy)}
            options={Object.values(NUMBERING_EDITABLE_LABEL)}
            onChange={(label) =>
              setEditableBy(keyOfLabel(NUMBERING_EDITABLE_LABEL, label) ?? editableBy)
            }
          />
        </OpsField>
      </div>
      {summary.length > 0 && (
        <div role="alert" className="text-caption text-danger bg-d-100 mt-4 rounded-md px-3 py-2.5">
          {summary.join(' ')}
        </div>
      )}
    </FormModal>
  );
}

interface NumberingRowProps {
  hospitalId: string;
  kind: NumberingKind;
  onEdit: (series: NumberingSeries) => void;
}

function NumberingRow({ hospitalId, kind, onEdit }: NumberingRowProps) {
  const query = useHospitalNumberingQuery(hospitalId, kind);
  return (
    <div className="border-border-soft flex flex-wrap items-center gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-40 flex-1">
        <div className="text-body text-text-strong font-medium">{NUMBERING_KIND_LABEL[kind]}</div>
        {query.data && (
          <div className="text-caption text-text-muted">
            <span className="tabular-nums">{query.data.format}</span>
            {query.data.prefix ? ` · prefix ${query.data.prefix}` : ''} · restarts{' '}
            {labelOf(NUMBERING_RESET_LABEL, query.data.reset).toLowerCase()} · next{' '}
            <span className="text-text-strong tabular-nums">{query.data.nextPreview}</span>
          </div>
        )}
        {query.isError && (
          <div className="text-caption text-danger">
            {isFailure(query.error) ? query.error.message : 'Could not load this series.'}
          </div>
        )}
      </div>
      {query.isPending && <Spinner size={18} label={`Loading ${NUMBERING_KIND_LABEL[kind]}`} />}
      {query.data?.locked && <Badge status="Inactive">Locked</Badge>}
      {query.data && (
        <Button
          size="sm"
          variant="secondary"
          icon="pencil"
          disabled={query.data.locked}
          onClick={() => query.data && onEdit(query.data)}
        >
          Edit
        </Button>
      )}
      {query.isError && (
        <Button
          size="sm"
          variant="secondary"
          icon="refresh-cw"
          onClick={() => void query.refetch()}
        >
          Retry
        </Button>
      )}
    </div>
  );
}

interface HospitalNumberingCardProps {
  hospitalId: string;
}

/**
 * The hospital's MRN, booking-reference and receipt formats with an ops
 * override (`GET/PUT /platform/hospitals/{id}/numbering/{kind}`, D-26, O-02).
 * Rendered only for `hospitals.edit` holders — the endpoint needs it even to
 * read.
 */
export function HospitalNumberingCard({ hospitalId }: HospitalNumberingCardProps) {
  const [editing, setEditing] = useState<{ kind: NumberingKind; series: NumberingSeries } | null>(
    null,
  );
  return (
    <Card>
      <SectionTitle>Numbering formats</SectionTitle>
      <div className="text-caption text-text-muted mt-1 mb-2">
        Changing a format affects numbers issued from now on; numbers already on receipts and
        records are never rewritten.
      </div>
      {NUMBERING_KINDS.map((kind) => (
        <NumberingRow
          key={kind}
          hospitalId={hospitalId}
          kind={kind}
          onEdit={(series) => setEditing({ kind, series })}
        />
      ))}
      {editing && (
        <NumberingEditModal
          hospitalId={hospitalId}
          kind={editing.kind}
          series={editing.series}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
