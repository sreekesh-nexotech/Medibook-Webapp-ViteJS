import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { TextArea } from '@/shared/ui/TextArea';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSaveDocumentRequirementMutation } from '@/features/ops-onboarding-documents/application/queries/useSaveDocumentRequirementMutation';
import type {
  DocumentRequirement,
  DocumentRequirementDraft,
} from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';
import {
  hasRequirementErrors,
  nextSortOrder,
  parseSortOrder,
  requirementErrors,
  type RequirementErrors,
} from '@/features/ops-onboarding-documents/presentation/components/onboardingDocuments.rules';

interface DocumentRequirementModalProps {
  /** The requirement being edited, or `null` to add one. */
  requirement: DocumentRequirement | null;
  /** The whole catalogue, for the code check and the next order. */
  existing: readonly DocumentRequirement[];
  onClose: () => void;
}

/**
 * Add or edit an onboarding document (`POST` / `PATCH
 * /platform/onboarding/document-requirements` + `If-Match`). The code is
 * fixed once created — checklists refer to it. Mount only while open.
 */
export function DocumentRequirementModal({
  requirement,
  existing,
  onClose,
}: DocumentRequirementModalProps) {
  const save = useSaveDocumentRequirementMutation();
  const [code, setCode] = useState(requirement?.code ?? '');
  const [name, setName] = useState(requirement?.name ?? '');
  const [description, setDescription] = useState(requirement?.description ?? '');
  const [required, setRequired] = useState(requirement?.isRequiredDefault ?? true);
  const [order, setOrder] = useState(String(requirement?.sortOrder ?? nextSortOrder(existing)));
  const [err, setErr] = useState<RequirementErrors>({});
  const editing = requirement !== null;

  const submit = (): void => {
    const sortOrder = parseSortOrder(order);
    const draft: DocumentRequirementDraft = {
      code,
      name,
      description,
      isRequiredDefault: required,
      sortOrder: sortOrder ?? Number.NaN,
    };
    const e = requirementErrors(draft, existing, requirement?.id ?? null);
    setErr(e);
    if (hasRequirementErrors(e)) return;
    save.mutate(
      { id: requirement?.id ?? null, draft, version: requirement?.version ?? 0 },
      {
        onSuccess: () => {
          toast(editing ? 'Document saved.' : 'Document added to the catalogue.', 'success');
          onClose();
        },
        onError: (failure) => {
          if (isFailure(failure)) {
            const fe = failure.fieldErrors;
            setErr({
              code: fe.code?.[0] ?? fe.non_field_errors?.[0],
              name: fe.name?.[0],
              description: fe.description?.[0],
              sortOrder: fe.sortOrder?.[0],
            });
          }
          toast(isFailure(failure) ? failure.message : 'Could not save the document.', 'error');
        },
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={editing ? 'Edit onboarding document' : 'Add onboarding document'}
      width={620}
      onSubmit={submit}
      submitLabel={editing ? 'Save document' : 'Add document'}
      busy={save.isPending}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
          <OpsField
            label="Code"
            required
            error={err.code}
            hint={
              editing
                ? 'Fixed once created.'
                : 'Checklists refer to it. It can never be changed or reused.'
            }
          >
            <TextInput
              value={code}
              onChange={setCode}
              readOnly={editing}
              placeholder="e.g. fire_noc"
              height={48}
            />
          </OpsField>
          <OpsField label="Order" error={err.sortOrder} hint="Lower shows first.">
            <TextInput value={order} onChange={setOrder} inputMode="numeric" height={48} />
          </OpsField>
        </div>
        <OpsField label="Name" required error={err.name}>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="e.g. Fire safety NOC"
            height={48}
          />
        </OpsField>
        <OpsField
          label="Description"
          error={err.description}
          hint="What to collect, e.g. which authority issues it or whether a copy is enough."
        >
          <TextArea value={description} onChange={setDescription} rows={3} />
        </OpsField>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Toggle value={required} onChange={setRequired} label="Required by default" />
            <span className="text-body text-text-strong">Required by default</span>
          </div>
          <span className="text-caption text-text-muted">
            {required
              ? 'Added to the checklist of every hospital onboarded from now on. Checklists of hospitals already onboarding do not change.'
              : 'Not added to new checklists; the onboarding team can still tick it for a hospital that hands it in.'}
          </span>
        </div>
      </div>
    </FormModal>
  );
}
