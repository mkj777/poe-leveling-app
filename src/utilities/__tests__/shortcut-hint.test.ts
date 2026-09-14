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
  it('writes the shortcut the way it appears on the keyboard', () => {
    expect(shortcutLabel('CmdOrCtrl+Alt+0')).toBe('Ctrl+Alt+0');
  });

  it('leaves a shortcut without CmdOrCtrl alone', () => {
    expect(shortcutLabel('Alt+F4')).toBe('Alt+F4');
  });
});

describe('OVERLAY_SHORTCUT_HINT', () => {
  it('names the shortcut that closes the overlay', () => {
    expect(OVERLAY_SHORTCUT_HINT.parts).toEqual([
      `${shortcutLabel(SHORTCUT_CLOSE_OVERLAY)} closes the overlay.`
    ]);
  });

  it('names exactly the shortcut the app registers', () => {
    // A shortcut named differently in the guide from how it works would be
    // worse than none. The two used to be separate strings.
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../pages/main.page.tsx'),
      'utf8'
    );

    expect(source).toContain('register(SHORTCUT_CLOSE_OVERLAY');
  });

  it('carries no edge and thus opens no block of its own', () => {
    expect(OVERLAY_SHORTCUT_HINT.edgeIndex).toBeNull();
  });
});

describe('withShortcutHint', () => {
  const route: RouteData.Route = {
    edges: ['1_1_1', '1_1_2'],
    sections: [
      { name: 'Act 1', steps: [step(0, 'enter A')] },
      { name: 'Act 2', steps: [step(1, 'enter B'), step(null, 'clean up')] }
    ]
  };

  it('appends the hint below the last step', () => {
    const steps = withShortcutHint(route).sections[1]
      .steps as RouteData.FragmentStep[];

    expect(steps.at(-1)!.subSteps).toEqual([OVERLAY_SHORTCUT_HINT]);
  });

  it('creates no step of its own', () => {
    const before = route.sections.flatMap((section) => section.steps).length;
    const after = withShortcutHint(route)
      .sections.flatMap((section) => section.steps).length;

    expect(after).toBe(before);
  });

  it('keeps existing sublines', () => {
    const withSubline: RouteData.Route = {
      edges: [],
      sections: [
        {
          name: 'Act 10',
          steps: [{ ...step(0, 'Hand in'), subSteps: [step(null, '/passives')] }]
        }
      ]
    };

    const steps = withShortcutHint(withSubline).sections[0]
      .steps as RouteData.FragmentStep[];

    expect(steps[0].subSteps).toHaveLength(2);
    expect(steps[0].subSteps.at(-1)).toBe(OVERLAY_SHORTCUT_HINT);
  });

  it('leaves the edge list and the other acts alone', () => {
    const result = withShortcutHint(route);

    expect(result.edges).toBe(route.edges);
    expect(result.sections[0]).toBe(route.sections[0]);
  });

  it('searches past empty acts for the last step', () => {
    const withEmptyAct: RouteData.Route = {
      edges: [],
      sections: [
        { name: 'Act 1', steps: [step(0, 'a')] },
        { name: 'Act 2', steps: [] }
      ]
    };

    const steps = withShortcutHint(withEmptyAct).sections[0]
      .steps as RouteData.FragmentStep[];

    expect(steps[0].subSteps).toEqual([OVERLAY_SHORTCUT_HINT]);
  });

  it('passes by a gem step', () => {
    const withGem: RouteData.Route = {
      edges: [],
      sections: [{ name: 'Act 1', steps: [step(0, 'a'), gem] }]
    };

    const steps = withShortcutHint(withGem).sections[0].steps;

    expect(steps[1]).toBe(gem);
    expect((steps[0] as RouteData.FragmentStep).subSteps).toEqual([
      OVERLAY_SHORTCUT_HINT
    ]);
  });

  it('handles a route without steps', () => {
    const empty: RouteData.Route = { edges: [], sections: [] };
    const gemOnly: RouteData.Route = {
      edges: [],
      sections: [{ name: 'Act 1', steps: [gem] }]
    };

    expect(withShortcutHint(empty)).toBe(empty);
    expect(withShortcutHint(gemOnly)).toBe(gemOnly);
  });
});

describe('on the real route', () => {
  const route: RouteData.Route = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
      ),
      'utf8'
    )
  );

  it('sits at the end of what the overlay shows last', () => {
    const result = withShortcutHint(route);
    const last = result.edges.length - 1;

    const block = blockSections(result.sections)
      .flatMap((section) => section.blocks)
      .find((entry) => entry.edgeIndex === last);

    const lastStep = block!.steps.at(-1)!;

    expect(lastStep.subSteps.at(-1)).toBe(OVERLAY_SHORTCUT_HINT);
    expect(
      selectPending(flattenSteps(result.sections), last).at(-1)
    ).toBe(lastStep);
  });

  it('leaves upstream\'s /passives hint untouched', () => {
    // It is already in the data. Repeating it would be a duplicate.
    const all = withShortcutHint(route)
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

    expect(all).toHaveLength(1);
  });
});
