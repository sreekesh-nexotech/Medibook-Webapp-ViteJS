import { useState } from 'react';

import { describeFailure } from '@/shared/lib/serverErrors';
import { Button } from '@/shared/ui/Button';
import { IconBtn } from '@/shared/ui/IconBtn';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { DoctorServiceLink } from '@/features/settings/domain/entities/services.entities';
import { useDoctorServiceMutations } from '@/features/settings/application/queries/services.mutations';

import { overrideFromText } from './services.labels';

interface DoctorServiceLinkRowProps {
  link: DoctorServiceLink;
  doctorName: string;
  /** The service's own price, shown as the placeholder. */
  servicePriceRupees: number;
  mayEdit: boolean;
  mayRemove: boolean;
}

/** One doctor offering the service: their own price (or the service's), saved or removed here. */
export function DoctorServiceLinkRow({
  link,
  doctorName,
  servicePriceRupees,
  mayEdit,
  mayRemove,
}: DoctorServiceLinkRowProps) {
  const { reprice, unlink } = useDoctorServiceMutations();
  const saved = link.priceOverrideRupees === null ? '' : String(link.priceOverrideRupees);
  const [text, setText] = useState(saved);
  const parsed = overrideFromText(text);
  const changed = parsed !== undefined && parsed !== link.priceOverrideRupees;

  const save = (): void => {
    if (parsed === undefined) return;
    reprice.mutate(
      { id: link.id, priceOverrideRupees: parsed },
      {
        onSuccess: () => toast(`${doctorName}'s price saved`, 'success'),
        onError: (error) => toast(describeFailure(error, 'The price could not be saved.'), 'error'),
      },
    );
  };

  const remove = (): void => {
    unlink.mutate(link.id, {
      onSuccess: () => toast(`${doctorName} no longer offers this service`, 'info'),
      onError: (error) =>
        toast(describeFailure(error, 'The doctor could not be removed.'), 'error'),
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
      <span className="text-body text-text-strong min-w-40 flex-1 font-medium">{doctorName}</span>
      <div className="w-32">
        <TextInput
          value={text}
          onChange={(v) => setText(v.replace(/[^0-9]/g, ''))}
          placeholder={`₹${servicePriceRupees}`}
          inputMode="numeric"
          aria-label={`${doctorName}'s price in rupees`}
          disabled={!mayEdit}
        />
      </div>
      {mayEdit && changed && (
        <Button size="sm" onClick={save} busy={reprice.isPending}>
          Save
        </Button>
      )}
      {mayRemove && (
        <IconBtn
          name="trash-2"
          label={`Remove ${doctorName}`}
          title={`Remove ${doctorName}`}
          box={34}
          size={15}
          color="var(--color-d-500)"
          onClick={remove}
        />
      )}
    </li>
  );
}
