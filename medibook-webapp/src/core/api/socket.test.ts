import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SocketStatus } from '@/core/api/socket';

const refreshAccessToken = vi.fn<() => Promise<string | null>>();
const expiredListeners = new Set<(surface: string) => void>();

vi.mock('@/core/api/http', () => ({ refreshAccessToken: () => refreshAccessToken() }));
vi.mock('@/core/api/tokens', () => ({
  getAccessToken: () => 'token',
  onSessionExpired: (listener: (surface: string) => void) => {
    expiredListeners.add(listener);
    return () => expiredListeners.delete(listener);
  },
}));

const { openSocket } = await import('@/core/api/socket');

class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readonly sent: string[] = [];
  closedWith: number | null = null;
  constructor() {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000) {
    this.closedWith = code;
  }
  accept() {
    this.onopen?.();
  }
  push(type: string) {
    this.onmessage?.({ data: JSON.stringify({ type, data: null, ts: '2026-10-06T00:00:00Z' }) });
  }
  refuse() {
    this.onclose?.({ code: 1006 });
  }
}

const latest = () => FakeSocket.all[FakeSocket.all.length - 1];

let online = true;
let statuses: SocketStatus[] = [];

function open() {
  return openSocket({
    path: '/hospital/queue',
    surface: 'hospital',
    onFrame: () => undefined,
    onStatus: (s) => statuses.push(s),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
  statuses = [];
  online = true;
  expiredListeners.clear();
  refreshAccessToken.mockReset();
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

describe('live-update socket (RUN-07)', () => {
  it('drops a line that stops answering pings and opens a new one', async () => {
    open();
    await vi.advanceTimersByTimeAsync(0);
    latest().accept();
    await vi.advanceTimersByTimeAsync(90_000); // pings at 30 s and 60 s go unanswered
    expect(FakeSocket.all[0]?.closedWith).toBe(4000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeSocket.all).toHaveLength(2);
    expect(statuses).toContain('reconnecting');
  });

  it('treats any frame as a sign of life', async () => {
    open();
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
    open();
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
    open();
    for (let i = 0; i < 6; i += 1) {
      await vi.advanceTimersByTimeAsync(0);
      latest().refuse();
      await vi.advanceTimersByTimeAsync(60_000);
    }
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(statuses).not.toContain('unauthorized');
  });

  it('closes when its session ends', async () => {
    open();
    await vi.advanceTimersByTimeAsync(0);
    latest().accept();
    for (const listener of expiredListeners) listener('hospital');
    expect(FakeSocket.all[0]?.closedWith).toBe(1000);
    expect(statuses[statuses.length - 1]).toBe('closed');
  });
});
