import { describe, expect, it } from 'vitest';

import {
  FILE_STORE_NOT_READY_CODE,
  FILE_STORE_NOT_READY_MESSAGE,
  assertFileStoreReady,
  isFileStoreUrl,
  isPlaceholderFileUrl,
} from '@/core/api/fileUrls';

const STORE = 'https://medibook-files.s3.ap-south-1.amazonaws.com';

/** The link a server without real storage signs (app-dev, UB-02). */
const FAKE_STORE_LINK =
  'https://storage.fake.local/medibook-private/hospital/h1/receipt_pdf/r1?X-Op=get&X-Expires=600';

describe('isFileStoreUrl', () => {
  it('accepts a signed https link on the configured file store', () => {
    expect(isFileStoreUrl(`${STORE}/exports/report.csv?X-Amz-Signature=abc`, STORE)).toBe(true);
  });

  it('refuses another host, plain http and anything that is not a URL', () => {
    expect(isFileStoreUrl('https://evil.example/report.csv', STORE)).toBe(false);
    expect(isFileStoreUrl('http://medibook-files.s3.ap-south-1.amazonaws.com/x', STORE)).toBe(
      false,
    );
    expect(isFileStoreUrl('javascript:alert(1)', STORE)).toBe(false);
    expect(isFileStoreUrl('/relative/path', STORE)).toBe(false);
  });

  it('accepts any https host when no file store is configured', () => {
    expect(isFileStoreUrl('https://files.example.test/a.pdf', '')).toBe(true);
    expect(isFileStoreUrl('http://files.example.test/a.pdf', '')).toBe(false);
  });

  it('allows plain http only for a file store on this machine', () => {
    expect(isFileStoreUrl('http://localhost:9000/bucket/a.pdf', '')).toBe(true);
    expect(isFileStoreUrl('http://127.0.0.1:9000/bucket/a.pdf', 'http://127.0.0.1:9000')).toBe(
      true,
    );
  });
});

describe('isPlaceholderFileUrl', () => {
  it('spots a link on a placeholder .local store', () => {
    expect(isPlaceholderFileUrl(FAKE_STORE_LINK)).toBe(true);
  });

  it('leaves real stores, this machine and non-URLs alone', () => {
    expect(isPlaceholderFileUrl(`${STORE}/exports/report.csv`)).toBe(false);
    expect(isPlaceholderFileUrl('http://localhost:9000/bucket/a.pdf')).toBe(false);
    expect(isPlaceholderFileUrl('/relative/path')).toBe(false);
  });
});

describe('assertFileStoreReady', () => {
  it('refuses a placeholder link with the coming-soon message', () => {
    expect(() => assertFileStoreReady(FAKE_STORE_LINK)).toThrow(
      expect.objectContaining({
        kind: 'unavailable',
        code: FILE_STORE_NOT_READY_CODE,
        message: FILE_STORE_NOT_READY_MESSAGE,
      }),
    );
  });

  it('lets a real file-store link through', () => {
    expect(() => assertFileStoreReady(`${STORE}/exports/report.csv`)).not.toThrow();
  });
});
