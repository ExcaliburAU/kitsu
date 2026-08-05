/**
 * Install the plugin folder into common Linux Stream Deck plugin paths.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_DIR = 'com.paarrot.streamdeck.sdPlugin';
const home = os.homedir();
const candidates = [
  path.join(home, '.local/share/Elgato/StreamDeck/Plugins'),
  path.join(home, '.var/app/com.elgato.StreamDeck/data/Elgato/StreamDeck/Plugins'),
  path.join(home, 'Library/Application Support/com.elgato.StreamDeck/Plugins'),
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

const src = path.resolve(__dirname, PLUGIN_DIR);
if (!fs.existsSync(src)) {
  console.error('Plugin folder missing. Run from streamdeck-plugin/.');
  process.exit(1);
}

let installed = false;
for (const root of candidates) {
  const parent = path.dirname(root);
  if (!fs.existsSync(parent) && !fs.existsSync(root)) continue;
  fs.mkdirSync(root, { recursive: true });
  const dest = path.join(root, PLUGIN_DIR);
  fs.rmSync(dest, { recursive: true, force: true });
  copyDir(src, dest);
  console.log(`Installed → ${dest}`);
  installed = true;
}

if (!installed) {
  console.log('No Stream Deck plugin directory found yet.');
  console.log('Copy this folder manually after installing Stream Deck:');
  console.log(`  ${src}`);
  console.log('Into:');
  for (const root of candidates) console.log(`  ${root}`);
  process.exit(0);
}

console.log('Restart Stream Deck software to load the plugin.');
console.log('Kitsu must be running (local API on 127.0.0.1:33384).');
