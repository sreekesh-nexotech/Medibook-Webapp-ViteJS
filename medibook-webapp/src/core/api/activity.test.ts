import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StorageListener = (event: { key: string; newValue: string | null }) => void;

/** A minimal browser: one localStorage shared by "tabs", and a storage-event bus. */
function fakeWindow() {
  const store = new Map<string, string>();
  const storageListeners: StorageListener[] = [];
  return {
    store,
    emitStorage(key: string, newValue: string | null) {
      for (const listener of storageListeners) listener({ key, newValue });
    },
    window: {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
      sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      addEventListener: (type: string, listener: StorageListener) => {
        if (type === 'storage') storageListeners.push(listener);
      },
    },
  };
}

describe('core/api/activity (UAT-04, BE-21)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('marks reads as background once the user has been idle in every tab', async () => {
    const browser = fakeWindow();
    vi.stubGlobal('window', browser.window);
    const activity = await import('@/core/api/activity');
    const t0 = Date.now();
    // Page load counts as activity.
    expect(activity.isBackgroundTraffic('hospital', t0 + 1_000)).toBe(false);
    expect(activity.isBackgroundTraffic('hospital', t0 + activity.BACKGROUND_AFTER_MS + 1)).toBe(
      true,
    );
    activity.recordActivity('hospital', { now: t0 + 60_000 });
    expect(activity.isBackgroundTraffic('hospital', t0 + 61_000)).toBe(false);
    // Surfaces keep separate clocks.
    expect(activity.isBackgroundTraffic('platform', t0 + 61_000)).toBe(true);
  });

  it('shares activity through localStorage and wakes listeners on input in another tab', async () => {
    const browser = fakeWindow();
    vi.stubGlobal('window', browser.window);
    const activity = await import('@/core/api/activity');
    const t0 = Date.now();

    activity.recordActivity('hospital', { now: t0 + 5_000, force: true });
    expect(browser.store.get('medibook.activity.hospital')).toBe(String(t0 + 5_000));

    const heard: string[] = [];
    const unsubscribe = activity.subscribeActivity('hospital', (origin) => heard.push(origin));
    browser.emitStorage('medibook.activity.hospital', String(t0 + 600_000));
    expect(heard).toEqual(['remote']);
    expect(activity.lastActivityAt('hospital')).toBe(t0 + 600_000);

    // An older or foreign value is ignored.
    browser.emitStorage('medibook.activity.hospital', String(t0));
    browser.emitStorage('something.else', '1');
    expect(heard).toEqual(['remote']);
    unsubscribe();
  });

  it('throttles writes while the user keeps typing, unless forced', async () => {
    const browser = fakeWindow();
    vi.stubGlobal('window', browser.window);
    const activity = await import('@/core/api/activity');
    const t0 = Date.now();
    activity.recordActivity('platform', { now: t0 + 10_000 });
    activity.recordActivity('platform', { now: t0 + 10_500 });
    expect(browser.store.get('medibook.activity.platform')).toBe(String(t0 + 10_000));
    activity.recordActivity('platform', { now: t0 + 10_600, force: true });
    expect(browser.store.get('medibook.activity.platform')).toBe(String(t0 + 10_600));
  });
});
