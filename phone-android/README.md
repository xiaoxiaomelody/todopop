# TODOPOP for Android

The phone remote (the same app as todopop.app/app) as an installable Android app, wrapped with
[Capacitor](https://capacitorjs.com). Nothing here needs building by hand: the **Build desktop installers**
workflow builds `TODOPOP-android.apk` next to the Windows and Mac installers and attaches it to each release.

- `res/` holds the launcher icons and the launch-screen bubble.
- `prepare.py` copies `../docs/app` into the app and patches the generated Android project
  (icons, launch screen, camera permission for **Scan code**, and todopop.app/app links opening the app).
- The app is signed with the TODOPOP release key, kept in the repo's Actions secrets
  (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`). Every version must be signed with that same key,
  or phones refuse to install it as an update. Keep a copy of the key somewhere safe.
- `../docs/.well-known/assetlinks.json` lets Android open todopop.app/app links (the pairing QR code) straight in the app.
<!-- TODOPOP: touched 2026-11-08 -->
