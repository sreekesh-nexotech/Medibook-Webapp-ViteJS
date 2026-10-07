/** Query keys for patient-app content (standards §4 — no inline key arrays). */
export const contentKeys = {
  all: ['ops-content'] as const,
  legal: () => [...contentKeys.all, 'legal'] as const,
  faqs: () => [...contentKeys.all, 'faqs'] as const,
  locations: () => [...contentKeys.all, 'locations'] as const,
  ambulance: () => [...contentKeys.all, 'ambulance'] as const,
};
