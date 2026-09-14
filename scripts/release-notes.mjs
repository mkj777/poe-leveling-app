#!/usr/bin/env node
/**
 * Reads the section of one version from `CHANGELOG.md`.
 *
 * The release workflow calls this twice: once before building, only to abort
 * if the entry is missing, and once afterwards to set the description of the
 * GitHub release. `vpk upload` cannot set a description, which is why the
 * releases stayed empty up to 0.95.0.
 *
 * Usage:
 *   node scripts/release-notes.mjs 0.96.0     writes the section to stdout
 *
 * If the section is missing, the call exits with code 1. A release without a
 * changelog should show up within seconds, not as an empty page on GitHub.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');

/**
 * The section between `## <version> (...)` and the next `## ` line, without
 * the heading itself. `null` if it does not exist or is empty.
 */
export function extractNotes(changelog, version) {
  const lines = String(changelog).split(/\r?\n/);

  // The space after the version is part of the comparison: otherwise "0.9"
  // would find the section of "0.95.0".
  const start = lines.findIndex((line) => line.startsWith(`## ${version} `));
  if (start === -1) return null;

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();

  return body === '' ? null : body;
}

function main() {
  const version = process.argv[2];

  if (!version) {
    console.error('Usage: node scripts/release-notes.mjs <version>');
    process.exit(1);
  }

  const notes = extractNotes(fs.readFileSync(CHANGELOG_PATH, 'utf8'), version);

  if (notes === null) {
    console.error(
      `CHANGELOG.md has no section for ${version}. Expected a line "## ${version} (YYYY-MM-DD)".`
    );
    process.exit(1);
  }

  process.stdout.write(`${notes}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
