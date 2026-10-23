#!/usr/bin/env node
// Secret-hygiene gate: everything VITE_* is bundled into the public app, so
// tracked env files and VITE_* values must look like public configuration.
// Node built-ins only.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// An optional directory argument lets the self-checks point at temp fixtures.
const customRoot = process.argv[2];
const root = customRoot
  ? resolve(customRoot)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

/**
 * Enum-like values a VITE_* setting may hold. Derived from .env.example, where
 * the only non-URL, non-boolean setting is VITE_API_BASE_URL / VITE_WS_BASE_URL
 * = `same-origin`. Add a value here only when a new setting really needs it;
 * an open-ended token pattern would also accept keys like `sk_live_abc123`.
 */
const ALLOWED_ENUM_VALUES = new Set(['same-origin']);
const ALLOWED_BOOLEANS = new Set(['true', 'false', '0', '1']);
// Absolute URLs, or a same-origin path such as `/api`. Paths are lowercase
// segments only (no `_`, no uppercase) and may not start with `//`, so neither
// `/sk_live_abc123` nor protocol-relative `//user:pass@host` is accepted.
const ALLOWED_URL = /^(?:(?:https?|wss?):\/\/[^\s/?#]+[^\s]*|\/(?!\/)[a-z0-9\-./]*)$/;

/** True for a URL whose authority carries `user[:password]@`. */
function hasUserinfo(value) {
  return /^(?:https?|wss?):\/\/[^/?#\s]*@/.test(value);
}

/** dotenv semantics: a quoted value ends at its closing quote; otherwise ` # comment` is stripped. */
function unquote(raw) {
  const text = raw.trim();
  const quoted = /^(['"`])(.*?)\1\s*(?:#.*)?$/.exec(text);
  if (quoted) return quoted[2];
  return text.replace(/(?:^|\s)#.*$/, '').trim();
}

/** Empty, a credential-free URL or relative path, `same-origin`, or a boolean flag. */
function isAllowedValue(raw) {
  const value = unquote(raw);
  if (value === '' || ALLOWED_ENUM_VALUES.has(value) || ALLOWED_BOOLEANS.has(value)) return true;
  return ALLOWED_URL.test(value) && !hasUserinfo(value);
}

// 1. No tracked .env* file other than .env.example.
let tracked = [];
try {
  tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', customRoot ? 'ignore' : 'inherit'],
  })
    .split('\0')
    .filter(Boolean);
} catch (error) {
  if (!customRoot) throw error;
}
for (const file of tracked) {
  const name = basename(file);
  if (name.startsWith('.env') && name !== '.env.example') {
    problems.push(`${file} is tracked by git; only .env.example may be committed.`);
  }
}

// 2. Every VITE_* value in .env.example is public-looking.
const examplePath = resolve(root, '.env.example');
if (existsSync(examplePath)) {
  readFileSync(examplePath, 'utf8')
    .split(/\r?\n/)
    .forEach((line, index) => {
      const match = /^\s*(?:export\s+)?(VITE_[A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
      if (match && !isAllowedValue(match[2])) {
        problems.push(
          `.env.example:${index + 1}: ${match[1]} has a value that is not an empty value, a credential-free URL, a boolean or a known enum value.`,
        );
      }
    });
}

// 3. vite.config.ts `define` entries may only read VITE_* environment keys.
const configPath = resolve(root, 'vite.config.ts');
if (existsSync(configPath)) {
  const source = readFileSync(configPath, 'utf8');
  const start = /\bdefine\s*:\s*\{/.exec(source);
  if (start) {
    let depth = 1;
    let i = start.index + start[0].length;
    const bodyStart = i;
    for (; i < source.length && depth > 0; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
    }
    const body = source.slice(bodyStart, i - 1);
    const reads = body.matchAll(
      /\b(?:process\.env|env)\s*(?:\.\s*([A-Za-z_]\w*)|\[\s*['"]([^'"]+)['"]\s*\])/g,
    );
    // A whole-environment reference ships every value: bare `process.env`, or
    // `env` spread, used as a value, or passed to JSON.stringify / Object.*.
    // Passing `env` to a local helper (e.g. buildCommit(env)) is allowed.
    const wholeEnv =
      /\bprocess\.env\b(?!\s*[.[])/.test(body) ||
      /(?:\.\.\.\s*|:\s*|\b(?:JSON\.stringify|Object\.\w+)\(\s*)env\b(?!\s*[.[])/.test(body);
    if (wholeEnv) {
      problems.push(
        'vite.config.ts define uses the whole environment object; read VITE_* keys one by one.',
      );
    }
    for (const read of reads) {
      const key = read[1] ?? read[2];
      if (!key.startsWith('VITE_')) {
        problems.push(`vite.config.ts define reads ${key}, which does not start with VITE_.`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error('Env hygiene check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('Env hygiene check passed.');
