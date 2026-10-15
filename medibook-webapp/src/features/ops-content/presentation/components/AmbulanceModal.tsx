import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSaveAmbulanceProviderMutation } from '@/features/ops-content/application/queries/useSaveAmbulanceProviderMutation';
import type {
  AmbulanceDraft,
  AmbulanceProvider,
  ContentLocation,
} from '@/features/ops-content/domain/entities/content.entities';
import {
  ambulanceErrors,
  hasDraftErrors,
  parseOptionalInt,
  type DraftErrors,
} from '@/features/ops-content/presentation/components/content.rules';

const NO_LOCATION = 'Any location';

interface AmbulanceModalProps {
  provider: AmbulanceProvider | null;
  locations: readonly ContentLocation[];
  onClose: () => void;
}

const locationLabel = (l: ContentLocation): string => `${l.area}, ${l.city}`;

/** Add or edit an ambulance provider. Mount only while open. */
export function AmbulanceModal({ provider, locations, onClose }: AmbulanceModalProps) {
  const save = useSaveAmbulanceProviderMutation();
  const [name, setName] = useState(provider?.name ?? '');
  const [phone, setPhone] = useState(provider?.phoneE164 ?? '');
  const [eta, setEta] = useState(
    provider?.etaMinutes === null || !provider ? '' : String(provider.etaMinutes),
  );
  const [serviceArea, setServiceArea] = useState(provider?.serviceArea ?? '');
  const [locationId, setLocationId] = useState<string | null>(provider?.locationId ?? null);
  const [isActive, setIsActive] = useState(provider?.isActive ?? true);
  const [err, setErr] = useState<DraftErrors<AmbulanceDraft>>({});

  const submit = (): void => {
    const etaMinutes = parseOptionalInt(eta);
    const draft: AmbulanceDraft = {
      locationId,
      name: name.trim(),
      phoneE164: phone.replace(/\s/g, ''),
      etaMinutes: etaMinutes ?? null,
      serviceArea: serviceArea.trim() === '' ? null : serviceArea.trim(),
      isActive,
    };
    const e = ambulanceErrors(draft);
    if (etaMinutes === undefined) e.etaMinutes = 'Arrival time is whole minutes, 0 or more.';
    setErr(e);
    if (hasDraftErrors(e)) return;
    save.mutate(
      { id: provider?.id ?? null, draft, version: provider?.rowVersion ?? 0 },
      {
        onSuccess: () => {
          toast(provider ? 'Ambulance provider updated.' : 'Ambulance provider added.', 'success');
          onClose();
        },
        onError: (failure) => {
          if (isFailure(failure)) {
            const fe = failure.fieldErrors;
            setErr({
              name: fe.name?.[0],
              phoneE164: fe.phoneE164?.[0],
              etaMinutes: fe.etaMinutes?.[0],
            });
          }
          toast(isFailure(failure) ? failure.message : 'Could not save the provider.', 'error');
        },
      },
    );
  };

  const options = [NO_LOCATION, ...locations.map(locationLabel)];
  const picked = locations.find((l) => l.id === locationId);

  return (
    <FormModal
      open
      onClose={onClose}
      title={provider ? 'Edit ambulance provider' : 'Add ambulance provider'}
      width={620}
      onSubmit={submit}
      submitLabel={provider ? 'Save Provider' : 'Add Provider'}
      busy={save.isPending}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <OpsField label="Name" required error={err.name}>
          <TextInput value={name} onChange={setName} height={48} />
        </OpsField>
        <OpsField
          label="Phone"
          required
          error={err.phoneE164}
          hint="International format, e.g. +914842000108"
        >
          <TextInput value={phone} onChange={setPhone} inputMode="tel" height={48} />
        </OpsField>
        <OpsField label="Location" hint="Where patients see it; any location shows everywhere.">
          <Select
            value={picked ? locationLabel(picked) : NO_LOCATION}
            options={options}
            onChange={(v) =>
              setLocationId(locations.find((l) => locationLabel(l) === v)?.id ?? null)
            }
            height={48}
          />
        </OpsField>
        <OpsField label="Typical arrival (minutes)" error={err.etaMinutes}>
          <TextInput value={eta} onChange={setEta} inputMode="numeric" height={48} />
        </OpsField>
        <OpsField label="Service area">
          <TextInput
            value={serviceArea}
            onChange={setServiceArea}
            placeholder="e.g. Ernakulam district"
            height={48}
          />
        </OpsField>
        <div className="flex items-center gap-3 self-end pb-3">
          <Toggle value={isActive} onChange={setIsActive} label="Active" />
          <span className="text-body text-text-strong">Listed in the app</span>
        </div>
      </div>
    </FormModal>
  );
}
