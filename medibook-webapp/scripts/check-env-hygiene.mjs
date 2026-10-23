#!/usr/bin/env node
// Secret-hygiene gate: everything VITE_* is bundled into the public app, so
// tracked env files and VITE_* values must look like public configuration.
// Node built-ins only.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const ALLOWED_TOKEN = /^[a-z0-9_-]{1,32}$/;
const ALLOWED_URL = /^(?:(?:https?|wss?):\/\/\S+|\/\S*)$/;

/** Empty, a URL or relative path, `same-origin`, a boolean flag, or a short enum token. */
function isAllowedValue(raw) {
  const value = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  return value === '' || ALLOWED_URL.test(value) || ALLOWED_TOKEN.test(value);
}

// 1. No tracked .env* file other than .env.example.
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
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
      const match = /^\s*(VITE_[A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
      if (match && !isAllowedValue(match[2])) {
        problems.push(
          `.env.example:${index + 1}: ${match[1]} has a value that is not a URL, boolean or short enum token.`,
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
