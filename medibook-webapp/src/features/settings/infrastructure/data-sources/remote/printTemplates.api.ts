import { ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { fetchAllPages } from '@/core/api/pagination';

import type { PrintTemplateInput } from '@/features/settings/domain/entities/settings.entities';
import {
  printPreviewResponseSchema,
  printTemplatePageSchema,
  printTemplateResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/printTemplates.response';

/** Receipt and token-slip layouts: `/hospital/print-templates…` (`hospital_settings.*`). */

const TEMPLATES_PATH = '/print-templates';

function templatePath(id: string): string {
  return `${TEMPLATES_PATH}/${encodeURIComponent(id)}`;
}

function templateBody(input: Partial<PrintTemplateInput>) {
  return {
    ...(input.kind !== undefined && { kind: input.kind }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.paper !== undefined && { paper: input.paper }),
    ...(input.templateHtml !== undefined && { template_html: input.templateHtml }),
    ...(input.isDefault !== undefined && { is_default: input.isDefault }),
  };
}

export async function listPrintTemplates() {
  return fetchAllPages(async (params) => {
    const response = await hospitalApi.get(TEMPLATES_PATH, { params });
    return printTemplatePageSchema.parse(response.data);
  });
}

export async function postPrintTemplate(input: PrintTemplateInput) {
  const response = await hospitalApi.post(TEMPLATES_PATH, templateBody(input));
  return printTemplateResponseSchema.parse(response.data);
}

/** `kind` is fixed after create, so it is never sent here; `If-Match` is required. */
export async function patchPrintTemplate(
  id: string,
  changes: Omit<Partial<PrintTemplateInput>, 'kind'>,
  version: number,
) {
  const response = await hospitalApi.patch(templatePath(id), templateBody(changes), {
    headers: ifMatch(version),
  });
  return printTemplateResponseSchema.parse(response.data);
}

/** Refused (409) for the default of its kind or the token policy's template. */
export async function deletePrintTemplate(id: string): Promise<void> {
  await hospitalApi.delete(templatePath(id));
}

/** Rendered with sample data; writes nothing (a POST because it renders). */
export async function postPrintTemplatePreview(id: string) {
  const response = await hospitalApi.post(`${templatePath(id)}/preview`);
  return printPreviewResponseSchema.parse(response.data);
}
