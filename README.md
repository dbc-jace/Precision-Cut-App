# Precision Cut Lawns

A phone-friendly business app for Precision Cut Lawns: route, customers, invoices, money and quotes, with separate logins for the admin, crew and customers.

- **Admin (Jace):** everything.
- **Crew:** the week's route, snow days, customer addresses and notes, and "Mark done". No prices or money.
- **Customers:** their schedule, **Skip this week** (1 free skip a month, before the skip deadline), **Request snow removal**, messages to Jace, their invoices, and Venmo/Zelle with QR codes.

It's plain HTML/CSS/JS with no build step, like Higher Ground. Data and logins live in Firebase. Until Firebase is connected the app runs in **demo mode**: no login, data only on that device, and a switcher to view it as admin, crew or a customer.

## How it works
- **Grass plans:** Weekly, Every 2 weeks (on schedule no matter what), or On call ("Would you like your grass cut today?").
- **Snow plans:** Seasonal (billed up front with "Bill snow season") or Per snow (only when the customer requests it).
- **Wednesdays:** Route → **Weekly reminders → Send**. You tap through each customer and Messages opens pre-filled with a skip link.
- **Mark done** → set this week's price and add-ons → **Done & send invoice**. Your phone's share sheet opens with the PDF; pick Messages.
- **Paid:** a customer taps "I've paid", you see "says they paid" on Money, and **Confirm paid** counts it as income.
- **Money:** income (paid invoices) and expenses by week, month and year, the unpaid list, and a CSV download for taxes.

## Setup
See **HANDOFF.md** for the step-by-step Firebase setup you can do from your phone.

## Files
- `index.html`, `styles.css`, `app.js`: the app
- `store.js`: Firebase or demo storage
- `firebase-config.js`: your Firebase web config (safe to be public)
- `firestore.rules`: who can read and write what. Paste these into Firebase.
- `logo.jpg`, `icon-512.png`, `manifest.json`: branding and home-screen icon

## Security & privacy
- The **code** is public; the **data** lives in Firebase and is protected by `firestore.rules` on Google's servers.
- Only emails you add can get in. Customers can only see their own info and invoices. Crew can't see prices or money.
- Never commit backups, CSV exports or screenshots of customer data to this repo.

## Run locally
```
python3 -m http.server 8000
```
Then open http://localhost:8000.
