import { type ChangeEvent, useRef, useState } from 'react';

import { acceptFor } from '@/core/api/files.rules';
import { isFailure } from '@/core/error/failure';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { dateRange, minLen, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  BannerInput,
  HospitalBanner,
} from '@/features/settings/domain/entities/profile.entities';
import { useUploadBannerImageMutation } from '@/features/settings/application/queries/useUploadBannerImageMutation';
import {
  BANNER_AUDIENCE_LABEL,
  BANNER_AUDIENCE_OPTIONS,
  audienceForLabel,
  bannerWindow,
  dayEndIso,
  dayStartIso,
} from '@/features/settings/application/store/profile.form';

/** Banner copy the patient app can render without clipping. */
const MAX_BODY_CHARS = 220;
const MIN_TITLE_CHARS = 6;

const DATE_INPUT_CLASS =
  'rounded-input border-border-control text-body text-text-body h-12 w-full border bg-white px-3';

interface BannerForm {
  title: string;
  body: string;
  imageFileId: string | null;
  from: string;
  to: string;
  audience: string;
}

const VALIDATORS: FormValidators<BannerForm> = {
  title: (v) => minLen(v, MIN_TITLE_CHARS, 'Banner title'),
  body: (v) => required(v, 'Banner message'),
  from: (v) => required(v, 'Live-from date'),
  to: (v, values) => dateRange(values.from, v),
};

interface PatientBannerModalProps {
  open: boolean;
  /** The banner being edited, or null to publish a new one. */
  banner: HospitalBanner | null;
  /** Displayable URL of the banner's current image, when it has one. */
  imageUrl: string | null;
  onClose: () => void;
  /** Save the banner. Resolves `true` on success (the modal closes). */
  onSave: (input: BannerInput) => Promise<boolean>;
}

/**
 * Author a banner the hospital publishes to the Medibook patient app (audit
 * HA-03). Same authoring pattern as the operations console's `BannerModal` —
 * title, creative upload with preview, live-from/until window — on the shared
 * `FormModal` so Enter submits and every error is an inline `Field` message.
 * The image uploads as soon as it is picked; the banner points at it on save.
 */
export function PatientBannerModal({
  open,
  banner,
  imageUrl,
  onClose,
  onSave,
}: PatientBannerModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadBannerImageMutation();
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const span = banner ? bannerWindow(banner) : { from: '', to: '' };

  const form = useForm<BannerForm>({
    initial: {
      title: banner?.title ?? '',
      body: banner?.body ?? '',
      imageFileId: banner?.imageFileId ?? null,
      from: span.from,
      to: span.to,
      audience: BANNER_AUDIENCE_LABEL[banner?.audience ?? 'hospital_patients'],
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      const done = await onSave({
        title: v.title.trim(),
        body: v.body.trim(),
        imageFileId: v.imageFileId,
        audience: audienceForLabel(v.audience),
        startsAt: dayStartIso(v.from),
        endsAt: v.to ? dayEndIso(v.to) : null,
      });
      if (done) onClose();
    },
  });

  const pickFile = (): void => fileRef.current?.click();

  const onFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      upload.mutate(file, {
        onSuccess: (fileId) => {
          form.setField('imageFileId', fileId);
          setPreview(dataUrl);
        },
        onError: (error) => {
          toast(
            isFailure(error) ? error.message : 'The image could not be uploaded.',
            'error',
            error,
          );
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (): void => {
    form.setField('imageFileId', null);
    setPreview(null);
  };

  return (
    <FormModal
      dirty={form.isDirty}
      open={open}
      onClose={onClose}
      title={banner ? 'Edit Banner' : 'Publish Banner'}
      width={620}
      onSubmit={form.handleSubmit}
      submitLabel={banner ? 'Save Banner' : 'Publish Banner'}
      busy={form.submitting || upload.isPending}
    >
      <div className="flex flex-col gap-4">
        <Field label="Banner Title" required error={form.errorFor('title')}>
          <TextInput
            value={form.values.title}
            onChange={(v) => form.setField('title', v)}
            onBlur={() => form.blurField('title')}
            placeholder="e.g. Free BP & sugar check this week"
            height={48}
            autoFocus
          />
        </Field>

        <Field
          label="Message"
          required
          error={form.errorFor('body')}
          hint={`${form.values.body.length}/${MAX_BODY_CHARS} characters shown in the app.`}
        >
          {({ id, describedById, invalid }) => (
            <textarea
              id={id}
              aria-describedby={describedById}
              aria-invalid={invalid || undefined}
              value={form.values.body}
              onChange={(e) => form.setField('body', e.target.value.slice(0, MAX_BODY_CHARS))}
              onBlur={() => form.blurField('body')}
              placeholder="What the patient should do, in one or two sentences."
              className="rounded-input border-border-control text-body text-text-strong box-border h-20 w-full resize-none border p-3"
            />
          )}
        </Field>

        <Field label="Banner Image">
          <input
            ref={fileRef}
            type="file"
            accept={acceptFor('banner')}
            onChange={onFile}
            className="hidden"
          />
          {form.values.imageFileId ? (
            <div className="flex flex-col gap-2">
              {preview ? (
                <img
                  src={preview}
                  alt="Banner preview"
                  className="border-border-soft h-37.5 w-full rounded-md border object-cover"
                />
              ) : (
                <div className="border-border-soft text-caption text-text-muted bg-bg-subtle flex h-37.5 w-full items-center justify-center rounded-md border">
                  Image attached — preview unavailable
                </div>
              )}
              <div className="flex gap-3.5">
                <button
                  type="button"
                  onClick={pickFile}
                  disabled={upload.isPending}
                  className="text-caption text-blue cursor-pointer"
                >
                  Replace image
                </button>
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={upload.isPending}
                  className="text-caption text-d-600 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={pickFile}
              disabled={upload.isPending}
              className="border-border text-text-muted bg-bg-subtle flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-md border-[1.5px] border-dashed px-3 py-5.5"
            >
              <Icon name="upload" size={20} />
              <span className="text-body">
                {upload.isPending ? 'Uploading…' : 'Click to upload an image'}
              </span>
              <span className="text-caption text-text-muted">
                PNG, JPG or WebP · 1200×600 (2:1) recommended · the title shows as overlay text if
                no image
              </span>
            </button>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Live From" required error={form.errorFor('from')}>
            <input
              type="date"
              value={form.values.from}
              onChange={(e) => form.setField('from', e.target.value)}
              onBlur={() => form.blurField('from')}
              aria-label="Live from"
              className={DATE_INPUT_CLASS}
            />
          </Field>
          <Field label="Live Until" required error={form.errorFor('to')}>
            <input
              type="date"
              value={form.values.to}
              onChange={(e) => form.setField('to', e.target.value)}
              onBlur={() => form.blurField('to')}
              aria-label="Live until"
              className={DATE_INPUT_CLASS}
            />
          </Field>
        </div>

        <Field
          label="Audience"
          hint="Patients of this hospital, or every patient browsing hospitals in your city."
        >
          <Select
            value={form.values.audience}
            options={BANNER_AUDIENCE_OPTIONS}
            onChange={(v) => form.setField('audience', v)}
            height={48}
          />
        </Field>
      </div>
    </FormModal>
  );
}
