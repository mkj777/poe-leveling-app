#!/usr/bin/env node
/**
 * Baut die Anwendung und schnuert daraus ein Velopack-Release.
 *
 * Tauri bundelt nicht mehr selbst (`bundle.active: false`), liefert also nur
 * das nackte Programm unter `target/release`. Die Ressourcen, die frueher der
 * MSI-Bundler eingepackt hat, muessen deshalb hier von Hand neben die
 * ausfuehrbare Datei gelegt werden: zur Laufzeit sucht
 * `src/utilities/tauri.utilities.ts` sie unter `<resourceDir>/resources/zones`,
 * und `resourceDir` ist auf Windows das Verzeichnis der ausfuehrbaren Datei.
 *
 * Aufruf:
 *   node scripts/release-velopack.mjs              nur bauen und packen
 *   node scripts/release-velopack.mjs --upload     zusaetzlich zu GitHub
 *   node scripts/release-velopack.mjs --skip-build vorhandenes Kompilat nutzen
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

  // Alles, was Tauri unter `bundle.resources` gefuehrt hat, wandert
  // strukturgleich mit.
  fs.cpSync(
    path.join(TAURI_DIR, 'resources'),
    path.join(STAGE_DIR, 'resources'),
    { recursive: true }
  );

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
