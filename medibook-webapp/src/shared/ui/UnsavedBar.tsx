import { Button } from '@/shared/ui/Button';

interface UnsavedBarProps {
  /** True while the screen holds edits that are not persisted yet. */
  dirty: boolean;
  /** Save in flight — shows the busy label and blocks both actions. */
  busy?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
  discardLabel?: string;
  busyLabel?: string;
  /** Status text when there is nothing to save. */
  savedLabel?: string;
  /** Status text when there are unsaved edits. */
  dirtyLabel?: string;
}

/**
 * The sticky unsaved-changes bar — audit 3.7.1: "The operations settings
 * screen does show an unsaved-changes bar, so the pattern exists and was
 * simply not applied."
 *
 * This is that bar, extracted verbatim so every editable screen can have it.
 * Pair it with `useUnsavedChanges` for the half that actually prevents the
 * edits being lost (route blocking, tab-close warning, tab-switch confirm).
 */
export function UnsavedBar({
  dirty,
  busy = false,
  onSave,
  onDiscard,
  saveLabel = 'Save Changes',
  discardLabel = 'Discard',
  busyLabel = 'Saving…',
  savedLabel = 'All changes saved',
  dirtyLabel = 'Unsaved changes',
}: UnsavedBarProps) {
  const blocked = !dirty || busy;
  return (
    <div className="border-border shadow-pop sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 rounded-lg border bg-white px-5 py-3">
      {busy ? (
        <span className="text-caption text-text-muted">{busyLabel}</span>
      ) : dirty ? (
        <>
          <span className="bg-y-600 size-2 rounded-full" />
          <span className="text-caption text-text-muted">{dirtyLabel}</span>
        </>
      ) : (
        <span className="text-caption text-text-faint">{savedLabel}</span>
      )}
      <div className="flex-1" />
      <Button variant="secondary" disabled={blocked} onClick={onDiscard}>
        {discardLabel}
      </Button>
      <Button busy={busy} disabled={!dirty} onClick={onSave}>
        {busy ? busyLabel : saveLabel}
      </Button>
    </div>
  );
}
