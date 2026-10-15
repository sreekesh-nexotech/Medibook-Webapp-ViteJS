import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { UAT_ENV } from './env.ts';

/**
 * The seeded accounts (report §2.2). Read from the seed's own output
 * (`<backend>/var/seed/users.json`) when the live stack has one, else from the
 * table in the report. Every account starts with the seed password; a step
 * that changes a password records it here, so a later sign-in (or a re-run
 * after a failure) uses the right one until the stack is re-seeded.
 */

export type HospitalKey = 'lakeshore' | 'sahyadri' | 'nilgiri';
export type HospitalRoleCode = 'admin' | 'receptionist' | 'accountant' | 'dept_front_desk';
export type PlatformRoleCode =
  'owner' | 'ops_manager' | 'finance' | 'support' | 'compliance' | 'read_only';

export interface StaffAccount {
  readonly name: string;
  readonly email: string;
}

export interface PatientAccount {
  readonly name: string;
  readonly phone: string;
  readonly email?: string | null;
  readonly status: string;
}

interface SeedStaff {
  readonly role: string;
  readonly name: string;
  readonly email: string;
}

interface SeedHospital {
  readonly name: string;
  readonly slug: string;
  readonly staff?: readonly SeedStaff[];
}

interface SeedFile {
  readonly generated_at?: string;
  readonly platform_staff?: readonly SeedStaff[];
  readonly hospitals?: readonly SeedHospital[];
  readonly patients?: readonly PatientAccount[];
  readonly notes?: readonly string[];
}

const EMAIL_DOMAIN = 'medibook.example.com';

/** Report §2.2 — used when the seed output cannot be read. */
const FALLBACK_STAFF: Readonly<Record<HospitalKey, Readonly<Record<HospitalRoleCode, string[]>>>> =
  {
    lakeshore: {
      admin: ['Anita Menon'],
      receptionist: ['Vineeth Kumar', 'Shalini Thomas'],
      accountant: ['Joseph Kurian'],
      dept_front_desk: ['Nimmy George'],
    },
    sahyadri: {
      admin: ['Rahul Kulkarni'],
      receptionist: ['Sneha Joshi'],
      accountant: ['Amit Deshmukh'],
      dept_front_desk: ['Pooja Shinde', 'Kiran Patil'],
    },
    nilgiri: {
      admin: ['Karthik Raman'],
      receptionist: ['Divya Murugan'],
      accountant: ['Ganesh Iyengar'],
      dept_front_desk: ['Revathi Subbu'],
    },
  };

const FALLBACK_PLATFORM: Readonly<Record<PlatformRoleCode, string>> = {
  owner: 'Kavya Iyer',
  ops_manager: 'Rohan Mehta',
  finance: 'Farah Khan',
  support: 'Deepak Nair',
  compliance: 'Lakshmi Venkat',
  read_only: 'Arjun Bhat',
};

const FALLBACK_PATIENTS: readonly PatientAccount[] = [
  { name: 'Asha Rao', phone: '+919808659500', status: 'active' },
  { name: 'Vivek Menon', phone: '+919808667419', status: 'active' },
  { name: 'Priya Nair', phone: '+919808675338', status: 'active' },
  { name: 'Sanjay Varma', phone: '+919808683257', status: 'active' },
];

const FALLBACK_HOSPITAL_NAMES: readonly string[] = [
  'Lakeshore Multispeciality Hospital',
  'Sahyadri City Hospital',
  'Nilgiri Family Clinic',
  'Deccan Heart Institute',
];

const HOSPITAL_SLUG_PREFIX: Readonly<Record<HospitalKey, string>> = {
  lakeshore: 'lakeshore',
  sahyadri: 'sahyadri',
  nilgiri: 'nilgiri',
};

function emailOf(name: string, domain: string): string {
  return `${name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim()
    .replace(/\s+/g, '.')}@${domain}`;
}

function readSeed(): SeedFile | null {
  const file = path.join(UAT_ENV.backendDir, 'var', 'seed', 'users.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as SeedFile;
  } catch {
    // A half-written seed file: fall back to the report's table.
    return null;
  }
}

const seed = readSeed();

/** Identifies one seeding of the stack (passwords reset when it changes). */
export const SEED_STAMP = seed?.generated_at ?? 'report-table';

/** The seeded staff member holding `role` at `hospital` (`index` for a second one). */
export function hospitalStaff(
  hospital: HospitalKey,
  role: HospitalRoleCode,
  index = 0,
): StaffAccount {
  const fromSeed = seed?.hospitals
    ?.find((h) => h.slug.startsWith(HOSPITAL_SLUG_PREFIX[hospital]))
    ?.staff?.filter((s) => s.role === role);
  const found = fromSeed?.[index];
  if (found) return { name: found.name, email: found.email };
  const name = FALLBACK_STAFF[hospital][role][index];
  if (!name) throw new Error(`No seeded ${role} #${index} at ${hospital}.`);
  return { name, email: emailOf(name, `${hospital}.${EMAIL_DOMAIN}`) };
}

/** The seeded platform staff member holding `role`. */
export function platformStaff(role: PlatformRoleCode): StaffAccount {
  const found = seed?.platform_staff?.find((s) => s.role === role);
  if (found) return { name: found.name, email: found.email };
  const name = FALLBACK_PLATFORM[role];
  return { name, email: emailOf(name, EMAIL_DOMAIN) };
}

/** The seeded hospitals' names, e.g. to check a filtered export holds no other hospital. */
export function seededHospitalNames(): readonly string[] {
  return seed?.hospitals?.map((h) => h.name) ?? FALLBACK_HOSPITAL_NAMES;
}

/** The seeded name of `hospital` (e.g. "Lakeshore Multispeciality Hospital"). */
export function hospitalName(hospital: HospitalKey): string {
  const prefix = HOSPITAL_SLUG_PREFIX[hospital];
  const found = seed?.hospitals?.find((h) => h.slug.startsWith(prefix))?.name;
  return found ?? FALLBACK_HOSPITAL_NAMES.find((n) => n.toLowerCase().startsWith(prefix)) ?? prefix;
}

/**
 * Seeded patient accounts that can book: active, and not the one the seed
 * left in its deletion cooling-off (signing in would cancel that).
 */
export function bookingPatients(): readonly PatientAccount[] {
  const leaving = (seed?.notes ?? []).join(' ');
  const all = seed?.patients ?? FALLBACK_PATIENTS;
  return all.filter((p) => p.status === 'active' && !leaving.includes(p.name));
}

/* ------------------------------------------------------------ passwords */

const PASSWORD_FILE = () => path.join(UAT_ENV.stateDir, 'passwords.json');

interface PasswordState {
  readonly seed: string;
  readonly passwords: Record<string, string>;
}

function readPasswords(): PasswordState {
  try {
    const state = JSON.parse(readFileSync(PASSWORD_FILE(), 'utf-8')) as PasswordState;
    if (state.seed === SEED_STAMP) return state;
  } catch {
    // No state yet (first run) or an unreadable file: start from the seed.
  }
  return { seed: SEED_STAMP, passwords: {} };
}

/** The password an account has now. */
export function passwordOf(email: string): string {
  return readPasswords().passwords[email.toLowerCase()] ?? UAT_ENV.seedPassword;
}

/** Record that a step changed an account's password. */
export function rememberPassword(email: string, password: string): void {
  const state = readPasswords();
  const passwords = { ...state.passwords, [email.toLowerCase()]: password };
  mkdirSync(UAT_ENV.stateDir, { recursive: true });
  writeFileSync(PASSWORD_FILE(), JSON.stringify({ seed: SEED_STAMP, passwords }, null, 2));
}
