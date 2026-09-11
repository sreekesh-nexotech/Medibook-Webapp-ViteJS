import { useState } from 'react';

import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { downloadCsv } from '@/shared/lib/download';
import { Card } from '@/shared/ui/Card';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SegTabs } from '@/shared/ui/SegTabs';
import { toast } from '@/shared/ui/toast/toast.store';

import { useHospitalsStore } from '@/features/ops-hospitals/application/store/hospitals.store';
import { usePlatformUsersStore } from '@/features/ops-platform-users/application/store/platformUsers.store';

import {
  buildExportRows,
  EXPORT_COLUMNS,
  SUBJECT_PREFIX,
} from '@/features/ops-compliance/application/store/compliance.export';
import {
  OPS_ACTING_USER_EMAIL,
  useComplianceStore,
} from '@/features/ops-compliance/application/store/compliance.store';
import { ConfigChangesCard } from '@/features/ops-compliance/presentation/components/ConfigChangesCard';
import type {
  ExportFormValue,
  ExportSubjectOption,
} from '@/features/ops-compliance/presentation/components/ExportRequestForm';
import { ExportRequestForm } from '@/features/ops-compliance/presentation/components/ExportRequestForm';
import { ExportRequestsCard } from '@/features/ops-compliance/presentation/components/ExportRequestsCard';
import { LoginHistoryCard } from '@/features/ops-compliance/presentation/components/LoginHistoryCard';

type ComplianceTab = 'Staff Logins' | 'Configuration Changes' | 'Export on Request';

const TABS: readonly ComplianceTab[] = [
  'Staff Logins',
  'Configuration Changes',
  'Export on Request',
];

/**
 * How long the re-derive keeps the Refresh control spinning. The seed store
 * answers instantly — same fake-latency convention as `useOpsAct`.
 */
const REFRESH_SETTLE_MS = 420;

/**
 * Compliance (audit 2.5 / SA-06) — the three records that had no screen:
 * staff login history, configuration-change detail with before → after
 * values, and export on request.
 *
 * Table and filter treatment is deliberately identical to `OpsLogsScreen`, so
 * the log screens read as one product.
 */
export function OpsComplianceScreen() {
  const logins = useComplianceStore((s) => s.logins);
  const changes = useComplianceStore((s) => s.changes);
  const requests = useComplianceStore((s) => s.requests);
  const refreshCompliance = useComplianceStore((s) => s.refresh);
  const openExport = useComplianceStore((s) => s.openExport);
  const settleExport = useComplianceStore((s) => s.settleExport);
  const hospitals = useHospitalsStore((s) => s.hospitals);
  const patients = usePlatformUsersStore((s) => s.users);

  const [tab, setTab] = useState<ComplianceTab>('Staff Logins');
  const [busy, run] = useOpsAct();

  /**
   * Subjects come from live data — the hospital registry, the accounts that
   * actually appear in the login history, and the patient roster — so nothing
   * can be requested that this console cannot produce records for.
   */
  const subjects: readonly ExportSubjectOption[] = [
    ...hospitals.map((h): ExportSubjectOption => ({
      kind: 'Hospital',
      key: `${SUBJECT_PREFIX.hospital}${h.id}`,
      label: h.name,
    })),
    ...[...new Set(logins.map((l) => l.user))].sort().map((email): ExportSubjectOption => ({
      kind: 'Staff user',
      key: `${SUBJECT_PREFIX.staff}${email}`,
      label: email,
    })),
    ...patients.map((p): ExportSubjectOption => ({
      kind: 'Patient reference',
      key: `${SUBJECT_PREFIX.patient}${p.email}`,
      label: `${p.name} · ${p.email}`,
    })),
  ];

  const handleRefresh = async (): Promise<void> => {
    refreshCompliance();
    await new Promise<void>((resolve) => setTimeout(resolve, REFRESH_SETTLE_MS));
  };

  /**
   * THE LAW. The request is filed first with status `Preparing`; the rows are
   * gathered; and only if there are any is a file written and the request
   * closed as `Completed`. An empty result closes as `No data` with an
   * explicit, non-celebratory message — no file, no success claim.
   */
  const handleExport = (value: ExportFormValue): void => {
    const id = openExport({ ...value, requestedBy: OPS_ACTING_USER_EMAIL });
    run('export', null, () => {
      const rows = buildExportRows({ ...value }, { logins, changes, patients });
      if (rows.length === 0) {
        settleExport(id, { status: 'No data', rows: 0, file: null });
        toast(
          `${id}: no records held for ${value.subject} in that date range — nothing was exported.`,
          'info',
        );
        return;
      }
      const file = `medibook-export-${id.toLowerCase()}.csv`;
      downloadCsv(file, [EXPORT_COLUMNS, ...rows]);
      settleExport(id, { status: 'Completed', rows: rows.length, file });
      toast(`${id}: exported ${rows.length} records for ${value.subject}.`, 'success');
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs
          tabs={TABS}
          value={tab}
          onChange={(t) => {
            const next = TABS.find((x) => x === t);
            if (next) setTab(next);
          }}
        />
        <div className="flex-1"></div>
        <span className="text-caption text-text-muted tabular-nums">
          {logins.length} sign-ins · {changes.length} changes · {requests.length} exports
        </span>
        <RefreshBtn onRefresh={handleRefresh} title="Refresh compliance records" />
      </Card>

      {tab === 'Staff Logins' && <LoginHistoryCard logins={logins} />}
      {tab === 'Configuration Changes' && <ConfigChangesCard changes={changes} />}
      {tab === 'Export on Request' && (
        <>
          <ExportRequestForm
            subjects={subjects}
            busy={Boolean(busy.export)}
            onSubmit={handleExport}
          />
          <ExportRequestsCard requests={requests} />
        </>
      )}
    </div>
  );
}
