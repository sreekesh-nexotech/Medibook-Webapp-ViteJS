import { type ChangeEvent, useRef } from 'react';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { dateRange, minLen, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import type { PatientBannerDraft } from '@/features/settings/application/store/profile.store';
import {
  BANNER_AUDIENCES,
  type BannerAudience,
  type PatientBanner,
} from '@/features/settings/application/store/profile.types';

/** Banner copy the patient app can render without clipping. */
const MAX_BODY_CHARS = 220;
const MIN_TITLE_CHARS = 6;

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-12 w-full border bg-white px-3';

interface BannerForm {
  title: string;
  body: string;
  img: string | null;
  from: string;
  to: string;
  audience: BannerAudience;
  audienceDept: string;
}

const VALIDATORS: FormValidators<BannerForm> = {
  title: (v) => minLen(v, MIN_TITLE_CHARS, 'Banner title'),
  body: (v) => required(v, 'Banner message'),
  from: (v) => required(v, 'Live-from date'),
  to: (v, values) => dateRange(values.from, v),
  audienceDept: (v, values) =>
    values.audience === 'Patients of a department' && v.trim() === ''
      ? 'Pick the department this banner is for.'
      : undefined,
};

interface PatientBannerModalProps {
  open: boolean;
  /** The banner being edited, or null to publish a new one. */
  banner: PatientBanner | null;
  departments: readonly string[];
  onClose: () => void;
  onSave: (draft: PatientBannerDraft) => void;
}

/**
 * Author a banner the hospital publishes to the Medibook patient app (audit
 * HA-03). Same authoring pattern as the operations console's `BannerModal` —
 * title, creative upload with preview, live-from/until window — on the shared
 * `FormModal` so Enter submits and every error is an inline `Field` message.
 */
export function PatientBannerModal({
  open,
  banner,
  departments,
  onClose,
  onSave,
}: PatientBannerModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<BannerForm>({
    initial: {
      title: banner?.title ?? '',
      body: banner?.body ?? '',
      img: banner?.img ?? null,
      from: banner?.from ?? '',
      to: banner?.to ?? '',
      audience: banner?.audience ?? 'All patients',
      audienceDept: banner?.audienceDept ?? '',
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      onSave({
        ...(banner ? { id: banner.id } : {}),
        title: v.title.trim(),
        body: v.body.trim(),
        img: v.img,
        from: v.from,
        to: v.to,
        audience: v.audience,
        audienceDept: v.audience === 'Patients of a department' ? v.audienceDept : '',
      });
      onClose();
    },
  });

  const pickFile = (): void => fileRef.current?.click();

  const onFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') form.setField('img', reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={banner ? 'Edit Banner' : 'Publish Banner'}
      width={620}
      onSubmit={form.handleSubmit}
      submitLabel={banner ? 'Save Banner' : 'Publish Banner'}
      busy={form.submitting}
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
          <textarea
            value={form.values.body}
            onChange={(e) => form.setField('body', e.target.value.slice(0, MAX_BODY_CHARS))}
            onBlur={() => form.blurField('body')}
            placeholder="What the patient should do, in one or two sentences."
            className="rounded-input border-border text-body text-text-strong box-border h-20 w-full resize-none border p-3"
          />
        </Field>

        <Field label="Banner Image">
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          {form.values.img ? (
            <div className="flex flex-col gap-2">
              <img
                src={form.values.img}
                alt="Banner preview"
                className="border-border-soft h-37.5 w-full rounded-md border object-cover"
              />
              <div className="flex gap-3.5">
                <button
                  type="button"
                  onClick={pickFile}
                  className="text-caption text-blue cursor-pointer"
                >
                  Replace image
                </button>
                <button
                  type="button"
                  onClick={() => form.setField('img', null)}
                  className="text-caption text-d-500 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={pickFile}
              className="border-border text-text-muted bg-bg-subtle flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-md border-[1.5px] border-dashed px-3 py-5.5"
            >
              <Icon name="upload" size={20} />
              <span className="text-body">Click to upload an image</span>
              <span className="text-caption text-text-muted">
                PNG or JPG · 1200×600 (2:1) recommended · the title shows as overlay text if no
                image
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Audience">
            <Select
              value={form.values.audience}
              options={BANNER_AUDIENCES}
              onChange={(v) => {
                form.setField('audience', v as BannerAudience);
                if (v !== 'Patients of a department') form.setField('audienceDept', '');
              }}
              height={48}
            />
          </Field>
          {form.values.audience === 'Patients of a department' && (
            <Field label="Department" required error={form.errorFor('audienceDept')}>
              <Select
                value={form.values.audienceDept}
                options={departments}
                onChange={(v) => form.setField('audienceDept', v)}
                onBlur={() => form.blurField('audienceDept')}
                placeholder="Select a department"
                height={48}
              />
            </Field>
          )}
        </div>
      </div>
    </FormModal>
  );
}
