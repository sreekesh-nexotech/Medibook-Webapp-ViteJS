import type {
  DeliveryFilters,
  DeliveryListParams,
  MessageSendInput,
} from '@/features/messaging/domain/entities/messaging.entities';

/** `MessageSendRequest` (`schema.yml`). */
export interface MessageSendRequest {
  readonly appointment_id: string;
  readonly event_code: string;
  readonly channels: readonly string[];
}

/** Query params `GET /hospital/messaging/deliveries` accepts. */
export interface DeliveryQueryParams {
  readonly page?: number;
  readonly page_size: number;
  readonly sort: string;
  readonly status?: string;
  readonly channel?: string;
  readonly date_from?: string;
  readonly date_to?: string;
  readonly q?: string;
}

export function toMessageSendRequest(input: MessageSendInput): MessageSendRequest {
  return {
    appointment_id: input.appointmentId,
    event_code: input.eventCode,
    channels: input.channels,
  };
}

/** Filters only — omitted rather than sent empty. */
function filterParams(
  filters: DeliveryFilters,
): Pick<DeliveryQueryParams, 'status' | 'channel' | 'date_from' | 'date_to' | 'q'> {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
    ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
  };
}

export function toDeliveryQueryParams(params: DeliveryListParams): DeliveryQueryParams {
  return {
    page: params.page,
    page_size: params.pageSize,
    sort: `${params.sortDirection === 'desc' ? '-' : ''}${params.sortField}`,
    ...filterParams(params),
  };
}

/** Newest first, every page — what the CSV export walks. */
export function toExportQueryParams(
  filters: DeliveryFilters,
  pageSize: number,
): DeliveryQueryParams {
  return { page_size: pageSize, sort: '-queued_at', ...filterParams(filters) };
}
