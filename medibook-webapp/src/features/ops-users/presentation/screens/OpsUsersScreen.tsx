import { useState } from 'react';

import { OPS_ROLE_PERMS } from '@/features/ops-users/application/store/opsUsers.fixtures';
import { useOpsUsersStore } from '@/features/ops-users/application/store/opsUsers.store';
import type { OpsRole } from '@/features/ops-users/application/store/opsUsers.types';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { OpsPerson } from '@/shared/ui/OpsPerson';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { StatCard, type StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { AddOpsUserModal } from '../components/AddOpsUserModal';
import { OpsRoleAnnotation } from '../components/OpsRoleAnnotation';

/** Roles in the design's Role Permissions grid order. */
const OPS_ROLE_ORDER: readonly OpsRole[] = ['Super Admin', 'Finance Admin', 'Support', 'Auditor'];

const USER_COLUMNS = ['User', 'Role', '2FA', 'Last Active', 'Status', 'Action'] as const;

const PERMISSION_COLUMNS = [
  'Permission',
  'Super Admin',
  'Finance Admin',
  'Support',
  'Auditor',
] as const;

/** Which editor the modal is open on: a new invite, or an existing user. */
type EditorState = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly id: number } | null;

/** Check glyph (granted) or an em-dash (no access) for a permission-matrix cell. */
function mark(v: 0 | 1) {
  return v ? (
    <Icon name="circle-check" size={17} className="text-g-600" />
  ) : (
    <span className="text-text-muted" title="No access">
      —
    </span>
  );
}

/** Internal Medibook users & roles (design `OpsUsers`). */
export function OpsUsersScreen() {
  const users = useOpsUsersStore((s) => s.users);
  const deleteUser = useOpsUsersStore((s) => s.deleteUser);
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<EditorState>(null);
  const [delId, setDelId] = useState<number | null>(null);
  const [busy, run] = useOpsAct();

  const ql = q.trim().toLowerCase();
  const filtered = users.filter(
    (u) =>
      !ql ||
      u.name.toLowerCase().includes(ql) ||
      u.email.toLowerCase().includes(ql) ||
      u.role.toLowerCase().includes(ql),
  );
  const del = users.find((u) => u.id === delId);
  const editingUser =
    editor?.kind === 'edit' ? (users.find((u) => u.id === editor.id) ?? null) : null;
  /** Remount key for the editor, so its form initialises from props (no sync effect). */
  const editorKey = editor ? (editor.kind === 'edit' ? `edit-${editor.id}` : 'new') : 'closed';
  const ct = (role: OpsRole) => users.filter((u) => u.role === role).length;

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'shield-check',
      label: 'Super Admins',
      value: ct('Super Admin'),
      sub: 'Full platform control',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
    },
    {
      icon: 'indian-rupee',
      label: 'Finance Admins',
      value: ct('Finance Admin'),
      sub: 'Billing and settlements',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'headset',
      label: 'Support',
      value: ct('Support'),
      sub: 'Hospital assistance',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'eye',
      label: 'Auditors',
      value: ct('Auditor'),
      sub: 'Read-only compliance access',
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
    },
  ];

  const tableState: TableStateSpec | undefined =
    filtered.length === 0
      ? {
          kind: 'empty',
          icon: 'users',
          title: 'No results match your search.',
          message: 'Search matches name, email and role.',
          actionLabel: 'Clear search',
          onAction: () => setQ(''),
        }
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        {KPIS.map((k) => (
          <StatCard key={k.label} k={k} />
        ))}
      </div>
      <Card pad={14} className="flex items-center gap-4">
        <div className="flex-1">
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="Search name, email or role"
            aria-label="Search internal users by name, email or role"
          />
        </div>
        <Button icon="plus" onClick={() => setEditor({ kind: 'new' })}>
          Add User
        </Button>
      </Card>
      <Card>
        <TableShell columns={USER_COLUMNS} scrollLabel="Internal users" state={tableState}>
          {filtered.map((u) => (
            <tr key={u.id}>
              <td className={tdClass}>
                <OpsPerson row={u} />
              </td>
              <td className={tdClass}>{u.role}</td>
              <td className={tdClass}>
                <Badge status={u.twofa} />
              </td>
              <td className={tdClass}>{u.lastActive}</td>
              <td className={tdClass}>
                <Badge status={u.status} />
              </td>
              <td className={tdClass}>
                <div className="flex gap-2">
                  <IconBtn
                    name="pencil"
                    box={36}
                    size={15}
                    label="Edit user"
                    title={`Edit ${u.name}`}
                    onClick={() => setEditor({ kind: 'edit', id: u.id })}
                  />
                  <IconBtn
                    name="trash-2"
                    box={36}
                    size={15}
                    color="var(--color-d-500)"
                    label="Delete user"
                    title={`Delete ${u.name}`}
                    onClick={() => setDelId(u.id)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>
      <Card>
        <SectionTitle className="mb-1.5">Role Permissions</SectionTitle>
        <div className="text-caption text-text-muted mb-4">
          Roles are fixed platform profiles — assign the narrowest one that covers the job. Patient
          account detail requires its own permission, separate from the account list. Every detail
          view is written to Compliance Logs.
        </div>
        <div className="mb-4.5 grid grid-cols-2 gap-3">
          {OPS_ROLE_ORDER.map((r) => (
            <OpsRoleAnnotation key={r} role={r} />
          ))}
        </div>
        <TableShell columns={PERMISSION_COLUMNS} scrollLabel="Role permission matrix">
          {OPS_ROLE_PERMS.map(([p, sa, fa, sup, aud]) => (
            <tr key={p}>
              <td className="text-body text-text-strong border-border-soft w-2/5 border-b px-3.5 align-middle font-medium">
                {p}
              </td>
              <td className={cn(tdClass, 'text-center')}>{mark(sa)}</td>
              <td className={cn(tdClass, 'text-center')}>{mark(fa)}</td>
              <td className={cn(tdClass, 'text-center')}>{mark(sup)}</td>
              <td className={cn(tdClass, 'text-center')}>{mark(aud)}</td>
            </tr>
          ))}
        </TableShell>
      </Card>
      <AddOpsUserModal
        key={editorKey}
        open={editor != null}
        user={editingUser}
        onClose={() => setEditor(null)}
        onDone={() => {
          setEditor(null);
          setQ('');
        }}
      />
      <OpsConfirm
        open={Boolean(del)}
        onClose={() => setDelId(null)}
        icon="trash-2"
        tone="danger"
        title="Delete this user?"
        body={
          del
            ? `This permanently removes ${del.name} and their access. You won't be able to recover it later.`
            : ''
        }
        confirmLabel={busy.del ? 'Deleting…' : 'Delete User'}
        confirmVariant="danger"
        busy={busy.del}
        onConfirm={() => {
          if (!del) return;
          run('del', 'User deleted.', () => {
            deleteUser(del.id);
            setDelId(null);
          });
        }}
      />
    </div>
  );
}
