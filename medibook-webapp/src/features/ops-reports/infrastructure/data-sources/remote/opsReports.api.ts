import { isAxiosError } from 'axios';

import { platformApi } from '@/core/api/http';

import type {
  ReportExportDeferredResponse,
  ReportSummaryResponse,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.response';
import {
  reportExportDeferredResponseSchema,
  reportListResponseSchema,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.response';

/** `202 Accepted` — the export is too large to render in the request. */
const HTTP_ACCEPTED = 202;

const CONTENT_DISPOSITION_HEADER = 'content-disposition';

/** `attachment; filename="revenue.csv"` → `revenue.csv`. */
const FILENAME_PATTERN = /filename="?([^";]+)"?/i;

/** Excel only reads a UTF-8 CSV correctly when it starts with a BOM. */
const UTF8_BOM = '﻿';

const CSV_EXTENSION = 'csv';

/** A synchronous CSV export, or the body of a deferred (`202`) one. */
export type ReportCsvExportResponse =
  | { readonly kind: 'file'; readonly filename: string; readonly content: string }
  | { readonly kind: 'deferred'; readonly body: ReportExportDeferredResponse };

/** `GET /platform/reports` — every registered platform report. */
export async function getReports(): Promise<ReportSummaryResponse[]> {
  const response = await platformApi.get('/reports');
  return reportListResponseSchema.parse(response.data).results;
}

/** A JSON body read as text; the raw text when it is not JSON (e.g. a proxy's HTML page). */
function parseTextBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function filenameFrom(disposition: unknown, code: string): string {
  const match = typeof disposition === 'string' ? FILENAME_PATTERN.exec(disposition) : null;
  return match?.[1] ?? `${code}.${CSV_EXTENSION}`;
}

/**
 * `GET /platform/reports/{code}/export.csv`. Read as text because a `200`
 * is the file itself; a `202` and every error are JSON in that same text, so
 * error bodies are parsed back here for `toFailure` to read the backend's
 * message. The browser strips the server's BOM while decoding, so it is
 * restored for Excel.
 */
export async function getReportCsvExport(code: string): Promise<ReportCsvExportResponse> {
  try {
    const response = await platformApi.get<string>(
      `/reports/${encodeURIComponent(code)}/export.${CSV_EXTENSION}`,
      { responseType: 'text' },
    );
    if (response.status === HTTP_ACCEPTED) {
      return {
        kind: 'deferred',
        body: reportExportDeferredResponseSchema.parse(parseTextBody(response.data)),
      };
    }
    const text = response.data;
    return {
      kind: 'file',
      filename: filenameFrom(response.headers[CONTENT_DISPOSITION_HEADER], code),
      content: text.startsWith(UTF8_BOM) ? text : UTF8_BOM + text,
    };
  } catch (error) {
    if (isAxiosError(error) && error.response && typeof error.response.data === 'string') {
      error.response.data = parseTextBody(error.response.data);
    }
    throw error;
  }
}
