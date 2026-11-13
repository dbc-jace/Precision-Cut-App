#!/bin/sh
# Bumps the app version everywhere it appears, so phones pick up the new code.
# Usage: ./bump-version.sh          (1.3.1 -> 1.3.2)
#        ./bump-version.sh 1.4.0    (set it exactly)
# Runs automatically on commit via .githooks/pre-commit.
set -e
cd "$(dirname "$0")"
old=$(sed -n 's/.*"version": *"\([0-9.]*\)".*/\1/p' version.json)
if [ -n "$1" ]; then new="$1"; else
  new=$(echo "$old" | awk -F. '{ printf "%d.%d.%d", $1, $2, $3 + 1 }')
fi
printf '{ "version": "%s" }\n' "$new" > version.json
sed -i.bak "s/const APP_VERSION = '[0-9.]*'/const APP_VERSION = '$new'/; s/store\.js?v=[0-9.]*/store.js?v=$new/" app.js
sed -i.bak -E "s/(app\.js|styles\.css)\?v=[0-9.]+/\1?v=$new/g" index.html
rm -f app.js.bak index.html.bak
echo "Version $old -> $new"
