import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { TextArea } from '@/shared/ui/TextArea';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSaveLegalDraftMutation } from '@/features/ops-content/application/queries/useSaveLegalDraftMutation';
import type {
  LegalDocument,
  LegalSlug,
} from '@/features/ops-content/domain/entities/content.entities';
import { LEGAL_SLUG_LABEL } from '@/features/ops-content/presentation/components/content.rules';

const TITLE_MAX = 500;
const BODY_ROWS = 18;

interface LegalDraftModalProps {
  slug: LegalSlug;
  /** The draft being edited, or `null` to start version n+1. */
  draft: LegalDocument | null;
  /** Text a new draft starts from (the current version), so edits are small. */
  startFrom: LegalDocument | null;
  onClose: () => void;
}

/**
 * Write a legal-document draft (`POST /platform/legal-documents` for a new
 * version, `PATCH …/{id}` while it is unpublished). Publishing is separate,
 * so a draft can be reviewed before patients see it. Mount only while open.
 */
export function LegalDraftModal({ slug, draft, startFrom, onClose }: LegalDraftModalProps) {
  const save = useSaveLegalDraftMutation();
  const [title, setTitle] = useState(draft?.title ?? startFrom?.title ?? LEGAL_SLUG_LABEL[slug]);
  const [bodyMd, setBodyMd] = useState(draft?.bodyMd ?? startFrom?.bodyMd ?? '');
  const [err, setErr] = useState<{ title?: string | null; bodyMd?: string | null }>({});

  const submit = (): void => {
    const e = {
      title: title.trim() === '' ? 'Give the document a title.' : null,
      bodyMd: bodyMd.trim() === '' ? 'Write the document text.' : null,
    };
    setErr(e);
    if (e.title || e.bodyMd) return;
    const changes = { title: title.trim(), bodyMd };
    save.mutate(
      draft
        ? { kind: 'update', id: draft.id, changes }
        : { kind: 'create', draft: { slug, ...changes } },
      {
        onSuccess: (saved) => {
          toast(`Draft v${saved.version} saved — publish it when it is ready.`, 'success');
          onClose();
        },
        onError: (failure) => {
          if (isFailure(failure)) {
            setErr({
              title: failure.fieldErrors.title?.[0] ?? null,
              bodyMd: failure.fieldErrors.bodyMd?.[0] ?? null,
            });
          }
          toast(isFailure(failure) ? failure.message : 'Could not save the draft.', 'error');
        },
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={
        draft
          ? `${LEGAL_SLUG_LABEL[slug]} — edit draft v${draft.version}`
          : `${LEGAL_SLUG_LABEL[slug]} — new draft`
      }
      width={820}
      onSubmit={submit}
      submitLabel="Save Draft"
      busy={save.isPending}
    >
      <div className="flex flex-col gap-4">
        <OpsField label="Title" required error={err.title}>
          <TextInput value={title} onChange={setTitle} maxLength={TITLE_MAX} height={48} />
        </OpsField>
        <OpsField
          label="Text (Markdown)"
          required
          error={err.bodyMd}
          hint="Headings with #, lists with -, bold with **. The patient app renders it as written."
        >
          <TextArea value={bodyMd} onChange={setBodyMd} rows={BODY_ROWS} mono />
        </OpsField>
        <p className="text-caption text-text-muted m-0">
          Saving keeps this as a draft. Patients keep seeing the current version until you publish;
          a published version can never be edited, because consents record it.
        </p>
      </div>
    </FormModal>
  );
}
