// Quotes: a private link the customer opens without an account (APP_URL#quote=<token>).
//  - getQuote: shows the quote on that page.
//  - acceptQuote: they type their name and phone and tap Accept. The quote is marked accepted, a customer
//    record is made from it (Jace fills in the rest). The page then sends Jace two alert emails ("Quote accepted" and
//    "New customer") the same way sign-up alerts go out (FormSubmit to Settings > alert email).
// No app login is created; Jace decides later whether to invite them.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const APP_URL = 'https://app.precisioncutlawns.org/';
const QUOTE_DAYS = 30;

const ymd = (d) => d.toISOString().slice(0, 10);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
function quoteUntil(q) { const d = new Date(q.date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + QUOTE_DAYS); return ymd(d); }
const digits = (p) => String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const prettyPhone = (p) => { const d = digits(p); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || '').trim(); };

async function quoteByToken(token) {
  if (!/^[A-Za-z0-9]{16,40}$/.test(String(token || ''))) throw new HttpsError('not-found', 'This quote link isn’t right. Please text Jace for a new one.');
  const snap = await db.collection('quotes').where('token', '==', token).limit(1).get();
  if (snap.empty) throw new HttpsError('not-found', 'This quote is no longer available. Please text Jace for a new one.');
  return snap.docs[0];
}
function publicQuote(q, s) {
  const until = quoteUntil(q);
  return { name: q.name || '', address: q.address || '', phone: q.phone || '', date: q.date, until, number: q.number || '',
    grassPrice: q.grassPrice || 0, freq: q.freq || '', snowPrice: q.snowPrice || 0, snowPlan: q.snowPlan || '',
    addons: (q.addons || []).map((a) => ({ name: a.name, price: a.price })), notes: q.notes || '',
    acceptedAt: q.acceptedAt || null, acceptedName: q.acceptedName || '', expired: !q.acceptedAt && today() > until,
    business: { name: s.businessName || 'Precision Cut Lawns', phone: s.businessPhone || '', email: s.businessEmail || '' } };
}
const quoteLines = (q) => [q.grassPrice && `Mowing (${String(q.freq || '').toLowerCase()}): $${q.grassPrice} per cut`,
  q.snowPrice && `Snow (${q.snowPlan === 'seasonal' ? 'full season' : 'per visit'}): $${q.snowPrice}`,
  ...(q.addons || []).map((a) => `${a.name}: $${a.price}`)].filter(Boolean);

exports.getQuote = onCall({ cors: true }, async (req) => {
  const doc = await quoteByToken(req.data?.token);
  const s = (await db.doc('settings/main').get()).data() || {};
  return publicQuote(doc.data(), s);
});

exports.acceptQuote = onCall({ cors: true }, async (req) => {
  const name = String(req.data?.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const phone = prettyPhone(String(req.data?.phone || '').slice(0, 40));
  if (name.length < 2) throw new HttpsError('invalid-argument', 'Type your name to accept.');
  if (digits(phone).length !== 10) throw new HttpsError('invalid-argument', 'Type a 10-digit phone number.');
  const doc = await quoteByToken(req.data?.token);
  const made = await db.runTransaction(async (tx) => {
    const q = (await tx.get(doc.ref)).data();
    if (!q) throw new HttpsError('not-found', 'This quote is no longer available.');
    if (q.acceptedAt) return null;
    if (today() > quoteUntil(q)) throw new HttpsError('failed-precondition', 'This quote has expired. Please text Jace for an updated one.');
    const now = Date.now();
    let cid = q.customerId || null;
    if (!cid) {
      // A new customer record from the quote. Prices come from the quote; Jace fills in the rest.
      cid = db.collection('customers').doc().id;
      const plan = { Weekly: 'weekly', 'Every 2 weeks': 'biweekly' }[q.freq] || 'oncall';
      tx.set(db.doc('customers/' + cid), { name, phone, address: q.address || '', email: '', deck: '', active: true,
        grass: !!q.grassPrice, grassPlan: plan, snow: !!q.snowPrice, snowPlan: q.snowPlan || 'perSnow',
        createdAt: now, fromQuote: doc.id, needsDetails: true });
      tx.set(db.doc('pricing/' + cid), { grass: q.grassPrice || 0, snow: q.snowPlan === 'perSnow' ? q.snowPrice || 0 : 0, season: q.snowPlan === 'seasonal' ? q.snowPrice || 0 : 0 });
      tx.set(db.doc('notes/' + cid), { text: q.notes || '' });
    }
    tx.update(doc.ref, { status: 'Accepted', acceptedAt: now, acceptedName: name, acceptedPhone: phone, acceptedSeen: false, customerId: cid });
    return { cid, isNew: !q.customerId };
  });
  const q = (await doc.ref.get()).data(), s = (await db.doc('settings/main').get()).data() || {};
  let alert = null;
  if (made) {
    logger.info('Quote accepted', doc.id, 'customer', made.cid);
    // Where Jace's alert emails go: the same address as sign-up alerts.
    const owner = String(s.alertEmail || '').trim() || (await db.doc('meta/setup').get()).data()?.owner || '';
    if (owner) alert = { to: owner, isNew: made.isNew, lines: quoteLines(q), number: q.number, address: q.address || '', notes: q.notes || '' };
  }
  return { ...publicQuote(q, s), alert };
});
