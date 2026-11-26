import { type RefObject, useEffect, useState } from 'react';

import { pageCount, rowsThatFit } from '@/features/display/presentation/components/display.view';

/** A row is this share of the board's width tall: the `--spacing-board-row` token (6cqw). */
export const ROW_HEIGHT_CQW = 6;
/** The gap between rows: the `--spacing-board-gap` token (0.6cqw). */
export const ROW_GAP_CQW = 0.6;
/** How long one page of rows stays up before the next one (client feedback point 7). */
export const PAGE_MS = 10_000;

/**
 * Pages through the board's rows when they do not all fit on the screen: measures the space the
 * rows have (it changes with the TV, the window and the "Now calling" banner) and turns the page
 * every {@link PAGE_MS}. Without `ResizeObserver` (tests, very old browsers) every row is shown.
 */
export function useBoardPaging(
  boardRef: RefObject<HTMLElement | null>,
  areaRef: RefObject<HTMLElement | null>,
  rowCount: number,
): { perPage: number; page: number; pages: number } {
  const [perPage, setPerPage] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const board = boardRef.current;
    const area = areaRef.current;
    if (!board || !area || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const cqw = board.clientWidth / 100;
      setPerPage(rowsThatFit(area.clientHeight, ROW_HEIGHT_CQW * cqw, ROW_GAP_CQW * cqw));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    observer.observe(area);
    return () => observer.disconnect();
  }, [boardRef, areaRef]);

  const pages = pageCount(rowCount, perPage);
  useEffect(() => {
    if (pages <= 1) return;
    const timer = window.setInterval(() => setPage((p) => p + 1), PAGE_MS);
    return () => window.clearInterval(timer);
  }, [pages]);

  return { perPage, page: page % pages, pages };
}
