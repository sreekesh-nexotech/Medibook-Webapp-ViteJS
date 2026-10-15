import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';

/** Backend limit on a rejection reason (`DataSubjectRequestActionRequest`). */
const REASON_MAX_CHARS = 2000;

interface RejectForm {
  reason: string;
}

const VALIDATORS: FormValidators<RejectForm> = {
  reason: (v) =>
    required(v, 'A reason') ??
    (v.trim().length > REASON_MAX_CHARS
      ? `Keep the reason under ${REASON_MAX_CHARS.toLocaleString('en-IN')} characters.`
      : undefined),
};

interface RejectDataRequestModalProps {
  requestNo: string;
  busy: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
}

/** Reject an open data-subject request — the reason is kept on the record. */
export function RejectDataRequestModal({
  requestNo,
  busy,
  onClose,
  onReject,
}: RejectDataRequestModalProps) {
  const form = useForm<RejectForm>({
    initial: { reason: '' },
    validate: VALIDATORS,
    onSubmit: (v) => onReject(v.reason.trim()),
  });

  return (
    <FormModal
      dirty={form.isDirty}
      open
      onClose={onClose}
      title={`Reject ${requestNo}?`}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Reject request"
      submitVariant="danger"
      busy={busy}
    >
      <OpsField label="Reason" required error={form.errorFor('reason')}>
        <TextInput
          value={form.values.reason}
          onChange={(v) => form.setField('reason', v)}
          onBlur={() => form.blurField('reason')}
          placeholder="e.g. Identity could not be verified"
          height={48}
        />
      </OpsField>
    </FormModal>
  );
}
