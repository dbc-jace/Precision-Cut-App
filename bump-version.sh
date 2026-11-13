#!/bin/sh
# Bumps the app version everywhere it appears, so phones pick up the new code.
# Versions are the date plus a count for that day: 2026.11.13.1, 2026.11.13.2, then 2026.11.14.1.
# Usage: ./bump-version.sh                 (next version for today)
#        ./bump-version.sh 2026.11.13.5    (set it exactly)
# Runs automatically on commit via .githooks/pre-commit.
set -e
cd "$(dirname "$0")"
old=$(sed -n 's/.*"version": *"\([0-9.]*\)".*/\1/p' version.json)
if [ -n "$1" ]; then new="$1"; else
  today=$(date +%Y.%m.%d)
  case "$old" in
    "$today".*) new="$today.$(( ${old##*.} + 1 ))" ;;
    *) new="$today.1" ;;
  esac
fi
printf '{ "version": "%s" }\n' "$new" > version.json
sed -i.bak "s/const APP_VERSION = '[0-9.]*'/const APP_VERSION = '$new'/; s/store\.js?v=[0-9.]*/store.js?v=$new/" app.js
sed -i.bak -E "s/(app\.js|styles\.css)\?v=[0-9.]+/\1?v=$new/g" index.html
rm -f app.js.bak index.html.bak
echo "Version $old -> $new"
