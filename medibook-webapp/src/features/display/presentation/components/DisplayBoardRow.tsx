import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import {
  BOARD_COLUMN_SPANS,
  BOARD_GRID,
  type BoardRow,
  offTodayLabel,
  sessionStateLabel,
  tokenNumber,
  waitingLabel,
} from '@/features/display/presentation/components/display.view';

/** A room code longer than this gets the smaller room size so it still fits its column. */
const SHORT_ROOM_MAX = 4;

const [DOCTOR_COL, PATIENT_COL, ROOM_COL, TOKEN_COL] = BOARD_COLUMN_SPANS;

/**
 * One doctor on the hall board: who they are seeing now, in which room, on which token. Sized with
 * the `board-*` tokens (a share of the board's width) so the same row reads from across the hall
 * on a TV and fits the admin's preview. A doctor whose day is over, or who has no session today,
 * is greyed out (client decision 5).
 */
export function DisplayBoardRow({ row }: { row: BoardRow }) {
  if (row.kind === 'off') {
    const { doctor } = row;
    const label = offTodayLabel(doctor);
    return (
      <RowShell
        muted
        label={`${doctor.name}, ${label}`}
        doctor={doctor.name}
        detail={null}
        patient={<span className="text-board-state">{label}</span>}
        room={doctor.room}
        token={null}
      />
    );
  }

  const { session } = row;
  const token = tokenNumber(session);
  const closed = session.status === 'closed';
  const state = sessionStateLabel(session);
  const detail = [session.label, closed ? null : waitingLabel(session.waitingCount)]
    .filter(Boolean)
    .join(' · ');
  return (
    <RowShell
      muted={closed}
      label={`${session.doctorName}, ${state}${token && !closed ? `, token ${token}` : ''}`}
      doctor={session.doctorName}
      detail={detail || null}
      patient={
        session.currentPatient && !closed ? (
          <span className="text-board-patient line-clamp-2 uppercase">
            {session.currentPatient}
          </span>
        ) : (
          <span className="text-board-state opacity-80">{state}</span>
        )
      }
      room={session.room ?? session.counterCode}
      token={closed ? null : token}
    />
  );
}

interface RowShellProps {
  muted: boolean;
  label: string;
  doctor: string;
  detail: string | null;
  patient: ReactNode;
  room: string | null;
  token: string | null;
}

function RowShell({ muted, label, doctor, detail, patient, room, token }: RowShellProps) {
  return (
    <li
      aria-label={label}
      className={cn(
        BOARD_GRID,
        'h-board-row rounded-board shadow-card overflow-hidden',
        muted && 'opacity-60 grayscale',
      )}
    >
      <div
        className={cn(
          DOCTOR_COL,
          'bg-bg-surface px-board-pad flex min-w-0 flex-col justify-center',
        )}
      >
        <p className="text-board-name text-text-strong line-clamp-2">{doctor}</p>
        {detail ? <p className="text-board-meta text-text-muted truncate">{detail}</p> : null}
      </div>
      <div
        className={cn(
          PATIENT_COL,
          'px-board-pad flex min-w-0 items-center justify-center text-center',
          muted ? 'bg-grey-300 text-text-muted' : 'bg-blue-soft-bg text-text-navy',
        )}
      >
        {patient}
      </div>
      <div
        className={cn(
          ROOM_COL,
          'flex min-w-0 items-center justify-center px-2 text-white',
          muted ? 'bg-grey-800' : 'bg-p-400',
        )}
      >
        <span
          className={cn(
            'truncate',
            room && room.length > SHORT_ROOM_MAX ? 'text-board-room-long' : 'text-board-room',
          )}
        >
          {room ?? ''}
        </span>
      </div>
      <div
        className={cn(
          TOKEN_COL,
          'text-board-token flex min-w-0 items-center justify-center px-2 text-white',
          muted ? 'bg-grey-900' : 'bg-p-500',
        )}
      >
        <span className="truncate">{token ?? ''}</span>
      </div>
    </li>
  );
}
