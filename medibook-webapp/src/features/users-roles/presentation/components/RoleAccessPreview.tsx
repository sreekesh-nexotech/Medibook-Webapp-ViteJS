import { cn } from '@/shared/lib/cn';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';

import { HOSPITAL_ROLES, type HospitalRole } from '@/app/router/paths';

import type { PermsGrid } from '@/features/users-roles/application/store/rbac.types';
import { AccessSummary } from '@/features/users-roles/presentation/components/AccessSummary';
import {
  ACTION_LABEL,
  buildRoleAccessPreview,
  type PreviewNavItem,
} from '@/features/users-roles/presentation/components/access-preview';

/** Sign-in role labels, as the topbar switcher names them. */
const SIGN_IN_LABEL: Readonly<Record<HospitalRole, string>> = {
  admin: 'Administrator sign-in',
  receptionist: 'Front desk sign-in',
};

const SIGN_IN_OPTIONS: readonly string[] = HOSPITAL_ROLES.map((r) => SIGN_IN_LABEL[r]);

function signInFromLabel(label: string): HospitalRole {
  return HOSPITAL_ROLES.find((r) => SIGN_IN_LABEL[r] === label) ?? 'receptionist';
}

/** One sentence saying why a screen is out of reach, in the role's own terms. */
function denialReason(item: PreviewNavItem, signInAs: HospitalRole): string {
  if (item.reason === 'permission' && item.needs) return `needs ${item.needs}`;
  if (item.reason === 'role') return `${SIGN_IN_LABEL[signInAs]} cannot open this URL`;
  return 'not available to this role';
}

interface RoleAccessPreviewProps {
  roleName: string;
  /** Concrete role colour from the store — data-driven, hence `style`. */
  roleColor?: string;
  perms: PermsGrid;
  signInAs: HospitalRole;
  /** Omit to render the sign-in role as a read-only line instead of a picker. */
  onSignInAsChange?: (role: HospitalRole) => void;
  /** Single-column layout for the role-editor drawer. */
  compact?: boolean;
}

/**
 * "What this role actually sees" — the demonstrable half of audit 2.4 / X-01 /
 * Q-03. Given a permission grid and a sign-in role it renders the sidebar the
 * role gets, the actions it holds per module, and the screens it is refused
 * with the exact permission key each denial is missing.
 *
 * Everything comes from `buildRoleAccessPreview`, which reads the same
 * `NAV_MODEL` role gate and the same `perms[module].view` check the live
 * sidebar and route guards use — so ticking a box in the permission grid
 * changes this panel on the same render, and the preview cannot drift from the
 * real behaviour.
 */
export function RoleAccessPreview({
  roleName,
  roleColor,
  perms,
  signInAs,
  onSignInAsChange,
  compact = false,
}: RoleAccessPreviewProps) {
  const preview = buildRoleAccessPreview(perms, signInAs);
  const total = preview.visible.length + preview.denied.length;
  // Screens the grid allows but the URL-role gate refuses — the X-01 gap: the
  // topbar switcher can only sign in as receptionist or admin.
  const roleGated = preview.denied.filter((i) => i.reason === 'role');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-2">
          {roleColor && (
            <span className="size-2.5 flex-none rounded-full" style={{ background: roleColor }} />
          )}
          <span className="text-body text-text-strong font-semibold">{roleName}</span>
        </span>
        <span className="text-caption text-text-muted">
          sees {preview.visible.length} of {total} screens
        </span>
        <span className="flex-1" />
        {onSignInAsChange ? (
          <FilterSelect
            value={SIGN_IN_LABEL[signInAs]}
            options={SIGN_IN_OPTIONS}
            onChange={(label) => onSignInAsChange(signInFromLabel(label))}
            aria-label="Preview this role at which sign-in"
          />
        ) : (
          <span className="text-caption text-text-muted">{SIGN_IN_LABEL[signInAs]}</span>
        )}
      </div>

      {roleGated.length > 0 && (
        <div className="text-caption text-y-700 bg-y-100 flex items-start gap-2 rounded-md px-3 py-2.25">
          <Icon name="info" size={15} className="mt-px flex-none" />
          <span>
            {roleGated.length} {roleGated.length === 1 ? 'screen is' : 'screens are'} granted by
            this role&apos;s permissions but sit behind the administrator sign-in —{' '}
            {roleGated.map((i) => i.label).join(', ')}. Switch the sign-in above to see them.
          </span>
        </div>
      )}

      {preview.isLockedOut && (
        <div className="text-caption text-d-700 bg-d-100 flex items-center gap-2 rounded-md px-3 py-2.25">
          <Icon name="triangle-alert" size={15} className="flex-none" /> This role cannot open a
          single screen — grant View on at least one module.
        </div>
      )}

      <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'lg:grid-cols-3')}>
        <section className="border-border-soft rounded-md border bg-white px-3.5 py-3">
          <h4 className="text-caption text-text-navy mb-2.5 font-semibold uppercase">
            Sidebar it sees
          </h4>
          {preview.navSections.length === 0 ? (
            <span className="text-caption text-text-muted">No navigation at all.</span>
          ) : (
            <div className="flex flex-col gap-2.5">
              {preview.navSections.map((s) => (
                <div key={s.section}>
                  <div className="text-tiny text-text-muted mb-1 font-semibold uppercase">
                    {s.section}
                  </div>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {s.items.map((i) => (
                      <li
                        key={i.id}
                        className="text-caption text-text-body flex items-center gap-2"
                      >
                        <Icon name={i.icon} size={14} className="text-blue flex-none" />
                        {i.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border-border-soft rounded-md border bg-white px-3.5 py-3">
          <h4 className="text-caption text-text-navy mb-2.5 font-semibold uppercase">
            Actions it gets
          </h4>
          {preview.moduleActions.length === 0 ? (
            <span className="text-caption text-text-muted">No actions on any module.</span>
          ) : (
            <div className="flex flex-col gap-2">
              {preview.moduleActions.map((m) => (
                <div key={m.module} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-caption text-text-strong font-medium">{m.module}</span>
                  {m.actions.map((a) => (
                    <span
                      key={a}
                      className="text-tiny bg-bg-tint text-text-navy rounded-full px-2 py-0.5 font-semibold"
                    >
                      {ACTION_LABEL[a]}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border-border-soft rounded-md border bg-white px-3.5 py-3">
          <h4 className="text-caption text-text-navy mb-2.5 font-semibold uppercase">
            Screens it is denied
          </h4>
          {preview.denied.length === 0 ? (
            <span className="text-caption text-text-muted">
              Nothing — this role reaches every screen.
            </span>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {preview.denied.map((i) => (
                <li key={i.id} className="text-caption text-text-body flex items-start gap-2">
                  <Icon name="lock" size={13} className="text-text-muted mt-0.5 flex-none" />
                  <span>
                    <b className="text-text-strong font-semibold">{i.label}</b>{' '}
                    <span className="text-text-muted">— {denialReason(i, signInAs)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="border-border-soft bg-bg-subtle rounded-md border px-3.5 py-3">
        <div className="text-body text-text-strong mb-2 font-medium">In plain words</div>
        <AccessSummary perms={perms} />
      </div>
    </div>
  );
}
