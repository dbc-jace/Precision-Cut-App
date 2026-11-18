# Precision Cut app: notes for Claude

## Shipping changes: always bump the version
Phones keep old copies of app.js / store.js / styles.css until the version number changes.
Before committing any change to app.js, store.js, styles.css, index.html or firebase-config.js, run:

    ./bump-version.sh

It updates version.json, APP_VERSION in app.js, and every ?v= tag. The app checks version.json
when it opens and reloads itself onto the new version. (On Jace's Mac a pre-commit hook in
.githooks/ does this automatically; elsewhere run it by hand. Enable the hook with
`git config core.hooksPath .githooks`.)

## Things Claude can't do from a cloud session (Jace does them by hand)
Cloud sessions run on a cloud computer, not Jace's Mac: no Chrome, no Firebase login, no gcloud login.
Don't ask Jace to paste Google or Firebase sign-in codes into chat. To act on the Mac, Jace adds a
folder in the Claude desktop app (Settings > Claude Code > Remote Control), then Claude requests it.

- **Publish security rules whenever firestore.rules changes.** In Chrome, open
  raw.githubusercontent.com/dbc-jace/Precision-Cut-App/main/firestore.rules and copy it all
  (Cmd+A, Cmd+C). Then go to console.firebase.google.com > precision-cut-215ed > Firestore Database
  > Rules, paste over everything, and Publish. Until then, any new customer action fails
  (e.g. customers replying, marking read or deleting messages in the app).
- **Email sender settings live in Firebase, not in code.** Customer emails are only Firebase Auth
  emails (confirm email, password reset), sent from noreply@precision-cut-215ed.firebaseapp.com.
  Change the sender or Reply-to in Firebase Console > Authentication > Templates. Reply-to must not
  be jace.precisioncutlawns@gmail.com. A custom sender needs a domain Jace owns (e.g.
  noreply@precisioncutlawns.org via "Customize domain"); Firebase can't send as a Gmail address.
  Jace's "damidget4 no-reply" request is unresolved: the exact address was never given. Ask for it.
- **jace.precisioncutlawns@gmail.com only receives owner alerts** (sign-up alerts via FormSubmit,
  Settings > Users). Never use it as a sender or reply-to for customers. FormSubmit needs a
  one-time "Activate" click on the test email.

## How things work (decisions Jace made, Nov 2026)
- Seasons: mowing April-November, snow October-March (GRASS_MONTHS / SNOW_MONTHS in app.js).
  Out of season no one is added to the route automatically.
- No "starting week" field. Weekly and every-2-weeks customers go on the route from their first
  week as a customer (dueGrass / mowWeek in app.js).
- Each week's route fills itself from plans, customer skips and in-app "Request a mow".
  Jace can also add anyone by hand (Route > + Add) or Skip them off. The app can't read replies
  to his texts, so on-call yeses by text get added by hand.
- In-app messages: replies live on the request doc (`replies` array). Jace replies from
  Route > Requests or a customer's page. Customers see new-message alerts, reply, mark read, and
  delete (custHidden, hidden only for them).
- Stuck sign-ups: the confirm-email screen re-sends the email if the last one is over 10 minutes old.
