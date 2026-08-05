#!/usr/bin/env node
/**
 * Sync desktop public/ UI into Capacitor www/ for standalone Android.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const www = path.join(root, 'www');
const publicDir = path.join(root, '..', 'public');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

const matrixBundle = path.join(publicDir, 'vendor', 'matrix-browser.js');
if (!fs.existsSync(matrixBundle)) {
  console.error('Missing public/vendor/matrix-browser.js — run: npm run build:matrix-browser');
  process.exit(1);
}

fs.rmSync(www, { recursive: true, force: true });
copyDir(publicDir, www);

const indexPath = path.join(www, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('id="loginView"') || !html.includes('id="chatView"')) {
  console.error('sync-www: public/index.html looks truncated — aborting');
  process.exit(1);
}

// Force standalone mode for the packaged app.
html = html.replace(
  '<head>',
  `<head>\n    <script>try{localStorage.setItem('kitsu.standalone','1');document.documentElement.classList.add('is-native-app','android-capacitor')}catch(e){}</script>`,
);

// Drop the desktop dynamic boot; inject blocking script tags so app.js never races.
html = html.replace(
  /<!-- kitsu-standalone-boot -->[\s\S]*?<!-- \/kitsu-standalone-boot -->\s*/m,
  '',
);

if (!html.includes('<script src="/vendor/matrix-browser.js"></script>')) {
  html = html.replace(
    '<script defer src="/app.js"></script>',
    `<script src="/vendor/matrix-browser.js"></script>
    <script src="/vendor/kitsu-browser-api.js"></script>
    <script defer src="/app.js"></script>`,
  );
}

if (
  !html.includes('id="loginView"') ||
  !html.includes('<script src="/vendor/matrix-browser.js"></script>') ||
  !html.includes('href="/style.css"') ||
  html.length < 50_000
) {
  console.error('sync-www: refused to write bad index.html (%d bytes)', html.length);
  process.exit(1);
}

// Bust WebView asset cache so CSS/JS updates ship with each APK.
let assetVer = '0';
try {
  assetVer = String(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || '0');
} catch (_) {}
html = html
  .replace(/href="\/style\.css"/g, `href="/style.css?v=${assetVer}"`)
  .replace(/href="\/themes\.css"/g, `href="/themes.css?v=${assetVer}"`)
  .replace(/src="\/app\.js"/g, `src="/app.js?v=${assetVer}"`);

fs.writeFileSync(indexPath, html);
console.log('www synced from public/ (standalone, %d bytes index, v=%s)', html.length, assetVer);
