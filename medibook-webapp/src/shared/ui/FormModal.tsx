import { useId, type ReactNode } from 'react';

import { Button } from '@/shared/ui/Button';
import { Form } from '@/shared/ui/Form';
import { Modal } from '@/shared/ui/Modal';

type SubmitVariant = 'primary' | 'info' | 'danger' | 'success';

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** The fields. Rendered inside a real `<form>`, so Enter submits. */
  children?: ReactNode;
  /** Panel width in px — varies per call site (440/560/720…). */
  width?: number;
  /** Runs on submit (Enter, or the footer button). */
  onSubmit: () => void;
  submitLabel?: string;
  submitVariant?: SubmitVariant;
  cancelLabel?: string;
  /** Save in flight: spinner on the submit button, both actions blocked. */
  busy?: boolean;
  /** Nothing to save yet: submit dimmed and inert. */
  disabled?: boolean;
  /** Extra footer content, rendered to the left of Cancel. */
  footerLeft?: ReactNode;
}

/**
 * `Modal` whose body is a real `<form>` — so every modal that uses it gets
 * Enter-to-submit for free (audit 3.5.6), keeps the design's footer layout,
 * and inherits `Modal`'s Escape / focus-trap / focus-return behaviour.
 *
 * The footer button sits outside the `<form>` element in the DOM, so it is
 * associated with it through the native `form` attribute rather than by
 * moving the design's markup around.
 */
export function FormModal({
  open,
  onClose,
  title,
  children,
  width,
  onSubmit,
  submitLabel = 'Save',
  submitVariant = 'primary',
  cancelLabel = 'Cancel',
  busy = false,
  disabled = false,
  footerLeft,
}: FormModalProps) {
  const formId = `form-modal-${useId()}`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={width}
      footer={
        <>
          {footerLeft}
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={submitVariant}
            busy={busy}
            disabled={disabled}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <Form id={formId} onSubmit={onSubmit}>
        {children}
      </Form>
    </Modal>
  );
}
