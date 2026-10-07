import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { cn } from '@/shared/lib/cn';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';
import { Toggle } from '@/shared/ui/Toggle';

import { useAddChecklistItemsMutation } from '@/features/ops-hospitals/application/queries/useAddChecklistItemsMutation';
import { useDocumentRequirementsQuery } from '@/features/ops-hospitals/application/queries/useDocumentRequirementsQuery';

interface RequestDocumentsModalProps {
  open: boolean;
  caseId: string;
  hospitalName: string;
  /** Codes already on the case's checklist — shown ticked and locked. */
  existingCodes: readonly string[];
  onClose: () => void;
}

/**
 * Add documents from the platform catalogue to one case's checklist (audit
 * SA-01: "requests documents"). The API only ever adds to a checklist — an
 * item already on it keeps its status and evidence, and cannot be removed
 * from here — so those rows are shown ticked and locked.
 */
export function RequestDocumentsModal({
  open,
  caseId,
  hospitalName,
  existingCodes,
  onClose,
}: RequestDocumentsModalProps) {
  const requirements = useDocumentRequirementsQuery();
  const addItems = useAddChecklistItemsMutation();
  const [picked, setPicked] = useState<readonly string[]>([]);

  const toggle = (code: string, on: boolean): void => {
    setPicked((prev) => (on ? [...prev, code] : prev.filter((c) => c !== code)));
  };

  const submit = (): void => {
    if (picked.length === 0) return;
    addItems.mutate(
      { caseId, codes: picked },
      {
        onSuccess: () => {
          toast(
            `Added ${picked.length} document${picked.length === 1 ? '' : 's'} to ${hospitalName}'s checklist.`,
            'success',
          );
          onClose();
        },
        onError: (error) =>
          toast(
            `Not every document was added — ${isFailure(error) ? error.message : 'please try again.'}`,
            'error',
            error,
          ),
      },
    );
  };

  const catalogue = requirements.data ?? [];

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`Update ${hospitalName}'s checklist`}
      width={620}
      onSubmit={submit}
      submitLabel="Add to Checklist"
      busy={addItems.isPending}
      disabled={picked.length === 0}
      footerLeft={
        <span className="text-caption text-text-muted mr-auto">
          {picked.length} new document{picked.length === 1 ? '' : 's'} selected
        </span>
      }
    >
      <div className="flex flex-col gap-4.5">
        {requirements.isPending ? (
          <SkeletonCards count={1} lines={5} />
        ) : requirements.isLoadingError ? (
          <ErrorState
            error={requirements.error}
            inline
            title="The document catalogue did not load"
            message={
              isFailure(requirements.error) && requirements.error.kind === 'forbidden'
                ? 'Your role cannot read the document catalogue (it needs the platform settings view permission).'
                : 'Retry to load the catalogue of documents.'
            }
            onRetry={() => void requirements.refetch()}
          />
        ) : catalogue.length === 0 ? (
          <div className="text-body text-text-muted py-4 text-center">
            The document catalogue is empty — add requirements in Platform Settings first.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {catalogue.map((req) => {
              const existing = existingCodes.includes(req.code);
              const on = existing || picked.includes(req.code);
              return (
                <div
                  key={req.code}
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
                    <div className="text-body text-text-strong font-medium">{req.name}</div>
                    <div className="text-caption text-text-muted">
                      {existing
                        ? 'Already on the checklist'
                        : (req.description ?? (req.isRequiredDefault ? 'Default requirement' : ''))}
                    </div>
                  </div>
                  <Toggle
                    value={on}
                    onChange={(v) => toggle(req.code, v)}
                    label={`Add ${req.name}`}
                    disabled={existing}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="text-caption text-text-muted bg-y-100 flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="triangle-alert" size={14} className="mt-px flex-none" /> Documents are
          collected from the hospital in person; added items start as pending. Nothing is emailed to
          the hospital from here.
        </div>
      </div>
    </FormModal>
  );
}
