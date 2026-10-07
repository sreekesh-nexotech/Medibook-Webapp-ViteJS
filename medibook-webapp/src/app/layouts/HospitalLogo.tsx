import { useState } from 'react';

import { usePermission } from '@/shared/hooks/usePermission';

import { useHospitalImageUrlQuery } from '@/features/settings/application/queries/useHospitalImageUrlQuery';
import { useHospitalProfileQuery } from '@/features/settings/application/queries/useHospitalProfileQuery';

/** The Medibook mark, shown until (or unless) the hospital's own logo loads. */
const MEDIBOOK_MARK = '/brand/medibook-mark.svg';

/**
 * The hospital's uploaded logo in the shell (PRD-02), falling back to the
 * Medibook mark. Only roles that can read the hospital profile can find the
 * logo; the rest see the mark until `/hospital/me` carries it (PRD-02-B).
 */
export function HospitalLogo({ className }: { className: string }) {
  const { can } = usePermission();
  const profile = useHospitalProfileQuery(can('Hospital Settings.view'));
  const logo = useHospitalImageUrlQuery(profile.data?.logoFileId ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  const src = logo.data && logo.data !== failed ? logo.data : MEDIBOOK_MARK;
  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => {
        if (src !== MEDIBOOK_MARK) setFailed(src);
      }}
    />
  );
}
