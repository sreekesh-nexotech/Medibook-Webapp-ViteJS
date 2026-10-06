import { useState } from 'react';

import { CanOps } from '@/shared/ui/CanOps';
import { Card } from '@/shared/ui/Card';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SegTabs } from '@/shared/ui/SegTabs';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useCreateComplianceDataExportMutation } from '@/features/ops-compliance/application/queries/useCreateComplianceDataExportMutation';
import { useProcessComplianceDataRequestMutation } from '@/features/ops-compliance/application/queries/useProcessComplianceDataRequestMutation';
import { useRefreshCompliance } from '@/features/ops-compliance/application/queries/useRefreshCompliance';
import type {
  DataRequest,
  DataRequestProcessOutcome,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { ConfigChangesCard } from '@/features/ops-compliance/presentation/components/ConfigChangesCard';
import {
  ExportRequestForm,
  type ExportFormValue,
} from '@/features/ops-compliance/presentation/components/ExportRequestForm';
import { ExportRequestsCard } from '@/features/ops-compliance/presentation/components/ExportRequestsCard';
import { LoginHistoryCard } from '@/features/ops-compliance/presentation/components/LoginHistoryCard';

type ComplianceTab = 'Staff Logins' | 'Configuration Changes' | 'Export on Request';

const TABS: readonly ComplianceTab[] = [
  'Staff Logins',
  'Configuration Changes',
  'Export on Request',
];

/** The toast that says exactly what processing did — never more. */
function announceOutcome(requestNo: string, outcome: DataRequestProcessOutcome): void {
  if (outcome.status === 'deferred') {
    toast(`${requestNo} is filed — the nightly run will prepare the export.`, 'info');
    return;
  }
  const { request } = outcome;
  if (request.status === 'completed' && request.exportFileId) {
    toast(`${requestNo}: export ready — download it from Recorded Requests.`, 'success');
  } else if (request.status === 'no_data') {
    toast(`${requestNo}: no records are held for this account — nothing was exported.`, 'info');
  } else {
    toast(`${requestNo} is ${request.status.replace('_', ' ')}.`, 'info');
  }
}

/**
 * Compliance (audit 2.5 / SA-06) on `/platform/compliance/*` — staff login
 * history, configuration-change detail with before → after values, and
 * data-subject export requests.
 *
 * Each card owns its own server-side query; Refresh refetches them all.
 * Table and filter treatment matches `OpsLogsScreen`, so the log screens read
 * as one product.
 */
export function OpsComplianceScreen() {
  const [tab, setTab] = useState<ComplianceTab>('Staff Logins');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const refresh = useRefreshCompliance();
  const createExport = useCreateComplianceDataExportMutation();
  const processRequest = useProcessComplianceDataRequestMutation();

  const prepare = (request: DataRequest): void => {
    setProcessingId(request.id);
    processRequest.mutate(request.id, {
      onSuccess: (outcome) => announceOutcome(request.requestNo, outcome),
      onError: (error) =>
        toast(
          `${request.requestNo} could not be prepared now: ${
            isFailure(error) ? error.message : 'please try again.'
          }`,
          'error',
        ),
      onSettled: () => setProcessingId(null),
    });
  };

  /**
   * THE LAW: the request is filed first and shows as Requested; it is then
   * prepared, and only a file the server actually wrote is reported as an
   * export. When the renderer is not available to a live request, the
   * request stays filed for the nightly run and the toast says so.
   */
  const handleExport = (value: ExportFormValue): void => {
    if (createExport.isPending || processingId) return;
    createExport.mutate(
      {
        subjectUserId: value.subjectUserId,
        subjectKind: value.subjectKind,
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess: (request) => prepare(request),
        onError: (error) =>
          toast(
            isFailure(error)
              ? error.message
              : `The export for ${value.subjectLabel} could not be filed.`,
            'error',
          ),
      },
    );
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
        <RefreshBtn onRefresh={refresh} title="Refresh compliance records" />
      </Card>

      {tab === 'Staff Logins' && <LoginHistoryCard />}
      {tab === 'Configuration Changes' && <ConfigChangesCard />}
      {tab === 'Export on Request' && (
        <>
          <CanOps perm="compliance.add">
            <ExportRequestForm
              busy={createExport.isPending || processingId != null}
              onSubmit={handleExport}
            />
          </CanOps>
          <ExportRequestsCard processingId={processingId} onProcess={prepare} />
        </>
      )}
    </div>
  );
}
