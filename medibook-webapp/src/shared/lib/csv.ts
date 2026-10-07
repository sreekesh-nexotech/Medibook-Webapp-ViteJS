/** One CSV record: its fields, and its text exactly as the file had it. */
interface CsvRecord {
  readonly fields: readonly string[];
  readonly raw: string;
}

/**
 * Split RFC 4180 CSV into records, honouring quoted fields (which may hold
 * commas, doubled quotes and line breaks). Each record keeps its raw text, so
 * the kept rows can be written back unchanged.
 */
function parseRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let start = 0;
  let i = 0;
  const endRecord = (end: number, next: number): void => {
    fields.push(field);
    records.push({ fields, raw: text.slice(start, end) });
    fields = [];
    field = '';
    start = next;
  };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') quoted = false;
      else field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      endRecord(i, i + 2);
      i += 2;
      continue;
    } else if (ch === '\n') {
      endRecord(i, i + 1);
    } else {
      field += ch;
    }
    i += 1;
  }
  if (start < text.length) endRecord(text.length, text.length);
  return records;
}

/** The result of keeping some of a CSV file's data rows. */
export interface FilteredCsv {
  readonly csv: string;
  /** Data rows in the original file (the header not counted). */
  readonly total: number;
  /** Data rows kept. */
  readonly kept: number;
}

/**
 * Keep the header and the data rows whose `column` value passes `keep`. Rows
 * are written back exactly as they were; line breaks become CRLF. A file
 * without that column is returned unchanged.
 */
export function filterCsvRows(
  text: string,
  column: string,
  keep: (value: string) => boolean,
): FilteredCsv {
  const [header, ...rows] = parseRecords(text);
  if (!header) return { csv: text, total: 0, kept: 0 };
  const index = header.fields.indexOf(column);
  if (index < 0) return { csv: text, total: rows.length, kept: rows.length };
  const kept = rows.filter((r) => keep(r.fields[index] ?? ''));
  const csv = [header, ...kept].map((r) => `${r.raw}\r\n`).join('');
  return { csv, total: rows.length, kept: kept.length };
}

/** Data rows in a CSV file, not counting the header. */
export function csvRowCount(text: string): number {
  return Math.max(0, parseRecords(text).length - 1);
}
