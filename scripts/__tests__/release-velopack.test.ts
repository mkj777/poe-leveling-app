import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// @ts-expect-error Das Skript ist reines JavaScript ohne Typdeklarationen.
import {
  PACK_ID,
  REPO_URL,
  commandLine,
  deltaMissing,
  normaliseVersion,
  quoteArg
} from '../release-velopack.mjs';

describe('normaliseVersion', () => {
  it('nimmt reines SemVer unveraendert', () => {
    expect(normaliseVersion('0.2.0')).toBe('0.2.0');
  });

  it('streift das v aus einem Git-Tag', () => {
    // Velopack weist ein fuehrendes v zurueck, GitHub-Tags tragen es aber.
    expect(normaliseVersion('v1.4.12')).toBe('1.4.12');
  });

  it('laesst Vorabkennzeichen stehen', () => {
    expect(normaliseVersion('v2.0.0-beta.1')).toBe('2.0.0-beta.1');
    expect(normaliseVersion('1.0.0+build7')).toBe('1.0.0+build7');
  });

  it('frisst Leerraum aus einer Shell-Variable', () => {
    expect(normaliseVersion('  v0.3.1\n')).toBe('0.3.1');
  });

  const invalid = ['', 'v', '1.2', 'latest', '1.2.3.4', 'vv1.2.3', 'a.b.c'];

  for (const value of invalid) {
    it(`weist ${JSON.stringify(value)} zurueck`, () => {
      expect(() => normaliseVersion(value)).toThrow(/Keine gueltige SemVer/);
    });
  }
});

describe('Release-Ziel', () => {
  it('haelt Pack-Id frei von Zeichen, die Velopack nicht mag', () => {
    // Die Id landet in Dateinamen und im Installationspfad.
    expect(PACK_ID).toMatch(/^[A-Za-z0-9_.-]+$/);
  });

  it('zeigt auf dasselbe Repo wie der Updater im Backend', () => {
    const rust = fs.readFileSync(
      path.resolve(__dirname, '../../src-tauri/src/updater.rs'),
      'utf8'
    );

    expect(rust).toContain(`"${REPO_URL}"`);
  });
});

describe('quoteArg', () => {
  it('laesst harmlose Argumente in Ruhe', () => {
    expect(quoteArg('--packId')).toBe('--packId');
    expect(quoteArg('C:/ohne/leerzeichen')).toBe('C:/ohne/leerzeichen');
  });

  it('klammert Leerzeichen, sonst zerlegt cmd.exe den Dateinamen', () => {
    expect(quoteArg('PoE Leveling Guide.exe')).toBe('"PoE Leveling Guide.exe"');
  });

  it('entschaerft eingebettete Anfuehrungszeichen', () => {
    expect(quoteArg('a"b')).toBe('"a\\"b"');
  });

  it('setzt die ganze Zeile zusammen', () => {
    expect(commandLine('vpk', ['--mainExe', 'PoE Guide.exe'])).toBe(
      'vpk --mainExe "PoE Guide.exe"'
    );
  });
});

describe('deltaMissing', () => {
  const files = (...names: string[]) => names;

  it('schlaegt an, wenn ein Vorgaenger daliegt und kein Delta entstand', () => {
    expect(
      deltaMissing(
        files(
          `${PACK_ID}-0.93.0-full.nupkg`,
          `${PACK_ID}-0.94.0-full.nupkg`,
          'RELEASES'
        ),
        '0.94.0'
      )
    ).toBe(true);
  });

  it('ist zufrieden, wenn das Delta danebenliegt', () => {
    expect(
      deltaMissing(
        files(
          `${PACK_ID}-0.93.0-full.nupkg`,
          `${PACK_ID}-0.94.0-full.nupkg`,
          `${PACK_ID}-0.94.0-delta.nupkg`
        ),
        '0.94.0'
      )
    ).toBe(false);
  });

  it('laesst das allererste Release durch, dort gibt es keinen Vorgaenger', () => {
    expect(
      deltaMissing(files(`${PACK_ID}-0.94.0-full.nupkg`, 'RELEASES'), '0.94.0')
    ).toBe(false);
  });

  it('haelt das eigene volle Paket nicht fuer einen Vorgaenger', () => {
    // Der Dateiname der laufenden Version enthaelt die Version selbst. Wer
    // hier nur auf "-full.nupkg" prueft, bekommt immer einen Treffer.
    expect(deltaMissing(files(`${PACK_ID}-0.94.0-full.nupkg`), '0.94.0')).toBe(
      false
    );
  });

  it('kommt mit einem leeren Verzeichnis zurecht', () => {
    expect(deltaMissing([], '0.94.0')).toBe(false);
  });
});
