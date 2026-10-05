import { useNavigate, useParams } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { opsPath } from '@/app/router/paths';

import { useInvoiceQuery } from '@/features/ops-billing/application/queries/useInvoiceQuery';
import { failureText } from '@/features/ops-billing/presentation/components/billingView';
import { InvoiceDetailBody } from '@/features/ops-billing/presentation/components/InvoiceDetailBody';

/**
 * Ops invoice detail (design `Ops.jsx` `OpsInvoiceDetail`) on the platform
 * billing API. This screen owns the load states; `InvoiceDetailBody` renders
 * the invoice once it is here.
 */
export function OpsInvoiceDetailScreen() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const invoiceQuery = useInvoiceQuery(id);

  if (invoiceQuery.isPending) return <SkeletonCards count={1} lines={5} pad={24} />;
  if (invoiceQuery.isError) {
    const isMissing = isFailure(invoiceQuery.error) && invoiceQuery.error.kind === 'notFound';
    return (
      <Card pad={32}>
        {isMissing ? (
          <EmptyState
            icon="file-text"
            title="Invoice not found."
            message="It may have been removed, or the link is wrong."
            actionLabel="Back to billing"
            onAction={() => navigate(opsPath('billing'))}
          />
        ) : (
          <ErrorState
            inline
            title="This invoice didn't load"
            message={failureText(invoiceQuery.error, 'Please try again.')}
            onRetry={() => void invoiceQuery.refetch()}
          />
        )}
      </Card>
    );
  }
  return <InvoiceDetailBody invoice={invoiceQuery.data} />;
}
