// Erzeugt die Golden-File-Erwartung mit dem UNVERAENDERTEN Upstream-Code.
// Der Oracle ist bewusst nicht unsere vendored Kopie, sonst pruefte der Test
// nichts. Aufruf ueber tsx, weil der Upstream .js-Specifier auf .ts-Dateien
// benutzt und JSON-Importe mit Import-Attributen laedt:
//
//   npx --yes tsx scripts/build-route-fixture.mts [pfad-zum-klon]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const UPSTREAM = process.argv[2] ?? path.resolve('..', 'exile-leveling');

const sha = execFileSync('git', ['-C', UPSTREAM, 'rev-parse', '--short', 'HEAD'])
  .toString()
  .trim();

const entry = pathToFileURL(
  path.join(UPSTREAM, 'common', 'src', 'index.ts')
).href;

const { getRouteFiles, initializeRouteState, parseRoute } = await import(entry);

const routesDir = path.join(UPSTREAM, 'common', 'data', 'routes');
const sources = Array.from({ length: 10 }, (_value, index) =>
  fs.readFileSync(path.join(routesDir, `act-${index + 1}.txt`), 'utf8')
);

// Defaults der Website, siehe web/src/state/build-data.ts und route.ts:
// leagueStart true, library true, bandit Alira, kein PoB-Import.
const state = initializeRouteState();
state.preprocessorDefinitions.add('LEAGUE_START');
state.preprocessorDefinitions.add('LIBRARY');
state.preprocessorDefinitions.add('BANDIT_ALIRA');

const route = parseRoute(getRouteFiles(sources), state);

const outDir = path.resolve('src', 'lib', 'exile-leveling', '__fixtures__');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `route-${sha}.json`);
fs.writeFileSync(out, JSON.stringify(route, null, 2), 'utf8');

console.log(`fixture geschrieben: ${out}`);
