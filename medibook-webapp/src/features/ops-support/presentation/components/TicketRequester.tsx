import { useHospitalQuery } from '@/features/ops-hospitals/application/queries/useHospitalQuery';
import type { SupportTicket } from '@/features/ops-support/domain/entities/support.entities';

/**
 * Where a ticket came from: the hospital's name (the ticket carries only its
 * id; each hospital is fetched once and shared), or the patient app.
 */
export function TicketRequester({ ticket }: { ticket: SupportTicket }) {
  if (!ticket.hospitalId) return <>Patient · Medibook app</>;
  return <HospitalName hospitalId={ticket.hospitalId} />;
}

function HospitalName({ hospitalId }: { hospitalId: string }) {
  const hospital = useHospitalQuery(hospitalId);
  if (hospital.isPending) return <span className="text-text-muted">Loading…</span>;
  return <>{hospital.data?.name ?? 'Unknown hospital'}</>;
}
