import { useState } from 'react';

import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { OTHER_REASON } from '@/features/ops-hospitals/presentation/components/onboarding.status';

interface RejectDocumentModalProps {
  open: boolean;
  title: string;
  /** Preset reasons; the last one should be `OTHER_REASON`-style free text. */
  reasons: readonly string[];
  submitLabel: string;
  /** One line under the form saying what happens on submit. */
  info: string;
  notePlaceholder: string;
  onClose: () => void;
  /** Receives the full reason. Resolves `true` on success (the modal closes). */
  onSubmit: (reason: string) => Promise<boolean>;
}

/**
 * Collect the reason for a negative onboarding decision — sending one
 * checklist document back, or rejecting the whole application (audit SA-01
 * asks for a reason on every rejection). The reason is required because the
 * hospital is told it: a "no" with no explanation is not actionable.
 */
export function RejectDocumentModal({
  open,
  title,
  reasons,
  submitLabel,
  info,
  notePlaceholder,
  onClose,
  onSubmit,
}: RejectDocumentModalProps) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const needsNote = reason === OTHER_REASON;
  const reasonError = submitted && !reason ? 'Pick a reason.' : undefined;
  const noteError =
    submitted && needsNote && note.trim() === '' ? 'Describe what is wrong.' : undefined;

  const submit = async (): Promise<void> => {
    setSubmitted(true);
    if (!reason || (needsNote && note.trim() === '')) return;
    const full = needsNote ? note.trim() : note.trim() ? `${reason} — ${note.trim()}` : reason;
    setBusy(true);
    const done = await onSubmit(full);
    setBusy(false);
    if (done) onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      width={500}
      onSubmit={() => void submit()}
      submitLabel={submitLabel}
      submitVariant="danger"
      busy={busy}
    >
      <div className="flex flex-col gap-4.5">
        <OpsField label="Reason" required error={reasonError}>
          <Select
            value={reason}
            placeholder="Select a reason"
            options={reasons}
            onChange={(v) => {
              setReason(v);
              setSubmitted(false);
            }}
            height={48}
          />
        </OpsField>
        <OpsField
          label={needsNote ? 'What is wrong' : 'Note (optional)'}
          required={needsNote}
          error={noteError}
          hint="Kept with the decision so the hospital and the next reviewer see it."
        >
          <TextInput value={note} onChange={setNote} placeholder={notePlaceholder} height={48} />
        </OpsField>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" /> {info}
        </div>
      </div>
    </FormModal>
  );
}
