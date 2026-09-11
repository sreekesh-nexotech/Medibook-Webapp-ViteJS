import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { usePlatformUsersStore } from '@/features/ops-platform-users/application/store/platformUsers.store';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { InfoGrid } from '@/shared/ui/InfoGrid';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

/** Read-only patient-account view — access is logged (design `OpsPlatformUserDetail`). */
export function OpsPlatformUserDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const users = usePlatformUsersStore((s) => s.users);
  const toggleBlock = usePlatformUsersStore((s) => s.toggleBlock);
  const [block, setBlock] = useState(false);
  const [busy, run] = useOpsAct();

  const u = users.find((x) => x.id === Number(id)) ?? users[0];
  const blocked = u.status === 'Blocked';

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={u.av || undefined} name={u.name} size={56} />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-3">
              <SectionTitle size={20}>{u.name}</SectionTitle>
              <Badge status={u.status} />
            </div>
            <span className="text-caption text-text-muted">
              {u.phone} · {u.email} · {u.city}
            </span>
          </div>
          <div className="flex-1"></div>
          <Button
            variant={blocked ? 'secondary' : 'danger'}
            icon={blocked ? 'user-check' : 'ban'}
            onClick={() => setBlock(true)}
          >
            {blocked ? 'Unblock Account' : 'Block Account'}
          </Button>
        </div>
      </Card>
      <InfoGrid
        items={[
          { k: 'Name', v: u.name },
          { k: 'Mobile', v: u.phone, num: true },
          { k: 'Email', v: u.email },
          { k: 'Registered', v: u.joined },
          { k: 'Status', v: u.status },
          { k: 'City', v: u.city },
        ]}
      />
      <Card>
        <SectionTitle className="mb-4">Family Members</SectionTitle>
        {u.family.length > 0 ? (
          <TableShell
            columns={['Name', 'Relationship', 'Age', 'Gender']}
            scrollLabel="Family members on this account"
            rightCols={['Age']}
          >
            {u.family.map((f) => (
              <tr key={f.name}>
                <td className={`${tdClass} text-text-strong w-[34%] font-medium`}>{f.name}</td>
                <td className={tdClass}>{f.rel}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{f.age}</td>
                <td className={tdClass}>{f.gender}</td>
              </tr>
            ))}
          </TableShell>
        ) : (
          <EmptyState
            compact
            icon="users"
            title="No family members added to this account."
            message="People this account books for would be listed here. Nothing to do from the console — the patient manages them in the app."
          />
        )}
      </Card>
      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <SectionTitle>Booking History</SectionTitle>
          <span className="text-caption text-text-muted">Read-only · no clinical data</span>
        </div>
        {u.history.length > 0 ? (
          <TableShell
            columns={['Hospital', 'Department', 'Date', 'Status']}
            scrollLabel="Booking history for this account"
          >
            {u.history.map((b, i) => (
              <tr key={i}>
                <td className={`${tdClass} text-text-strong w-[30%] font-medium`}>{b.hospital}</td>
                <td className={tdClass}>{b.department}</td>
                <td className={tdClass}>{b.date}</td>
                <td className={tdClass}>
                  <Badge status={b.status} />
                </td>
              </tr>
            ))}
          </TableShell>
        ) : (
          <EmptyState
            compact
            icon="calendar-check"
            title="No bookings made from this account yet."
            message="The account is registered but has never booked — nothing here indicates a problem."
          />
        )}
      </Card>
      <OpsConfirm
        open={block}
        onClose={() => setBlock(false)}
        icon="ban"
        tone={blocked ? 'success' : 'neutral'}
        title={blocked ? 'Unblock this account?' : 'Block this account?'}
        body={
          blocked
            ? `${u.name} can make new bookings again immediately.`
            : `Existing upcoming bookings are unaffected. ${u.name} cannot make new bookings until unblocked.`
        }
        confirmLabel={
          busy.block ? (blocked ? 'Unblocking…' : 'Blocking…') : blocked ? 'Unblock' : 'Block'
        }
        confirmVariant={blocked ? 'primary' : 'danger'}
        busy={busy.block}
        onConfirm={() =>
          run('block', blocked ? `${u.name} unblocked.` : `${u.name} blocked.`, () => {
            toggleBlock(u.id);
            setBlock(false);
          })
        }
      />
    </div>
  );
}
