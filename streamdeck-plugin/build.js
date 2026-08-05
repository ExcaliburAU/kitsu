/**
 * Build Kitsu Stream Deck plugin (.streamDeckPlugin).
 * Keeps com.paarrot.streamdeck folder/UUID for Paarrot layout compatibility.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLUGIN_DIR = 'com.paarrot.streamdeck.sdPlugin';
const OUTPUT_DIR = 'dist';

console.log('Building Kitsu Stream Deck Plugin (Paarrot-compatible)...');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
if (!fs.existsSync(PLUGIN_DIR)) {
  console.error(`Error: Plugin directory '${PLUGIN_DIR}' not found!`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'manifest.json'), 'utf8'));
const version = manifest.Version || '1.0.0.0';
const uuid = manifest.UUID || 'com.paarrot.streamdeck';
const outputPath = path.join(OUTPUT_DIR, `${uuid}-v${version}.streamDeckPlugin`);

console.log(`Creating plugin archive: ${outputPath}`);

try {
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  if (fs.existsSync(`${outputPath}.zip`)) fs.unlinkSync(`${outputPath}.zip`);

  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Compress-Archive -Path '${PLUGIN_DIR}' -DestinationPath '${outputPath}.zip' -Force"`,
    );
    if (fs.existsSync(`${outputPath}.zip`)) fs.renameSync(`${outputPath}.zip`, outputPath);
  } else {
    execSync(`zip -r "${outputPath}" "${PLUGIN_DIR}"`);
  }

  console.log('✓ Plugin built successfully!');
  console.log(`  Output: ${outputPath}`);
  console.log(`  Version: ${version}`);
  console.log('\nRequires Kitsu (or Paarrot) running with local API on 127.0.0.1:33384');
} catch (error) {
  console.error('Error building plugin:', error.message);
  process.exit(1);
}
