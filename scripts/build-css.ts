/** Writes dist/styles.css, dist/core.css and the legacy dist/editor.css alias. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCore, buildStandalone } from './css';

const dist = join(import.meta.dirname, '../dist');
mkdirSync(dist, { recursive: true });

const standalone = await buildStandalone();
writeFileSync(join(dist, 'styles.css'), standalone);
writeFileSync(join(dist, 'editor.css'), standalone);
writeFileSync(join(dist, 'core.css'), buildCore());

console.log(`styles.css ${(standalone.length / 1024).toFixed(1)} kB, core.css written`);
