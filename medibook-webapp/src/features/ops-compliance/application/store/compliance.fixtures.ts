/**
 * Seeds for the compliance screen (audit 2.5 / SA-06).
 *
 * Login history is built from a small actor table plus one tuple per attempt,
 * so ~50 attempts across eight days stay readable and the filters have real
 * variety to bite on — several users, both consoles, three outcomes and a run
 * of failures that ends in a lock-out.
 *
 * Hospitals are referenced by tenant id (`hid`), never by name, so every
 * display name resolves through the live ops registry.
 */
import type { ConfigChange, ExportRequest, LoginResult, StaffLogin } from './compliance.types';

/** Someone who signs in, and what they sign in from. */
interface LoginActor {
  readonly user: string;
  readonly name: string;
  readonly role: string;
  /** Tenant id, or null for the operations console. */
  readonly hid: number | null;
  readonly ip: string;
  readonly device: string;
}

const ACTORS: readonly LoginActor[] = [
  {
    user: 'riya.sharma@medibook.in',
    name: 'Riya Sharma',
    role: 'Super Admin',
    hid: null,
    ip: '10.42.8.11',
    device: 'Chrome 126 · Windows 11',
  },
  {
    user: 'anil.kapoor@medibook.in',
    name: 'Anil Kapoor',
    role: 'Super Admin',
    hid: null,
    ip: '10.42.8.14',
    device: 'Safari 18 · macOS 15',
  },
  {
    user: 'meera.pillai@medibook.in',
    name: 'Meera Pillai',
    role: 'Finance Admin',
    hid: null,
    ip: '10.42.8.19',
    device: 'Chrome 126 · macOS 15',
  },
  {
    user: 'kavya.reddy@medibook.in',
    name: 'Kavya Reddy',
    role: 'Support',
    hid: null,
    ip: '10.42.8.26',
    device: 'Edge 126 · Windows 11',
  },
  {
    user: 'dinesh.rao@medibook.in',
    name: 'Dinesh Rao',
    role: 'Auditor',
    hid: null,
    ip: '10.42.8.31',
    device: 'Firefox 129 · Ubuntu 24.04',
  },
  {
    user: 'admin@sunrisemsp.in',
    name: 'Sunrise Admin',
    role: 'Hospital Admin',
    hid: 1,
    ip: '49.36.180.22',
    device: 'Chrome 125 · Windows 10',
  },
  {
    user: 'reception@sunrisemsp.in',
    name: 'Sunrise Reception',
    role: 'Receptionist',
    hid: 1,
    ip: '49.36.180.23',
    device: 'Chrome 125 · Windows 10',
  },
  {
    user: 'ops@lotusheart.in',
    name: 'Lotus Heart Ops',
    role: 'Hospital Admin',
    hid: 2,
    ip: '103.21.58.90',
    device: 'Chrome 126 · Android 15',
  },
  {
    user: 'admin@apollohospital.in',
    name: 'Apollo Admin',
    role: 'Hospital Admin',
    hid: 13,
    ip: '122.170.14.6',
    device: 'Chrome 126 · Windows 11',
  },
  {
    user: 'reception@apollohospital.in',
    name: 'Apollo Reception',
    role: 'Receptionist',
    hid: 13,
    ip: '122.170.14.9',
    device: 'Chrome 126 · Windows 11',
  },
  {
    user: 'admin@meridiancity.in',
    name: 'Meridian Admin',
    role: 'Hospital Admin',
    hid: 6,
    ip: '106.51.72.44',
    device: 'Safari 17 · iPadOS 18',
  },
  {
    user: 'unknown@23.94.61.2',
    name: 'Unrecognised device',
    role: '—',
    hid: null,
    ip: '23.94.61.2',
    device: 'Unknown client · scripted',
  },
];

/** `[ISO date, HH:mm, actor index, result, reason?]` — one sign-in attempt. */
type LoginTuple = readonly [string, string, number, LoginResult, string?];

const LOGIN_EVENTS: readonly LoginTuple[] = [
  ['2026-06-13', '09:41', 0, 'Success'],
  ['2026-06-13', '09:12', 9, 'Success'],
  ['2026-06-13', '08:58', 8, 'Success'],
  ['2026-06-13', '08:47', 6, 'Success'],
  ['2026-06-13', '08:30', 3, 'Failed', 'Wrong password'],
  ['2026-06-13', '08:31', 3, 'Success'],
  ['2026-06-13', '08:05', 5, 'Success'],
  ['2026-06-12', '19:22', 2, 'Success'],
  ['2026-06-12', '17:48', 1, 'Success'],
  ['2026-06-12', '16:10', 10, 'Success'],
  ['2026-06-12', '15:26', 4, 'Success'],
  ['2026-06-12', '11:14', 11, 'Failed', 'Unknown user'],
  ['2026-06-12', '11:16', 11, 'Failed', 'Unknown user'],
  ['2026-06-12', '11:18', 11, 'Locked out', '3 failed attempts from one IP'],
  ['2026-06-12', '09:33', 0, 'Success'],
  ['2026-06-12', '09:02', 7, 'Success'],
  ['2026-06-12', '08:51', 9, 'Success'],
  ['2026-06-11', '18:40', 2, 'Success'],
  ['2026-06-11', '16:44', 2, 'Success'],
  ['2026-06-11', '14:19', 8, 'Failed', 'OTP expired'],
  ['2026-06-11', '14:21', 8, 'Success'],
  ['2026-06-11', '12:01', 1, 'Success'],
  ['2026-06-11', '10:36', 6, 'Success'],
  ['2026-06-11', '09:28', 0, 'Success'],
  ['2026-06-11', '08:44', 5, 'Success'],
  ['2026-06-10', '21:05', 4, 'Success'],
  ['2026-06-10', '18:18', 3, 'Success'],
  ['2026-06-10', '15:52', 10, 'Success'],
  ['2026-06-10', '13:07', 7, 'Failed', 'Wrong password'],
  ['2026-06-10', '13:09', 7, 'Failed', 'Wrong password'],
  ['2026-06-10', '13:12', 7, 'Success'],
  ['2026-06-10', '09:31', 0, 'Success'],
  ['2026-06-10', '08:22', 9, 'Success'],
  ['2026-06-09', '17:36', 2, 'Success'],
  ['2026-06-09', '14:03', 1, 'Success'],
  ['2026-06-09', '10:41', 0, 'Success'],
  ['2026-06-09', '10:12', 5, 'Success'],
  ['2026-06-09', '09:47', 8, 'Success'],
  ['2026-06-09', '08:38', 6, 'Success'],
  ['2026-06-08', '20:14', 11, 'Failed', '2FA challenge not answered'],
  ['2026-06-08', '16:29', 4, 'Success'],
  ['2026-06-08', '13:55', 3, 'Success'],
  ['2026-06-08', '09:11', 0, 'Success'],
  ['2026-06-08', '08:49', 10, 'Success'],
  ['2026-06-07', '19:02', 1, 'Success'],
  ['2026-06-07', '15:38', 9, 'Success'],
  ['2026-06-07', '12:26', 2, 'Failed', 'Wrong password'],
  ['2026-06-07', '12:28', 2, 'Success'],
  ['2026-06-07', '09:18', 7, 'Success'],
  ['2026-06-06', '18:44', 5, 'Success'],
  ['2026-06-06', '14:52', 0, 'Success'],
  ['2026-06-06', '11:07', 6, 'Locked out', '5 failed attempts'],
  ['2026-06-06', '09:36', 8, 'Success'],
  ['2026-06-06', '08:58', 3, 'Success'],
];

export const STAFF_LOGINS: readonly StaffLogin[] = LOGIN_EVENTS.map(
  ([date, time, actorIndex, result, reason], i) => {
    const a = ACTORS[actorIndex];
    return {
      id: i + 1,
      date,
      time,
      user: a.user,
      name: a.name,
      role: a.role,
      hid: a.hid,
      ip: a.ip,
      device: a.device,
      result,
      ...(reason ? { reason } : {}),
    };
  },
);

/**
 * Configuration changes with both values. Seeded changes end at the demo
 * "today"; anything changed from Platform Settings during a session is
 * appended live by the settings store, with its real before → after pair.
 */
export const CONFIG_CHANGES: readonly ConfigChange[] = [
  {
    id: 1,
    date: '2026-06-13',
    time: '09:44',
    actor: 'riya.sharma@medibook.in',
    area: 'Hospital lifecycle',
    setting: 'Instance status',
    before: 'Active',
    after: 'Suspended',
    scope: 'Hospital',
    hid: 4,
  },
  {
    id: 2,
    date: '2026-06-12',
    time: '15:31',
    actor: 'anil.kapoor@medibook.in',
    area: 'Users & Roles',
    setting: 'Finance Admin · settlement release',
    before: 'View only',
    after: 'View and release',
    scope: 'Platform',
  },
  {
    id: 3,
    date: '2026-06-12',
    time: '10:07',
    actor: 'riya.sharma@medibook.in',
    area: 'Subscription Plans',
    setting: 'Growth · monthly price',
    before: '₹ 15,000',
    after: '₹ 18,000',
    scope: 'Platform',
  },
  {
    id: 4,
    date: '2026-06-11',
    time: '16:52',
    actor: 'meera.pillai@medibook.in',
    area: 'Platform Settings',
    setting: 'Platform commission',
    before: '12%',
    after: '10%',
    scope: 'Platform',
  },
  {
    id: 5,
    date: '2026-06-11',
    time: '11:23',
    actor: 'admin@sunrisemsp.in',
    area: 'Hospital Settings',
    setting: 'Payout bank account',
    before: 'ICICI Bank ····1188',
    after: 'ICICI Bank ····4412',
    scope: 'Hospital',
    hid: 1,
  },
  {
    id: 6,
    date: '2026-06-10',
    time: '17:41',
    actor: 'riya.sharma@medibook.in',
    area: 'Platform Settings',
    setting: 'Session timeout',
    before: '60 min',
    after: '30 min',
    scope: 'Platform',
  },
  {
    id: 7,
    date: '2026-06-10',
    time: '12:15',
    actor: 'admin@apollohospital.in',
    area: 'Services & Pricing',
    setting: 'Cardiology · consultation fee',
    before: '₹ 700',
    after: '₹ 800',
    scope: 'Hospital',
    hid: 13,
  },
  {
    id: 8,
    date: '2026-06-09',
    time: '10:40',
    actor: 'riya.sharma@medibook.in',
    area: 'Platform Settings',
    setting: 'Payments gateway API key',
    before: 'mb_live_4c81••••••••9ab2',
    after: 'mb_live_9f42••••••••7d1c',
    scope: 'Platform',
  },
  {
    id: 9,
    date: '2026-06-09',
    time: '09:05',
    actor: 'ops@lotusheart.in',
    area: 'Hospital Settings',
    setting: 'Booking window',
    before: '14 days ahead',
    after: '30 days ahead',
    scope: 'Hospital',
    hid: 2,
  },
  {
    id: 10,
    date: '2026-06-08',
    time: '09:12',
    actor: 'riya.sharma@medibook.in',
    area: 'Platform Settings',
    setting: 'Payout schedule',
    before: 'Fortnightly',
    after: 'Weekly',
    scope: 'Platform',
  },
  {
    id: 11,
    date: '2026-06-08',
    time: '08:30',
    actor: 'anil.kapoor@medibook.in',
    area: 'Platform Settings',
    setting: 'Require 2FA for all admins',
    before: 'Off',
    after: 'On',
    scope: 'Platform',
  },
  {
    id: 12,
    date: '2026-06-07',
    time: '14:26',
    actor: 'admin@meridiancity.in',
    area: 'Hospital Settings',
    setting: 'Cancellation window',
    before: '4 hours before',
    after: '2 hours before',
    scope: 'Hospital',
    hid: 6,
  },
  {
    id: 13,
    date: '2026-06-07',
    time: '11:02',
    actor: 'riya.sharma@medibook.in',
    area: 'Notifications',
    setting: 'Default app banner',
    before: 'Book in 30 seconds',
    after: 'Your health, one tap away',
    scope: 'Platform',
  },
  {
    id: 14,
    date: '2026-06-06',
    time: '16:48',
    actor: 'meera.pillai@medibook.in',
    area: 'Platform Settings',
    setting: 'GST number',
    before: '—',
    after: '27AABCM9407L1ZK',
    scope: 'Platform',
  },
];

/** Where minted export-request ids start. */
export const EXPORT_REQUEST_SERIES_YEAR = 2026;

/** Seeded export-on-request records, newest first. */
export const EXPORT_REQUESTS: readonly ExportRequest[] = [
  {
    id: 'DSR-2026-0003',
    kind: 'Patient reference',
    subject: 'Dev Trivedi · dev.trivedi@gmail.com',
    subjectKey: 'patient:dev.trivedi@gmail.com',
    from: '2026-01-01',
    to: '2026-06-11',
    requestedBy: 'anil.kapoor@medibook.in',
    requestedAt: '11 Jun 2026 · 12:03',
    status: 'Completed',
    rows: 9,
    file: 'medibook-export-dsr-2026-0003.csv',
  },
  {
    id: 'DSR-2026-0002',
    kind: 'Hospital',
    subject: 'Nirmal Ortho & Spine',
    subjectKey: 'hospital:4',
    from: '2026-05-01',
    to: '2026-06-10',
    requestedBy: 'dinesh.rao@medibook.in',
    requestedAt: '10 Jun 2026 · 15:20',
    status: 'Completed',
    rows: 24,
    file: 'medibook-export-dsr-2026-0002.csv',
  },
  {
    id: 'DSR-2026-0001',
    kind: 'Staff user',
    subject: 'reception@sunrisemsp.in',
    subjectKey: 'staff:reception@sunrisemsp.in',
    from: '2026-04-01',
    to: '2026-04-30',
    requestedBy: 'riya.sharma@medibook.in',
    requestedAt: '02 May 2026 · 10:14',
    status: 'No data',
    rows: 0,
    file: null,
  },
];
