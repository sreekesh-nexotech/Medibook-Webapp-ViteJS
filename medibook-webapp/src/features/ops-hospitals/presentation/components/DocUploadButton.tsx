import { useId, useRef, type ChangeEvent } from 'react';

import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

import type { UploadedFileInfo } from '@/features/ops-hospitals/application/store/onboarding.store';

/** File types a KYC document may arrive as. */
const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png';

/** Largest file the console will record, in bytes (8 MB). */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

interface DocUploadButtonProps {
  /** Document label, used in the control's accessible name. */
  docLabel: string;
  /** Something is already on file — the control reads "Replace file". */
  hasFile: boolean;
  onUpload: (file: UploadedFileInfo) => void;
  /** Rejects a file that is too large, so nothing silently records wrong. */
  onTooLarge: (megabytes: number) => void;
  className?: string;
}

/**
 * Real per-document upload (audit SA-01). Mirrors the dashed affordance of
 * `shared/ui/ImageUpload` but takes an actual file: `ImageUpload` only fires a
 * "demo" toast, and recording a document that was never handed over is exactly
 * the kind of claim the contract's law forbids. This reads the file's real
 * name and size from the browser and hands them to the store, so what the
 * review row shows is what the reviewer actually attached.
 *
 * The bytes are not uploaded anywhere — there is no storage API yet — which is
 * why the row says "on file" rather than promising retrieval.
 */
export function DocUploadButton({
  docLabel,
  hasFile,
  onUpload,
  onTooLarge,
  className,
}: DocUploadButtonProps) {
  const inputId = `doc-upload-${useId()}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      onTooLarge(Math.round(MAX_FILE_BYTES / (1024 * 1024)));
    } else {
      onUpload({ name: file.name, size: file.size });
    }
    // Let the same file be chosen again after a rejection or a replace.
    e.target.value = '';
  };

  return (
    <>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleChange}
        className="sr-only"
      />
      <button
        type="button"
        aria-label={`${hasFile ? 'Replace' : 'Upload'} ${docLabel}`}
        title={`${hasFile ? 'Replace' : 'Upload'} ${docLabel} (PDF, JPG or PNG, up to 8 MB)`}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-border bg-bg-subtle text-text-muted hover:border-blue hover:bg-blue-soft-bg text-body inline-flex cursor-pointer items-center gap-1.75 rounded-md border-[1.5px] border-dashed px-3 py-2 font-medium transition-all duration-150',
          className,
        )}
      >
        <Icon name="upload" size={15} />
        {hasFile ? 'Replace file' : 'Upload file'}
      </button>
    </>
  );
}
