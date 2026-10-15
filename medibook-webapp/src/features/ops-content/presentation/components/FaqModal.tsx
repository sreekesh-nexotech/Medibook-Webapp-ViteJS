import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextArea } from '@/shared/ui/TextArea';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSaveFaqMutation } from '@/features/ops-content/application/queries/useSaveFaqMutation';
import type { FaqDraft, FaqEntry } from '@/features/ops-content/domain/entities/content.entities';
import {
  FAQ_AUDIENCE_LABEL,
  FAQ_AUDIENCES,
  faqErrors,
  hasDraftErrors,
  parseOptionalInt,
  type DraftErrors,
} from '@/features/ops-content/presentation/components/content.rules';

interface FaqModalProps {
  faq: FaqEntry | null;
  /** The backend has FAQ audiences (B9); without it every FAQ is for the patient app. */
  hasAudience: boolean;
  /** Categories already in use, offered as suggestions. */
  categories: readonly string[];
  onClose: () => void;
}

/** Add or edit an FAQ (`POST /platform/faqs`, `PATCH …/{id}` + `If-Match`). Mount only while open. */
export function FaqModal({ faq, hasAudience, categories, onClose }: FaqModalProps) {
  const save = useSaveFaqMutation();
  const [category, setCategory] = useState(faq?.category ?? categories[0] ?? '');
  const [question, setQuestion] = useState(faq?.question ?? '');
  const [answerMd, setAnswerMd] = useState(faq?.answerMd ?? '');
  const [order, setOrder] = useState(String(faq?.sortOrder ?? 0));
  const [isPublished, setIsPublished] = useState(faq?.isPublished ?? true);
  const [audience, setAudience] = useState(faq?.audience ?? 'patient');
  const [err, setErr] = useState<DraftErrors<FaqDraft>>({});

  const submit = (): void => {
    const sortOrder = parseOptionalInt(order);
    const draft: FaqDraft = {
      category: category.trim(),
      question: question.trim(),
      answerMd,
      sortOrder: sortOrder ?? 0,
      isPublished,
      audience: hasAudience ? audience : null,
    };
    const e = faqErrors(draft);
    if (sortOrder === undefined) e.sortOrder = 'Order is a whole number.';
    setErr(e);
    if (hasDraftErrors(e)) return;
    save.mutate(
      { id: faq?.id ?? null, draft, version: faq?.rowVersion ?? 0 },
      {
        onSuccess: () => {
          toast(faq ? 'FAQ updated.' : 'FAQ added.', 'success');
          onClose();
        },
        onError: (failure) => {
          if (isFailure(failure)) {
            const fe = failure.fieldErrors;
            setErr({
              category: fe.category?.[0],
              question: fe.question?.[0],
              answerMd: fe.answerMd?.[0],
            });
          }
          toast(isFailure(failure) ? failure.message : 'Could not save the FAQ.', 'error');
        },
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={faq ? 'Edit FAQ' : 'Add FAQ'}
      width={680}
      onSubmit={submit}
      submitLabel={faq ? 'Save FAQ' : 'Add FAQ'}
      busy={save.isPending}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
          <OpsField
            label="Category"
            required
            error={err.category}
            hint={categories.length > 0 ? `In use: ${categories.join(', ')}` : undefined}
          >
            <TextInput
              value={category}
              onChange={setCategory}
              placeholder="e.g. Bookings"
              height={48}
            />
          </OpsField>
          <OpsField
            label="Order"
            error={err.sortOrder}
            hint="Lower shows first within the category."
          >
            <TextInput value={order} onChange={setOrder} inputMode="numeric" height={48} />
          </OpsField>
        </div>
        <OpsField label="Question" required error={err.question}>
          <TextInput value={question} onChange={setQuestion} height={48} />
        </OpsField>
        <OpsField label="Answer (Markdown)" required error={err.answerMd}>
          <TextArea value={answerMd} onChange={setAnswerMd} rows={6} />
        </OpsField>
        {hasAudience && (
          <OpsField label="Shown in">
            <Select
              value={FAQ_AUDIENCE_LABEL[audience]}
              options={FAQ_AUDIENCES.map((a) => FAQ_AUDIENCE_LABEL[a])}
              onChange={(v) =>
                setAudience(FAQ_AUDIENCES.find((a) => FAQ_AUDIENCE_LABEL[a] === v) ?? audience)
              }
              height={48}
            />
          </OpsField>
        )}
        <div className="flex items-center gap-3">
          <Toggle value={isPublished} onChange={setIsPublished} label="Published" />
          <span className="text-body text-text-strong">
            {isPublished ? 'Published — visible now' : 'Hidden — saved but not shown'}
          </span>
        </div>
      </div>
    </FormModal>
  );
}
