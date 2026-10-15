import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  DisplayDevice,
  DisplayDeviceWithKey,
} from '@/features/settings/domain/entities/settings.entities';
import {
  useRegisterDisplayDeviceMutation,
  useUpdateDisplayDeviceMutation,
} from '@/features/settings/application/queries/useDisplayDeviceMutations';

const NAME_MAX = 120;

interface DeviceForm {
  name: string;
}

const VALIDATORS: FormValidators<DeviceForm> = {
  name: (v) => required(v, 'Screen name'),
};

const SERVER_FIELDS = { name: 'name' } as const;

interface DisplayDeviceModalProps {
  /** `null` registers a new screen. */
  device: DisplayDevice | null;
  onClose: () => void;
  /** Called with the new screen and its one-time key after registering. */
  onRegistered: (created: DisplayDeviceWithKey) => void;
}

/** Register a token display screen, or rename one. */
export function DisplayDeviceModal({ device, onClose, onRegistered }: DisplayDeviceModalProps) {
  const register = useRegisterDisplayDeviceMutation();
  const update = useUpdateDisplayDeviceMutation();
  const form = useForm<DeviceForm>({
    initial: { name: device?.name ?? '' },
    validate: VALIDATORS,
    onSubmit: async ({ name }) => {
      try {
        if (device) {
          await update.mutateAsync({
            id: device.id,
            changes: { name: name.trim() },
            version: device.version,
          });
          toast('Screen renamed', 'success');
          onClose();
          return;
        }
        onRegistered(await register.mutateAsync(name.trim()));
      } catch (error) {
        toast(
          form.applyServerErrors(
            error,
            { fields: SERVER_FIELDS },
            'The screen could not be saved.',
          ),
          'error',
        );
      }
    },
  });
  return (
    <FormModal
      open
      onClose={onClose}
      title={device ? 'Rename Screen' : 'Register a Display Screen'}
      width={480}
      onSubmit={form.handleSubmit}
      submitLabel={device ? 'Save' : 'Register'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <FormErrorSummary messages={form.serverSummary} />
        <Field
          label="Screen name"
          required
          error={form.errorFor('name')}
          hint="Where it hangs, e.g. “OPD waiting hall”."
        >
          <TextInput
            value={form.values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            maxLength={NAME_MAX}
            autoFocus
          />
        </Field>
        {!device && (
          <p className="text-caption text-text-muted">
            Registering issues a key for the screen. It is shown once — enter it on the screen when
            it asks to sign in.
          </p>
        )}
      </div>
    </FormModal>
  );
}
