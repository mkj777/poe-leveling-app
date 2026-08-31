import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { RouteData } from '@/lib/exile-leveling';
import { OVERLAY_SHORTCUT_HINT, withShortcutHint } from '../shortcut-hint';
import { SHORTCUT_CLOSE_OVERLAY, shortcutLabel } from '../shortcuts';
import { blockSections, flattenSteps, selectPending } from '../route-progress';

function step(
  edgeIndex: number | null,
  text: string
): RouteData.FragmentStep {
  return { type: 'fragment_step', parts: [text], subSteps: [], edgeIndex };
}

const gem: RouteData.GemStep = {
  type: 'gem_step',
  requiredGem: { id: 'x', note: '', count: 1 },
  rewardType: 'quest',
  count: 1
};

describe('shortcutLabel', () => {
  it('schreibt das Kuerzel so, wie es auf der Tastatur steht', () => {
    expect(shortcutLabel('CmdOrCtrl+Alt+0')).toBe('Ctrl+Alt+0');
  });

  it('laesst ein Kuerzel ohne CmdOrCtrl in Ruhe', () => {
    expect(shortcutLabel('Alt+F4')).toBe('Alt+F4');
  });
});

describe('OVERLAY_SHORTCUT_HINT', () => {
  it('nennt das Kuerzel, mit dem das Overlay zugeht', () => {
    expect(OVERLAY_SHORTCUT_HINT.parts).toEqual([
      `${shortcutLabel(SHORTCUT_CLOSE_OVERLAY)} closes the overlay.`
    ]);
  });

  it('nennt genau das Kuerzel, das die App auch registriert', () => {
    // Ein Kuerzel, das im Guide anders heisst als es wirkt, waere schlimmer
    // als keins. Frueher standen die beiden als getrennte Zeichenketten da.
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../pages/main.page.tsx'),
      'utf8'
    );

    expect(source).toContain('register(SHORTCUT_CLOSE_OVERLAY');
  });

  it('traegt keine Kante und macht damit keinen eigenen Block auf', () => {
    expect(OVERLAY_SHORTCUT_HINT.edgeIndex).toBeNull();
  });
});

describe('withShortcutHint', () => {
  const route: RouteData.Route = {
    edges: ['1_1_1', '1_1_2'],
    sections: [
      { name: 'Act 1', steps: [step(0, 'betrete A')] },
      { name: 'Act 2', steps: [step(1, 'betrete B'), step(null, 'raeum auf')] }
    ]
  };

  it('haengt den Hinweis unter den letzten Schritt', () => {
    const steps = withShortcutHint(route).sections[1]
      .steps as RouteData.FragmentStep[];

    expect(steps.at(-1)!.subSteps).toEqual([OVERLAY_SHORTCUT_HINT]);
  });

  it('legt keinen eigenen Schritt an', () => {
    const vorher = route.sections.flatMap((section) => section.steps).length;
    const nachher = withShortcutHint(route)
      .sections.flatMap((section) => section.steps).length;

    expect(nachher).toBe(vorher);
  });

  it('laesst vorhandene Unterzeilen stehen', () => {
    const mitUnterzeile: RouteData.Route = {
      edges: [],
      sections: [
        {
          name: 'Act 10',
          steps: [{ ...step(0, 'Hand in'), subSteps: [step(null, '/passives')] }]
        }
      ]
    };

    const steps = withShortcutHint(mitUnterzeile).sections[0]
      .steps as RouteData.FragmentStep[];

    expect(steps[0].subSteps).toHaveLength(2);
    expect(steps[0].subSteps.at(-1)).toBe(OVERLAY_SHORTCUT_HINT);
  });

  it('laesst die Kantenliste und die uebrigen Akte in Ruhe', () => {
    const result = withShortcutHint(route);

    expect(result.edges).toBe(route.edges);
    expect(result.sections[0]).toBe(route.sections[0]);
  });

  it('sucht ueber leere Akte hinweg nach dem letzten Schritt', () => {
    const mitLeeremAkt: RouteData.Route = {
      edges: [],
      sections: [
        { name: 'Act 1', steps: [step(0, 'a')] },
        { name: 'Act 2', steps: [] }
      ]
    };

    const steps = withShortcutHint(mitLeeremAkt).sections[0]
      .steps as RouteData.FragmentStep[];

    expect(steps[0].subSteps).toEqual([OVERLAY_SHORTCUT_HINT]);
  });

  it('geht an einem Gem-Schritt vorbei', () => {
    const mitGem: RouteData.Route = {
      edges: [],
      sections: [{ name: 'Act 1', steps: [step(0, 'a'), gem] }]
    };

    const steps = withShortcutHint(mitGem).sections[0].steps;

    expect(steps[1]).toBe(gem);
    expect((steps[0] as RouteData.FragmentStep).subSteps).toEqual([
      OVERLAY_SHORTCUT_HINT
    ]);
  });

  it('kommt mit einer Route ohne Schritte zurecht', () => {
    const leer: RouteData.Route = { edges: [], sections: [] };
    const nurGem: RouteData.Route = {
      edges: [],
      sections: [{ name: 'Act 1', steps: [gem] }]
    };

    expect(withShortcutHint(leer)).toBe(leer);
    expect(withShortcutHint(nurGem)).toBe(nurGem);
  });
});

describe('an der echten Route', () => {
  const route: RouteData.Route = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
      ),
      'utf8'
    )
  );

  it('steht am Ende dessen, was das Overlay zuletzt zeigt', () => {
    const result = withShortcutHint(route);
    const letzte = result.edges.length - 1;

    const block = blockSections(result.sections)
      .flatMap((section) => section.blocks)
      .find((entry) => entry.edgeIndex === letzte);

    const letzterSchritt = block!.steps.at(-1)!;

    expect(letzterSchritt.subSteps.at(-1)).toBe(OVERLAY_SHORTCUT_HINT);
    expect(
      selectPending(flattenSteps(result.sections), letzte).at(-1)
    ).toBe(letzterSchritt);
  });

  it('laesst den /passives-Hinweis des Upstreams unangetastet', () => {
    // Der steht schon in den Daten. Ihn zu wiederholen waere doppelt.
    const alle = withShortcutHint(route)
      .sections.flatMap((section) => section.steps)
      .filter(
        (entry): entry is RouteData.FragmentStep =>
          entry.type === 'fragment_step'
      )
      .flatMap((entry) => [entry, ...entry.subSteps])
      .flatMap((entry) => entry.parts)
      .filter(
        (part) =>
          typeof part !== 'string' &&
          'value' in part &&
          part.value === '/passives'
      );

    expect(alle).toHaveLength(1);
  });
});
