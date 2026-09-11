import type { FormEvent, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

interface FormProps {
  /** Called on submit, after `preventDefault()`. */
  onSubmit: () => void;
  children?: ReactNode;
  /**
   * DOM id, so a `type="submit"` button can live outside this element via its
   * native `form` attribute (how `FormModal` puts Save in the modal footer).
   */
  id?: string;
  /**
   * Let the browser run its own constraint validation on submit. Off by
   * default: the app shows its own inline field errors, and native bubbles
   * would compete with them.
   */
  nativeValidation?: boolean;
  className?: string;
}

/**
 * A real `<form>` element — audit 3.5.6/3.4.5: "The Enter key never submits
 * anything. There is not a single form element in the web app."
 *
 * Wrapping fields in this gets implicit submission for free: Enter in any text
 * input fires `onSubmit`, the primary action is reachable as
 * `type="submit"`, and assistive technology recognises the group as a form.
 */
export function Form({ onSubmit, children, id, nativeValidation = false, className }: FormProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form id={id} onSubmit={handleSubmit} noValidate={!nativeValidation} className={cn(className)}>
      {children}
    </form>
  );
}
