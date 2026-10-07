import type {
  DoctorServiceLink,
  PricedService,
} from '@/features/settings/domain/entities/services.entities';

/**
 * Pure helpers for the New Appointment form. No React, no I/O, so they are
 * unit-tested directly.
 */

/**
 * One label per item for a `Select` that matches on its label. Two
 * departments or two doctors with the same name would otherwise collapse
 * into one option (and the second could never be picked), so a repeated
 * name carries a distinguishing suffix.
 */
export function uniqueLabels<T extends { readonly id: string }>(
  items: readonly T[],
  label: (item: T) => string,
  extra: (item: T) => string,
): ReadonlyMap<string, string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = label(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const labels = new Map<string, string>();
  const taken = new Set<string>();
  for (const item of items) {
    const name = label(item);
    let text = (counts.get(name) ?? 0) > 1 && extra(item) ? `${name} (${extra(item)})` : name;
    // Still a clash (same name and same suffix): fall back to a counter.
    let n = 2;
    const base = text;
    while (taken.has(text)) {
      text = `${base} #${n}`;
      n += 1;
    }
    taken.add(text);
    labels.set(item.id, text);
  }
  return labels;
}

/** A service the desk can add to one consultation, at that doctor's price. */
export interface DoctorServiceOption {
  readonly id: string;
  readonly name: string;
  /** Whole rupees, before tax: the doctor's override, else the service price. */
  readonly priceRupees: number;
}

/**
 * The active services a doctor offers (`/doctor-services`), each at the
 * doctor's own price when one is set. A doctor with no links offers none.
 */
export function servicesForDoctor(
  doctorId: string,
  services: readonly PricedService[],
  links: readonly DoctorServiceLink[],
): readonly DoctorServiceOption[] {
  if (!doctorId) return [];
  const byId = new Map(services.map((s) => [s.id, s]));
  const options: DoctorServiceOption[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (link.doctorId !== doctorId || seen.has(link.serviceId)) continue;
    const service = byId.get(link.serviceId);
    if (!service || !service.isActive) continue;
    seen.add(service.id);
    options.push({
      id: service.id,
      name: service.name,
      priceRupees: link.priceOverrideRupees ?? service.priceRupees,
    });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}
