import type { ReactNode } from 'react';

import { fmtDate } from '@/shared/lib/format';
import { Drawer } from '@/shared/ui/Drawer';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import type { AuditLogEntry, AuditSnapshotField } from '@/features/audit/domain/entities/audit.log';
import {
  type AuditActorLabel,
  actionLabel,
  entityLabel,
  localStamp,
} from '@/features/audit/presentation/components/auditFormat';

const DRAWER_WIDTH = 520;

interface AuditDetailDrawerProps {
  /** The row to show; `null` closes the drawer. */
  entry: AuditLogEntry | null;
  /** Who acted, as the table named them. */
  actor: AuditActorLabel | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-border-soft flex justify-between gap-4 border-b py-2">
      <span className="text-body text-text-muted flex-none">{label}</span>
      <span className="text-body text-text-strong text-right font-medium break-all">{value}</span>
    </div>
  );
}

function Snapshot({ title, fields }: { title: string; fields: readonly AuditSnapshotField[] }) {
  if (fields.length === 0) return null;
  return (
    <section>
      <SectionTitle size={15} className="mb-1.5">
        {title}
      </SectionTitle>
      <dl className="m-0 flex flex-col gap-1">
        {fields.map((f) => (
          <div key={f.field} className="flex flex-wrap items-baseline gap-x-4">
            <dt className="text-caption text-text-muted w-40 flex-none break-all">{f.field}</dt>
            <dd className="text-body text-text-body m-0 min-w-0 flex-1 break-all">
              {f.value ?? '—'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * One audit row in full (UAT-66, appendix 05 R8): who, what, on which record,
 * from where, and the masked before / after values and context the backend
 * recorded. Contact details stay masked as the server stored them.
 */
export function AuditDetailDrawer({ entry, actor, onClose }: AuditDetailDrawerProps) {
  const stamp = entry ? localStamp(entry.occurredAt) : null;
  return (
    <Drawer
      open={entry !== null}
      onClose={onClose}
      width={DRAWER_WIDTH}
      title={entry ? actionLabel(entry.action) : ''}
      subtitle={entry ? entityLabel(entry.resourceType) : undefined}
    >
      {entry && (
        <div className="flex flex-col gap-5">
          <section>
            <Row label="When" value={stamp ? `${fmtDate(stamp.date)} · ${stamp.time}` : '—'} />
            <Row label="Who" value={actor ? `${actor.name} · ${actor.sub}` : '—'} />
            <Row label="Action" value={entry.action} />
            <Row label="Entity" value={entityLabel(entry.resourceType)} />
            {entry.resourceId && <Row label="Record" value={entry.resourceId} />}
            <Row label="Request" value={`${entry.method} ${entry.path}`} />
            <Row label="Result" value={entry.statusCode} />
            <Row label="IP" value={entry.ip ?? '—'} />
            <Row label="Request ID" value={entry.requestId} />
          </section>
          {entry.changes.length > 0 && (
            <section>
              <SectionTitle size={15} className="mb-1.5">
                Before → after
              </SectionTitle>
              <div className="flex flex-col gap-2">
                {entry.changes.map((c) => (
                  <div key={c.field} className="flex flex-col">
                    <span className="text-caption text-text-muted">{c.field}</span>
                    <span className="text-text-muted break-all line-through">
                      {c.before ?? 'not set'}
                    </span>
                    <span className="text-text-strong font-medium break-all">
                      {c.after ?? 'removed'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <Snapshot title="Before" fields={entry.before} />
          <Snapshot title="After" fields={entry.after} />
          <Snapshot title="Context" fields={entry.meta} />
          {entry.changes.length === 0 && entry.before.length === 0 && entry.after.length === 0 && (
            <p className="text-body text-text-muted m-0">
              This entry records the request only; the change itself carries no before and after
              values.
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}
