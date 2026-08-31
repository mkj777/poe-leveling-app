// Kopiert den Route-Parser aus einem lokalen Klon von HeartofPhos/exile-leveling.
// Aufruf: node scripts/vendor-exile-leveling.mjs [pfad-zum-klon]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const UPSTREAM = process.argv[2] ?? path.resolve('..', 'exile-leveling');
const TARGET = path.resolve('src', 'lib', 'exile-leveling');

// data.ts und index.ts sind bewusst nicht dabei, die schreiben wir selbst.
const FILES = [
  'types.d.ts',
  'route-processing/index.ts',
  'route-processing/patterns.ts',
  'route-processing/scoped-logger.ts',
  'route-processing/gems.ts',
  'route-processing/fragment/index.ts',
  'route-processing/fragment/language.ts'
];

const HEADER = [
  '// Generiert von scripts/vendor-exile-leveling.mjs, nicht bearbeiten.',
  '// Quelle: https://github.com/HeartofPhos/exile-leveling (MIT)',
  ''
].join('\n');

function stripJsExtensions(source) {
  return source.replace(
    /(from\s+["'])(\.[^"']*?)\.js(["'])/g,
    (_match, head, specifier, tail) => `${head}${specifier}${tail}`
  );
}

const sha = execFileSync('git', ['-C', UPSTREAM, 'rev-parse', 'HEAD'])
  .toString()
  .trim();

for (const file of FILES) {
  const from = path.join(UPSTREAM, 'common', 'src', file);
  const to = path.join(TARGET, file);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  // Die Typdeklaration bleibt unberuehrt, dort stoert ein Kommentarblock nur.
  const prefix = file.endsWith('.d.ts') ? '' : HEADER;
  fs.writeFileSync(
    to,
    prefix + stripJsExtensions(fs.readFileSync(from, 'utf8')),
    'utf8'
  );
}

fs.writeFileSync(
  path.join(TARGET, 'ATTRIBUTION.md'),
  [
    '# Attribution',
    '',
    'Die Dateien in `route-processing/` und `types.d.ts` stammen aus',
    'https://github.com/HeartofPhos/exile-leveling (Lizenz MIT).',
    '',
    `Kopierstand: \`${sha}\``,
    '',
    'Aenderungen gegenueber dem Original:',
    '',
    '1. `.js`-Endungen relativer Importe entfernt, damit die Aufloesung unter',
    '   `moduleResolution: bundler` funktioniert.',
    '2. Ein Kommentarkopf, der auf Herkunft und Generator hinweist.',
    '',
    'Der Code besteht die strikte Typpruefung dieses Projekts unveraendert,',
    'es ist kein `@ts-nocheck` noetig.',
    '',
    'Erzeugt von `scripts/vendor-exile-leveling.mjs`, nicht von Hand bearbeiten.',
    '',
    '`data.ts`, `index.ts` und `build-route.ts` in diesem Verzeichnis sind eigener Code.',
    '',
    '## Icons',
    '',
    '`src/assets/exile-leveling/*.png` stammen aus demselben Projekt,',
    '`web/src/components/FragmentStep/Fragment/images/`. Die Farbwerte in',
    '`src/utilities/fragment-style.ts` folgen dessen `styles.module.css`.',
    ''
  ].join('\n'),
  'utf8'
);

console.log(`vendored ${FILES.length} Dateien von ${sha}`);
