import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SocketStatus } from '@/core/api/socket';

const refreshAccessToken = vi.fn<() => Promise<string | null>>();
const getAccessToken = vi.fn<() => string | null>();
const expiredListeners = new Set<(surface: string) => void>();

vi.mock('@/core/api/http', () => ({ refreshAccessToken: () => refreshAccessToken() }));
vi.mock('@/core/api/tokens', () => ({
  getAccessToken: () => getAccessToken(),
  onSessionExpired: (listener: (surface: string) => void) => {
    expiredListeners.add(listener);
    return () => expiredListeners.delete(listener);
  },
}));
vi.mock('@/core/config/env', () => ({ WS_BASE_URL: 'ws://api.test' }));

/** A scripted stand-in for the browser WebSocket. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static get all(): FakeSocket[] {
    return FakeSocket.instances;
  }
  static set all(val: FakeSocket[]) {
    FakeSocket.instances = val;
  }

  readonly sent: string[] = [];
  closedWith: number | null = null;
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

  close(code = 1000): void {
    this.closedWith = code;
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

  refuse(code = 1006): void {
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

describe('live-update socket (RUN-07)', () => {
  let online = true;
  let statuses: SocketStatus[] = [];

  async function open() {
    const { openSocket } = await import('@/core/api/socket');
    return openSocket({
      path: '/hospital/queue',
      surface: 'hospital',
      onFrame: () => undefined,
      onStatus: (s) => statuses.push(s),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    statuses = [];
    online = true;
    expiredListeners.clear();
    refreshAccessToken.mockReset();
    getAccessToken.mockReturnValue('token');
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('window', {
      location: { protocol: 'http:', host: 'localhost' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('navigator', {
      get onLine() {
        return online;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('drops a line that stops answering pings and opens a new one', async () => {
    await open();
    await vi.advanceTimersByTimeAsync(0);
    latest().accept();
    await vi.advanceTimersByTimeAsync(90_000); // pings at 30 s and 60 s go unanswered
    expect(FakeSocket.all[0]?.closedWith).toBe(4000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeSocket.all).toHaveLength(2);
    expect(statuses).toContain('reconnecting');
  });

  it('treats any frame as a sign of life', async () => {
    await open();
    await vi.advanceTimersByTimeAsync(0);
    latest().accept();
    for (let i = 0; i < 4; i += 1) {
      await vi.advanceTimersByTimeAsync(30_000);
      latest().push(i % 2 === 0 ? 'pong' : 'session.updated');
    }
    expect(FakeSocket.all).toHaveLength(1);
    expect(FakeSocket.all[0]?.closedWith).toBeNull();
  });

  it('refreshes the token after refused handshakes, then turns live updates off', async () => {
    refreshAccessToken.mockResolvedValue('new-token');
    await open();
    for (let i = 0; i < 6; i += 1) {
      await vi.advanceTimersByTimeAsync(0);
      latest().refuse();
      await vi.advanceTimersByTimeAsync(60_000);
    }
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(statuses[statuses.length - 1]).toBe('unauthorized');
    const attempts = FakeSocket.all.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeSocket.all).toHaveLength(attempts);
  });

  it('keeps retrying, without suspecting the token, while offline', async () => {
    online = false;
    await open();
    for (let i = 0; i < 6; i += 1) {
      await vi.advanceTimersByTimeAsync(0);
      latest().refuse();
      await vi.advanceTimersByTimeAsync(60_000);
    }
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(statuses).not.toContain('unauthorized');
  });

  it('closes when its session ends', async () => {
    await open();
    await vi.advanceTimersByTimeAsync(0);
    latest().accept();
    for (const listener of expiredListeners) listener('hospital');
    expect(FakeSocket.all[0]?.closedWith).toBe(1000);
    expect(statuses[statuses.length - 1]).toBe('closed');
  });
});
