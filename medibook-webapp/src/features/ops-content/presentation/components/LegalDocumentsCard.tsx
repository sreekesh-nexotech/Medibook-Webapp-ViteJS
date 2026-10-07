import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import { useLegalDocumentsQuery } from '@/features/ops-content/application/queries/useLegalDocumentsQuery';
import { usePublishLegalDraftMutation } from '@/features/ops-content/application/queries/usePublishLegalDraftMutation';
import {
  LEGAL_SLUGS,
  type LegalDocument,
  type LegalSlug,
} from '@/features/ops-content/domain/entities/content.entities';
import {
  LEGAL_SLUG_LABEL,
  legalVersionsBySlug,
  type LegalDocumentVersions,
} from '@/features/ops-content/presentation/components/content.rules';
import { LegalDraftModal } from '@/features/ops-content/presentation/components/LegalDraftModal';

const DATE_FORMAT = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

type Editor = { readonly slug: LegalSlug; readonly draft: LegalDocument | null } | null;

function when(iso: string | null): string {
  return iso ? DATE_FORMAT.format(new Date(iso)) : '—';
}

/**
 * Terms, privacy policy and guidelines (`/platform/legal-documents`, R1):
 * each with the version patients see, a draft to edit, publish (which makes
 * it current and asks for fresh consent through app-config `legal_versions`),
 * and the version history. Nothing is deleted (Q122).
 */
export function LegalDocumentsCard() {
  const docs = useLegalDocumentsQuery();
  const publish = usePublishLegalDraftMutation();
  const { can } = useOpsPermission();
  const [editor, setEditor] = useState<Editor>(null);
  const [toPublish, setToPublish] = useState<LegalDocumentVersions | null>(null);
  const [viewing, setViewing] = useState<LegalDocumentVersions | null>(null);

  if (docs.isPending) return <SkeletonCards count={3} lines={3} />;
  if (docs.isError) {
    return (
      <Card>
        <ErrorState
          title="Legal documents didn't load"
          message={isFailure(docs.error) ? docs.error.message : undefined}
          onRetry={() => void docs.refetch()}
        />
      </Card>
    );
  }

  const groups = legalVersionsBySlug(docs.data, LEGAL_SLUGS);
  const editorStart = editor ? (groups.find((g) => g.slug === editor.slug)?.current ?? null) : null;

  const confirmPublish = (): void => {
    if (!toPublish?.draft) return;
    const { slug, draft } = toPublish;
    publish.mutate(slug, {
      onSuccess: () => {
        toast(`${LEGAL_SLUG_LABEL[slug]} v${draft.version} is now live in the app.`, 'success');
        setToPublish(null);
      },
      onError: (error) =>
        toast(isFailure(error) ? error.message : 'Could not publish this version.', 'error'),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <Card key={g.slug}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <SectionTitle>{LEGAL_SLUG_LABEL[g.slug]}</SectionTitle>
                {g.current ? (
                  <Badge status="Live">Live · v{g.current.version}</Badge>
                ) : (
                  <Badge status="Missing">Not published</Badge>
                )}
                {g.draft && <Badge status="Pending">Draft · v{g.draft.version}</Badge>}
              </div>
              <span className="text-caption text-text-muted">
                {g.current
                  ? `“${g.current.title}”, published ${when(g.current.publishedAt)}`
                  : 'Patients see no version of this document yet.'}
                {g.draft ? ` · draft last saved ${when(g.draft.updatedAt)}` : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {g.history.length > 0 && (
                <Button size="sm" variant="ghost" icon="eye" onClick={() => setViewing(g)}>
                  Versions ({g.history.length})
                </Button>
              )}
              {g.draft
                ? can('settings.edit') && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="pencil"
                        onClick={() => setEditor({ slug: g.slug, draft: g.draft })}
                      >
                        Edit draft
                      </Button>
                      <Button size="sm" icon="send" onClick={() => setToPublish(g)}>
                        Publish v{g.draft.version}
                      </Button>
                    </>
                  )
                : can('settings.add') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="plus"
                      onClick={() => setEditor({ slug: g.slug, draft: null })}
                    >
                      New draft
                    </Button>
                  )}
            </div>
          </div>
        </Card>
      ))}

      {editor && (
        <LegalDraftModal
          key={`${editor.slug}-${editor.draft?.id ?? 'new'}`}
          slug={editor.slug}
          draft={editor.draft}
          startFrom={editorStart}
          onClose={() => setEditor(null)}
        />
      )}

      <OpsConfirm
        open={toPublish !== null}
        onClose={() => setToPublish(null)}
        icon="send"
        tone="primary"
        title={
          toPublish?.draft
            ? `Publish ${LEGAL_SLUG_LABEL[toPublish.slug]} v${toPublish.draft.version}?`
            : 'Publish?'
        }
        body="It replaces the live version in the patient app straight away and becomes the version new consents record. Published versions cannot be edited."
        confirmLabel={publish.isPending ? 'Publishing…' : 'Publish'}
        busy={publish.isPending}
        onConfirm={confirmPublish}
      />

      <Drawer
        open={viewing !== null}
        onClose={() => setViewing(null)}
        width={720}
        title={viewing ? `${LEGAL_SLUG_LABEL[viewing.slug]} — versions` : 'Versions'}
      >
        <div className="flex flex-col gap-5">
          {(viewing?.history ?? []).map((d) => (
            <div key={d.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body text-text-strong font-medium">
                  v{d.version} · {d.title}
                </span>
                {d.isCurrent && <Badge status="Live" />}
                {d.publishedAt === null && <Badge status="Pending">Draft</Badge>}
                <span className="text-caption text-text-muted">
                  {d.publishedAt
                    ? `Published ${when(d.publishedAt)}`
                    : `Saved ${when(d.updatedAt)}`}
                </span>
              </div>
              <CodeBlock label={`Version ${d.version} text`}>{d.bodyMd}</CodeBlock>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
