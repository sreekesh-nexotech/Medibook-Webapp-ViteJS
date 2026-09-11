/**
 * Seed hospital audit trail — 48 entries across nine days and five actors, so
 * every filter in the trail toolbar (date range, actor, action, entity, plus
 * search) has something to bite on. Dates are relative to the demo clock
 * (`DEMO_TODAY_ISO`), assembled through `shiftIsoDays` so they stay on the
 * local calendar.
 *
 * Entity ids join with the rest of the demo world: `AP10xx` appointments,
 * `MB/R/2026-27/000xxx` receipts, `MB-ST-24xx` settlements, `T-0xx` tokens.
 */

import { DEMO_TODAY_ISO } from '@/core/config/demo';

import { shiftIsoDays } from './audit.clock';
import type { AuditAction, AuditEntity, AuditEntry, AuditSeverity } from './audit.types';

/** One staff actor: display name, role label, IP and client device. */
interface AuditActorSeed {
  readonly name: string;
  readonly role: string;
  readonly ip: string;
  readonly device: string;
}

/** The five actors the seed trail is written by, keyed by a short code. */
const ACTORS: Readonly<Record<string, AuditActorSeed>> = {
  nair: {
    name: 'Dr. S. Nair',
    role: 'Administrator',
    ip: '192.168.1.14',
    device: 'Chrome 141 · Admin desktop',
  },
  riya: {
    name: 'Riya Menon',
    role: 'Receptionist',
    ip: '192.168.1.22',
    device: 'Chrome 141 · Front desk PC',
  },
  karthik: {
    name: 'Karthik Rao',
    role: 'Accountant',
    ip: '192.168.1.31',
    device: 'Edge 141 · Accounts PC',
  },
  anita: {
    name: 'Anita Desai',
    role: 'Administrator',
    ip: '203.0.113.42',
    device: 'Safari 18 · iPad (remote)',
  },
  system: {
    name: 'Medibook system',
    role: 'Automation',
    ip: '10.0.0.4',
    device: 'Scheduled job',
  },
};

/** Every actor name the trail's actor filter offers, in display order. */
export const AUDIT_ACTORS: readonly string[] = Object.values(ACTORS).map((a) => a.name);

/**
 * Seed row: days-ago, time, actor code, action, entity, entity id, summary,
 * before, after, severity.
 */
type AuditSeedRow = readonly [
  number,
  string,
  keyof typeof ACTORS | string,
  AuditAction,
  AuditEntity,
  string,
  string,
  string | null,
  string | null,
  AuditSeverity,
];

const SEED_ROWS: readonly AuditSeedRow[] = [
  [0, '09:04', 'riya', 'Login', 'Session', 'sess-8841', 'Signed in', null, 'Front desk', 'Info'],
  [0, '09:07', 'riya', 'Create', 'Appointment', 'AP1012', 'Walk-in appointment booked', null, 'Dr. Anil Kumar · 09:30 am', 'Info'], // prettier-ignore
  [0, '09:12', 'riya', 'Payment', 'Payment', 'MB/R/2026-27/000131', 'Consultation fee collected', 'Pending', 'Paid ₹ 500 · Cash', 'Info'], // prettier-ignore
  [0, '09:13', 'riya', 'Create', 'Token', 'T-008', 'Token issued', null, 'T-008 · Dr. Anil Kumar', 'Info'], // prettier-ignore
  [0, '09:41', 'nair', 'Login', 'Session', 'sess-8843', 'Signed in', null, 'Admin desktop', 'Info'],
  [0, '09:58', 'nair', 'Update', 'Settings', 'rules.cancelBefore', 'Cancellation cut-off changed', '2 hours', '4 hours', 'Warning'], // prettier-ignore
  [0, '10:03', 'nair', 'Update', 'Settings', 'rules.duration', 'Default consultation duration changed', '20 mins', '15 mins', 'Warning'], // prettier-ignore
  [0, '10:22', 'riya', 'Update', 'Appointment', 'AP1004', 'Appointment rescheduled', '13 Jun · 11:00 am', '14 Jun · 10:30 am', 'Info'], // prettier-ignore
  [0, '10:47', 'karthik', 'Login', 'Session', 'sess-8845', 'Signed in', null, 'Accounts PC', 'Info'], // prettier-ignore
  [0, '11:05', 'karthik', 'Export', 'Report', 'payment', 'Payment report exported as CSV', null, '184 rows · 01–13 Jun', 'Warning'], // prettier-ignore
  [0, '11:36', 'riya', 'Cancel', 'Appointment', 'AP1007', 'Appointment cancelled at the desk', 'Scheduled', 'Cancelled · patient request', 'Warning'], // prettier-ignore
  [0, '11:38', 'karthik', 'Refund', 'Payment', 'MB/R/2026-27/000124', 'Refund recorded against a cancellation', 'Paid ₹ 800', 'Refunded ₹ 600', 'Critical'], // prettier-ignore
  [0, '12:14', 'nair', 'Create', 'Service', 'svc-9', 'Service added to the catalogue', null, 'Tread Mill Test · ₹ 1,800', 'Info'], // prettier-ignore
  [0, '12:31', 'nair', 'Update', 'Coupon', 'cpn-2', 'Coupon usage cap raised', '100 uses', '250 uses', 'Info'], // prettier-ignore
  [-1, '08:52', 'riya', 'Login', 'Session', 'sess-8802', 'Signed in', null, 'Front desk', 'Info'],
  [-1, '09:19', 'riya', 'Create', 'Patient', 'AP847219', 'Patient registered', null, 'Nisha Varma · 9845012233', 'Info'], // prettier-ignore
  [-1, '09:44', 'riya', 'Payment', 'Payment', 'MB/R/2026-27/000129', 'Consultation fee collected', 'Pending', 'Paid ₹ 800 · UPI', 'Info'], // prettier-ignore
  [-1, '10:28', 'nair', 'Update', 'Doctor', 'dc2', "Doctor's weekly hours changed", 'Mon–Sat · 9am–6pm', 'Mon–Fri · 9am–5pm', 'Info'], // prettier-ignore
  [-1, '11:02', 'nair', 'Create', 'Holiday', 'hol-4', 'Holiday added to the calendar', null, 'Bakrid · 17 Jun · whole hospital', 'Warning'], // prettier-ignore
  [-1, '11:47', 'anita', 'Login', 'Session', 'sess-8807', 'Signed in from a new device', null, 'iPad · 203.0.113.42', 'Warning'], // prettier-ignore
  [-1, '12:06', 'anita', 'Update', 'Banner', 'ban-2', 'Patient-app banner scheduled', 'Draft', 'Live 20 Jun – 05 Jul', 'Info'], // prettier-ignore
  [-1, '14:33', 'riya', 'Update', 'Token', 'T-005', 'Token skipped to the back of the queue', 'Position 3', 'Position 7', 'Info'], // prettier-ignore
  [-1, '15:21', 'karthik', 'Update', 'Payment', 'MB/R/2026-27/000118', 'Payment mode corrected', 'Cash', 'UPI · ref 4471', 'Warning'], // prettier-ignore
  [-1, '17:02', 'system', 'Update', 'Appointment', 'AP1009', 'Marked No-show automatically after grace', 'In Queue', 'No-show', 'Info'], // prettier-ignore
  [-2, '09:02', 'riya', 'Login', 'Session', 'sess-8771', 'Signed in', null, 'Front desk', 'Info'],
  [-2, '09:35', 'nair', 'Create', 'Branch', 'br-3', 'Branch added', null, 'Whitefield Annexe · Bengaluru', 'Warning'], // prettier-ignore
  [-2, '10:11', 'nair', 'Update', 'Tax', 'tax-1', 'GST rate confirmed for the new financial year', '18% exclusive', '18% exclusive', 'Info'], // prettier-ignore
  [-2, '10:58', 'karthik', 'Export', 'Report', 'settlement', 'Settlement report exported as CSV', null, '12 rows · Apr–Jun', 'Warning'], // prettier-ignore
  [-2, '11:39', 'riya', 'Create', 'Appointment', 'AP1010', 'Online appointment confirmed at the desk', 'Scheduled', 'In Queue · T-006', 'Info'], // prettier-ignore
  [-2, '13:05', 'anita', 'Permission', 'Role', 'r-reception', 'Receptionist role permissions changed', 'Reports: view', 'Reports: none', 'Critical'], // prettier-ignore
  [-2, '13:22', 'anita', 'Create', 'User', 'u-7', 'Staff user invited', null, 'meena.k@apollo.med · Receptionist', 'Warning'], // prettier-ignore
  [-2, '16:44', 'system', 'Update', 'Payment', 'MB-ST-2405', 'Settlement statement marked overdue', 'Pending', 'Overdue', 'Warning'], // prettier-ignore
  [-3, '08:47', 'riya', 'Login', 'Session', 'sess-8740', 'Signed in', null, 'Front desk', 'Info'],
  [-3, '09:26', 'riya', 'Payment', 'Payment', 'MB/R/2026-27/000112', 'Consultation fee collected', 'Pending', 'Paid ₹ 650 · Card', 'Info'], // prettier-ignore
  [-3, '10:04', 'nair', 'Update', 'Department', 'dp3', 'Department base fee changed', '₹ 900', '₹ 1,000', 'Warning'], // prettier-ignore
  [-3, '10:52', 'nair', 'Create', 'Template', 'tpl-reminder-sms', 'Reminder SMS template edited', 'Hi {{patientName}}…', 'Hi {{patientName}}, your visit is at {{time}}…', 'Info'], // prettier-ignore
  [-3, '11:30', 'riya', 'Create', 'Announcement', 'ann-3', 'Announcement queued to all patients', null, 'OPD closed on 17 Jun', 'Warning'], // prettier-ignore
  [-3, '15:12', 'karthik', 'Update', 'Payment', 'MB/R/2026-27/000108', 'Receipt reprinted', null, 'Reprint #2', 'Info'], // prettier-ignore
  [-4, '09:10', 'riya', 'Login', 'Session', 'sess-8702', 'Signed in', null, 'Front desk', 'Info'],
  [-4, '09:48', 'riya', 'Delete', 'Appointment', 'AP0998', 'Duplicate appointment removed', 'Scheduled · Dr. Maya Suresh', null, 'Critical'], // prettier-ignore
  [-4, '11:14', 'nair', 'Update', 'Settings', 'rules.holdTimeout', 'Slot hold timeout changed', '15 mins', '30 mins', 'Warning'], // prettier-ignore
  [-4, '12:40', 'karthik', 'Payment', 'Payment', 'MB/R/2026-27/000101', 'Bulk desk collection recorded', 'Pending ×3', 'Paid ₹ 2,100 · Cash', 'Info'], // prettier-ignore
  [-5, '09:33', 'anita', 'Login', 'Session', 'sess-8664', 'Signed in', null, 'iPad (remote)', 'Info'], // prettier-ignore
  [-5, '10:07', 'anita', 'Update', 'Service', 'svc-4', 'Service price changed', '₹ 1,200', '₹ 1,350', 'Warning'], // prettier-ignore
  [-5, '10:58', 'anita', 'Delete', 'Coupon', 'cpn-5', 'Expired coupon removed', 'MONSOON15 · 15% off', null, 'Warning'], // prettier-ignore
  [-6, '09:21', 'riya', 'Create', 'Patient', 'AP847205', 'Patient registered', null, 'Vivek Menon · 9812345670', 'Info'], // prettier-ignore
  [-6, '14:02', 'system', 'Export', 'Report', 'appointment', 'Nightly appointment extract generated', null, '1,996 rows', 'Info'], // prettier-ignore
  [-7, '09:15', 'nair', 'Update', 'Settings', 'rules.opFee', 'Default OP consultation fee changed', '₹ 450', '₹ 500', 'Warning'], // prettier-ignore
  [-8, '18:30', 'system', 'Update', 'Session', 'sess-8590', 'Idle session signed out automatically', 'Active', 'Signed out', 'Info'], // prettier-ignore
];

/** The seeded trail, newest first. */
export const SEED_AUDIT_ENTRIES: readonly AuditEntry[] = SEED_ROWS.map((row, i) => {
  const [daysAgo, time, actorKey, action, entity, entityId, summary, before, after, sev] = row;
  const actor = ACTORS[actorKey] ?? ACTORS.system;
  return {
    id: `au-${String(SEED_ROWS.length - i).padStart(3, '0')}`,
    date: shiftIsoDays(DEMO_TODAY_ISO, daysAgo),
    time,
    actor: actor.name,
    actorRole: actor.role,
    action,
    summary,
    entity,
    entityId,
    before,
    after,
    ip: actor.ip,
    device: actor.device,
    sev,
  };
});
