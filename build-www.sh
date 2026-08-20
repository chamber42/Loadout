#!/bin/sh
# ==========================================================================
# Assemble www/ — the exact set of files that goes inside the native app.
#
# Capacitor copies its webDir wholesale into the app bundle, so webDir can
# never be the repo root: node_modules alone is tens of megabytes, and the
# generated ios/ project would end up nested inside the app it builds.
#
# www/ is generated, never edited. It is in .gitignore and is safe to
# delete at any time; this script rebuilds it from the tracked sources.
#
# sw.js is deliberately NOT copied. Every asset is already on the device
# in a native build, so a service worker would add a second cache with its
# own version to keep in step with this one, and buy nothing.
# ==========================================================================
set -e
cd "$(dirname "$0")"

rm -rf www
mkdir -p www

# Single files at the root of the app.
for f in index.html styles.css fonts.css icons.js privacy.html \
         manifest.webmanifest icon.svg THIRD-PARTY-NOTICES.md; do
  cp "$f" www/
done

# Directories copied whole.
for d in js fonts app-icons licenses; do
  cp -R "$d" www/
done

echo "www/ built — $(find www -type f | wc -l | tr -d ' ') files, $(du -sh www | cut -f1)"
