import { createStore, newId } from './store.js?v=2026.11.13.10';

const APP_VERSION = '2026.11.13.10'; // bump-version.sh keeps this, version.json and the ?v= tags in step
const app = document.getElementById('app');
const sheetEl = document.getElementById('sheet');
const toastEl = document.getElementById('toast');
const bannerEl = document.getElementById('banner');

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Number(n) < 0 ? '-$' : '$') + Math.abs(Number(n || 0)).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const money2 = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : Math.round(n * 100) / 100; };
const val = (id) => (document.getElementById(id) || {}).value ?? '';
const checked = (id) => !!(document.getElementById(id) || {}).checked;
const byName = (a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
const digits10 = (p) => (String(p || '').match(/\d/g) || []).join('').slice(-10);
const firstPhone = (p) => { const m = String(p || '').match(/\+?1?[\s.(-]*\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}/); return m ? digits10(m[0]) : digits10(p); };
const fill = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const appLink = () => location.origin + location.pathname;
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
const smsHref = (phone, body) => `sms:${phone ? '+1' + digits10(phone) : ''}${isApple ? '&' : '?'}body=${encodeURIComponent(body)}`;

/* ---------- dates (weeks start Monday) ---------- */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
function weekStart(date) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
const shiftWeek = (id, n) => { const d = parseYmd(id); d.setDate(d.getDate() + 7 * n); return ymd(d); };
const weeksBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / (7 * 864e5));
const shortDate = (s) => s ? parseYmd(String(s).slice(0, 10)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
const longDate = (s) => parseYmd(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
function weekLabel(id) { const s = parseYmd(id); const e = new Date(s); e.setDate(e.getDate() + 6); const f = { month: 'short', day: 'numeric' }; return `${s.toLocaleDateString('en-US', f)} – ${e.toLocaleDateString('en-US', f)}`; }
// Seasons: mowing is April–November, snow is October–March (months are 0-based).
const GRASS_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10], SNOW_MONTHS = [9, 10, 11, 0, 1, 2];
const grassWeek = (id) => { const s = parseYmd(id), e = new Date(s); e.setDate(e.getDate() + 6); return GRASS_MONTHS.includes(s.getMonth()) || GRASS_MONTHS.includes(e.getMonth()); };
const snowSeason = (d = new Date()) => SNOW_MONTHS.includes(d.getMonth());
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function skipDeadline(weekId) {
  const s = settings();
  const d = parseYmd(weekId); d.setDate(d.getDate() + Number(s.skipDay ?? 3));
  const [h, m] = String(s.skipTime || '18:00').split(':').map(Number); d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
const deadlineText = (weekId) => skipDeadline(weekId).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });

/* ---------- defaults ---------- */
const DEFAULTS = {
  alertEmail: 'jace.precisioncutlawns@gmail.com',
  businessName: 'Precision Cut Lawns', businessPhone: '224-334-8532', businessEmail: 'jace.precisioncutlawns@gmail.com', website: '', zelle: '224-334-8532', venmo: '', zelleQr: '',
  skipDay: 3, skipTime: '18:00',
  reminderMsg: 'Hi {first}, it\'s Jace with Precision Cut Lawns. Your lawn is scheduled to be mowed this week ({week}). Need to skip? Tap here by {deadline}: {link}',
  oncallMsg: 'Hi, it\'s Jace with Precision Cut Lawns. Would you like your grass cut today?',
  invoiceMsg: 'Hi {first}, thanks for choosing Precision Cut Lawns! Your invoice for {total} is attached. Pay by Zelle to {zelle}{venmo}, or in your account: {link}',
  receiptEnabled: false,
  receiptMsg: 'Got it, thanks {first}! Received {total} for {date}. - Precision Cut Lawns',
  quoteMsg: 'Hi {first}, here\'s your quote from Precision Cut Lawns. Call or text {phone} with any questions!',
  welcomeCustomer: 'Hi {first}! Welcome to Precision Cut Lawns. Tap this link to set up your account, where you can see your schedule, skip a week, request snow removal and pay your invoices:\n\n{link}\n\nTip: tap Share, then "Add to Home Screen" to keep it handy. - Jace',
  // Saved messages Jace writes himself (Settings > Messages > My saved messages). Pick one from a customer's page or "Text customers".
  customMsgs: [{ id: 'acct', title: 'Create your account', body: 'Hi {first}, it\'s Jace with Precision Cut Lawns! I now have an app for my customers. Tap this link to create your account, where you can see your schedule, skip a week, request snow removal and pay invoices:\n\n{invite}\n\nThe link is just for you. Tip: once you\'re in, tap Share, then "Add to Home Screen" to keep it handy. Thanks! - Jace' }],
  welcomeCrew: 'Hey {first}, welcome to the Precision Cut crew! Tap this link to set up your account and see the route:\n\n{link}\n\nTap Share, then "Add to Home Screen" to keep it handy.',
};
const settings = () => ({ ...DEFAULTS, ...(state.settingsDoc || {}) });

/* ---------- state ---------- */
const state = {
  user: null, access: null, account: null, setupDone: true, authMsg: '', authMode: 'in',
  loaded: new Set(),
  customers: [], notes: [], pricing: [], stops: [], visits: [], requests: [], expenses: [], addons: [], quotes: [], users: [], invites: [], settingsDoc: null,
  tab: 'route', routeSeg: 'grass', week: weekStart(new Date()), snowDate: today(),
  custId: null, editing: false, q: '', moneyTab: 'overview', quoteId: null, quoteSel: [], quoteLines: [{ d: '', a: '' }], quoteEdit: false, openFolds: new Set(),
  sheet: null, locked: false, showPaidHistory: false,
};
let store;
let unsubs = [];
const inviteEmail = (() => { const m = location.hash.match(/invite=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; })();
// Invite link (#join=...): remembered on this phone so it survives the email-confirmation step.
const JOIN_KEY = 'pc_join';
// Accepts #join=... (invite texts) and ?join=... (the "Continue" button after confirming an email).
(() => { const m = (location.hash + '&' + location.search).match(/join=([A-Za-z0-9]+)/); if (m) localStorage.setItem(JOIN_KEY, m[1]); })();
const joinCode = () => localStorage.getItem(JOIN_KEY) || '';
const backFromEmail = /[?&]join=/.test(location.search);
const inviteLink = (code) => appLink() + '#join=' + code;
// Older saved welcome texts said "sign in with this email"; invite links don't need one.
const customMsgs = () => (Array.isArray(settings().customMsgs) ? settings().customMsgs : []);
const needsInvite = (body) => /\{invite\}/.test(body);
// A one-time sign-up link for this customer: reuses their open invite, else makes a new id (saved when the text is sent).
// No customer (texting someone from phone contacts): a fresh new-customer link.
function inviteIdFor(cid, pending) {
  const open = cid && state.invites.find((i) => i.customerId === cid && !i.usedBy && i.role === 'customer');
  if (open) return open.id;
  return (pending[cid || '_new'] ??= newId());
}
function saveInvite(cid, pending, label) {
  const id = pending[cid || '_new'];
  if (!id || state.invites.some((i) => i.id === id)) return;
  store.set('invites', id, { role: 'customer', ...(cid ? { customerId: cid } : {}), ...(label ? { label } : {}), createdAt: Date.now(), createdBy: state.user.email });
}
// Phone contact picker (Android Chrome; iPhone only if Safari's "Contact Picker API" feature flag is on).
const canPickContact = () => 'contacts' in navigator && 'ContactsManager' in window;
function fillMsg(body, c, pending) {
  const s = settings();
  return fill(body, { first: first(c?.name), name: c?.name || '', link: appLink(), phone: s.businessPhone, zelle: s.zelle, venmo: s.venmo ? ' or Venmo ' + s.venmo : '', website: s.website || '',
    invite: needsInvite(body) ? inviteLink(inviteIdFor(c?.id || '', pending)) : appLink() });
}
const welcomeTpl = (key) => (/\{email\}/.test(settings()[key]) ? DEFAULTS[key] : settings()[key]);

const role = () => state.account?.role;
const isAdmin = () => role() === 'admin';
const cust = (id) => state.customers.find((c) => c.id === id);
const priceOf = (id) => state.pricing.find((p) => p.id === id) || {};
const noteOf = (id) => (state.notes.find((n) => n.id === id) || {}).text || '';
const stopOf = (id) => state.stops.find((s) => s.id === id);
const visitOf = (id) => state.visits.find((v) => v.id === id);
const userForCustomer = (cid) => state.users.find((u) => u.customerId === cid && !u.id.endsWith('@demo'));

/* ---------- toast & banner ---------- */
let toastTimer;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200); }
function showError(e) {
  bannerEl.style.background = ''; bannerEl.textContent = String(e?.code || '').includes('permission') ? 'Not allowed: that change was blocked by the database rules.' : 'Could not save to the database. Check your connection.';
  bannerEl.hidden = false; setTimeout(() => { bannerEl.hidden = true; }, 6000);
}

/* ---------- invoices: PDF + share ---------- */
const imgCache = {};
async function imgData(path) {
  if (imgCache[path]) return imgCache[path];
  const blob = await fetch(path).then((r) => r.blob());
  imgCache[path] = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  return imgCache[path];
}
// Letterhead-style invoice / quote. Letter size, in points (612 x 792).
// The PDF tool loads in the background (so it doesn't slow down opening the app); wait for it if needed.
async function pdfReady() {
  for (let i = 0; i < 100 && !window.jspdf; i++) await new Promise((r) => setTimeout(r, 100));
  if (!window.jspdf) throw new Error('PDF tool didn’t load. Check your connection and try again.');
}
async function buildPdf(kind, data) {
  await pdfReady();
  const s = settings();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const forest = [24, 55, 35], lime = [106, 165, 31], ink = [26, 29, 26], muted = [96, 104, 98], pale = [244, 246, 242], rule = [220, 226, 218];
  const L = 48, R = 564, W = R - L;
  const font = (style, size, color = ink) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); };
  const title = kind === 'quote' ? 'QUOTE' : 'INVOICE';
  const contact = [s.businessPhone, s.businessEmail, s.website].filter(Boolean);

  const footer = () => {
    doc.setDrawColor(...lime); doc.setLineWidth(1.5); doc.line(L, 742, R, 742);
    font('bold', 8.5, forest); doc.text('EVERY LINE. EVERY EDGE. EVERY TIME.', 306, 757, { align: 'center', charSpace: 1.2 });
    font('normal', 8.5, muted); doc.text([s.businessName, ...contact].filter(Boolean).join('   ·   '), 306, 771, { align: 'center' });
  };
  const topBand = () => { doc.setFillColor(...forest); doc.rect(0, 0, 612, 10, 'F'); doc.setFillColor(...lime); doc.rect(0, 10, 612, 3, 'F'); };

  // Letterhead
  topBand();
  doc.addImage(await imgData('logo-full.jpg'), 'JPEG', L, 30, 156, 82);
  font('bold', 11, forest); doc.text(s.businessName || 'Precision Cut Lawns', L, 128);
  font('normal', 9.5, muted); contact.forEach((c, i) => doc.text(c, L, 142 + i * 13));

  font('bold', 30, forest); doc.text(title, R, 62, { align: 'right', charSpace: 2 });
  // Number / date box
  const mx = 352, mw = R - mx; let my = 78;
  doc.setFillColor(...pale); doc.roundedRect(mx, my, mw, 16 + data.meta.length * 17, 4, 4, 'F');
  data.meta.forEach(([k, v], i) => {
    const yy = my + 20 + i * 17;
    font('bold', 8.5, muted); doc.text(k.toUpperCase(), mx + 12, yy);
    font(k === 'Status' ? 'bold' : 'normal', 10.5, k === 'Status' ? lime : ink); doc.text(String(v), R - 12, yy, { align: 'right' });
  });

  // Bill to / terms
  let y = Math.max(190, 142 + contact.length * 13 + 26);
  const boxH = 30 + Math.max(1, data.to.filter(Boolean).length) * 14 + 16;
  doc.setDrawColor(...rule); doc.setLineWidth(1);
  doc.roundedRect(L, y, 250, boxH, 4, 4, 'S'); doc.roundedRect(L + 266, y, W - 266, boxH, 4, 4, 'S');
  font('bold', 8.5, lime); doc.text(kind === 'quote' ? 'PREPARED FOR' : 'BILL TO', L + 14, y + 18);
  font('bold', 12.5); doc.text(data.name || '', L + 14, y + 36);
  font('normal', 10.5, muted); data.to.filter(Boolean).forEach((l, i) => doc.text(l, L + 14, y + 52 + i * 14));
  font('bold', 8.5, lime); doc.text(kind === 'quote' ? 'QUOTE DETAILS' : 'PAYMENT TERMS', L + 280, y + 18);
  font('normal', 10.5, ink);
  doc.text(doc.splitTextToSize(data.terms || '', W - 266 - 28), L + 280, y + 36);
  y += boxH + 26;

  // Line items
  const head = () => {
    doc.setFillColor(...forest); doc.rect(L, y, W, 24, 'F');
    font('bold', 9, [255, 255, 255]); doc.text('DESCRIPTION', L + 14, y + 16, { charSpace: 0.8 }); doc.text('AMOUNT', R - 14, y + 16, { align: 'right', charSpace: 0.8 });
    y += 24;
  };
  head();
  data.lines.forEach((l, i) => {
    const dl = doc.splitTextToSize(l.desc, 370); const h = 14 + dl.length * 14;
    if (y + h > 690) { footer(); doc.addPage(); topBand(); y = 40; head(); }
    if (i % 2) { doc.setFillColor(...pale); doc.rect(L, y, W, h, 'F'); }
    font('normal', 11); doc.text(dl, L + 14, y + 18); doc.text(money2(l.amount), R - 14, y + 18, { align: 'right' });
    y += h;
  });
  doc.setDrawColor(...rule); doc.line(L, y, R, y);

  // Totals
  y += 16;
  if (y > 640) { footer(); doc.addPage(); topBand(); y = 40; }
  if (data.totalLabel) {
    const tx = 340;
    doc.setFillColor(...forest); doc.roundedRect(tx, y, R - tx, 32, 4, 4, 'F');
    font('bold', 12, [255, 255, 255]); doc.text(data.totalLabel.toUpperCase(), tx + 14, y + 21, { charSpace: 0.8 });
    font('bold', 15, [255, 255, 255]); doc.text(money2(data.total), R - 14, y + 21.5, { align: 'right' });
    y += 50;
  } else { font('italic', 10, muted); doc.text('Prices are per service, as listed above.', R, y + 4, { align: 'right' }); y += 26; }

  if (data.paid) {
    doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.16 }));
    font('bold', 96, lime); doc.text('PAID', 306, Math.min(Math.max(y + 110, 430), 600), { align: 'center', angle: 14 });
    doc.restoreGraphicsState();
  }

  if (kind === 'invoice' && !data.paid) {
    const qr = s.zelleQr && /^data:image\/(png|jpe?g)/i.test(s.zelleQr) ? s.zelleQr : '';
    const h = qr ? 104 : s.venmo ? 78 : 60;
    if (y + h > 720) { footer(); doc.addPage(); topBand(); y = 40; }
    doc.setFillColor(...pale); doc.roundedRect(L, y, W, h, 6, 6, 'F');
    font('bold', 8.5, lime); doc.text('HOW TO PAY', L + 16, y + 20, { charSpace: 0.8 });
    font('normal', 11); doc.text(`Zelle: send ${money2(data.total)} to ${s.zelle}`, L + 16, y + 40);
    if (s.venmo) { font('normal', 11, forest); doc.textWithLink(`Venmo: ${s.venmo}`, L + 16, y + 58, { url: s.venmo.startsWith('http') ? s.venmo : 'https://' + s.venmo }); }
    if (qr) { doc.addImage(qr, /png/i.test(qr.slice(0, 20)) ? 'PNG' : 'JPEG', R - 16 - 80, y + 12, 80, 80); font('normal', 7.5, muted); doc.text('Scan with Zelle', R - 56, y + 100, { align: 'center' }); }
    y += h + 26;
  }
  if (data.notes) {
    const nl = doc.splitTextToSize(data.notes, W - 32);
    if (y + 36 + nl.length * 14 > 720) { footer(); doc.addPage(); topBand(); y = 40; }
    font('bold', 8.5, lime); doc.text('NOTES', L, y, { charSpace: 0.8 });
    font('normal', 10.5); doc.text(nl, L, y + 16); y += 24 + nl.length * 14;
  }
  if (y < 712) {
    font('bold', 13, forest);
    doc.text(kind === 'quote' ? 'Thank you for considering Precision Cut Lawns!' : data.paid ? 'Paid in full. Thank you!' : 'Thank you for your business!', 306, Math.max(y + 10, 640), { align: 'center' });
    if (kind === 'quote') { font('normal', 10, muted); doc.text(`To accept, reply to my text or call ${s.businessPhone}.`, 306, Math.max(y + 10, 640) + 16, { align: 'center' }); }
  }
  footer();
  const pages = doc.getNumberOfPages();
  if (pages > 1) for (let i = 1; i <= pages; i++) { doc.setPage(i); font('normal', 8, muted); doc.text(`Page ${i} of ${pages}`, R, 30, { align: 'right' }); }
  return doc.output('blob');
}
const visitLines = (v) => [{ desc: v.desc || 'Lawn mowing', amount: v.price }, ...(v.addons || []).map((a) => ({ desc: a.name, amount: a.price }))];
async function invoiceFile(v) {
  const c = cust(v.customerId) || {};
  const s = settings();
  const meta = [['Invoice #', v.invoiceNo], ['Date', longDate(v.date)], v.paid ? ['Status', 'PAID'] : ['Due', 'Upon receipt']];
  const blob = await buildPdf('invoice', { meta, name: v.customerName, to: [c.address, c.phone], lines: visitLines(v), totalLabel: v.paid ? 'Total paid' : 'Total due', total: v.total, paid: !!v.paid,
    terms: v.paid ? 'Paid in full. Thank you!' : `Due upon receipt. Pay by Zelle to ${s.zelle}${s.venmo ? ' or by Venmo' : ''}.` });
  return new File([blob], `Precision Cut Invoice ${v.invoiceNo}.pdf`, { type: 'application/pdf' });
}
async function quoteFile(q) {
  const lines = [];
  if (q.grassPrice) lines.push({ desc: `Lawn mowing - ${q.freq.toLowerCase()} (per cut)`, amount: q.grassPrice });
  if (q.snowPrice) lines.push({ desc: q.snowPlan === 'seasonal' ? 'Snow removal - full season' : 'Snow removal - per visit, on request', amount: q.snowPrice });
  (q.addons || []).forEach((a) => lines.push({ desc: a.name, amount: a.price }));
  const total = lines.reduce((a, l) => a + l.amount, 0);
  const until = parseYmd(q.date); until.setDate(until.getDate() + 30);
  const blob = await buildPdf('quote', { meta: [['Quote #', `Q-${q.number}`], ['Date', longDate(q.date)], ['Valid until', longDate(ymd(until))]], name: q.name, to: [q.address, q.phone],
    lines, totalLabel: q.grassPrice && q.snowPrice ? '' : 'Estimated total', total, notes: q.notes,
    terms: `Prices are good for 30 days. Prepared by Jace, ${settings().businessName}.` });
  return new File([blob], `Precision Cut Quote ${q.name || q.number}.pdf`, { type: 'application/pdf' });
}
// Opens the phone's share sheet with the PDF + message (pick Messages). Falls back to download + text.
async function sharePdf(file, text, phone) {
  if (!window.jspdf) throw new Error('PDF tool still loading. Try again.');
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; throw e; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (phone) location.href = smsHref(phone, text);
  return true;
}
async function sendInvoice(v) {
  const s = settings();
  const c = cust(v.customerId) || {};
  const text = fill(s.invoiceMsg, { first: first(v.customerName), total: money(v.total), zelle: s.zelle, venmo: s.venmo ? ' or Venmo ' + s.venmo : '', link: appLink(), phone: s.businessPhone });
  const sent = await sharePdf(await invoiceFile(v), text, c.phone);
  if (sent) { await store.update('visits', v.id, { sentAt: Date.now() }); toast('Invoice ready to send'); }
}
function newInvoiceNo() { const d = new Date(); return `PC-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
function createVisit({ customerId, type, price, addons = [], desc, stopId, date = today() }) {
  const c = cust(customerId);
  const total = Math.round((num(price) + addons.reduce((a, x) => a + num(x.price), 0)) * 100) / 100;
  const v = { customerId, customerName: c?.name || '', type, desc, date, price: num(price), addons, total, invoiceNo: newInvoiceNo(), stopId: stopId || null, paid: false, createdAt: Date.now() };
  const id = store.add('visits', v);
  return { id, ...v };
}

/* ---------- QR ---------- */
function qrSvg(text) {
  if (!window.qrcode || !text) return '';
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}

/* ---------- local passcode lock (this phone only) ---------- */
const LOCK_KEY = 'pc_lock';
const lockCfg = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY)) || null; } catch { return null; } };
async function hashPin(pin) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pc:' + pin)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
let lastActive = Date.now(), hiddenAt = 0, pinEntry = '', pinErr = '';
['click', 'keydown', 'touchstart'].forEach((e) => document.addEventListener(e, () => { lastActive = Date.now(); }, { passive: true }));
setInterval(() => { const c = lockCfg(); if (c && !state.locked && state.account && Date.now() - lastActive > c.minutes * 60000) { state.locked = true; render(); } }, 15000);
document.addEventListener('visibilitychange', () => {
  const c = lockCfg();
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (c && hiddenAt && Date.now() - hiddenAt > c.minutes * 60000 && state.account) { state.locked = true; render(); }
});

/* ---------- data subscriptions ---------- */
function subscribe() {
  unsubs.forEach((u) => typeof u === 'function' && u()); unsubs = [];
  state.loaded = new Set();
  const need = [];
  const watch = (name, setter) => { need.push(name); unsubs.push(setter(() => { state.loaded.add(name); })); };
  const onData = (key) => (done) => (docs) => { state[key] = docs; done(); scheduleRender(); };
  const W = (name) => watch(name, (done) => store.watch(name, onData(name)(done)));
  watch('settings', (done) => store.watchDoc('settings', 'main', (d) => { state.settingsDoc = d; done(); scheduleRender(); }));
  if (isAdmin()) ['customers', 'notes', 'pricing', 'stops', 'visits', 'requests', 'expenses', 'addons', 'quotes', 'users', 'invites'].forEach(W);
  else if (role() === 'crew') ['customers', 'notes', 'stops', 'requests'].forEach(W);
  else if (role() === 'customer') {
    const cid = state.account.customerId;
    watch('customers', (done) => store.watchDoc('customers', cid, (d) => { state.customers = d ? [d] : []; done(); scheduleRender(); }));
    watch('pricing', (done) => store.watchDoc('pricing', cid, (d) => { state.pricing = d ? [d] : []; done(); scheduleRender(); }));
    ['stops', 'visits', 'requests'].forEach((n) => watch(n, (done) => store.watchWhere(n, 'customerId', cid, onData(n)(done))));
  }
  state.need = need;
}
// Don't redraw under someone's thumb while they're typing; redraw when they leave the field.
let pendingRender = false;
function scheduleRender() {
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && (app.contains(a) || sheetEl.contains(a))) { pendingRender = true; return; }
  render();
}
document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender) { pendingRender = false; scheduleRender(); } }, 50));

/* ---------- auth flow ---------- */
async function checkAccess() {
  state.access = 'checking'; render();
  try {
    let acct = await store.getDoc('users', state.user.email);
    if (!acct && store.mode === 'local') { await seedDemo(); acct = await store.getDoc('users', state.user.email); }
    if (acct) localStorage.removeItem(JOIN_KEY);
    if (!acct && joinCode() && store.mode === 'shared') { state.access = 'join'; return render(); }
    if (!acct) {
      const setup = await store.getDoc('meta', 'setup').catch(() => null);
      state.setupDone = !!setup; state.access = 'none'; return render();
    }
    state.account = acct; state.access = 'ok';
    state.tab = acct.role === 'customer' ? 'home' : 'route';
    if (lockCfg()) state.locked = true;
    subscribe(); render();
  } catch (e) { console.error(e); state.access = 'none'; state.setupDone = true; render(); }
}
// Emails Jace when someone uses an invite link, so he knows to set up their account.
// Goes to the admin email the app was set up with, through FormSubmit (free, no server; no-reply sender).
// The very first email asks you to tap "Activate" once.
async function sendAlert(to, subject, fields) {
  const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(to), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _subject: subject, _template: 'table', _captcha: 'false', ...fields }),
  });
  const body = await r.json().catch(() => ({}));
  // FormSubmit answers 200 with success "false" (e.g. address not activated yet), so check both.
  if (!r.ok || String(body.success) === 'false') throw new Error(`Alert email to ${to} failed (${r.status}): ${body.message || 'no details'}`);
}
async function notifyJoined(name, email) {
  try {
    const owner = settings().alertEmail.trim() || (await store.getDoc('meta', 'setup'))?.owner; if (!owner) return;
    const role = state.account?.role || 'customer';
    await sendAlert(owner, `New ${role} sign-up: ${name}`, {
      Name: name, Email: email, Role: role, When: new Date().toLocaleString('en-US'),
      'Next step': role === 'customer' ? 'Open the app > Customers > ' + name + ' > Edit to add their phone, address and plans.' : 'They can see the route now.',
    });
  } catch (e) { console.error('Sign-up alert email to the owner NOT sent:', e?.message || e); }
}
async function seedDemo() {
  await store.claimSetup('admin@demo', 'Jace (demo)');
  await store.set('users', 'crew@demo', { name: 'Crew member (demo)', role: 'crew' });
}

/* ---------- rendering ---------- */
function render() {
  if (!store) return;
  if (!state.user) return renderSignIn();
  if (state.access === 'join') return renderJoin();
  if (state.access === 'none') return renderNoAccess();
  if (state.access !== 'ok' || (state.need && state.loaded.size < state.need.length)) { app.innerHTML = '<p class="center muted" style="padding:40px">Loading…</p>'; return; }
  if (state.locked) return renderLock();
  if (role() === 'customer') return renderCustomerHome();
  renderStaff();
  renderSheet();
}

const ICON = {
  route: '<path d="M3 20h18M6 20c0-5 1-9 2-11M10 20c0-6 1-11 2-14M14 20c0-5 1.5-9 3-11M18 20c0-3 .5-5 1-6"/>',
  customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
  money: '<path d="M12 3v18M16.5 7.5c-.6-1.4-2.3-2.5-4.5-2.5-2.5 0-4.3 1.3-4.3 3.2 0 4.3 8.8 2.4 8.8 7 0 2-2 3.3-4.5 3.3-2.3 0-4.1-1.1-4.7-2.7"/>',
  quotes: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
};
const svg = (p, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;

function demoBar() {
  if (store.mode !== 'local') return '';
  const as = localStorage.getItem('pc_demo_as') || 'admin@demo';
  const custs = state.customers.length && isAdmin() ? state.customers : JSON.parse(localStorage.getItem('pc_demo_custs') || '[]');
  return `<div class="demo"><b>Demo mode</b> (this device only). View as:
    <select data-change="demoAs"><option value="admin@demo" ${as === 'admin@demo' ? 'selected' : ''}>Admin (Jace)</option><option value="crew@demo" ${as === 'crew@demo' ? 'selected' : ''}>Crew</option>
    ${custs.map((c) => `<option value="cust-${c.id}@demo" ${as === `cust-${c.id}@demo` ? 'selected' : ''}>Customer: ${esc(c.name)}</option>`).join('')}</select></div>`;
}

function renderStaff() {
  const tabs = isAdmin() ? ['route', 'customers', 'money', 'quotes', 'settings'] : ['route', 'customers'];
  if (!tabs.includes(state.tab)) state.tab = 'route';
  const openReq = state.requests.filter((r) => r.status !== 'done').length;
  const saysPaid = state.visits.filter((v) => !v.paid && v.customerSaysPaid).length;
  const view = { route: viewRoute, customers: viewCustomers, money: viewMoney, quotes: viewQuotes, settings: viewSettings }[state.tab]();
  const titles = { route: ['Route', state.routeSeg === 'snow' ? 'Snow removal' : state.routeSeg === 'inbox' ? 'Requests from customers' : 'Week of ' + weekLabel(state.week)],
    customers: ['Customers', `${state.customers.length} customer${state.customers.length === 1 ? '' : 's'}`], money: ['Money', 'Income, expenses and who owes'],
    quotes: ['Quotes', 'For new customers and custom jobs'], settings: ['Settings', 'Only you can see this'] }[state.tab];
  if (state.tab === 'customers' && state.custId) titles[0] = state.editing ? (cust(state.custId) ? 'Edit customer' : 'New customer') : 'Customer';
  if (state.tab === 'customers' && state.editing && !state.custId) titles[0] = 'New customer';
  app.innerHTML = `
    <header class="top"><div class="top-row">${brand()}
      <button class="link" data-a="signOut">${esc(state.account.name || state.user.email)} · Sign out</button></div>
      <h1>${esc(titles[0])}</h1><div class="sub">${esc(titles[1])}</div></header>
    ${demoBar()}
    <main>${view}</main>
    <nav class="tabs"><div class="inner">${tabs.map((t) => `<button class="tab ${state.tab === t ? 'on' : ''}" data-a="tab" data-v="${t}">${svg(ICON[t])}${t[0].toUpperCase() + t.slice(1)}
      ${t === 'route' && openReq ? `<span class="badge">${openReq}</span>` : ''}${t === 'money' && saysPaid ? `<span class="badge">${saysPaid}</span>` : ''}</button>`).join('')}</div></nav>`;
}

/* ----- Route (admin + crew) ----- */
// Who's automatically on a week's route. Only in mowing season, and never before they became a customer.
// Every-2-weeks customers start right away (first week as a customer, or the first week of the season),
// then go every other week, counted from their last mow: a skip moves them to the next week.
function dueGrass(c, weekId, depth = 0) {
  if (!c.active || !c.grass || !grassWeek(weekId)) return false;
  if (c.createdAt && weekId < weekStart(new Date(c.createdAt))) return false;
  if (c.grassPlan === 'weekly') return true;
  if (c.grassPlan !== 'biweekly') return false;
  return depth > 60 || !mowWeek(c, shiftWeek(weekId, -1), depth + 1);
}
// Did (or will) this customer get a mow that week? A stop on file wins, otherwise their plan decides.
function mowWeek(c, weekId, depth = 0) {
  const stop = stopOf(`${weekId}_${c.id}`);
  return stop ? stop.status !== 'skipped' : dueGrass(c, weekId, depth);
}
// Open "Request a mow" from the app puts that customer on the route automatically:
// the week they asked, and this week until it's done or handled.
const mowAsked = (c, weekId) => state.requests.some((r) => r.type === 'mow' && r.status !== 'done' && r.customerId === c.id
  && (weekStart(new Date(r.at)) === weekId || weekId === weekStart(new Date())));
const closeMowReqs = (cid) => state.requests.filter((r) => r.type === 'mow' && r.status !== 'done' && r.customerId === cid)
  .forEach((r) => store.update('requests', r.id, { status: 'done', handledAt: Date.now() }));
function grassRoute(weekId) {
  const rows = [];
  for (const c of state.customers) {
    const stop = stopOf(`${weekId}_${c.id}`);
    const asked = mowAsked(c, weekId);
    if (dueGrass(c, weekId) || stop || asked) rows.push({ c, stop, asked, id: `${weekId}_${c.id}`, status: stop?.status || 'scheduled' });
  }
  return rows.sort((a, b) => (a.stop?.day ?? 9) - (b.stop?.day ?? 9) || byName(a.c, b.c));
}
function stopCard(r, kind) {
  const { c, stop } = r;
  const note = noteOf(c.id);
  const v = stop?.visitId && visitOf(stop.visitId);
  const admin = isAdmin();
  const dayPick = kind === 'grass' && r.status === 'scheduled' ? `<select class="inp" style="width:auto;min-height:36px;font-size:14px" data-change="setDay" data-id="${r.id}" data-cid="${c.id}" aria-label="Day for ${esc(c.name)}">
      <option value="">Any day</option>${DAYS.map((d, i) => `<option value="${i}" ${stop?.day === i ? 'selected' : ''}>${d.slice(0, 3)}</option>`).join('')}</select>` : '';
  let action = '';
  if (r.status === 'scheduled') {
    action = `<div class="flex"><button class="btn btn-lime grow" data-a="markDone" data-id="${r.id}" data-cid="${c.id}" data-kind="${kind}">Mark done</button>
      ${kind === 'grass' && admin ? `<button class="btn btn-ghost btn-sm" data-a="adminSkip" data-id="${r.id}" data-cid="${c.id}">Skip</button>` : ''}</div>`;
  } else if (r.status === 'done') {
    if (admin && v) action = `<div class="between okbar" style="padding:4px 4px 4px 12px"><span>✓ Done · ${money(v.total)} · ${v.paid ? 'Paid' : v.sentAt ? 'Invoice sent' : 'Not sent yet'}</span>
      ${v.paid ? '' : `<button class="btn btn-primary btn-sm" data-a="sendInvoice" data-id="${v.id}">${v.sentAt ? 'Resend' : 'Send invoice'}</button>`}</div>`;
    else if (admin && !(kind === 'snow' && c.snowPlan === 'seasonal')) action = `<div class="between okbar" style="padding:4px 4px 4px 12px"><span>✓ Done${stop.doneByName ? ' by ' + esc(stop.doneByName) : ''}</span><button class="btn btn-primary btn-sm" data-a="billStop" data-id="${r.id}" data-cid="${c.id}" data-kind="${kind}">Make invoice</button></div>`;
    else action = `<div class="okbar">✓ Done${stop.doneByName ? ' by ' + esc(stop.doneByName) : ''}${kind === 'snow' && c.snowPlan === 'seasonal' ? ' (seasonal, no bill)' : ''}</div>`;
  } else if (r.status === 'skipped') {
    action = `<div class="between"><span class="muted">${stop.skippedBy === 'customer' ? 'Customer skipped' : 'Skipped'}${stop.skippedAt ? ' · ' + shortDate(ymd(new Date(stop.skippedAt))) : ''}</span>
      ${admin ? `<button class="link" data-a="unskip" data-id="${r.id}">Undo skip</button>` : ''}</div>`;
  }
  const sameDay = kind === 'snow' ? snowStops(c.id, stop.date) : [];
  if (kind === 'snow' && r.status === 'done' && !sameDay.some((s) => s.status === 'scheduled') && (stop.visit || 1) === Math.max(...sameDay.map((s) => s.visit || 1)))
    action += `<button class="btn btn-ghost btn-sm" data-a="snowAgain" data-cid="${c.id}">+ Clean again today</button>`;
  const plan = kind === 'snow' ? (c.snowPlan === 'seasonal' ? 'Seasonal' : 'Per snow') + ((stop?.visit || 1) > 1 ? ` · Visit ${stop.visit}` : '') : (r.asked && !stop?.manual ? 'Asked for a mow' : stop?.manual ? 'Added' : { weekly: 'Weekly', biweekly: 'Every 2 wks', oncall: 'On call' }[c.grassPlan] || '');
  return `<div class="card ${r.status === 'done' ? 'done' : ''}" style="gap:8px">
    <div class="between"><button class="plain grow" data-a="openCust" data-id="${c.id}"><div class="b" style="font-size:16px">${esc(c.name)}</div></button>${pill(r.status === 'skipped' ? 'p-gray' : 'p-blue', plan)}</div>
    ${c.address ? `<a href="https://maps.apple.com/?q=${encodeURIComponent(c.address)}" class="muted">${esc(c.address)}</a>` : ''}
    ${(c.deck || note) ? `<div class="muted small">${c.deck ? 'Deck ' + esc(c.deck) : ''}${c.deck && note ? ' · ' : ''}${esc(note)}</div>` : ''}
    ${dayPick ? `<div class="flex"><span class="muted small">Planned:</span>${dayPick}</div>` : ''}
    ${action}</div>`;
}
function viewRoute() {
  const seg = (k, l) => `<button class="${state.routeSeg === k ? 'on' : ''}" data-a="routeSeg" data-v="${k}">${l}</button>`;
  const openReq = state.requests.filter((r) => r.status !== 'done');
  let body = '';
  if (state.routeSeg === 'grass') {
    const rows = grassRoute(state.week);
    const sched = rows.filter((r) => r.status === 'scheduled'), done = rows.filter((r) => r.status === 'done'), skipped = rows.filter((r) => r.status === 'skipped');
    const thisWeek = state.week === weekStart(new Date());
    const toRemind = sched.filter((r) => r.c.grassPlan !== 'oncall');
    const inSeason = grassWeek(state.week);
    const oncall = inSeason ? state.customers.filter((c) => c.active && c.grass && c.grassPlan === 'oncall' && !stopOf(`${state.week}_${c.id}`) && !mowAsked(c, state.week)) : [];
    body = `<div class="weeknav"><button class="arrow" data-a="week" data-n="-1" aria-label="Previous week">◀</button>
        <div class="center"><div class="b">Week of ${weekLabel(state.week)}</div>${thisWeek ? '<div class="muted small">This week</div>' : '<button class="link small" data-a="thisWeek">Jump to this week</button>'}</div>
        <button class="arrow" data-a="week" data-n="1" aria-label="Next week">▶</button></div>
      <div class="grid3"><div class="card stat"><div class="n">${sched.length}</div><div class="muted">To do</div></div>
        <div class="card stat"><div class="n" style="color:#1D4A22">${done.length}</div><div class="muted">Done</div></div>
        <div class="card stat"><div class="n" style="color:#3D433E">${skipped.length}</div><div class="muted">Skipped</div></div></div>
      ${isAdmin() ? `<div class="card"><div class="between"><div><div class="b">Weekly reminders</div><div class="muted small">Skip deadline: ${esc(deadlineText(state.week))}</div></div>
          <button class="btn btn-primary btn-sm" data-a="openReminders" ${toRemind.length ? '' : 'disabled'}>Send (${toRemind.filter((r) => !r.stop?.reminded).length})</button></div>
        ${oncall.length ? `<div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div><div class="b">On-call customers</div><div class="muted small">${oncall.length} not asked yet this week</div></div>
          <button class="btn btn-ghost btn-sm" data-a="openOncall">Ask</button></div>` : ''}
        <div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div><div class="b">Add someone this week</div><div class="muted small">Weekly, every-2-weeks and app requests are added for you</div></div>
          <button class="btn btn-ghost btn-sm" data-a="openAddWeek">+ Add</button></div></div>` : ''}
      ${!inSeason ? '<div class="card muted">Mowing season is April to November, so no one is added automatically this week.</div>' : ''}
      ${sched.length ? `<div class="sec">To do</div>${sched.map((r) => stopCard(r, 'grass')).join('')}` : ''}
      ${done.length ? `<div class="sec">Done</div>${done.map((r) => stopCard(r, 'grass')).join('')}` : ''}
      ${skipped.length ? `<div class="sec">Skipped</div>${skipped.map((r) => stopCard(r, 'grass')).join('')}` : ''}
      ${!rows.length && inSeason ? '<div class="card empty">Nothing on the route this week.</div>' : ''}`;
  } else if (state.routeSeg === 'snow') {
    const rows = state.stops.filter((s) => s.type === 'snow' && s.date === state.snowDate && cust(s.customerId))
      .map((s) => ({ c: cust(s.customerId), stop: s, id: s.id, status: s.status })).sort((a, b) => byName(a.c, b.c) || (a.stop.visit || 1) - (b.stop.visit || 1));
    const snowReq = openReq.filter((r) => r.type === 'snow');
    body = `<label class="f"><span class="lbl">Snow day</span><input class="inp" type="date" value="${state.snowDate}" data-change="snowDate"></label>
      ${isAdmin() ? `<div class="card"><div class="b">Start snow day</div><div class="muted small">Adds every seasonal snow customer${snowReq.length ? ` and the ${snowReq.length} open snow request${snowReq.length === 1 ? '' : 's'}` : ''} to this day's list.</div>
        <button class="btn btn-primary" data-a="startSnow">Start snow day</button></div>` : ''}
      ${rows.length ? rows.map((r) => stopCard(r, 'snow')).join('') : '<div class="card empty">No snow stops for this day yet.</div>'}`;
  } else {
    const all = [...state.requests].sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.at - a.at).slice(0, 60);
    const handled = state.requests.filter((r) => r.status === 'done').length;
    body = (handled ? `<div class="between"><span class="muted small">${handled} handled</span><button class="link danger" style="min-height:32px" data-a="reqClearDone">Delete all handled</button></div>` : '')
      + (all.length ? all.map((r) => {
      const c = cust(r.customerId);
      return `<div class="card" style="${r.status === 'done' ? 'opacity:.6' : ''}"><div class="between"><div class="b">${esc(c?.name || r.customerName)}</div>${pill(r.type === 'snow' ? 'p-blue' : r.type === 'mow' ? 'p-green' : 'p-orange', { snow: 'Snow request', mow: 'Mow request', message: 'Message' }[r.type])}</div>
        <div class="muted small">${new Date(r.at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
        ${r.text ? `<div style="white-space:pre-line">${esc(r.text)}</div>` : ''}
        ${r.status !== 'done' ? `<div class="flex wrap">
          ${r.type === 'snow' ? `<button class="btn btn-lime btn-sm" data-a="reqToSnow" data-id="${r.id}">Add to snow day</button>` : ''}
          ${r.type === 'mow' ? `<button class="btn btn-lime btn-sm" data-a="reqToWeek" data-id="${r.id}">Add to this week</button>` : ''}
          ${c?.phone ? `<a class="btn btn-ghost btn-sm" href="${smsHref(c.phone, '')}">Text back</a>` : ''}
          <button class="btn btn-ghost btn-sm" data-a="reqDone" data-id="${r.id}">Mark handled</button>
          <button class="link danger" style="min-height:32px;margin-left:auto" data-a="reqDel" data-id="${r.id}">Delete</button></div>`
          : `<div class="between"><span class="muted small">Handled</span><button class="link danger" style="min-height:32px" data-a="reqDel" data-id="${r.id}">Delete</button></div>`}</div>`;
    }).join('') : '<div class="card empty">No requests yet. Customers can request snow removal or a mow, or send you a message, from their account.</div>');
  }
  return `<div class="seg">${seg('grass', 'Grass')}${seg('snow', 'Snow')}${seg('inbox', `Requests${openReq.length ? ' (' + openReq.length + ')' : ''}`)}</div>${body}`;
}

/* ----- Customers ----- */
function viewCustomers() {
  if (state.editing) return viewCustomerEdit();
  if (state.custId && cust(state.custId)) return viewCustomer();
  const q = state.q.trim().toLowerCase();
  const list = [...state.customers].sort(byName).filter((c) => !q || `${c.name} ${c.address} ${c.phone}`.toLowerCase().includes(q));
  const svc = (c) => [c.grass && 'Grass', c.snow && 'Snow'].filter(Boolean).join(' + ') || 'No services';
  return `<div class="flex"><label class="grow"><span class="sr">Search customers</span><input class="inp" id="search" placeholder="Search name, address or phone" value="${esc(state.q)}" data-input="search"></label>
      ${isAdmin() ? '<button class="btn btn-primary" data-a="newCust">+ Add</button>' : ''}</div>
    ${isAdmin() && state.customers.length ? '<button class="btn btn-ghost" data-a="bulkPick">Text customers a saved message</button>' : ''}
    ${list.length ? list.map((c) => `<button class="rowbtn" data-a="openCust" data-id="${c.id}"><div class="avatar">${esc(initials(c.name))}</div>
      <div class="grow"><div class="b">${esc(c.name)}</div><div class="muted">${esc(c.address || 'No address')}</div></div>
      <div style="text-align:right">${isAdmin() && priceOf(c.id).grass ? `<div class="b">${money(priceOf(c.id).grass)}</div>` : ''}<div class="muted small">${c.active ? svc(c) : 'Paused'}</div></div></button>`).join('')
      : `<div class="card empty">${state.customers.length ? 'No matches.' : 'No customers yet. Tap “+ Add” to enter your first one.'}</div>`}`;
}
function viewCustomer() {
  const c = cust(state.custId), p = priceOf(c.id), admin = isAdmin();
  const u = admin && userForCustomer(c.id);
  const visits = state.visits.filter((v) => v.customerId === c.id).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const grassPlan = { weekly: 'Weekly', biweekly: 'Every 2 weeks', oncall: 'On call ("Grass today?" text)' }[c.grassPlan];
  return `<button class="link" data-a="backToList">← All customers</button>
    <div class="card"><div class="between"><div class="b" style="font-size:20px">${esc(c.name)}</div>${admin ? '<button class="btn btn-ghost btn-sm" data-a="editCust">Edit</button>' : ''}</div>
      <div><div class="lbl">Phone</div><div>${c.phone ? `<a href="tel:+1${firstPhone(c.phone)}">${esc(c.phone)}</a> · <a href="${smsHref(c.phone, '')}">Text</a>` : '—'}</div></div>
      ${admin && c.phone ? `<button class="btn btn-ghost" data-a="pickMsg" data-cid="${c.id}">Send a saved message</button>` : ''}
      <div><div class="lbl">Address</div><div>${c.address ? `<a href="https://maps.apple.com/?q=${encodeURIComponent(c.address)}">${esc(c.address)}</a>` : '—'}</div></div>
      ${admin && c.email ? `<div><div class="lbl">Email</div><div>${esc(c.email)}</div></div>` : ''}
      <div class="grid2"><div><div class="lbl">Deck height</div><div>${esc(c.deck || '—')}</div></div><div><div class="lbl">Status</div><div>${c.active ? 'Active' : 'Paused'}</div></div></div>
      <div><div class="lbl">Notes</div><div style="white-space:pre-line">${esc(noteOf(c.id) || 'No notes yet.')}</div></div></div>
    <div class="sec">Services</div>
    <div class="card">
      <div class="between"><div><div class="b">Grass</div><div class="muted">${c.grass ? esc(grassPlan) : 'Not signed up'}</div></div>${admin && c.grass ? `<div class="b">${money(p.grass)}/cut</div>` : ''}</div>
      <div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div><div class="b">Snow</div><div class="muted">${c.snow ? (c.snowPlan === 'seasonal' ? 'Seasonal' : 'Per snow, on request') : 'Not signed up'}</div></div>
        ${admin && c.snow ? `<div class="b">${c.snowPlan === 'seasonal' ? money(p.season) + '/season' : money(p.snow) + '/visit'}</div>` : ''}</div>
      ${admin && c.snow && c.snowPlan === 'seasonal' ? `<button class="btn btn-ghost" data-a="billSeason" data-cid="${c.id}">Bill snow season (${money(p.season)})</button>` : ''}
      ${admin ? `<button class="btn btn-ghost" data-a="otherWork" data-cid="${c.id}">Bill other work</button>` : ''}
    </div>
    ${admin ? `<div class="sec">App access</div>
    <div class="card">${u ? `<div class="between"><div><div class="b">Invited</div><div class="muted">${esc(u.id)}</div></div>${pill('p-green', 'Has access')}</div>
        <button class="btn btn-ghost" data-a="reinvite" data-email="${esc(u.id)}">Send the welcome text again</button>
        <button class="link danger" data-a="removeUser" data-email="${esc(u.id)}">Remove app access</button>`
      : `<div class="muted">Give ${esc(first(c.name))} a login to see their schedule, skip, request snow removal and pay invoices.</div>
        <button class="btn btn-primary" data-a="inviteCustomer" data-cid="${c.id}">Invite to the app</button><div class="muted small">Sends a link. They sign up with any email.</div>`}</div>
    <div class="sec">Invoices</div>
    <div class="card list">${visits.length ? visits.map((v) => `<div class="line"><div class="grow"><div>${shortDate(v.date)} · ${esc(v.desc || 'Lawn mowing')}</div><div class="muted small">${esc(v.invoiceNo)}</div></div>
        <span class="flex"><b>${money(v.total)}</b>${v.paid ? pill('p-green', 'Paid') : `<button class="btn btn-ghost btn-sm" data-a="sendInvoice" data-id="${v.id}">Send</button>`}</span></div>`).join('') : '<div class="empty">No invoices yet.</div>'}</div>` : ''}`;
}
function viewCustomerEdit() {
  const c = cust(state.custId) || { name: '', phone: '', address: '', email: '', deck: '', active: true, grass: true, grassPlan: 'weekly', snow: false, snowPlan: 'perSnow' };
  const p = priceOf(c.id);
  const opt = (v, cur, l) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`;
  return `<button class="link" data-a="cancelEdit">← Cancel</button>
    <div class="card">
      <label class="f"><span class="lbl">Name</span><input class="inp" id="c_name" value="${esc(c.name)}" autocomplete="off"></label>
      <label class="f"><span class="lbl">Phone number(s)</span><input class="inp" id="c_phone" value="${esc(c.phone)}" inputmode="tel" placeholder="First number gets the texts"></label>
      <label class="f"><span class="lbl">Address</span><input class="inp" id="c_address" value="${esc(c.address)}"></label>
      <label class="f"><span class="lbl">Email (for their app login)</span><input class="inp" id="c_email" type="email" value="${esc(c.email)}" autocapitalize="off"></label>
      <label class="f"><span class="lbl">Deck height</span><input class="inp" id="c_deck" value="${esc(c.deck)}" placeholder='e.g. 3.5"'></label>
      <label class="f"><span class="lbl">Notes (crew can see, customer can't)</span><textarea class="inp" id="c_notes" placeholder="Gate code, dogs, problem spots…">${esc(noteOf(c.id))}</textarea></label>
      <label class="check"><input type="checkbox" id="c_active" ${c.active ? 'checked' : ''}> Active customer</label></div>
    <div class="card"><label class="check"><input type="checkbox" id="c_grass" ${c.grass ? 'checked' : ''}> <b>Grass</b></label>
      <div class="grid2"><label class="f"><span class="lbl">Plan</span><select class="inp" id="c_grassPlan">${opt('weekly', c.grassPlan, 'Weekly')}${opt('biweekly', c.grassPlan, 'Every 2 weeks')}${opt('oncall', c.grassPlan, 'On call')}</select></label>
        <label class="f"><span class="lbl">Price per cut ($)</span><input class="inp" id="c_pGrass" inputmode="decimal" value="${esc(p.grass ?? '')}"></label></div>
      <div class="muted small">Weekly and every-2-weeks customers go on the route automatically from their first week, April to November.</div></div>
    <div class="card"><label class="check"><input type="checkbox" id="c_snow" ${c.snow ? 'checked' : ''}> <b>Snow</b></label>
      <label class="f"><span class="lbl">Plan</span><select class="inp" id="c_snowPlan">${opt('perSnow', c.snowPlan, 'Per snow (on request)')}${opt('seasonal', c.snowPlan, 'Seasonal (billed up front)')}</select></label>
      <div class="grid2"><label class="f"><span class="lbl">Per visit ($)</span><input class="inp" id="c_pSnow" inputmode="decimal" value="${esc(p.snow ?? '')}"></label>
        <label class="f"><span class="lbl">Season ($)</span><input class="inp" id="c_pSeason" inputmode="decimal" value="${esc(p.season ?? '')}"></label></div></div>
    <div class="flex"><button class="btn btn-primary grow" data-a="saveCust">Save</button><button class="btn btn-ghost grow" data-a="cancelEdit">Cancel</button></div>
    ${cust(state.custId) ? '<button class="link danger" data-a="deleteCust">Delete this customer</button>' : ''}`;
}

/* ----- Money ----- */
function viewMoney() {
  const tab = (k, l) => `<button class="${state.moneyTab === k ? 'on' : ''}" data-a="moneyTab" data-v="${k}">${l}</button>`;
  const paid = state.visits.filter((v) => v.paid && v.paidAt);
  const sumIn = (from) => paid.filter((v) => ymd(new Date(v.paidAt)) >= from).reduce((a, v) => a + v.total, 0);
  const sumEx = (from) => state.expenses.filter((e) => e.date >= from).reduce((a, e) => a + num(e.amount), 0);
  const now = new Date(), wk = weekStart(now), mo = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), yr = `${now.getFullYear()}-01-01`;
  const unpaid = state.visits.filter((v) => !v.paid).sort((a, b) => (b.customerSaysPaid ? 1 : 0) - (a.customerSaysPaid ? 1 : 0) || a.date.localeCompare(b.date));
  const toBill = state.stops.filter((s) => s.status === 'done' && !s.visitId && !(s.type === 'snow' && cust(s.customerId)?.snowPlan === 'seasonal'));
  let body = '';
  if (state.moneyTab === 'overview') {
    const block = (label, from) => { const i = sumIn(from), e = sumEx(from); return `<div class="sec">${label}</div><div class="grid3">
      <div class="card stat"><div class="lbl">Income</div><div class="n" style="color:#1D4A22">${money(i)}</div></div>
      <div class="card stat"><div class="lbl">Expenses</div><div class="n">${money(e)}</div></div>
      <div class="card stat dark"><div class="lbl">Profit</div><div class="n">${money(i - e)}</div></div></div>`; };
    body = `${block('This week', wk)}${block(now.toLocaleDateString('en-US', { month: 'long' }), mo)}${block(String(now.getFullYear()), yr)}
      <button class="rowbtn" data-a="moneyTab" data-v="unpaid"><div class="grow"><div class="b">Unpaid</div><div class="muted">${unpaid.length} invoice${unpaid.length === 1 ? '' : 's'} · ${money(unpaid.reduce((a, v) => a + v.total, 0))}</div></div>›</button>
      ${toBill.length ? `<button class="rowbtn" data-a="moneyTab" data-v="unpaid"><div class="grow"><div class="b">Done but not billed</div><div class="muted">${toBill.length} job${toBill.length === 1 ? '' : 's'} marked done by crew</div></div>›</button>` : ''}
      <div class="muted small">Income counts when an invoice is marked paid. Weeks start Monday.</div>
      <button class="btn btn-ghost" data-a="exportCsv">Download income &amp; expenses (CSV)</button>`;
  } else if (state.moneyTab === 'unpaid') {
    body = `${toBill.length ? `<div class="sec">Done but not billed</div>${toBill.map((s) => { const c = cust(s.customerId); return `<div class="card row"><div class="grow"><div class="b">${esc(c?.name || '')}</div><div class="muted">${s.type === 'snow' ? 'Snow' : 'Mow'} · ${shortDate(s.date || s.weekId)}${s.doneByName ? ' · ' + esc(s.doneByName) : ''}</div></div>
        <button class="btn btn-primary btn-sm" data-a="billStop" data-id="${s.id}" data-cid="${s.customerId}" data-kind="${s.type}">Make invoice</button></div>`; }).join('')}` : ''}
      <div class="card row"><div class="grow"><div class="lbl">Total owed</div><div class="big">${money(unpaid.reduce((a, v) => a + v.total, 0))}</div></div><div class="muted">${unpaid.length} invoice${unpaid.length === 1 ? '' : 's'}</div></div>
      ${unpaid.length ? unpaid.map((v) => `<div class="card" style="gap:8px"><div class="between"><div><div class="b">${esc(v.customerName)}</div><div class="muted">${shortDate(v.date)} · ${esc(v.desc || 'Lawn mowing')}</div></div><div class="b">${money(v.total)}</div></div>
        ${v.customerSaysPaid ? `<div class="warnbar">${esc(first(v.customerName))} says they paid${v.customerSaysPaidAt ? ' on ' + shortDate(ymd(new Date(v.customerSaysPaidAt))) : ''}. Check Zelle/Venmo, then confirm.</div>` : ''}
        <div class="flex"><button class="btn btn-lime grow" data-a="markPaid" data-id="${v.id}">${v.customerSaysPaid ? 'Confirm paid' : 'Mark paid'}</button>
          <button class="btn btn-ghost" data-a="sendInvoice" data-id="${v.id}">${v.sentAt ? 'Resend' : 'Send'}</button>
          <button class="btn btn-ghost btn-sm" data-a="delVisit" data-id="${v.id}" aria-label="Delete invoice">✕</button></div></div>`).join('')
        : '<div class="card empty" style="color:#1D4A22;font-weight:600">Everyone’s paid up.</div>'}
      <div class="sec">Recently paid</div>
      <div class="card list">${paid.sort((a, b) => b.paidAt - a.paidAt).slice(0, 15).map((v) => `<div class="line"><div class="grow"><div>${esc(v.customerName)}</div><div class="muted small">Paid ${shortDate(ymd(new Date(v.paidAt)))}</div></div><b>${money(v.total)}</b>
        <button class="link" style="margin-left:10px;min-height:32px" data-a="markUnpaid" data-id="${v.id}">Undo</button></div>`).join('') || '<div class="empty">Nothing yet.</div>'}</div>`;
  } else {
    const ex = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    body = `<div class="card"><div class="b">Add expense</div>
        <label class="f"><span class="lbl">What for</span><input class="inp" id="e_desc" placeholder="e.g. Gas, mower blades"></label>
        <div class="grid2"><label class="f"><span class="lbl">Category</span><select class="inp" id="e_cat">${['Fuel', 'Blades & parts', 'Equipment', 'Repairs', 'Supplies', 'Insurance', 'Other'].map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label class="f"><span class="lbl">Amount ($)</span><input class="inp" id="e_amt" inputmode="decimal" placeholder="0.00"></label></div>
        <label class="f"><span class="lbl">Date</span><input class="inp" type="date" id="e_date" value="${today()}"></label>
        <button class="btn btn-primary" data-a="addExpense">Add expense</button></div>
      ${ex.length ? `<div class="card list">${ex.slice(0, 100).map((e) => `<div class="line"><div class="grow"><div class="b">${esc(e.desc || e.category)}</div><div class="muted small">${esc(e.category)} · ${shortDate(e.date)}</div></div>
        <b>${money(e.amount)}</b><button class="link danger" style="margin-left:10px;min-height:32px" data-a="delExpense" data-id="${e.id}" aria-label="Delete expense">✕</button></div>`).join('')}</div>` : '<div class="card empty">No expenses yet.</div>'}`;
  }
  return `<div class="seg">${tab('overview', 'Overview')}${tab('unpaid', 'Unpaid')}${tab('expenses', 'Expenses')}</div>${body}`;
}

/* ----- Quotes ----- */
// New-quote form, or editing an existing quote (q). Custom items take any description and price.
function quoteForm(q) {
  const v = (k, d = '') => esc(q ? (q[k] ?? d) : d);
  const n = (x) => (x ? String(x) : '');
  const opt = (val, label, cur) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${label}</option>`;
  return `<div class="card"><div class="b" style="font-size:17px">${q ? 'Edit quote' : 'New quote'}</div>
      <label class="f"><span class="lbl">Name</span><input class="inp" id="q_name" value="${v('name')}"></label>
      <label class="f"><span class="lbl">Address</span><input class="inp" id="q_address" value="${v('address')}"></label>
      <label class="f"><span class="lbl">Phone</span><input class="inp" id="q_phone" inputmode="tel" value="${v('phone')}"></label>
      <div class="grid2"><label class="f"><span class="lbl">Mowing per cut ($)</span><input class="inp" id="q_grass" inputmode="decimal" placeholder="Leave blank if none" value="${esc(n(q?.grassPrice))}"></label>
        <label class="f"><span class="lbl">How often</span><select class="inp" id="q_freq">${['Weekly', 'Every 2 weeks', 'On call', 'One time'].map((f) => opt(f, f, q?.freq || 'Weekly')).join('')}</select></label></div>
      <div class="grid2"><label class="f"><span class="lbl">Snow ($)</span><input class="inp" id="q_snow" inputmode="decimal" placeholder="Leave blank if none" value="${esc(n(q?.snowPrice))}"></label>
        <label class="f"><span class="lbl">Snow plan</span><select class="inp" id="q_snowPlan">${opt('perSnow', 'Per visit', q?.snowPlan || 'perSnow')}${opt('seasonal', 'Season', q?.snowPlan)}</select></label></div>
      <div class="lbl">Add-ons</div>
      ${state.addons.length ? `<div class="flex wrap">${[...state.addons].sort(byName).map((a) => `<button class="chip ${state.quoteSel.includes(a.id) ? 'on' : ''}" data-a="quoteAddon" data-id="${a.id}">${esc(a.name)} · ${money(a.price)}</button>`).join('')}</div>` : '<div class="muted">No add-ons yet. Create them in Settings.</div>'}
      <div class="lbl">Custom items</div>
      <div class="muted small">Anything else, like tree trimming. Type what it is and the price.</div>
      ${state.quoteLines.map((l, i) => `<div class="flex" style="align-items:flex-start;gap:8px">
        <textarea class="inp grow" id="q_ld${i}" rows="2" placeholder="What it is (e.g. Trim 3 trees in back yard)">${esc(l.d)}</textarea>
        <input class="inp" id="q_la${i}" inputmode="decimal" placeholder="$" style="width:90px" value="${esc(l.a)}">
        <button class="link danger" style="min-height:44px" data-a="quoteLineDel" data-i="${i}" aria-label="Remove item">✕</button></div>`).join('')}
      <button class="btn btn-ghost btn-sm" data-a="quoteLineAdd">+ Add custom item</button>
      <label class="f"><span class="lbl">Notes on the quote</span><textarea class="inp" id="q_notes">${v('notes')}</textarea></label>
      <button class="btn btn-primary" data-a="${q ? 'saveQuote' : 'createQuote'}" ${q ? `data-id="${q.id}"` : ''}>${q ? 'Save changes' : 'Create quote'}</button></div>`;
}
// Keep what's typed in the quote form when the screen redraws.
const QUOTE_FIELDS = ['q_name', 'q_address', 'q_phone', 'q_grass', 'q_freq', 'q_snow', 'q_snowPlan', 'q_notes'];
function grabQuoteLines() { state.quoteLines = state.quoteLines.map((_, i) => ({ d: val('q_ld' + i), a: val('q_la' + i) })); }
function redrawQuoteForm(change) {
  const keep = QUOTE_FIELDS.map((id) => [id, val(id)]);
  grabQuoteLines(); change(); render();
  keep.forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });
}
// Add-ons picked + custom items, as quote lines.
function quoteExtras() {
  grabQuoteLines();
  const picked = state.quoteSel.map((id) => state.addons.find((a) => a.id === id)).filter(Boolean).map((a) => ({ name: a.name, price: num(a.price) }));
  const custom = state.quoteLines.filter((l) => l.d.trim() || num(l.a)).map((l) => ({ name: l.d.trim() || 'Custom work', price: num(l.a), custom: true }));
  return picked.concat(custom);
}
function quoteData() {
  return { name: val('q_name').trim(), address: val('q_address'), phone: val('q_phone'), grassPrice: num(val('q_grass')), freq: val('q_freq'),
    snowPrice: num(val('q_snow')), snowPlan: val('q_snowPlan'), addons: quoteExtras(), notes: val('q_notes') };
}
const resetQuoteForm = () => { state.quoteSel = []; state.quoteLines = [{ d: '', a: '' }]; state.quoteEdit = false; };
function viewQuotes() {
  const q = state.quoteId && state.quotes.find((x) => x.id === state.quoteId);
  if (q && state.quoteEdit) return `<button class="link" data-a="cancelQuoteEdit">← Back to quote</button>${quoteForm(q)}`;
  if (q) {
    const total = (q.grassPrice || 0) + (q.snowPrice || 0) + (q.addons || []).reduce((a, x) => a + x.price, 0);
    return `<button class="link" data-a="quoteBack">← All quotes</button>
      <div class="card"><div class="between"><div class="b" style="font-size:18px">${esc(q.name)}</div>${pill(q.status === 'Sent' ? 'p-green' : q.status === 'Accepted' ? 'p-blue' : 'p-orange', q.status)}</div>
        <div class="muted">${[q.address, q.phone].filter(Boolean).map(esc).join(' · ')}</div>
        <div class="card list" style="border:0;padding:0">
          ${q.grassPrice ? `<div class="line"><span>Mowing - ${esc(q.freq.toLowerCase())} (per cut)</span><span>${money(q.grassPrice)}</span></div>` : ''}
          ${q.snowPrice ? `<div class="line"><span>Snow - ${q.snowPlan === 'seasonal' ? 'season' : 'per visit'}</span><span>${money(q.snowPrice)}</span></div>` : ''}
          ${(q.addons || []).map((a) => `<div class="line"><span>${esc(a.name)}</span><span>${money(a.price)}</span></div>`).join('')}
          ${q.grassPrice && q.snowPrice ? '' : `<div class="line b"><span>Total</span><span>${money(total)}</span></div>`}</div>
        ${q.notes ? `<div style="white-space:pre-line">${esc(q.notes)}</div>` : ''}
        <button class="btn btn-ghost" data-a="editQuote" data-id="${q.id}">Edit quote</button>
        <button class="btn btn-primary" data-a="sendQuote" data-id="${q.id}">${q.status === 'Sent' ? 'Send again' : 'Send quote (PDF)'}</button>
        ${q.status !== 'Accepted' ? `<button class="btn btn-ghost" data-a="quoteToCustomer" data-id="${q.id}">They said yes: make them a customer</button>` : ''}
        <button class="link danger" data-a="delQuote" data-id="${q.id}">Delete quote</button></div>`;
  }
  return `${quoteForm()}
    <div class="sec">Recent quotes</div>
    ${state.quotes.length ? [...state.quotes].sort((a, b) => b.createdAt - a.createdAt).map((q) => `<button class="rowbtn" data-a="openQuote" data-id="${q.id}"><div class="grow"><div class="b">${esc(q.name)}</div><div class="muted">${shortDate(q.date)}</div></div>${pill(q.status === 'Sent' ? 'p-green' : q.status === 'Accepted' ? 'p-blue' : 'p-orange', q.status)}</button>`).join('') : '<div class="card empty">No quotes yet.</div>'}`;
}

/* ----- Settings ----- */
function viewSettings() {
  const s = settings();
  const field = (k, label, ph = '', area = false) => area
    ? `<label class="f"><span class="lbl">${label}</span><textarea class="inp" data-setting="${k}" placeholder="${esc(ph)}">${esc(s[k])}</textarea></label>`
    : `<label class="f"><span class="lbl">${label}</span><input class="inp" data-setting="${k}" value="${esc(s[k])}" placeholder="${esc(ph)}"></label>`;
  // Every section folds; which ones are open is remembered while the app is open.
  const fold = (key, title, hint, inner, nested = false) => `<details class="fold${nested ? ' nested' : ''}" data-fold="${key}" ${state.openFolds.has(key) ? 'open' : ''}>
    <summary><div class="grow"><div class="b">${title}</div>${hint ? `<div class="muted small">${hint}</div>` : ''}</div><span class="chev" aria-hidden="true">›</span></summary>
    <div class="fold-body">${inner}</div></details>`;
  const lock = lockCfg();
  const addons = [...state.addons].sort(byName);
  const users = [...state.users].filter((u) => !u.id.endsWith('@demo') || u.role !== 'customer')
    .sort((a, b) => ({ admin: 0, crew: 1, customer: 2 }[a.role] - { admin: 0, crew: 1, customer: 2 }[b.role]) || byName(a, b));
  const openInvites = state.invites.filter((i) => !i.usedBy).sort((a, b) => b.createdAt - a.createdAt);
  const msg = (k, title, hint) => fold('msg_' + k, title, hint, field(k, 'Text', '', true), true);
  return [
    fold('addons', 'Add-ons', `${addons.length} saved`, `<div class="muted">Extras you can add when you mark a job done, or on a quote. You can change the price each time.</div>
      ${addons.length ? `<div class="card list" style="border:0;padding:0">${addons.map((a) => `<div class="line"><span class="b">${esc(a.name)}</span><span class="flex"><span>${money(a.price)}</span><button class="link danger" style="min-height:32px" data-a="delAddon" data-id="${a.id}">Remove</button></span></div>`).join('')}</div>` : '<div class="b">No add-ons yet.</div>'}
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px"><label><span class="sr">Add-on name</span><input class="inp" id="a_name" placeholder="e.g. Edge sidewalk"></label>
        <label><span class="sr">Default price</span><input class="inp" id="a_price" inputmode="decimal" placeholder="$"></label></div>
      <button class="btn btn-ghost" data-a="addAddon">+ Create add-on</button>`),
    fold('payments', 'Payments', `Zelle${s.zelleQr ? ' + QR' : ''}${s.venmo ? ', Venmo' : ''}`, `${field('zelle', 'Zelle (phone or email)')}
      <div><div class="lbl">Zelle QR code</div>${s.zelleQr ? `<div class="qr"><img src="${esc(s.zelleQr)}" alt="Zelle QR code"></div><button class="link danger" data-a="removeZelleQr">Remove QR</button>` : '<div class="muted small">Save your QR from your bank app’s Zelle screen, then upload it here.</div>'}
        <label class="btn btn-ghost full" style="margin-top:6px">Upload Zelle QR<input type="file" accept="image/*" data-change="zelleQr" class="sr"></label></div>
      ${field('venmo', 'Venmo link (business)', 'e.g. venmo.com/u/PrecisionCutLawns')}
      <div class="muted small">Customers see these with a QR code and a Pay button in their account. Venmo shows once it’s filled in.</div>`),
    fold('business', 'Business info', esc(s.businessPhone), `${field('businessPhone', 'Phone on quotes and invoices')}${field('businessEmail', 'Email on quotes and invoices')}${field('website', 'Website link', 'Add your website')}`),
    fold('skips', 'Skips', `Deadline: ${esc(deadlineText(weekStart(new Date())))}`, `<div class="muted small">Customers get 1 free skip a month. They can skip until:</div>
      <div class="grid2"><label class="f"><span class="lbl">Day</span><select class="inp" data-setting="skipDay">${DAYS.map((d, i) => `<option value="${i}" ${Number(s.skipDay) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label class="f"><span class="lbl">Time</span><input class="inp" type="time" data-setting="skipTime" value="${esc(s.skipTime)}"></label></div>`),
    fold('messages', 'Messages', 'The texts the app writes for you', `<div class="muted small">Fill-ins: {first} first name, {total}, {zelle}, {venmo}, {link} app link, {week}, {deadline}, {phone}, {date}, {email}.</div>
      ${msg('reminderMsg', 'Weekly reminder', 'Wednesdays, with the skip link')}${msg('oncallMsg', 'On-call text', '“Would you like your grass cut today?”')}
      ${msg('invoiceMsg', 'Invoice text', 'Sent with the PDF')}
      ${fold('msg_receipt', 'Receipt text', s.receiptEnabled ? 'On' : 'Off', `<label class="check"><input type="checkbox" data-setting="receiptEnabled" ${s.receiptEnabled ? 'checked' : ''}> Offer a receipt text when I mark Paid</label>${field('receiptMsg', 'Text', '', true)}`, true)}
      ${msg('quoteMsg', 'Quote text', 'Sent with the quote PDF')}${msg('welcomeCustomer', 'Customer welcome', 'Sent with their invite')}${msg('welcomeCrew', 'Crew welcome', 'Sent with their invite')}
      ${customMsgs().map((m) => fold('cmsg_' + m.id, esc(m.title || 'Untitled'), 'My message', `<label class="f"><span class="lbl">Name</span><input class="inp" data-cmsg="${esc(m.id)}" data-field="title" value="${esc(m.title)}" placeholder="e.g. Spring sign-up"></label>
        <label class="f"><span class="lbl">Text</span><textarea class="inp" data-cmsg="${esc(m.id)}" data-field="body" rows="6">${esc(m.body)}</textarea></label>
        <button class="btn btn-primary" data-a="sendSaved" data-id="${esc(m.id)}">Send</button>
        <button class="link danger" style="align-self:flex-start;min-height:32px" data-a="delCustomMsg" data-id="${esc(m.id)}">Delete this message</button>`, true)).join('')}
      <div class="muted small">Your own messages can also use {invite} (a sign-up link just for that person), {name} full name and {website}.</div>
      <button class="btn btn-ghost" data-a="addCustomMsg">+ New message</button>`),
    fold('users', 'Users', `${users.length} with access${openInvites.length ? ` · ${openInvites.length} open invite${openInvites.length === 1 ? '' : 's'}` : ''}`, `<div class="b">Invite someone</div>
      <div class="muted small">Makes a link you can text or copy to anyone. They tap it, sign up with any email, and type their name. New customers show up in Customers so you can fill in the rest. Each link works once.</div>
      <button class="btn btn-primary" data-a="newInvite" data-role="customer">Customer invite link</button>
      <button class="btn btn-ghost" data-a="newInvite" data-role="crew">Crew invite link</button>
      ${openInvites.length ? `<div class="b" style="margin-top:6px">Open invite links</div>
      <div class="card list" style="padding:0;border:0">${openInvites.map((i) => `<div class="line"><div class="grow"><div class="b">${i.customerId && cust(i.customerId) ? esc(cust(i.customerId).name) : i.label ? esc(i.label) : i.role === 'crew' ? 'Crew (no name)' : 'New customer (no name)'}</div>
        <div class="muted small">Made ${new Date(i.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · not used yet · <span class="mono">…${esc(i.id.slice(-4))}</span></div></div>
        ${i.customerId ? '' : `<button class="link" style="min-height:32px;margin-right:10px" data-a="labelInvite" data-id="${i.id}">Name</button>`}
        <button class="link" style="min-height:32px" data-a="resendInvite" data-id="${i.id}">Send</button>
        <button class="link danger" style="margin-left:10px;min-height:32px" data-a="cancelInvite" data-id="${i.id}">Cancel</button></div>`).join('')}</div>` : ''}
      <div class="muted small">Each link works once. The last 4 characters (…ab12) match the end of the link in the text you sent, so you can tell them apart in Messages. Not sure who one was for? Leave it and make a fresh link for that person.</div>
      <div class="muted small">You get an email each time someone uses an invite link. Tap the test button once to turn it on (and again any time you change the address): FormSubmit sends an "Activate" email to that address; tap the button in it.</div>
      ${field('alertEmail', 'Send sign-up emails to', state.user.email)}
      <button class="btn btn-ghost" data-a="testAlert">Send a test sign-up email</button>
      <div class="b" style="margin-top:6px">People with access</div>
      <div class="card list" style="padding:0 0 0 0;border:0">${users.map((u) => `<div class="line"><div class="grow"><div class="b">${esc(u.name)}</div><div class="muted small">${esc(u.id)}</div></div>
        ${pill(u.role === 'admin' ? 'p-green' : u.role === 'crew' ? 'p-blue' : 'p-gray', u.role[0].toUpperCase() + u.role.slice(1))}
        ${u.id !== state.user.email ? `<button class="link danger" style="margin-left:10px;min-height:32px" data-a="removeUser" data-email="${esc(u.id)}">Remove</button>` : ''}</div>`).join('')}</div>`),
    fold('security', 'Security (this phone)', lock ? `Passcode lock on · ${lock.minutes} min` : 'Passcode lock off', `<div class="muted small">Ask for a 4-digit passcode when the app opens or sits idle, even while you stay signed in.</div>
      ${lock ? `<div class="flex"><button class="btn btn-ghost grow" data-a="setLock">Change</button><button class="btn btn-danger grow" data-a="clearLock">Turn off</button></div>` : '<button class="btn btn-primary" data-a="setLock">Turn on passcode lock</button>'}`),
    fold('backup', 'Backup', 'Download a full copy', `<div class="muted small">Your data is saved in Firebase automatically. Download a full copy now and then to keep on your phone or computer.</div>
      <button class="btn btn-ghost" data-a="backup">Download backup</button>`),
    `<div class="card center"><div class="b">App version ${APP_VERSION}</div>
      <div class="muted small">${upd.checking ? 'Checking…' : !upd.latest ? 'Not checked yet' : upd.latest === APP_VERSION ? '✓ Up to date' : `Update available: version ${esc(upd.latest)}`}</div>
      ${upd.latest && upd.latest !== APP_VERSION ? '<button class="btn btn-primary" data-a="updateNow">Update now</button>' : '<button class="btn btn-ghost" data-a="checkUpdate">Check for updates</button>'}
      <div class="muted small">The app updates itself when you open it. This is here just in case.</div></div>`,
  ].join('');
}

/* ----- Customer home ----- */
function renderCustomerHome() {
  const c = state.customers[0];
  const s = settings();
  if (!c) { app.innerHTML = `${demoBar()}<main class="no-tabs"><div class="card empty">Your account isn’t linked to a customer yet. Please text ${esc(s.businessPhone)}.</div><button class="btn btn-ghost" data-a="signOut">Sign out</button></main>`; return; }
  const wk = weekStart(new Date());
  const stop = state.stops.find((x) => x.id === `${wk}_${c.id}`);
  const due = dueGrass(c, wk) || (stop && stop.type !== 'snow');
  const status = stop?.status || (due ? 'scheduled' : null);
  const monthKey = ymd(new Date()).slice(0, 7);
  const skipsUsed = state.stops.filter((x) => x.skippedBy === 'customer' && x.skippedAt && ymd(new Date(x.skippedAt)).slice(0, 7) === monthKey).length;
  const beforeDeadline = Date.now() < skipDeadline(wk).getTime();
  const canSkip = status === 'scheduled' && beforeDeadline && skipsUsed < 1 && c.grassPlan !== 'oncall';
  const unpaid = state.visits.filter((v) => !v.paid).sort((a, b) => a.date.localeCompare(b.date));
  const paid = state.visits.filter((v) => v.paid).sort((a, b) => b.date.localeCompare(a.date));
  const openSnow = state.requests.find((r) => r.type === 'snow' && r.status !== 'done');
  const openMow = state.requests.find((r) => r.type === 'mow' && r.status !== 'done');
  const venmoUrl = s.venmo ? (s.venmo.startsWith('http') ? s.venmo : 'https://' + s.venmo) : '';
  let grassCard = '';
  if (c.grass && c.active && !grassWeek(wk) && !stop) {
    grassCard = '<div class="card"><div class="b">Grass</div><div class="muted">Mowing season is April to November. See you in the spring!</div></div>';
  } else if (c.grass && c.active) {
    if (c.grassPlan === 'oncall') {
      grassCard = `<div class="card"><div class="b">Grass</div><div class="muted">You’re on call. I’ll text you when I’m coming, or you can ask for a mow anytime.</div>
        ${status === 'done' ? '<div class="okbar">✓ Mowed this week</div>' : openMow ? '<div class="okbar">Mow requested. I’ll be in touch!</div>' : '<button class="btn btn-lime" data-a="custRequest" data-type="mow">Request a mow</button>'}</div>`;
    } else {
      const plan = c.grassPlan === 'weekly' ? 'Weekly' : 'Every 2 weeks';
      let inner = '';
      if (!status) inner = '<div class="muted">No mow this week. Every-2-weeks: you’re on next week.</div>';
      else if (status === 'done') inner = '<div class="okbar">✓ Mowed this week. Thank you!</div>';
      else if (status === 'skipped') inner = `<div class="warnbar">You’re skipping this week.</div>`;
      else inner = `<div class="okbar">Scheduled this week (${esc(weekLabel(wk))})</div>
        ${canSkip ? `<button class="btn btn-ghost" data-a="custSkip">Skip this week</button><div class="muted small">Skip by ${esc(deadlineText(wk))}. You have 1 free skip a month.</div>`
          : `<div class="muted small">${skipsUsed >= 1 ? 'You’ve used your free skip this month.' : !beforeDeadline ? 'The skip deadline for this week has passed.' : ''}</div>`}`;
      grassCard = `<div class="card" id="skip"><div class="between"><div class="b">Grass</div>${pill('p-blue', plan)}</div>${inner}</div>`;
    }
  }
  let snowCard = '';
  if (c.snow && c.active) {
    snowCard = c.snowPlan === 'seasonal'
      ? '<div class="card"><div class="between"><div class="b">Snow</div>' + pill('p-blue', 'Seasonal') + '</div><div class="muted">You’re covered all season. I’ll clear it after each snow.</div></div>'
      : `<div class="card"><div class="between"><div class="b">Snow</div>${pill('p-blue', 'Per snow')}</div>
        ${!snowSeason() && !openSnow ? '<div class="muted">Snow season is October to March.</div>' : openSnow ? `<div class="okbar">Snow removal requested ${shortDate(ymd(new Date(openSnow.at)))}. I’m on it!</div>` : `<div class="muted">Need your snow cleared? Tap below and I’ll get you on the list.</div><button class="btn btn-lime" data-a="custRequest" data-type="snow">Request snow removal</button>`}</div>`;
  }
  app.innerHTML = `${demoBar()}
    <header class="top"><div class="top-row">${brand()}<button class="link" data-a="signOut">Sign out</button></div>
      <h1>Hi ${esc(first(c.name))}!</h1><div class="sub">${esc(c.address || '')}</div></header>
    <main class="no-tabs">
      ${grassCard}${snowCard}
      ${unpaid.length ? `<div class="sec">To pay</div>${unpaid.map((v) => `<div class="card"><div class="between"><div><div class="b">${esc(v.desc || 'Lawn mowing')}</div><div class="muted">${shortDate(v.date)} · ${esc(v.invoiceNo)}</div></div><div class="big">${money(v.total)}</div></div>
          <button class="btn btn-ghost" data-a="custPdf" data-id="${v.id}">View invoice (PDF)</button>
          ${v.customerSaysPaid ? '<div class="okbar">Thanks! I’ll confirm once it comes through.</div>' : `<button class="btn btn-primary" data-a="custPaid" data-id="${v.id}">I’ve paid this</button>`}</div>`).join('')}` : '<div class="card"><div class="okbar">You’re all paid up. Thank you!</div></div>'}
      <div class="sec">How to pay</div>
      <div class="card">
        ${venmoUrl ? `<a class="btn btn-primary" href="${esc(venmoUrl)}" target="_blank" rel="noopener">Pay with Venmo</a><div class="qr">${qrSvg(venmoUrl)}</div>` : ''}
        <div class="between"><div><div class="b">Zelle</div><div>${esc(s.zelle)}</div></div><button class="btn btn-ghost btn-sm" data-a="copyZelle">Copy</button></div>
        ${s.zelleQr ? `<div class="qr"><img src="${esc(s.zelleQr)}" alt="Zelle QR code"></div><div class="muted small center">Scan with your bank app’s Zelle option.</div>` : '<div class="muted small">Open your bank app, choose Zelle, and send to the number above.</div>'}
      </div>
      <div class="sec">Message Jace</div>
      <div class="card"><label class="f"><span class="sr">Message</span><textarea class="inp" id="m_text" placeholder="Questions, gate code changes, anything…"></textarea></label>
        <div class="flex"><button class="btn btn-primary grow" data-a="custRequest" data-type="message">Send in the app</button><a class="btn btn-ghost" href="${smsHref(s.businessPhone, '')}">Text instead</a></div></div>
      ${paid.length ? `<button class="link" data-a="togglePaid">${state.showPaidHistory ? 'Hide' : 'Show'} paid invoices (${paid.length})</button>
        ${state.showPaidHistory ? `<div class="card list">${paid.map((v) => `<div class="line"><div class="grow"><div>${shortDate(v.date)} · ${esc(v.desc || 'Lawn mowing')}</div></div><b>${money(v.total)}</b><button class="link" style="margin-left:10px;min-height:32px" data-a="custPdf" data-id="${v.id}">PDF</button></div>`).join('')}</div>` : ''}` : ''}
      <div class="bizfoot"><img src="logo-full.jpg" alt="Precision Cut Lawns">
        <div class="motto">EVERY LINE. EVERY EDGE. EVERY TIME.</div>
        <div class="muted small">${[s.businessPhone ? `<a href="tel:${esc(s.businessPhone)}">${esc(s.businessPhone)}</a>` : '', s.businessEmail ? `<a href="mailto:${esc(s.businessEmail)}">${esc(s.businessEmail)}</a>` : '', s.website ? esc(s.website) : ''].filter(Boolean).join(' · ')}</div></div>
    </main>`;
  if (location.hash === '#skip') document.getElementById('skip')?.scrollIntoView({ block: 'center' });
}

const brand = () => '<div class="brand"><img src="logo-mark.png" alt="" class="brandmark"><div class="wordmark">PRECISION <span>CUT</span><small>LAWNS</small></div></div>';
/* ----- Sign-in screens ----- */
const authCard = (inner) => `<div class="auth"><div class="card">
  <img src="logo-full.jpg" alt="Precision Cut logo" class="logo"><h1>Precision Cut Lawns</h1>
  ${state.authMsg ? `<p class="msg">${esc(state.authMsg)}</p>` : ''}${inner}</div></div>`;
function renderSignIn() {
  if (joinCode() && !state.authModeSet) state.authMode = backFromEmail ? 'in' : 'up';
  const up = state.authMode === 'up';
  app.innerHTML = authCard(`
    ${joinCode() && backFromEmail ? '<div class="okbar">Email confirmed! Sign in with the email and password you just made to finish joining.</div>'
      : joinCode() ? '<div class="okbar">Welcome! Sign in with Google, or create an account with any email you like.</div>'
      : inviteEmail ? '<div class="okbar">Welcome! Sign in with Google or create a password using the email Jace invited.</div>' : ''}
    <button class="btn google" data-a="google">Sign in with Google</button>
    <div class="muted center small">or with email</div>
    <label class="f"><span class="lbl">Email</span><input class="inp" id="au_email" type="email" autocomplete="email" autocapitalize="off" value="${esc(inviteEmail)}"></label>
    <label class="f"><span class="lbl">Password</span><input class="inp" id="au_pw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}"></label>
    <button class="btn btn-primary" data-a="${up ? 'signUp' : 'signIn'}">${up ? 'Create account' : 'Sign in'}</button>
    <button class="link center" data-a="authMode">${up ? 'Already have an account? Sign in' : 'First time? Create an account'}</button>
    ${up ? '' : '<button class="link center small" data-a="resetPw">Forgot password?</button>'}`);
}
function renderJoin() {
  app.innerHTML = authCard(`<p>Welcome to Precision Cut Lawns! What’s your name?</p>
    <label class="f"><span class="lbl">Your name</span><input class="inp" id="join_name" autocomplete="name" value="${esc(state.user.name)}"></label>
    <button class="btn btn-primary" data-a="joinApp">Join</button>
    <div class="muted small center">Signed in as ${esc(state.user.email)}</div>
    <button class="link center" data-a="signOut">Use a different account</button>`);
}
function renderNoAccess() {
  app.innerHTML = authCard(state.setupDone
    ? `<p>You’re signed in as <b>${esc(state.user.email)}</b>, but this account isn’t set up yet. Ask Jace for an invite link, then tap it to finish joining.</p><button class="btn btn-ghost" data-a="signOut">Sign out</button>`
    : `<p>No one has set up this app yet. Set it up now and <b>${esc(state.user.email)}</b> becomes the admin.</p>
      <label class="f"><span class="lbl">Your name</span><input class="inp" id="setup_name" value="Jace"></label>
      <button class="btn btn-primary" data-a="claimSetup">Set up as admin</button><button class="link center" data-a="signOut">Sign out</button>`);
}
function renderLock() {
  app.innerHTML = `<div class="auth" style="gap:18px;justify-content:flex-start;padding-top:calc(env(safe-area-inset-top) + 56px)">
    <img src="logo.jpg" alt="Precision Cut logo" style="width:190px;height:119px;object-fit:contain;background:#fff;border-radius:20px;padding:6px 14px">
    <div style="color:#C9D6CD">Enter your passcode</div>
    <div class="flex" style="gap:16px;height:18px">${[0, 1, 2, 3].map((i) => `<i style="width:14px;height:14px;border-radius:50%;border:2px solid #C9D6CD;${i < pinEntry.length ? 'background:#7DBE2A;border-color:#7DBE2A' : ''}"></i>`).join('')}</div>
    <div style="color:#FFB4A8;min-height:22px;font-weight:600">${esc(pinErr)}</div>
    <div style="display:grid;grid-template-columns:repeat(3,72px);gap:16px 22px">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => k === '' ? '<span></span>'
      : `<button style="width:72px;height:72px;border-radius:50%;border:1px solid ${k === 'del' ? 'transparent' : 'rgba(255,255,255,.3)'};background:${k === 'del' ? 'none' : 'rgba(255,255,255,.06)'};color:#fff;font-size:${k === 'del' ? 16 : 28}px;cursor:pointer" data-a="pinKey" data-v="${k}" ${k === 'del' ? 'aria-label="Delete digit"' : ''}>${k === 'del' ? 'Delete' : k}</button>`).join('')}</div>
    <button class="link" style="color:#C9D6CD" data-a="signOut">Forgot it? Sign out</button></div>`;
  sheetEl.innerHTML = '';
}

/* ----- Sheets (pop-ups) ----- */
function renderSheet() {
  const sh = state.sheet;
  if (!sh) { sheetEl.innerHTML = ''; return; }
  let inner = '';
  if (sh.kind === 'done') {
    const c = cust(sh.cid);
    const total = num(sh.price) + sh.sel.reduce((a, id) => a + num((state.addons.find((x) => x.id === id) || {}).price), 0);
    inner = `<div><div class="b" style="font-size:20px">${esc(c.name)}</div><div class="muted">${esc(sh.desc)}</div></div>
      <label class="f"><span class="lbl">Price this time ($)</span><input class="inp" id="sh_price" inputmode="decimal" value="${esc(sh.price)}" data-input="sheetPrice"></label>
      <div class="muted small">Normal rate is ${money(sh.base)}. Changing it here only affects this invoice.</div>
      ${sh.kind === 'done' && sh.canDesc ? `<label class="f"><span class="lbl">Description</span><input class="inp" id="sh_desc" value="${esc(sh.desc)}"></label>` : ''}
      <div class="lbl">Add-ons</div>
      ${state.addons.length ? `<div class="flex wrap">${[...state.addons].sort(byName).map((a) => `<button class="chip ${sh.sel.includes(a.id) ? 'on' : ''}" data-a="sheetAddon" data-id="${a.id}">${esc(a.name)} · ${money(a.price)}</button>`).join('')}</div>` : '<div class="muted small">No add-ons yet. Create them in Settings.</div>'}
      <div class="between b" style="font-size:18px;border-top:1px solid #ECEDEC;padding-top:10px"><span>Total</span><span id="sh_total">${money(total)}</span></div>
      <button class="btn btn-primary" data-a="confirmDone" data-send="1">Done &amp; send invoice</button>
      <button class="btn btn-ghost" data-a="confirmDone">Done, send invoice later</button>
      <button class="btn btn-ghost" data-a="closeSheet">Cancel</button>`;
  } else if (sh.kind === 'remind') {
    const rows = grassRoute(state.week).filter((r) => r.status === 'scheduled' && r.c.grassPlan !== 'oncall');
    const s = settings();
    inner = `<div class="b" style="font-size:20px">Weekly reminders</div><div class="muted small">Tap each one. Messages opens with the reminder filled in, then tap send and come back.</div>
      ${rows.map((r) => { const body = fill(s.reminderMsg, { first: first(r.c.name), week: weekLabel(state.week), deadline: deadlineText(state.week), link: appLink() + '#skip', phone: s.businessPhone });
        return `<div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div><div class="b">${esc(r.c.name)}</div>${r.stop?.reminded ? '<div class="muted small">✓ Sent</div>' : ''}</div>
          ${r.c.phone ? `<a class="btn ${r.stop?.reminded ? 'btn-ghost' : 'btn-primary'} btn-sm" href="${smsHref(r.c.phone, body)}" data-a="reminded" data-id="${r.id}" data-cid="${r.c.id}">${r.stop?.reminded ? 'Again' : 'Text'}</a>` : '<span class="muted small">No phone</span>'}</div>`; }).join('')}
      <button class="btn btn-ghost" data-a="closeSheet">Close</button>`;
  } else if (sh.kind === 'addWeek') {
    const on = new Set(grassRoute(state.week).filter((r) => r.status !== 'skipped').map((r) => r.c.id));
    const list = state.customers.filter((c) => c.active && !on.has(c.id)).sort(byName);
    inner = `<div class="b" style="font-size:20px">Add to week of ${esc(weekLabel(state.week))}</div><div class="muted small">For anyone who said yes, asked by text, or needs an extra mow. Use Skip on the route to take someone off.</div>
      ${list.map((c) => `<div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div class="grow"><div class="b">${esc(c.name)}</div><div class="muted small">${esc({ weekly: 'Weekly', biweekly: 'Every 2 weeks', oncall: 'On call' }[c.grassPlan] || (c.grass ? '' : 'No grass plan'))}</div></div>
        <button class="btn btn-lime btn-sm" data-a="addWeek" data-cid="${c.id}">Add</button></div>`).join('') || '<div class="muted">Everyone is already on this week.</div>'}
      <button class="btn btn-ghost" data-a="closeSheet">Done</button>`;
  } else if (sh.kind === 'oncall') {
    const s = settings();
    const list = state.customers.filter((c) => c.active && c.grass && c.grassPlan === 'oncall' && !stopOf(`${state.week}_${c.id}`) && !mowAsked(c, state.week)).sort(byName);
    inner = `<div class="b" style="font-size:20px">On-call customers</div><div class="muted small">Text each one, then tap “Yes” for anyone who wants a mow. It adds them to this week.</div>
      ${list.map((c) => `<div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div class="b grow">${esc(c.name)}</div>
        ${c.phone ? `<a class="btn btn-ghost btn-sm" href="${smsHref(c.phone, s.oncallMsg)}">Text</a>` : ''}<button class="btn btn-lime btn-sm" data-a="oncallYes" data-cid="${c.id}">Yes</button></div>`).join('') || '<div class="muted">Everyone’s been added this week.</div>'}
      <button class="btn btn-ghost" data-a="closeSheet">Close</button>`;
  } else if (sh.kind === 'text') {
    inner = `<div class="b" style="font-size:20px">${esc(sh.title)}</div><div class="card" style="white-space:pre-line;overflow-wrap:anywhere;background:#F4F6F2">${esc(sh.body)}</div>
      ${sh.phone ? `<a class="btn btn-primary" href="${smsHref(sh.phone, sh.body)}" data-a="closeSheet">Open in Messages</a>` : ''}
      <button class="btn ${sh.phone ? 'btn-ghost' : 'btn-primary'}" data-a="shareText">Share / copy</button>
      ${sh.link ? '<button class="btn btn-ghost" data-a="copyLink">Copy just the link</button>' : ''}<button class="btn btn-ghost" data-a="closeSheet">Done</button>`;
  } else if (sh.kind === 'pickMsg') {
    const c = cust(sh.cid), many = !sh.cid;
    inner = `<div class="b" style="font-size:20px">${many ? 'Text customers' : 'Text ' + esc(first(c?.name))}</div><div class="muted small">Pick a message. You can change your saved messages in Settings › Messages.</div>
      ${customMsgs().map((m) => `<button class="rowbtn" data-a="${many ? 'bulkList' : 'composeMsg'}" data-id="${esc(m.id)}"><div class="grow"><div class="b">${esc(m.title || 'Untitled')}</div><div class="muted small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.body)}</div></div></button>`).join('') || '<div class="muted">No saved messages yet.</div>'}
      ${many ? '' : '<button class="btn btn-ghost" data-a="composeMsg" data-id="">Blank message</button>'}
      <button class="btn btn-ghost" data-a="closeSheet">Cancel</button>`;
  } else if (sh.kind === 'compose') {
    const c = cust(sh.cid);
    inner = `<div class="b" style="font-size:20px">${sh.pickTo ? 'Send message' : 'Text ' + esc(c?.name || '')}</div>
      ${sh.pickTo ? `<label class="f"><span class="lbl">To</span><select class="inp" data-change="composeTo"><option value="">Someone in my phone’s contacts (pick in Messages)</option>
        ${[...state.customers].filter((x) => x.phone).sort(byName).map((x) => `<option value="${x.id}" ${x.id === sh.cid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
      ${sh.pickTo && !c && needsInvite(sh.tpl || '') ? `<label class="f"><span class="lbl">Who’s this for? <span class="muted small">(shows on the invite list)</span></span><input class="inp" id="cm_label" autocomplete="off" placeholder="Their name" value="${esc(sh.label || '')}"></label>
        ${canPickContact() ? `<button class="btn btn-ghost" data-a="pickContact">${sh.contactPhone ? 'To: ' + esc(sh.contactPhone) + ' · change' : 'Pick from my contacts'}</button>` : ''}` : ''}
      <div class="muted small">${sh.pickTo && !c ? 'Messages opens with the text filled in. Type a name or number in the To line, then tap send.' : 'Change anything you like, then open Messages and tap send.'}</div>
      <label class="f"><span class="sr">Message</span><textarea class="inp" id="cm_body" rows="9">${esc(sh.body)}</textarea></label>
      <button class="btn btn-primary" data-a="sendCompose">Open in Messages</button><button class="btn btn-ghost" data-a="closeSheet">Cancel</button>`;
  } else if (sh.kind === 'bulk') {
    const m = customMsgs().find((x) => x.id === sh.msgId) || { title: '', body: '' };
    const inv = needsInvite(m.body);
    const all = state.customers.filter((c) => c.active !== false).sort(byName);
    const rows = all.filter((c) => !(sh.skipMembers && userForCustomer(c.id)));
    const sent = rows.filter((c) => sh.sent[c.id]).length;
    inner = `<div class="b" style="font-size:20px">${esc(m.title || 'Text customers')}</div>
      <div class="muted small">Tap Text for each one. Messages opens with it filled in${inv ? ' (with their own sign-up link)' : ''}. Tap send and come back. ${sent} of ${rows.length} sent.</div>
      <label class="check"><input type="checkbox" data-change="bulkSkip" ${sh.skipMembers ? 'checked' : ''}> Only customers without an app account</label>
      ${rows.map((c) => `<div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div class="grow"><div class="b">${esc(c.name)}</div>${sh.sent[c.id] ? '<div class="muted small">✓ Sent</div>' : userForCustomer(c.id) ? '<div class="muted small">Has an account</div>' : ''}</div>
        ${c.phone ? `<a class="btn ${sh.sent[c.id] ? 'btn-ghost' : 'btn-primary'} btn-sm" href="${smsHref(c.phone, fillMsg(m.body, c, sh.pending))}" data-a="bulkSent" data-cid="${c.id}">${sh.sent[c.id] ? 'Again' : 'Text'}</a>` : '<span class="muted small">No phone</span>'}</div>`).join('') || '<div class="muted">Everyone already has an account.</div>'}
      <button class="btn btn-ghost" data-a="bulkPick">Pick a different message</button><button class="btn btn-ghost" data-a="closeSheet">Close</button>`;
  } else if (sh.kind === 'setLock') {
    inner = `<div class="b" style="font-size:20px">Passcode lock</div>
      <label class="f"><span class="lbl">New 4-digit passcode</span><input class="inp" id="lk_pin" inputmode="numeric" maxlength="4" type="password"></label>
      <label class="f"><span class="lbl">Lock after</span><select class="inp" id="lk_min">${[1, 2, 5, 10, 15, 30].map((m) => `<option value="${m}" ${m === 5 ? 'selected' : ''}>${m} minute${m === 1 ? '' : 's'} idle</option>`).join('')}</select></label>
      <button class="btn btn-primary" data-a="saveLock">Save</button><button class="btn btn-ghost" data-a="closeSheet">Cancel</button>`;
  }
  sheetEl.innerHTML = `<div class="shade" data-a="closeSheet"><div class="panel" data-stop>${inner}</div></div>`;
}
// Snow stops: one per visit, so a driveway can be cleared (and billed) more than once a day.
const snowStops = (cid, date) => state.stops.filter((s) => s.type === 'snow' && s.customerId === cid && s.date === date);
function addSnowStop(cid, date) {
  const existing = snowStops(cid, date);
  if (existing.some((s) => s.status === 'scheduled')) return false; // already waiting on the list
  const visit = existing.length + 1;
  store.set('stops', `snow_${date}_${cid}${visit > 1 ? '_' + visit : ''}`, { customerId: cid, type: 'snow', status: 'scheduled', date, visit, weekId: weekStart(parseYmd(date)) });
  return true;
}
const snowDesc = (stop) => 'Snow removal' + ((stop?.visit || 1) > 1 ? ` - visit ${stop.visit}` : '');
const openText = (title, body, phone, link) => { state.sheet = { kind: 'text', title, body, phone, link }; renderSheet(); };
function makeInvite(role, customerId) {
  let label = '';
  if (!customerId) {
    const ans = prompt(role === 'crew' ? 'Who is this crew invite for? (so you can tell the links apart)' : 'Who is this invite for? (so you can tell the links apart)', '');
    if (ans === null) return; // cancelled
    label = ans.trim();
  }
  const id = newId();
  const data = { role, createdAt: Date.now(), createdBy: state.user.email, ...(customerId ? { customerId } : {}), ...(label ? { label } : {}) };
  store.set('invites', id, data);
  sendInvite({ id, ...data });
}
function sendInvite(i) {
  const c = i.customerId && cust(i.customerId);
  const tpl = welcomeTpl(i.role === 'crew' ? 'welcomeCrew' : 'welcomeCustomer');
  const who = c ? first(c.name) : i.label ? first(i.label) : 'there';
  openText(c ? 'Invite for ' + who : i.role === 'crew' ? 'Crew invite link' : 'Customer invite link',
    fill(tpl, { first: who, link: inviteLink(i.id), email: '' }), c?.phone || '', inviteLink(i.id));
}

/* ---------- actions ---------- */
const A = {
  tab(el) { state.tab = el.dataset.v; state.custId = null; state.editing = false; state.quoteId = null; state.quoteEdit = false; state.sheet = null; render(); scrollTo(0, 0); },
  routeSeg(el) { state.routeSeg = el.dataset.v; render(); },
  week(el) { state.week = shiftWeek(state.week, Number(el.dataset.n)); render(); },
  thisWeek() { state.week = weekStart(new Date()); render(); },
  moneyTab(el) { state.moneyTab = el.dataset.v; render(); scrollTo(0, 0); },
  closeSheet() { state.sheet = null; renderSheet(); },

  // Saved messages
  addCustomMsg() { const id = newId(); state.openFolds.add('cmsg_' + id); store.update('settings', 'main', { customMsgs: customMsgs().concat({ id, title: 'New message', body: 'Hi {first}, ' }) }); },
  // Send from Settings: uses the text on screen (even if it hasn't saved yet), to a customer or anyone in phone contacts.
  sendSaved(el) {
    const id = el.dataset.id, box = document.querySelector(`[data-cmsg="${CSS.escape(id)}"][data-field="body"]`);
    clearTimeout(cmsgTimer); saveCustomMsgs();
    const tpl = box ? box.value : customMsgs().find((x) => x.id === id)?.body || '';
    const pending = {};
    state.sheet = { kind: 'compose', pickTo: true, cid: '', tpl, pending, body: fillMsg(tpl, null, pending) };
    renderSheet();
  },
  delCustomMsg(el) {
    const m = customMsgs().find((x) => x.id === el.dataset.id);
    if (m && confirm(`Delete “${m.title || 'Untitled'}”?`)) store.update('settings', 'main', { customMsgs: customMsgs().filter((x) => x.id !== m.id) });
  },
  pickMsg(el) { state.sheet = { kind: 'pickMsg', cid: el.dataset.cid }; renderSheet(); },
  composeMsg(el) {
    const cid = state.sheet.cid, m = customMsgs().find((x) => x.id === el.dataset.id), pending = {};
    state.sheet = { kind: 'compose', cid, pending, body: m ? fillMsg(m.body, cust(cid), pending) : `Hi ${first(cust(cid)?.name)}, ` };
    renderSheet();
  },
  sendCompose() {
    const sh = state.sheet, c = cust(sh.cid), body = val('cm_body'), key = c ? c.id : '_new';
    const label = c ? '' : (document.getElementById('cm_label')?.value || '').trim();
    if (sh.pending[key] && body.includes(sh.pending[key])) {
      if (!c && document.getElementById('cm_label') && !label && !confirm('Send without a name? The invite will just say "New customer" in your list.')) return;
      saveInvite(c?.id || '', sh.pending, label);
    }
    state.sheet = null; renderSheet();
    location.href = smsHref(c?.phone || sh.contactPhone || '', body);
  },
  async pickContact() {
    const sh = state.sheet;
    try {
      const [p] = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!p) return;
      sh.body = val('cm_body'); sh.label = p.name?.[0] || (document.getElementById('cm_label')?.value || '');
      sh.contactPhone = p.tel?.[0] || ''; renderSheet();
    } catch (e) { console.error(e); toast('Couldn’t open contacts. Type their name instead.'); }
  },
  bulkPick() { state.sheet = { kind: 'pickMsg', cid: '' }; renderSheet(); },
  bulkList(el) {
    const m = customMsgs().find((x) => x.id === el.dataset.id);
    state.sheet = { kind: 'bulk', msgId: el.dataset.id, sent: {}, pending: {}, skipMembers: needsInvite(m?.body || '') };
    renderSheet();
  },
  bulkSent(el) {
    const sh = state.sheet, cid = el.dataset.cid;
    saveInvite(cid, sh.pending);
    sh.sent[cid] = true;
    setTimeout(renderSheet, 300); // after Messages opens
  },

  // Route
  markDone(el) {
    const c = cust(el.dataset.cid), kind = el.dataset.kind;
    const seasonal = kind === 'snow' && c.snowPlan === 'seasonal';
    const stopData = { customerId: c.id, type: kind, status: 'done', doneAt: Date.now(), doneByName: state.account.name || '', weekId: kind === 'snow' ? weekStart(parseYmd(state.snowDate)) : state.week, ...(kind === 'snow' ? { date: state.snowDate } : {}) };
    if (kind === 'grass') closeMowReqs(c.id);
    if (!isAdmin() || seasonal) { store.update('stops', el.dataset.id, stopData); toast(seasonal ? 'Done (seasonal, no bill)' : 'Marked done'); return; }
    const base = kind === 'snow' ? num(priceOf(c.id).snow) : num(priceOf(c.id).grass);
    state.sheet = { kind: 'done', cid: c.id, stopId: el.dataset.id, stopData, type: kind, base, price: String(base), sel: [], desc: kind === 'snow' ? snowDesc(stopOf(el.dataset.id)) : 'Lawn mowing' };
    renderSheet();
  },
  billStop(el) {
    const c = cust(el.dataset.cid), kind = el.dataset.kind;
    const base = kind === 'snow' ? num(priceOf(c.id).snow) : num(priceOf(c.id).grass);
    const stop = stopOf(el.dataset.id);
    state.sheet = { kind: 'done', cid: c.id, stopId: el.dataset.id, stopData: { status: 'done' }, type: kind, base, price: String(base), sel: [], desc: kind === 'snow' ? snowDesc(stop) : 'Lawn mowing', date: stop?.date || (stop?.doneAt ? ymd(new Date(stop.doneAt)) : today()) };
    renderSheet();
  },
  otherWork(el) {
    state.sheet = { kind: 'done', cid: el.dataset.cid, stopId: null, type: 'other', base: 0, price: '', sel: [], desc: 'Yard work', canDesc: true };
    renderSheet();
  },
  sheetAddon(el) {
    state.sheet.price = val('sh_price'); if (state.sheet.canDesc) state.sheet.desc = val('sh_desc');
    const id = el.dataset.id; const sel = state.sheet.sel;
    state.sheet.sel = sel.includes(id) ? sel.filter((x) => x !== id) : sel.concat(id);
    renderSheet();
  },
  async confirmDone(el) {
    const sh = state.sheet;
    const addons = sh.sel.map((id) => state.addons.find((a) => a.id === id)).filter(Boolean).map((a) => ({ name: a.name, price: num(a.price) }));
    const desc = sh.canDesc ? (val('sh_desc') || sh.desc) : sh.desc;
    const v = createVisit({ customerId: sh.cid, type: sh.type, price: val('sh_price'), addons, desc, stopId: sh.stopId, date: sh.date || (sh.type === 'snow' ? state.snowDate : today()) });
    if (sh.stopId) store.update('stops', sh.stopId, { ...sh.stopData, visitId: v.id });
    state.sheet = null; renderSheet();
    if (el.dataset.send) await run(() => sendInvoice(v)); else toast('Saved. Send the invoice anytime.');
  },
  async sendInvoice(el) { const v = visitOf(el.dataset.id); if (v) await run(() => sendInvoice(v)); },
  adminSkip(el) { closeMowReqs(el.dataset.cid); store.update('stops', el.dataset.id, { customerId: el.dataset.cid, weekId: state.week, type: 'grass', status: 'skipped', skippedBy: 'admin', skippedAt: Date.now() }); },
  unskip(el) { store.update('stops', el.dataset.id, { status: 'scheduled', skippedBy: null, skippedAt: null }); },
  openReminders() { state.sheet = { kind: 'remind' }; renderSheet(); },
  reminded(el) { store.update('stops', el.dataset.id, { customerId: el.dataset.cid, weekId: state.week, type: 'grass', status: stopOf(el.dataset.id)?.status || 'scheduled', reminded: Date.now() }); },
  openOncall() { state.sheet = { kind: 'oncall' }; renderSheet(); },
  openAddWeek() { state.sheet = { kind: 'addWeek' }; renderSheet(); },
  addWeek(el) { const id = `${state.week}_${el.dataset.cid}`, old = stopOf(id);
    store.set('stops', id, { customerId: el.dataset.cid, weekId: state.week, type: 'grass', status: 'scheduled', manual: true, ...(old?.day != null ? { day: old.day } : {}) });
    toast('Added to this week'); renderSheet(); },
  oncallYes(el) { store.set('stops', `${state.week}_${el.dataset.cid}`, { customerId: el.dataset.cid, weekId: state.week, type: 'grass', status: 'scheduled' }); toast('Added to this week'); },
  startSnow() {
    const date = state.snowDate;
    let n = 0;
    // Seasonal customers once per snow day (use "Clean again" for repeat visits).
    for (const c of state.customers.filter((x) => x.active && x.snow && x.snowPlan === 'seasonal')) {
      if (!snowStops(c.id, date).length && addSnowStop(c.id, date)) n++;
    }
    for (const r of state.requests.filter((x) => x.type === 'snow' && x.status !== 'done')) {
      if (addSnowStop(r.customerId, date)) n++;
      store.update('requests', r.id, { status: 'done', handledAt: Date.now() });
    }
    toast(n ? `${n} added to the snow list` : 'Everyone is already on the list');
  },
  snowAgain(el) { addSnowStop(el.dataset.cid, state.snowDate); toast('Added another visit'); },
  reqToSnow(el) { state.routeSeg = 'snow'; const r = state.requests.find((x) => x.id === el.dataset.id); const date = state.snowDate;
    addSnowStop(r.customerId, date);
    store.update('requests', r.id, { status: 'done', handledAt: Date.now() }); toast('Added to snow day ' + shortDate(date)); },
  reqToWeek(el) { const r = state.requests.find((x) => x.id === el.dataset.id); const wk = weekStart(new Date());
    store.set('stops', `${wk}_${r.customerId}`, { customerId: r.customerId, weekId: wk, type: 'grass', status: 'scheduled' });
    store.update('requests', r.id, { status: 'done', handledAt: Date.now() }); toast('Added to this week'); },
  reqDel(el) { if (!confirm('Delete this for good?')) return; store.remove('requests', el.dataset.id); toast('Deleted'); },
  reqClearDone() {
    const done = state.requests.filter((r) => r.status === 'done');
    if (!confirm(`Delete ${done.length} handled request${done.length === 1 ? '' : 's'} and message${done.length === 1 ? '' : 's'} for good?`)) return;
    done.forEach((r) => store.remove('requests', r.id)); toast('Deleted');
  },
  reqDone(el) { store.update('requests', el.dataset.id, { status: 'done', handledAt: Date.now() }); },

  // Customers
  openCust(el) { state.tab = 'customers'; state.custId = el.dataset.id; state.editing = false; render(); scrollTo(0, 0); },
  backToList() { state.custId = null; render(); },
  newCust() { state.custId = null; state.editing = true; render(); scrollTo(0, 0); },
  editCust() { state.editing = true; render(); scrollTo(0, 0); },
  cancelEdit() { state.editing = false; render(); },
  async saveCust() {
    const name = val('c_name').trim();
    if (!name) return toast('Name is needed');
    const existing = cust(state.custId);
    const data = { name, phone: val('c_phone'), address: val('c_address'), email: val('c_email').trim().toLowerCase(), deck: val('c_deck'), active: checked('c_active'),
      grass: checked('c_grass'), grassPlan: val('c_grassPlan'), snow: checked('c_snow'), snowPlan: val('c_snowPlan') };
    // Read every field before writing: a write can redraw the screen.
    const pricing = { grass: num(val('c_pGrass')), snow: num(val('c_pSnow')), season: num(val('c_pSeason')) };
    const notes = { text: val('c_notes') };
    const id = existing ? existing.id : store.add('customers', { ...data, createdAt: Date.now() });
    if (existing) store.update('customers', id, data);
    store.set('pricing', id, pricing);
    store.set('notes', id, notes);
    const u = userForCustomer(id);
    if (u) store.update('users', u.id, { name });
    if (store.mode === 'local') syncDemoCustomers();
    state.custId = id; state.editing = false; toast('Saved'); render();
  },
  async deleteCust() {
    const c = cust(state.custId);
    if (!confirm(`Delete ${c.name}? Their past invoices stay in your money totals.`)) return;
    ['customers', 'pricing', 'notes'].forEach((n) => store.remove(n, c.id));
    const u = userForCustomer(c.id); if (u) store.remove('users', u.id);
    state.custId = null; state.editing = false; render();
  },
  // Invite links (no email needed up front)
  inviteCustomer(el) { makeInvite('customer', el.dataset.cid); },
  newInvite(el) { makeInvite(el.dataset.role); },
  resendInvite(el) { const i = state.invites.find((x) => x.id === el.dataset.id); if (i) sendInvite(i); },
  labelInvite(el) {
    const i = state.invites.find((x) => x.id === el.dataset.id); if (!i) return;
    const ans = prompt('Who is this invite for?', i.label || ''); if (ans === null) return;
    store.update('invites', i.id, { label: ans.trim() }); toast(ans.trim() ? 'Named' : 'Name cleared');
  },
  cancelInvite(el) { if (!confirm('Cancel this invite link? It will stop working.')) return; store.remove('invites', el.dataset.id); toast('Invite cancelled'); },
  reinvite(el) {
    const u = state.users.find((x) => x.id === el.dataset.email); const c = u?.customerId && cust(u.customerId);
    const tpl = u.role === 'crew' ? welcomeTpl('welcomeCrew') : welcomeTpl('welcomeCustomer');
    openText('Welcome text', fill(tpl, { first: first(u.name), link: appLink(), email: u.id }), c?.phone);
  },
  async checkUpdate() { await checkForUpdate(); toast(upd.latest === APP_VERSION ? 'You have the newest version' : upd.latest ? 'Update available' : 'Could not check. Are you online?'); },
  async updateNow() {
    try { upd.latest = await fetchLatest(); } catch {}
    if (upd.latest === APP_VERSION) { bannerEl.hidden = true; toast('You have the newest version'); return render(); }
    try { sessionStorage.removeItem('pc_upd_try'); } catch {}
    applyUpdate(upd.latest || APP_VERSION);
  },
  async testAlert() {
    if (store.mode !== 'shared') return toast('Connect Firebase first');
    const to = settings().alertEmail.trim() || state.user.email;
    try { await sendAlert(to, 'Precision Cut: test sign-up email', { Note: 'Sign-up emails are working.' }); toast('Sent to ' + to + '. Check that inbox (and spam).'); }
    catch (e) { console.error(e); toast('Could not send the test email: ' + e.message); }
  },
  removeUser(el) { if (!confirm(`Remove app access for ${el.dataset.email}?`)) return; store.remove('users', el.dataset.email); toast('Access removed'); },
  billSeason(el) {
    const c = cust(el.dataset.cid), y = new Date().getFullYear(), m = new Date().getMonth();
    const season = m >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; // Oct–Mar season; from April on, bill the coming one
    state.sheet = { kind: 'done', cid: c.id, stopId: null, type: 'season', base: num(priceOf(c.id).season), price: String(num(priceOf(c.id).season)), sel: [], desc: `Snow removal - ${season} season`, canDesc: true };
    renderSheet();
  },

  // Money
  async markPaid(el) {
    const v = visitOf(el.dataset.id);
    await store.update('visits', v.id, { paid: true, paidAt: Date.now() });
    toast('Marked paid');
    const s = settings(), c = cust(v.customerId);
    if (s.receiptEnabled && c?.phone) openText('Receipt for ' + first(v.customerName), fill(s.receiptMsg, { first: first(v.customerName), total: money(v.total), date: shortDate(v.date) }), c.phone);
  },
  markUnpaid(el) { store.update('visits', el.dataset.id, { paid: false, paidAt: null }); },
  delVisit(el) {
    const v = visitOf(el.dataset.id);
    if (!confirm(`Delete invoice ${v.invoiceNo} for ${money(v.total)}?`)) return;
    store.remove('visits', v.id);
    if (v.stopId) store.update('stops', v.stopId, { visitId: null });
  },
  addExpense() {
    const amount = num(val('e_amt'));
    if (!amount) return toast('Enter an amount');
    store.add('expenses', { desc: val('e_desc'), category: val('e_cat'), amount, date: val('e_date') || today(), createdAt: Date.now() });
    toast('Expense added');
  },
  delExpense(el) { if (confirm('Delete this expense?')) store.remove('expenses', el.dataset.id); },
  exportCsv() {
    const rows = [['Type', 'Date', 'Who / What', 'Category', 'Amount', 'Invoice', 'Paid on']];
    state.visits.forEach((v) => rows.push(['Income', v.date, v.customerName, v.desc || 'Lawn mowing', v.total, v.invoiceNo, v.paidAt ? ymd(new Date(v.paidAt)) : 'UNPAID']));
    state.expenses.forEach((e) => rows.push(['Expense', e.date, e.desc, e.category, -num(e.amount), '', '']));
    download(`precision-cut-money-${today()}.csv`, rows.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  },

  // Quotes
  quoteAddon(el) {
    const id = el.dataset.id;
    redrawQuoteForm(() => { state.quoteSel = state.quoteSel.includes(id) ? state.quoteSel.filter((x) => x !== id) : state.quoteSel.concat(id); });
  },
  quoteLineAdd() { redrawQuoteForm(() => { state.quoteLines = state.quoteLines.concat({ d: '', a: '' }); }); },
  quoteLineDel(el) {
    const i = +el.dataset.i;
    redrawQuoteForm(() => { state.quoteLines = state.quoteLines.filter((_, k) => k !== i); if (!state.quoteLines.length) state.quoteLines = [{ d: '', a: '' }]; });
  },
  createQuote() {
    const d = quoteData(); if (!d.name) return toast('Name is needed');
    const id = store.add('quotes', { ...d, date: today(), number: String(Date.now()).slice(-5), status: 'Draft', createdAt: Date.now() });
    resetQuoteForm(); state.quoteId = id; render(); scrollTo(0, 0);
  },
  editQuote(el) {
    const q = state.quotes.find((x) => x.id === el.dataset.id);
    // Saved add-ons that still match go back to chips; everything else becomes a custom item.
    const lines = q.addons || []; state.quoteSel = []; state.quoteLines = [];
    lines.forEach((a) => {
      const m = !a.custom && state.addons.find((x) => x.name === a.name && num(x.price) === a.price);
      if (m) state.quoteSel.push(m.id); else state.quoteLines.push({ d: a.name, a: String(a.price || '') });
    });
    if (!state.quoteLines.length) state.quoteLines = [{ d: '', a: '' }];
    state.quoteEdit = true; render(); scrollTo(0, 0);
  },
  saveQuote(el) {
    const d = quoteData(); if (!d.name) return toast('Name is needed');
    store.update('quotes', el.dataset.id, d);
    resetQuoteForm(); toast('Quote saved'); render(); scrollTo(0, 0);
  },
  cancelQuoteEdit() { resetQuoteForm(); render(); },
  openQuote(el) { state.quoteId = el.dataset.id; render(); scrollTo(0, 0); },
  quoteBack() { state.quoteId = null; resetQuoteForm(); render(); },
  async sendQuote(el) {
    const q = state.quotes.find((x) => x.id === el.dataset.id), s = settings();
    await run(async () => { if (await sharePdf(await quoteFile(q), fill(s.quoteMsg, { first: first(q.name), phone: s.businessPhone }), q.phone)) store.update('quotes', q.id, { status: 'Sent' }); });
  },
  quoteToCustomer(el) {
    const q = state.quotes.find((x) => x.id === el.dataset.id);
    const plan = { Weekly: 'weekly', 'Every 2 weeks': 'biweekly' }[q.freq] || 'oncall';
    const id = store.add('customers', { name: q.name, phone: q.phone, address: q.address, email: '', deck: '', active: true, grass: !!q.grassPrice, grassPlan: plan, snow: !!q.snowPrice, snowPlan: q.snowPlan, createdAt: Date.now() });
    store.set('pricing', id, { grass: q.grassPrice || 0, snow: q.snowPlan === 'perSnow' ? q.snowPrice || 0 : 0, season: q.snowPlan === 'seasonal' ? q.snowPrice || 0 : 0 });
    store.set('notes', id, { text: q.notes || '' });
    store.update('quotes', q.id, { status: 'Accepted' });
    if (store.mode === 'local') syncDemoCustomers();
    state.tab = 'customers'; state.custId = id; state.quoteId = null; toast('Customer added'); render();
  },
  delQuote(el) { if (!confirm('Delete this quote?')) return; store.remove('quotes', el.dataset.id); state.quoteId = null; render(); },

  // Settings
  addAddon() { const name = val('a_name').trim(); if (!name) return toast('Give the add-on a name'); store.add('addons', { name, price: num(val('a_price')) }); toast('Add-on created'); },
  delAddon(el) { store.remove('addons', el.dataset.id); },
  removeZelleQr() { store.update('settings', 'main', { zelleQr: '' }); },
  addCrew() {
    const name = val('u_name').trim(), email = val('u_email').trim().toLowerCase();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a name and a valid email');
    store.set('users', email, { name, role: 'crew' });
    openText('Welcome text for ' + first(name), fill(settings().welcomeCrew, { first: first(name), link: appLink() + '#invite=' + encodeURIComponent(email), email }), '');
  },
  copyLink() { navigator.clipboard?.writeText(state.sheet.link).then(() => toast('Link copied'), () => toast('Couldn’t copy. Use Share instead.')); },
  shareText() { const b = state.sheet.body; if (navigator.share) navigator.share({ text: b }).catch(() => {}); else navigator.clipboard?.writeText(b).then(() => toast('Copied')); },
  backup() {
    const data = {}; ['customers', 'notes', 'pricing', 'stops', 'visits', 'requests', 'expenses', 'addons', 'quotes', 'users'].forEach((k) => { data[k] = state[k]; });
    data.settings = state.settingsDoc; data.exportedAt = new Date().toISOString();
    download(`precision-cut-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
  },
  setLock() { state.sheet = { kind: 'setLock' }; renderSheet(); },
  async saveLock() {
    const pin = val('lk_pin'); if (!/^\d{4}$/.test(pin)) return toast('Use exactly 4 digits');
    localStorage.setItem(LOCK_KEY, JSON.stringify({ hash: await hashPin(pin), minutes: Number(val('lk_min')) }));
    state.sheet = null; renderSheet(); toast('Passcode lock on'); render();
  },
  clearLock() { localStorage.removeItem(LOCK_KEY); toast('Passcode lock off'); render(); },
  async pinKey(el) {
    if (el.dataset.v === 'del') { pinEntry = pinEntry.slice(0, -1); return renderLock(); }
    if (pinEntry.length >= 4) return;
    pinEntry += el.dataset.v; pinErr = ''; renderLock();
    if (pinEntry.length < 4) return;
    const ok = (await hashPin(pinEntry)) === lockCfg()?.hash; pinEntry = '';
    if (ok) { state.locked = false; lastActive = Date.now(); render(); } else { pinErr = 'Wrong passcode'; renderLock(); }
  },

  // Customer actions
  custSkip() {
    const c = state.customers[0], wk = weekStart(new Date());
    if (!confirm('Skip your mow this week? This uses your 1 free skip for the month.')) return;
    const existing = state.stops.find((x) => x.id === `${wk}_${c.id}`);
    store.set('stops', `${wk}_${c.id}`, { ...(existing ? Object.fromEntries(Object.entries(existing).filter(([k]) => k !== 'id')) : { weekId: wk, type: 'grass' }), customerId: c.id, status: 'skipped', skippedBy: 'customer', skippedAt: Date.now() });
    toast('Skipped. See you next time!');
  },
  custRequest(el) {
    const c = state.customers[0], s = settings(), type = el.dataset.type;
    const text = type === 'message' ? val('m_text').trim() : '';
    if (type === 'message' && !text) return toast('Type a message first');
    store.add('requests', { customerId: c.id, customerName: c.name, type, text, at: Date.now(), status: 'open' });
    if (type === 'message') { document.getElementById('m_text').value = ''; toast('Sent to Jace'); return; }
    const body = type === 'snow' ? `Hi Jace, it's ${c.name} at ${c.address}. Could you clear my snow? (requested in the app)` : `Hi Jace, it's ${c.name} at ${c.address}. Could you mow my lawn this week? (requested in the app)`;
    openText(type === 'snow' ? 'Snow removal requested' : 'Mow requested', body, s.businessPhone);
    state.sheet.title = (type === 'snow' ? 'Snow removal requested!' : 'Mow requested!') + ' Want to text Jace too?';
    renderSheet();
  },
  async custPdf(el) { const v = visitOf(el.dataset.id); await run(async () => { const f = await invoiceFile(v); const url = URL.createObjectURL(f); window.open(url, '_blank') || (location.href = url); }); },
  custPaid(el) { if (!confirm('Let Jace know you sent the payment?')) return; store.update('visits', el.dataset.id, { customerSaysPaid: true, customerSaysPaidAt: Date.now() }); toast('Thanks! Jace will confirm.'); },
  copyZelle() { navigator.clipboard?.writeText(settings().zelle).then(() => toast('Copied Zelle number')); },
  togglePaid() { state.showPaidHistory = !state.showPaidHistory; render(); },

  // Auth
  async google() { await authRun(() => store.signInGoogle()); },
  async signIn() { await authRun(() => store.signIn(val('au_email').trim(), val('au_pw'))); },
  async signUp() { await authRun(() => store.signUp(val('au_email').trim().toLowerCase(), val('au_pw'))); },
  authMode() { state.authModeSet = true; state.authMode = state.authMode === 'up' ? 'in' : 'up'; state.authMsg = ''; render(); },
  async joinApp() {
    const name = val('join_name').trim();
    if (!name) { state.authMsg = 'Type your name first.'; return render(); }
    try {
      state.authMsg = '';
      await store.redeemInvite(joinCode(), state.user.email, name);
      localStorage.removeItem(JOIN_KEY);
      await checkAccess();
      if (store.mode === 'shared') notifyJoined(name, state.user.email);
    } catch (e) {
      console.error(e);
      localStorage.removeItem(JOIN_KEY);
      state.authMsg = e.code === 'invite/used' ? e.message : 'That invite link didn’t work. Ask Jace for a new one.';
      checkAccess();
    }
  },
  async resetPw() { const e = val('au_email').trim(); if (!e) { state.authMsg = 'Type your email first.'; return render(); } await authRun(async () => { await store.resetPassword(e); state.authMsg = 'Password reset email sent.'; }); },
  async claimSetup() { await authRun(async () => { await store.claimSetup(state.user.email, val('setup_name').trim() || 'Jace'); await checkAccess(); }); },
  async signOut() { localStorage.removeItem('pc_demo_as'); state.locked = false; await store.signOut(); if (store.mode === 'local') location.reload(); },
};
async function run(fn) { try { await fn(); } catch (e) { console.error(e); toast(e.message || 'Something went wrong'); } }
async function authRun(fn) {
  try { state.authMsg = ''; await fn(); }
  catch (e) { state.authMsg = ({ 'auth/invalid-credential': 'Wrong email or password.', 'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/weak-password': 'Use at least 6 characters.', 'auth/invalid-email': 'That email doesn’t look right.', 'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.' })[e.code] || e.message; }
  render();
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// Demo: keep a list of customers so the "view as" switcher works for every role.
function syncDemoCustomers() {
  setTimeout(() => {
    localStorage.setItem('pc_demo_custs', JSON.stringify(state.customers.map((c) => ({ id: c.id, name: c.name }))));
    state.customers.forEach((c) => store.set('users', `cust-${c.id}@demo`, { name: c.name, role: 'customer', customerId: c.id }));
  }, 300);
}

/* ---------- settings: save as you type ---------- */
let settingTimer, cmsgTimer;
// Saved messages: read every name/text box on screen so quick edits to two boxes both stick.
function saveCustomMsgs() {
  const list = customMsgs().map((m) => {
    const get = (f) => document.querySelector(`[data-cmsg="${CSS.escape(m.id)}"][data-field="${f}"]`)?.value;
    return { ...m, title: get('title') ?? m.title, body: get('body') ?? m.body };
  });
  store.update('settings', 'main', { customMsgs: list });
}
async function saveSetting(el) {
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.setting === 'skipDay') v = Number(v);
  await store.update('settings', 'main', { [el.dataset.setting]: v });
}

/* ---------- events ---------- */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  if (el.classList.contains('shade') && ev.target.closest('[data-stop]')) return;
  if (el.tagName !== 'A') ev.preventDefault();
  A[el.dataset.a]?.(el);
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.input === 'search') {
    state.q = el.value; const pos = el.selectionStart; render();
    const s = document.getElementById('search'); s.focus(); s.setSelectionRange(pos, pos);
  } else if (el.dataset.input === 'sheetPrice') {
    state.sheet.price = el.value;
    document.getElementById('sh_total').textContent = money(num(el.value) + state.sheet.sel.reduce((a, id) => a + num((state.addons.find((x) => x.id === id) || {}).price), 0));
  } else if (el.dataset.cmsg) {
    clearTimeout(cmsgTimer); cmsgTimer = setTimeout(saveCustomMsgs, 600);
  } else if (el.dataset.setting && el.tagName !== 'SELECT' && el.type !== 'checkbox') {
    clearTimeout(settingTimer); settingTimer = setTimeout(() => saveSetting(el), 600);
  }
});
document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.setting && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'time')) return saveSetting(el);
  const k = el.dataset.change;
  if (k === 'setDay') store.update('stops', el.dataset.id, { customerId: el.dataset.cid, weekId: state.week, type: 'grass', status: stopOf(el.dataset.id)?.status || 'scheduled', day: el.value === '' ? null : Number(el.value) });
  if (k === 'composeTo') { const sh = state.sheet; sh.label = document.getElementById('cm_label')?.value || sh.label; sh.cid = el.value; sh.body = fillMsg(sh.tpl, cust(sh.cid), sh.pending); renderSheet(); }
  if (k === 'bulkSkip') { state.sheet.skipMembers = el.checked; renderSheet(); }
  if (k === 'snowDate') { state.snowDate = el.value || today(); render(); }
  if (k === 'demoAs') { localStorage.setItem('pc_demo_as', el.value); location.reload(); }
  if (k === 'zelleQr' && el.files[0]) {
    const img = await createImageBitmap(el.files[0]);
    const scale = Math.min(1, 400 / Math.max(img.width, img.height));
    const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    store.update('settings', 'main', { zelleQr: cv.toDataURL('image/png') }); toast('Zelle QR saved');
  }
});

// Remember which Settings folds are open so a redraw doesn't close them.
document.addEventListener('toggle', (ev) => {
  const k = ev.target.dataset?.fold;
  if (k) ev.target.open ? state.openFolds.add(k) : state.openFolds.delete(k);
}, true);


/* ---------- updates ---------- */
// The site's version.json says which version is live. If this phone is running an older copy,
// reload onto the new one (a new ?v= address skips anything the phone has saved).
const upd = { latest: '', checking: false, checkedAt: 0 };
const busy = () => !!state.sheet || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
async function fetchLatest() {
  const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
  return String((await r.json()).version || '');
}
function applyUpdate(v) {
  try { sessionStorage.setItem('pc_upd_try', v); } catch {}
  location.replace(location.pathname + '?v=' + encodeURIComponent(v) + location.hash);
}
async function checkForUpdate({ auto = false } = {}) {
  if (upd.checking) return;
  upd.checking = true;
  try {
    upd.latest = await fetchLatest(); upd.checkedAt = Date.now();
    if (upd.latest && upd.latest !== APP_VERSION) {
      let tried = ''; try { tried = sessionStorage.getItem('pc_upd_try') || ''; } catch {}
      if (auto && !busy() && tried !== upd.latest) return applyUpdate(upd.latest);
      bannerEl.innerHTML = `A new version of the app is ready. <button class="link" data-a="updateNow" style="color:inherit;text-decoration:underline">Tap to update</button>`;
      bannerEl.style.background = '#183723'; bannerEl.hidden = false;
    }
  } catch (e) { console.warn('Update check failed', e); }
  finally { upd.checking = false; if (state.tab === 'settings') scheduleRender(); }
}
// Clean the ?v= off the address after an update so links and the home screen stay tidy.
if (/[?&]v=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - upd.checkedAt > 60000) checkForUpdate({ auto: true });
});

/* ---------- start ---------- */
// The QR tool also loads in the background: redraw once it arrives so the Venmo QR shows.
if (!window.qrcode) document.getElementById('qrjs')?.addEventListener('load', () => { if (store && state.user) scheduleRender(); });
function renderStartFail() {
  app.innerHTML = `<div class="auth"><div class="card"><img src="logo-full.jpg" alt="Precision Cut logo" class="logo">
    <p>The app couldn’t connect. Check your signal or Wi-Fi, then try again.</p>
    <button class="btn btn-primary" onclick="location.reload()">Try again</button></div></div>`;
}
(async function start() {
  checkForUpdate({ auto: true });
  // On a weak signal, say so instead of sitting on "Loading…" forever.
  const slow = setTimeout(() => { if (!store) app.innerHTML = '<p class="center muted" style="padding:40px">Still loading… weak signal? <button class="link" onclick="location.reload()">Try again</button></p>'; }, 12000);
  try { store = await createStore(showError); }
  catch (e) { console.error(e); clearTimeout(slow); return renderStartFail(); }
  clearTimeout(slow);
  store.onAuth((u) => {
    unsubs.forEach((x) => typeof x === 'function' && x()); unsubs = [];
    state.user = u; state.account = null; state.access = null; state.need = null;
    if (u) checkAccess(); else render();
  });
})();
