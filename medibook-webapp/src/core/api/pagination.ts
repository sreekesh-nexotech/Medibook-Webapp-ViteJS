import { z } from 'zod';

import { clientFailure } from '@/core/error/toFailure';

/**
 * Page-number pagination, the shape of every backend list (`core/pagination.py`):
 * `{results, page, page_size, total, has_next}`; `page_size` defaults to 25,
 * capped at 100. Every list endpoint answers with this envelope, even where
 * `schema.yml` documents a bare array — always parse lists with
 * `paginatedSchema`.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Safety stop for `fetchAllPages`: 50 pages of 100 rows. */
const ALL_PAGES_MAX = 50;

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

/** A validated page as the backend sends it. */
export interface PageDto<D> {
  readonly results: readonly D[];
  readonly page: number;
  readonly page_size: number;
  readonly total: number;
  readonly has_next: boolean;
}

/**
 * Read every page of a list, `MAX_PAGE_SIZE` rows at a time, and return the
 * rows in server order — for short lists a screen shows in full (bank
 * accounts, holidays, banners, sessions). Rather than hand back a silently
 * truncated list, it fails once the list runs past `ALL_PAGES_MAX` pages.
 */
export async function fetchAllPages<D>(
  fetchPage: (params: Required<PageParams>) => Promise<PageDto<D>>,
): Promise<D[]> {
  const rows: D[] = [];
  for (let page = 1; page <= ALL_PAGES_MAX; page += 1) {
    const dto = await fetchPage({ page, page_size: MAX_PAGE_SIZE });
    rows.push(...dto.results);
    if (!dto.has_next) return rows;
  }
  throw clientFailure(
    'unknown',
    'This list is too long to load in full. Narrow it down and try again.',
  );
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
