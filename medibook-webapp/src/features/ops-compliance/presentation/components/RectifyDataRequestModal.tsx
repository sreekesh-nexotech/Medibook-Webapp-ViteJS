import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { TextArea } from '@/shared/ui/TextArea';

/** Backend limit on action notes (`DataSubjectRequestActionRequest`). */
const NOTES_MAX_CHARS = 2000;

interface RectifyForm {
  notes: string;
}

const VALIDATORS: FormValidators<RectifyForm> = {
  notes: (v) =>
    required(v, 'What was corrected') ??
    (v.trim().length > NOTES_MAX_CHARS
      ? `Keep the notes under ${NOTES_MAX_CHARS.toLocaleString('en-IN')} characters.`
      : undefined),
};

interface RectifyDataRequestModalProps {
  requestNo: string;
  busy: boolean;
  onClose: () => void;
  onRectify: (notes: string) => void;
}

/**
 * Complete a rectification request (`POST …/{id}/process {notes}`, 12·R13):
 * the record is corrected where it lives (patient master, staff profile), and
 * this closes the request with notes saying what changed.
 */
export function RectifyDataRequestModal({
  requestNo,
  busy,
  onClose,
  onRectify,
}: RectifyDataRequestModalProps) {
  const form = useForm<RectifyForm>({
    initial: { notes: '' },
    validate: VALIDATORS,
    onSubmit: (v) => onRectify(v.notes.trim()),
  });

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Mark ${requestNo} rectified`}
      width={560}
      onSubmit={form.handleSubmit}
      submitLabel="Mark rectified"
      busy={busy}
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-text-muted m-0">
          Correct the record first — this only closes the request. The notes stay on the request for
          audit.
        </p>
        <OpsField label="What was corrected" required error={form.errorFor('notes')}>
          <TextArea
            value={form.values.notes}
            onChange={(v) => form.setField('notes', v)}
            onBlur={() => form.blurField('notes')}
            maxLength={NOTES_MAX_CHARS}
            placeholder="e.g. Date of birth corrected from 1988-02-03 to 1988-03-02 on the patient master"
          />
        </OpsField>
      </div>
    </FormModal>
  );
}
