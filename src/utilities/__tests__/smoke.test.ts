import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('testinfrastruktur', () => {
  it('löst den @-Alias auf', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
});
