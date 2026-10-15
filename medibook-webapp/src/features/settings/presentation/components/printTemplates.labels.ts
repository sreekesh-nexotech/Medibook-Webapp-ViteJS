import type { PrintTemplateKind } from '@/features/settings/domain/entities/settings.entities';

export const TEMPLATE_KIND_LABEL: Readonly<Record<PrintTemplateKind, string>> = {
  receipt: 'Receipt',
  token_slip: 'Token slip',
};

/** The variables each kind's template can use (`print_render.sample_context`). */
export const TEMPLATE_PLACEHOLDERS: Readonly<Record<PrintTemplateKind, string>> = {
  token_slip:
    '{{ hospital.name }}, {{ hospital.address }}, {{ doctor.name }}, {{ session.label }}, {{ patient.display_name }}, {{ patient.mrn }}, {{ appointment.token_label }}, {{ appointment.booking_ref }}, {{ appointment.scheduled_local }}',
  receipt:
    '{{ hospital.name }}, {{ hospital.address }}, {{ hospital.gstin }}, {{ patient.name }}, {{ patient.mrn }}, {{ receipt.receipt_no }}, {{ receipt.issued_local }}, {% for line in receipt.lines %}{{ line.description }} {{ line.amount_display }}{% endfor %}, {{ receipt.total_display }}, {{ receipt.issued_by_name }}, {{ receipt.counter_code }}',
};
