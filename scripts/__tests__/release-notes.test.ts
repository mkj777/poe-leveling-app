import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// @ts-expect-error Das Skript ist reines JavaScript ohne Typdeklarationen.
import { extractNotes } from '../release-notes.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  'Vorspann, der nicht in ein Release gehoert.',
  '',
  '## 0.96.0 (2026-08-27)',
  '',
  '### Intern',
  '',
  '- Node 24.',
  '',
  '## 0.95.0 (2026-08-27)',
  '',
  '### Behoben',
  '',
  '- Fortschritt ueberlebt den Neustart.',
  '- Kein Ruecksprung mehr.',
  '',
  '## 0.94.0 (2026-08-26)',
  '',
  '- Deltas.',
  ''
].join('\n');

describe('extractNotes', () => {
  it('nimmt genau den Abschnitt einer Version', () => {
    expect(extractNotes(CHANGELOG, '0.95.0')).toBe(
      ['### Behoben', '', '- Fortschritt ueberlebt den Neustart.', '- Kein Ruecksprung mehr.'].join(
        '\n'
      )
    );
  });

  it('haengt den naechsten Abschnitt nicht an', () => {
    expect(extractNotes(CHANGELOG, '0.96.0')).not.toContain('0.95.0');
    expect(extractNotes(CHANGELOG, '0.96.0')).not.toContain('Neustart');
  });

  it('nimmt den Vorspann nicht mit', () => {
    expect(extractNotes(CHANGELOG, '0.96.0')).not.toContain('Vorspann');
  });

  it('kommt mit dem letzten Abschnitt der Datei zurecht', () => {
    expect(extractNotes(CHANGELOG, '0.94.0')).toBe('- Deltas.');
  });

  it('gibt null, wenn die Version fehlt', () => {
    expect(extractNotes(CHANGELOG, '9.9.9')).toBeNull();
  });

  it('verwechselt keine Version, die mit derselben Ziffernfolge beginnt', () => {
    // "0.9" darf nicht auf "0.95.0" passen, sonst bekaeme ein Release die
    // Notizen eines anderen.
    expect(extractNotes(CHANGELOG, '0.9')).toBeNull();
  });

  it('gibt null bei einem leeren Abschnitt', () => {
    const leer = ['## 1.0.0 (2026-01-01)', '', '## 0.9.0 (2025-12-01)', '', '- etwas'].join('\n');

    expect(extractNotes(leer, '1.0.0')).toBeNull();
  });

  it('findet jede veroeffentlichte Version im echten Changelog', () => {
    const changelog = fs.readFileSync(
      path.resolve(__dirname, '../../CHANGELOG.md'),
      'utf8'
    );

    for (const version of ['0.91.0', '0.92.0', '0.93.0', '0.94.0', '0.95.0']) {
      const notes = extractNotes(changelog, version);
      expect(notes, `Abschnitt fuer ${version} fehlt`).not.toBeNull();
      expect(notes!.length).toBeGreaterThan(40);
    }
  });

  it('haelt den Changelog und die Version der Anwendung zusammen', () => {
    // Ein Release ohne Eintrag soll frueh auffallen, nicht erst beim Lesen der
    // leeren Beschreibung auf GitHub.
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
