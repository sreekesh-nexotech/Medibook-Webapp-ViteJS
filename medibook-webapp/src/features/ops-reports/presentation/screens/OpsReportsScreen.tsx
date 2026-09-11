import { DEMO_TODAY_ISO } from '@/core/config/demo';
import {
  OPS_REPORT_DEFS,
  type OpsReportDef,
} from '@/features/ops-reports/application/store/opsReports.fixtures';
import { useOpsReportsStore } from '@/features/ops-reports/application/store/opsReports.store';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { OPS_TINTS } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';

/**
 * Ops platform reports — a 3×2 grid of exportable-report cards (design
 * `OpsReports`).
 *
 * Audit 3.1.4: every card used to fire a "<name> ready." toast and write
 * nothing. Each one now emits a genuine CSV of that report's rows through
 * `downloadCsv` — header row first, rupee columns intact — and only then
 * reports success, with the row count in the message so the claim is
 * checkable. The `useOpsAct` busy/latency feel is unchanged.
 */
export function OpsReportsScreen() {
  const [busy, run] = useOpsAct();
  const reportsGen = useOpsReportsStore((s) => s.reportsGen);
  const markExported = useOpsReportsStore((s) => s.markExported);

  const exportReport = (r: OpsReportDef, i: number): void => {
    run(`r${i}`, `Exported ${r.name} — ${r.rows.length} rows.`, () => {
      downloadCsv(`${r.file}-${DEMO_TODAY_ISO}.csv`, [r.columns, ...r.rows]);
      markExported(i, r.name, r.rows.length);
    });
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {OPS_REPORT_DEFS.map((r, i) => {
        const t = OPS_TINTS[r.tint];
        const isBusy = Boolean(busy[`r${i}`]);
        return (
          <Card key={r.name} className="flex flex-col gap-2.5">
            <div className={cn('flex size-10 items-center justify-center rounded-md', t[0], t[1])}>
              <Icon name={r.icon} size={20} />
            </div>
            <SectionTitle size={16}>{r.name}</SectionTitle>
            <span className="text-body text-text-muted">{r.desc}</span>
            <span className="text-caption text-text-muted">
              {r.rows.length} rows · {r.columns.length} columns · last generated {reportsGen[i]}
            </span>
            <div className="mt-1.5">
              <Button
                size="sm"
                variant="secondary"
                icon="download"
                busy={isBusy}
                onClick={() => exportReport(r, i)}
              >
                {isBusy ? 'Preparing…' : 'Download CSV'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
