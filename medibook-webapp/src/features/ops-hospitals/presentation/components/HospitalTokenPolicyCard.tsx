import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { mapServerErrors } from '@/shared/lib/serverErrors';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FormModal } from '@/shared/ui/FormModal';
import { InfoGrid } from '@/shared/ui/InfoGrid';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { Spinner } from '@/shared/ui/Spinner';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import type { TokenPolicy } from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import { useHospitalTokenPolicyQuery } from '@/features/ops-hospitals/application/queries/useHospitalTokenPolicyQuery';
import { useUpdateHospitalTokenPolicyMutation } from '@/features/ops-hospitals/application/queries/useUpdateHospitalTokenPolicyMutation';
import {
  keyOfLabel,
  knownKey,
  labelOf,
  TOKEN_RESET_LABEL,
  TOKEN_SCOPE_LABEL,
  tokenFormatProblem,
} from '@/features/ops-hospitals/presentation/components/hospitalSettings.view';

type FormField =
  'scope' | 'reset' | 'format' | 'prefix' | 'onlineMarker' | 'offlineMarker' | 'ranges';

/** "" → null, "12" → 12; anything else is a problem the form reports. */
function parseRangeBound(text: string): number | null | 'invalid' {
  const raw = text.trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 'invalid';
}

function boundText(n: number | null): string {
  return n === null ? '' : String(n);
}

interface TokenPolicyEditModalProps {
  hospitalId: string;
  policy: TokenPolicy;
  onClose: () => void;
}

/** Edit the policy. Scope and reset apply from tomorrow (hospital-local); the rest at once. */
function TokenPolicyEditModal({ hospitalId, policy, onClose }: TokenPolicyEditModalProps) {
  const update = useUpdateHospitalTokenPolicyMutation();
  const [scope, setScope] = useState(policy.scope);
  const [reset, setReset] = useState(policy.reset);
  const [format, setFormat] = useState(policy.format);
  const [prefix, setPrefix] = useState(policy.prefix);
  const [onlineMarker, setOnlineMarker] = useState(policy.onlineMarker);
  const [offlineMarker, setOfflineMarker] = useState(policy.offlineMarker);
  const [reuseCancelled, setReuseCancelled] = useState(policy.reuseCancelled);
  const [separateRanges, setSeparateRanges] = useState(policy.separateRanges);
  const [onlineStart, setOnlineStart] = useState(boundText(policy.onlineRangeStart));
  const [onlineEnd, setOnlineEnd] = useState(boundText(policy.onlineRangeEnd));
  const [offlineStart, setOfflineStart] = useState(boundText(policy.offlineRangeStart));
  const [offlineEnd, setOfflineEnd] = useState(boundText(policy.offlineRangeEnd));
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [summary, setSummary] = useState<readonly string[]>([]);

  const submit = () => {
    const formatProblem = tokenFormatProblem(format);
    const bounds = [onlineStart, onlineEnd, offlineStart, offlineEnd].map(parseRangeBound);
    const local: Partial<Record<FormField, string>> = {
      ...(formatProblem && { format: formatProblem }),
      ...(!onlineMarker.trim() && { onlineMarker: 'Enter a marker.' }),
      ...(!offlineMarker.trim() && { offlineMarker: 'Enter a marker.' }),
      ...(separateRanges &&
        bounds.includes('invalid') && { ranges: 'Range bounds are whole numbers from 1.' }),
    };
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }
    const [os, oe, fs, fe] = bounds.map((b) => (b === 'invalid' ? null : b));
    setErrors({});
    setSummary([]);
    update.mutate(
      {
        hospitalId,
        version: policy.version,
        change: {
          ...(scope !== policy.scope && { scope: knownKey(TOKEN_SCOPE_LABEL, scope) }),
          ...(reset !== policy.reset && { reset: knownKey(TOKEN_RESET_LABEL, reset) }),
          ...(format.trim() !== policy.format && { format: format.trim() }),
          ...(prefix.trim() !== policy.prefix && { prefix: prefix.trim() }),
          ...(onlineMarker.trim() !== policy.onlineMarker && { onlineMarker: onlineMarker.trim() }),
          ...(offlineMarker.trim() !== policy.offlineMarker && {
            offlineMarker: offlineMarker.trim(),
          }),
          ...(reuseCancelled !== policy.reuseCancelled && { reuseCancelled }),
          ...(separateRanges !== policy.separateRanges && { separateRanges }),
          ...(separateRanges && {
            onlineRangeStart: os,
            onlineRangeEnd: oe,
            offlineRangeStart: fs,
            offlineRangeEnd: fe,
          }),
        },
      },
      {
        onSuccess: () => {
          toast('Token policy saved.', 'success');
          onClose();
        },
        onError: (failure) => {
          if (!isFailure(failure)) return;
          const mapped = mapServerErrors<FormField>(failure, {
            fields: {
              scope: 'scope',
              reset: 'reset',
              format: 'format',
              prefix: 'prefix',
              online_marker: 'onlineMarker',
              offline_marker: 'offlineMarker',
              online_range_start: 'ranges',
              online_range_end: 'ranges',
              offline_range_start: 'ranges',
              offline_range_end: 'ranges',
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
      title="Token policy"
      width={640}
      onSubmit={submit}
      submitLabel="Save policy"
      busy={update.isPending}
    >
      <p className="text-caption text-text-muted mt-0 mb-4">
        Scope and reset take effect tomorrow in the hospital&apos;s time zone, so today&apos;s
        queues keep their numbers. Everything else applies to the next token issued.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <OpsField label="Sequence scope" error={errors.scope}>
          <Select
            value={labelOf(TOKEN_SCOPE_LABEL, scope)}
            options={Object.values(TOKEN_SCOPE_LABEL)}
            onChange={(label) => setScope(keyOfLabel(TOKEN_SCOPE_LABEL, label) ?? scope)}
          />
        </OpsField>
        <OpsField label="Sequence restarts" error={errors.reset}>
          <Select
            value={labelOf(TOKEN_RESET_LABEL, reset)}
            options={Object.values(TOKEN_RESET_LABEL)}
            onChange={(label) => setReset(keyOfLabel(TOKEN_RESET_LABEL, label) ?? reset)}
          />
        </OpsField>
        <OpsField
          label="Label format"
          required
          error={errors.format}
          hint="Tokens: {PREFIX} {SRC} {SEQ:n} {DOC} {DEPT} {DATE:DDMM}"
        >
          <TextInput value={format} onChange={setFormat} maxLength={64} />
        </OpsField>
        <OpsField label="Prefix" error={errors.prefix}>
          <TextInput value={prefix} onChange={setPrefix} maxLength={10} />
        </OpsField>
        <OpsField label="Online marker ({SRC})" required error={errors.onlineMarker}>
          <TextInput value={onlineMarker} onChange={setOnlineMarker} maxLength={8} />
        </OpsField>
        <OpsField label="Desk marker ({SRC})" required error={errors.offlineMarker}>
          <TextInput value={offlineMarker} onChange={setOfflineMarker} maxLength={8} />
        </OpsField>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-body text-text-strong">
            Reuse a cancelled token number before it is called
          </span>
          <Toggle
            value={reuseCancelled}
            onChange={setReuseCancelled}
            label="Reuse cancelled token numbers"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-body text-text-strong">
            Separate number ranges for online and desk tokens
          </span>
          <Toggle
            value={separateRanges}
            onChange={setSeparateRanges}
            label="Separate online and desk ranges"
          />
        </div>
        {separateRanges && (
          <OpsField label="Ranges (from – to)" error={errors.ranges}>
            <div className="grid gap-3 sm:grid-cols-4">
              <TextInput
                value={onlineStart}
                onChange={setOnlineStart}
                inputMode="numeric"
                aria-label="Online from"
                placeholder="Online from"
              />
              <TextInput
                value={onlineEnd}
                onChange={setOnlineEnd}
                inputMode="numeric"
                aria-label="Online to"
                placeholder="Online to"
              />
              <TextInput
                value={offlineStart}
                onChange={setOfflineStart}
                inputMode="numeric"
                aria-label="Desk from"
                placeholder="Desk from"
              />
              <TextInput
                value={offlineEnd}
                onChange={setOfflineEnd}
                inputMode="numeric"
                aria-label="Desk to"
                placeholder="Desk to"
              />
            </div>
          </OpsField>
        )}
      </div>
      {summary.length > 0 && (
        <div role="alert" className="text-caption text-danger bg-d-100 mt-4 rounded-md px-3 py-2.5">
          {summary.join(' ')}
        </div>
      )}
    </FormModal>
  );
}

interface HospitalTokenPolicyCardProps {
  hospitalId: string;
}

/**
 * The hospital's token policy with an ops override (`GET/PUT
 * /platform/hospitals/{id}/token-policy`, D-15, O-01 default `doctor`).
 * Rendered only for `hospitals.edit` holders.
 */
export function HospitalTokenPolicyCard({ hospitalId }: HospitalTokenPolicyCardProps) {
  const query = useHospitalTokenPolicyQuery(hospitalId);
  const [isEditing, setIsEditing] = useState(false);
  const policy = query.data;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Token policy</SectionTitle>
        {policy && (
          <Button size="sm" variant="secondary" icon="pencil" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {query.isPending && (
        <div className="text-text-muted flex justify-center py-4">
          <Spinner size={20} label="Loading the token policy" />
        </div>
      )}
      {query.isError && (
        <ErrorState
          inline
          title="The token policy didn't load"
          message={isFailure(query.error) ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      )}
      {policy && (
        <>
          <InfoGrid
            items={[
              { k: 'Scope', v: labelOf(TOKEN_SCOPE_LABEL, policy.scope) },
              { k: 'Restarts', v: labelOf(TOKEN_RESET_LABEL, policy.reset) },
              { k: 'Label format', v: policy.format, num: true },
              {
                k: 'Online / desk marker',
                v: `${policy.onlineMarker} / ${policy.offlineMarker}`,
              },
              { k: 'Reuse cancelled numbers', v: policy.reuseCancelled ? 'Yes' : 'No' },
              {
                k: 'Separate ranges',
                v: policy.separateRanges
                  ? `Online ${policy.onlineRangeStart ?? '…'}–${policy.onlineRangeEnd ?? '…'}, desk ${policy.offlineRangeStart ?? '…'}–${policy.offlineRangeEnd ?? '…'}`
                  : 'No',
              },
            ]}
          />
          {policy.pending && (policy.pending.scope || policy.pending.reset) && (
            <div className="text-caption text-text-muted mt-3">
              From {policy.pending.effectiveDate ?? 'tomorrow'}:{' '}
              {policy.pending.scope
                ? `scope ${labelOf(TOKEN_SCOPE_LABEL, policy.pending.scope).toLowerCase()}`
                : ''}
              {policy.pending.scope && policy.pending.reset ? ', ' : ''}
              {policy.pending.reset
                ? `restarts ${labelOf(TOKEN_RESET_LABEL, policy.pending.reset).toLowerCase()}`
                : ''}
              .
            </div>
          )}
        </>
      )}
      {isEditing && policy && (
        <TokenPolicyEditModal
          hospitalId={hospitalId}
          policy={policy}
          onClose={() => setIsEditing(false)}
        />
      )}
    </Card>
  );
}
