/** Input sanitisers the settings rule rows share. Pure. */

/** Digits only — the unit sits outside the input. */
export function digitsText(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/** Digits and one dot with up to two decimals (a percentage). */
export function percentText(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length === 0 ? whole : `${whole}.${rest.join('').slice(0, 2)}`;
}
