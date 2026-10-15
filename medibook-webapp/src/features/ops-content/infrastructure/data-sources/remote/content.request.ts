import type {
  AmbulanceDraft,
  FaqDraft,
  LocationDraft,
} from '@/features/ops-content/domain/entities/content.entities';

/** The writable FAQ fields; `audience` only when the backend has it (B9). */
export function toFaqRequest(d: FaqDraft): Record<string, unknown> {
  return {
    category: d.category,
    question: d.question,
    answer_md: d.answerMd,
    sort_order: d.sortOrder,
    is_published: d.isPublished,
    ...(d.audience !== null ? { audience: d.audience } : {}),
  };
}

export function toLocationRequest(d: LocationDraft): Record<string, unknown> {
  return {
    city: d.city,
    area: d.area,
    state: d.state,
    lat: d.lat,
    lng: d.lng,
    is_popular: d.isPopular,
    is_active: d.isActive,
  };
}

export function toAmbulanceRequest(d: AmbulanceDraft): Record<string, unknown> {
  return {
    location: d.locationId,
    name: d.name,
    phone_e164: d.phoneE164,
    eta_minutes: d.etaMinutes,
    service_area: d.serviceArea,
    is_active: d.isActive,
  };
}

/** Wire names → draft names, to put a 400's messages on the right fields. */
export const CONTENT_FIELD: Readonly<Record<string, string>> = {
  answer_md: 'answerMd',
  sort_order: 'sortOrder',
  is_published: 'isPublished',
  is_popular: 'isPopular',
  is_active: 'isActive',
  phone_e164: 'phoneE164',
  eta_minutes: 'etaMinutes',
  service_area: 'serviceArea',
  location: 'locationId',
  body_md: 'bodyMd',
};
