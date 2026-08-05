import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, 'public/vendor');
fs.mkdirSync(outdir, { recursive: true });

const WASM_PUBLIC_URL = '/vendor/matrix-wasm/matrix_sdk_crypto_wasm_bg.wasm';

/** Patch crypto-wasm so IIFE bundles don't crash on `new URL(..., import.meta.url)`. */
function cryptoWasmUrlPlugin() {
  return {
    name: 'kitsu-crypto-wasm-url',
    setup(build) {
      build.onLoad({ filter: /matrix-sdk-crypto-wasm[\\/]index\.mjs$/ }, async (args) => {
        let contents = await fs.promises.readFile(args.path, 'utf8');
        contents = contents.replace(
          /const defaultURL = new URL\("\.\/pkg\/matrix_sdk_crypto_wasm_bg\.wasm", import\.meta\.url\);/,
          `const defaultURL = ${JSON.stringify(WASM_PUBLIC_URL)};`,
        );
        if (!contents.includes(WASM_PUBLIC_URL)) {
          throw new Error('Failed to patch matrix-sdk-crypto-wasm defaultURL');
        }
        return { contents, loader: 'js', resolveDir: path.dirname(args.path) };
      });
    },
  };
}

await esbuild.build({
  entryPoints: [path.join(root, 'src/browser-matrix/entry.js')],
  bundle: true,
  outfile: path.join(outdir, 'matrix-browser.js'),
  format: 'iife',
  platform: 'browser',
  target: ['chrome111', 'safari15'],
  minify: true,
  sourcemap: true,
  logLevel: 'info',
  mainFields: ['browser', 'module', 'main'],
  conditions: ['browser', 'import', 'default'],
  loader: {
    '.wasm': 'file',
  },
  assetNames: 'matrix-wasm/[name]',
  plugins: [cryptoWasmUrlPlugin()],
  banner: {
    js: '/* kitsu matrix-browser bundle */',
  },
});

// Ensure wasm assets sit next to the public URL the shim uses
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
