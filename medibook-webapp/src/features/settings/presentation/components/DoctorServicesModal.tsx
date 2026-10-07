import { useState } from 'react';

import { usePermission } from '@/shared/hooks/usePermission';
import { money } from '@/shared/lib/format';
import { describeFailure } from '@/shared/lib/serverErrors';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  DoctorServiceLink,
  PricedService,
} from '@/features/settings/domain/entities/services.entities';
import { useDoctorServiceMutations } from '@/features/settings/application/queries/services.mutations';

import { DoctorServiceLinkRow } from './DoctorServiceLinkRow';
import { overrideFromText } from './services.labels';

/** What the picker needs about a doctor. */
export interface LinkableDoctor {
  readonly id: string;
  readonly name: string;
  readonly departmentId: string;
}

interface DoctorServicesModalProps {
  service: PricedService;
  doctors: readonly LinkableDoctor[];
  /** Every doctor ↔ service link of the hospital; filtered to this service here. */
  links: readonly DoctorServiceLink[];
  onClose: () => void;
}

/**
 * Which doctors offer one service, each optionally at their own price
 * (`/hospital/doctor-services`: add, re-price, remove). A doctor's price
 * replaces the service's for bookings with that doctor (`fees.quote`).
 * Doctors of the service's own department are listed first.
 */
export function DoctorServicesModal({
  service,
  doctors,
  links,
  onClose,
}: DoctorServicesModalProps) {
  const { can } = usePermission();
  const { link } = useDoctorServiceMutations();
  const [doctorId, setDoctorId] = useState('');
  const [priceText, setPriceText] = useState('');

  const own = links.filter((l) => l.serviceId === service.id);
  const nameOf = new Map(doctors.map((d) => [d.id, d.name]));
  const linked = new Set(own.map((l) => l.doctorId));
  const candidates = doctors
    .filter((d) => !linked.has(d.id))
    .sort(
      (a, b) =>
        Number(b.departmentId === service.departmentId) -
          Number(a.departmentId === service.departmentId) || a.name.localeCompare(b.name),
    );
  const picked = candidates.find((d) => d.id === doctorId) ?? null;
  const price = overrideFromText(priceText);
  const mayAdd = can('Hospital Settings.add');

  const add = (): void => {
    if (!picked || price === undefined) return;
    link.mutate(
      { doctorId: picked.id, serviceId: service.id, priceOverrideRupees: price },
      {
        onSuccess: () => {
          toast(`${picked.name} now offers ${service.name}`, 'success');
          setDoctorId('');
          setPriceText('');
        },
        onError: (error) =>
          toast(describeFailure(error, 'The doctor could not be added.'), 'error'),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Doctors offering ${service.name}`}
      width={620}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <p className="text-body text-text-body mb-3.5">
        The service costs {money(service.priceRupees)}. A doctor&apos;s own price replaces it for
        bookings with that doctor; leave the price empty to use the service&apos;s.
      </p>
      {own.length === 0 ? (
        <p className="text-caption text-text-muted mb-4">No doctor offers this service yet.</p>
      ) : (
        <ul className="divide-border-soft border-border-soft mb-4 divide-y rounded-md border">
          {own.map((l) => (
            <DoctorServiceLinkRow
              key={`${l.id}:${l.priceOverrideRupees ?? ''}`}
              link={l}
              doctorName={nameOf.get(l.doctorId) ?? 'A doctor'}
              servicePriceRupees={service.priceRupees}
              mayEdit={can('Hospital Settings.edit')}
              mayRemove={can('Hospital Settings.del')}
            />
          ))}
        </ul>
      )}
      {mayAdd && candidates.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-55 flex-1">
            <Select
              value={picked?.name ?? ''}
              options={candidates.map((d) => d.name)}
              onChange={(name) => setDoctorId(candidates.find((d) => d.name === name)?.id ?? '')}
              placeholder="Add a doctor…"
              aria-label="Doctor to add"
              height={40}
            />
          </div>
          <div className="w-32">
            <TextInput
              value={priceText}
              onChange={(v) => setPriceText(v.replace(/[^0-9]/g, ''))}
              placeholder={`₹${service.priceRupees}`}
              inputMode="numeric"
              aria-label="Their price in rupees (optional)"
            />
          </div>
          <Button icon="plus" onClick={add} disabled={!picked} busy={link.isPending}>
            Add
          </Button>
        </div>
      )}
    </Modal>
  );
}
