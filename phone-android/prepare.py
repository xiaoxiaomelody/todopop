#!/usr/bin/env python3
"""Turns the phone web app into the Android app. Run from this folder.

  python3 prepare.py www               copy ../docs/app into www/ (what the app shows)
  python3 prepare.py native 0.1.1 7    after `npx cap add android`: icons, launch screen,
                                       camera permission, todopop.app links, version
"""
import os, re, sys, shutil, glob
HERE = os.path.dirname(os.path.abspath(__file__))

def www():
    out = os.path.join(HERE, 'www'); shutil.rmtree(out, ignore_errors=True)
    shutil.copytree(os.path.join(HERE, '..', 'docs', 'app'), out)
    p = os.path.join(out, 'index.html'); s = open(p, encoding='utf-8').read()
    # inside the app there is nothing to install and no offline cache to keep: no service worker, no web manifest
    s = re.sub(r"<script>if\('serviceWorker' in navigator\)[^<]*</script>\n?", '', s)
    s = re.sub(r'<link rel="manifest"[^>]*>\n?', '', s)
    assert 'serviceWorker' not in s
    open(p, 'w', encoding='utf-8').write(s)
    for f in ['sw.js', 'manifest.webmanifest']:
        try: os.remove(os.path.join(out, f))
        except FileNotFoundError: pass
    print('www ready')

def native(version, code):
    app = os.path.join(HERE, 'android', 'app'); res = os.path.join(app, 'src', 'main', 'res')
    # icons
    for d in ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']:
        for f in ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']:
            shutil.copy(os.path.join(HERE, 'res', 'mipmap-' + d, f), os.path.join(res, 'mipmap-' + d, f))
    bg = os.path.join(res, 'values', 'ic_launcher_background.xml')
    open(bg, 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')
    # launch screen: the bubble on TODOPOP's off-white, in every size the template ships
    from PIL import Image
    logo = Image.open(os.path.join(HERE, 'res', 'splash-logo.png')).convert('RGBA')
    for sp in glob.glob(os.path.join(res, 'drawable*', 'splash.png')):
        w, h = Image.open(sp).size; im = Image.new('RGBA', (w, h), (247, 247, 245, 255))
        s = int(min(w, h)*.32); lg = logo.resize((s, s), Image.LANCZOS); im.alpha_composite(lg, ((w - s)//2, (h - s)//2))
        im.convert('RGB').save(sp)
    # manifest: the camera (for Scan code), and todopop.app/app links open the app (the pairing QR code)
    mp = os.path.join(app, 'src', 'main', 'AndroidManifest.xml'); m = open(mp).read()
    if 'android.permission.CAMERA' not in m:
        m = m.replace('<uses-permission android:name="android.permission.INTERNET" />',
            '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />')
    if 'todopop.app' not in m:
        link = '''
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="todopop.app" android:pathPrefix="/app" />
            </intent-filter>
'''
        m = re.sub(r'(<activity[^>]*MainActivity[^>]*>)', lambda x: x.group(1) + link, m, count=1)
    assert 'android.permission.CAMERA' in m and 'todopop.app' in m, 'manifest not patched'
    m = m.replace('android:screenOrientation="portrait" ', '')
    m = re.sub(r'(<activity)', r'\1 android:screenOrientation="portrait"', m, count=1)
    open(mp, 'w').write(m)
    # version
    gp = os.path.join(app, 'build.gradle'); g = open(gp).read()
    g = re.sub(r'versionCode \d+', f'versionCode {int(code)}', g); g = re.sub(r'versionName "[^"]*"', f'versionName "{version}"', g)
    open(gp, 'w').write(g)
    print('android project ready', version, code)

if __name__ == '__main__':
    if sys.argv[1] == 'www': www()
    elif sys.argv[1] == 'native':
        import json
        v = sys.argv[2].lstrip('v')
        if not re.match(r'^\d+\.\d+', v): v = json.load(open(os.path.join(HERE, 'package.json')))['version'] # a test build (from a branch): the package version
        native(v, sys.argv[3])
# TODOPOP: touched 2026-11-08
