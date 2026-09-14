import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// @ts-expect-error The script is plain JavaScript without type declarations.
import { extractNotes } from '../release-notes.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  'Preamble that does not belong in a release.',
  '',
  '## 0.96.0 (2026-08-27)',
  '',
  '### Internal',
  '',
  '- Node 24.',
  '',
  '## 0.95.0 (2026-08-27)',
  '',
  '### Fixed',
  '',
  '- Progress survives a restart.',
  '- No more jumping back.',
  '',
  '## 0.94.0 (2026-08-26)',
  '',
  '- Deltas.',
  ''
].join('\n');

describe('extractNotes', () => {
  it('takes exactly the section of one version', () => {
    expect(extractNotes(CHANGELOG, '0.95.0')).toBe(
      ['### Fixed', '', '- Progress survives a restart.', '- No more jumping back.'].join(
        '\n'
      )
    );
  });

  it('does not append the next section', () => {
    expect(extractNotes(CHANGELOG, '0.96.0')).not.toContain('0.95.0');
    expect(extractNotes(CHANGELOG, '0.96.0')).not.toContain('restart');
  });

  it('leaves the preamble out', () => {
    expect(extractNotes(CHANGELOG, '0.96.0')).not.toContain('Preamble');
  });

  it('handles the last section of the file', () => {
    expect(extractNotes(CHANGELOG, '0.94.0')).toBe('- Deltas.');
  });

  it('returns null when the version is missing', () => {
    expect(extractNotes(CHANGELOG, '9.9.9')).toBeNull();
  });

  it('does not confuse a version that starts with the same digits', () => {
    // "0.9" must not match "0.95.0", otherwise one release would get the
    // notes of another.
    expect(extractNotes(CHANGELOG, '0.9')).toBeNull();
  });

  it('returns null for an empty section', () => {
    const empty = ['## 1.0.0 (2026-01-01)', '', '## 0.9.0 (2025-12-01)', '', '- something'].join('\n');

    expect(extractNotes(empty, '1.0.0')).toBeNull();
  });

  it('finds every published version in the real changelog', () => {
    const changelog = fs.readFileSync(
      path.resolve(__dirname, '../../CHANGELOG.md'),
      'utf8'
    );

    for (const version of ['0.91.0', '0.92.0', '0.93.0', '0.94.0', '0.95.0']) {
      const notes = extractNotes(changelog, version);
      expect(notes, `section for ${version} is missing`).not.toBeNull();
      expect(notes!.length).toBeGreaterThan(40);
    }
  });

  it('keeps the changelog and the app version together', () => {
    // A release without an entry should show up early, not when reading the
    // empty description on GitHub.
    const version = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../src-tauri/tauri.conf.json'),
        'utf8'
      )
    ).version as string;

    const changelog = fs.readFileSync(
      path.resolve(__dirname, '../../CHANGELOG.md'),
      'utf8'
    );

    expect(extractNotes(changelog, version)).not.toBeNull();
  });
});
