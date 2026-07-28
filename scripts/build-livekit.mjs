import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await esbuild.build({
  entryPoints: [path.join(root, 'src/livekit/browser.js')],
  bundle: true,
  outfile: path.join(root, 'public/vendor/relay-livekit.js'),
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  minify: true,
  logLevel: 'info',
});

console.log('built public/vendor/relay-livekit.js');
