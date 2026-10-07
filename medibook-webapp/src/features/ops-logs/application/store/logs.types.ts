/**
 * Compliance-log display vocabulary: the filter choices the screen offers.
 * Values are the backend's codes (`audit_log.principal`, B6 `module` and
 * `severity`); labels are presentation's concern.
 */
import type { AuditPrincipal, LogSeverity } from '@/features/ops-logs/domain/entities/logs.types';

export type { LogSeverity };

/** Every principal the trail records, in the order the filter lists them. */
export const AUDIT_PRINCIPALS: readonly AuditPrincipal[] = [
  'platform',
  'hospital',
  'patient',
  'display',
  'system',
];

/** Severities the backend records (B6). */
export const LOG_SEVERITIES: readonly LogSeverity[] = ['info', 'warning', 'critical'];
