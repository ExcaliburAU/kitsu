/**
 * Browser entry for matrix-js-sdk (bundled to public/vendor/matrix-browser.js).
 * Exposes window.MatrixBrowserSdk for the Kitsu standalone API shim.
 */
import * as sdk from 'matrix-js-sdk';
import { initAsync as initCryptoWasm } from '@matrix-org/matrix-sdk-crypto-wasm';

const WASM_URL = '/vendor/matrix-wasm/matrix_sdk_crypto_wasm_bg.wasm';

let cryptoWasmReady = null;

async function ensureCryptoWasm() {
  if (!cryptoWasmReady) {
    cryptoWasmReady = initCryptoWasm(WASM_URL);
  }
  await cryptoWasmReady;
}

try {
  window.MatrixBrowserSdk = Object.assign(sdk, { ensureCryptoWasm });
  console.info('[kitsu] matrix-js-sdk ready', sdk?.VERSION || '');
} catch (error) {
  console.error('[kitsu] matrix-js-sdk failed to expose', error);
  window.MatrixBrowserSdk = null;
  window.__kitsuMatrixBootError = error;
}
