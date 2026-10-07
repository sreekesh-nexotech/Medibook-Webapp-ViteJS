import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SocketStatus } from '@/core/api/socket';

const refreshAccessToken = vi.fn<(surface: string) => Promise<string | null>>();
const getAccessToken = vi.fn<(surface: string) => string | null>();

vi.mock('@/core/api/http', () => ({ refreshAccessToken: (s: string) => refreshAccessToken(s) }));
vi.mock('@/core/api/tokens', () => ({ getAccessToken: (s: string) => getAccessToken(s) }));
vi.mock('@/core/config/env', () => ({ WS_BASE_URL: 'ws://api.test' }));

/** A scriptable stand-in for the browser's WebSocket. */
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

  close(): void {
    this.onclose?.({ code: 1000 });
  }

  /** Server side: accept the upgrade. */
  open(): void {
    this.onopen?.();
  }

  /** Server side: push a frame. */
  push(type: string): void {
    this.onmessage?.({ data: JSON.stringify({ type, data: {}, ts: '2026-10-07T10:00:00Z' }) });
  }

  /** Server side: close with a code. */
  drop(code: number): void {
    this.onclose?.({ code });
  }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

async function load() {
  return (await import('@/core/api/socket')).openSocket;
}

describe('openSocket retry rules (UAT-43)', () => {
  let statuses: SocketStatus[];

  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    statuses = [];
    getAccessToken.mockReturnValue('jwt-1');
    refreshAccessToken.mockResolvedValue('jwt-2');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    refreshAccessToken.mockReset();
    getAccessToken.mockReset();
  });

  it('is only "open" once the first pong arrives, not on the upgrade', async () => {
    const openSocket = await load();
    openSocket({
      path: '/hospital/queue',
      surface: 'hospital',
      onFrame: () => undefined,
      onStatus: (s) => statuses.push(s),
    });
    await flush();
    const ws = FakeSocket.instances[0];
    expect(ws.url).toBe('ws://api.test/ws/hospital/queue');
    expect(ws.protocols).toEqual(['bearer', 'jwt-1']);
    ws.open();
    expect(statuses.at(-1)).toBe('connecting');
    expect(ws.sent).toEqual([JSON.stringify({ type: 'ping' })]);
    ws.push('pong');
    expect(statuses.at(-1)).toBe('open');
  });

  it('refreshes once on a refused socket, backs off, then stops instead of looping', async () => {
    const openSocket = await load();
    openSocket({
      path: '/hospital/queue',
      surface: 'hospital',
      onFrame: () => undefined,
      onStatus: (s) => statuses.push(s),
    });
    await flush();
    // Accepted, then closed at once with 4401 (the server's refusal).
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].drop(4401);
    await flush();
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('reconnecting');
    // No immediate reconnect: it waits for the backoff delay.
    expect(FakeSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].open();
    FakeSocket.instances[1].drop(4401);
    await flush();
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('unauthorized');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('allows a fresh refresh after a healthy socket later expires', async () => {
    const openSocket = await load();
    openSocket({
      path: '/hospital/queue',
      surface: 'hospital',
      onFrame: () => undefined,
      onStatus: (s) => statuses.push(s),
    });
    await flush();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].drop(4401);
    await flush();
    await vi.advanceTimersByTimeAsync(1_000);
    const second = FakeSocket.instances[1];
    second.open();
    second.push('pong');
    expect(statuses.at(-1)).toBe('open');
    // The token expires an hour later: one more refresh is allowed.
    second.drop(4401);
    await flush();
    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe('reconnecting');
  });

  it('stops for good on 4403 (no permission)', async () => {
    const openSocket = await load();
    openSocket({
      path: '/hospital/queue',
      surface: 'hospital',
      onFrame: () => undefined,
      onStatus: (s) => statuses.push(s),
    });
    await flush();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].drop(4403);
    await flush();
    expect(statuses.at(-1)).toBe('forbidden');
    expect(refreshAccessToken).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('passes real frames on and reconnects with backoff after a network drop', async () => {
    const frames: string[] = [];
    const openSocket = await load();
    openSocket({
      path: '/hospital/queue',
      surface: 'hospital',
      onFrame: (f) => frames.push(f.type),
      onStatus: (s) => statuses.push(s),
    });
    await flush();
    const ws = FakeSocket.instances[0];
    ws.open();
    ws.push('session.updated');
    expect(frames).toEqual(['session.updated']);
    expect(statuses.at(-1)).toBe('open');
    ws.drop(1006);
    expect(statuses.at(-1)).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('does not reconnect after the consumer closes it', async () => {
    const openSocket = await load();
    const handle = openSocket({
      path: '/hospital/queue',
      surface: 'hospital',
      onFrame: () => undefined,
      onStatus: (s) => statuses.push(s),
    });
    await flush();
    FakeSocket.instances[0].open();
    handle.close();
    expect(statuses.at(-1)).toBe('closed');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
