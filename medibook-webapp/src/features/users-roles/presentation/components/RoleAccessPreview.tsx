import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

import type { PermsGrid } from '@/features/users-roles/application/store/rbac.types';
import { AccessSummary } from '@/features/users-roles/presentation/components/AccessSummary';
import {
  ACTION_LABEL,
  buildRoleAccessPreview,
} from '@/features/users-roles/presentation/components/access-preview';

/** A module outside the ten-row grid (Cash Desk, Patient Approvals, Display Devices). */
export interface ExtraModuleAccess {
  readonly module: string;
  readonly label: string;
  readonly actions: readonly string[];
}

const EXTRA_ACTION_LABEL: Readonly<Record<string, string>> = ACTION_LABEL;

interface RoleAccessPreviewProps {
  roleName: string;
  /** Concrete role colour from the store — data-driven, hence `style`. */
  roleColor?: string;
  perms: PermsGrid;
  /** What the role holds on the modules the grid does not show (UAT-23, 08 F10). */
  extraModules?: readonly ExtraModuleAccess[];
  /** Single-column layout for the role-editor drawer. */
  compact?: boolean;
}

/**
 * "What this role actually sees" — the demonstrable half of audit 2.4 / X-01 /
 * Q-03. Given a permission grid it renders the sidebar the role gets, the
 * actions it holds per module (the three modules outside the grid included),
 * and the screens it is refused with the exact permission each one needs.
 *
 * Everything comes from `buildRoleAccessPreview`, which applies the one gate
 * the app has — the role's permission for the screen's module, as the
 * sidebar and route guards apply it (UAT-23). Ticking a box in the grid
 * changes this panel on the same render.
 */
export function RoleAccessPreview({
  roleName,
  roleColor,
  perms,
  extraModules = [],
  compact = false,
}: RoleAccessPreviewProps) {
  const preview = buildRoleAccessPreview(perms);
  const total = preview.visible.length + preview.denied.length;
  const extras = extraModules.filter((m) => m.actions.length > 0);

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
      </div>

      {preview.isLockedOut && (
        <div className="text-caption text-d-700 bg-d-100 flex items-center gap-2 rounded-md px-3 py-2.25">
          <Icon name="triangle-alert" size={15} className="flex-none" /> This role cannot open any
          working screen — grant View on at least one module.
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
          {preview.moduleActions.length === 0 && extras.length === 0 ? (
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
              {extras.map((m) => (
                <div key={m.module} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-caption text-text-strong font-medium">{m.label}</span>
                  {m.actions.map((a) => (
                    <span
                      key={a}
                      className="text-tiny bg-bg-tint text-text-navy rounded-full px-2 py-0.5 font-semibold"
                    >
                      {EXTRA_ACTION_LABEL[a] ?? a}
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
                    <span className="text-text-muted">
                      — needs {i.needs ?? 'a permission this role does not have'}
                    </span>
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
