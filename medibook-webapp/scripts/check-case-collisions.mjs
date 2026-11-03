#!/usr/bin/env node
// Fail when two tracked paths collide on a case-insensitive file system (PR-003 / DEF-039):
// macOS and Windows check-outs would silently keep one of them, and a module import such as
// `OpsSettingsForm` next to `opsSettingsForm.ts` made Vite resolve the wrong file there while
// Linux CI stayed green. Two checks: identical paths ignoring case, and module stems that
// differ only by case (the importable name without its extension). Runs in `npm run lint`.
import { execSync } from 'node:child_process';

const MODULE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
const byPath = new Map();
const byStem = new Map();
const clashes = [];
for (const file of files) {
  const lowered = file.toLowerCase();
  if (byPath.has(lowered)) clashes.push([byPath.get(lowered), file]);
  else byPath.set(lowered, file);
  if (!MODULE_EXT.test(file)) continue;
  const stem = lowered.replace(MODULE_EXT, '');
  if (/(^|\/)\./.test(stem) || /\.(test|spec|stories|d)$/.test(stem)) continue;
  const other = byStem.get(stem);
  if (other && other.replace(MODULE_EXT, '') !== file.replace(MODULE_EXT, '')) clashes.push([other, file]);
  else if (!other) byStem.set(stem, file);
}
if (clashes.length > 0) {
  console.error('Case-colliding paths (rename one of each pair):');
  for (const [a, b] of clashes) console.error(`  ${a}\n  ${b}`);
  process.exit(1);
}
console.log(`No case-colliding paths among ${files.length} tracked files.`);
