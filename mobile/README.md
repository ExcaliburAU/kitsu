# Kitsu Android (companion)

Phone UI for Kitsu. Matrix/crypto stay on the **desktop app** (or any Kitsu server on your LAN). The APK is a Capacitor shell that connects over Wi‑Fi.

## Install (Obtainium)

1. Open Obtainium → Add App
2. Source: `https://github.com/ExcaliburAU/kitsu`
3. APK filter (optional): `Kitsu-.*\.apk`
4. Install from the latest release

Direct APK: [Kitsu-0.2.0.apk](https://github.com/ExcaliburAU/kitsu/releases/download/v0.2.0/Kitsu-0.2.0.apk)

## Use

1. Run **Kitsu desktop** on your PC (binds LAN on port **6080**).
2. Settings → About → **Mobile companion** — copy the `http://192.168.x.x:6080` address.
3. Open Kitsu on the phone (same Wi‑Fi) and Connect.

## Develop

```bash
cd mobile
npm run build:apk
```

## Later

A fully offline Android client needs Matrix moved into the WebView (like Cinny). This companion ships first.
