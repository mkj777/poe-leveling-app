import { describe, expect, it } from 'vitest';

import { advanceEdge, parseAreaFromLog, reanchorEdge } from '../route-progress';

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
