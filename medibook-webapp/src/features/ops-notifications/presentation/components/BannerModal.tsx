import { type ChangeEvent, useRef, useState } from 'react';

import { acceptFor } from '@/core/api/files.rules';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';

import { useBannerImageUrlQuery } from '@/features/ops-notifications/application/queries/useBannerImageUrlQuery';
import type {
  BannerDraft,
  BannerImageChange,
  CampaignBanner,
} from '@/features/ops-notifications/domain/entities/notifications.entities';

interface BannerModalProps {
  open: boolean;
  /** The campaign banner being edited, or null for a new one. */
  banner: CampaignBanner | null;
  /** Save in flight (upload + write): submit spinner, actions blocked. */
  busy?: boolean;
  onClose: () => void;
  /** `preview` is the newly picked creative as a data URI (null when none was picked). */
  onSave: (draft: BannerDraft, preview: string | null) => void;
}

interface BannerErrors {
  title?: string | null;
  from?: string | null;
  to?: string | null;
}

/** The text fields of the editor; the creative is tracked separately. */
interface BannerFieldsDraft {
  readonly title: string;
  readonly from: string;
  readonly to: string;
}

/** A newly picked creative: the file to upload and its local preview. */
interface PickedImage {
  readonly file: File;
  readonly preview: string;
}

const BANNER_IMAGE_ACCEPT = acceptFor('banner');

const dateInputClass =
  'text-body text-text-body rounded-input border-border-control h-12 w-full border bg-white px-3';

/** The fields this modal opens on — a new banner, a campaign banner, or the default. */
function initialDraft(banner: CampaignBanner | null): BannerFieldsDraft {
  if (!banner) return { title: '', from: '', to: '' };
  return { title: banner.title, from: banner.from ?? '', to: banner.to ?? '' };
}

/**
 * Add / edit a campaign banner, or edit the default banner (image upload +
 * schedule).
 *
 * The editor state is initialised from props rather than synced in an effect —
 * the screen keys this component by which banner is open, so React remounts it
 * with a fresh draft (no `set-state-in-effect`, no stale first render). Built
 * on `FormModal`, so Enter submits (audit 3.4.5). A picked image is only
 * uploaded on save.
 */
export function BannerModal({ open, banner, busy = false, onClose, onSave }: BannerModalProps) {
  const [f, setF] = useState<BannerFieldsDraft>(() => initialDraft(banner));
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [removed, setRemoved] = useState(false);
  const [err, setErr] = useState<BannerErrors>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const storedImageId = removed || picked ? null : (banner?.imageFileId ?? null);
  const stored = useBannerImageUrlQuery(storedImageId);
  const previewSrc = picked?.preview ?? stored.data ?? null;
  const hasImage = picked != null || storedImageId != null;

  const pickFile = () => fileRef.current?.click();

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      if (typeof rd.result === 'string') setPicked({ file, preview: rd.result });
    };
    rd.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => {
    setPicked(null);
    setRemoved(true);
  };

  const submit = () => {
    const e: BannerErrors = {
      title: f.title.trim() ? null : 'Give the banner a title.',
      from: f.from ? null : 'Set a start date.',
      to: f.to && f.to >= f.from ? null : 'Set an end date on or after the start.',
    };
    setErr(e);
    if (e.title || e.from || e.to) return;
    const image: BannerImageChange = picked
      ? { kind: 'upload', file: picked.file }
      : removed
        ? { kind: 'remove' }
        : { kind: 'keep' };
    onSave({ ...f, image }, picked?.preview ?? null);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={banner ? 'Edit Banner' : 'Add Banner'}
      width={520}
      onSubmit={submit}
      submitLabel={banner ? 'Save Banner' : 'Add Banner'}
      busy={busy}
    >
      <div className="flex flex-col gap-4">
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
          <input
            ref={fileRef}
            type="file"
            accept={BANNER_IMAGE_ACCEPT}
            onChange={onFile}
            className="hidden"
          />
          {hasImage ? (
            <div className="flex flex-col gap-2">
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Banner preview"
                  className="border-border-soft h-37.5 w-full rounded-md border object-cover"
                />
              ) : (
                <div className="border-border-soft bg-bg-subtle text-text-muted flex h-37.5 w-full items-center justify-center rounded-md border">
                  <Icon name="image" size={20} />
                </div>
              )}
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
                  onClick={removeImage}
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
      </div>
    </FormModal>
  );
}
