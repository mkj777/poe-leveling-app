# Exile-Leveling-Sync und automatisches Overlay-Placement, Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der PoE-1-Kampagnen-Walkthrough kommt zur Laufzeit aus dem Upstream-Repository
`HeartofPhos/exile-leveling` und aktualisiert sich ohne App-Release, und das Overlay
platziert sich selbst am Spielfenster statt vom Nutzer gesetzt zu werden.

**Architecture:** Rust holt die Rohdaten (Route-DSL plus Spieldaten-JSON) per Conditional
GET von GitHub in einen sha-gepinnten Cache. Ein aus dem Upstream kopierter Parser
(`src/lib/exile-leveling/`) erzeugt daraus dieselbe Route wie die Website. Ein zweites
Rust-Modul koppelt sich per `SetWinEventHook` an das Spielfenster und meldet dessen Bounds,
aus denen das Frontend Position und Größe des Overlays berechnet.

**Tech Stack:** Tauri 1.5, Rust (winapi, reqwest/rustls-tls, serde), React 18, TypeScript
strict, Zustand, Vitest, Yarn 1.22.

**Spec:** [`../specs/2026-08-25-exile-leveling-sync-und-auto-overlay-design.md`](../specs/2026-08-25-exile-leveling-sync-und-auto-overlay-design.md)

**Entscheidungen:** [`../../adr/README.md`](../../adr/README.md)
**Begriffe:** [`../../glossary.md`](../../glossary.md)

## Global Constraints

- **Keine Gedankenstriche.** Kein `—` in Code, UI-Text, Kommentaren, Commit-Messages, Docs
  oder Antworten. Komma, Doppelpunkt, Punkt oder Klammern nutzen. En-Dash `–` bleibt für
  Bereiche erlaubt.
- **Paketmanager: Yarn 1.22.22.** Nie `npm install` benutzen. `yarn.lock` ist maßgeblich.
- **Zielplattform: Windows.** Das Overlay nutzt Win32 direkt. Rust-Code für Fenster und
  Prozesse steht in `#[cfg(target_os = "windows")]`.
- **TypeScript strict.** `tsconfig.json` hat `strict`, `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`. Alias `@` zeigt auf `./src`.
- **Tauri 1.5 Allowlist.** Neue Fähigkeiten müssen in `src-tauri/tauri.conf.json` unter
  `tauri.allowlist` eingetragen werden. Die CSP bleibt
  `default-src 'self'; img-src 'self' asset: https://asset.localhost` (ADR-0003).
- **Upstream-Stand:** `b7b2dd0`, geklont unter `../exile-leveling`. Alle Pfadangaben
  `common/...` beziehen sich auf dieses Verzeichnis.
- **Routenvariante fest:** `LEAGUE_START`, `LIBRARY`, `BANDIT_ALIRA`, keine Gem-Schritte
  (ADR-0007).
- **Deutsch in Dokumentation und Commit-Bodies, Englisch in Code und Bezeichnern.**

---

## Dateistruktur

**Neu:**

| Datei | Verantwortung |
|---|---|
| `scripts/vendor-exile-leveling.mjs` | kopiert den Upstream-Parser, schreibt Attribution, ist wiederholbar |
| `src/lib/exile-leveling/route-processing/**` | kopierter Parser, unverändert bis auf Import-Endungen |
| `src/lib/exile-leveling/types.d.ts` | kopierte Typdeklarationen |
| `src/lib/exile-leveling/data.ts` | **eigen**, ersetzt die statischen JSON-Imports durch den Laufzeit-Cache |
| `src/lib/exile-leveling/index.ts` | **eigen**, Re-Export der genutzten Symbole |
| `src/lib/exile-leveling/ATTRIBUTION.md` | **generiert**, Lizenz und sha |
| `src/services/route-sync.ts` | orchestriert Check, Fetch, Parse, Store |
| `src/store/route.store.ts` | hält `Route`, `currentEdge`, `sha`, `syncState` |
| `src/utilities/fragment-text.ts` | rendert ein Fragment zu Text |
| `src/utilities/overlay-geometry.ts` | reine Funktion `computeOverlayRect` |
| `src/hooks/usePoeWindow.ts` | hört `poe-bounds`, positioniert das Fenster |
| `src/components/overlay-edit-controls.tsx` | Ziehgriff und Skalenregler im Edit-Modus |
| `src-tauri/src/data_sync.rs` | Conditional GET, Download, Cache, Manifest |
| `src-tauri/src/overlay.rs` | Fenstersuche, WinEvent-Hook, `poe-bounds` |
| `src-tauri/src/game_paths.rs` | Client.txt-Pfad aus dem Spielprozess |
| `.github/workflows/upstream-watch.yml` | wöchentlicher Parser-Drift-Check |

**Geändert:** `package.json`, `vitest.config.ts` (neu), `src-tauri/Cargo.toml`,
`src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`, `src/store/settings.store.ts`,
`src/pages/main.page.tsx`, `src/pages/settings.page.tsx`, `src/components/navbar.tsx`,
`src/components/in-game-screen.tsx`, `src/components/levelling-guide-main.tsx`,
`src/components/levelling-guide.tsx`, `src/components/step-guide.tsx`,
`src/utilities/constants.ts`.

**Gelöscht:** `src/data/level-tracker-areas.ts`, `src/data/level-tracker-gems.ts`,
`src/data/level-tracker-quests.ts`, `src/data/guides/*.json`,
`src/interfaces/guide-import.interface.ts`, `src/interfaces/guide.interface.ts`,
`src/utilities/guide.schema.ts`, `src/utilities/guide.utilities.ts`,
`src/store/guide.store.ts`, `src/components/test-screen.tsx`.

---

## Task 1: Testinfrastruktur

Das Projekt hat heute keinen Testrunner. Ohne den kann keine der folgenden Aufgaben
TDD fahren.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/utilities/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `yarn test` (einmalig), `yarn test:watch`, Alias `@` in Tests nutzbar

- [ ] **Step 1: Abhängigkeiten installieren**

```bash
yarn install
```

- [ ] **Step 2: Vitest hinzufügen**

```bash
yarn add -D vitest@^2.1.8
```

- [ ] **Step 3: Testskripte eintragen**

In `package.json` unter `"scripts"` ergänzen:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: `vitest.config.ts` anlegen**

```ts
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
```

- [ ] **Step 5: Rauchtest schreiben, der zuerst fehlschlägt**

`src/utilities/__tests__/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('testinfrastruktur', () => {
  it('löst den @-Alias auf', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
});
```

- [ ] **Step 6: Test laufen lassen**

Run: `yarn test`
Expected: PASS, 1 Test. Schlägt der Alias fehl, ist `vitest.config.ts` falsch.

- [ ] **Step 7: Commit**

```bash
git add package.json yarn.lock vitest.config.ts src/utilities/__tests__/smoke.test.ts
git commit -m "test: Vitest als Testrunner einrichten"
```

---

## Task 2: Upstream-Parser vendoren

Der Parser wird per Skript kopiert, damit das Nachziehen bei Upstream-Änderungen ein
Befehl bleibt (ADR-0002). Der Upstream nutzt `module: nodenext` und schreibt darum
Importe mit `.js`-Endung. Vite und unser `moduleResolution: bundler` lösen das nicht auf,
also entfernt das Skript die Endung bei relativen Importen.

**Files:**
- Create: `scripts/vendor-exile-leveling.mjs`
- Create: `src/lib/exile-leveling/` (Inhalt generiert)
- Modify: `package.json`

**Interfaces:**
- Consumes: `../exile-leveling` auf sha `b7b2dd0`
- Produces: `src/lib/exile-leveling/route-processing/index.ts` mit
  `getRouteFiles(routeSources: string[]): RouteData.RouteFile[]`,
  `initializeRouteState(): RouteState`,
  `parseRoute(routeFiles: RouteData.RouteFile[], state: RouteState): RouteData.Route`

- [ ] **Step 1: Vendor-Skript schreiben**

`scripts/vendor-exile-leveling.mjs`:

```js
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
  fs.writeFileSync(to, stripJsExtensions(fs.readFileSync(from, 'utf8')), 'utf8');
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
    'Einzige Änderung: `.js`-Endungen relativer Importe entfernt, damit die Auflösung',
    'unter `moduleResolution: bundler` funktioniert. Erzeugt von',
    '`scripts/vendor-exile-leveling.mjs`, nicht von Hand bearbeiten.',
    '',
    '`data.ts` und `index.ts` in diesem Verzeichnis sind eigener Code.',
    ''
  ].join('\n'),
  'utf8'
);

console.log(`vendored ${FILES.length} Dateien von ${sha}`);
```

- [ ] **Step 2: Skript eintragen**

In `package.json` unter `"scripts"`:

```json
"vendor:exile-leveling": "node scripts/vendor-exile-leveling.mjs"
```

- [ ] **Step 3: Skript ausführen**

Run: `yarn vendor:exile-leveling`
Expected: `vendored 7 Dateien von b7b2dd0...`

- [ ] **Step 4: Prüfen, dass keine `.js`-Importe übrig sind**

Run: `grep -rn "\.js\"" src/lib/exile-leveling/ || echo "sauber"`
Expected: `sauber`

- [ ] **Step 5: Eigenen Daten-Loader schreiben**

`src/lib/exile-leveling/data.ts`. Ersetzt die statischen JSON-Importe des Upstreams.
`Data` ist bis zum ersten `setGameData` leer und wirft bei Zugriff, damit Reihenfolgefehler
laut scheitern statt still falsch zu rechnen.

```ts
import type { GameData } from './types';

export interface GameDataBundle {
  Areas: GameData.Areas;
  AwakenedGemLookup: GameData.VariantGemLookup;
  Characters: GameData.Characters;
  GemColours: GameData.GemColours;
  Gems: GameData.Gems;
  KillWaypoints: GameData.KillWaypoints;
  Quests: GameData.Quests;
  VaalGemLookup: GameData.VariantGemLookup;
}

let bundle: GameDataBundle | null = null;

export function setGameData(next: GameDataBundle) {
  bundle = next;
}

function require_(): GameDataBundle {
  if (bundle === null) {
    throw new Error('Spieldaten nicht geladen, setGameData zuerst aufrufen');
  }
  return bundle;
}

export const Data = {
  get Areas() {
    return require_().Areas;
  },
  get AwakenedGemLookup() {
    return require_().AwakenedGemLookup;
  },
  get Characters() {
    return require_().Characters;
  },
  get GemColours() {
    return require_().GemColours;
  },
  get Gems() {
    return require_().Gems;
  },
  get KillWaypoints() {
    return require_().KillWaypoints;
  },
  get Quests() {
    return require_().Quests;
  },
  get VaalGemLookup() {
    return require_().VaalGemLookup;
  }
};
```

- [ ] **Step 6: Eigenen Barrel-Export schreiben**

`src/lib/exile-leveling/index.ts`:

```ts
export { Data, setGameData } from './data';
export type { GameDataBundle } from './data';
export type { Fragments, GameData, RouteData } from './types';
export {
  getRouteFiles,
  initializeRouteState,
  parseRoute
} from './route-processing/index';
export type { RouteState } from './route-processing/index';
```

- [ ] **Step 7: Typprüfung laufen lassen**

Run: `yarn tsc --noEmit`
Expected: PASS.

Meldet `tsc` in Dateien unter `src/lib/exile-leveling/route-processing/` Fehler vom Typ
TS6133 oder TS6196 (nicht genutzte lokale Variable oder Parameter), dann ist das
Upstream-Stil und kein Fehler unseres Codes. In dem Fall in
`scripts/vendor-exile-leveling.mjs` vor `stripJsExtensions` einen Header setzen:

```js
const HEADER = '// @ts-nocheck\n// Generiert von scripts/vendor-exile-leveling.mjs, nicht bearbeiten.\n';
// im Schreib-Loop:
fs.writeFileSync(to, HEADER + stripJsExtensions(fs.readFileSync(from, 'utf8')), 'utf8');
```

Danach Step 3 und Step 7 wiederholen. `data.ts` und `index.ts` bekommen den Header nicht
und bleiben voll geprüft.

- [ ] **Step 8: Commit**

```bash
git add scripts/vendor-exile-leveling.mjs src/lib/exile-leveling package.json
git commit -m "feat: Route-Parser aus exile-leveling vendoren"
```

---

## Task 3: Golden-File-Test gegen einen lokalen Snapshot

Beweist, dass unser vendored Parser dasselbe erzeugt wie die Website. Läuft ohne Netz.

**Files:**
- Create: `src/lib/exile-leveling/__fixtures__/snapshot-b7b2dd0/` (kopierte Rohdaten)
- Create: `src/lib/exile-leveling/__fixtures__/route-b7b2dd0.json` (Erwartung)
- Create: `src/lib/exile-leveling/__tests__/parse-route.test.ts`
- Create: `scripts/build-route-fixture.mjs`

**Interfaces:**
- Consumes: `getRouteFiles`, `initializeRouteState`, `parseRoute`, `setGameData` aus Task 2
- Produces: `buildDefaultRoute(routes: string[], json: GameDataBundle): RouteData.Route`
  in `src/lib/exile-leveling/build-route.ts`

- [ ] **Step 1: Rohdaten-Snapshot ablegen**

```bash
mkdir -p src/lib/exile-leveling/__fixtures__/snapshot-b7b2dd0/routes
mkdir -p src/lib/exile-leveling/__fixtures__/snapshot-b7b2dd0/json
cp ../exile-leveling/common/data/routes/*.txt src/lib/exile-leveling/__fixtures__/snapshot-b7b2dd0/routes/
cp ../exile-leveling/common/data/json/*.json src/lib/exile-leveling/__fixtures__/snapshot-b7b2dd0/json/
ls src/lib/exile-leveling/__fixtures__/snapshot-b7b2dd0/routes | wc -l
```

Expected: `10`

- [ ] **Step 2: Erwartungsdatei mit dem Upstream-Code selbst erzeugen**

Der Oracle ist der unveränderte Upstream, nicht unsere Kopie. Damit prüft der Test
tatsächlich unsere Kopie plus Transformation.

`scripts/build-route-fixture.mjs`:

```js
// Erzeugt die Golden-File-Erwartung mit dem UNVERAENDERTEN Upstream-Code.
// Aufruf: node scripts/build-route-fixture.mjs [pfad-zum-klon]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const UPSTREAM = process.argv[2] ?? path.resolve('..', 'exile-leveling');
const sha = execFileSync('git', ['-C', UPSTREAM, 'rev-parse', '--short', 'HEAD'])
  .toString()
  .trim();

const common = path.join(UPSTREAM, 'common', 'src', 'index.ts');
const { getRouteFiles, initializeRouteState, parseRoute } = await import(
  path.toNamespacedPath ? `file://${common}` : common
);

const routesDir = path.join(UPSTREAM, 'common', 'data', 'routes');
const sources = Array.from({ length: 10 }, (_v, i) =>
  fs.readFileSync(path.join(routesDir, `act-${i + 1}.txt`), 'utf8')
);

const state = initializeRouteState();
state.preprocessorDefinitions.add('LEAGUE_START');
state.preprocessorDefinitions.add('LIBRARY');
state.preprocessorDefinitions.add('BANDIT_ALIRA');

const route = parseRoute(getRouteFiles(sources), state);
const out = path.resolve(
  'src/lib/exile-leveling/__fixtures__',
  `route-${sha}.json`
);
fs.writeFileSync(out, JSON.stringify(route, null, 2), 'utf8');
console.log(`fixture geschrieben: ${out}`);
```

Run: `node scripts/build-route-fixture.mjs`

Kann Node die TypeScript-Datei nicht direkt importieren, dann stattdessen im Upstream-Klon
ausführen, wo `tsx` verfügbar gemacht wird:

```bash
cd ../exile-leveling && npx --yes tsx ../poe-leveling-app/scripts/build-route-fixture.mjs .
```

Expected: `fixture geschrieben: .../route-b7b2dd0.json`

- [ ] **Step 3: Erwartung gegen den bekannten Referenz-Export prüfen**

Der Nutzer hat einen von der Website erzeugten Export vorgelegt. Diese Invarianten stammen
daraus und werden einmalig von Hand bestätigt:

```bash
node -e "
const r = require('./src/lib/exile-leveling/__fixtures__/route-b7b2dd0.json');
const flat = JSON.stringify(r);
console.log('sections:', r.sections.length);
console.log('namen:', r.sections.map(s => s.name).join(','));
console.log('gem_step vorhanden:', flat.includes('gem_step'));
console.log('Hailrake (LEAGUE_START):', flat.includes('Hailrake'));
console.log('Alira Darktongue (BANDIT_ALIRA):', flat.includes('Alira Darktongue'));
console.log('maxDirIndex:', Math.max(...[...flat.matchAll(/\"dirIndex\":(\d+)/g)].map(m => +m[1])));
console.log('erster step:', JSON.stringify(r.sections[0].steps[0]));
"
```

Expected:
```
sections: 10
namen: Act 1,Act 2,Act 3,Act 4,Act 5,Act 6,Act 7,Act 8,Act 9,Act 10
gem_step vorhanden: false
Hailrake (LEAGUE_START): true
Alira Darktongue (BANDIT_ALIRA): true
maxDirIndex: 7
erster step: {"type":"fragment_step","parts":["Find and kill ",{"type":"kill","value":"Hillock"}],"subSteps":[],"edgeIndex":0}
```

Weicht etwas ab, stimmen die Präprozessor-Definitionen nicht. Nicht weitermachen.

- [ ] **Step 4: Fehlschlagenden Test schreiben**

`src/lib/exile-leveling/__tests__/parse-route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { buildDefaultRoute } from '../build-route';
import type { GameDataBundle } from '../data';

const SNAPSHOT = path.resolve(__dirname, '../__fixtures__/snapshot-b7b2dd0');

function readRoutes(): string[] {
  return Array.from({ length: 10 }, (_v, i) =>
    fs.readFileSync(path.join(SNAPSHOT, 'routes', `act-${i + 1}.txt`), 'utf8')
  );
}

function readJson(name: string) {
  return JSON.parse(
    fs.readFileSync(path.join(SNAPSHOT, 'json', `${name}.json`), 'utf8')
  );
}

function readBundle(): GameDataBundle {
  return {
    Areas: readJson('areas'),
    AwakenedGemLookup: readJson('awakened-gem-lookup'),
    Characters: readJson('characters'),
    GemColours: readJson('gem-colours'),
    Gems: readJson('gems'),
    KillWaypoints: readJson('kill-waypoints'),
    Quests: readJson('quests'),
    VaalGemLookup: readJson('vaal-gem-lookup')
  };
}

describe('buildDefaultRoute', () => {
  it('erzeugt exakt die Route der Website', () => {
    const expected = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../__fixtures__/route-b7b2dd0.json'),
        'utf8'
      )
    );

    const actual = buildDefaultRoute(readRoutes(), readBundle());

    expect(JSON.parse(JSON.stringify(actual))).toEqual(expected);
  });

  it('enthält keine Gem-Schritte', () => {
    const actual = buildDefaultRoute(readRoutes(), readBundle());
    const types = actual.sections.flatMap((s) => s.steps.map((x) => x.type));

    expect(types).not.toContain('gem_step');
  });
});
```

- [ ] **Step 5: Test laufen lassen, Fehlschlag bestätigen**

Run: `yarn test src/lib/exile-leveling`
Expected: FAIL, `Cannot find module '../build-route'`

- [ ] **Step 6: `build-route.ts` schreiben**

`src/lib/exile-leveling/build-route.ts`:

```ts
import type { GameDataBundle } from './data';
import type { RouteData } from './types';
import { setGameData } from './data';
import {
  getRouteFiles,
  initializeRouteState,
  parseRoute
} from './route-processing/index';

// Feste Routenvariante, siehe ADR-0007. Entspricht den Defaults der Website:
// leagueStart true, library true, bandit Alira, kein PoB-Import.
const PREPROCESSOR_DEFINITIONS = ['LEAGUE_START', 'LIBRARY', 'BANDIT_ALIRA'];

export function buildDefaultRoute(
  routeSources: string[],
  gameData: GameDataBundle
): RouteData.Route {
  setGameData(gameData);

  const state = initializeRouteState();
  for (const definition of PREPROCESSOR_DEFINITIONS) {
    state.preprocessorDefinitions.add(definition);
  }

  return parseRoute(getRouteFiles(routeSources), state);
}
```

- [ ] **Step 7: Test laufen lassen**

Run: `yarn test src/lib/exile-leveling`
Expected: PASS, 2 Tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/exile-leveling scripts/build-route-fixture.mjs
git commit -m "test: Golden-File-Test fuer den vendored Route-Parser"
```

---

## Task 4: Rust-Datensync

**Files:**
- Create: `src-tauri/src/data_sync.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/main.rs`

**Interfaces:**
- Consumes: nichts aus früheren Tasks
- Produces: Tauri-Commands `check_upstream() -> UpstreamStatus`,
  `fetch_upstream(sha: String) -> ()`, `read_cached() -> Option<CachedData>`.
  `UpstreamStatus { changed: bool, sha: String }`,
  `CachedData { sha: String, routes: Vec<String>, json: HashMap<String, String> }`.
  Feldnamen erscheinen im Frontend als `changed`, `sha`, `routes`, `json`.

- [ ] **Step 1: Abhängigkeiten eintragen**

In `src-tauri/Cargo.toml` unter `[dependencies]` ergänzen:

```toml
reqwest = { version = "0.11", default-features = false, features = ["rustls-tls", "json"] }
```

`default-features = false` verhindert, dass `openssl` mit hereingezogen wird (ADR-0003).

- [ ] **Step 2: Modul schreiben**

`src-tauri/src/data_sync.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

const REPO: &str = "HeartofPhos/exile-leveling";
const USER_AGENT: &str = "poe-leveling-app";

const ROUTE_FILES: [&str; 10] = [
    "act-1", "act-2", "act-3", "act-4", "act-5", "act-6", "act-7", "act-8", "act-9", "act-10",
];

const JSON_FILES: [&str; 8] = [
    "areas",
    "awakened-gem-lookup",
    "characters",
    "gem-colours",
    "gems",
    "kill-waypoints",
    "quests",
    "vaal-gem-lookup",
];

#[derive(Serialize, Deserialize, Clone, Default)]
struct Manifest {
    sha: String,
    etag: String,
    fetched_at: String,
}

#[derive(Serialize)]
pub struct UpstreamStatus {
    pub changed: bool,
    pub sha: String,
}

#[derive(Serialize)]
pub struct CachedData {
    pub sha: String,
    pub routes: Vec<String>,
    pub json: HashMap<String, String>,
}

fn root(handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = handle
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "app_data_dir nicht verfuegbar".to_string())?
        .join("exile-leveling");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_manifest(handle: &tauri::AppHandle) -> Manifest {
    root(handle)
        .ok()
        .map(|d| d.join("manifest.json"))
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_manifest(handle: &tauri::AppHandle, manifest: &Manifest) -> Result<(), String> {
    let path = root(handle)?.join("manifest.json");
    let body = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    std::fs::write(path, body).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_upstream(handle: tauri::AppHandle) -> Result<UpstreamStatus, String> {
    let manifest = read_manifest(&handle);

    let url = format!(
        "https://api.github.com/repos/{}/commits?path=common/data&per_page=1",
        REPO
    );

    let client = reqwest::Client::new();
    let mut request = client.get(&url).header("User-Agent", USER_AGENT);
    if !manifest.etag.is_empty() {
        request = request.header("If-None-Match", manifest.etag.clone());
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    if response.status() == reqwest::StatusCode::NOT_MODIFIED {
        return Ok(UpstreamStatus {
            changed: false,
            sha: manifest.sha,
        });
    }

    if !response.status().is_success() {
        return Err(format!("GitHub antwortete {}", response.status()));
    }

    let etag = response
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string();

    let commits: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let sha = commits
        .get(0)
        .and_then(|c| c.get("sha"))
        .and_then(|s| s.as_str())
        .ok_or_else(|| "keine sha in der Antwort".to_string())?
        .to_string();

    let changed = sha != manifest.sha || !root(&handle)?.join(&sha).exists();

    write_manifest(
        &handle,
        &Manifest {
            sha: manifest.sha.clone(),
            etag,
            fetched_at: manifest.fetched_at.clone(),
        },
    )?;

    Ok(UpstreamStatus { changed, sha })
}

#[tauri::command]
pub async fn fetch_upstream(handle: tauri::AppHandle, sha: String) -> Result<(), String> {
    let base = root(&handle)?;
    let staging = base.join(format!(".staging-{}", sha));
    if staging.exists() {
        std::fs::remove_dir_all(&staging).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(staging.join("routes")).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(staging.join("json")).map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();

    for name in ROUTE_FILES.iter() {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/common/data/routes/{}.txt",
            REPO, sha, name
        );
        let body = download(&client, &url).await?;
        std::fs::write(staging.join("routes").join(format!("{}.txt", name)), body)
            .map_err(|e| e.to_string())?;
    }

    for name in JSON_FILES.iter() {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/common/data/json/{}.json",
            REPO, sha, name
        );
        let body = download(&client, &url).await?;
        std::fs::write(staging.join("json").join(format!("{}.json", name)), body)
            .map_err(|e| e.to_string())?;
    }

    let final_dir = base.join(&sha);
    if final_dir.exists() {
        std::fs::remove_dir_all(&final_dir).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&staging, &final_dir).map_err(|e| e.to_string())?;

    let mut manifest = read_manifest(&handle);
    manifest.sha = sha;
    manifest.fetched_at = chrono_now();
    write_manifest(&handle, &manifest)?;

    Ok(())
}

async fn download(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("{} antwortete {}", url, response.status()));
    }

    response.text().await.map_err(|e| e.to_string())
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    secs.to_string()
}

#[tauri::command]
pub async fn read_cached(handle: tauri::AppHandle) -> Result<Option<CachedData>, String> {
    let manifest = read_manifest(&handle);
    if manifest.sha.is_empty() {
        return Ok(None);
    }

    let dir = root(&handle)?.join(&manifest.sha);
    if !dir.exists() {
        return Ok(None);
    }

    let mut routes = Vec::new();
    for name in ROUTE_FILES.iter() {
        let path = dir.join("routes").join(format!("{}.txt", name));
        routes.push(std::fs::read_to_string(path).map_err(|e| e.to_string())?);
    }

    let mut json = HashMap::new();
    for name in JSON_FILES.iter() {
        let path = dir.join("json").join(format!("{}.json", name));
        json.insert(
            name.to_string(),
            std::fs::read_to_string(path).map_err(|e| e.to_string())?,
        );
    }

    Ok(Some(CachedData {
        sha: manifest.sha,
        routes,
        json,
    }))
}
```

- [ ] **Step 3: Modul registrieren**

In `src-tauri/src/main.rs` oben ergänzen:

```rust
mod data_sync;
```

und in `invoke_handler![...]` die drei Commands anhängen:

```rust
data_sync::check_upstream,
data_sync::fetch_upstream,
data_sync::read_cached
```

- [ ] **Step 4: Kompilieren**

Run: `cd src-tauri && cargo check`
Expected: `Finished` ohne Fehler. Der erste Lauf dauert mehrere Minuten, weil
`src-tauri/target` fehlt.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/data_sync.rs src-tauri/src/main.rs
git commit -m "feat: Upstream-Daten per Conditional GET in einen sha-gepinnten Cache holen"
```

---

## Task 5: Route-Store und Sync-Service

**Files:**
- Create: `src/store/route.store.ts`
- Create: `src/services/route-sync.ts`
- Create: `src/services/__tests__/route-sync.test.ts`

**Interfaces:**
- Consumes: `buildDefaultRoute` (Task 3), Commands aus Task 4
- Produces: `useRouteStore` mit
  `{ route: RouteData.Route | null, sha: string | null, currentEdge: number,
  syncState: 'idle' | 'syncing' | 'error', setRoute, setCurrentEdge }`,
  sowie `syncRoute(deps: SyncDeps): Promise<SyncResult>` und
  `parseCached(cached: CachedData): RouteData.Route`

- [ ] **Step 1: Store schreiben**

`src/store/route.store.ts`:

```ts
import type { RouteData } from '@/lib/exile-leveling';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SyncState = 'idle' | 'syncing' | 'error';

interface States {
  route: RouteData.Route | null;
  sha: string | null;
  currentEdge: number;
  syncState: SyncState;
  syncError: string | null;
}

interface Actions {
  setRoute: (route: RouteData.Route, sha: string) => void;
  setCurrentEdge: (currentEdge: number) => void;
  setSyncState: (syncState: SyncState, syncError?: string | null) => void;
}

export const useRouteStore = create<States & Actions>()(
  persist(
    (set) => ({
      route: null,
      sha: null,
      currentEdge: 0,
      syncState: 'idle',
      syncError: null,
      setRoute: (route, sha) => set({ route, sha }),
      setCurrentEdge: (currentEdge) => set({ currentEdge }),
      setSyncState: (syncState, syncError = null) => set({ syncState, syncError })
    }),
    {
      name: 'route',
      version: 1,
      partialize: (state) => ({
        route: state.route,
        sha: state.sha,
        currentEdge: state.currentEdge
      })
    }
  )
);
```

- [ ] **Step 2: Fehlschlagenden Test schreiben**

`src/services/__tests__/route-sync.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { syncRoute } from '../route-sync';
import type { CachedData } from '../route-sync';

const SNAPSHOT = path.resolve(
  __dirname,
  '../../lib/exile-leveling/__fixtures__/snapshot-b7b2dd0'
);

const JSON_NAMES = [
  'areas',
  'awakened-gem-lookup',
  'characters',
  'gem-colours',
  'gems',
  'kill-waypoints',
  'quests',
  'vaal-gem-lookup'
];

function cached(sha = 'b7b2dd0'): CachedData {
  return {
    sha,
    routes: Array.from({ length: 10 }, (_v, i) =>
      fs.readFileSync(path.join(SNAPSHOT, 'routes', `act-${i + 1}.txt`), 'utf8')
    ),
    json: Object.fromEntries(
      JSON_NAMES.map((n) => [
        n,
        fs.readFileSync(path.join(SNAPSHOT, 'json', `${n}.json`), 'utf8')
      ])
    )
  };
}

describe('syncRoute', () => {
  it('laedt nichts, wenn Upstream unveraendert ist', async () => {
    const fetchUpstream = vi.fn();

    const result = await syncRoute({
      checkUpstream: async () => ({ changed: false, sha: 'b7b2dd0' }),
      fetchUpstream,
      readCached: async () => cached()
    });

    expect(fetchUpstream).not.toHaveBeenCalled();
    expect(result.status).toBe('unchanged');
    expect(result.route?.sections).toHaveLength(10);
  });

  it('laedt und parst, wenn Upstream neu ist', async () => {
    const fetchUpstream = vi.fn(async () => undefined);

    const result = await syncRoute({
      checkUpstream: async () => ({ changed: true, sha: 'deadbee' }),
      fetchUpstream,
      readCached: async () => cached('deadbee')
    });

    expect(fetchUpstream).toHaveBeenCalledWith('deadbee');
    expect(result.status).toBe('updated');
    expect(result.sha).toBe('deadbee');
  });

  it('faellt bei Netzfehler auf den Cache zurueck', async () => {
    const result = await syncRoute({
      checkUpstream: async () => {
        throw new Error('offline');
      },
      fetchUpstream: async () => undefined,
      readCached: async () => cached()
    });

    expect(result.status).toBe('offline');
    expect(result.route?.sections).toHaveLength(10);
  });

  it('meldet Fehler, wenn weder Netz noch Cache da sind', async () => {
    const result = await syncRoute({
      checkUpstream: async () => {
        throw new Error('offline');
      },
      fetchUpstream: async () => undefined,
      readCached: async () => null
    });

    expect(result.status).toBe('error');
    expect(result.route).toBeNull();
  });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `yarn test src/services`
Expected: FAIL, `Cannot find module '../route-sync'`

- [ ] **Step 4: Service schreiben**

`src/services/route-sync.ts`:

```ts
import type { GameDataBundle, RouteData } from '@/lib/exile-leveling';
import { buildDefaultRoute } from '@/lib/exile-leveling/build-route';
import { invoke } from '@tauri-apps/api';

export interface UpstreamStatus {
  changed: boolean;
  sha: string;
}

export interface CachedData {
  sha: string;
  routes: string[];
  json: Record<string, string>;
}

export interface SyncDeps {
  checkUpstream: () => Promise<UpstreamStatus>;
  fetchUpstream: (sha: string) => Promise<void>;
  readCached: () => Promise<CachedData | null>;
}

export type SyncStatus = 'updated' | 'unchanged' | 'offline' | 'error';

export interface SyncResult {
  status: SyncStatus;
  route: RouteData.Route | null;
  sha: string | null;
  error: string | null;
}

export const tauriDeps: SyncDeps = {
  checkUpstream: () => invoke('check_upstream'),
  fetchUpstream: (sha) => invoke('fetch_upstream', { sha }),
  readCached: () => invoke('read_cached')
};

export function parseCached(cached: CachedData): RouteData.Route {
  const bundle: GameDataBundle = {
    Areas: JSON.parse(cached.json['areas']),
    AwakenedGemLookup: JSON.parse(cached.json['awakened-gem-lookup']),
    Characters: JSON.parse(cached.json['characters']),
    GemColours: JSON.parse(cached.json['gem-colours']),
    Gems: JSON.parse(cached.json['gems']),
    KillWaypoints: JSON.parse(cached.json['kill-waypoints']),
    Quests: JSON.parse(cached.json['quests']),
    VaalGemLookup: JSON.parse(cached.json['vaal-gem-lookup'])
  };

  return buildDefaultRoute(cached.routes, bundle);
}

export async function syncRoute(deps: SyncDeps): Promise<SyncResult> {
  let status: SyncStatus = 'unchanged';

  try {
    const upstream = await deps.checkUpstream();
    if (upstream.changed) {
      await deps.fetchUpstream(upstream.sha);
      status = 'updated';
    }
  } catch (error) {
    status = 'offline';
  }

  const cached = await deps.readCached();
  if (cached === null) {
    return {
      status: 'error',
      route: null,
      sha: null,
      error: 'Keine Daten im Cache und kein Netz'
    };
  }

  try {
    return {
      status,
      route: parseCached(cached),
      sha: cached.sha,
      error: null
    };
  } catch (error) {
    return {
      status: 'error',
      route: null,
      sha: cached.sha,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `yarn test src/services`
Expected: PASS, 4 Tests.

- [ ] **Step 6: Commit**

```bash
git add src/store/route.store.ts src/services
git commit -m "feat: Route-Sync-Service mit Cache-Rueckfall"
```

---

## Task 6: Fragment-Renderer

Ersetzt `sanitizeGuide` in `src/utilities/guide.utilities.ts`. Behebt die vier in der Spec
belegten Lücken.

**Files:**
- Create: `src/utilities/fragment-text.ts`
- Create: `src/utilities/__tests__/fragment-text.test.ts`

**Interfaces:**
- Consumes: `Data` (Task 2), `Fragments` (Task 2)
- Produces: `renderFragment(fragment: Fragments.AnyFragment): string`,
  `renderStepText(step: RouteData.FragmentStep): string`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`src/utilities/__tests__/fragment-text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { Fragments } from '@/lib/exile-leveling';
import { setGameData } from '@/lib/exile-leveling';
import { renderFragment } from '../fragment-text';

const SNAPSHOT = path.resolve(
  __dirname,
  '../../lib/exile-leveling/__fixtures__/snapshot-b7b2dd0'
);

function readJson(name: string) {
  return JSON.parse(
    fs.readFileSync(path.join(SNAPSHOT, 'json', `${name}.json`), 'utf8')
  );
}

setGameData({
  Areas: readJson('areas'),
  AwakenedGemLookup: readJson('awakened-gem-lookup'),
  Characters: readJson('characters'),
  GemColours: readJson('gem-colours'),
  Gems: readJson('gems'),
  KillWaypoints: readJson('kill-waypoints'),
  Quests: readJson('quests'),
  VaalGemLookup: readJson('vaal-gem-lookup')
});

const cases: Array<[string, Fragments.AnyFragment, string]> = [
  ['string', 'Find and kill ', 'Find and kill '],
  ['kill', { type: 'kill', value: 'Hillock' }, 'Hillock'],
  ['arena', { type: 'arena', value: "Merveil's Lair" }, "Merveil's Lair"],
  ['area', { type: 'area', areaId: '1_1_2' }, 'The Coast'],
  ['enter', { type: 'enter', areaId: '1_1_2' }, 'The Coast'],
  ['logout', { type: 'logout', areaId: '1_1_town' }, "Logout to Lioneye's Watch"],
  ['waypoint', { type: 'waypoint' }, 'waypoint'],
  ['waypoint_get', { type: 'waypoint_get' }, 'waypoint'],
  [
    'waypoint_use',
    { type: 'waypoint_use', dstAreaId: '1_1_2', srcAreaId: '1_1_4_1' },
    'Waypoint to The Coast'
  ],
  ['portal_set', { type: 'portal_set' }, 'portal'],
  [
    'portal_use',
    { type: 'portal_use', dstAreaId: '1_1_4_1' },
    'Portal to The Submerged Passage'
  ],
  [
    'quest',
    { type: 'quest', questId: 'a1q1', rewardOffers: ['a1q1'] },
    'Enemy at the Gate (Tarkleigh)'
  ],
  ['quest_text', { type: 'quest_text', value: 'Glyph' }, 'Glyph'],
  ['generic', { type: 'generic', value: 'Boat' }, 'Boat'],
  ['reward_quest', { type: 'reward_quest', item: 'Iron Ring' }, 'Iron Ring'],
  [
    'reward_vendor',
    { type: 'reward_vendor', item: 'Iron Ring', cost: '1x Orb' },
    'Iron Ring (1x Orb)'
  ],
  ['trial', { type: 'trial' }, 'Trial of Ascendancy'],
  ['ascend', { type: 'ascend', version: 'normal' }, 'Normal Labyrinth'],
  [
    'crafting',
    { type: 'crafting', crafting_recipes: ['Movement Speed - Rank 1'] },
    'Crafting: Movement Speed - Rank 1'
  ],
  ['dir 0', { type: 'dir', dirIndex: 0 }, 'N'],
  ['dir 7', { type: 'dir', dirIndex: 7 }, 'NW'],
  ['copy', { type: 'copy', text: '"Fireball"', side: 'tail' }, '"Fireball"']
];

describe('renderFragment', () => {
  for (const [name, fragment, expected] of cases) {
    it(`rendert ${name}`, () => {
      expect(renderFragment(fragment)).toBe(expected);
    });
  }

  it('erzeugt nirgends PART NOT FOUND', () => {
    for (const [, fragment] of cases) {
      expect(renderFragment(fragment)).not.toContain('NOT FOUND');
    }
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `yarn test src/utilities/__tests__/fragment-text.test.ts`
Expected: FAIL, `Cannot find module '../fragment-text'`

- [ ] **Step 3: Renderer schreiben**

`src/utilities/fragment-text.ts`:

```ts
import type { Fragments, RouteData } from '@/lib/exile-leveling';
import { Data } from '@/lib/exile-leveling';

// dirIndex ist Grad / 45, laeuft also 0 bis 7 im Uhrzeigersinn ab Norden.
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const LAB_NAMES: Record<Fragments.AscendFragment['version'], string> = {
  normal: 'Normal',
  cruel: 'Cruel',
  merciless: 'Merciless',
  eternal: 'Eternal'
};

function areaName(areaId: string): string {
  return Data.Areas[areaId]?.name ?? areaId;
}

export function renderFragment(fragment: Fragments.AnyFragment): string {
  if (typeof fragment === 'string') return fragment;

  switch (fragment.type) {
    case 'kill':
      return fragment.value;
    case 'arena':
      return fragment.value;
    case 'area':
      return areaName(fragment.areaId);
    case 'enter':
      return areaName(fragment.areaId);
    case 'logout':
      return `Logout to ${areaName(fragment.areaId)}`;
    case 'waypoint':
      return 'waypoint';
    case 'waypoint_get':
      return 'waypoint';
    case 'waypoint_use':
      return `Waypoint to ${areaName(fragment.dstAreaId)}`;
    case 'portal_set':
      return 'portal';
    case 'portal_use':
      return `Portal to ${areaName(fragment.dstAreaId)}`;
    case 'quest': {
      const quest = Data.Quests[fragment.questId];
      if (quest === undefined) return fragment.questId;

      const npc = fragment.rewardOffers
        .map((id) => quest.reward_offers[id]?.quest_npc)
        .find((name): name is string => typeof name === 'string');

      return npc === undefined ? quest.name : `${quest.name} (${npc})`;
    }
    case 'quest_text':
      return fragment.value;
    case 'generic':
      return fragment.value;
    case 'reward_quest':
      return fragment.item;
    case 'reward_vendor':
      return fragment.cost === undefined
        ? fragment.item
        : `${fragment.item} (${fragment.cost})`;
    case 'trial':
      return 'Trial of Ascendancy';
    case 'ascend':
      return `${LAB_NAMES[fragment.version]} Labyrinth`;
    case 'crafting':
      return `Crafting: ${fragment.crafting_recipes.join(', ')}`;
    case 'dir':
      return DIRECTIONS[fragment.dirIndex] ?? `${fragment.dirIndex * 45} Grad`;
    case 'copy':
      return fragment.text;
  }
}

export function renderStepText(step: RouteData.FragmentStep): string {
  return step.parts.map(renderFragment).join('');
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `yarn test src/utilities/__tests__/fragment-text.test.ts`
Expected: PASS, 23 Tests.

Schlägt ein Fall fehl, weil der erwartete Text nicht gefällt, dann die Erwartung im Test
anpassen, nicht den Renderer weich machen. Die Zweigabdeckung ist der Zweck.

- [ ] **Step 5: Prüfen, dass die Union vollständig ist**

Run: `yarn tsc --noEmit`
Expected: PASS. Fehlt ein `case`, meldet TypeScript in `renderFragment`, dass nicht alle
Pfade einen Wert zurückgeben.

- [ ] **Step 6: Commit**

```bash
git add src/utilities/fragment-text.ts src/utilities/__tests__/fragment-text.test.ts
git commit -m "feat: vollstaendiger Fragment-Renderer, behebt dirIndex 7 und crafting"
```

---

## Task 7: Fortschritt über edgeIndex

**Files:**
- Create: `src/utilities/route-progress.ts`
- Create: `src/utilities/__tests__/route-progress.test.ts`

**Interfaces:**
- Consumes: `RouteData` (Task 2)
- Produces: `parseAreaFromLog(line: string): string | null`,
  `advanceEdge(edges: string[], currentEdge: number, areaId: string): number`,
  `reanchorEdge(edges: string[], areaId: string, fallback: number): number`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`src/utilities/__tests__/route-progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  advanceEdge,
  parseAreaFromLog,
  reanchorEdge
} from '../route-progress';

const EDGES = ['1_1_1', '1_1_town', '1_1_2', '1_1_town', '1_1_3'];

describe('parseAreaFromLog', () => {
  it('liest die Area-Id aus der Logzeile', () => {
    const line =
      '2024/01/01 12:00:00 1234 abc [INFO Client 1234] : Generating level 2 area "1_1_2" with seed 1';

    expect(parseAreaFromLog(line)).toBe('1_1_2');
  });

  it('gibt null bei fremden Zeilen', () => {
    expect(parseAreaFromLog(': You have entered The Coast.')).toBeNull();
  });
});

describe('advanceEdge', () => {
  it('laeuft vor, wenn die naechste Kante passt', () => {
    expect(advanceEdge(EDGES, 0, '1_1_town')).toBe(1);
  });

  it('bleibt stehen, wenn die Zone nicht die naechste Kante ist', () => {
    expect(advanceEdge(EDGES, 0, '1_1_3')).toBe(0);
  });

  it('springt bei wiederholter Zone nicht zurueck', () => {
    expect(advanceEdge(EDGES, 2, '1_1_town')).toBe(3);
    expect(advanceEdge(EDGES, 3, '1_1_town')).toBe(3);
  });

  it('laeuft am Ende nicht ueber', () => {
    expect(advanceEdge(EDGES, 4, '1_1_3')).toBe(4);
  });
});

describe('reanchorEdge', () => {
  it('findet den hoechsten passenden Index', () => {
    expect(reanchorEdge(EDGES, '1_1_town', 0)).toBe(3);
  });

  it('nutzt den Rueckfall, wenn die Zone unbekannt ist', () => {
    expect(reanchorEdge(EDGES, '9_9_9', 2)).toBe(2);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `yarn test src/utilities/__tests__/route-progress.test.ts`
Expected: FAIL, `Cannot find module '../route-progress'`

- [ ] **Step 3: Implementierung schreiben**

`src/utilities/route-progress.ts`:

```ts
const AREA_PATTERN = /Generating level \d+ area "(.*?)"/;

export function parseAreaFromLog(line: string): string | null {
  const match = AREA_PATTERN.exec(line);
  return match === null ? null : match[1];
}

export function advanceEdge(
  edges: string[],
  currentEdge: number,
  areaId: string
): number {
  const next = currentEdge + 1;
  if (next >= edges.length) return currentEdge;
  return edges[next] === areaId ? next : currentEdge;
}

export function reanchorEdge(
  edges: string[],
  areaId: string,
  fallback: number
): number {
  const index = edges.lastIndexOf(areaId);
  return index === -1 ? fallback : index;
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `yarn test src/utilities/__tests__/route-progress.test.ts`
Expected: PASS, 8 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/utilities/route-progress.ts src/utilities/__tests__/route-progress.test.ts
git commit -m "feat: Fortschritt ueber Kantenindex statt Zonennamen"
```

---

## Task 8: Rust-Overlay-Tracking

**Files:**
- Create: `src-tauri/src/overlay.rs`
- Modify: `src-tauri/src/main.rs`

**Interfaces:**
- Consumes: nichts aus früheren Tasks
- Produces: Event `poe-bounds` mit Payload
  `{ x: number, y: number, w: number, h: number, focused: boolean, exclusiveFullscreen: boolean }`,
  Command `start_poe_tracking()`

- [ ] **Step 1: Modul schreiben**

`src-tauri/src/overlay.rs`:

```rust
use serde::Serialize;
use tauri::Manager;

#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PoeBounds {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub focused: bool,
    pub exclusive_fullscreen: bool,
    pub found: bool,
}

#[cfg(target_os = "windows")]
mod win {
    use super::PoeBounds;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use winapi::shared::minwindef::{BOOL, LPARAM};
    use winapi::shared::windef::{HWND, RECT};
    use winapi::um::winuser::{
        EnumWindows, GetForegroundWindow, GetWindowLongW, GetWindowRect, GetWindowTextW,
        IsWindowVisible, GWL_STYLE, WS_CAPTION, WS_THICKFRAME,
    };

    const TITLE: &str = "Path of Exile";

    struct Search {
        hwnd: Option<HWND>,
    }

    unsafe extern "system" fn proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if len > 0 && IsWindowVisible(hwnd) != 0 {
            let title = OsString::from_wide(&buf[..len as usize])
                .into_string()
                .unwrap_or_default();
            if title == TITLE {
                let search = &mut *(lparam as *mut Search);
                search.hwnd = Some(hwnd);
                return 0;
            }
        }
        1
    }

    pub fn find_window() -> Option<HWND> {
        let mut search = Search { hwnd: None };
        unsafe {
            EnumWindows(Some(proc), &mut search as *mut Search as _);
        }
        search.hwnd
    }

    pub fn read_bounds() -> PoeBounds {
        let hwnd = match find_window() {
            Some(hwnd) => hwnd,
            None => {
                return PoeBounds {
                    x: 0,
                    y: 0,
                    w: 0,
                    h: 0,
                    focused: false,
                    exclusive_fullscreen: false,
                    found: false,
                }
            }
        };

        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };

        unsafe {
            GetWindowRect(hwnd, &mut rect);

            let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
            // Ein randloses Fenster ohne Titelleiste, das den Bildschirm exakt fuellt,
            // ist der Verdachtsfall Exklusiv-Fullscreen.
            let borderless = (style & (WS_CAPTION | WS_THICKFRAME)) == 0;

            PoeBounds {
                x: rect.left,
                y: rect.top,
                w: rect.right - rect.left,
                h: rect.bottom - rect.top,
                focused: GetForegroundWindow() == hwnd,
                exclusive_fullscreen: borderless,
                found: true,
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::PoeBounds;

    pub fn read_bounds() -> PoeBounds {
        PoeBounds {
            x: 0,
            y: 0,
            w: 0,
            h: 0,
            focused: false,
            exclusive_fullscreen: false,
            found: false,
        }
    }
}

#[tauri::command]
pub fn start_poe_tracking(handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut last: Option<PoeBounds> = None;
        loop {
            let bounds = win::read_bounds();
            if last.as_ref() != Some(&bounds) {
                let _ = handle.emit_all("poe-bounds", bounds.clone());
                last = Some(bounds);
            }
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    });
}
```

Hinweis: Dieser erste Schritt pollt mit 250 ms und sendet nur bei Änderung. Das hält die
Schnittstelle (`poe-bounds`) stabil. Der Umbau auf `SetWinEventHook` (ADR-0005) passiert in
Task 8b und ändert am Event nichts.

- [ ] **Step 2: Modul registrieren**

In `src-tauri/src/main.rs`:

```rust
mod overlay;
```

und in `invoke_handler![...]`:

```rust
overlay::start_poe_tracking
```

- [ ] **Step 3: Kompilieren**

Run: `cd src-tauri && cargo check`
Expected: `Finished`.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/overlay.rs src-tauri/src/main.rs
git commit -m "feat: Bounds des PoE-Fensters als poe-bounds-Event melden"
```

---

## Task 8b: Auf SetWinEventHook umstellen

Getrennt, weil ein Reviewer Task 8 annehmen und diesen ablehnen können muss.

**Files:**
- Modify: `src-tauri/src/overlay.rs`

**Interfaces:**
- Consumes: `PoeBounds` und Event `poe-bounds` aus Task 8
- Produces: unverändert dieselbe Schnittstelle

- [ ] **Step 1: Hook statt Schleife**

In `src-tauri/src/overlay.rs` `start_poe_tracking` ersetzen:

```rust
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn start_poe_tracking(handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        use winapi::um::winuser::{
            DispatchMessageW, GetMessageW, SetWinEventHook, TranslateMessage, MSG,
            EVENT_OBJECT_LOCATIONCHANGE, EVENT_SYSTEM_FOREGROUND, WINEVENT_OUTOFCONTEXT,
            WINEVENT_SKIPOWNPROCESS,
        };

        unsafe {
            HANDLE.with(|slot| *slot.borrow_mut() = Some(handle.clone()));

            SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND,
                EVENT_OBJECT_LOCATIONCHANGE,
                std::ptr::null_mut(),
                Some(win::hook_proc),
                0,
                0,
                WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
            );

            // Einmal initial senden, damit das Frontend nicht auf die erste Bewegung wartet.
            emit_if_changed(&handle);

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
    });
}
```

Dazu in `overlay.rs` ergänzen:

```rust
use std::cell::RefCell;

thread_local! {
    static HANDLE: RefCell<Option<tauri::AppHandle>> = RefCell::new(None);
    static LAST: RefCell<Option<PoeBounds>> = RefCell::new(None);
}

fn emit_if_changed(handle: &tauri::AppHandle) {
    let bounds = win::read_bounds();
    LAST.with(|slot| {
        let mut last = slot.borrow_mut();
        if last.as_ref() != Some(&bounds) {
            let _ = handle.emit_all("poe-bounds", bounds.clone());
            *last = Some(bounds);
        }
    });
}
```

und im `win`-Modul:

```rust
use winapi::shared::minwindef::DWORD;
use winapi::shared::windef::HWINEVENTHOOK;
use winapi::shared::ntdef::LONG;

pub unsafe extern "system" fn hook_proc(
    _hook: HWINEVENTHOOK,
    _event: DWORD,
    _hwnd: HWND,
    _id_object: LONG,
    _id_child: LONG,
    _thread: DWORD,
    _time: DWORD,
) {
    super::HANDLE.with(|slot| {
        if let Some(handle) = slot.borrow().as_ref() {
            super::emit_if_changed(handle);
        }
    });
}
```

- [ ] **Step 2: Kompilieren**

Run: `cd src-tauri && cargo check`
Expected: `Finished`.

Meldet der Compiler, dass `hook_proc` nicht zur erwarteten Signatur passt, dann die
Signatur genau aus `winapi::um::winuser::WINEVENTPROC` übernehmen.

- [ ] **Step 3: Manuell prüfen**

Run: `yarn tauri dev`, PoE starten, Fenster verschieben.
Expected: In der Devtools-Konsole erscheinen `poe-bounds`-Events ohne merkliche Verzögerung
und nur bei tatsächlichen Änderungen.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/overlay.rs
git commit -m "perf: Fenster-Tracking von Polling auf SetWinEventHook umstellen"
```

---

## Task 9: Overlay-Geometrie

**Files:**
- Modify: `src/utilities/constants.ts`
- Create: `src/utilities/overlay-geometry.ts`
- Create: `src/utilities/__tests__/overlay-geometry.test.ts`

**Interfaces:**
- Consumes: `PoeBounds`-Payload aus Task 8
- Produces: `computeOverlayRect(bounds: PoeBounds, height: number, scale: number, offset: OverlayOffset): OverlayRect`
  mit `OverlayRect = { x: number, y: number, width: number }` und
  `OverlayOffset = { dx: number, dy: number }`

- [ ] **Step 1: Konstanten setzen**

`src/utilities/constants.ts` vollständig ersetzen:

```ts
// Anker im Spiel-Rect: horizontal mittig, vertikal am unteren Rand (ADR-0006).
export const OVERLAY_ANCHOR = { x: 0.5, y: 1.0 };

// Abstand der Overlay-Unterkante zur Fensterunterkante, Anteil der Spielhoehe.
// Haelt das Overlay ueber Flask- und Skillbar frei.
export const OVERLAY_BOTTOM_MARGIN = 0.16;

// Grundbreite als Anteil der Spielbreite, danach geklemmt.
export const OVERLAY_BASE_WIDTH = 0.26;
export const OVERLAY_MIN_WIDTH = 320;
export const OVERLAY_MAX_WIDTH = 560;

export const OVERLAY_MIN_HEIGHT = 120;

export const OVERLAY_SCALE_MIN = 0.6;
export const OVERLAY_SCALE_MAX = 2.0;
export const OVERLAY_SCALE_STEP = 0.1;

export const OVERLAY_BASE_FONT_SIZE = 16;
```

- [ ] **Step 2: Fehlschlagenden Test schreiben**

`src/utilities/__tests__/overlay-geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { computeOverlayRect } from '../overlay-geometry';

const FHD = {
  x: 0,
  y: 0,
  w: 1920,
  h: 1080,
  focused: true,
  exclusiveFullscreen: false,
  found: true
};

const NO_OFFSET = { dx: 0, dy: 0 };

describe('computeOverlayRect', () => {
  it('zentriert horizontal', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET);

    expect(rect.x + rect.width / 2).toBe(960);
  });

  it('klemmt die Breite nach oben', () => {
    // 1920 * 0.26 = 499.2, unter dem Maximum
    expect(computeOverlayRect(FHD, 200, 1, NO_OFFSET).width).toBe(499);
    // mit scale 2 waere es 998, wird auf 560 geklemmt
    expect(computeOverlayRect(FHD, 200, 2, NO_OFFSET).width).toBe(560);
  });

  it('klemmt die Breite nach unten', () => {
    const small = { ...FHD, w: 800, h: 600 };
    // 800 * 0.26 * 0.6 = 124.8, wird auf 320 geklemmt
    expect(computeOverlayRect(small, 200, 0.6, NO_OFFSET).width).toBe(320);
  });

  it('setzt die Unterkante ueber die HUD-Zeile', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET);
    // 1080 * (1.0 - 0.16) = 907.2, minus Hoehe 200
    expect(rect.y).toBe(707);
  });

  it('rechnet den Offset relativ zum Spiel-Rect', () => {
    const a = computeOverlayRect(FHD, 200, 1, { dx: 0.1, dy: -0.05 });
    const b = computeOverlayRect(FHD, 200, 1, NO_OFFSET);

    expect(a.x - b.x).toBe(192);
    expect(a.y - b.y).toBe(-54);
  });

  it('bleibt bei anderer Aufloesung relativ gleich', () => {
    const qhd = { ...FHD, w: 2560, h: 1440 };
    const offset = { dx: 0.1, dy: -0.05 };

    const relativeFhd =
      (computeOverlayRect(FHD, 200, 1, offset).x + 499 / 2) / FHD.w;
    const relativeQhd =
      (computeOverlayRect(qhd, 200, 1, offset).x + 560 / 2) / qhd.w;

    expect(relativeQhd).toBeCloseTo(relativeFhd, 3);
  });

  it('beruecksichtigt die Fensterposition auf einem zweiten Monitor', () => {
    const second = { ...FHD, x: 1920, y: -120 };
    const rect = computeOverlayRect(second, 200, 1, NO_OFFSET);

    expect(rect.x + rect.width / 2).toBe(2880);
    expect(rect.y).toBe(587);
  });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `yarn test src/utilities/__tests__/overlay-geometry.test.ts`
Expected: FAIL, `Cannot find module '../overlay-geometry'`

- [ ] **Step 4: Implementierung schreiben**

`src/utilities/overlay-geometry.ts`:

```ts
import {
  OVERLAY_ANCHOR,
  OVERLAY_BASE_WIDTH,
  OVERLAY_BOTTOM_MARGIN,
  OVERLAY_MAX_WIDTH,
  OVERLAY_MIN_WIDTH
} from './constants';

export interface PoeBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  focused: boolean;
  exclusiveFullscreen: boolean;
  found: boolean;
}

export interface OverlayOffset {
  dx: number;
  dy: number;
}

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeOverlayRect(
  bounds: PoeBounds,
  height: number,
  scale: number,
  offset: OverlayOffset
): OverlayRect {
  const width = Math.round(
    clamp(
      bounds.w * OVERLAY_BASE_WIDTH * scale,
      OVERLAY_MIN_WIDTH,
      OVERLAY_MAX_WIDTH
    )
  );

  const centerX = bounds.x + bounds.w * (OVERLAY_ANCHOR.x + offset.dx);
  const bottomY =
    bounds.y + bounds.h * (OVERLAY_ANCHOR.y - OVERLAY_BOTTOM_MARGIN + offset.dy);

  return {
    x: Math.round(centerX - width / 2),
    y: Math.round(bottomY - height),
    width
  };
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `yarn test src/utilities/__tests__/overlay-geometry.test.ts`
Expected: PASS, 7 Tests.

- [ ] **Step 6: Commit**

```bash
git add src/utilities/constants.ts src/utilities/overlay-geometry.ts src/utilities/__tests__/overlay-geometry.test.ts
git commit -m "feat: Overlay-Geometrie relativ zum Spielfenster berechnen"
```

---

## Task 10: Overlay an das Spielfenster koppeln

**Files:**
- Modify: `src/store/settings.store.ts`
- Create: `src/hooks/usePoeWindow.ts`
- Modify: `src/pages/main.page.tsx`

**Interfaces:**
- Consumes: `computeOverlayRect` (Task 9), Event `poe-bounds` (Task 8)
- Produces: `usePoeWindow(): { bounds: PoeBounds | null }`,
  `settings.overlayScale: number`, `settings.overlayOffset: OverlayOffset`

- [ ] **Step 1: Settings-Store umbauen**

`src/store/settings.store.ts` vollständig ersetzen:

```ts
import type { OverlayOffset } from '@/utilities/overlay-geometry';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface States {
  clientTxtPath: string;
  showLayout: boolean;
  overlayScale: number;
  overlayOffset: OverlayOffset;
}

interface Actions {
  setClientTxtPath: (clientTxtPath: string) => void;
  setShowLayout: (showLayout: boolean) => void;
  setOverlayScale: (overlayScale: number) => void;
  setOverlayOffset: (overlayOffset: OverlayOffset) => void;
  resetOverlayPlacement: () => void;
}

export const useSettingsStore = create<States & Actions>()(
  persist(
    (set) => ({
      clientTxtPath: '',
      showLayout: true,
      overlayScale: 1,
      overlayOffset: { dx: 0, dy: 0 },
      setClientTxtPath: (clientTxtPath) => set({ clientTxtPath }),
      setShowLayout: (showLayout) => set({ showLayout }),
      setOverlayScale: (overlayScale) => set({ overlayScale }),
      setOverlayOffset: (overlayOffset) => set({ overlayOffset }),
      resetOverlayPlacement: () =>
        set({ overlayScale: 1, overlayOffset: { dx: 0, dy: 0 } })
    }),
    {
      name: 'settings',
      version: 2,
      migrate: (persisted) => {
        // Version 1 hatte displayPosition und growDirection, beides absolut und
        // damit unbrauchbar. Wird verworfen, Anker und Offset ersetzen es (ADR-0006).
        const old = persisted as Partial<States> | undefined;
        return {
          clientTxtPath: old?.clientTxtPath ?? '',
          showLayout: old?.showLayout ?? true,
          overlayScale: 1,
          overlayOffset: { dx: 0, dy: 0 }
        } as States & Actions;
      }
    }
  )
);
```

- [ ] **Step 2: Hook schreiben**

`src/hooks/usePoeWindow.ts`:

```ts
import { LogicalPosition, LogicalSize, appWindow } from '@tauri-apps/api/window';
import { useEffect, useRef, useState } from 'react';

import type { PoeBounds } from '@/utilities/overlay-geometry';
import { OVERLAY_BASE_FONT_SIZE, OVERLAY_MIN_HEIGHT } from '@/utilities/constants';
import { computeOverlayRect } from '@/utilities/overlay-geometry';
import { invoke } from '@tauri-apps/api';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/store/settings.store';

export function usePoeWindow(active: boolean, contentHeight: number) {
  const [bounds, setBounds] = useState<PoeBounds | null>(null);
  const started = useRef(false);
  const { overlayScale, overlayOffset } = useSettingsStore((state) => state);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void invoke('start_poe_tracking');

    const unlisten = listen<PoeBounds>('poe-bounds', (event) => {
      setBounds(event.payload);
    });

    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${
      OVERLAY_BASE_FONT_SIZE * overlayScale
    }px`;
  }, [overlayScale]);

  useEffect(() => {
    if (!active || bounds === null || !bounds.found) return;

    const height = Math.max(contentHeight, OVERLAY_MIN_HEIGHT);
    const rect = computeOverlayRect(bounds, height, overlayScale, overlayOffset);

    void (async () => {
      await appWindow.setSize(new LogicalSize(rect.width, height));
      await appWindow.setPosition(new LogicalPosition(rect.x, rect.y));
      if (bounds.focused) {
        await appWindow.show();
      } else {
        await appWindow.hide();
      }
    })();
  }, [active, bounds, contentHeight, overlayScale, overlayOffset]);

  return { bounds };
}
```

- [ ] **Step 3: In `main.page.tsx` verdrahten**

In `src/pages/main.page.tsx`:

1. Importe `LogicalPosition`, `LogicalSize`, `IN_GAME_WINDOW_SIZE`, `TestScreen`,
   `availableMonitors` und die Destrukturierung von `displayPosition`, `growDirection`
   entfernen.
2. Den kompletten `adjustWindow`-Block im `useEffect([currentStep])` löschen.
3. Stattdessen die gemessene Inhaltshöhe in State halten und den Hook aufrufen:

```tsx
const [contentHeight, setContentHeight] = useState(OVERLAY_MIN_HEIGHT);

usePoeWindow(appState === AppState.IN_GAME, contentHeight);

useEffect(() => {
  if (appState !== AppState.IN_GAME) return;
  const element = document.getElementById(`step-${currentEdge}`);
  if (element === null) return;
  setContentHeight(Math.ceil(element.getBoundingClientRect().height) + 24);
}, [appState, currentEdge]);
```

4. `Switch.Case condition={appState === AppState.TEST}` mit `TestScreen` entfernen.

- [ ] **Step 4: Typprüfung und Tests**

Run: `yarn tsc --noEmit && yarn test`
Expected: PASS. `noUnusedLocals` deckt vergessene Importe auf.

- [ ] **Step 5: Manuell prüfen**

Run: `yarn tauri dev`, PoE starten, Overlay-Modus aktivieren, PoE-Fenster verschieben.
Expected: Overlay bleibt mittig unten im Spielfenster, folgt beim Verschieben, verschwindet
bei Fokusverlust.

- [ ] **Step 6: Commit**

```bash
git add src/store/settings.store.ts src/hooks/usePoeWindow.ts src/pages/main.page.tsx
git commit -m "feat: Overlay koppelt sich automatisch an das PoE-Fenster"
```

---

## Task 11: Edit-Modus für Skalierung und Verschieben

**Files:**
- Create: `src/components/overlay-edit-controls.tsx`
- Modify: `src/components/in-game-screen.tsx`
- Modify: `src/pages/main.page.tsx`

**Interfaces:**
- Consumes: `settings.overlayScale`, `settings.overlayOffset`, `usePoeWindow` (Task 10)
- Produces: `OverlayEditControls` als Komponente, Hotkey `CmdOrCtrl+Shift+Alt+O`

- [ ] **Step 1: Bedienelemente schreiben**

`src/components/overlay-edit-controls.tsx`:

```tsx
import { Minus, Plus, RotateCcw, X } from 'lucide-react';

import { Button } from './ui/button';
import {
  OVERLAY_SCALE_MAX,
  OVERLAY_SCALE_MIN,
  OVERLAY_SCALE_STEP
} from '@/utilities/constants';
import { useSettingsStore } from '@/store/settings.store';

interface OverlayEditControlsProps {
  onClose: () => void;
}

export default function OverlayEditControls({
  onClose
}: OverlayEditControlsProps) {
  const { overlayScale, setOverlayScale, resetOverlayPlacement } =
    useSettingsStore((state) => state);

  const step = (direction: number) => {
    const next = Math.min(
      Math.max(overlayScale + direction * OVERLAY_SCALE_STEP, OVERLAY_SCALE_MIN),
      OVERLAY_SCALE_MAX
    );
    setOverlayScale(Math.round(next * 10) / 10);
  };

  return (
    <div
      className='absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 cursor-move'
      data-tauri-drag-region
    >
      <p className='select-none text-sm' data-tauri-drag-region>
        Ziehen zum Verschieben
      </p>
      <div className='flex flex-row items-center gap-2'>
        <Button size='icon' className='size-7' onClick={() => step(-1)}>
          <Minus size={16} />
        </Button>
        <span className='select-none text-sm w-12 text-center'>
          {Math.round(overlayScale * 100)}%
        </span>
        <Button size='icon' className='size-7' onClick={() => step(1)}>
          <Plus size={16} />
        </Button>
        <Button size='icon' className='size-7' onClick={resetOverlayPlacement}>
          <RotateCcw size={16} />
        </Button>
        <Button size='icon' className='size-7' onClick={onClose}>
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Offset beim Ziehen zurückschreiben**

In `src/pages/main.page.tsx` neben dem Edit-Zustand:

```tsx
const [editMode, setEditMode] = useState(false);
const { bounds } = usePoeWindow(appState === AppState.IN_GAME, contentHeight);

useEffect(() => {
  void appWindow.setIgnoreCursorEvents(!editMode);
}, [editMode]);

useEffect(() => {
  if (!editMode) return;

  const unlisten = appWindow.onMoved(async ({ payload }) => {
    if (bounds === null || !bounds.found) return;

    const size = await appWindow.innerSize();
    const centerX = payload.x + size.width / 2;
    const bottomY = payload.y + size.height;

    setOverlayOffset({
      dx: (centerX - bounds.x) / bounds.w - OVERLAY_ANCHOR.x,
      dy:
        (bottomY - bounds.y) / bounds.h -
        (OVERLAY_ANCHOR.y - OVERLAY_BOTTOM_MARGIN)
    });
  });

  return () => {
    void unlisten.then((off) => off());
  };
}, [editMode, bounds, setOverlayOffset]);
```

- [ ] **Step 3: Hotkey registrieren**

In der bestehenden `registerShortcuts`-Funktion in `src/pages/main.page.tsx` ergänzen:

```ts
if (!(await isRegistered('CmdOrCtrl+Shift+Alt+O'))) {
  await register('CmdOrCtrl+Shift+Alt+O', () => {
    setEditMode((value) => !value);
  });
}
```

und im Cleanup-`return` von `useEffect`:

```ts
unregister('CmdOrCtrl+Shift+Alt+O');
```

- [ ] **Step 4: Bedienelemente einblenden**

In `src/components/in-game-screen.tsx` ein Prop `editMode: boolean` ergänzen und bei
`editMode === true` `<OverlayEditControls onClose={...} />` über dem Text rendern.
`main.page.tsx` reicht `editMode` und `onClose={() => setEditMode(false)}` durch.

- [ ] **Step 5: Typprüfung und Tests**

Run: `yarn tsc --noEmit && yarn test`
Expected: PASS.

- [ ] **Step 6: Manuell prüfen**

Run: `yarn tauri dev`, in den Overlay-Modus gehen, `Strg+Shift+Alt+O` drücken.
Expected: Overlay wird klickbar, Ziehen verschiebt es, Prozentanzeige ändert sich mit
Plus und Minus, Zurücksetzen springt zurück in die Mitte unten, X schaltet zurück auf
klickdurchlässig. Nach Auflösungswechsel bleibt die Verschiebung relativ erhalten.

- [ ] **Step 7: Commit**

```bash
git add src/components/overlay-edit-controls.tsx src/components/in-game-screen.tsx src/pages/main.page.tsx
git commit -m "feat: Edit-Modus zum Verschieben und Skalieren des Overlays"
```

---

## Task 12: Client.txt-Pfad ableiten

**Files:**
- Create: `src-tauri/src/game_paths.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src/pages/main.page.tsx`

**Interfaces:**
- Consumes: `find_window` aus `overlay.rs` (Task 8)
- Produces: Command `detect_client_txt() -> Option<String>`

- [ ] **Step 1: Modul schreiben**

`src-tauri/src/game_paths.rs`:

```rust
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn detect_client_txt() -> Option<String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::path::PathBuf;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::winbase::QueryFullProcessImageNameW;
    use winapi::um::winnt::PROCESS_QUERY_LIMITED_INFORMATION;
    use winapi::um::winuser::GetWindowThreadProcessId;

    let hwnd = crate::overlay::find_poe_window()?;

    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }

        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return None;
        }

        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, buf.as_mut_ptr(), &mut len);
        winapi::um::handleapi::CloseHandle(process);

        if ok == 0 {
            return None;
        }

        let exe = PathBuf::from(OsString::from_wide(&buf[..len as usize]));
        let candidate = exe.parent()?.join("logs").join("Client.txt");

        if candidate.exists() {
            Some(candidate.to_string_lossy().to_string())
        } else {
            None
        }
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn detect_client_txt() -> Option<String> {
    None
}
```

- [ ] **Step 2: `find_poe_window` öffentlich machen**

In `src-tauri/src/overlay.rs` eine plattformneutrale Hülle ergänzen:

```rust
#[cfg(target_os = "windows")]
pub fn find_poe_window() -> Option<winapi::shared::windef::HWND> {
    win::find_window()
}
```

- [ ] **Step 3: Modul registrieren**

In `src-tauri/src/main.rs`: `mod game_paths;` und `game_paths::detect_client_txt` im
`invoke_handler`.

- [ ] **Step 4: Im Frontend nutzen**

In `src/pages/main.page.tsx`, bevor der Hinweis "No client.txt path" gezeigt wird:

```ts
useEffect(() => {
  if (clientTxtPath !== '') return;

  void invoke<string | null>('detect_client_txt').then((detected) => {
    if (detected !== null) setClientTxtPath(detected);
  });
}, [clientTxtPath, setClientTxtPath]);
```

Die manuelle Auswahl bleibt als Rückfallebene stehen.

- [ ] **Step 5: Kompilieren und prüfen**

Run: `cd src-tauri && cargo check && cd .. && yarn tsc --noEmit`
Expected: PASS.

Run: `yarn tauri dev` mit laufendem PoE und leerem `clientTxtPath`.
Expected: Der Pfad wird ohne Dateidialog gesetzt.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/game_paths.rs src-tauri/src/overlay.rs src-tauri/src/main.rs src/pages/main.page.tsx
git commit -m "feat: Client.txt-Pfad aus dem PoE-Prozess ableiten"
```

---

## Task 13: Altlasten entfernen

Erst jetzt, damit vorher jederzeit verglichen werden kann.

**Files:**
- Delete: siehe Liste
- Modify: `src/components/navbar.tsx`, `src/pages/settings.page.tsx`,
  `src/components/levelling-guide-main.tsx`, `src/components/levelling-guide.tsx`,
  `src/components/step-guide.tsx`, `src/components/in-game-screen.tsx`,
  `src/store/app.store.ts`

**Interfaces:**
- Consumes: `useRouteStore` (Task 5), `renderStepText` (Task 6)
- Produces: keine neuen Schnittstellen

- [ ] **Step 1: Anzeigekomponenten auf den Route-Store umstellen**

`src/components/in-game-screen.tsx`, `levelling-guide-main.tsx`, `levelling-guide.tsx` und
`step-guide.tsx` lesen künftig `useRouteStore` statt `useGuideStore` und rendern die
Schritte über `renderStepText(step)`. Die Schritt-Ids für das Scrollen heißen
`edge-${step.edgeIndex}` statt `step-${index}`, passend zu `currentEdge`.

- [ ] **Step 2: Import-UI aus der Navbar entfernen**

In `src/components/navbar.tsx` streichen: Import von `clearGuide`, `setNewGuide`,
`guideSpeed`, `guideStarter`, `readText`, die Menüeinträge zum Einfügen und Laden von
Guides, `openOverrideDialog` und `auxGuide`. Der Eintrag zum Zurücksetzen ruft künftig
`useRouteStore.setState({ currentEdge: 0 })`.

- [ ] **Step 3: Settings aufräumen**

In `src/pages/settings.page.tsx` den Block "Display Position" und "Grow Direction" samt
`handleOnTest`, `handleSetGrowDirection` und den `Select`-Importen entfernen. Stattdessen
einen Hinweistext, dass das Overlay sich automatisch platziert und im Overlay per
`Strg+Shift+Alt+O` justiert wird.

- [ ] **Step 4: `AppState.TEST` entfernen**

In `src/store/app.store.ts` den Enum-Wert `TEST` streichen.

- [ ] **Step 5: Dateien löschen**

```bash
git rm src/data/level-tracker-areas.ts src/data/level-tracker-gems.ts src/data/level-tracker-quests.ts
git rm src/data/guides/league-starter.guide.json src/data/guides/speed-leveling.guide.json
git rm src/interfaces/guide-import.interface.ts src/interfaces/guide.interface.ts
git rm src/utilities/guide.schema.ts src/utilities/guide.utilities.ts
git rm src/store/guide.store.ts
git rm src/components/test-screen.tsx
```

- [ ] **Step 6: `ajv` entfernen**

`ajv` wurde nur von `guide.schema.ts` gebraucht.

```bash
yarn remove ajv
```

- [ ] **Step 7: Typprüfung, Tests, Build**

Run: `yarn tsc --noEmit && yarn test && yarn build`
Expected: PASS. `noUnusedLocals` findet übrig gebliebene Importe.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: Guide-Import, eingefrorene Spieldaten und manuelles Platzieren entfernen"
```

---

## Task 14: Sync beim Start und im Tagestakt

**Files:**
- Modify: `src/App.tsx`
- Create: `src/hooks/useRouteSync.ts`

**Interfaces:**
- Consumes: `syncRoute`, `tauriDeps` (Task 5), `reanchorEdge` (Task 7)
- Produces: `useRouteSync(): void`

- [ ] **Step 1: Hook schreiben**

`src/hooks/useRouteSync.ts`:

```ts
import { useEffect, useRef } from 'react';

import { reanchorEdge } from '@/utilities/route-progress';
import { syncRoute, tauriDeps } from '@/services/route-sync';
import { useRouteStore } from '@/store/route.store';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function useRouteSync() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      const store = useRouteStore.getState();
      store.setSyncState('syncing');

      const previousArea =
        store.route !== null ? store.route.edges[store.currentEdge] : null;

      const result = await syncRoute(tauriDeps);

      if (result.route === null || result.sha === null) {
        store.setSyncState('error', result.error);
        return;
      }

      store.setRoute(result.route, result.sha);

      if (previousArea !== null && result.status === 'updated') {
        store.setCurrentEdge(
          reanchorEdge(result.route.edges, previousArea, store.currentEdge)
        );
      }

      store.setSyncState('idle');
    };

    void run();
    const timer = setInterval(() => void run(), DAY_IN_MS);

    return () => clearInterval(timer);
  }, []);
}
```

- [ ] **Step 2: In `App.tsx` aufrufen**

In `src/App.tsx` `useRouteSync()` in der Wurzelkomponente aufrufen.

- [ ] **Step 3: Prüfen**

Run: `yarn tauri dev`
Expected: Beim ersten Start werden 18 Dateien geladen, der Guide erscheint ohne manuellen
Import. Beim zweiten Start meldet GitHub 304 und es wird nichts geladen. Prüfbar im
Cache-Verzeichnis:

```bash
ls "$APPDATA/com.path-of-levelling.dev/exile-leveling"
```

Expected: `manifest.json` und ein Verzeichnis mit dem sha-Namen.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useRouteSync.ts src/App.tsx
git commit -m "feat: Route beim Start und taeglich mit Upstream abgleichen"
```

---

## Task 15: CI-Watcher für Parser-Drift

**Files:**
- Create: `.github/workflows/upstream-watch.yml`

**Interfaces:**
- Consumes: `scripts/vendor-exile-leveling.mjs` (Task 2)
- Produces: wöchentlicher Pull Request bei Parser-Änderungen

- [ ] **Step 1: Workflow schreiben**

`.github/workflows/upstream-watch.yml`:

```yaml
name: Upstream-Parser beobachten

on:
  schedule:
    - cron: '0 6 * * 1'
  workflow_dispatch:

jobs:
  watch:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/checkout@v4
        with:
          repository: HeartofPhos/exile-leveling
          path: upstream

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc

      - name: Parser neu vendoren
        run: node scripts/vendor-exile-leveling.mjs upstream

      - name: Pull Request bei Aenderungen
        uses: peter-evans/create-pull-request@v6
        with:
          branch: upstream/parser-drift
          title: 'chore: Route-Parser von exile-leveling nachziehen'
          body: |
            Der Parser im Upstream hat sich geaendert. Der vendored Stand unter
            `src/lib/exile-leveling/` wurde neu erzeugt.

            Vor dem Merge pruefen:
            - `yarn test` laeuft durch, insbesondere der Golden-File-Test
            - schlaegt der Golden-File-Test fehl, entscheiden ob es Datendrift
              (Fixture neu ziehen mit `node scripts/build-route-fixture.mjs`)
              oder Parserdrift (echter Fix noetig) ist
          commit-message: 'chore: Route-Parser von exile-leveling nachziehen'
```

- [ ] **Step 2: Workflow-Syntax prüfen**

Run: `yarn dlx --quiet js-yaml .github/workflows/upstream-watch.yml > /dev/null && echo ok`

Steht `js-yaml` nicht zur Verfügung, reicht die Prüfung über die GitHub-Actions-Oberfläche
nach dem Push.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/upstream-watch.yml
git commit -m "ci: woechentlicher Watcher fuer Parser-Drift im Upstream"
```

---

## Selbstprüfung des Plans

**Spec-Abdeckung**

| Spec-Abschnitt | Task |
|---|---|
| 5.1 Datenschicht Rust | 4 |
| 5.2 Parser vendored | 2 |
| 5.3 Overlay Rust | 8, 8b |
| 5.4 Overlay Frontend | 9, 10 |
| 5.5 Edit-Modus | 11 |
| 5.6 Fortschritt | 7, 14 |
| 5.7 Client.txt | 12 |
| 6 Was entfällt | 13 |
| 7 Fehlerfälle | 4 (Download, Manifest), 5 (Offline, Parserfehler), 8 (PoE fehlt, Fullscreen) |
| 8 Tests | 1, 3, 5, 6, 7, 9 |
| 9 Reihenfolge | Tasks 1 bis 15 |

**Offene Abweichung von der Spec:** Die Spec beschreibt in 7 eine sichtbare Warnung bei
Exklusiv-Fullscreen. Task 8 liefert das Feld `exclusiveFullscreen`, die Anzeige der Warnung
gehört in Task 10, Schritt 3, zusammen mit dem Wartezustand für "PoE nicht gestartet".
Beim Umsetzen von Task 10 mit erledigen.

**Typkonsistenz geprüft:** `PoeBounds` wird in Rust mit `#[serde(rename_all = "camelCase")]`
serialisiert und im Frontend als `exclusiveFullscreen` gelesen. `CachedData.json` ist in
Rust `HashMap<String, String>` und im Frontend `Record<string, string>`, die Werte sind
JSON-Text und werden in `parseCached` geparst. `currentEdge` heißt in Store, Hook und
Utilities durchgehend gleich.
