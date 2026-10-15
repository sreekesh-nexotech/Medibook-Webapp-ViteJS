import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  PrintPreview,
  PrintTemplate,
} from '@/features/settings/domain/entities/settings.entities';

/** `PrintTemplateSerializer` (`/hospital/print-templates`, Q22). */
export const printTemplateResponseSchema = z.object({
  id: z.string(),
  kind: z.enum(['token_slip', 'receipt']),
  name: z.string(),
  paper: z.enum(['A5', '80mm', 'A4']),
  template_html: z.string(),
  is_default: z.boolean(),
  version: z.number().int(),
});

export const printTemplatePageSchema = paginatedSchema(printTemplateResponseSchema);

/** `PrintPreviewSerializer` — sample data only; `pdf_base64` null without the renderer. */
export const printPreviewResponseSchema = z.object({
  html: z.string(),
  kind: z.string(),
  paper: z.string(),
  pdf_base64: z.string().nullable(),
});

export function toPrintTemplate(dto: z.infer<typeof printTemplateResponseSchema>): PrintTemplate {
  return {
    id: dto.id,
    kind: dto.kind,
    name: dto.name,
    paper: dto.paper,
    templateHtml: dto.template_html,
    isDefault: dto.is_default,
    version: dto.version,
  };
}

export function toPrintPreview(dto: z.infer<typeof printPreviewResponseSchema>): PrintPreview {
  return { html: dto.html, paper: dto.paper, pdfBase64: dto.pdf_base64 };
}
