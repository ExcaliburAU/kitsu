# Kitsu Stream Deck Plugin

Control **Kitsu** from an Elgato Stream Deck (mute, deafen, switch room, send message, status).

Uses the same local API and action UUIDs as Paarrot (`com.paarrot.streamdeck.*`), so:

- Existing Paarrot Stream Deck layouts keep working when Kitsu is running
- The stock Paarrot plugin also works against Kitsu on `http://127.0.0.1:33384`

## Requirements

- Stream Deck software 6.6+
- Kitsu desktop/AppImage running (starts Paarrot-compatible API on port **33384**)
- Windows 10+, macOS 10.14+, or Linux

## Quick install (Linux)

```bash
cd streamdeck-plugin
npm run validate
npm run install:linux
```

Then restart Stream Deck. Keep Kitsu open.

## Build `.streamDeckPlugin`

```bash
cd streamdeck-plugin
npm run build
```

Output: `dist/com.paarrot.streamdeck-v1.0.1.0.streamDeckPlugin`

## Manual install

Copy `com.paarrot.streamdeck.sdPlugin` to:

| OS | Path |
|----|------|
| Windows | `%APPDATA%\Elgato\StreamDeck\Plugins\` |
| macOS | `~/Library/Application Support/com.elgato.StreamDeck/Plugins/` |
| Linux | `~/.local/share/Elgato/StreamDeck/Plugins/` |

## Actions

| Action | API |
|--------|-----|
| Toggle Mute | `POST /mute` |
| Toggle Deafen | `POST /deafen` |
| Change Channel | `POST /channel` |
| Send Message | `POST /message/current` |
| Get Status | `GET /status` |

## Smoke test

With Kitsu running:

```bash
curl http://127.0.0.1:33384/health
curl http://127.0.0.1:33384/status
curl http://127.0.0.1:33384/channels
```
