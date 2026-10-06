import { describe, expect, it } from 'vitest';

import { isFileStoreUrl } from '@/core/api/fileUrls';

const STORE = 'https://medibook-files.s3.ap-south-1.amazonaws.com';

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
