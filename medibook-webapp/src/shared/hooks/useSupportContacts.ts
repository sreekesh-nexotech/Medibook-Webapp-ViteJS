import { useAppConfigQuery } from '@/shared/hooks/useAppConfigQuery';
import { phoneDisplay } from '@/shared/lib/format';

export interface SupportContact {
  /** As shown: "+91 484 710 0000", "help@medibook.example". */
  readonly label: string;
  /** `tel:` or `mailto:` link. */
  readonly href: string;
}

export interface SupportContacts {
  readonly phone: SupportContact | null;
  readonly email: SupportContact | null;
  /** Still loading the public app config. */
  readonly isPending: boolean;
}

/**
 * Medibook's support contacts, from the platform's public app config
 * (OBS-06): the phone set in Platform Settings and, once the backend sends
 * it, the support email. Nothing is shown that the platform has not set.
 */
export function useSupportContacts(): SupportContacts {
  const config = useAppConfigQuery();
  const phone = config.data?.supportPhoneE164 ?? null;
  const email = config.data?.supportEmail ?? null;
  return {
    phone: phone ? { label: phoneDisplay(phone), href: `tel:${phone}` } : null,
    email: email ? { label: email, href: `mailto:${email}` } : null,
    isPending: config.isPending,
  };
}
