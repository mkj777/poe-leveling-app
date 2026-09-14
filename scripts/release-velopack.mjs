#!/usr/bin/env node
/**
 * Builds the application and wraps it into a Velopack release.
 *
 * Tauri no longer bundles itself (`bundle.active: false`), so it only
 * delivers the bare program under `target/release`. The frontend is inside
 * the executable; since ADR-0009 there are no resources next to it.
 *
 * Usage:
 *   node scripts/release-velopack.mjs                 build and pack only
 *   node scripts/release-velopack.mjs --upload        also upload to GitHub
 *   node scripts/release-velopack.mjs --skip-build    use the existing executable
 *   node scripts/release-velopack.mjs --skip-download no predecessor, no delta
 *
 * `RELEASE_VERSION` overrides the version from `tauri.conf.json`.
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
 * Velopack insists on plain SemVer. It would reject a leading `v` from a git
 * tag, so it is stripped here.
 */
export function normaliseVersion(raw) {
  const trimmed = String(raw).trim();
  const version = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;

  if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version)) {
    throw new Error(`Not a valid SemVer version: ${raw}`);
  }

  return version;
}

/**
 * On Windows, `vpk` and `yarn` are batch wrappers that can only be started
 * through the shell. Node then passes the arguments unchanged to `cmd.exe`,
 * which splits them at spaces: `--mainExe PoE Leveling Guide.exe` becomes
 * three arguments. Hence the quoting here.
 */
export function quoteArg(value) {
  const text = String(value);
  return /[\s"]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

export function commandLine(command, args) {
  return [command, ...args].map(quoteArg).join(' ');
}

function run(command, args) {
  // As one finished line instead of an argument list, because Node otherwise
  // warns that it does not escape with `shell: true`. Escaping happens here.
  const result = spawnSync(commandLine(command, args), {
    stdio: 'inherit',
    shell: true,
    cwd: ROOT
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
  }
}

function stage(exeName) {
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGE_DIR, { recursive: true });

  const exe = path.join(RELEASE_DIR, exeName);
  if (!fs.existsSync(exe)) {
    throw new Error(`Executable missing: ${exe}`);
  }
  fs.copyFileSync(exe, path.join(STAGE_DIR, exeName));

  // Tauri links the WebView2 loader statically, but other runtime DLLs may
  // sit next to it depending on the toolchain. Whatever is there comes along.
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
 * Fetches the most recently published package into the output directory.
 *
 * `vpk pack` computes a delta only against a package that is already there.
 * The CI runner starts empty, which is why 0.92.0 and 0.93.0 contained only
 * full packages and every update downloaded 5.5 MB instead of about 90 KB.
 * Locally this never showed, because the previous version from the last run
 * was still lying around.
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
 * If an older full package sits next to it, packing must have produced a
 * delta. If not, the download silently came up empty, and exactly that silent
 * slip hid the bug for two releases. The very first release has no
 * predecessor, then the check does not apply.
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
    // WebView2 is present on Windows 11, not on older installations. The
    // setup then fetches it instead of failing at startup.
    '--framework', 'webview2'
  ]);

  if (deltaMissing(fs.readdirSync(OUTPUT_DIR), version)) {
    throw new Error(
      `No delta produced for ${version} although an older package sits next to it`
    );
  }

  if (args.includes('--upload')) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN missing, no upload without a token');
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

  console.log(`\nDone. Packages are under ${OUTPUT_DIR}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
