/**
 * A short code made from a display name — "Dr. Asha Verma" → "dr-asha-verma-k3f9".
 *
 * Used when a "Short code" field is left empty on a new record. The form says
 * Medibook makes one from the name; a backend that still requires the code
 * (UAT 16 Oct: doctors and services failed with "Short code: This field is
 * required.") gets this one instead. The four-character time suffix keeps two
 * records with the same name apart.
 */
export function codeFromName(name: string, maxLength: number): string {
  const base =
    name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
  const suffix = Date.now().toString(36).slice(-4);
  const room = Math.max(1, maxLength - suffix.length - 1);
  return `${base.slice(0, room).replace(/-+$/, '')}-${suffix}`;
}
