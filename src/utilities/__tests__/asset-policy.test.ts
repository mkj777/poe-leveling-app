import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Im Release 0.91.0 fehlten zwei Icons. Vite haengt Dateien unter
 * `assetsInlineLimit` als `data:`-URI ins Bundle, quest.png und town.png lagen
 * mit knapp unter 4096 Byte darunter, und die CSP der Anwendung erlaubt fuer
 * Bilder nur `self`. Im Dev-Server fiel das nie auf, weil der jede Datei
 * einzeln ausliefert.
 *
 * Beides muss zusammenpassen. Welche Seite man aendert, ist offen, nur
 * auseinanderlaufen duerfen sie nicht.
 */
describe('Bilder im Build', () => {
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

  it('inlined nichts, solange die CSP keine data:-URIs zulaesst', () => {
    const inliningOff = /assetsInlineLimit:\s*0\b/.test(viteConfig);
    if (!inliningOff) expect(imgSrc).toContain('data:');
    else expect(inliningOff).toBe(true);
  });
});
