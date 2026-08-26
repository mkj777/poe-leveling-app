import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { Fragments, RouteData } from '@/lib/exile-leveling';
import { fragmentColour, fragmentIcon } from '../fragment-style';
import { renderFragment, renderStepText } from '../fragment-text';
import { setGameData } from '@/lib/exile-leveling';

const SNAPSHOT = path.resolve(
  __dirname,
  '../../lib/exile-leveling/__fixtures__/snapshot-b7b2dd0'
);

function readJson(name: string) {
  return JSON.parse(
    fs.readFileSync(path.join(SNAPSHOT, 'json', `${name}.json`), 'utf8')
  );
}

beforeAll(() => {
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
});

describe('fehlende Spieldaten', () => {
  it('faellt bei unbekannter Zone auf die Id zurueck', () => {
    expect(renderFragment({ type: 'enter', areaId: 'gibt_es_nicht' })).toBe(
      'gibt_es_nicht'
    );
  });

  it('faellt bei unbekannter Quest auf die Id zurueck', () => {
    expect(
      renderFragment({ type: 'quest', questId: 'a99q9', rewardOffers: [] })
    ).toBe('a99q9');
  });

  it('nennt die Quest ohne NPC, wenn kein Angebot passt', () => {
    // Der Name steht in quests.json, das Angebot nicht. Frueher haette das
    // undefined in den Text geschrieben.
    const text = renderFragment({
      type: 'quest',
      questId: 'a1q1',
      rewardOffers: ['gibt_es_nicht']
    });

    expect(text).toBe('Enemy at the Gate');
    expect(text).not.toContain('undefined');
  });

  it('nimmt das erste Angebot, das einen NPC nennt', () => {
    expect(
      renderFragment({
        type: 'quest',
        questId: 'a1q1',
        rewardOffers: ['gibt_es_nicht', 'a1q1']
      })
    ).toBe('Enemy at the Gate (Tarkleigh)');
  });

  it('kennt fuer eine unbekannte Zone kein Stadtsymbol', () => {
    expect(fragmentIcon({ type: 'enter', areaId: 'gibt_es_nicht' })).toBeNull();
  });
});

describe('Richtungen ausserhalb der Tabelle', () => {
  it('nennt bei unbekanntem Index die Gradzahl statt undefined', () => {
    expect(renderFragment({ type: 'dir', dirIndex: 8 })).toBe('360 Grad');
    expect(renderFragment({ type: 'dir', dirIndex: 12 })).toBe('540 Grad');
  });

  it('deckt alle acht gueltigen Richtungen ab', () => {
    const namen = Array.from({ length: 8 }, (_v, i) =>
      renderFragment({ type: 'dir', dirIndex: i })
    );

    expect(namen).toEqual([
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest'
    ]);
    expect(new Set(namen).size).toBe(8);
  });

  it('schreibt klein, weil die Richtung immer mitten im Satz steht', () => {
    const namen = Array.from({ length: 8 }, (_v, i) =>
      renderFragment({ type: 'dir', dirIndex: i })
    );

    for (const name of namen) expect(name).toBe(name.toLowerCase());
  });
});

describe('Kuerzel nur im Richtungsfragment', () => {
  it('laesst einzelne Buchstaben im Freitext in Ruhe', () => {
    // In der echten Route steht genau ein solcher Fall, und dort meint das S
    // die Form des Weges, nicht Sueden. Freitext wird darum nicht angefasst.
    expect(renderFragment('S shape or L shape leads to exit')).toBe(
      'S shape or L shape leads to exit'
    );

    expect(
      renderFragment({
        type: 'quest_text',
        value: 'Look for the NE corner'
      })
    ).toBe('Look for the NE corner');
  });
});

describe('leere und ungewoehnliche Inhalte', () => {
  it('crafting ohne Rezepte bleibt lesbar', () => {
    expect(renderFragment({ type: 'crafting', crafting_recipes: [] })).toBe(
      'Crafting: '
    );
  });

  it('crafting mit mehreren Rezepten zaehlt sie auf', () => {
    expect(
      renderFragment({ type: 'crafting', crafting_recipes: ['A', 'B'] })
    ).toBe('Crafting: A, B');
  });

  it('reward_vendor ohne Preis nennt nur den Gegenstand', () => {
    expect(renderFragment({ type: 'reward_vendor', item: 'Iron Ring' })).toBe(
      'Iron Ring'
    );
  });

  it('leerer String bleibt leerer String', () => {
    expect(renderFragment('')).toBe('');
  });

  it('renderStepText auf einem Schritt ohne Teile', () => {
    const leer: RouteData.FragmentStep = {
      type: 'fragment_step',
      parts: [],
      subSteps: [],
      edgeIndex: null
    };

    expect(renderStepText(leer)).toBe('');
  });
});

describe('gegen die echte Route', () => {
  const route = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
      ),
      'utf8'
    )
  ) as RouteData.Route;

  function allFragments(): Fragments.AnyFragment[] {
    const out: Fragments.AnyFragment[] = [];
    for (const section of route.sections) {
      for (const step of section.steps) {
        if (step.type !== 'fragment_step') continue;
        out.push(...step.parts);
        for (const sub of step.subSteps) out.push(...sub.parts);
      }
    }
    return out;
  }

  it('rendert jedes Fragment der Route ohne Luecke', () => {
    for (const fragment of allFragments()) {
      const text = renderFragment(fragment);

      expect(typeof text).toBe('string');
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('NOT FOUND');
      expect(text).not.toContain('[object');
    }
  });

  it('gibt jedem Fragment eine gueltige Farbe', () => {
    for (const fragment of allFragments()) {
      expect(typeof fragmentColour(fragment)).toBe('string');
    }
  });

  it('kein Schritt der Route rendert zu einem leeren Text', () => {
    for (const section of route.sections) {
      for (const step of section.steps) {
        if (step.type !== 'fragment_step') continue;
        expect(renderStepText(step).trim().length).toBeGreaterThan(0);
      }
    }
  });
});
