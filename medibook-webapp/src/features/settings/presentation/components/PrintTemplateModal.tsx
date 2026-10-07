import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  PrintTemplate,
  PrintTemplateKind,
  ReceiptPaper,
} from '@/features/settings/domain/entities/settings.entities';
import { useSavePrintTemplateMutation } from '@/features/settings/application/queries/usePrintTemplateMutations';
import { RECEIPT_PAPER_OPTIONS } from '@/features/settings/application/store/settings.form';

import { TEMPLATE_KIND_LABEL, TEMPLATE_PLACEHOLDERS } from './printTemplates.labels';

const KINDS: readonly PrintTemplateKind[] = ['receipt', 'token_slip'];
const NAME_MAX = 120;

interface TemplateForm {
  kind: PrintTemplateKind;
  name: string;
  paper: ReceiptPaper;
  templateHtml: string;
  isDefault: boolean;
}

const VALIDATORS: FormValidators<TemplateForm> = {
  name: (v) => required(v, 'Template name'),
  templateHtml: (v) => required(v, 'Template'),
};

const SERVER_FIELDS = {
  kind: 'kind',
  name: 'name',
  paper: 'paper',
  template_html: 'templateHtml',
  is_default: 'isDefault',
} as const;

function kindOf(label: string): PrintTemplateKind {
  return KINDS.find((k) => TEMPLATE_KIND_LABEL[k] === label) ?? 'receipt';
}

function paperOf(label: string): ReceiptPaper {
  return RECEIPT_PAPER_OPTIONS.find((p) => p === label) ?? 'A5';
}

interface PrintTemplateModalProps {
  template: PrintTemplate | null;
  onClose: () => void;
}

/** Add or edit a receipt / token-slip template (Q22). The kind is fixed after create. */
export function PrintTemplateModal({ template, onClose }: PrintTemplateModalProps) {
  const save = useSavePrintTemplateMutation();
  const form = useForm<TemplateForm>({
    initial: {
      kind: template?.kind ?? 'receipt',
      name: template?.name ?? '',
      paper: template?.paper ?? 'A5',
      templateHtml: template?.templateHtml ?? '',
      isDefault: template?.isDefault ?? false,
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      try {
        await save.mutateAsync({
          existing: template ? { id: template.id, version: template.version } : undefined,
          input: { ...v, name: v.name.trim() },
        });
        toast(template ? 'Template saved' : 'Template added', 'success');
        onClose();
      } catch (error) {
        toast(
          form.applyServerErrors(
            error,
            { fields: SERVER_FIELDS },
            'The template could not be saved.',
          ),
          'error',
        );
      }
    },
  });
  const v = form.values;
  return (
    <FormModal
      open
      onClose={onClose}
      title={template ? 'Edit Print Template' : 'Add Print Template'}
      width={760}
      onSubmit={form.handleSubmit}
      submitLabel={template ? 'Save Template' : 'Add Template'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <FormErrorSummary messages={form.serverSummary} />
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Prints"
            error={form.errorFor('kind')}
            hint={template ? 'Fixed once created.' : undefined}
          >
            <Select
              value={TEMPLATE_KIND_LABEL[v.kind]}
              options={KINDS.map((k) => TEMPLATE_KIND_LABEL[k])}
              onChange={(x) => form.setField('kind', kindOf(x))}
              disabled={template !== null}
            />
          </Field>
          <Field label="Name" required error={form.errorFor('name')}>
            <TextInput
              value={v.name}
              onChange={(x) => form.setField('name', x)}
              onBlur={() => form.blurField('name')}
              maxLength={NAME_MAX}
            />
          </Field>
          <Field label="Paper" error={form.errorFor('paper')}>
            <Select
              value={v.paper}
              options={RECEIPT_PAPER_OPTIONS}
              onChange={(x) => form.setField('paper', paperOf(x))}
            />
          </Field>
        </div>
        <Field
          label="Template (HTML)"
          required
          error={form.errorFor('templateHtml')}
          hint={`Placeholders: ${TEMPLATE_PLACEHOLDERS[v.kind]}`}
        >
          {(field) => (
            <textarea
              id={field.id}
              value={v.templateHtml}
              onChange={(e) => form.setField('templateHtml', e.target.value)}
              onBlur={() => form.blurField('templateHtml')}
              spellCheck={false}
              aria-invalid={field.invalid || undefined}
              aria-describedby={field.describedById}
              className="border-border text-body text-text-strong rounded-input box-border h-64 w-full resize-y border p-3 font-mono"
            />
          )}
        </Field>
        <div className="border-border-soft flex items-center justify-between rounded-md border px-3.5 py-3">
          <span className="text-body text-text-body" id="template-default-label">
            Default for {TEMPLATE_KIND_LABEL[v.kind].toLowerCase()}
            <span className="text-caption text-text-muted block">
              Making this the default replaces the current default of its kind.
            </span>
          </span>
          <Toggle
            value={v.isDefault}
            onChange={(x) => form.setField('isDefault', x)}
            aria-labelledby="template-default-label"
          />
        </div>
      </div>
    </FormModal>
  );
}
