import { useState } from 'react';

import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { ONBOARDING_DOC_LABEL } from '@/features/ops-hospitals/application/store/onboarding.fixtures';
import { useOnboardingStore } from '@/features/ops-hospitals/application/store/onboarding.store';
import type { OnboardingDocKey } from '@/features/ops-hospitals/application/store/onboarding.types';

/** The reasons a reviewer actually rejects a KYC document. */
const REJECT_REASONS: readonly string[] = [
  'Document is illegible or partially cut off',
  'Details do not match the registered entity',
  'Document has expired',
  'Wrong document type uploaded',
  'Other — see the note',
];

/** The reason that requires the free-text note to be filled in. */
const OTHER_REASON = 'Other — see the note';

interface RejectDocumentModalProps {
  open: boolean;
  hid: number;
  hospitalName: string;
  docKey: OnboardingDocKey;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Reject one KYC document with the reason the hospital will be told (audit
 * SA-01 asks for individual Approve and Reject actions with a rejection
 * reason). The reason is required because the document goes back to the
 * hospital with it — a rejection with no explanation is not actionable.
 */
export function RejectDocumentModal({
  open,
  hid,
  hospitalName,
  docKey,
  onClose,
  onDone,
}: RejectDocumentModalProps) {
  const rejectDoc = useOnboardingStore((s) => s.rejectDoc);
  const [busy, run] = useOpsAct();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const label = ONBOARDING_DOC_LABEL[docKey];
  const needsNote = reason === OTHER_REASON;
  const reasonError = submitted && !reason ? 'Pick a reason for the rejection.' : undefined;
  const noteError =
    submitted && needsNote && note.trim() === ''
      ? 'Describe what is wrong with the document.'
      : undefined;

  const submit = (): void => {
    setSubmitted(true);
    if (!reason || (needsNote && note.trim() === '')) return;
    const full = needsNote ? note.trim() : note.trim() ? `${reason} — ${note.trim()}` : reason;
    run('rejectdoc', `${label} rejected for ${hospitalName}.`, () => {
      rejectDoc(hid, docKey, full);
      onDone?.();
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`Reject ${label}?`}
      width={500}
      onSubmit={submit}
      submitLabel="Reject Document"
      submitVariant="danger"
      busy={busy.rejectdoc}
    >
      <div className="flex flex-col gap-4.5">
        <OpsField label="Reason" required error={reasonError}>
          <Select
            value={reason}
            placeholder="Select a reason"
            options={REJECT_REASONS}
            onChange={(v) => {
              setReason(v);
              setSubmitted(false);
            }}
            height={48}
          />
        </OpsField>
        <OpsField
          label={needsNote ? 'What is wrong with it' : 'Note (optional)'}
          required={needsNote}
          error={noteError}
          hint="Shown to the hospital alongside the rejected document."
        >
          <TextInput
            value={note}
            onChange={setNote}
            placeholder="e.g. The GST certificate is registered to a different entity"
            height={48}
          />
        </OpsField>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" /> Only this document is rejected.
          The rest of the checklist keeps its own status, and {hospitalName} can re-upload just this
          one.
        </div>
      </div>
    </FormModal>
  );
}
