# Kitsu Android (companion)

Phone UI for Kitsu. Matrix/crypto stay on the **desktop app** (or any Kitsu server on your LAN). The APK is a Capacitor shell that connects over Wi‑Fi.

## Install

Debug APK:

`Relay/dist/Kitsu-0.2.0-android-debug.apk`

```bash
adb install -r dist/Kitsu-0.2.0-android-debug.apk
```

## Use

1. Run **Kitsu desktop** on your PC (binds LAN on port **6080**).
2. Settings → About → **Mobile companion** — copy the `http://192.168.x.x:6080` address.
3. Open Kitsu on the phone (same Wi‑Fi) and Connect.

## Develop

```bash
export PATH="/tmp/jdk-21/bin:/tmp/node-full/bin:$PATH"
export JAVA_HOME=/tmp/jdk-21
export ANDROID_HOME=/tmp/android-sdk

cd mobile
npm run build:apk
```

## Later

A fully offline Android client needs Matrix moved into the WebView (like Cinny). This companion ships first.
