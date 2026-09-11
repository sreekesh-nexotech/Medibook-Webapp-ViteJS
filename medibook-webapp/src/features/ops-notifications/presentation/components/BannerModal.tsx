import { type ChangeEvent, useRef, useState } from 'react';

import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';

import type { BannerDraft } from '@/features/ops-notifications/application/store/notifications.store';
import type { Banner } from '@/features/ops-notifications/application/store/notifications.types';

interface BannerModalProps {
  open: boolean;
  /** The campaign banner being edited, or null for a new / default-banner edit. */
  banner: Banner | null;
  /** True when editing the always-on default banner (no schedule fields). */
  fallback: boolean;
  onClose: () => void;
  onSave: (f: BannerDraft) => void;
}

interface BannerErrors {
  title?: string | null;
  from?: string | null;
  to?: string | null;
}

const EMPTY_DRAFT: BannerDraft = { title: '', img: null, from: '', to: '' };

const dateInputClass =
  'text-body text-text-body rounded-input border-border h-12 w-full border bg-white px-3';

/** The draft this modal opens on — a new banner, a campaign banner, or the default. */
function initialDraft(banner: Banner | null): BannerDraft {
  if (!banner) return EMPTY_DRAFT;
  return {
    title: banner.title,
    img: banner.img,
    from: banner.from || '',
    to: banner.to || '',
  };
}

/**
 * Add / edit a campaign banner, or edit the default banner (image upload +
 * schedule).
 *
 * The editor state is initialised from props rather than synced in an effect —
 * the screen keys this component by which banner is open, so React remounts it
 * with a fresh draft (no `set-state-in-effect`, no stale first render). Built
 * on `FormModal`, so Enter submits (audit 3.4.5).
 */
export function BannerModal({ open, banner, fallback, onClose, onSave }: BannerModalProps) {
  const [f, setF] = useState<BannerDraft>(() => initialDraft(banner));
  const [err, setErr] = useState<BannerErrors>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = () => fileRef.current?.click();

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      if (typeof rd.result === 'string') {
        const img = rd.result;
        setF((p) => ({ ...p, img }));
      }
    };
    rd.readAsDataURL(file);
    e.target.value = '';
  };

  const submit = () => {
    const e: BannerErrors = {
      title: f.title.trim() ? null : 'Give the banner a title.',
      from: fallback || f.from ? null : 'Set a start date.',
      to: fallback || (f.to && f.to >= f.from) ? null : 'Set an end date on or after the start.',
    };
    setErr(e);
    if (e.title || e.from || e.to) return;
    onSave(f);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={fallback ? 'Edit Default Banner' : banner ? 'Edit Banner' : 'Add Banner'}
      width={520}
      onSubmit={submit}
      submitLabel={banner || fallback ? 'Save Banner' : 'Add Banner'}
    >
      <div className="flex flex-col gap-4">
        {fallback && (
          <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
            <Icon name="info" size={14} className="mt-px flex-none" /> The default banner has no
            schedule — the app shows it whenever no campaign banner is live.
          </div>
        )}
        <OpsField label="Banner Title" required error={err.title}>
          <TextInput
            value={f.title}
            onChange={(v) => {
              setF({ ...f, title: v });
              setErr({ ...err, title: null });
            }}
            placeholder="e.g. Monsoon Health Camp — 20% off"
            height={48}
          />
        </OpsField>
        <OpsField label="Banner Image">
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          {f.img ? (
            <div className="flex flex-col gap-2">
              <img
                src={f.img}
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
                  onClick={() => setF({ ...f, img: null })}
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
                PNG or JPG · 1200×600 (2:1) recommended · title shows as overlay text if no image
              </span>
            </button>
          )}
        </OpsField>
        {!fallback && (
          <div className="grid grid-cols-2 gap-4">
            <OpsField label="Live From" required error={err.from}>
              {(field) => (
                <input
                  type="date"
                  id={field.id}
                  aria-invalid={field.invalid || undefined}
                  aria-describedby={field.describedById}
                  value={f.from}
                  onChange={(e) => {
                    setF({ ...f, from: e.target.value });
                    setErr({ ...err, from: null });
                  }}
                  className={dateInputClass}
                />
              )}
            </OpsField>
            <OpsField label="Live Until" required error={err.to}>
              {(field) => (
                <input
                  type="date"
                  id={field.id}
                  aria-invalid={field.invalid || undefined}
                  aria-describedby={field.describedById}
                  value={f.to}
                  onChange={(e) => {
                    setF({ ...f, to: e.target.value });
                    setErr({ ...err, to: null });
                  }}
                  className={dateInputClass}
                />
              )}
            </OpsField>
          </div>
        )}
      </div>
    </FormModal>
  );
}
