#!/usr/bin/env node
/**
 * Liest den Abschnitt einer Version aus `CHANGELOG.md`.
 *
 * Der Release-Workflow ruft das zweimal: einmal vor dem Bauen, nur um
 * abzubrechen, wenn der Eintrag fehlt, und einmal danach, um die Beschreibung
 * des GitHub-Releases zu setzen. `vpk upload` kann keine Beschreibung setzen,
 * die Releases blieben deshalb bis 0.95.0 leer.
 *
 * Aufruf:
 *   node scripts/release-notes.mjs 0.96.0     schreibt den Abschnitt nach stdout
 *
 * Fehlt der Abschnitt, endet der Aufruf mit Code 1. Ein Release ohne Changelog
 * soll in Sekunden auffallen und nicht erst als leere Seite auf GitHub.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');

/**
 * Der Abschnitt zwischen `## <version> (...)` und der naechsten `## `-Zeile,
 * ohne die Ueberschrift selbst. `null`, wenn es ihn nicht gibt oder er leer
 * ist.
 */
export function extractNotes(changelog, version) {
  const lines = String(changelog).split(/\r?\n/);

  // Das Leerzeichen hinter der Version gehoert zum Vergleich: sonst faende
  // "0.9" den Abschnitt von "0.95.0".
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
    console.error('Aufruf: node scripts/release-notes.mjs <version>');
    process.exit(1);
  }

  const notes = extractNotes(fs.readFileSync(CHANGELOG_PATH, 'utf8'), version);

  if (notes === null) {
    console.error(
      `CHANGELOG.md hat keinen Abschnitt fuer ${version}. Erwartet wird eine Zeile "## ${version} (JJJJ-MM-TT)".`
    );
    process.exit(1);
  }

  process.stdout.write(`${notes}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
