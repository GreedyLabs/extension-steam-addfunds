// Builds the shippable extension into dist/:
//   - bundles src/content.ts -> dist/content.js (single IIFE, no imports at runtime)
//   - copies the static files the extension needs (manifest, styles, locales)
// esbuild only transpiles; type-checking is a separate `pnpm run typecheck`.
//
// Pass --watch to rebuild the bundle on every src/ change (used by `pnpm dev`).
// Static files (manifest, styles, locales) are copied once at startup; rerun the
// command if you change those.
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const OUT = 'dist';
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/content.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  charset: 'utf8',
  outfile: `${OUT}/content.js`,
};

function copyStatics() {
  cpSync('manifest.json', `${OUT}/manifest.json`);
  cpSync('styles.css', `${OUT}/styles.css`);
  cpSync('_locales', `${OUT}/_locales`, {
    recursive: true,
    filter: (src) => !src.endsWith('.DS_Store'),
  });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
copyStatics();

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log(`Watching src/ — rebuilding ${OUT}/content.js on change (Ctrl+C to stop)`);
} else {
  await build(options);
  console.log(`Built extension to ${OUT}/`);
}
