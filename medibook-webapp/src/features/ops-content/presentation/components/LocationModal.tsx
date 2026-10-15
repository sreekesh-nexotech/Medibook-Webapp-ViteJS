import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSaveLocationMutation } from '@/features/ops-content/application/queries/useSaveLocationMutation';
import type {
  ContentLocation,
  LocationDraft,
} from '@/features/ops-content/domain/entities/content.entities';
import {
  hasDraftErrors,
  locationErrors,
  type DraftErrors,
} from '@/features/ops-content/presentation/components/content.rules';

interface LocationModalProps {
  location: ContentLocation | null;
  onClose: () => void;
}

const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

/** Add or edit a location (unique per city and area). Mount only while open. */
export function LocationModal({ location, onClose }: LocationModalProps) {
  const save = useSaveLocationMutation();
  const [city, setCity] = useState(location?.city ?? '');
  const [area, setArea] = useState(location?.area ?? '');
  const [state, setState] = useState(location?.state ?? '');
  const [lat, setLat] = useState(location?.lat ?? '');
  const [lng, setLng] = useState(location?.lng ?? '');
  const [isPopular, setIsPopular] = useState(location?.isPopular ?? false);
  const [isActive, setIsActive] = useState(location?.isActive ?? true);
  const [err, setErr] = useState<DraftErrors<LocationDraft> & { form?: string }>({});

  const submit = (): void => {
    const draft: LocationDraft = {
      city: city.trim(),
      area: area.trim(),
      state: state.trim(),
      lat: orNull(lat),
      lng: orNull(lng),
      isPopular,
      isActive,
    };
    const e = locationErrors(draft);
    setErr(e);
    if (hasDraftErrors(e)) return;
    save.mutate(
      { id: location?.id ?? null, draft, version: location?.rowVersion ?? 0 },
      {
        onSuccess: () => {
          toast(location ? 'Location updated.' : 'Location added.', 'success');
          onClose();
        },
        onError: (failure) => {
          if (isFailure(failure)) {
            const fe = failure.fieldErrors;
            setErr({
              city: fe.city?.[0],
              area: fe.area?.[0],
              state: fe.state?.[0],
              lat: fe.lat?.[0],
              lng: fe.lng?.[0],
              // uq_location: the same city + area exists (non_field_errors).
              form: fe.non_field_errors?.[0],
            });
          }
          toast(isFailure(failure) ? failure.message : 'Could not save the location.', 'error');
        },
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={location ? 'Edit location' : 'Add location'}
      width={620}
      onSubmit={submit}
      submitLabel={location ? 'Save Location' : 'Add Location'}
      busy={save.isPending}
    >
      <div className="flex flex-col gap-4">
        {err.form && <span className="text-caption text-d-700">{err.form}</span>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <OpsField label="City" required error={err.city}>
            <TextInput value={city} onChange={setCity} height={48} />
          </OpsField>
          <OpsField label="Area" required error={err.area}>
            <TextInput value={area} onChange={setArea} height={48} />
          </OpsField>
          <OpsField label="State" required error={err.state}>
            <TextInput value={state} onChange={setState} height={48} />
          </OpsField>
          <OpsField label="Latitude" error={err.lat} hint="Optional, e.g. 9.981636">
            <TextInput value={lat} onChange={setLat} inputMode="decimal" height={48} />
          </OpsField>
          <OpsField label="Longitude" error={err.lng} hint="Optional, e.g. 76.299884">
            <TextInput value={lng} onChange={setLng} inputMode="decimal" height={48} />
          </OpsField>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <Toggle value={isPopular} onChange={setIsPopular} label="Popular" />
            <span className="text-body text-text-strong">Show among popular locations</span>
          </div>
          <div className="flex items-center gap-3">
            <Toggle value={isActive} onChange={setIsActive} label="Active" />
            <span className="text-body text-text-strong">Offered in the app</span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
