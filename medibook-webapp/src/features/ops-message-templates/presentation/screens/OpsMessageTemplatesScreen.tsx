import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SearchField } from '@/shared/ui/SearchField';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useDeleteMessageTemplateMutation } from '@/features/ops-message-templates/application/queries/useDeleteMessageTemplateMutation';
import { useMessageTemplatesQuery } from '@/features/ops-message-templates/application/queries/useMessageTemplatesQuery';
import type {
  MessageChannel,
  MessageTemplate,
} from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import {
  DEFAULT_LOCALE,
  MESSAGE_CHANNELS,
} from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import { MessageTemplateModal } from '@/features/ops-message-templates/presentation/components/MessageTemplateModal';
import {
  CHANNEL_LABEL,
  filterTemplates,
  removalEffect,
  type TemplateStatusFilter,
} from '@/features/ops-message-templates/presentation/components/messageTemplates.rules';

const COLUMNS = ['Event', 'Channel', 'Locale', 'Message', 'Status', ''] as const;

const ALL_CHANNELS = 'Channel: All';
const STATUS_OPTIONS: Readonly<Record<TemplateStatusFilter, string>> = {
  all: 'Status: All',
  active: 'Active',
  inactive: 'Off',
};
const STATUS_KEYS = Object.keys(STATUS_OPTIONS) as TemplateStatusFilter[];

type Editor = { readonly template: MessageTemplate | null } | null;

/**
 * Platform message templates (Q112): the wording of every SMS, WhatsApp,
 * push and staff email Medibook sends, per event, channel and locale.
 * Hospitals have no wording of their own. `settings.*`.
 */
export function OpsMessageTemplatesScreen() {
  const templates = useMessageTemplatesQuery();
  const remove = useDeleteMessageTemplateMutation();
  const { can } = useOpsPermission();
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  const [status, setStatus] = useState<TemplateStatusFilter>('all');
  const [editor, setEditor] = useState<Editor>(null);
  const [toDelete, setToDelete] = useState<MessageTemplate | null>(null);
  const all = templates.data ?? [];
  const rows = filterTemplates(all, { q, channel, status });
  const filtered = q.trim() !== '' || channel !== null || status !== 'all';

  const state: TableStateSpec | undefined = templates.isPending
    ? { kind: 'loading', rows: 8 }
    : templates.isError
      ? {
          kind: 'error',
          message: isFailure(templates.error) ? templates.error.message : undefined,
          onRetry: () => void templates.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'message-circle',
            title: filtered ? 'No templates match your filters.' : 'No templates yet.',
            message: filtered
              ? 'Search looks at event codes and wording.'
              : 'Messages for an event without an active template are not sent.',
            ...(filtered
              ? {
                  actionLabel: 'Clear filters',
                  onAction: () => {
                    setQ('');
                    setChannel(null);
                    setStatus('all');
                  },
                }
              : {}),
          }
        : undefined;

  const confirmDelete = (): void => {
    if (!toDelete) return;
    remove.mutate(
      { id: toDelete.id, version: toDelete.version },
      {
        onSuccess: () => {
          toast('Template removed.', 'success');
          setToDelete(null);
        },
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'Could not remove the template.', 'error'),
      },
    );
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="Event code or wording"
            aria-label="Search templates by event code or wording"
          />
        </div>
        <FilterSelect
          value={channel ? CHANNEL_LABEL[channel] : ALL_CHANNELS}
          options={[ALL_CHANNELS, ...MESSAGE_CHANNELS.map((c) => CHANNEL_LABEL[c])]}
          onChange={(v) => setChannel(MESSAGE_CHANNELS.find((c) => CHANNEL_LABEL[c] === v) ?? null)}
          aria-label="Filter by channel"
        />
        <FilterSelect
          value={STATUS_OPTIONS[status]}
          options={STATUS_KEYS.map((k) => STATUS_OPTIONS[k])}
          onChange={(v) => setStatus(STATUS_KEYS.find((k) => STATUS_OPTIONS[k] === v) ?? 'all')}
          aria-label="Filter by status"
        />
        {can('settings.add') && (
          <Button icon="plus" onClick={() => setEditor({ template: null })}>
            Add template
          </Button>
        )}
      </div>
      <p className="text-caption text-text-muted mt-0 mb-4">
        One active template per event, channel and locale; other locales fall back to{' '}
        {DEFAULT_LOCALE}. Changes apply to messages sent from now on.
      </p>
      <TableShell columns={COLUMNS} scrollLabel="Message templates" state={state}>
        {rows.map((t) => (
          <tr key={t.id}>
            <td className={`${tdClass} font-mono`}>{t.eventCode}</td>
            <td className={tdClass}>{CHANNEL_LABEL[t.channel]}</td>
            <td className={tdClass}>{t.locale}</td>
            <td className={`${tdClass} max-w-120`}>
              {t.subject && <span className="text-text-strong block font-medium">{t.subject}</span>}
              <span className="text-text-body line-clamp-2">{t.body}</span>
            </td>
            <td className={tdClass}>
              <Badge status={t.isActive ? 'Active' : 'Inactive'}>
                {t.isActive ? 'Active' : 'Off'}
              </Badge>
            </td>
            <td className={tdClass}>
              <div className="flex gap-2">
                {can('settings.edit') && (
                  <IconBtn
                    name="pencil"
                    box={36}
                    size={15}
                    label={`Edit ${t.eventCode} ${CHANNEL_LABEL[t.channel]} template`}
                    onClick={() => setEditor({ template: t })}
                  />
                )}
                {can('settings.del') && (
                  <IconBtn
                    name="trash-2"
                    box={36}
                    size={15}
                    color="var(--color-d-500)"
                    label={`Remove ${t.eventCode} ${CHANNEL_LABEL[t.channel]} template`}
                    onClick={() => setToDelete(t)}
                  />
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      {editor && (
        <MessageTemplateModal
          key={editor.template?.id ?? 'new'}
          template={editor.template}
          templates={all}
          onClose={() => setEditor(null)}
        />
      )}
      <OpsConfirm
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        icon="trash-2"
        tone="danger"
        title="Remove this template?"
        body={
          toDelete
            ? `${toDelete.eventCode} by ${CHANNEL_LABEL[toDelete.channel]} (${toDelete.locale}): ${removalEffect(toDelete, all)} To pause it instead, edit it and switch it off.`
            : ''
        }
        confirmLabel={remove.isPending ? 'Removing…' : 'Remove template'}
        confirmVariant="danger"
        busy={remove.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
