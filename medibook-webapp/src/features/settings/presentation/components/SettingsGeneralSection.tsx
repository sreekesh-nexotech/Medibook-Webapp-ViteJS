import type { ChangeEvent } from 'react';

import { acceptFor } from '@/core/api/files.rules';

import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';

import type {
  HospitalImagePurpose,
  HospitalProfile,
} from '@/features/settings/domain/entities/settings.entities';
import { useHospitalImageUrlQuery } from '@/features/settings/application/queries/useHospitalImageUrlQuery';
import type { ProfileForm } from '@/features/settings/application/store/settings.form';

import { SettingsHead } from './SettingsHead';
import type { SectionDraft } from './settingsEditor.types';

/** Fallback artwork while the hospital has no logo of its own. */
const DEFAULT_LOGO_SRC = '/assets/medibook-mark.svg';
const PLATFORM_MANAGED_HINT = 'Managed by Medibook — contact support to change it.';
/** A map search for typed coordinates, so the admin can check the pin themselves. */
const MAP_SEARCH_URL = 'https://www.openstreetmap.org/';
const MAP_ZOOM = 17;

type PickImage = (
  purpose: HospitalImagePurpose,
  onUploaded: (fileId: string) => void,
) => (e: ChangeEvent<HTMLInputElement>) => void;

interface SettingsGeneralSectionProps {
  draft: SectionDraft<ProfileForm>;
  profile: HospitalProfile;
  mayEdit: boolean;
  /** Local previews of images uploaded in this visit, by file id. */
  previews: Readonly<Record<string, string>>;
  uploading: boolean;
  pickImage: PickImage;
}

interface ImagePickerProps {
  label: string;
  hint: string;
  purpose: HospitalImagePurpose;
  fileId: string | null;
  preview: string | undefined;
  disabled: boolean;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
}

/** One stored hospital image with its own Change button. */
function ImagePicker({
  label,
  hint,
  purpose,
  fileId,
  preview,
  disabled,
  onPick,
}: ImagePickerProps) {
  const signed = useHospitalImageUrlQuery(fileId && !preview ? fileId : null);
  const src = fileId ? (preview ?? signed.data ?? null) : null;
  return (
    <div className="flex items-center gap-4">
      <div className="bg-blue-soft-bg flex size-18 flex-none items-center justify-center overflow-hidden rounded-lg">
        {src ? (
          <img src={src} className="h-full w-full object-cover" alt="" />
        ) : purpose === 'logo' ? (
          <img src={DEFAULT_LOGO_SRC} className="size-12" alt="" />
        ) : (
          <Icon name="image" size={24} className="text-text-muted" />
        )}
      </div>
      <div>
        <div className="text-body text-text-strong font-medium">{label}</div>
        <div className="text-caption text-text-muted mb-1.5">{hint}</div>
        <label className={cn('inline-block', disabled ? 'cursor-not-allowed opacity-50' : '')}>
          <input
            type="file"
            accept={acceptFor(purpose)}
            className="hidden"
            disabled={disabled}
            onChange={onPick}
          />
          <span
            className={cn(
              'text-body border-text-navy text-text-navy inline-flex items-center gap-2 rounded-lg border bg-white px-3.5 py-1.5 font-medium',
              disabled ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
          >
            <Icon name="upload" size={15} /> {fileId ? 'Change' : 'Upload'}
          </span>
        </label>
      </div>
    </div>
  );
}

/**
 * Settings › General — the hospital's profile as patients and receipts see
 * it: identity, contact, the full structured address (lines 1–3, city,
 * state, PIN — CLAUDE.md §7), typed coordinates and the images. There is no
 * clickable map: it used to write Bengaluru coordinates for any hospital
 * (UAT-28), so a location is only what the admin types, checked on a real map.
 */
export function SettingsGeneralSection({
  draft,
  profile,
  mayEdit,
  previews,
  uploading,
  pickImage,
}: SettingsGeneralSectionProps) {
  const { value, set, errors } = draft;
  const hasCoords = value.lat.trim() !== '' && value.lng.trim() !== '';
  const mapHref = hasCoords
    ? `${MAP_SEARCH_URL}?mlat=${encodeURIComponent(value.lat.trim())}&mlon=${encodeURIComponent(value.lng.trim())}#map=${MAP_ZOOM}/${encodeURIComponent(value.lat.trim())}/${encodeURIComponent(value.lng.trim())}`
    : null;
  const text = (
    key: keyof ProfileForm,
    label: string,
    extra: Partial<{
      required: boolean;
      hint: string;
      inputMode: 'tel' | 'email' | 'numeric' | 'decimal' | 'url';
      autoComplete: string;
      className: string;
    }> = {},
  ) => (
    <Field
      label={label}
      required={extra.required}
      error={errors[key]}
      hint={extra.hint}
      className={extra.className}
    >
      <TextInput
        value={String(value[key] ?? '')}
        onChange={(v) => set(key, v)}
        inputMode={extra.inputMode}
        autoComplete={extra.autoComplete}
        disabled={!mayEdit}
      />
    </Field>
  );

  return (
    <>
      <Card pad={28}>
        <SettingsHead info="Your name and details appear on the hospital's page in the Medibook patient app and on every receipt.">
          Hospital Profile
        </SettingsHead>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5.5 md:grid-cols-2">
          {text('name', 'Hospital Name', { required: true })}
          {text('legalName', 'Legal Name', { hint: 'The registered company name, if it differs.' })}
          {text('phone', 'Phone', { required: true, inputMode: 'tel', autoComplete: 'tel' })}
          {text('email', 'Email', { required: true, inputMode: 'email', autoComplete: 'email' })}
          {text('website', 'Website', {
            inputMode: 'url',
            hint: 'Optional, e.g. https://hospital.in',
          })}
          <Field
            label="Time Zone"
            hint={`All hospital dates and times use it. ${PLATFORM_MANAGED_HINT}`}
          >
            <TextInput value={profile.timezone ?? 'Not set'} disabled />
          </Field>
          <Field label="Registration No." hint={PLATFORM_MANAGED_HINT}>
            <TextInput value={profile.registrationNo ?? ''} disabled />
          </Field>
          <Field label="GSTIN" hint={`Printed on every receipt. ${PLATFORM_MANAGED_HINT}`}>
            <TextInput value={profile.gstin ?? ''} disabled />
          </Field>
        </div>
      </Card>

      <Card pad={28}>
        <SettingsHead info="Patients see this address and get directions in the Medibook app; receipts print it.">
          Address &amp; Location
        </SettingsHead>
        <div className="flex flex-col gap-4">
          {text('address1', 'Address Line 1', { required: true, autoComplete: 'address-line1' })}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {text('address2', 'Address Line 2', { autoComplete: 'address-line2' })}
            {text('address3', 'Address Line 3', { autoComplete: 'address-line3' })}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {text('city', 'City', { required: true, autoComplete: 'address-level2' })}
            {text('state', 'State', { required: true, autoComplete: 'address-level1' })}
            {text('pincode', 'PIN Code', {
              required: true,
              inputMode: 'numeric',
              autoComplete: 'postal-code',
            })}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {text('lat', 'Latitude', { inputMode: 'decimal', hint: 'e.g. 9.9312' })}
            {text('lng', 'Longitude', { inputMode: 'decimal', hint: 'e.g. 76.2673' })}
          </div>
          <div className="text-caption text-text-muted flex flex-wrap items-center gap-1.5">
            <Icon name="map-pin" size={14} /> Copy the coordinates from your map app (long-press the
            hospital&apos;s entrance).
            {mapHref ? (
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue underline"
              >
                Check this pin on a map
              </a>
            ) : (
              <span>
                Leave both empty if you are not sure — patients then get the address only.
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card pad={28}>
        <SettingsHead info="The logo and cover show on the hospital's page in the patient app; the stamp prints on receipts (Q98).">
          Images
        </SettingsHead>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <ImagePicker
            label="Logo"
            hint="PNG, JPG or WebP, up to 10MB"
            purpose="logo"
            fileId={value.logoFileId}
            preview={value.logoFileId ? previews[value.logoFileId] : undefined}
            disabled={!mayEdit || uploading}
            onPick={pickImage('logo', (id) => set('logoFileId', id))}
          />
          <ImagePicker
            label="Cover photo"
            hint="1280×720 works best"
            purpose="cover"
            fileId={value.coverFileId}
            preview={value.coverFileId ? previews[value.coverFileId] : undefined}
            disabled={!mayEdit || uploading}
            onPick={pickImage('cover', (id) => set('coverFileId', id))}
          />
          <ImagePicker
            label="Receipt stamp"
            hint="Printed on receipts"
            purpose="stamp"
            fileId={value.stampFileId}
            preview={value.stampFileId ? previews[value.stampFileId] : undefined}
            disabled={!mayEdit || uploading}
            onPick={pickImage('stamp', (id) => set('stampFileId', id))}
          />
        </div>
        {uploading && <div className="text-caption text-text-muted mt-3">Uploading…</div>}
      </Card>
    </>
  );
}
