import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// @ts-expect-error The script is plain JavaScript without type declarations.
import {
  PACK_ID,
  REPO_URL,
  commandLine,
  deltaMissing,
  normaliseVersion,
  quoteArg
} from '../release-velopack.mjs';

describe('normaliseVersion', () => {
  it('takes plain SemVer unchanged', () => {
    expect(normaliseVersion('0.2.0')).toBe('0.2.0');
  });

  it('strips the v from a git tag', () => {
    // Velopack rejects a leading v, but GitHub tags carry it.
    expect(normaliseVersion('v1.4.12')).toBe('1.4.12');
  });

  it('keeps pre-release markers', () => {
    expect(normaliseVersion('v2.0.0-beta.1')).toBe('2.0.0-beta.1');
    expect(normaliseVersion('1.0.0+build7')).toBe('1.0.0+build7');
  });

  it('swallows whitespace from a shell variable', () => {
    expect(normaliseVersion('  v0.3.1\n')).toBe('0.3.1');
  });

  const invalid = ['', 'v', '1.2', 'latest', '1.2.3.4', 'vv1.2.3', 'a.b.c'];

  for (const value of invalid) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(() => normaliseVersion(value)).toThrow(/Not a valid SemVer/);
    });
  }
});

describe('release target', () => {
  it('keeps the pack id free of characters Velopack dislikes', () => {
    // The id ends up in file names and in the installation path.
    expect(PACK_ID).toMatch(/^[A-Za-z0-9_.-]+$/);
  });

  it('points at the same repo as the updater in the backend', () => {
    const rust = fs.readFileSync(
      path.resolve(__dirname, '../../src-tauri/src/updater.rs'),
      'utf8'
    );

    expect(rust).toContain(`"${REPO_URL}"`);
  });
});

describe('quoteArg', () => {
  it('leaves harmless arguments alone', () => {
    expect(quoteArg('--packId')).toBe('--packId');
    expect(quoteArg('C:/without/spaces')).toBe('C:/without/spaces');
  });

  it('quotes spaces, otherwise cmd.exe splits the file name', () => {
    expect(quoteArg('PoE Leveling Guide.exe')).toBe('"PoE Leveling Guide.exe"');
  });

  it('escapes embedded quotes', () => {
    expect(quoteArg('a"b')).toBe('"a\\"b"');
  });

  it('assembles the whole line', () => {
    expect(commandLine('vpk', ['--mainExe', 'PoE Guide.exe'])).toBe(
      'vpk --mainExe "PoE Guide.exe"'
    );
  });
});

describe('deltaMissing', () => {
  const files = (...names: string[]) => names;

  it('fires when a predecessor is present and no delta was produced', () => {
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

  it('is satisfied when the delta sits next to it', () => {
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

  it('lets the very first release through, there is no predecessor', () => {
    expect(
      deltaMissing(files(`${PACK_ID}-0.94.0-full.nupkg`, 'RELEASES'), '0.94.0')
    ).toBe(false);
  });

  it('does not mistake its own full package for a predecessor', () => {
    // The file name of the running version contains the version itself.
    // Checking only for "-full.nupkg" would always produce a hit.
    expect(deltaMissing(files(`${PACK_ID}-0.94.0-full.nupkg`), '0.94.0')).toBe(
      false
    );
  });

  it('handles an empty directory', () => {
    expect(deltaMissing([], '0.94.0')).toBe(false);
  });
});
