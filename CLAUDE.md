# Precision Cut app: notes for Claude

## Shipping changes: always bump the version
Phones keep old copies of app.js / store.js / styles.css until the version number changes.
Before committing any change to app.js, store.js, styles.css, index.html or firebase-config.js, run:

    ./bump-version.sh

It updates version.json, APP_VERSION in app.js, and every ?v= tag. The app checks version.json
when it opens and reloads itself onto the new version. (On Jace's Mac a pre-commit hook in
.githooks/ does this automatically; elsewhere run it by hand. Enable the hook with
`git config core.hooksPath .githooks`.)
