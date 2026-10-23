#!/usr/bin/env node
// Fixtures for check-env-hygiene.mjs. Run with `npm run test:env-hygiene`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'check-env-hygiene.mjs');

function passes(content) {
  const dir = mkdtempSync(join(tmpdir(), 'envhyg-'));
  try {
    writeFileSync(join(dir, '.env.example'), content);
    execFileSync('node', [script, dir], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const rejected = {
  'bare-slash secret': 'VITE_X=/sk_live_abc123def456\n',
  'protocol-relative userinfo': 'VITE_X=//user:pass@h\n',
  'export-prefixed secret': 'export VITE_X=sk_live_abc123\n',
  'secret before comment': 'VITE_X=sk_live_abc123 # c\n',
};
const accepted = {
  'inline comment': 'VITE_X=true # c\n',
  'export prefix': 'export VITE_X=false\n',
  'relative path': 'VITE_X=/api/v1\n',
  'quoted with comment': 'VITE_X="same-origin" # c\n',
  url: 'VITE_X=http://localhost:8000\n',
};
for (const [name, c] of Object.entries(rejected)) {
  test(`rejects ${name}`, () => assert.equal(passes(c), false));
}
for (const [name, c] of Object.entries(accepted)) {
  test(`accepts ${name}`, () => assert.equal(passes(c), true));
}
