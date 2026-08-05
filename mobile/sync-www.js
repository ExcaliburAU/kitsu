#!/usr/bin/env node
/** Copy connector page + icons into www/ for Capacitor. */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const www = path.join(root, 'www');
const icons = path.join(root, '..', 'assets');

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

for (const name of ['index.html', 'connector.js', 'connector.css']) {
  fs.copyFileSync(path.join(root, 'src', name), path.join(www, name));
}

const iconSrc = path.join(icons, 'kitsu-fox.png');
const iconAlt = path.join(icons, 'kitsu-icon.png');
const pick = fs.existsSync(iconSrc) ? iconSrc : iconAlt;
if (fs.existsSync(pick)) {
  fs.copyFileSync(pick, path.join(www, 'icon.png'));
}

console.log('www synced');
