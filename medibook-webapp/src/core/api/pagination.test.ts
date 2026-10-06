import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  MAX_PAGE_SIZE,
  fetchAllPages,
  paginatedSchema,
  toPage,
  type PageDto,
  fetchCappedPages,
} from '@/core/api/pagination';
import { isFailure } from '@/core/error/failure';

function page<D>(results: D[], pageNo: number, hasNext: boolean): PageDto<D> {
  return { results, page: pageNo, page_size: MAX_PAGE_SIZE, total: 0, has_next: hasNext };
}

describe('paginatedSchema', () => {
  const rows = paginatedSchema(z.object({ id: z.string() }));

  it('accepts the backend page envelope', () => {
    const parsed = rows.parse({
      results: [{ id: 'a' }],
      page: 1,
      page_size: 25,
      total: 1,
      has_next: false,
    });
    expect(parsed.results).toEqual([{ id: 'a' }]);
  });

  it('refuses a bare array, which is how five screens broke (CORE-01)', () => {
    expect(rows.safeParse([{ id: 'a' }]).success).toBe(false);
  });
});

describe('fetchAllPages', () => {
  it('reads every page at the largest page size and keeps server order', async () => {
    const fetchPage = vi
      .fn<(params: { page: number; page_size: number }) => Promise<PageDto<string>>>()
      .mockResolvedValueOnce(page(['a', 'b'], 1, true))
      .mockResolvedValueOnce(page(['c'], 2, false));

    await expect(fetchAllPages(fetchPage)).resolves.toEqual(['a', 'b', 'c']);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { page: 1, page_size: MAX_PAGE_SIZE });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { page: 2, page_size: MAX_PAGE_SIZE });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('fails instead of returning a silently truncated list', async () => {
    const fetchPage = vi.fn(async ({ page: n }: { page: number }) => page([n], n, true));
    const error: unknown = await fetchAllPages(fetchPage).catch((e: unknown) => e);
    expect(isFailure(error)).toBe(true);
    if (isFailure(error)) expect(error.message).toMatch(/too long to load in full/);
    expect(fetchPage.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('toPage', () => {
  it('maps the envelope and each row', () => {
    const dto: PageDto<{ n: number }> = {
      results: [{ n: 1 }, { n: 2 }],
      page: 2,
      page_size: 2,
      total: 5,
      has_next: true,
    };
    expect(toPage(dto, (row) => row.n * 10)).toEqual({
      items: [10, 20],
      page: 2,
      pageSize: 2,
      total: 5,
      hasNext: true,
    });
  });
});

describe('fetchCappedPages (DATA-07)', () => {
  const pages = (count: number) => async (page: number) => ({
    results: [page],
    has_next: page < count,
  });

  it('reads every page of a short list and says it is complete', async () => {
    expect(await fetchCappedPages(pages(3), 5)).toEqual({ rows: [1, 2, 3], truncated: false });
  });

  it('stops at the cap and says the list went on', async () => {
    expect(await fetchCappedPages(pages(9), 2)).toEqual({ rows: [1, 2], truncated: true });
  });
});
