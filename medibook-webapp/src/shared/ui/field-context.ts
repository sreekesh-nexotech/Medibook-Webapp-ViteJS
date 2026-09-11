import { createContext, useContext } from 'react';

/**
 * The wiring that makes a label actually belong to its input — audit
 * 3.3.4/3.5.1: "No form label is tied to its input anywhere in the web app",
 * and "the hospital app cannot tell a user which field is wrong".
 *
 * `Field` / `OpsField` generate one id per field and publish it here; the
 * controls (`TextInput`, `PasswordInput`, `Select`, `FilterSelect`) read it and
 * apply `id`, `aria-describedby`, `aria-invalid` and `required` themselves. No
 * call site has to invent or thread an id, and nothing breaks for a control
 * rendered outside a field — the context is simply absent.
 */
export interface FieldContextValue {
  /** The input's `id`, matching the label's `htmlFor`. */
  readonly id: string;
  /** Id of the error or hint element, for `aria-describedby`. */
  readonly describedById: string | undefined;
  /** True when the field is showing an error (drives `aria-invalid`). */
  readonly invalid: boolean;
  /** True when the field's label carries the required marker. */
  readonly required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** The enclosing field's wiring, or `null` for a standalone control. */
export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}
