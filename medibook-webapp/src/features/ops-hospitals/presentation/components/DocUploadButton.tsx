import { useId, useRef, type ChangeEvent } from 'react';

import { FILE_UPLOAD_MAX_BYTES, acceptFor } from '@/core/api/files.rules';

import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

const BYTES_PER_MB = 1024 * 1024;

interface DocUploadButtonProps {
  /** Document label, used in the control's accessible name. */
  docLabel: string;
  /** A scan is already attached — the control reads "Replace scan". */
  hasFile: boolean;
  /** An upload is in flight. */
  busy?: boolean;
  disabled?: boolean;
  onUpload: (file: File) => void;
  /** Rejects a file that is too large before any request is made. */
  onTooLarge: (megabytes: number) => void;
  className?: string;
}

/**
 * Attach a scan of a physically collected document (backend Q66: documents
 * are handed over in person and ops ticks the checklist; a scan is optional
 * evidence). Mirrors the dashed affordance of `shared/ui/ImageUpload` but
 * takes a real file, which the caller uploads with purpose `kyc`.
 */
export function DocUploadButton({
  docLabel,
  hasFile,
  busy = false,
  disabled = false,
  onUpload,
  onTooLarge,
  className,
}: DocUploadButtonProps) {
  const inputId = `doc-upload-${useId()}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    // Let the same file be chosen again after a failure or a replace.
    e.target.value = '';
    if (!file) return;
    if (file.size > FILE_UPLOAD_MAX_BYTES) {
      onTooLarge(Math.round(FILE_UPLOAD_MAX_BYTES / BYTES_PER_MB));
      return;
    }
    onUpload(file);
  };

  const verb = hasFile ? 'Replace scan' : 'Attach scan';

  return (
    <>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={acceptFor('kyc')}
        onChange={handleChange}
        className="sr-only"
      />
      <button
        type="button"
        aria-label={`${verb} of ${docLabel}`}
        title={`${verb} of ${docLabel} (PDF, JPG or PNG) and mark it received`}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-border bg-bg-subtle text-text-muted hover:border-blue hover:bg-blue-soft-bg text-body inline-flex cursor-pointer items-center gap-1.75 rounded-md border-[1.5px] border-dashed px-3 py-2 font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        <Icon name="upload" size={15} />
        {busy ? 'Uploading…' : verb}
      </button>
    </>
  );
}
