// Square card / Apple Pay for invoices.
//  - payLink: makes (or reuses) a Square payment link for one invoice. Jace or that invoice's customer can call it.
//  - squareWebhook: Square calls this when a payment completes; the invoice is marked paid automatically.
// The Square access token and webhook key live in Firebase secrets, never in the app.
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

initializeApp();
const db = getFirestore();

const SQUARE_TOKEN = defineSecret('SQUARE_TOKEN');
const SQUARE_WEBHOOK_KEY = defineSecret('SQUARE_WEBHOOK_KEY');
const SQUARE_ENV = defineString('SQUARE_ENV', { default: 'sandbox' }); // 'sandbox' while testing, then 'production'
const SQUARE_LOCATION_ID = defineString('SQUARE_LOCATION_ID');
const SQUARE_WEBHOOK_URL = defineString('SQUARE_WEBHOOK_URL', { default: '' }); // exactly as entered in Square
const APP_URL = 'https://app.precisioncutlawns.org/';
const FEE_RATE = 0.033; // Square online card rate (plus 30¢, which isn't passed on)

const api = () => (SQUARE_ENV.value() === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com');

async function square(path, body) {
  const r = await fetch(api() + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SQUARE_TOKEN.value(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    logger.error('Square error', r.status, data);
    throw new HttpsError('internal', 'Square could not make the payment link. ' + (data.errors?.[0]?.detail || ''));
  }
  return data;
}

exports.payLink = onCall({ secrets: [SQUARE_TOKEN], cors: true }, async (req) => {
  const email = (req.auth?.token?.email || '').toLowerCase();
  if (!email) throw new HttpsError('unauthenticated', 'Sign in first.');
  const visitId = String(req.data?.visitId || '');
  if (!visitId) throw new HttpsError('invalid-argument', 'Missing invoice.');

  const [userSnap, visitSnap] = await Promise.all([db.doc('users/' + email).get(), db.doc('visits/' + visitId).get()]);
  const user = userSnap.data();
  const v = visitSnap.data();
  if (!user || !v) throw new HttpsError('not-found', 'Invoice not found.');
  const allowed = user.role === 'admin' || (user.role === 'customer' && user.customerId === v.customerId);
  if (!allowed) throw new HttpsError('permission-denied', 'Not your invoice.');
  if (v.paid) throw new HttpsError('failed-precondition', 'This invoice is already paid.');

  const base = Math.round(Number(v.total) * 100);
  if (!(base >= 100)) throw new HttpsError('failed-precondition', 'Invoice total is too small for card payment.');
  // Optional: the customer chooses to cover Square's 3.3% card fee.
  const coverFee = !!req.data?.coverFee;
  const feeCents = coverFee ? Math.round(base * FEE_RATE) : 0;
  const cents = base + feeCents;
  const env = SQUARE_ENV.value();
  const kind = coverFee ? 'fee' : 'base';
  const saved = v.squareLinks?.[kind];
  if (saved?.url && saved.cents === cents && saved.env === env) return { url: saved.url, cents };

  const data = await square('/v2/online-checkout/payment-links', {
    idempotency_key: `${visitId}-${cents}-${env}`.slice(0, 45),
    quick_pay: {
      name: `Precision Cut Lawns · ${v.desc || 'Lawn mowing'} · ${v.invoiceNo || ''}${coverFee ? ' (incl. 3.3% card fee)' : ''}`.slice(0, 255),
      price_money: { amount: cents, currency: 'USD' },
      location_id: SQUARE_LOCATION_ID.value(),
    },
    checkout_options: { redirect_url: APP_URL + '#paid', ask_for_shipping_address: false },
    payment_note: `Invoice ${v.invoiceNo || visitId}`,
  });
  const link = data.payment_link;
  await visitSnap.ref.update({
    [`squareLinks.${kind}`]: { url: link.url, orderId: link.order_id, linkId: link.id, cents, feeCents, env, at: Date.now() },
    squareOrderIds: FieldValue.arrayUnion(link.order_id),
  });
  return { url: link.url, cents };
});

// Pay the customer's whole balance (every unpaid invoice) with one Square link.
// Jace can call it for any customer; a customer only for their own account.
exports.payBalance = onCall({ secrets: [SQUARE_TOKEN], cors: true }, async (req) => {
  const email = (req.auth?.token?.email || '').toLowerCase();
  if (!email) throw new HttpsError('unauthenticated', 'Sign in first.');
  const user = (await db.doc('users/' + email).get()).data();
  if (!user) throw new HttpsError('permission-denied', 'No account.');
  const customerId = user.role === 'admin' ? String(req.data?.customerId || '') : user.role === 'customer' ? user.customerId : '';
  if (!customerId) throw new HttpsError('permission-denied', 'Not allowed.');

  const unpaid = (await db.collection('visits').where('customerId', '==', customerId).get()).docs
    .map((d) => ({ id: d.id, ...d.data() })).filter((v) => !v.paid).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id));
  const base = unpaid.reduce((a, v) => a + Math.round(Number(v.total) * 100), 0);
  if (!(base >= 100)) throw new HttpsError('failed-precondition', 'Nothing to pay right now.');
  const coverFee = !!req.data?.coverFee;
  const feeCents = coverFee ? Math.round(base * FEE_RATE) : 0;
  const cents = base + feeCents;
  const env = SQUARE_ENV.value();
  const visitIds = unpaid.map((v) => v.id);
  const key = crypto.createHash('sha1').update([customerId, env, cents, ...visitIds].join('|')).digest('hex').slice(0, 32);

  const ref = db.doc('balancePays/' + key);
  const saved = (await ref.get()).data();
  if (saved?.url) return { url: saved.url, cents };

  const cust = (await db.doc('customers/' + customerId).get()).data() || {};
  const data = await square('/v2/online-checkout/payment-links', {
    idempotency_key: key,
    quick_pay: {
      name: `Precision Cut Lawns · ${cust.name || 'Balance'} · ${unpaid.length} visit${unpaid.length === 1 ? '' : 's'}${coverFee ? ' (incl. 3.3% card fee)' : ''}`.slice(0, 255),
      price_money: { amount: cents, currency: 'USD' },
      location_id: SQUARE_LOCATION_ID.value(),
    },
    checkout_options: { redirect_url: APP_URL + '#paid', ask_for_shipping_address: false },
    payment_note: `Balance: ${unpaid.map((v) => v.invoiceNo || v.id).join(', ')}`.slice(0, 500),
  });
  const link = data.payment_link;
  await ref.set({ url: link.url, orderId: link.order_id, linkId: link.id, customerId, visitIds, cents, feeCents, env, at: Date.now() });
  return { url: link.url, cents };
});

// Square signs each notification: base64(HMAC-SHA256(key, notificationUrl + body)).
function validSignature(req) {
  const sig = req.get('x-square-hmacsha256-signature') || '';
  const url = SQUARE_WEBHOOK_URL.value();
  if (!sig || !url) return false;
  const expected = crypto.createHmac('sha256', SQUARE_WEBHOOK_KEY.value()).update(url + req.rawBody.toString('utf8')).digest('base64');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.squareWebhook = onRequest({ secrets: [SQUARE_WEBHOOK_KEY] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only');
  if (!validSignature(req)) { logger.warn('Square webhook: bad signature'); return res.status(403).send('Bad signature'); }
  const ev = req.body || {};
  const p = ev.data?.object?.payment;
  if (!/^payment\.(created|updated)$/.test(ev.type || '') || !p || p.status !== 'COMPLETED' || !p.order_id) return res.status(200).send('ignored');

  const bal = await db.collection('balancePays').where('orderId', '==', p.order_id).limit(1).get();
  if (!bal.empty) {
    const b = bal.docs[0].data();
    if (!b.paidAt) {
      const at = Date.now(), batch = db.batch();
      b.visitIds.forEach((id, i) => batch.update(db.doc('visits/' + id), { paid: true, paidAt: at, paidVia: 'square', squarePaymentId: p.id,
        payGroup: p.order_id, cardFeePaid: i === 0 ? (b.feeCents || 0) / 100 : 0 }));
      batch.update(bal.docs[0].ref, { paidAt: at, paymentId: p.id });
      await batch.commit();
      logger.info('Balance paid through Square', b.customerId, b.visitIds.length);
    }
    return res.status(200).send('ok');
  }
  let q = await db.collection('visits').where('squareOrderIds', 'array-contains', p.order_id).limit(1).get();
  if (q.empty) q = await db.collection('visits').where('square.orderId', '==', p.order_id).limit(1).get(); // links made before the fee option
  if (q.empty) { logger.warn('Square payment with no matching invoice', p.order_id); return res.status(200).send('no invoice'); }
  const doc = q.docs[0];
  if (!doc.data().paid) {
    const paidCents = p.amount_money?.amount || 0, baseCents = Math.round(Number(doc.data().total) * 100);
    await doc.ref.update({ paid: true, paidAt: Date.now(), paidVia: 'square', squarePaymentId: p.id, squarePaidCents: paidCents || null,
      cardFeePaid: paidCents > baseCents ? (paidCents - baseCents) / 100 : 0 });
    logger.info('Invoice paid through Square', doc.id);
  }
  res.status(200).send('ok');
});
