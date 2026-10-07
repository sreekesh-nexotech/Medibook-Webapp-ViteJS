import { useSupportContacts } from '@/shared/hooks/useSupportContacts';

/**
 * Why a suspended hospital cannot work, and who can lift it (D-30). The
 * contact is the platform's own, from app config (OBS-06).
 */
export function SuspendedMessage() {
  const { phone, email } = useSupportContacts();
  const link = (contact: { label: string; href: string }) => (
    <a href={contact.href} className="text-blue font-medium underline">
      {contact.label}
    </a>
  );
  return (
    <>
      This hospital&apos;s Medibook instance is suspended by operations.{' '}
      {phone ? (
        <>Call Medibook support on {link(phone)} to reactivate it.</>
      ) : email ? (
        <>Email Medibook support at {link(email)} to reactivate it.</>
      ) : (
        'Contact Medibook support to reactivate it.'
      )}
    </>
  );
}
