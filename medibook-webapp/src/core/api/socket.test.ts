import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SocketStatus } from '@/core/api/socket';

const refreshAccessToken = vi.fn<() => Promise<string | null>>();
const getAccessToken = vi.fn<() => string | null>();

vi.mock('@/core/api/http', () => ({ refreshAccessToken: () => refreshAccessToken() }));
vi.mock('@/core/api/tokens', () => ({ getAccessToken: () => getAccessToken() }));
vi.mock('@/core/config/env', () => ({ WS_BASE_URL: 'ws://api.test' }));

/** A scripted stand-in for the browser WebSocket. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  readonly sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  readonly url: string;
  readonly protocols: readonly string[];

  constructor(url: string, protocols: readonly string[]) {
    this.url = url;
    this.protocols = protocols;
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code: number): void {
    this.onclose?.({ code });
  }

  /** The server accepts the handshake… */
  accept(): void {
    this.onopen?.();
  }

  /** …sends a frame… */
  push(type: string): void {
    this.onmessage?.({ data: JSON.stringify({ type, data: {}, ts: '2026-10-07T10:00:00Z' }) });
  }

  /** …or closes it. */
  serverClose(code: number): void {
    this.onclose?.({ code });
  }
}

async function flush(): Promise<void> {
  // Let the awaited token lookups and refreshes settle.
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function latest(): FakeSocket {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error('no socket opened');
  return socket;
}

describe('openSocket (UAT-43)', () => {
  let statuses: SocketStatus[];

  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    statuses = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    getAccessToken.mockReturnValue('access-1');
    refreshAccessToken.mockResolvedValue('access-2');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function open() {
    const { openSocket } = await import('@/core/api/socket');
    const frames: string[] = [];
    const handle = openSocket({
      path: '/hospital/queue',
      surface: 'hospital',
      onFrame: (frame) => frames.push(frame.type),
      onStatus: (status) => statuses.push(status),
    });
    await flush();
    return { handle, frames };
  }

  it('reports open only after the first real frame, and drops pongs', async () => {
    const { frames } = await open();
    const socket = latest();
    expect(socket.url).toBe('ws://api.test/ws/hospital/queue');
    expect(socket.protocols).toEqual(['bearer', 'access-1']);
    socket.accept();
    expect(statuses).not.toContain('open');
    expect(socket.sent).toContain(JSON.stringify({ type: 'ping' }));
    socket.push('pong');
    expect(statuses.at(-1)).toBe('open');
    socket.push('session.updated');
    expect(frames).toEqual(['session.updated']);
  });

  it('stops after a second 4401 when no frame arrived in between (no refresh loop)', async () => {
    await open();
    latest().accept();
    latest().serverClose(4401);
    await flush();
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('reconnecting');

    // The reconnect waits out the backoff instead of firing at once.
    expect(FakeSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(2);

    // Accepted, then refused again before any frame: give up.
    latest().accept();
    latest().serverClose(4401);
    await flush();
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('unauthorized');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('refreshes again after a 4401 once the socket had proved itself', async () => {
    await open();
    latest().accept();
    latest().push('pong');
    latest().serverClose(4401);
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    latest().accept();
    latest().push('pong');
    latest().serverClose(4401);
    await flush();
    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe('reconnecting');
  });

  it('stops for good on 4403', async () => {
    await open();
    latest().accept();
    latest().serverClose(4403);
    await flush();
    expect(statuses.at(-1)).toBe('forbidden');
    expect(refreshAccessToken).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('backs off exponentially on ordinary drops until a frame arrives', async () => {
    await open();
    latest().accept();
    latest().serverClose(1006);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    latest().accept();
    latest().serverClose(1006);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(3);
  });

  it('stays closed after close()', async () => {
    const { handle } = await open();
    latest().accept();
    handle.close();
    expect(statuses.at(-1)).toBe('closed');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
