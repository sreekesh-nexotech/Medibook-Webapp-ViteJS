import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useResolveMapLocationMutation } from '@/shared/hooks/useResolveMapLocationMutation';
import {
  coordinatesLabel,
  googleMapsUrl,
  hasLocation,
  mapLocationError,
} from '@/shared/lib/mapLocation';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';

const PLACEHOLDER = 'Paste a Google Maps link, or type 9.9312, 76.2673';

interface MapLocationFieldProps {
  /** The location as the form holds it; `''` when there is none. */
  lat: string;
  lng: string;
  /** A new location read from what was pasted, or `('', '')` when it is removed. */
  onChange: (lat: string, lng: string) => void;
  disabled?: boolean;
  /** Control height in px, to match the form around it. */
  height?: number;
}

/**
 * The hospital's "Google Maps location" (client feedback point 3). One box takes a Google Maps
 * link — from the browser's address bar or the phone app's Share button (a short
 * `maps.app.goo.gl` link, opened by the server) — or typed coordinates. "Find" reads it into
 * latitude and longitude, shown with an "Open in Google Maps" link so the spot can be checked
 * before saving. Optional for now (client decision); there is no map picker (no Google account).
 *
 * Place it inside a `Field` / `OpsField`, which labels the box.
 */
export function MapLocationField({
  lat,
  lng,
  onChange,
  disabled = false,
  height,
}: MapLocationFieldProps) {
  const resolve = useResolveMapLocationMutation();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [outsideIndia, setOutsideIndia] = useState(false);
  const located = hasLocation(lat, lng);

  const find = () => {
    const pasted = text.trim();
    if (pasted === '' || resolve.isPending) return;
    setProblem(null);
    resolve.mutate(pasted, {
      onSuccess: (found) => {
        onChange(found.lat, found.lng);
        setOutsideIndia(!found.inIndia);
        setText('');
      },
      onError: (error) => {
        setProblem(isFailure(error) ? mapLocationError(error) : 'This location could not be read.');
      },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {disabled ? null : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <TextInput
              value={text}
              onChange={(v) => {
                setText(v);
                if (problem) setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault(); // Enter finds the location; it never submits the form
                find();
              }}
              placeholder={PLACEHOLDER}
              inputMode="url"
              autoComplete="off"
              invalid={problem !== null}
              height={height}
            />
          </div>
          <Button
            variant="secondary"
            icon="search"
            onClick={find}
            busy={resolve.isPending}
            disabled={text.trim() === ''}
            style={height ? { height } : undefined}
          >
            Find
          </Button>
        </div>
      )}
      {problem ? (
        <p role="alert" className="text-caption text-danger flex items-start gap-1.5">
          <Icon name="circle-alert" size={14} className="mt-0.5 shrink-0" />
          {problem}
        </p>
      ) : null}
      {located ? (
        <div className="text-caption flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-text-strong flex items-center gap-1.5 font-semibold">
            <Icon name="map-pin" size={14} />
            {coordinatesLabel(lat, lng)}
          </span>
          <a
            href={googleMapsUrl(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue underline"
          >
            Open in Google Maps
          </a>
          {disabled ? null : (
            <button
              type="button"
              className="text-text-muted underline"
              onClick={() => {
                onChange('', '');
                setOutsideIndia(false);
              }}
            >
              Remove
            </button>
          )}
        </div>
      ) : (
        <p className="text-caption text-text-muted">
          No location yet. Without one, patients get the address only.
        </p>
      )}
      {located && outsideIndia ? (
        <p role="status" className="text-caption text-y-800 flex items-start gap-1.5">
          <Icon name="triangle-alert" size={14} className="mt-0.5 shrink-0" />
          This spot is outside India. Check it on the map before saving.
        </p>
      ) : null}
    </div>
  );
}
