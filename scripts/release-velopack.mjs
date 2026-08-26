#!/usr/bin/env node
/**
 * Baut die Anwendung und schnuert daraus ein Velopack-Release.
 *
 * Tauri bundelt nicht mehr selbst (`bundle.active: false`), liefert also nur
 * das nackte Programm unter `target/release`. Das Frontend steckt im Kompilat,
 * eigene Ressourcen daneben gibt es seit ADR-0009 keine mehr.
 *
 * Aufruf:
 *   node scripts/release-velopack.mjs                 nur bauen und packen
 *   node scripts/release-velopack.mjs --upload        zusaetzlich zu GitHub
 *   node scripts/release-velopack.mjs --skip-build    vorhandenes Kompilat nutzen
 *   node scripts/release-velopack.mjs --skip-download ohne Vorgaenger, kein Delta
 *
 * `RELEASE_VERSION` uebersteuert die Version aus `tauri.conf.json`.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAURI_DIR = path.join(ROOT, 'src-tauri');
const RELEASE_DIR = path.join(TAURI_DIR, 'target', 'release');
const STAGE_DIR = path.join(TAURI_DIR, 'target', 'velopack-stage');
const OUTPUT_DIR = path.join(TAURI_DIR, 'target', 'velopack-releases');

export const PACK_ID = 'PoELevelingGuide';
export const REPO_URL = 'https://github.com/mkj777/poe-leveling-app';

/**
 * Velopack besteht auf reinem SemVer. Ein fuehrendes `v` aus einem Git-Tag
 * wuerde es zurueckweisen, deshalb faellt es hier weg.
 */
export function normaliseVersion(raw) {
  const trimmed = String(raw).trim();
  const version = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;

  if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version)) {
    throw new Error(`Keine gueltige SemVer-Version: ${raw}`);
  }

  return version;
}

/**
 * `vpk` und `yarn` sind auf Windows Batch-Wrapper, die nur ueber die Shell
 * startbar sind. Node reicht die Argumente dann aber unveraendert an
 * `cmd.exe` weiter, das sie an Leerzeichen zerlegt: aus
 * `--mainExe PoE Leveling Guide.exe` werden drei Argumente. Deshalb hier
 * selbst klammern.
 */
export function quoteArg(value) {
  const text = String(value);
  return /[\s"]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

export function commandLine(command, args) {
  return [command, ...args].map(quoteArg).join(' ');
}

function run(command, args) {
  // Als eine fertige Zeile statt als Argumentliste, weil Node sonst warnt,
  // dass es bei `shell: true` nicht escaped. Escaped wird hier.
  const result = spawnSync(commandLine(command, args), {
    stdio: 'inherit',
    shell: true,
    cwd: ROOT
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} endete mit ${result.status}`);
  }
}

function stage(exeName) {
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGE_DIR, { recursive: true });

  const exe = path.join(RELEASE_DIR, exeName);
  if (!fs.existsSync(exe)) {
    throw new Error(`Kompilat fehlt: ${exe}`);
  }
  fs.copyFileSync(exe, path.join(STAGE_DIR, exeName));

  // Tauri linkt den WebView2-Loader statisch, andere Laufzeit-DLLs koennen
  // aber je nach Toolchain danebenliegen. Was da ist, kommt mit.
  for (const entry of fs.readdirSync(RELEASE_DIR)) {
    if (entry.toLowerCase().endsWith('.dll')) {
      fs.copyFileSync(
        path.join(RELEASE_DIR, entry),
        path.join(STAGE_DIR, entry)
      );
    }
  }

  return STAGE_DIR;
}

/**
 * Holt das zuletzt veroeffentlichte Paket in das Ausgabeverzeichnis.
 *
 * `vpk pack` rechnet ein Delta nur gegen ein Paket, das dort schon liegt. Der
 * CI-Runner startet leer, deshalb enthielten 0.92.0 und 0.93.0 ausschliesslich
 * volle Pakete und jedes Update lud 5,5 MB statt rund 90 KB. Lokal war das nie
 * aufgefallen, weil dort die Vorgaengerversion vom vorigen Lauf noch herumlag.
 */
function downloadPrevious(token) {
  const args = [
    'download',
    'github',
    '--repoUrl',
    REPO_URL,
    '--outputDir',
    OUTPUT_DIR
  ];

  if (token) args.push('--token', token);

  run('vpk', args);
}

/**
 * Liegt ein aelteres volles Paket daneben, muss nach dem Packen ein Delta
 * entstanden sein. Trifft das nicht zu, ist der Download stillschweigend ins
 * Leere gelaufen, und genau dieses stille Durchrutschen hat den Fehler zwei
 * Releases lang verdeckt. Beim allerersten Release gibt es keinen Vorgaenger,
 * dann greift die Pruefung nicht.
 */
export function deltaMissing(files, version) {
  const hasPrevious = files.some(
    (name) => name.endsWith('-full.nupkg') && !name.includes(`-${version}-`)
  );
  const hasDelta = files.includes(`${PACK_ID}-${version}-delta.nupkg`);

  return hasPrevious && !hasDelta;
}

function main() {
  const args = process.argv.slice(2);
  const config = JSON.parse(
    fs.readFileSync(path.join(TAURI_DIR, 'tauri.conf.json'), 'utf8')
  );
  const version = normaliseVersion(process.env.RELEASE_VERSION ?? config.version);
  const exeName = `${config.mainBinaryName}.exe`;

  if (!args.includes('--skip-build')) {
    run('yarn', ['tauri', 'build', '--no-bundle']);
  }

  stage(exeName);

  if (!args.includes('--skip-download')) {
    downloadPrevious(process.env.GITHUB_TOKEN);
  }

  run('vpk', [
    'pack',
    '--packId', PACK_ID,
    '--packVersion', version,
    '--packDir', STAGE_DIR,
    '--packTitle', config.productName,
    '--packAuthors', 'Maximilian Kielholz',
    '--mainExe', exeName,
    '--icon', path.join(TAURI_DIR, 'icons', 'icon.ico'),
    '--outputDir', OUTPUT_DIR,
    // WebView2 ist auf Windows 11 vorhanden, auf aelteren Staenden nicht.
    // Das Setup holt es dann nach, statt beim Start ins Leere zu greifen.
    '--framework', 'webview2'
  ]);

  if (deltaMissing(fs.readdirSync(OUTPUT_DIR), version)) {
    throw new Error(
      `Kein Delta fuer ${version} entstanden, obwohl ein aelteres Paket daneben liegt`
    );
  }

  if (args.includes('--upload')) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN fehlt, ohne Token kein Upload');
    }

    run('vpk', [
      'upload', 'github',
      '--outputDir', OUTPUT_DIR,
      '--repoUrl', REPO_URL,
      '--token', token,
      '--tag', `v${version}`,
      '--releaseName', `v${version}`,
      '--merge',
      '--publish'
    ]);
  }

  console.log(`\nFertig. Pakete liegen unter ${OUTPUT_DIR}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
