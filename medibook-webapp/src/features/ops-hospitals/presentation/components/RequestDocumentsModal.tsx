import { useState } from 'react';

import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { cn } from '@/shared/lib/cn';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import {
  ONBOARDING_DOC_CATALOG,
  DEFAULT_DOC_KEYS,
} from '@/features/ops-hospitals/application/store/onboarding.fixtures';
import { useOnboardingStore } from '@/features/ops-hospitals/application/store/onboarding.store';
import type {
  OnboardingCase,
  OnboardingDocKey,
} from '@/features/ops-hospitals/application/store/onboarding.types';

interface RequestDocumentsModalProps {
  open: boolean;
  hospitalName: string;
  /** The case being edited — its current checklist is preselected. */
  onboarding: OnboardingCase;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Choose which documents this hospital must provide and record the request
 * (audit SA-01: "requests documents ... cannot be uploaded or approved one by
 * one"). The checklist is the platform's catalog, preselected with whatever is
 * already required for this case, so re-requesting never silently changes the
 * gate.
 *
 * A document already on file keeps its upload and its review decision — the
 * store only ever adds to the checklist, it does not discard evidence.
 */
export function RequestDocumentsModal({
  open,
  hospitalName,
  onboarding,
  onClose,
  onDone,
}: RequestDocumentsModalProps) {
  const requestDocuments = useOnboardingStore((s) => s.requestDocuments);
  const [busy, run] = useOpsAct();

  const alreadyRequired = onboarding.docs.filter((d) => d.required).map((d) => d.key);
  const [keys, setKeys] = useState<readonly OnboardingDocKey[]>(
    alreadyRequired.length > 0 ? alreadyRequired : DEFAULT_DOC_KEYS,
  );
  const [note, setNote] = useState('');

  const toggle = (key: OnboardingDocKey, on: boolean): void => {
    setKeys((prev) => (on ? [...prev, key] : prev.filter((k) => k !== key)));
  };

  const submit = (): void => {
    if (keys.length === 0) return;
    run(
      'reqdocs',
      `Requested ${keys.length} document${keys.length === 1 ? '' : 's'} from ${hospitalName}.`,
      () => {
        requestDocuments(onboarding.hid, keys, note.trim() || undefined);
        onDone?.();
      },
    );
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`Request documents from ${hospitalName}`}
      width={620}
      onSubmit={submit}
      submitLabel="Record Request"
      busy={busy.reqdocs}
      disabled={keys.length === 0}
      footerLeft={
        <span className="text-caption text-text-muted mr-auto">
          {keys.length} document{keys.length === 1 ? '' : 's'} selected
        </span>
      }
    >
      <div className="flex flex-col gap-4.5">
        <div className="flex flex-col gap-2.5">
          {ONBOARDING_DOC_CATALOG.map((spec) => {
            const on = keys.includes(spec.key);
            const existing = onboarding.docs.find((d) => d.key === spec.key);
            return (
              <div
                key={spec.key}
                className={cn(
                  'flex items-center gap-3 rounded-md border px-3.5 py-3',
                  on ? 'border-blue bg-blue-soft-bg' : 'border-border-soft',
                )}
              >
                <div
                  className={cn(
                    'flex size-9 flex-none items-center justify-center rounded-md',
                    on ? 'text-text-navy bg-white' : 'bg-grey-300 text-text-muted',
                  )}
                >
                  <Icon name="file-text" size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-body text-text-strong font-medium">{spec.label}</div>
                  <div className="text-caption text-text-muted">
                    {spec.hint}
                    {existing && existing.status !== 'Requested'
                      ? ` · already ${existing.status.toLowerCase()}`
                      : ''}
                  </div>
                </div>
                <Toggle
                  value={on}
                  onChange={(v) => toggle(spec.key, v)}
                  label={`Require ${spec.label}`}
                />
              </div>
            );
          })}
        </div>
        <OpsField
          label="Note to the hospital (optional)"
          hint="Recorded with the request so the next reviewer sees what was asked for."
        >
          <TextInput
            value={note}
            onChange={setNote}
            placeholder="e.g. GST certificate must match the billing entity name"
            height={48}
          />
        </OpsField>
        <div className="text-caption text-text-muted bg-y-100 flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="triangle-alert" size={14} className="mt-px flex-none" /> The request is
          recorded against this application with your name and the time. Nothing is emailed to the
          hospital from here yet.
        </div>
      </div>
    </FormModal>
  );
}
