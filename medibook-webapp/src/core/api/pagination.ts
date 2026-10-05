import { z } from 'zod';

/**
 * Page-number pagination, the shape of every backend list (`core/pagination.py`):
 * `{results, page, page_size, total, has_next}`; `page_size` defaults to 25,
 * capped at 100.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Query params a paginated list accepts. */
export interface PageParams {
  readonly page?: number;
  readonly page_size?: number;
}

/** Zod schema for a page of `item`. */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    results: z.array(item),
    page: z.number().int(),
    page_size: z.number().int(),
    total: z.number().int(),
    has_next: z.boolean(),
  });
}

/** A page of entities — what repositories return upward (camelCase, readonly). */
export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasNext: boolean;
}

interface PageDto<D> {
  readonly results: readonly D[];
  readonly page: number;
  readonly page_size: number;
  readonly total: number;
  readonly has_next: boolean;
}

/** Map a validated page DTO to a `Page`, converting each row with `toEntity`. */
export function toPage<D, T>(dto: PageDto<D>, toEntity: (row: D) => T): Page<T> {
  return {
    items: dto.results.map(toEntity),
    page: dto.page,
    pageSize: dto.page_size,
    total: dto.total,
    hasNext: dto.has_next,
  };
}
