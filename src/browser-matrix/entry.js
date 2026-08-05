/**
 * Browser entry for matrix-js-sdk (bundled to public/vendor/matrix-browser.js).
 * Exposes window.MatrixBrowserSdk for the Kitsu standalone API shim.
 */
import * as sdk from 'matrix-js-sdk';
import { initAsync as initCryptoWasm } from '@matrix-org/matrix-sdk-crypto-wasm';

let cryptoWasmReady = null;

async function ensureCryptoWasm() {
  if (!cryptoWasmReady) {
    const url = new URL('/vendor/matrix-wasm/matrix_sdk_crypto_wasm_bg.wasm', location.href).href;
    cryptoWasmReady = initCryptoWasm(url);
  }
  await cryptoWasmReady;
}

window.MatrixBrowserSdk = Object.assign(sdk, { ensureCryptoWasm });
console.info('[kitsu] matrix-js-sdk ready', sdk?.VERSION || '');
