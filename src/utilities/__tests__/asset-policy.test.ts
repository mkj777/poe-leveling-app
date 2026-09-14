import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Two icons were missing in release 0.91.0. Vite inlines files below
 * `assetsInlineLimit` as `data:` URIs into the bundle, quest.png and town.png
 * were just below 4096 bytes, and the app's CSP allows only `self` for
 * images. The dev server never showed it, because it serves every file
 * individually.
 *
 * Both must fit together. Which side gets changed is open; they just must
 * not drift apart.
 */
describe('images in the build', () => {
  const root = path.resolve(__dirname, '../../..');

  const viteConfig = fs.readFileSync(
    path.join(root, 'vite.config.ts'),
    'utf8'
  );

  const csp = JSON.parse(
    fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8')
  ).app.security.csp as string;

  const imgSrc =
    csp.split(';').find((part) => part.trim().startsWith('img-src')) ?? '';

  it('inlines nothing as long as the CSP allows no data: URIs', () => {
    const inliningOff = /assetsInlineLimit:\s*0\b/.test(viteConfig);
    if (!inliningOff) expect(imgSrc).toContain('data:');
    else expect(inliningOff).toBe(true);
  });
});
