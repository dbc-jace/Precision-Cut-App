PRECISION CUT APP - PHONE SETUP (about 15 minutes, all free)

App link: https://app.precisioncutlawns.org/
Until step 7 is done, the app runs in demo mode (no login, data on that phone only). Try it out, but don't enter real customers yet.

Tip: if a Firebase page looks cramped, tap "aA" in Safari's address bar, then "Request Desktop Website".

== PART 1: FIREBASE (console.firebase.google.com) ==

1. CREATE PROJECT
   - Go to console.firebase.google.com and sign in with your Google account.
   - Tap "Create a project". Name it: precision-cut
   - Turn OFF Google Analytics. Tap Create.

2. DATABASE
   - Menu (☰) > Build > Firestore Database > Create database
   - Location: pick one in the US (e.g. nam5). Choose "Start in production mode". Tap Create.

3. SECURITY RULES (who can see what)
   - Open this link in a new tab:
     https://raw.githubusercontent.com/dbc-jace/Precision-Cut-App/main/firestore.rules
   - Press and hold the text > Select All > Copy.
   - Back in Firestore, tap the "Rules" tab. Select everything in the box, delete it, and paste.
   - Tap Publish.

4. SIGN-IN
   - Menu > Build > Authentication > Get started
   - Sign-in method tab: turn on "Google" (pick your email as support email, Save).
   - Tap "Add new provider" > "Email/Password" > turn on the first switch > Save.

5. ALLOW THE APP'S WEBSITE
   - Still in Authentication: Settings tab > Authorized domains > Add domain
   - Type: app.precisioncutlawns.org   > Add

6. GET THE APP'S KEYS
   - Tap the gear icon (top of menu) > Project settings
   - Scroll to "Your apps" > tap the </> (Web) icon
   - Nickname: Precision Cut. Leave "Firebase Hosting" unchecked. Tap Register app.
   - You'll see a block that starts with  const firebaseConfig = {
   - Copy that whole block (from "const firebaseConfig" to the closing "};").

7. CONNECT THE KEYS TO THE APP (pick one)
   EASY: paste that block into your chat with Claude and say "add my Firebase config". Done.
   OR do it yourself on GitHub:
   - Open github.com/dbc-jace/Precision-Cut-App/blob/main/firebase-config.js
   - Tap the pencil (Edit). Fill in each "" with the matching value from your block
     (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
   - Tap "Commit changes". Wait about 1 minute.
   These keys are safe to be public. The rules from step 3 protect your data.

== PART 2: FIRST SIGN-IN (do this right away) ==

8. Open https://app.precisioncutlawns.org/
   - Tap "Sign in with Google" using the account you want to be the admin.
   - You'll see "Set up as admin". Tap it right away. The first person to do this becomes the admin.

9. PUT IT ON YOUR HOME SCREEN
   - In Safari tap Share > Add to Home Screen > Add. Open it from the new Precision Cut icon.
   - You may need to sign in once more inside the home-screen app.

10. SETTINGS (gear tab)
   - General: create your add-ons (e.g. Edge sidewalk $10).
   - Payments: Zelle is set. Upload your Zelle QR (from your bank app's Zelle screen, take a screenshot and crop it). Add your Venmo link later.
   - Business info: add your website link.
   - Security: turn on the passcode lock (asks for 4 digits when the app sits idle).
   - Messages tab: edit any of the texts (reminder, invoice, welcome, etc.).

11. CUSTOMERS
   - Customers > + Add. Enter name, phone, address, email, deck height, notes,
     Grass plan + price, Snow plan + price.
   - To give a customer a login: open them > "Invite to the app". A welcome text pops up; tap Open in Messages and send.
   - They sign in with Google or "Create an account" using that same email.

12. CREW
   - Settings > Users > Add a crew member (name + email) > send the welcome text.

== EVERY WEEK ==
- WEDNESDAY: Route > Weekly reminders > Send. Tap "Text" for each customer, send it, and come back.
  On-call customers: tap "Ask", text them, and tap "Yes" for anyone who wants a mow.
- Customers can skip until the deadline (Settings > Skips; default Thursday 6 PM). 1 free skip a month.
- Plan your days with the "Planned" day picker on each stop.
- MOWING: tap "Mark done", adjust price or add-ons, then "Done & send invoice". The share sheet opens; pick Messages and the customer.
- PAID: when Zelle/Venmo comes in (or the customer taps "I've paid"), go to Money > Unpaid > Mark paid / Confirm paid. Income updates.
- EXPENSES: Money > Expenses > add gas, blades, etc.
- SNOW: per-snow customers tap "Request snow removal" in their account (you'll see it under Route > Requests, and they can text you too).
  On a snow day: Route > Snow > Start snow day, then Mark done for each. Cleared a driveway twice? Tap "+ Clean again today" on it (per-snow customers get billed for each visit). Seasonal customers: bill once up front from their page ("Bill snow season").
- BACKUP: Settings > Download backup now and then.
