import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, 'public/vendor');
fs.mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'src/browser-matrix/entry.js')],
  bundle: true,
  outfile: path.join(outdir, 'matrix-browser.js'),
  format: 'iife',
  platform: 'browser',
  target: ['chrome120', 'safari16'],
  minify: true,
  sourcemap: true,
  logLevel: 'info',
  mainFields: ['browser', 'module', 'main'],
  conditions: ['browser', 'import', 'default'],
  loader: {
    '.wasm': 'file',
  },
  assetNames: 'matrix-wasm/[name]',
});

// Copy wasm assets next to the bundle if esbuild emitted them elsewhere
const wasmSrc = path.join(root, 'node_modules/@matrix-org/matrix-sdk-crypto-wasm/pkg');
const wasmDest = path.join(outdir, 'matrix-wasm');
if (fs.existsSync(wasmSrc)) {
  fs.mkdirSync(wasmDest, { recursive: true });
  for (const name of fs.readdirSync(wasmSrc)) {
    if (name.endsWith('.wasm') || name.endsWith('.js')) {
      fs.copyFileSync(path.join(wasmSrc, name), path.join(wasmDest, name));
    }
  }
}

console.log('built public/vendor/matrix-browser.js');
