import { type ReactNode, useRef, useState } from 'react';

import { cn } from '@/shared/lib/cn';

import type { DisplayBoard } from '@/features/display/domain/entities/display.types';
import { DisplayBoardRow } from '@/features/display/presentation/components/DisplayBoardRow';
import {
  BOARD_COLUMN_SPANS,
  BOARD_GRID,
  boardDateLabel,
  boardRows,
  pageOf,
} from '@/features/display/presentation/components/display.view';
import { useBoardPaging } from '@/features/display/presentation/hooks/useBoardPaging';

const COLUMN_TITLES = ['Consultant', 'Patient', 'Room', 'Token'] as const;

interface DisplayBoardViewProps {
  board: DisplayBoard;
  /** Shown between the header and the rows (the "Now calling" banner, a reconnect notice). */
  children?: ReactNode;
}

/**
 * The board a hall screen shows, laid out after the client's reference screen (point 7): the
 * hospital's logo and name (and department, when the screen is tied to one) with today's date in
 * small, then one row per doctor under CONSULTANT | PATIENT | ROOM | TOKEN, in Medibook's colours.
 * Rows that do not fit are paged automatically. It fills its parent and sizes itself from its own
 * width, so the TV page and the admin's preview (a 16:9 box) show exactly the same board.
 */
export function DisplayBoardView({ board, children }: DisplayBoardViewProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const rows = boardRows(board);
  const { perPage, page, pages } = useBoardPaging(boardRef, areaRef, rows.length);
  const shown = pageOf(rows, perPage, page);

  return (
    <div ref={boardRef} className="@container h-full w-full">
      <div className="gap-board-gap p-board-pad flex h-full flex-col">
        <header className="bg-bg-surface rounded-board px-board-pad py-board-gap shadow-card gap-board-pad flex items-center">
          <HospitalLogo logo={board.logo} />
          <div className="min-w-0 flex-1">
            <h1 className="text-board-title text-text-navy truncate">{board.hospitalName}</h1>
            {board.departmentName ? (
              <p className="text-board-subtitle text-text-muted truncate">{board.departmentName}</p>
            ) : null}
          </div>
          <p className="text-board-meta text-text-muted shrink-0">{boardDateLabel(board.date)}</p>
        </header>
        {children}
        {rows.length === 0 ? (
          <p className="text-board-subtitle text-text-muted">No consultations are running today.</p>
        ) : (
          <>
            <div className={cn(BOARD_GRID, 'text-board-column text-text-muted uppercase')}>
              {COLUMN_TITLES.map((title, i) => (
                <p
                  key={title}
                  className={cn(BOARD_COLUMN_SPANS[i], i === 0 ? 'px-board-pad' : 'text-center')}
                >
                  {title}
                </p>
              ))}
            </div>
            <div ref={areaRef} className="min-h-0 flex-1 overflow-hidden">
              <ul className="gap-board-gap flex flex-col" aria-label="Doctors and their tokens">
                {shown.map((row) => (
                  <DisplayBoardRow key={row.key} row={row} />
                ))}
              </ul>
            </div>
            {pages > 1 ? (
              <p className="text-board-meta text-text-muted text-right" aria-live="polite">
                Page {page + 1} of {pages}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The hospital logo, if it has one. The server signs a fresh URL on every refresh; the image keeps
 * the URL it first loaded for the same file, so the TV does not re-download it every 15 seconds,
 * and switches to the newest URL only if that one stops working (after it expires).
 */
function HospitalLogo({ logo }: { logo: DisplayBoard['logo'] }) {
  const [shown, setShown] = useState(logo);
  const [broken, setBroken] = useState<string | null>(null);
  if (logo?.fileId !== shown?.fileId) setShown(logo);
  else if (shown && shown.url === broken && logo && logo.url !== broken) setShown(logo); // re-signed
  if (!shown || shown.url === broken) return null; // never a broken-image icon on the TV
  return (
    <img
      src={shown.url}
      alt=""
      className="h-board-logo w-auto shrink-0 object-contain"
      onError={() => {
        if (logo && logo.url !== shown.url) setShown(logo);
        else setBroken(shown.url);
      }}
    />
  );
}
