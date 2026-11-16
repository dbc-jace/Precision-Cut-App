import { createStore, newId } from './store.js?v=2026.11.16.17';

const APP_VERSION = '2026.11.16.17'; // bump-version.sh keeps this, version.json and the ?v= tags in step
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
const CARD_FEE = 0.033; // Square's online card rate; customers can choose to cover it
const withFee = (total) => Math.round(num(total) * 100 * (1 + CARD_FEE)) / 100;
const fill = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const appLink = () => location.origin + location.pathname;
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
// Every phone number in a field like "847-774-4491, 312-925-4888".
const allPhones = (p) => (String(p || '').match(/\+?1?[\s.(-]*\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}/g) || []).map(digits10);
// One number opens a normal text; several open a group text (iPhone and Android write it differently).
const smsHref = (phone, body) => {
  let nums = allPhones(phone); if (!nums.length && digits10(phone)) nums = [digits10(phone)];
  const b = encodeURIComponent(body || '');
  if (nums.length > 1) return isApple ? `sms:/open?addresses=${nums.map((n) => '+1' + n).join(',')}&body=${b}` : `sms:${nums.map((n) => '+1' + n).join(',')}?body=${b}`;
  return `sms:${nums.length ? '+1' + nums[0] : ''}${isApple ? '&' : '?'}body=${b}`;
};
// Who a customer's texts go to: the first number, or all of them when "Text all numbers" is on.
const textTo = (c) => (c?.phone ? (c.textAll ? allPhones(c.phone).join(', ') : firstPhone(c.phone)) : '');

/* ---------- dates (weeks start Monday) ---------- */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Addresses: street in "address", plus city, state and ZIP. Older records have it all in one line; split it when editing.
const cityLine = (o) => [o?.city, [o?.state, o?.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const fullAddr = (o) => [o?.address, cityLine(o)].filter(Boolean).join(', ');
const addrLines = (o) => [o?.address, cityLine(o)].filter(Boolean);
function splitAddr(o) {
  if (!o || o.city || o.state || o.zip) return { address: o?.address || '', city: o?.city || '', state: o?.state || '', zip: o?.zip || '' };
  const m = String(o.address || '').match(/^(.+?),\s*([^,]+?),?\s+([A-Za-z]{2})\.?\s*(\d{5}(?:-\d{4})?)?\s*$/);
  return m ? { address: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zip: m[4] || '' } : { address: o.address || '', city: '', state: '', zip: '' };
}
// New addresses start with the city, state and ZIP most customers have.
function usualPlace() {
  const n = {}; state.customers.forEach((c) => { const a = splitAddr(c); if (a.city) { const k = JSON.stringify([a.city, a.state, a.zip]); n[k] = (n[k] || 0) + 1; } });
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  const [city, st, zip] = top ? JSON.parse(top[0]) : ['', 'IL', ''];
  return { city, state: st || 'IL', zip };
}
const addrFields = (pre, o) => { const a = o && (o.address || o.city) ? splitAddr(o) : { address: '', ...usualPlace() };
  return `<label class="f"><span class="lbl">Street number and name</span><input class="inp" id="${pre}_address" value="${esc(a.address)}" placeholder="123 Oak St" autocomplete="street-address"></label>
    <div class="addr3"><label class="f"><span class="lbl">City</span><input class="inp" id="${pre}_city" value="${esc(a.city)}" autocomplete="address-level2"></label>
      <label class="f"><span class="lbl">State</span><input class="inp" id="${pre}_state" value="${esc(a.state)}" maxlength="2" autocapitalize="characters" autocomplete="address-level1"></label>
      <label class="f"><span class="lbl">ZIP</span><input class="inp" id="${pre}_zip" value="${esc(a.zip)}" inputmode="numeric" maxlength="10" autocomplete="postal-code"></label></div>`; };
const addrData = (pre) => ({ address: val(pre + '_address').trim(), city: val(pre + '_city').trim(), state: val(pre + '_state').trim().toUpperCase(), zip: val(pre + '_zip').trim() });
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
  businessName: 'Precision Cut Lawns', businessPhone: '224-334-8532', businessEmail: 'jace.precisioncutlawns@gmail.com', businessAddress: '23510 N Cottage Rd, Hawthorn Woods, IL 60047', website: 'precisioncutlawns.org', zelle: '224-334-8532', venmo: '', zelleQr: '',
  skipDay: 3, skipTime: '18:00',
  reminderMsg: 'Hi {first}, it\'s Jace with Precision Cut Lawns. Your lawn is scheduled to be mowed this week ({week}). Need to skip? Tap here by {deadline}: {link}',
  oncallMsg: 'Hi, it\'s Jace with Precision Cut Lawns. Would you like your grass cut today?',
  invoiceMsg: 'Hi {first}, thanks for choosing Precision Cut Lawns! Your statement is attached. Balance due: {total}.',
  paidMsg: 'Hi {first}, thank you for your payment of {total}! Your updated statement is attached. Thanks for choosing Precision Cut Lawns!',
  receiptEnabled: false,
  squareOn: false,
  snowIncluded: 3, snowPerInch: 10, // per-snow price covers this many inches; each inch over adds this much // Card / Apple Pay through Square (needs the Square setup done first)
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
  customers: [], notes: [], pricing: [], stops: [], visits: [], requests: [], expenses: [], addons: [], quotes: [], users: [], invites: [], pending: [], payments: [], settingsDoc: null,
  waiting: null,
  tab: 'route', routeSeg: 'grass', week: weekStart(new Date()), snowDate: today(),
  custId: null, editing: false, q: '', custSeg: 'all', moneyTab: 'overview', moneyPeriod: 'month', quoteId: null, quoteSel: [], quoteLines: [{ d: '', a: '' }], quoteEdit: false, openFolds: new Set(),
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
// Phones add stray spaces, invisible characters, commas for periods and capital letters. Clean them up first.
const cleanEmail = (v) => String(v || '').normalize('NFKC').replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, '')
  .replace(/[,;]/g, '.').replace(/^mailto:/i, '').replace(/\.+$/, '').toLowerCase();
const validEmail = (e) => /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(e) && e.length <= 254 && !/\.\./.test(e);
function emailProblem(e, typed = e) {
  const t = String(typed).trim();
  if (!e) return 'Type your email address first.';
  if (!e.includes('@')) return `“${t}” is missing the @. It should look like name@gmail.com.`;
  if (!validEmail(e)) return `“${t}” isn’t a complete email address. It should look like name@gmail.com.`;
  return '';
}
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
// Everyone who logs in to this customer account (e.g. husband and wife each with their own login).
const usersForCustomer = (cid) => state.users.filter((u) => u.customerId === cid && !u.id.endsWith('@demo'));
const bothNames = (c) => c.name2 ? `${c.name} & ${c.name2}` : c.name;

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
  const title = data.title || (kind === 'quote' ? 'QUOTE' : 'INVOICE');
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
  // Business address, small, under the phone and email: street on one line, city/state/ZIP on the next.
  const addr = String(s.businessAddress || '').trim(), addrLines = addr ? addr.replace(/,\s*/, '\n').split('\n') : [];
  font('normal', 8.5, muted); addrLines.forEach((l, i) => doc.text(l.trim(), L, 142 + contact.length * 13 + i * 11));

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
  let y = Math.max(190, 142 + contact.length * 13 + addrLines.length * 11 + 22);
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
    font('normal', 11); doc.text(dl, L + 14, y + 18); doc.text(l.amount < 0 ? '-' + money2(-l.amount) : money2(l.amount), R - 14, y + 18, { align: 'right' });
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
    const card = !!s.squareOn, rows = 1 + (s.venmo ? 1 : 0) + (card ? 1 : 0);
    const h = Math.max(qr ? 104 : 0, 42 + rows * 18);
    if (y + h > 720) { footer(); doc.addPage(); topBand(); y = 40; }
    doc.setFillColor(...pale); doc.roundedRect(L, y, W, h, 6, 6, 'F');
    font('bold', 8.5, lime); doc.text('HOW TO PAY', L + 16, y + 20, { charSpace: 0.8 });
    let ly = y + 40;
    if (card) { font('normal', 11); doc.text('Card or Apple Pay: tap the link in my text, or pay in your account', L + 16, ly); ly += 18; }
    font('normal', 11); doc.text(`Zelle: send ${money2(data.total)} to ${s.zelle}`, L + 16, ly); ly += 18;
    if (s.venmo) { font('normal', 11, forest); doc.textWithLink(`Venmo: ${s.venmo}`, L + 16, ly, { url: s.venmo.startsWith('http') ? s.venmo : 'https://' + s.venmo }); }
    if (qr) { doc.addImage(qr, /png/i.test(qr.slice(0, 20)) ? 'PNG' : 'JPEG', R - 16 - 80, y + 12, 80, 80); font('normal', 7.5, muted); doc.text('Scan with Zelle', R - 56, y + 100, { align: 'center' }); }
    y += h + 26;
  }
  if (data.notes) {
    const nl = doc.splitTextToSize(data.notes, W - 32);
    if (y + 36 + nl.length * 14 > 720) { footer(); doc.addPage(); topBand(); y = 40; }
    font('bold', 8.5, lime); doc.text('NOTES', L, y, { charSpace: 0.8 });
    font('normal', 10.5); doc.text(nl, L, y + 16); y += 24 + nl.length * 14;
  }
  if (kind === 'quote' && data.acceptUrl) { if (y > 690) { footer(); doc.addPage(); topBand(); y = 40; } font('bold', 13, forest); doc.text('Thank you for considering Precision Cut Lawns!', 306, Math.max(y + 10, 640), { align: 'center' }); y = Math.max(y + 10, 640); }
  else if (y < 712) {
    font('bold', 13, forest);
    doc.text(kind === 'quote' ? 'Thank you for considering Precision Cut Lawns!' : data.paid ? 'Paid in full. Thank you!' : 'Thank you for your business!', 306, Math.max(y + 10, 640), { align: 'center' });
    if (kind === 'quote' && !data.acceptUrl) { font('normal', 10, muted); doc.text(`To accept, reply to my text or call ${s.businessPhone}.`, 306, Math.max(y + 10, 640) + 16, { align: 'center' }); }
  }
  if (kind === 'quote' && data.acceptUrl) {
    // A big green "Accept this quote" button that opens the customer's Accept page.
    let by = Math.max(y + 34, 664);
    if (by + 56 > 736) { footer(); doc.addPage(); topBand(); by = 80; }
    const bw = 220, bx = 306 - bw / 2;
    doc.setFillColor(...lime); doc.roundedRect(bx, by, bw, 34, 6, 6, 'F');
    font('bold', 13, [255, 255, 255]); doc.text('Accept this quote', 306, by + 22, { align: 'center' });
    doc.link(bx, by, bw, 34, { url: data.acceptUrl });
    font('normal', 8.5, muted); doc.text(`Or reply to my text or call ${s.businessPhone}.`, 306, by + 50, { align: 'center' });
  }
  footer();
  const pages = doc.getNumberOfPages();
  if (pages > 1) for (let i = 1; i <= pages; i++) { doc.setPage(i); font('normal', 8, muted); doc.text(`Page ${i} of ${pages}`, R, 30, { align: 'right' }); }
  return doc.output('blob');
}
// What a charge was for: Jace's own wording wins; plain mowing says the customer's plan.
const GRASS_LABEL = { weekly: 'Weekly lawn care', biweekly: 'Every-2-weeks lawn care', oncall: 'On-call lawn care' };
const grassLabel = (c) => GRASS_LABEL[c?.grassPlan] || 'Lawn care';
function chargeLabel(v) {
  if (v.desc && v.desc !== 'Lawn mowing') return v.desc;
  if (v.type === 'snow') return 'Snow removal';
  return grassLabel(cust(v.customerId));
}
// How a payment came in.
const PAID_LABEL = { square: 'Card payment', cash: 'Cash payment', 'zelle-venmo': 'Zelle/Venmo payment', zelle: 'Zelle payment', venmo: 'Venmo payment', check: 'Check payment', credit: 'Paid from credit' };
const paidLabel = (via) => PAID_LABEL[via] || 'Payment';
// Running balance for one customer: every visit (+) and payment (−), oldest first, with the balance after each.
// Payments Jace records by hand (cash for a few weeks, a month up front…). They pay off the oldest unpaid
// visits; whatever's left is credit that pays new visits as they're added (whole visits only).
const paymentsOf = (cid) => (state.payments || []).filter((p) => p.customerId === cid);
function creditOf(cid, payments = paymentsOf(cid), visits = state.visits.filter((v) => v.customerId === cid)) {
  const paidIn = payments.reduce((a, p) => a + num(p.amount), 0);
  const used = visits.filter((v) => v.paid && v.creditFrom).reduce((a, v) => a + num(v.total), 0);
  return Math.round((paidIn - used) * 100) / 100;
}
async function applyCredit(cid, { payments = paymentsOf(cid), visits = state.visits.filter((v) => v.customerId === cid) } = {}) {
  let credit = creditOf(cid, payments, visits), n = 0;
  const owed = visits.filter((v) => !v.paid).sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  for (const v of owed) {
    if (num(v.total) > credit + 0.004) break;
    credit -= num(v.total); n++;
    await store.update('visits', v.id, { paid: true, paidAt: Date.now(), paidVia: 'credit', creditFrom: true });
  }
  return n;
}
function ledgerFor(cid) {
  const vs = state.visits.filter((v) => v.customerId === cid);
  const rows = vs.map((v) => ({ date: v.date, sort: `${v.date}0${v.createdAt || 0}`, desc: chargeLabel(v), amt: num(v.total), id: v.id }));
  const groups = {};
  vs.filter((v) => v.paid && v.paidAt && !v.creditFrom).forEach((v) => {
    const g = (groups[v.payGroup || `${v.paidAt}_${v.paidVia || ''}`] ??= { paidAt: v.paidAt, via: v.paidVia, amt: 0, fee: 0, t: 0, vids: [] });
    g.vids.push(v.id); g.amt += num(v.total); g.fee += num(v.cardFeePaid);
    // When it was recorded (a job entered as paid for a date may carry that day's noon).
    g.t = Math.max(g.t, v.paidAt > Date.now() ? v.createdAt || 0 : v.paidAt);
  });
  Object.values(groups).forEach((g) => { const d = ymd(new Date(g.paidAt)); rows.push({ date: d, sort: `${d}1${g.paidAt}`, desc: paidLabel(g.via), amt: -g.amt, fee: g.fee, pay: true, t: g.t, vids: g.vids }); });
  paymentsOf(cid).forEach((p) => rows.push({ date: p.date, sort: `${p.date}1${p.at || 0}`, desc: paidLabel(p.via) + (p.note ? ` (${p.note})` : ''), amt: -num(p.amount), pay: true, paymentId: p.id, t: p.at || 0 }));
  rows.sort((a, b) => a.sort.localeCompare(b.sort));
  let bal = 0; rows.forEach((r) => { bal = Math.round((bal + r.amt) * 100) / 100; r.bal = bal; });
  const unpaid = vs.filter((v) => !v.paid).sort((a, b) => a.date.localeCompare(b.date));
  const credit = Math.max(0, creditOf(cid, paymentsOf(cid), vs));
  return { rows, unpaid, credit, owe: Math.round(unpaid.reduce((a, v) => a + num(v.total), 0) * 100) / 100 };
}
const ledgerHtml = (rows, admin) => `<div class="list">${rows.map((r) => `<div class="line"><div class="grow"><div>${shortDate(r.date)} · ${esc(r.desc)}${r.fee ? ` <span class="muted small">(+${money(r.fee)} fee covered)</span>` : ''}</div>
    <div class="muted small">${r.bal < -0.004 ? 'Credit ' + money(-r.bal) : 'Balance ' + money(r.bal)}</div></div>
    <b style="${r.pay ? 'color:#1D4A22' : ''}">${r.pay ? '−' : '+'}${money(Math.abs(r.amt))}</b>${admin && !r.carry ? `<button class="link danger" style="margin-left:10px;min-height:32px" aria-label="Delete this line"
      ${r.id ? `data-a="delVisit" data-id="${r.id}"` : r.paymentId ? `data-a="delPayment" data-id="${r.paymentId}"` : `data-a="undoPayGroup" data-ids="${(r.vids || []).join(',')}"`}>✕</button>` : ''}</div>`).join('')}</div>`;
const visitLines = (v) => [{ desc: chargeLabel(v), amount: v.price }, ...(v.addons || []).map((a) => ({ desc: a.name, amount: a.price }))];
// One running statement per customer (not a PDF per invoice): same file name every time, so it replaces the old one.
// It starts Jan 1 each year (or the day Jace starts a fresh statement); anything owed from before carries over as one line.
// Statements: one per year for each customer (Jan 1 to Dec 31). Jace can also start a separate one on any day
// (customer.statementBreaks). Old ones are never lost: each is rebuilt from the records whenever it's opened.
// Anything owed from before a statement carries over as one line.
const addDays = (d, n) => { const x = parseYmd(d); x.setDate(x.getDate() + n); return ymd(x); };
const statementBreaks = (c) => [...new Set([...(Array.isArray(c?.statementBreaks) ? c.statementBreaks : []), ...(c?.statementFrom ? [c.statementFrom] : [])])].filter(Boolean).sort();
function statementPeriods(cid) {
  const c = cust(cid), now = today(), rows = ledgerFor(cid).rows;
  const firstYear = Math.min(Number(now.slice(0, 4)), ...rows.map((r) => Number(r.date.slice(0, 4))));
  const starts = new Set(statementBreaks(c).filter((d) => d <= now));
  for (let y = firstYear; y <= Number(now.slice(0, 4)); y++) starts.add(`${y}-01-01`);
  const list = [...starts].sort().map((start, i, arr) => {
    const end = i + 1 < arr.length ? addDays(arr[i + 1], -1) : `${start.slice(0, 4)}-12-31`;
    return { start, end: end.slice(0, 4) !== start.slice(0, 4) ? `${start.slice(0, 4)}-12-31` : end };
  });
  return list.map((p) => ({ ...p, current: p.start <= now && now <= p.end, whole: p.start.endsWith('-01-01') && p.end.endsWith('-12-31') }))
    .filter((p) => p.current || rows.some((r) => r.date >= p.start && r.date <= p.end)).reverse();
}
const currentPeriod = (cid) => statementPeriods(cid).find((p) => p.current) || statementPeriods(cid)[0];
const periodName = (p) => p.whole ? p.start.slice(0, 4) : `${p.start.slice(0, 4)}: ${shortDate(p.start)} to ${p.current ? 'today' : shortDate(p.end)}`;
const statementStart = (c) => currentPeriod(c.id).start;
function statementRows(cid, p = currentPeriod(cid)) {
  const L = ledgerFor(cid);
  const before = L.rows.filter((r) => r.date < p.start), rows = L.rows.filter((r) => r.date >= p.start && r.date <= p.end);
  const opening = before.length ? before[before.length - 1].bal : 0;
  if (Math.abs(opening) > 0.004) {
    // Say where it came from: last year's statement, or the statement just before this one.
    const prevEnd = addDays(p.start, -1), brk = statementBreaks(cust(cid)).filter((d) => d < p.start).pop() || `${prevEnd.slice(0, 4)}-01-01`;
    const prevStart = brk.slice(0, 4) === prevEnd.slice(0, 4) ? brk : `${prevEnd.slice(0, 4)}-01-01`;
    const from = prevStart.endsWith('-01-01') && prevEnd.endsWith('-12-31') ? `${prevEnd.slice(0, 4)} statement` : `previous statement (${shortDate(prevStart)} to ${shortDate(prevEnd)}, ${prevEnd.slice(0, 4)})`;
    rows.unshift({ date: p.start, desc: `${opening > 0 ? 'Previous balance' : 'Previous credit'} from ${from}`, amt: opening, bal: opening, pay: opening < 0, carry: true });
  }
  return { ...L, start: p.start, end: p.end, period: p, rows, closing: rows.length ? rows[rows.length - 1].bal : opening };
}
async function statementFile(cid, p = currentPeriod(cid)) {
  const c = cust(cid) || {}, s = settings(), st = statementRows(cid, p);
  const bal = st.closing;
  const lines = [];
  st.rows.forEach((r) => {
    const v = r.id && visitOf(r.id);
    if (v) visitLines(v).forEach((l, i) => lines.push({ desc: i === 0 ? `${shortDate(v.date)} · ${l.desc}` : `   + ${l.desc}`, amount: l.amount }));
    else lines.push({ desc: `${shortDate(r.date)} · ${r.desc}${r.fee ? ` (+${money2(r.fee)} card fee covered)` : ''}`, amount: r.amt });
  });
  if (!lines.length) lines.push({ desc: 'No charges yet', amount: 0 });
  const paid = bal <= 0.004;
  const meta = [['Statement date', longDate(today())], ['Covers', `${shortDate(st.start)}, ${st.start.slice(0, 4)} to ${p.current ? 'today' : shortDate(st.end) + ', ' + st.end.slice(0, 4)}`], paid ? ['Status', 'PAID'] : ['Due', 'Upon receipt']];
  const carry = st.rows.find((r) => r.carry);
  if (carry) meta.splice(2, 0, ['Previous balance', (carry.amt < 0 ? '-' : '') + money2(Math.abs(carry.amt))]);
  const blob = await buildPdf('invoice', { title: 'STATEMENT', meta, name: bothNames(c) || c.name, to: [...addrLines(c), c.phone], lines, totalLabel: bal < -0.004 ? 'Credit' : paid ? 'Balance' : 'Balance due', total: Math.abs(bal), paid,
    terms: paid ? (bal < -0.004 ? `You have a ${money2(-bal)} credit for upcoming visits. Thank you!` : 'All paid up. Thank you!') : `Due upon receipt. Pay by ${[...(s.squareOn ? ['card', 'Apple Pay'] : []), 'Zelle', ...(s.venmo ? ['Venmo'] : [])].reduce((t, w, i, arr) => t + (i === 0 ? '' : i === arr.length - 1 ? ' or ' : ', ') + w, '')}.` });
  return new File([blob], `Precision Cut Lawns - ${String(c.name || 'Statement').replace(/[\\/:*?"<>|]/g, '')} ${p.whole ? p.start.slice(0, 4) : `${p.start.slice(0, 4)} from ${shortDate(p.start)}`}.pdf`, { type: 'application/pdf' });
}
// What's on a quote, as lines. Used by the PDF and by the customer's Accept page.
function quoteLinesOf(q) {
  const lines = [];
  if (q.grassPrice) lines.push({ desc: `Lawn mowing - ${String(q.freq || '').toLowerCase()} (per cut)`, amount: q.grassPrice });
  if (q.snowPrice) {
    if (q.snowPlan === 'seasonal') lines.push({ desc: 'Snow removal - full season', amount: q.snowPrice });
    else {
      lines.push({ desc: `Snow removal - per visit, on request (base price, includes up to ${snowIncl()}")`, amount: q.snowPrice });
      if (num(settings().snowPerInch)) lines.push({ desc: `Additional inch over ${snowIncl()}" (per inch, per visit)`, amount: num(settings().snowPerInch), perUnit: true });
    }
  }
  // Custom items are part of the job; picked add-ons are optional extras, listed last and left out of the total.
  (q.addons || []).filter((a) => a.custom).forEach((a) => lines.push({ desc: a.name, amount: a.price }));
  (q.addons || []).filter((a) => !a.custom).forEach((a) => lines.push({ desc: `Optional add-on: ${a.name}`, amount: a.price, optional: true }));
  return lines;
}
const quoteTotal = (lines) => lines.filter((l) => !l.optional && !l.perUnit).reduce((a, l) => a + num(l.amount), 0);
const OPTIONAL_NOTE = 'Optional add-ons are not included in the estimated total. Just let me know which ones you’d like.';
const quoteLink = (q) => appLink() + '#quote=' + q.token;
async function quoteFile(q) {
  const lines = quoteLinesOf(q);
  const total = quoteTotal(lines), hasOpt = lines.some((l) => l.optional);
  const until = parseYmd(q.date); until.setDate(until.getDate() + 30);
  const blob = await buildPdf('quote', { meta: [['Quote #', `Q-${q.number}`], ['Date', longDate(q.date)], ['Valid until', longDate(ymd(until))]], name: q.name, to: [...addrLines(q), q.phone],
    lines, totalLabel: q.grassPrice && q.snowPrice ? '' : 'Estimated total', total, notes: [hasOpt ? OPTIONAL_NOTE : '', q.notes].filter(Boolean).join('\n\n'), acceptUrl: q.token ? quoteLink(q) : '',
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
// The old invoice text had Zelle-only pay instructions built in; how to pay is now added separately.
const OLD_INVOICE_MSG = 'Hi {first}, thanks for choosing Precision Cut Lawns! Your invoice for {total} is attached. Pay by Zelle to {zelle}{venmo}, or in your account: {link}';
// v = the job just billed. Without one (the "Send statement" button), it sends their current balance as is.
async function sendInvoice(v, cid = v?.customerId) {
  const s = settings();
  const c = cust(cid) || {};
  const L = ledgerFor(cid);
  const vars = { first: first(c.name || v?.customerName), zelle: s.zelle, venmo: s.venmo ? ' or Venmo ' + s.venmo : '', link: appLink(), phone: s.businessPhone };
  let text;
  const isPaid = v ? v.paid || L.owe <= 0.004 : L.owe <= 0.004;
  if (!v && isPaid) {
    // Paid up: the paid message, thanking them for their latest payment.
    const lastPay = L.rows.filter((r) => r.pay).sort((a, b) => (a.t || 0) - (b.t || 0)).pop();
    text = lastPay ? fill(s.paidMsg || DEFAULTS.paidMsg, { ...vars, total: money(Math.abs(lastPay.amt)) }) : `Hi ${vars.first}, here’s your statement from Precision Cut Lawns. You’re all paid up. Thank you!`;
    if (L.credit > 0.004) text += `\n\nYou have ${money(L.credit)} credit toward upcoming visits.`;
  } else if (isPaid) {
    // Paid: a thank-you, no "pay by". Anything older still open is just mentioned.
    text = fill(s.paidMsg || DEFAULTS.paidMsg, { ...vars, total: money(v.total) });
    if (L.owe > 0.004) text += `\n\nYour remaining balance is ${money(L.owe)}.`;
  } else {
    const tmpl = !s.invoiceMsg || s.invoiceMsg === OLD_INVOICE_MSG ? DEFAULTS.invoiceMsg : s.invoiceMsg;
    text = fill(tmpl, { ...vars, total: money(L.owe) });
    if (L.unpaid.length > 1) text += `\n(${L.unpaid.map((x) => `${shortDate(x.date)} ${money(x.total)}`).join(', ')})`;
    const ways = [];
    if (s.squareOn && store.call) {
      try {
        const { url } = await store.call('payBalance', { customerId: cid });
        ways.push(`Card or Apple Pay: ${url}`);
        if (s.cardFeeOption !== false) { const f = await store.call('payBalance', { customerId: cid, coverFee: true }); ways.push(`Or ${money(withFee(L.owe))} to cover the 3.3% card fee (optional): ${f.url}`); }
      } catch (e) { console.error(e); toast('Couldn’t make the card pay link. Sending without it.'); }
    }
    if (s.zelle) ways.push(`Zelle: ${s.zelle}`);
    if (s.venmo) ways.push(`Venmo: ${s.venmo}`);
    if (ways.length) text += `\n\nHow to pay ${money(L.owe)}:\n${ways.join('\n')}`;
    text += `\n\nOr pay in your account: ${appLink()}`;
  }
  const sent = await sharePdf(await statementFile(cid), text, textTo(c));
  if (sent) { if (v) await store.update('visits', v.id, { sentAt: Date.now() }); else L.unpaid.forEach((x) => store.update('visits', x.id, { sentAt: Date.now() })); toast(isPaid ? 'Receipt ready to send' : 'Invoice ready to send'); }
}
function newInvoiceNo() { const d = new Date(); return `PC-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
function createVisit({ customerId, type, price, addons = [], desc, stopId, date = today(), skipCredit = false }) {
  const c = cust(customerId);
  const total = Math.round((num(price) + addons.reduce((a, x) => a + num(x.price), 0)) * 100) / 100;
  const v = { customerId, customerName: c?.name || '', type, desc, date, price: num(price), addons, total, invoiceNo: newInvoiceNo(), stopId: stopId || null, paid: false, createdAt: Date.now() };
  const id = store.add('visits', v);
  if (!skipCredit && creditOf(customerId) > 0.004) applyCredit(customerId, { visits: [...state.visits.filter((x) => x.customerId === customerId), { id, ...v }] });
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
let stuckTimer;
function subscribe() {
  unsubs.forEach((u) => typeof u === 'function' && u()); unsubs = [];
  state.loaded = new Set();
  const need = [];
  const watch = (name, setter) => { need.push(name); unsubs.push(setter(() => { state.loaded.add(name); })); };
  const onData = (key) => (done) => (docs) => { state[key] = docs; done(); scheduleRender(); };
  const W = (name) => watch(name, (done) => store.watch(name, onData(name)(done)));
  watch('settings', (done) => store.watchDoc('settings', 'main', (d) => { state.settingsDoc = d; done(); scheduleRender(); }));
  if (isAdmin()) ['customers', 'notes', 'pricing', 'stops', 'visits', 'requests', 'expenses', 'addons', 'quotes', 'users', 'invites', 'pending', 'payments'].forEach(W);
  else if (role() === 'crew') ['customers', 'notes', 'stops', 'requests'].forEach(W);
  else if (role() === 'customer') {
    const cid = state.account.customerId;
    watch('customers', (done) => store.watchDoc('customers', cid, (d) => { state.customers = d ? [d] : []; done(); scheduleRender(); }));
    watch('pricing', (done) => store.watchDoc('pricing', cid, (d) => { state.pricing = d ? [d] : []; done(); scheduleRender(); }));
    ['stops', 'visits', 'requests', 'payments'].forEach((n) => watch(n, (done) => store.watchWhere(n, 'customerId', cid, onData(n)(done))));
  }
  state.need = need;
  // Safety net: if their data still hasn't loaded after 10 seconds, refresh once (not again this visit).
  clearTimeout(stuckTimer);
  stuckTimer = setTimeout(() => {
    if (state.access !== 'ok' || state.loaded.size >= state.need.length) return;
    let tried = false; try { tried = sessionStorage.getItem('pc_autoreload') === '1'; sessionStorage.setItem('pc_autoreload', '1'); } catch {}
    if (!tried) location.reload();
  }, 10000);
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
      state.setupDone = !!setup; state.access = 'none';
      if (setup && store.mode === 'shared') {
        state.waiting = await store.getDoc('pending', state.user.email).catch(() => null);
        waitForApproval();
      }
      return render();
    }
    state.account = acct; state.access = 'ok';
    state.tab = acct.role === 'customer' ? 'home' : 'route';
    if (lockCfg()) state.locked = true;
    subscribe(); render();
  } catch (e) { console.error(e); state.access = 'none'; state.setupDone = true; render(); }
}
// Signed in but not let in yet: as soon as Jace approves them (their users/ record appears), open the app.
let approvalUnsub = null;
function waitForApproval() {
  if (approvalUnsub) return;
  approvalUnsub = store.watchDoc('users', state.user.email, (d) => {
    if (d && state.access === 'none') { approvalUnsub?.(); approvalUnsub = null; app.innerHTML = '<p class="center muted" style="padding:40px">Jace let you in! Opening your account…</p>'; location.replace(location.pathname); }
  }, () => {});
}
// Ask Jace to let this login in (used when an invite link can't be matched on this phone).
async function askToJoin(name, invite) {
  const email = state.user.email;
  const doc = { name, email, at: Date.now(), ...(invite ? { invite } : {}) };
  await store.set('pending', email, doc);
  state.waiting = doc; state.access = 'none'; state.authMsg = '';
  waitForApproval(); render();
  try {
    const owner = settings().alertEmail.trim() || settings().businessEmail.trim() || DEFAULTS.alertEmail;
    if (owner) await sendAlert(owner, `Waiting to join: ${name}`, { Name: name, Email: email, When: new Date().toLocaleString('en-US'),
      'Next step': 'Open the app > Route > Inbox and tap Approve.' });
  } catch (e) { console.error('Waiting-to-join alert email NOT sent:', e?.message || e); }
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
async function notifyJoined(name, email, joinedRole) {
  try {
    const owner = settings().alertEmail.trim() || settings().businessEmail.trim() || DEFAULTS.alertEmail;
    const role = joinedRole || state.account?.role || 'customer';
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
  if (!state.loadedOnce) { state.loadedOnce = true; try { sessionStorage.removeItem('pc_autoreload'); } catch {} }
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
  const openReq = state.requests.filter((r) => r.status !== 'done').length + (isAdmin() ? state.pending.length + inboxAlerts().filter((a) => !a.seen).length : 0);
  const saysPaid = state.visits.filter((v) => !v.paid && v.customerSaysPaid).length;
  const newAccepts = state.quotes.filter((q) => q.acceptedAt && !q.acceptedSeen).length;
  const view = { route: viewRoute, customers: viewCustomers, money: viewMoney, quotes: viewQuotes, settings: viewSettings }[state.tab]();
  const titles = { route: ['Route', state.routeSeg === 'snow' ? 'Snow removal' : state.routeSeg === 'inbox' ? 'Messages, requests and alerts' : 'Week of ' + weekLabel(state.week)],
    customers: ['Customers', custSummary()], money: ['Money', 'Income, expenses and who owes'],
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
      ${t === 'route' && openReq ? `<span class="badge">${openReq}</span>` : ''}${t === 'money' && saysPaid ? `<span class="badge">${saysPaid}</span>` : ''}${t === 'quotes' && newAccepts ? `<span class="badge">${newAccepts}</span>` : ''}</button>`).join('')}</div></nav>`;
}

/* ----- In-app messages: replies live on the request as a thread ----- */
// replies: [{ by: 'admin' | 'customer', name, text, at }]. custSeenAt / custHidden are the customer's own.
const replies = (r) => (Array.isArray(r.replies) ? r.replies : []);
const lastAt = (r) => Math.max(r.at || 0, ...replies(r).map((x) => x.at || 0));
const unreadForCust = (r) => !r.custHidden && replies(r).some((x) => x.by === 'admin' && x.at > (r.custSeenAt || 0));
const REQ_LABEL = { snow: 'Snow request', mow: 'Mow request', message: 'Message' };
function threadHtml(r, viewer) {
  const who = (x) => x.by === viewer ? 'You' : x.by === 'admin' ? (x.name || 'Jace') : (cust(r.customerId)?.name || r.customerName || 'Customer');
  const opening = r.text || (!r.fromAdmin && r.type !== 'message' ? { mow: 'Asked for a mow', snow: 'Asked for snow removal' }[r.type] : '');
  const msgs = [...(opening ? [{ by: r.fromAdmin ? 'admin' : 'customer', text: opening, at: r.at }] : []), ...replies(r)];
  return msgs.map((x) => `<div class="bubble ${x.by === viewer ? 'me' : ''}"><div class="muted small">${esc(who(x))} · ${new Date(x.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
    <div style="white-space:pre-line;overflow-wrap:anywhere">${esc(x.text)}</div></div>`).join('');
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
  // Switched to the in-between week: their new week is on, the weeks from the switch up to it are off.
  if (c.biStart) { if (weekId === c.biStart) return true; if (c.biFrom && weekId >= c.biFrom && weekId < c.biStart) return false; }
  return depth > 60 || !mowWeek(c, shiftWeek(weekId, -1), depth + 1);
}
// Every-2-weeks: the next few in-season weeks and whether each is a mow week (extra cuts don't move their rhythm).
function biWeeks(c, n = 6) {
  const out = []; let wk = weekStart(new Date());
  for (let i = 0; out.length < n && i < 40; i++, wk = shiftWeek(wk, 1)) {
    if (!grassWeek(wk)) continue;
    const st = stopOf(`${wk}_${c.id}`);
    out.push({ wk, due: dueGrass(c, wk), stop: st, extra: !!st?.extra, skipped: st?.status === 'skipped' });
  }
  return out;
}
// Did (or will) this customer get a mow that week? A stop on file wins, otherwise their plan decides.
function mowWeek(c, weekId, depth = 0) {
  const stop = stopOf(`${weekId}_${c.id}`);
  // An extra cut doesn't count: it doesn't move their every-2-weeks rhythm.
  return stop && !stop.extra ? stop.status !== 'skipped' : dueGrass(c, weekId, depth);
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
  const plan = kind === 'snow' ? (c.snowPlan === 'seasonal' ? 'Seasonal' : 'Per snow') + ((stop?.visit || 1) > 1 ? ` · Visit ${stop.visit}` : '') : (stop?.extra ? (stop.addedBy === 'customer' ? 'Extra cut (they asked)' : 'Extra cut') : r.asked && !stop?.manual ? 'Asked for a mow' : stop?.manual ? 'Added' : { weekly: 'Weekly', biweekly: 'Every 2 wks', oncall: 'On call' }[c.grassPlan] || '');
  return `<div class="card ${r.status === 'done' ? 'done' : ''}" style="gap:8px">
    <div class="between"><button class="plain grow" data-a="openCust" data-id="${c.id}"><div class="b" style="font-size:16px">${esc(c.name)}</div></button>${pill(r.status === 'skipped' ? 'p-gray' : 'p-blue', plan)}</div>
    ${c.address ? `<a href="https://maps.apple.com/?q=${encodeURIComponent(fullAddr(c))}" class="muted">${esc(c.address)}</a>` : ''}
    ${(c.deck || note) ? `<div class="muted small">${c.deck ? 'Deck ' + esc(c.deck) : ''}${c.deck && note ? ' · ' : ''}${esc(note)}</div>` : ''}
    ${action}</div>`;
}
function snowCard(r) {
  const { c, stop } = r, admin = isAdmin(), ch = snowCharge(c, stop), v = stop.visitId && visitOf(stop.visitId), note = noteOf(c.id);
  const counter = (k, label, n, sub) => `<div class="between" style="gap:8px"><div class="grow"><div>${esc(label)}</div>${sub ? `<div class="muted small">${sub}</div>` : ''}</div>
    <div class="flex" style="gap:6px;align-items:center"><button class="btn btn-ghost btn-sm" style="min-width:40px" data-a="snowCount" data-id="${stop.id}" data-k="${k}" data-d="-1" aria-label="Less ${esc(label)}">−</button>
    <b style="min-width:22px;text-align:center">${n}</b><button class="btn btn-ghost btn-sm" style="min-width:40px" data-a="snowCount" data-id="${stop.id}" data-k="${k}" data-d="1" aria-label="More ${esc(label)}">+</button></div></div>`;
  let status = '';
  if (admin) {
    if (v && v.paid) status = `<div class="okbar">Billed ${money(v.total)} · Paid</div>`;
    else if (v && Math.abs(num(v.total) - ch.total) > 0.004) status = `<div class="between warnbar" style="padding:4px 4px 4px 12px"><span>Invoice is ${money(v.total)}, now ${money(ch.total)}</span><button class="btn btn-primary btn-sm" data-a="billSnow" data-id="${stop.id}">Update invoice</button></div>`;
    else if (v) status = `<div class="between okbar" style="padding:4px 4px 4px 12px"><span>Billed ${money(v.total)}${v.sentAt ? ' · sent' : ''}</span><button class="btn btn-primary btn-sm" data-a="sendInvoice" data-id="${v.id}">${v.sentAt ? 'Resend' : 'Send invoice'}</button></div>`;
    else if (ch.total > 0) status = `<button class="btn btn-primary" data-a="billSnow" data-id="${stop.id}">Add ${money(ch.total)} to their bill</button>`;
    else if (passesOf(stop).length) status = `<div class="okbar">Done${c.snowPlan === 'seasonal' ? ' (seasonal, nothing extra to bill)' : ''}</div>`;
  }
  return `<div class="card ${passesOf(stop).length ? 'done' : ''}" style="gap:8px">
    <div class="between"><button class="plain grow" data-a="openCust" data-id="${c.id}"><div class="b" style="font-size:16px">${esc(c.name)}</div></button>${pill('p-blue', c.snowPlan === 'seasonal' ? 'Seasonal' : 'Per snow ' + money(priceOf(c.id).snow))}</div>
    ${c.address ? `<a href="https://maps.apple.com/?q=${encodeURIComponent(fullAddr(c))}" class="muted">${esc(c.address)}</a>` : ''}
    ${note ? `<div class="muted small">${esc(note)}</div>` : ''}
    <div class="lbl">Visits</div>
    ${passesOf(stop).map((inches, i) => `<div class="between" style="gap:8px"><span>Visit ${i + 1}</span>
      <span class="flex" style="gap:6px;align-items:center"><input class="inp" style="width:72px;min-height:36px" type="number" inputmode="numeric" step="1" min="0" pattern="[0-9]*" value="${inches}" data-change="passInches" data-id="${stop.id}" data-i="${i}" aria-label="Inches on visit ${i + 1}"><span class="muted">in.</span>
      <button class="link danger" style="min-height:32px" data-a="snowPassDel" data-id="${stop.id}" data-i="${i}" aria-label="Remove visit ${i + 1}">✕</button></span></div>`).join('') || '<div class="muted small">No visits yet.</div>'}
    <div class="flex" style="gap:8px"><button class="btn btn-ghost btn-sm" style="min-width:52px" data-a="snowPassUndo" data-id="${stop.id}" ${passesOf(stop).length ? '' : 'disabled'} aria-label="Remove the last visit">−</button>
      <button class="btn btn-lime btn-sm grow" data-a="snowPassAdd" data-id="${stop.id}">+ Add visit${dayInchesOf(stop.date) !== '' ? ` (${dayInchesOf(stop.date)}")` : ''}</button></div>
    ${snowAddons().map((a) => counter(a.id, a.name, num(stop.addonCounts?.[a.id]), `${money(a.price)} each`)).join('')}
    ${admin ? `<div class="between b" style="border-top:1px solid #ECEDEC;padding-top:8px"><span>${esc(ch.desc)}</span><span>${money(ch.total)}</span></div>
      ${ch.lines.map((l) => `<div class="between muted small"><span>${esc(l.name)}</span><span>${money(l.price)}</span></div>`).join('')}` : ''}
    ${status}
    ${!v && !passesOf(stop).length ? `<button class="link danger" style="min-height:32px" data-a="snowRemove" data-id="${stop.id}">Not going today (remove)</button>` : ''}</div>`;
}
// Inbox alerts: accepted quotes and app sign-ups from the last 60 days. "Got it" marks them seen.
// Deleting an alert only hides it from the inbox; the quote or sign-up itself stays.
const hideAlert = (a) => store.update(a.kind === 'quote' ? 'quotes' : 'invites', a.id, { alertHidden: true, ...(a.kind === 'quote' ? { acceptedSeen: true } : { seenAt: Date.now() }) });
function inboxAlerts() {
  if (!isAdmin()) return [];
  const since = Date.now() - 60 * 864e5, out = [];
  state.quotes.filter((q) => q.acceptedAt > since && !q.alertHidden).forEach((q) => out.push({ kind: 'quote', id: q.id, at: q.acceptedAt, seen: !!q.acceptedSeen, cid: q.customerId,
    name: q.acceptedName || q.name, text: `Accepted quote Q-${q.number}${q.acceptedPhone ? ' · ' + q.acceptedPhone : ''}${q.customerId && cust(q.customerId)?.needsDetails ? ' · added to Customers, fill in their details' : ''}` }));
  state.invites.filter((i) => i.usedAt > since && !i.alertHidden).forEach((i) => out.push({ kind: 'join', id: i.id, at: i.usedAt, seen: !!i.seenAt, cid: i.linkedCustomerId || i.customerId,
    name: i.name || i.usedBy, text: `${i.role === 'crew' ? 'Crew' : 'Customer'} account created · ${i.usedBy}` }));
  return out.sort((a, b) => b.at - a.at);
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
    // One card per customer for the day (older extra-visit stops are folded into the first one).
    const seen = new Set();
    const rows = state.stops.filter((s) => s.type === 'snow' && s.date === state.snowDate && cust(s.customerId)).sort((a, b) => (a.visit || 1) - (b.visit || 1))
      .filter((s) => !seen.has(s.customerId) && seen.add(s.customerId)).map((s) => ({ c: cust(s.customerId), stop: s })).sort((a, b) => byName(a.c, b.c));
    const snowReq = openReq.filter((r) => r.type === 'snow');
    const signedUp = state.customers.filter((x) => x.active && x.snow).length;
    const inches = dayInchesOf(state.snowDate);
    const toBill = rows.filter((r) => { const ch = snowCharge(r.c, r.stop), v = r.stop.visitId && visitOf(r.stop.visitId); return ch.total > 0 && (!v || (!v.paid && Math.abs(num(v.total) - ch.total) > 0.004)); });
    body = `<label class="f"><span class="lbl">Snow day</span><input class="inp" type="date" value="${state.snowDate}" data-change="snowDate"></label>
      ${isAdmin() ? `<div class="card"><div class="b">Start snow day</div><div class="muted small">Adds everyone signed up for snow (${signedUp})${snowReq.length ? ` and the ${snowReq.length} open snow request${snowReq.length === 1 ? '' : 's'}` : ''}. Already on the list stays as is.</div>
        <button class="btn btn-primary" data-a="startSnow">Start snow day</button></div>` : ''}
      ${rows.length ? `<div class="card"><label class="f"><span class="lbl">Inches (fills in each new visit)</span><input class="inp" type="number" inputmode="numeric" step="1" min="0" pattern="[0-9]*" value="${inches}" placeholder="Whole inches" data-change="snowInches"></label>
        <div class="muted small">Per snow: each visit is the base price for up to ${wholeInches(settings().snowIncluded)}"; each inch over on that visit adds ${money(settings().snowPerInch)}. Change any visit's inches on the card.</div></div>` : ''}
      ${rows.length ? rows.map(snowCard).join('') : '<div class="card empty">No snow stops for this day yet.</div>'}
      ${isAdmin() && toBill.length ? `<button class="btn btn-primary" data-a="billSnowAll">Bill everyone (${toBill.length}) · ${money(toBill.reduce((a, r) => a + snowCharge(r.c, r.stop).total, 0))}</button>` : ''}`;
  } else {
    const all = [...state.requests].sort((a, b) => (a.status === 'done') - (b.status === 'done') || lastAt(b) - lastAt(a)).slice(0, 60);
    const handled = state.requests.filter((r) => r.status === 'done').length;
    const waiting = isAdmin() ? [...state.pending].sort((a, b) => (b.at || 0) - (a.at || 0)) : [];
    const custOpts = [...state.customers].sort(byName).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    // Alerts (the same things that get emailed): accepted quotes (with the customer they made) and app sign-ups.
    const alerts = isAdmin() ? inboxAlerts() : [], fresh = alerts.filter((a) => !a.seen), seenRecent = alerts.filter((a) => a.seen && Date.now() - a.at < 14 * 864e5);
    const alertCard = (a) => `<div class="card" style="gap:8px;${a.seen ? 'opacity:.6' : ''}"><div class="between"><div class="b">${esc(a.name)}</div>${pill(a.kind === 'quote' ? 'p-green' : 'p-blue', a.kind === 'quote' ? 'Quote accepted' : 'Joined the app')}</div>
      <div class="muted small">${new Date(a.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${esc(a.text)}</div>
      <div class="flex wrap">${a.cid && cust(a.cid) ? `<button class="btn btn-ghost btn-sm" data-a="openCust" data-id="${a.cid}">Open customer</button>` : ''}
        ${a.kind === 'quote' ? `<button class="btn btn-ghost btn-sm" data-a="inboxQuote" data-id="${a.id}">Open quote</button>` : ''}
        ${a.seen ? '' : `<button class="btn btn-lime btn-sm" style="margin-left:auto" data-a="alertSeen" data-kind="${a.kind}" data-id="${a.id}">Got it</button>`}
        <button class="link danger" style="min-height:32px;${a.seen ? 'margin-left:auto' : ''}" data-a="alertDel" data-kind="${a.kind}" data-id="${a.id}">Delete</button></div></div>`;
    body = fresh.map(alertCard).join('') + waiting.map((p) => {
      const inv = p.invite && state.invites.find((i) => i.id === p.invite);
      const match = inv?.customerId || p.suggest || state.customers.find((c) => (c.email || '').toLowerCase() === p.id)?.id || '';
      return `<div class="card"><div class="between"><div class="b">${esc(p.name)}</div>${pill('p-orange', 'Waiting to join')}</div>
        <div class="muted small">${esc(p.id)} · ${p.at ? shortDate(new Date(p.at).toISOString().slice(0, 10)) : ''}${inv?.label ? ' · link sent to ' + esc(inv.label) : ''}</div>
        <label class="f"><span class="lbl">Let them in as</span><select class="inp" id="pend_${esc(p.id)}"><option value="new">A new customer</option>${custOpts.replace(`value="${match}"`, `value="${match}" selected`)}</select></label>
        <div class="flex wrap"><button class="btn btn-primary btn-sm" data-a="approvePending" data-id="${esc(p.id)}">Approve</button>
          <button class="link danger" style="min-height:32px;margin-left:auto" data-a="dismissPending" data-id="${esc(p.id)}">Remove</button></div></div>`;
    }).join('') + (handled + seenRecent.length ? `<div class="between"><span class="muted small">${handled + seenRecent.length} handled or seen</span><button class="link danger" style="min-height:32px" data-a="reqClearDone">Delete all old</button></div>` : '')
      + (all.length ? all.map((r) => {
      const c = cust(r.customerId);
      return `<div class="card" style="${r.status === 'done' ? 'opacity:.6' : ''}"><div class="between"><div class="b">${esc(c?.name || r.customerName)}</div>${pill(r.type === 'snow' ? 'p-blue' : r.type === 'mow' ? 'p-green' : 'p-orange', r.fromAdmin ? 'You sent' : REQ_LABEL[r.type])}</div>
        ${threadHtml(r, 'admin')}${r.custHidden ? '<div class="muted small">The customer deleted this from their app.</div>' : ''}
        ${isAdmin() ? `<button class="btn btn-primary btn-sm" data-a="openReply" data-id="${r.id}">Reply in the app</button>` : ''}
        ${r.status !== 'done' ? `<div class="flex wrap">
          ${r.type === 'snow' ? `<button class="btn btn-lime btn-sm" data-a="reqToSnow" data-id="${r.id}">Add to snow day</button>` : ''}
          ${r.type === 'mow' ? `<button class="btn btn-lime btn-sm" data-a="reqToWeek" data-id="${r.id}">Add to this week</button>` : ''}
          ${c?.phone ? `<a class="btn btn-ghost btn-sm" href="${smsHref(textTo(c), '')}">Text back</a>` : ''}
          <button class="btn btn-ghost btn-sm" data-a="reqDone" data-id="${r.id}">Mark handled</button>
          <button class="link danger" style="min-height:32px;margin-left:auto" data-a="reqDel" data-id="${r.id}">Delete</button></div>`
          : `<div class="between"><span class="muted small">Handled</span><button class="link danger" style="min-height:32px" data-a="reqDel" data-id="${r.id}">Delete</button></div>`}</div>`;
    }).join('') : waiting.length || fresh.length ? '' : '<div class="card empty">Nothing new. Customer messages and requests, sign-ups and accepted quotes show up here.</div>')
      + (seenRecent.length ? `<div class="sec">Earlier alerts</div>${seenRecent.map(alertCard).join('')}` : '');
  }
  const inboxN = openReq.length + (isAdmin() ? state.pending.length + inboxAlerts().filter((a) => !a.seen).length : 0);
  return `<div class="seg">${seg('grass', 'Grass')}${seg('snow', 'Snow')}${seg('inbox', `Inbox${inboxN ? ' (' + inboxN + ')' : ''}`)}</div>${body}`;
}

/* ----- Customers ----- */
// Header line: every customer counts, whether or not they have their own login.
function custSummary() {
  const onApp = state.customers.filter((c) => usersForCustomer(c.id).length).length;
  const on = state.customers.filter((c) => c.active);
  return `${on.length} total${isAdmin() ? ` · ${onApp} use the app` : ''}`;
}
function viewCustomers() {
  if (state.editing) return viewCustomerEdit();
  if (state.custId && cust(state.custId)) return viewCustomer();
  const q = state.q.trim().toLowerCase();
  // A to Z, active first; paused ones go to the bottom, grayed out.
  const seg = state.custSeg, inSeg = (c) => seg === 'grass' ? c.grass : seg === 'snow' ? c.snow : true;
  const list = [...state.customers].sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || byName(a, b)).filter(inSeg).filter((c) => !q || `${c.name} ${c.name2 || ''} ${fullAddr(c)} ${c.phone}`.toLowerCase().includes(q));
  const live = state.customers.filter((c) => c.active);
  const segBtn = (k, l, n) => `<button class="${seg === k ? 'on' : ''}" data-a="custSeg" data-v="${k}">${l} (${n})</button>`;
  const svc = (c) => [c.grass && 'Grass', c.snow && 'Snow'].filter(Boolean).join(' + ') || 'No services';
  const firstPaused = list.findIndex((c) => !c.active);
  // Price on each row: snow price on the Snow tab, mowing price otherwise (or snow if they're snow only).
  const rowPrice = (c, sg) => { const p = priceOf(c.id), snow = c.snowPlan === 'seasonal' ? (p.season ? money(p.season) + '/season' : '') : (p.snow ? money(p.snow) + '/snow' : '');
    const txt = sg === 'snow' || (!c.grass && c.snow) ? snow : p.grass ? money(p.grass) : '';
    return txt ? `<div class="b">${txt}</div>` : ''; };
  return `<div class="seg">${segBtn('all', 'All', live.length)}${segBtn('grass', 'Grass', live.filter((c) => c.grass).length)}${segBtn('snow', 'Snow', live.filter((c) => c.snow).length)}</div>
    <div class="flex"><label class="grow"><span class="sr">Search customers</span><input class="inp" id="search" placeholder="Search name, address or phone" value="${esc(state.q)}" data-input="search"></label>
      ${isAdmin() ? '<button class="btn btn-primary" data-a="newCust">+ Add</button>' : ''}</div>
    ${isAdmin() && state.customers.length ? '<button class="btn btn-ghost" data-a="bulkPick">Text customers a saved message</button>' : ''}
    ${list.length ? list.map((c, i) => `${i === firstPaused ? '<div class="sec">Paused</div>' : ''}<button class="rowbtn ${c.active ? '' : 'paused'}" data-a="openCust" data-id="${c.id}"><div class="avatar">${esc(initials(c.name))}</div>
      <div class="grow"><div class="b">${esc(bothNames(c))}${isAdmin() && usersForCustomer(c.id).length ? ' <span class="pill p-green" style="font-size:11px;padding:1px 7px;vertical-align:middle">App</span>' : ''}</div><div class="muted">${esc(c.address || 'No address')}</div>${isAdmin() && c.needsDetails ? '<div class="small" style="color:#B45309">New from a quote: add details</div>' : ''}</div>
      <div style="text-align:right">${isAdmin() ? rowPrice(c, seg) : ''}<div class="muted small">${c.active ? svc(c) : 'Paused'}</div></div></button>`).join('')
      : `<div class="card empty">${state.customers.length ? 'No matches.' : 'No customers yet. Tap “+ Add” to enter your first one.'}</div>`}`;
}
// Every statement this customer has, newest first. Each opens as a PDF; nothing is lost when a new one starts.
function statementsCard(c, admin) {
  const ps = statementPeriods(c.id), breaks = statementBreaks(c);
  return `<div class="card"><div class="b">Statements</div>
    <div class="muted small">${admin ? 'One PDF a year, starting fresh every Jan 1. The newest one is what goes out with invoices.' : 'One for each year. Tap to open.'}</div>
    <div class="list">${ps.map((p) => { const st = statementRows(c.id, p); return `<div class="line"><div class="grow"><div class="b">${esc(periodName(p))}${p.current ? ' <span class="pill p-green" style="font-size:11px;padding:1px 7px">Current</span>' : ''}</div>
      <div class="muted small">${st.closing > 0.004 ? 'Balance ' + money(st.closing) : 'Paid up'}${admin && breaks.includes(p.start) ? ` · <button class="link" style="min-height:28px" data-a="joinStatement" data-cid="${c.id}" data-d="${p.start}">Merge into the one before</button>` : ''}</div></div>
      <button class="btn btn-ghost btn-sm" data-a="custPdf" data-cid="${c.id}" data-start="${p.start}">Open PDF</button></div>`; }).join('')}</div>
    ${admin ? `<button class="link" style="min-height:36px" data-a="freshStatement" data-cid="${c.id}">+ Start a separate statement today</button>` : ''}</div>`;
}
// Every-2-weeks schedule on the customer page: see their weeks, switch to the in-between week, or add an extra cut.
function biCard(c) {
  const wks = biWeeks(c);
  return `<div class="sec">Every-2-weeks schedule</div><div class="card"><div class="muted small">Switch them to the in-between week, or add an extra cut when the grass is growing fast. Extra cuts don’t change their weeks.</div>
    ${wks.length ? `<div class="list">${wks.map((w) => `<div class="line"><div class="grow"><div class="b">Week of ${esc(weekLabel(w.wk))}</div>
      <div class="muted small">${w.skipped ? 'Skipped' : w.extra ? `Extra cut${w.stop.addedBy === 'customer' ? ' (they asked)' : ''}` : w.due || w.stop ? 'Mow week' : 'Off week'}</div></div>
      ${w.extra && w.stop.status === 'scheduled' ? `<button class="link danger" style="min-height:32px" data-a="extraCutDel" data-cid="${c.id}" data-wk="${w.wk}">Remove</button>`
        : !w.due && !w.stop ? `<span class="flex" style="gap:6px"><button class="btn btn-ghost btn-sm" data-a="extraCut" data-cid="${c.id}" data-wk="${w.wk}">+ Extra cut</button>
          <button class="btn btn-ghost btn-sm" data-a="biSwitch" data-cid="${c.id}" data-wk="${w.wk}">Switch here</button></span>` : ''}</div>`).join('')}</div>`
      : '<div class="muted">Mowing season is over. Their weeks pick back up in April.</div>'}</div>`;
}
function viewCustomer() {
  const c = cust(state.custId), p = priceOf(c.id), admin = isAdmin();
  const u = admin && userForCustomer(c.id);
  const visits = state.visits.filter((v) => v.customerId === c.id).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const owed = visits.filter((v) => !v.paid);
  const grassPlan = { weekly: 'Weekly', biweekly: 'Every 2 weeks', oncall: 'On call ("Grass today?" text)' }[c.grassPlan];
  return `<button class="link" data-a="backToList">← All customers</button>
    <div class="card"><div class="between"><div><div class="b" style="font-size:20px">${esc(c.name)}</div>${c.name2 ? `<div class="muted">and ${esc(c.name2)}</div>` : ''}</div>${admin ? '<button class="btn btn-ghost btn-sm" data-a="editCust">Edit</button>' : ''}</div>
      <div><div class="lbl">Phone</div><div>${c.phone ? `<a href="tel:+1${firstPhone(c.phone)}">${esc(c.phone)}</a> · <a href="${smsHref(textTo(c), '')}">Text${c.textAll && allPhones(c.phone).length > 1 ? ' all' : ''}</a>` : '—'}</div>${c.textAll && allPhones(c.phone).length > 1 ? '<div class="muted small">Texts go to all numbers as a group text.</div>' : ''}</div>
      ${admin && c.phone ? `<button class="btn btn-ghost" data-a="pickMsg" data-cid="${c.id}">Send a saved message</button>` : ''}
      ${admin && userForCustomer(c.id) ? `<button class="btn btn-ghost" data-a="openReply" data-cid="${c.id}">Message in the app</button>` : ''}
      <div><div class="lbl">Address</div><div>${c.address ? `<a href="https://maps.apple.com/?q=${encodeURIComponent(fullAddr(c))}">${esc(fullAddr(c))}</a>` : '—'}</div></div>
      ${admin && c.email ? `<div><div class="lbl">Email</div><div>${esc(c.email)}</div></div>` : ''}
      <div class="grid2"><div><div class="lbl">Deck height</div><div>${esc(c.deck || '—')}</div></div><div><div class="lbl">Status</div><div>${c.active ? 'Active' : 'Paused'}</div></div></div>
      <div><div class="lbl">Notes</div><div style="white-space:pre-line">${esc(noteOf(c.id) || 'No notes yet.')}</div></div></div>
    <div class="sec">Services</div>
    <div class="card">
      <div class="between"><div><div class="b">Grass</div><div class="muted">${c.grass ? esc(grassPlan) : 'Not signed up'}</div></div>${admin && c.grass ? `<div class="b" style="text-align:right">${money(num(p.grass) + builtInTotal(c))}/cut${builtIns(c).length ? `<div class="muted small" style="font-weight:400">${money(p.grass)} + ${money(builtInTotal(c))} add-ons</div>` : ''}</div>` : ''}</div>
      ${admin && c.grass ? `<div><div class="lbl">Add-ons on every cut</div>
        <div class="flex wrap" style="margin-top:4px">${addonsOf('grass').map((a) => `<button class="chip ${builtIns(c).some((x) => x.id === a.id) ? 'on' : ''}" data-a="custAddon" data-cid="${c.id}" data-id="${a.id}">${esc(a.name)} · ${money(a.price)}</button>`).join('') || '<span class="muted small">No add-ons yet.</span>'}</div>
        <div class="flex" style="gap:6px;margin-top:6px"><input class="inp grow" id="ca_name" placeholder="New add-on, e.g. Edging"><input class="inp" id="ca_price" inputmode="decimal" placeholder="$" style="width:72px"><button class="btn btn-ghost btn-sm" data-a="custAddonNew" data-cid="${c.id}">Add</button></div>
        <div class="muted small">Ticked add-ons are on every mow and show on the bill as “${esc(grassLabel(c))} (with add-ons…)”.</div></div>` : ''}
      <div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div><div class="b">Snow</div><div class="muted">${c.snow ? (c.snowPlan === 'seasonal' ? 'Seasonal' : 'Per snow, on request') : 'Not signed up'}</div></div>
        ${admin && c.snow ? `<div class="b" style="text-align:right">${c.snowPlan === 'seasonal' ? money(p.season) + '/season' : `${money(p.snow)}/visit<div class="muted small" style="font-weight:400">${snowTerms()}</div>`}</div>` : ''}</div>
      ${admin && c.snow && c.snowPlan === 'seasonal' ? `<button class="btn btn-ghost" data-a="billSeason" data-cid="${c.id}">Bill snow season (${money(p.season)})</button>` : ''}
      ${admin ? `<button class="btn btn-ghost" data-a="quoteForCust" data-cid="${c.id}">+ New quote for ${esc(first(c.name))}</button>` : ''}
      ${admin ? `<button class="btn btn-ghost" data-a="otherWork" data-cid="${c.id}">+ Add a job (cleanup, extra work…)</button>` : ''}
    </div>
    ${admin && c.grass && c.active && c.grassPlan === 'biweekly' ? biCard(c) : ''}
    ${admin ? `<div class="sec">App access</div>
    <div class="card">${u ? `${usersForCustomer(c.id).map((x, i) => `<div class="between" ${i ? 'style="border-top:1px solid #ECEDEC;padding-top:10px"' : ''}><div><div class="b">${esc(x.name || c.name)}</div><div class="muted">${esc(x.id)}</div></div>${pill('p-green', 'Has access')}</div>
        <div class="flex wrap"><button class="btn btn-ghost btn-sm" data-a="reinvite" data-email="${esc(x.id)}">Send the welcome text again</button>
          <button class="link danger" style="min-height:32px;margin-left:auto" data-a="removeUser" data-email="${esc(x.id)}">Remove app access</button></div>`).join('')}
        <button class="btn btn-ghost" data-a="inviteSecond" data-cid="${c.id}">Invite ${c.name2 ? esc(first(c.name2)) : 'a second person'} to this account</button>
        <div class="muted small">They get their own login and see the same schedule and invoices.</div>`
      : `<div class="muted">Give ${esc(first(c.name))} a login to see their schedule, skip, request snow removal and pay invoices.</div>
        <button class="btn btn-primary" data-a="inviteCustomer" data-cid="${c.id}">Invite to the app</button><div class="muted small">Sends a link. They sign up with any email. Optional: you can schedule, invoice by text and mark paid here without them ever having a login.</div>`}</div>
    <div class="sec">Invoices</div>
    <button class="btn btn-primary" data-a="sendStatement" data-cid="${c.id}">Send ${esc(first(c.name))} their statement${ledgerFor(c.id).owe > 0.004 ? ` (owes ${money(ledgerFor(c.id).owe)})` : ''}</button>
    ${owed.length ? `<div class="card"><div class="between"><div><div class="b">Owes ${money(owed.reduce((a, v) => a + num(v.total), 0))}</div><div class="muted small">${owed.length} unpaid invoice${owed.length === 1 ? '' : 's'}</div></div>
      ${owed.length > 1 ? `<button class="btn btn-lime btn-sm" data-a="markAllPaid" data-cid="${c.id}">Mark all paid</button>` : ''}</div></div>` : ''}
    <div class="card"><div class="between"><div><div class="b">Record a payment</div><div class="muted small">Cash for a few weeks or a month up front? It pays the oldest visits first; the rest is credit for the next ones.</div></div>
      <button class="btn btn-lime btn-sm" data-a="openPayment" data-cid="${c.id}">+ Payment</button></div>
      ${creditOf(c.id) > 0.004 ? `<div class="okbar">Credit: ${money(creditOf(c.id))} for upcoming visits</div>` : ''}
      ${paymentsOf(c.id).length ? `<div class="list">${[...paymentsOf(c.id)].sort((a, b) => b.date.localeCompare(a.date)).map((p) => `<div class="line"><div class="grow"><div>${shortDate(p.date)} · ${esc(paidLabel(p.via))}</div>${p.note ? `<div class="muted small">${esc(p.note)}</div>` : ''}</div>
        <b>${money(p.amount)}</b><button class="link danger" style="margin-left:10px;min-height:32px" data-a="delPayment" data-id="${p.id}" aria-label="Remove payment">✕</button></div>`).join('')}</div>` : ''}</div>
    ${visits.length ? `<details class="card"><summary class="b">Balance history (since ${shortDate(statementStart(c))})</summary>${ledgerHtml(statementRows(c.id).rows.slice().reverse(), true)}</details>` : ''}
    ${statementsCard(c, true)}
    <div class="card list">${visits.length ? visits.map((v) => `<div class="line"><div class="grow"><div>${shortDate(v.date)} · ${esc(chargeLabel(v))}</div><div class="muted small">${esc(v.invoiceNo)}${v.paid && v.paidAt ? ' · ' + paidLabel(v.paidVia).toLowerCase() + ' ' + shortDate(ymd(new Date(v.paidAt))) + (v.cardFeePaid ? ` (+${money(v.cardFeePaid)} fee covered)` : '') : v.customerSaysPaid ? ' · says they paid' : ''}</div></div>
        <span class="flex"><b>${money(v.total)}</b>${v.paid ? `${pill('p-green', 'Paid')}<button class="link" style="margin-left:8px;min-height:32px" data-a="markUnpaid" data-id="${v.id}">Undo</button>`
          : `<button class="btn btn-lime btn-sm" data-a="markPaid" data-id="${v.id}">${v.customerSaysPaid ? 'Confirm paid' : 'Mark paid'}</button><button class="btn btn-ghost btn-sm" data-a="sendInvoice" data-id="${v.id}">${v.sentAt ? 'Resend' : 'Send'}</button>`}<button class="link danger" style="margin-left:8px;min-height:32px" data-a="delVisit" data-id="${v.id}" aria-label="Delete">✕</button></span></div>`).join('') : '<div class="empty">No invoices yet.</div>'}</div>
    ${state.customers.length > 1 ? `<div class="sec">Duplicate?</div>
    <div class="card"><div class="muted small">If this person is in here twice, pick the other one. Their logins, invoices, route stops and messages move to ${esc(first(c.name))}, then the other one is deleted.</div>
      <label class="f"><span class="lbl">Merge into ${esc(c.name)}</span><select class="inp" id="merge_pick"><option value="">Pick the duplicate…</option>${[...state.customers].filter((x) => x.id !== c.id).sort(byName).map((x) => `<option value="${x.id}">${esc(bothNames(x))}${x.email ? ' · ' + esc(x.email) : ''}</option>`).join('')}</select></label>
      <button class="btn btn-ghost" data-a="mergeCust">Merge</button></div>` : ''}
    <button class="btn btn-danger" style="margin-top:8px" data-a="deleteCust">Delete ${esc(first(c.name))} completely</button>` : ''}`;
}
function viewCustomerEdit() {
  const c = cust(state.custId) || { name: '', phone: '', address: '', email: '', deck: '', active: true, grass: true, grassPlan: 'weekly', snow: false, snowPlan: 'perSnow' };
  const p = priceOf(c.id);
  const opt = (v, cur, l) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`;
  return `<button class="link" data-a="cancelEdit">← Cancel</button>
    <div class="card">
      <label class="f"><span class="lbl">Name</span><input class="inp" id="c_name" value="${esc(c.name)}" autocomplete="off"></label>
      <label class="f"><span class="lbl">Second person (optional)</span><input class="inp" id="c_name2" value="${esc(c.name2 || '')}" autocomplete="off" placeholder="Spouse, son, daughter…"></label>
      <label class="f"><span class="lbl">Phone number(s)</span><input class="inp" id="c_phone" value="${esc(c.phone)}" inputmode="tel" placeholder="Separate numbers with a comma"></label>
      <label class="check"><input type="checkbox" id="c_textAll" ${c.textAll ? 'checked' : ''}> Text all numbers (group text). Off: only the first number gets texts.</label>
      ${addrFields('c', cust(state.custId))}
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
// Money in, by the day it was received: paid invoices (not the ones paid from credit) plus payments entered by hand.
function incomeEntries() {
  return [...state.visits.filter((v) => v.paid && v.paidAt && !v.creditFrom).map((v) => ({ date: ymd(new Date(v.paidAt)), amt: num(v.total), who: v.customerName, what: `Payment for ${chargeLabel(v)} (${shortDate(v.date)})`, via: paidLabel(v.paidVia), inv: v.invoiceNo })),
    ...(state.payments || []).map((p) => ({ date: p.date, amt: num(p.amount), who: cust(p.customerId)?.name || '', what: p.note || 'Payment', via: paidLabel(p.via), inv: '' }))];
}
// Every year before this one that has anything in it. On Jan 1 this year joins the list on its own.
function pastYears() {
  const now = Number(today().slice(0, 4)), ys = new Set();
  const add = (d) => { const y = Number(String(d || '').slice(0, 4)); if (y >= 2020 && y < now) ys.add(y); };
  state.visits.forEach((v) => add(v.date)); incomeEntries().forEach((x) => add(x.date)); state.expenses.forEach((e) => add(e.date));
  return [...ys].sort((a, b) => b - a);
}
function yearStats(y) {
  const inY = (d) => String(d || '').startsWith(y + '-');
  const visits = state.visits.filter((v) => inY(v.date));
  const income = incomeEntries().filter((x) => inY(x.date)).reduce((a, x) => a + x.amt, 0);
  const expenses = state.expenses.filter((e) => inY(e.date)).reduce((a, e) => a + num(e.amount), 0);
  return { visits, billed: visits.reduce((a, v) => a + num(v.total), 0), income, expenses, profit: income - expenses,
    customers: new Set(visits.map((v) => v.customerId)).size, unpaid: visits.filter((v) => !v.paid).reduce((a, v) => a + num(v.total), 0) };
}
// A year as a spreadsheet, line by line: every charge and add-on, every payment, every expense, then totals.
function yearCsv(y) {
  const inY = (d) => String(d || '').startsWith(y + '-'), st = yearStats(y);
  const rows = [['Section', 'Date', 'Customer / Vendor', 'Item', 'Category', 'Amount', 'Invoice #', 'Status']];
  [...st.visits].sort((a, b) => a.date.localeCompare(b.date) || String(a.customerName).localeCompare(String(b.customerName))).forEach((v) => {
    const status = v.paid ? (v.creditFrom ? 'Paid from credit' : `Paid ${v.paidAt ? ymd(new Date(v.paidAt)) : ''} ${paidLabel(v.paidVia)}`.trim()) : 'UNPAID';
    const cat = v.type === 'snow' ? 'Snow' : v.type === 'grass' ? 'Lawn' : v.type === 'season' ? 'Snow season' : 'Other work';
    visitLines(v).forEach((l, i) => rows.push(['Charge', v.date, v.customerName, i ? `+ ${l.desc}` : l.desc, cat, num(l.amount), v.invoiceNo, status]));
  });
  incomeEntries().filter((x) => inY(x.date)).sort((a, b) => a.date.localeCompare(b.date)).forEach((x) => rows.push(['Payment received', x.date, x.who, x.what, x.via, x.amt, x.inv, '']));
  state.expenses.filter((e) => inY(e.date)).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push(['Expense', e.date, e.vendor || '', e.desc, e.category, -num(e.amount), '', '']));
  rows.push([], ['Total billed', '', '', `${st.visits.length} invoice${st.visits.length === 1 ? '' : 's'}, ${st.customers} customer${st.customers === 1 ? '' : 's'}`, '', st.billed], ['Total received', '', '', '', '', st.income],
    ['Total expenses', '', '', '', '', -st.expenses], ['Profit', '', '', '', '', st.profit], ['Still unpaid from ' + y, '', '', '', '', st.unpaid]);
  return rows.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
function viewMoney() {
  const tab = (k, l) => `<button class="${state.moneyTab === k ? 'on' : ''}" data-a="moneyTab" data-v="${k}">${l}</button>`;
  const paid = state.visits.filter((v) => v.paid && v.paidAt && !v.creditFrom);
  // Income: paid invoices plus payments recorded by hand (visits paid from credit were already counted as the payment).
  const sumIn = (from) => paid.filter((v) => ymd(new Date(v.paidAt)) >= from).reduce((a, v) => a + v.total, 0)
    + (state.payments || []).filter((p) => p.date >= from).reduce((a, p) => a + num(p.amount), 0);
  const sumEx = (from) => state.expenses.filter((e) => e.date >= from).reduce((a, e) => a + num(e.amount), 0);
  const now = new Date(), wk = weekStart(now), mo = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), yr = `${now.getFullYear()}-01-01`;
  const unpaid = state.visits.filter((v) => !v.paid).sort((a, b) => (b.customerSaysPaid ? 1 : 0) - (a.customerSaysPaid ? 1 : 0) || a.date.localeCompare(b.date));
  const toBill = state.stops.filter((s) => s.status === 'done' && !s.visitId && cust(s.customerId) && (s.type === 'snow' ? (Array.isArray(s.passes) ? snowCharge(cust(s.customerId), s).total > 0 : cust(s.customerId).snowPlan !== 'seasonal') : true));
  let body = '';
  const owed = unpaid.reduce((a, v) => a + num(v.total), 0);
  const billRow = (st) => { const c = cust(st.customerId); return `<div class="line"><div class="grow"><div class="b">${esc(c?.name || '')}</div><div class="muted small">${st.type === 'snow' ? 'Snow' : 'Mow'} · ${shortDate(st.date || st.weekId)}${st.doneByName ? ' · ' + esc(st.doneByName) : ''}</div></div>
    <button class="btn btn-primary btn-sm" data-a="${st.type === 'snow' && Array.isArray(st.passes) ? 'billSnow' : 'billStop'}" data-id="${st.id}" data-cid="${st.customerId}" data-kind="${st.type}">Make invoice</button></div>`; };
  if (state.moneyTab === 'overview') {
    const P = state.moneyPeriod, from = P === 'week' ? wk : P === 'year' ? yr : mo;
    const label = P === 'week' ? `Week of ${weekLabel(wk)}` : P === 'year' ? String(now.getFullYear()) : now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const i = sumIn(from), e = sumEx(from), pr = i - e;
    const says = unpaid.filter((v) => v.customerSaysPaid).length;
    const period = (k, l) => `<button class="chip ${P === k ? 'on' : ''}" data-a="moneyPeriod" data-v="${k}">${l}</button>`;
    body = `${toBill.length ? `<div class="sec">Done, not billed</div><div class="card list">${toBill.map(billRow).join('')}</div>` : ''}
      <div class="sec">Unpaid</div>
      <div class="card" style="gap:6px">
        <div class="between"><div><div class="big">${money(owed)}</div><div class="muted small">${unpaid.length ? `${unpaid.length} invoice${unpaid.length === 1 ? '' : 's'} owed${says ? ` · ${says} say${says === 1 ? 's' : ''} they paid` : ''}` : 'Everyone’s paid up'}</div></div>
          ${unpaid.length ? '<button class="btn btn-ghost btn-sm" data-a="moneyTab" data-v="unpaid">See all</button>' : ''}</div>
        ${unpaid.slice(0, 4).map((v) => `<div class="line" style="border-top:1px solid #ECEDEC;padding-top:8px"><div class="grow"><div class="b">${esc(v.customerName)}${v.customerSaysPaid ? ' <span class="pill p-orange" style="font-size:11px;padding:1px 7px">Says paid</span>' : ''}</div><div class="muted small">${shortDate(v.date)} · ${esc(chargeLabel(v))}</div></div>
          <b style="margin-right:8px">${money(v.total)}</b><button class="btn btn-lime btn-sm" data-a="markPaid" data-id="${v.id}">${v.customerSaysPaid ? 'Confirm' : 'Paid'}</button></div>`).join('')}
        ${unpaid.length > 4 ? `<button class="link" style="min-height:32px" data-a="moneyTab" data-v="unpaid">+ ${unpaid.length - 4} more</button>` : ''}</div>
      <div class="between" style="margin-top:6px"><div class="sec" style="margin:0">${esc(label)}</div><div class="flex" style="gap:6px">${period('week', 'Week')}${period('month', 'Month')}${period('year', 'Year')}</div></div>
      <div class="kpis">
        <div class="kpi in"><div class="lbl">Income</div><div class="n">${money(i)}</div></div>
        <div class="kpi"><div class="lbl">Expenses</div><div class="n">${money(e)}</div></div>
        <div class="kpi profit"><div class="lbl">Profit</div><div class="n">${pr < 0 ? '−' : ''}${money(Math.abs(pr))}</div></div></div>
      <div class="muted small center">Income counts when an invoice is marked paid. Weeks start Monday.</div>
      <button class="btn btn-ghost" data-a="exportCsv">Download income &amp; expenses (CSV)</button>`;
  } else if (state.moneyTab === 'unpaid') {
    body = `${toBill.length ? `<div class="sec">Done, not billed</div><div class="card list">${toBill.map(billRow).join('')}</div>` : ''}
      <div class="card row"><div class="grow"><div class="lbl">Total owed</div><div class="big">${money(unpaid.reduce((a, v) => a + v.total, 0))}</div></div><div class="muted">${unpaid.length} invoice${unpaid.length === 1 ? '' : 's'}</div></div>
      ${unpaid.length ? unpaid.map((v) => `<div class="card" style="gap:8px"><div class="between"><div><div class="b">${esc(v.customerName)}</div><div class="muted">${shortDate(v.date)} · ${esc(chargeLabel(v))}</div></div><div class="b">${money(v.total)}</div></div>
        ${v.customerSaysPaid ? `<div class="warnbar">${esc(first(v.customerName))} says they paid${v.customerSaysPaidAt ? ' on ' + shortDate(ymd(new Date(v.customerSaysPaidAt))) : ''}. Check Zelle/Venmo, then confirm.</div>` : ''}
        <div class="flex"><button class="btn btn-lime grow" data-a="markPaid" data-id="${v.id}">${v.customerSaysPaid ? 'Confirm paid' : 'Mark paid'}</button>
          <button class="btn btn-ghost" data-a="sendInvoice" data-id="${v.id}">${v.sentAt ? 'Resend' : 'Send'}</button>
          <button class="btn btn-ghost btn-sm" data-a="delVisit" data-id="${v.id}" aria-label="Delete invoice">✕</button></div></div>`).join('')
        : '<div class="card empty" style="color:#1D4A22;font-weight:600">Everyone’s paid up.</div>'}
      <div class="sec">Recently paid</div>
      <div class="card list">${paid.sort((a, b) => b.paidAt - a.paidAt).slice(0, 15).map((v) => `<div class="line"><div class="grow"><div>${esc(v.customerName)}</div><div class="muted small">Paid ${v.paidVia === 'square' ? 'by card ' : ''}${shortDate(ymd(new Date(v.paidAt)))}</div></div><b>${money(v.total)}</b>
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
  if (state.moneyTab === 'years') {
    const ys = pastYears(), now = today().slice(0, 4);
    body = `<div class="muted small">Every year before ${now}. On Jan 1, ${now} moves here on its own and Overview starts the new year.</div>
      ${ys.length ? ys.map((y) => { const st = yearStats(y); return `<div class="card" style="gap:10px"><div class="between"><div class="b" style="font-size:20px">${y}</div><div class="muted small">${st.visits.length} job${st.visits.length === 1 ? '' : 's'} · ${st.customers} customer${st.customers === 1 ? '' : 's'}</div></div>
        <div class="kpis"><div class="kpi in"><div class="lbl">Income</div><div class="n">${money(st.income)}</div></div>
          <div class="kpi"><div class="lbl">Expenses</div><div class="n">${money(st.expenses)}</div></div>
          <div class="kpi profit"><div class="lbl">Profit</div><div class="n">${st.profit < 0 ? '−' : ''}${money(Math.abs(st.profit))}</div></div></div>
        <div class="muted small">Billed ${money(st.billed)}${st.unpaid > 0.004 ? ` · ${money(st.unpaid)} from ${y} still unpaid` : ''}</div>
        <button class="btn btn-ghost" data-a="yearCsv" data-y="${y}">Download ${y} (CSV, every line item)</button></div>`; }).join('')
        : `<div class="card empty">No past years yet. Your first one shows up here on Jan 1, ${Number(now) + 1}.</div>`}`;
  }
  return `<div class="seg">${tab('overview', 'Overview')}${tab('unpaid', 'Unpaid')}${tab('expenses', 'Expenses')}${tab('years', 'Past years')}</div>${body}`;
}

/* ----- Quotes ----- */
// New-quote form, or editing an existing quote (q). Custom items take any description and price.
// q = a saved quote being edited; draft = a new quote filled in from a customer.
function quoteForm(q, draft) {
  const src = q || draft;
  const v = (k, d = '') => esc(src ? (src[k] ?? d) : d);
  const n = (x) => (x ? String(x) : '');
  const opt = (val, label, cur) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${label}</option>`;
  return `<div class="card"><div class="b" style="font-size:17px">${q ? 'Edit quote' : draft ? `New quote for ${esc(draft.name)}` : 'New quote'}</div>${!q && draft ? `<div class="muted small">Filled in from their customer page. Change anything; when they accept, it’s linked to ${esc(first(draft.name))}’s account. <button class="link" data-a="quoteDraftClear">Start blank instead</button></div>` : ''}
      <label class="f"><span class="lbl">Name</span><input class="inp" id="q_name" value="${v('name')}"></label>
      ${addrFields('q', src)}
      <label class="f"><span class="lbl">Phone</span><input class="inp" id="q_phone" inputmode="tel" value="${v('phone')}"></label>
      <div class="grid2"><label class="f"><span class="lbl">Mowing per cut ($)</span><input class="inp" id="q_grass" inputmode="decimal" placeholder="Leave blank if none" value="${esc(n(src?.grassPrice))}"></label>
        <label class="f"><span class="lbl">How often</span><select class="inp" id="q_freq">${['Weekly', 'Every 2 weeks', 'On call', 'One time'].map((f) => opt(f, f, src?.freq || 'Weekly')).join('')}</select></label></div>
      <div class="grid2"><label class="f"><span class="lbl">Snow base price ($, includes ${snowIncl()}")</span><input class="inp" id="q_snow" inputmode="decimal" placeholder="Leave blank if none" value="${esc(n(src?.snowPrice))}"></label>
        <label class="f"><span class="lbl">Snow plan</span><select class="inp" id="q_snowPlan">${opt('perSnow', 'Per visit', src?.snowPlan || 'perSnow')}${opt('seasonal', 'Season', src?.snowPlan)}</select></label></div>
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
const QUOTE_FIELDS = ['q_name', 'q_address', 'q_city', 'q_state', 'q_zip', 'q_phone', 'q_grass', 'q_freq', 'q_snow', 'q_snowPlan', 'q_notes'];
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
  return { name: val('q_name').trim(), ...addrData('q'), phone: val('q_phone'), grassPrice: num(val('q_grass')), freq: val('q_freq'),
    snowPrice: num(val('q_snow')), snowPlan: val('q_snowPlan'), addons: quoteExtras(), notes: val('q_notes') };
}
const resetQuoteForm = () => { state.quoteSel = []; state.quoteLines = [{ d: '', a: '' }]; state.quoteEdit = false; state.quoteDraft = null; };
function viewQuotes() {
  const q = state.quoteId && state.quotes.find((x) => x.id === state.quoteId);
  if (q && state.quoteEdit) return `<button class="link" data-a="cancelQuoteEdit">← Back to quote</button>${quoteForm(q)}`;
  if (q) {
    const qLines = quoteLinesOf(q), total = quoteTotal(qLines);
    return `<button class="link" data-a="quoteBack">← All quotes</button>
      <div class="card"><div class="between"><div class="b" style="font-size:18px">${esc(q.name)}</div>${pill(q.status === 'Sent' ? 'p-green' : q.status === 'Accepted' ? 'p-blue' : 'p-orange', q.status)}</div>
        <div class="muted">${[fullAddr(q), q.phone].filter(Boolean).map(esc).join(' · ')}</div>
        <div class="card list" style="border:0;padding:0">
          ${q.grassPrice ? `<div class="line"><span>Mowing - ${esc(q.freq.toLowerCase())} (per cut)</span><span>${money(q.grassPrice)}</span></div>` : ''}
          ${q.snowPrice ? `<div class="line"><span>Snow - ${q.snowPlan === 'seasonal' ? 'season' : `per visit (includes up to ${snowIncl()}")`}</span><span>${money(q.snowPrice)}</span></div>` : ''}
          ${qLines.filter((l) => !/^(Lawn mowing|Snow removal)/.test(l.desc)).map((l) => `<div class="line"><span${l.optional || l.perUnit ? ' class="muted"' : ''}>${esc(l.desc)}</span><span>${money(l.amount)}</span></div>`).join('')}
          ${q.grassPrice && q.snowPrice ? '' : `<div class="line b"><span>Total${qLines.some((l) => l.optional) ? ' (without optional add-ons)' : ''}</span><span>${money(total)}</span></div>`}</div>
        ${q.notes ? `<div style="white-space:pre-line">${esc(q.notes)}</div>` : ''}
        <button class="btn btn-ghost" data-a="editQuote" data-id="${q.id}">Edit quote</button>
        <button class="btn btn-primary" data-a="sendQuote" data-id="${q.id}">${q.status === 'Sent' ? 'Send again' : 'Send quote (PDF)'}</button>
        ${q.acceptedAt ? `<div class="okbar">✓ Accepted online ${shortDate(ymd(new Date(q.acceptedAt)))} by ${esc(q.acceptedName || q.name)}${q.acceptedPhone ? ' · ' + esc(q.acceptedPhone) : ''}</div>` : ''}
        ${q.customerId && cust(q.customerId) ? `<button class="btn btn-lime" data-a="quoteToCustomer" data-id="${q.id}">Open ${esc(first(cust(q.customerId).name))}’s customer page</button>`
          : `<button class="btn btn-ghost" data-a="quoteToCustomer" data-id="${q.id}">They said yes: make them a customer</button>`}
        ${q.token && !q.acceptedAt ? `<div class="muted small">They can accept with the link in the text or the green button in the PDF. You’ll get an email when they do.</div>` : ''}
        <button class="link danger" data-a="delQuote" data-id="${q.id}">Delete quote</button></div>`;
  }
  return `${quoteForm(null, state.quoteDraft)}
    <div class="sec">Recent quotes</div>
    ${state.quotes.length ? [...state.quotes].sort((a, b) => b.createdAt - a.createdAt).map((q) => `<button class="rowbtn" data-a="openQuote" data-id="${q.id}"><div class="grow"><div class="b">${esc(q.name)}</div><div class="muted">${shortDate(q.date)}</div></div>${q.acceptedAt && !q.acceptedSeen ? pill('p-green', 'New: accepted') : pill(q.status === 'Sent' ? 'p-green' : q.status === 'Accepted' ? 'p-blue' : 'p-orange', q.status)}</button>`).join('') : '<div class="card empty">No quotes yet.</div>'}`;
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
  // One row per person: staff by login, customers grouped by account (e.g. Joe with two emails, or husband and wife).
  const people = [];
  users.forEach((u) => {
    const c = u.role === 'customer' && u.customerId && cust(u.customerId);
    const row = c && people.find((r) => r.cid === c.id);
    if (row) row.logins.push(u); else people.push({ cid: c ? c.id : null, name: c ? bothNames(c) : u.name, role: u.role, logins: [u] });
  });
  const msg = (k, title, hint) => fold('msg_' + k, title, hint, field(k, 'Text', '', true), true);
  return [
    fold('addons', 'Add-ons', `${addonsOf('grass').length} grass · ${addonsOf('snow').length} snow`, `<div class="muted">Extras for a job or a quote. Grass add-ons show on mows (and can be built into a customer’s cut); snow add-ons show on snow visits.</div>
      ${['grass', 'snow'].map((k) => `<div class="lbl">${k === 'grass' ? 'Grass add-ons' : 'Snow & ice add-ons'}</div>
        ${k === 'snow' && num(s.snowPerInch) ? `<div class="line"><span><span class="b">Additional inch</span> <span class="muted small">over ${wholeInches(s.snowIncluded)}", added automatically from the inches you enter (change in Snow pricing)</span></span><span>${money(s.snowPerInch)}</span></div>` : ''}
        ${addonsOf(k).length ? `<div class="card list" style="border:0;padding:0">${addonsOf(k).map((a) => `<div class="line"><span class="b">${esc(a.name)}</span><span class="flex"><span>${money(a.price)}</span>
          <button class="link" style="min-height:32px;margin-left:8px" data-a="addonKind" data-id="${a.id}" data-k="${k === 'grass' ? 'snow' : 'grass'}">Move to ${k === 'grass' ? 'snow' : 'grass'}</button>
          <button class="link danger" style="min-height:32px;margin-left:8px" data-a="delAddon" data-id="${a.id}">Remove</button></span></div>`).join('')}</div>` : '<div class="muted small">None yet.</div>'}`).join('')}
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px"><label><span class="sr">Add-on name</span><input class="inp" id="a_name" placeholder="e.g. Edge sidewalk"></label>
        <label><span class="sr">Default price</span><input class="inp" id="a_price" inputmode="decimal" placeholder="$"></label>
        <label><span class="sr">Type</span><select class="inp" id="a_kind"><option value="grass">Grass</option><option value="snow">Snow</option></select></label></div>
      <button class="btn btn-ghost" data-a="addAddon">+ Create add-on</button>`),
    fold('payments', 'Payments', `Zelle${s.zelleQr ? ' + QR' : ''}${s.venmo ? ', Venmo' : ''}`, `${field('zelle', 'Zelle (phone or email)')}
      <div><div class="lbl">Zelle QR code</div>${s.zelleQr ? `<div class="qr"><img src="${esc(s.zelleQr)}" alt="Zelle QR code"></div><button class="link danger" data-a="removeZelleQr">Remove QR</button>` : '<div class="muted small">Save your QR from your bank app’s Zelle screen, then upload it here.</div>'}
        <label class="btn btn-ghost full" style="margin-top:6px">Upload Zelle QR<input type="file" accept="image/*" data-change="zelleQr" class="sr"></label></div>
      ${field('venmo', 'Venmo link (business)', 'e.g. venmo.com/u/PrecisionCutLawns')}
      <label class="check"><input type="checkbox" data-setting="squareOn" ${s.squareOn ? 'checked' : ''}> Card &amp; Apple Pay through Square</label>
      <label class="check"><input type="checkbox" data-setting="cardFeeOption" ${s.cardFeeOption !== false ? 'checked' : ''}> Let customers choose to cover the 3.3% card fee</label>
      <a class="btn btn-ghost" href="https://app.squareup.com/dashboard" target="_blank" rel="noopener">Open Square</a>
      <div class="muted small">Adds a “Pay with card / Apple Pay” button to customers’ invoices and a pay link to invoice texts. Paid invoices are marked paid by themselves. Square keeps 3.3% + 30¢ per card payment.</div>
      <div class="muted small">Customers see these with a QR code and a Pay button in their account. Venmo shows once it’s filled in.</div>`),
    fold('business', 'Business info', esc(s.businessPhone), `${field('businessPhone', 'Phone on quotes and invoices')}${field('businessEmail', 'Email on quotes and invoices')}${field('businessAddress', 'Address on quotes and invoices')}${field('website', 'Website link', 'Add your website')}`),
    fold('snowprice', 'Snow pricing', `${num(s.snowIncluded)}" included · ${money(s.snowPerInch)}/inch over`, `<div class="muted small">For per-snow customers. When you mark a snow job done, type the inches; anything over the included inches is added to that invoice.</div>
      <div class="grid2">${field('snowIncluded', 'Inches included')}${field('snowPerInch', 'Price per extra inch ($)')}</div>`),
    fold('skips', 'Skips', `Deadline: ${esc(deadlineText(weekStart(new Date())))}`, `<div class="muted small">Customers get 1 free skip a month. They can skip until:</div>
      <div class="grid2"><label class="f"><span class="lbl">Day</span><select class="inp" data-setting="skipDay">${DAYS.map((d, i) => `<option value="${i}" ${Number(s.skipDay) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label class="f"><span class="lbl">Time</span><input class="inp" type="time" data-setting="skipTime" value="${esc(s.skipTime)}"></label></div>`),
    fold('messages', 'Messages', 'The texts the app writes for you', `<div class="muted small">Fill-ins: {first} first name, {total}, {zelle}, {venmo}, {link} app link, {week}, {deadline}, {phone}, {date}, {email}.</div>
      ${msg('reminderMsg', 'Weekly reminder', 'Wednesdays, with the skip link')}${msg('oncallMsg', 'On-call text', '“Would you like your grass cut today?”')}
      ${msg('invoiceMsg', 'Invoice text', 'Sent with the PDF when they owe. How to pay is added for you.')}${msg('paidMsg', 'Paid receipt text', 'Sent with the PDF when it’s paid')}
      ${fold('msg_receipt', 'Receipt text', s.receiptEnabled ? 'On' : 'Off', `<label class="check"><input type="checkbox" data-setting="receiptEnabled" ${s.receiptEnabled ? 'checked' : ''}> Offer a receipt text when I mark Paid</label>${field('receiptMsg', 'Text', '', true)}`, true)}
      ${msg('quoteMsg', 'Quote text', 'Sent with the quote PDF')}${msg('welcomeCustomer', 'Customer welcome', 'Sent with their invite')}${msg('welcomeCrew', 'Crew welcome', 'Sent with their invite')}
      ${customMsgs().map((m) => fold('cmsg_' + m.id, esc(m.title || 'Untitled'), 'My message', `<label class="f"><span class="lbl">Name</span><input class="inp" data-cmsg="${esc(m.id)}" data-field="title" value="${esc(m.title)}" placeholder="e.g. Spring sign-up"></label>
        <label class="f"><span class="lbl">Text</span><textarea class="inp" data-cmsg="${esc(m.id)}" data-field="body" rows="6">${esc(m.body)}</textarea></label>
        <button class="btn btn-primary" data-a="sendSaved" data-id="${esc(m.id)}">Send</button>
        <button class="link danger" style="align-self:flex-start;min-height:32px" data-a="delCustomMsg" data-id="${esc(m.id)}">Delete this message</button>`, true)).join('')}
      <div class="muted small">Your own messages can also use {invite} (a sign-up link just for that person), {name} full name and {website}.</div>
      <button class="btn btn-ghost" data-a="addCustomMsg">+ New message</button>`),
    fold('users', 'Users', `${people.length} with access${openInvites.length ? ` · ${openInvites.length} open invite${openInvites.length === 1 ? '' : 's'}` : ''}`, `<div class="b">Invite someone</div>
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
      <div class="card list" style="padding:0 0 0 0;border:0">${people.map((r) => `<div class="line" style="align-items:flex-start"><div class="grow"><div class="b">${esc(r.name)}</div>
          ${r.logins.map((u) => `<div class="between"><span class="muted small">${esc(u.id)}${r.logins.length > 1 && u.name && u.name !== r.name ? ' · ' + esc(u.name) : ''}</span>
            ${u.id !== state.user.email ? `<button class="link danger" style="min-height:32px;margin-left:10px" data-a="removeUser" data-email="${esc(u.id)}">Remove</button>` : ''}</div>`).join('')}
          ${r.logins.length > 1 ? `<div class="muted small">${r.logins.length} logins, one account</div>` : ''}</div>
        ${pill(r.role === 'admin' ? 'p-green' : r.role === 'crew' ? 'p-blue' : 'p-gray', r.role[0].toUpperCase() + r.role.slice(1))}</div>`).join('')}</div>`),
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
  const L = ledgerFor(c.id);
  const openSnow = state.requests.find((r) => r.type === 'snow' && r.status !== 'done');
  const openMow = state.requests.find((r) => r.type === 'mow' && r.status !== 'done');
  const myMsgs = state.requests.filter((r) => !r.custHidden).sort((a, b) => lastAt(b) - lastAt(a));
  const newMsgs = myMsgs.filter(unreadForCust).length;
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
      const myExtra = stop?.extra && stop.status === 'scheduled';
      if (!status) inner = `<div class="muted">No mow this week. Every-2-weeks: you’re on next week.</div>
        ${c.grassPlan === 'biweekly' && grassWeek(wk) ? `<button class="btn btn-ghost" data-a="custExtra">Grass growing fast? Add an extra cut this week</button><div class="muted small">${priceOf(c.id).grass ? money(priceOf(c.id).grass) + ', added' : 'Added'} to your bill. Your regular weeks stay the same.</div>` : ''}`;
      else if (myExtra) inner = `<div class="okbar">Extra cut this week (${esc(weekLabel(wk))})</div>
        ${stop.addedBy === 'customer' ? '<button class="link danger" style="min-height:36px" data-a="custExtraCancel">Cancel the extra cut</button>' : ''}`;
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
        <div class="muted small">${priceOf(c.id).snow ? money(priceOf(c.id).snow) + ' per visit, ' : 'Each visit '}${snowTerms()}.</div>
        ${!snowSeason() && !openSnow ? '<div class="muted">Snow season is October to March.</div>' : openSnow ? `<div class="okbar">Snow removal requested ${shortDate(ymd(new Date(openSnow.at)))}. I’m on it!</div>` : `<div class="muted">Need your snow cleared? Tap below and I’ll get you on the list.</div><button class="btn btn-lime" data-a="custRequest" data-type="snow">Request snow removal</button>`}</div>`;
  }
  app.innerHTML = `${demoBar()}
    <header class="top"><div class="top-row">${brand()}<button class="link" data-a="signOut">Sign out</button></div>
      <h1>Hi ${esc(first(state.account?.name || c.name))}!</h1><div class="sub">${esc(fullAddr(c))}</div></header>
    <main class="no-tabs">
      ${newMsgs ? `<a class="okbar" href="#msgs" style="text-decoration:none">You have ${newMsgs} new message${newMsgs === 1 ? '' : 's'} from Jace. Tap to read.</a>` : ''}
      ${grassCard}${snowCard}
      <div class="sec">Your balance</div>
      <div class="card"><div class="between"><div class="b">Balance</div><div class="big">${money(L.owe)}</div></div>
        ${L.credit > 0.004 ? `<div class="okbar">You have ${money(L.credit)} credit toward upcoming visits.</div>` : ''}
        ${L.owe > 0 ? `${s.squareOn ? `<button class="btn btn-primary" data-a="payCard" data-cid="${c.id}">Pay ${money(L.owe)} with card / Apple Pay</button>` : ''}
          ${L.unpaid.every((v) => v.customerSaysPaid) ? '<div class="okbar">Thanks! I’ll confirm once it comes through.</div>' : `<button class="btn btn-ghost" data-a="custPaid" data-cid="${c.id}">I’ve paid my balance (Zelle / Venmo)</button>`}`
          : '<div class="okbar">You’re all paid up. Thank you!</div>'}
        ${L.rows.length ? `<div class="lbl" style="margin-top:6px">History this year</div>${ledgerHtml(statementRows(c.id).rows.slice(-12).reverse())}` : ''}
</div>
      ${statementsCard(c, false)}
      <div class="sec">How to pay</div>
      <div class="card">
        ${venmoUrl ? `<a class="btn btn-primary" href="${esc(venmoUrl)}" target="_blank" rel="noopener">Pay with Venmo</a><div class="qr">${qrSvg(venmoUrl)}</div>` : ''}
        <div class="between"><div><div class="b">Zelle</div><div>${esc(s.zelle)}</div></div><button class="btn btn-ghost btn-sm" data-a="copyZelle">Copy</button></div>
        ${s.zelleQr ? `<div class="qr"><img src="${esc(s.zelleQr)}" alt="Zelle QR code"></div><div class="muted small center">Scan with your bank app’s Zelle option.</div>` : '<div class="muted small">Open your bank app, choose Zelle, and send to the number above.</div>'}
      </div>
      <div class="sec" id="msgs">Messages${newMsgs ? ` · ${newMsgs} new` : ''}</div>
      ${myMsgs.map((r) => `<div class="card ${unreadForCust(r) ? 'unread' : ''}"><div class="between"><div class="b">${r.fromAdmin ? 'From Jace' : REQ_LABEL[r.type]}</div>${unreadForCust(r) ? pill('p-green', 'New') : r.status === 'done' && !r.fromAdmin ? pill('p-gray', 'Handled') : ''}</div>
        ${threadHtml(r, 'customer')}
        <div class="flex wrap"><button class="btn btn-primary btn-sm" data-a="openReply" data-id="${r.id}">Reply</button>
          ${unreadForCust(r) ? `<button class="btn btn-ghost btn-sm" data-a="custSeen" data-id="${r.id}">Mark read</button>` : ''}
          <button class="link danger" style="min-height:32px;margin-left:auto" data-a="custHide" data-id="${r.id}">Delete</button></div></div>`).join('')}
      <div class="card"><div class="b">Message Jace</div><label class="f"><span class="sr">Message</span><textarea class="inp" id="m_text" placeholder="Questions, gate code changes, anything…"></textarea></label>
        <div class="flex"><button class="btn btn-primary grow" data-a="custRequest" data-type="message">Send in the app</button><a class="btn btn-ghost" href="${smsHref(s.businessPhone, '')}">Text instead</a></div></div>
      ${paid.length ? `<button class="link" data-a="togglePaid">${state.showPaidHistory ? 'Hide' : 'Show'} paid invoices (${paid.length})</button>
        ${state.showPaidHistory ? `<div class="card list">${paid.map((v) => `<div class="line"><div class="grow"><div>${shortDate(v.date)} · ${esc(chargeLabel(v))}</div></div><b>${money(v.total)}</b></div>`).join('')}</div>` : ''}` : ''}
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
    <label class="f"><span class="lbl">Email</span><input class="inp" id="au_email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(inviteEmail)}"></label>
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
    ? (state.waiting
      ? `<div class="okbar">Thanks, ${esc(first(state.waiting.name))}! Jace has your info and will let you in shortly. This page opens the app by itself once he does.</div>
        <div class="muted small center">Signed in as ${esc(state.user.email)}</div><button class="link center" data-a="signOut">Use a different account</button>`
      : `<p>Welcome to Precision Cut Lawns! What’s your name? Jace will get your account ready.</p>
        <label class="f"><span class="lbl">Your name</span><input class="inp" id="wait_name" autocomplete="name" value="${esc(state.user.name)}"></label>
        <button class="btn btn-primary" data-a="sendJoin">Send to Jace</button>
        <div class="muted small center">Signed in as ${esc(state.user.email)}</div><button class="link center" data-a="signOut">Use a different account</button>`)
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
    sh.inchOn = sh.type === 'snow' && c?.snowPlan !== 'seasonal' && num(settings().snowPerInch) > 0;
    const total = sheetTotal(sh), st = settings();
    inner = `<div><div class="b" style="font-size:20px">${esc(c.name)}</div><div class="muted">${esc(sh.desc)}</div></div>
      <label class="f"><span class="lbl">Price this time ($)</span><input class="inp" id="sh_price" inputmode="decimal" value="${esc(sh.price)}" data-input="sheetPrice"></label>
      <div class="muted small">Normal rate is ${money(sh.base)}. Changing it here only affects this invoice.</div>
      ${sh.inchOn ? `<label class="f"><span class="lbl">Inches of snow</span><input class="inp" id="sh_inches" type="number" inputmode="numeric" step="1" min="0" pattern="[0-9]*" value="${esc(sh.inches || '')}" placeholder="Whole inches, e.g. 5" data-input="sheetPrice"></label>
        <div class="muted small">Includes ${wholeInches(st.snowIncluded)}". Each inch over adds ${money(st.snowPerInch)}.<span id="sh_extra">${snowExtra(sh.inches) ? ` Extra: ${money(snowExtra(sh.inches))}` : ''}</span></div>` : ''}
      ${sh.kind === 'done' && sh.canDesc ? `<label class="f"><span class="lbl">${sh.job ? 'What was the job?' : 'Description'}</span><input class="inp" id="sh_desc" value="${esc(sh.desc)}" placeholder="${sh.job ? 'e.g. Fall cleanup' : ''}"></label>` : ''}
      ${(() => { const paidSel = `<label class="f"><span class="lbl">Paid already?</span><select class="inp" id="sh_paid">${[['', 'Not yet'], ['cash', 'Yes, cash'], ['zelle-venmo', 'Yes, Zelle/Venmo'], ['check', 'Yes, check'], ['square', 'Yes, card']].map(([v, l]) => `<option value="${v}" ${sh.paidVia === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
        return sh.job ? `<div class="grid2"><label class="f"><span class="lbl">Date done</span><input class="inp" id="sh_date" type="date" value="${esc(sh.date)}"></label>${paidSel}</div>` : paidSel; })()}
      ${creditOf(sh.cid) > 0.004 ? `<div class="okbar">${esc(first(c.name))} has ${money(creditOf(sh.cid))} credit. If it covers this, it’s paid from credit automatically (leave “Not yet”).</div>` : ''}
      <div class="lbl">Add-ons</div>
      ${state.addons.length ? `<div class="flex wrap">${(sh.type === 'grass' ? addonsOf('grass') : sh.type === 'snow' || sh.type === 'season' ? addonsOf('snow') : [...state.addons].sort(byName)).map((a) => `<button class="chip ${sh.sel.includes(a.id) ? 'on' : ''}" data-a="sheetAddon" data-id="${a.id}">${esc(a.name)} · ${money(a.price)}</button>`).join('')}</div>` : '<div class="muted small">No add-ons yet. Create them in Settings.</div>'}
      <div class="between b" style="font-size:18px;border-top:1px solid #ECEDEC;padding-top:10px"><span>Total</span><span id="sh_total">${money(total)}</span></div>
      ${sh.job ? `<button class="btn btn-primary" data-a="confirmDone">Save job</button><button class="btn btn-ghost" data-a="confirmDone" data-send="1">Save &amp; send invoice</button>` : `<button class="btn btn-primary" data-a="confirmDone" data-send="1">Done &amp; send</button>
      <button class="btn btn-ghost" data-a="confirmDone">Done, don’t send now</button>`}
      <div class="muted small">If it’s paid, the text is a thank-you receipt instead of a bill.</div>
      <button class="btn btn-ghost" data-a="closeSheet">Cancel</button>`;
  } else if (sh.kind === 'payment') {
    const c = cust(sh.cid), L = ledgerFor(sh.cid);
    inner = `<div><div class="b" style="font-size:20px">Payment from ${esc(c.name)}</div><div class="muted">${L.owe > 0 ? `Owes ${money(L.owe)} right now` : L.credit > 0 ? `Already has ${money(L.credit)} credit` : 'Paid up right now'}</div></div>
      <label class="f"><span class="lbl">Amount ($)</span><input class="inp" id="pay_amt" inputmode="decimal" placeholder="e.g. 160"></label>
      <div class="grid2"><label class="f"><span class="lbl">How</span><select class="inp" id="pay_via">${[['cash', 'Cash'], ['zelle-venmo', 'Zelle/Venmo'], ['check', 'Check'], ['square', 'Card']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <label class="f"><span class="lbl">Date</span><input class="inp" id="pay_date" type="date" value="${today()}"></label></div>
      <label class="f"><span class="lbl">Note (optional)</span><input class="inp" id="pay_note" placeholder="e.g. covers 4 mows"></label>
      <button class="btn btn-primary" data-a="savePayment">Save payment</button>
      <button class="btn btn-ghost" data-a="closeSheet">Cancel</button>`;
  } else if (sh.kind === 'remind') {
    const rows = grassRoute(state.week).filter((r) => r.status === 'scheduled' && r.c.grassPlan !== 'oncall');
    const s = settings();
    inner = `<div class="b" style="font-size:20px">Weekly reminders</div><div class="muted small">Tap each one. Messages opens with the reminder filled in, then tap send and come back.</div>
      ${rows.map((r) => { const body = fill(s.reminderMsg, { first: first(r.c.name), week: weekLabel(state.week), deadline: deadlineText(state.week), link: appLink() + '#skip', phone: s.businessPhone });
        return `<div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div><div class="b">${esc(r.c.name)}</div>${r.stop?.reminded ? '<div class="muted small">✓ Sent</div>' : ''}</div>
          ${r.c.phone ? `<a class="btn ${r.stop?.reminded ? 'btn-ghost' : 'btn-primary'} btn-sm" href="${smsHref(textTo(r.c), body)}" data-a="reminded" data-id="${r.id}" data-cid="${r.c.id}">${r.stop?.reminded ? 'Again' : 'Text'}</a>` : '<span class="muted small">No phone</span>'}</div>`; }).join('')}
      <button class="btn btn-ghost" data-a="closeSheet">Close</button>`;
  } else if (sh.kind === 'reply') {
    const r = sh.id && state.requests.find((x) => x.id === sh.id), c = cust(r?.customerId || sh.cid), admin = isAdmin();
    inner = `<div class="b" style="font-size:20px">${admin ? 'Message ' + esc(c?.name || r?.customerName || '') : 'Reply to Jace'}</div>
      ${r ? `<div class="flex" style="flex-direction:column;gap:8px;max-height:40vh;overflow:auto">${threadHtml(r, admin ? 'admin' : 'customer')}</div>` : `<div class="muted small">They’ll see it in their app under Messages.</div>`}
      <label class="f"><span class="sr">Message</span><textarea class="inp" id="rp_text" rows="4" placeholder="Type your message…"></textarea></label>
      <button class="btn btn-primary" data-a="sendReply">Send</button>
      ${admin && c?.phone ? '<div class="muted small">After you send, you can text them a heads-up to check the app.</div>' : ''}
      <button class="btn btn-ghost" data-a="closeSheet">Cancel</button>`;
  } else if (sh.kind === 'addWeek') {
    const on = new Set(grassRoute(state.week).filter((r) => r.status !== 'skipped').map((r) => r.c.id));
    const list = state.customers.filter((c) => c.active && !on.has(c.id)).sort(byName);
    inner = `<div class="b" style="font-size:20px">Add to week of ${esc(weekLabel(state.week))}</div><div class="muted small">For anyone who said yes, asked by text, or needs an extra mow. Use Skip on the route to take someone off.</div>
      ${list.map((c) => `<div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div class="grow"><div class="b">${esc(c.name)}</div><div class="muted small">${esc({ weekly: 'Weekly', biweekly: 'Every 2 weeks', oncall: 'On call' }[c.grassPlan] || (c.grass ? '' : 'No grass plan'))}</div></div>
        <button class="btn btn-lime btn-sm" data-a="addWeek" data-cid="${c.id}">Add</button></div>`).join('') || '<div class="muted">Everyone is already on this week.</div>'}
      <button class="btn btn-ghost" data-a="closeSheet">Done</button>`;
  } else if (sh.kind === 'payCard') {
    const L = ledgerFor(sh.cid), fee = Math.round((withFee(L.owe) - L.owe) * 100) / 100;
    inner = `<div class="b" style="font-size:20px">Pay by card or Apple Pay</div><div class="muted">Your balance: ${L.unpaid.length} visit${L.unpaid.length === 1 ? '' : 's'}, ${L.unpaid.map((v) => shortDate(v.date)).join(', ')}</div>
      <button class="btn btn-primary" data-a="payCardGo" data-cid="${sh.cid}" data-fee="0">Pay ${money(L.owe)}</button>
      <button class="btn btn-lime" data-a="payCardGo" data-cid="${sh.cid}" data-fee="1">Pay ${money(withFee(L.owe))} and cover the card fee</button>
      <div class="muted small">Optional: the card company charges Jace 3.3%. Covering it (${money(fee)}) is a kind extra, never required. Zelle and Venmo have no fee.</div>
      <button class="btn btn-ghost" data-a="closeSheet">Cancel</button>`;
  } else if (sh.kind === 'oncall') {
    const s = settings();
    const list = state.customers.filter((c) => c.active && c.grass && c.grassPlan === 'oncall' && !stopOf(`${state.week}_${c.id}`) && !mowAsked(c, state.week)).sort(byName);
    inner = `<div class="b" style="font-size:20px">On-call customers</div><div class="muted small">Text each one, then tap “Yes” for anyone who wants a mow. It adds them to this week.</div>
      ${list.map((c) => `<div class="between" style="border-top:1px solid #ECEDEC;padding-top:10px"><div class="b grow">${esc(c.name)}</div>
        ${c.phone ? `<a class="btn btn-ghost btn-sm" href="${smsHref(textTo(c), s.oncallMsg)}">Text</a>` : ''}<button class="btn btn-lime btn-sm" data-a="oncallYes" data-cid="${c.id}">Yes</button></div>`).join('') || '<div class="muted">Everyone’s been added this week.</div>'}
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
        ${c.phone ? `<a class="btn ${sh.sent[c.id] ? 'btn-ghost' : 'btn-primary'} btn-sm" href="${smsHref(textTo(c), fillMsg(m.body, c, sh.pending))}" data-a="bulkSent" data-cid="${c.id}">${sh.sent[c.id] ? 'Again' : 'Text'}</a>` : '<span class="muted small">No phone</span>'}</div>`).join('') || '<div class="muted">Everyone already has an account.</div>'}
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
function savePasses(st, passes) {
  const upd = { passes, visits: passes.length, status: passes.length ? 'done' : 'scheduled',
    ...(passes.length && !st.doneAt ? { doneAt: Date.now(), doneByName: state.account?.name || '' } : {}) };
  store.update('stops', st.id, upd);
  autoBillSnow({ ...st, ...upd });
}
// Every change on a snow card keeps that customer's invoice current, so it shows in Money right away.
function autoBillSnow(st) { if (isAdmin()) billSnowStop(st.id, st).catch((e) => console.error(e)); }
// Make or update this snow day's invoice for one customer. Paid invoices are never changed.
const snowInvoiceOf = {}; // stop id -> invoice id made this session (covers fast double taps)
async function billSnowStop(stopId, fresh) {
  const st = fresh || stopOf(stopId), c = st && cust(st.customerId); if (!c) return false;
  const ch = snowCharge(c, st);
  const vid = st.visitId || snowInvoiceOf[stopId];
  const old = vid && visitOf(vid);
  if (old && old.paid) return false;
  if (!(ch.total > 0)) {
    // Nothing to charge anymore (visits removed): drop the unpaid invoice.
    if (old) { delete snowInvoiceOf[stopId]; await store.remove('visits', old.id); await store.update('stops', stopId, { visitId: null }); return true; }
    return false;
  }
  if (old) {
    if (Math.abs(num(old.total) - ch.total) < 0.005 && old.desc === ch.desc) return false;
    await store.update('visits', old.id, { desc: ch.desc, price: ch.base, addons: ch.lines, total: ch.total, customerName: c.name });
    return true;
  }
  const v = createVisit({ customerId: c.id, type: 'snow', price: ch.base, addons: ch.lines, desc: ch.desc, stopId, date: st.date });
  snowInvoiceOf[stopId] = v.id;
  await store.update('stops', stopId, { visitId: v.id });
  return true;
}
function addSnowStop(cid, date) {
  const existing = snowStops(cid, date);
  if (existing.some((s) => s.status === 'scheduled')) return false; // already waiting on the list
  const visit = existing.length + 1;
  store.set('stops', `snow_${date}_${cid}${visit > 1 ? '_' + visit : ''}`, { customerId: cid, type: 'snow', status: 'scheduled', date, visit, weekId: weekStart(parseYmd(date)) });
  return true;
}
// ----- Snow day: one card per customer per day with inches, visits and salt counts -----
const dayStopId = (date, cid) => `snow_${date}_${cid}`;
// Add-ons are Grass or Snow. Older ones without a type count as Snow if the name says salt, ice or snow.
const addonKind = (a) => a?.kind || (/salt|ice|snow/i.test(a?.name || '') ? 'snow' : 'grass');
const addonsOf = (kind) => [...state.addons].filter((a) => addonKind(a) === kind).sort(byName);
const snowAddons = () => addonsOf('snow');
const dayInchesOf = (date) => { const s = state.stops.find((x) => x.type === 'snow' && x.date === date && x.inches != null && x.inches !== ''); return s ? wholeInches(s.inches) : ''; };
// Each visit that day with its inches, e.g. [3, 9]. (Older stops only had a visit count.)
const passesOf = (stop) => Array.isArray(stop?.passes) ? stop.passes.map(wholeInches) : Array(num(stop?.visits)).fill(wholeInches(stop?.inches));
// What a snow-day card bills. Per snow: EACH visit is the base price (covers up to the included inches)
// plus each inch over on that visit. Seasonal: visits are covered; only salt is billed. Salt: price × count.
function snowCharge(c, stop) {
  const st = settings(), passes = passesOf(stop), perSnow = c?.snowPlan !== 'seasonal', inc = wholeInches(st.snowIncluded);
  const lines = []; let base = 0;
  if (perSnow && passes.length) {
    base = passes.length * num(priceOf(c.id).snow);
    passes.forEach((inches, i) => { const over = Math.max(0, inches - inc); if (over && num(st.snowPerInch)) lines.push({ name: `Additional inch × ${over} (visit ${i + 1}: ${inches}", ${inc}" included)`, price: over * num(st.snowPerInch) }); });
  }
  for (const a of snowAddons()) { const n = num(stop?.addonCounts?.[a.id]); if (n > 0) lines.push({ name: `${a.name} × ${n}`, price: n * num(a.price) }); }
  const desc = `Snow removal · ${passes.length} visit${passes.length === 1 ? '' : 's'}${passes.length ? ` (${passes.map((x) => x + '"').join(', ')})` : ''}${perSnow ? ` · up to ${inc}" included per visit` : ' · seasonal'}`;
  const total = Math.round((base + lines.reduce((a, l) => a + l.price, 0)) * 100) / 100;
  return { base, lines, desc, total };
}
// Extra charge for deep snow on per-snow jobs: inches over the included amount × the per-inch price.
const wholeInches = (v) => Math.max(0, Math.round(num(v)));
const snowIncl = () => wholeInches(settings().snowIncluded);
const snowTerms = () => `includes up to ${snowIncl()}"${num(settings().snowPerInch) ? `; each additional inch ${money(settings().snowPerInch)}` : ''}`;
const snowExtra = (inches) => { const s = settings(); return Math.max(0, wholeInches(inches) - wholeInches(s.snowIncluded)) * num(s.snowPerInch); };
// Add-ons built into a customer's mow (edging, blowing…): counted on every cut, billed inside the lawn care line.
const builtIns = (c) => (Array.isArray(c?.addons) ? c.addons : []).map((id) => state.addons.find((a) => a.id === id)).filter((a) => a && addonKind(a) === 'grass');
const builtInTotal = (c) => builtIns(c).reduce((a, x) => a + num(x.price), 0);
const sheetTotal = (sh) => num(sh.price) + (sh.inchOn ? snowExtra(sh.inches) : 0) + sh.sel.reduce((a, id) => a + num((state.addons.find((x) => x.id === id) || {}).price), 0);
const snowDesc = (stop) => 'Snow removal' + ((stop?.visit || 1) > 1 ? ` - visit ${stop.visit}` : '');
const openText = (title, body, phone, link) => { state.sheet = { kind: 'text', title, body, phone, link }; renderSheet(); };
function makeInvite(role, customerId, forName = '', fresh = false) {
  let label = forName;
  // Reuse an open link for this customer instead of making another one (unless it's for a second person).
  const open = customerId && !fresh && state.invites.find((i) => i.customerId === customerId && !i.usedBy && i.role === role && !i.label);
  if (open) return sendInvite(open);
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
  const who = i.label ? first(i.label) : c ? first(c.name) : 'there';
  openText(c ? 'Invite for ' + who : i.role === 'crew' ? 'Crew invite link' : 'Customer invite link',
    fill(tpl, { first: who, link: inviteLink(i.id), email: '' }), textTo(c), inviteLink(i.id));
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
    location.href = smsHref(textTo(c) || sh.contactPhone || '', body);
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
    state.sheet = { kind: 'done', cid: c.id, stopId: el.dataset.id, stopData, type: kind, base, price: String(base), sel: kind === 'grass' ? builtIns(c).map((a) => a.id) : [], desc: kind === 'snow' ? snowDesc(stopOf(el.dataset.id)) : grassLabel(c) };
    renderSheet();
  },
  billStop(el) {
    const c = cust(el.dataset.cid), kind = el.dataset.kind;
    const base = kind === 'snow' ? num(priceOf(c.id).snow) : num(priceOf(c.id).grass);
    const stop = stopOf(el.dataset.id);
    state.sheet = { kind: 'done', cid: c.id, stopId: el.dataset.id, stopData: { status: 'done' }, type: kind, base, price: String(base), sel: kind === 'grass' ? builtIns(c).map((a) => a.id) : [], desc: kind === 'snow' ? snowDesc(stop) : grassLabel(c), date: stop?.date || (stop?.doneAt ? ymd(new Date(stop.doneAt)) : today()) };
    renderSheet();
  },
  otherWork(el) {
    state.sheet = { kind: 'done', cid: el.dataset.cid, stopId: null, type: 'other', base: 0, price: '', sel: [], desc: '', canDesc: true, job: true, date: today(), paidVia: '' };
    renderSheet();
  },
  sheetAddon(el) {
    state.sheet.price = val('sh_price'); if (state.sheet.canDesc) state.sheet.desc = val('sh_desc');
    if (state.sheet.job) state.sheet.date = val('sh_date') || today();
    state.sheet.paidVia = val('sh_paid');
    const id = el.dataset.id; const sel = state.sheet.sel;
    state.sheet.sel = sel.includes(id) ? sel.filter((x) => x !== id) : sel.concat(id);
    renderSheet();
  },
  async confirmDone(el) {
    const sh = state.sheet;
    const addons = sh.sel.map((id) => state.addons.find((a) => a.id === id)).filter(Boolean).map((a) => ({ name: a.name, price: num(a.price) }));
    let desc = sh.canDesc ? (val('sh_desc').trim() || sh.desc || 'Yard work') : sh.desc;
    sh.paidVia = val('sh_paid');
    if (sh.job) { sh.date = val('sh_date') || today(); if (!num(val('sh_price')) && !addons.length) return toast('Type the price first'); }
    if (sh.inchOn && wholeInches(sh.inches) > 0) {
      const st = settings(), inches = wholeInches(sh.inches), over = Math.max(0, inches - wholeInches(st.snowIncluded));
      desc += ` (${inches}", up to ${wholeInches(st.snowIncluded)}" included)`;
      if (over) addons.push({ name: `Additional inch × ${over} (${money(st.snowPerInch)} each)`, price: over * num(st.snowPerInch) });
    }
    let price = val('sh_price');
    if (sh.type === 'grass') {
      const bi = builtIns(cust(sh.cid)).filter((a) => sh.sel.includes(a.id));
      if (bi.length) {
        price = num(price) + bi.reduce((a, x) => a + num(x.price), 0);
        desc = `${desc} (with add-ons: ${bi.map((a) => a.name).join(', ')})`;
        for (let i = addons.length - 1; i >= 0; i--) if (bi.some((b) => b.name === addons[i].name && num(b.price) === num(addons[i].price))) addons.splice(i, 1);
      }
    }
    const v = createVisit({ customerId: sh.cid, type: sh.type, price, addons, desc, stopId: sh.stopId, date: sh.date || (sh.type === 'snow' ? state.snowDate : today()), skipCredit: !!sh.paidVia });
    if (sh.stopId) store.update('stops', sh.stopId, { ...sh.stopData, visitId: v.id });
    // A job they already paid for: record the payment the same day.
    if (sh.paidVia) await store.update('visits', v.id, { paid: true, paidAt: sh.job && sh.date !== today() ? parseYmd(sh.date).getTime() + 12 * 3600e3 : Date.now(), paidVia: sh.paidVia });
    state.sheet = null; renderSheet();
    if (sh.paidVia) { toast(sh.job ? 'Job saved as paid' : 'Done and paid'); if (el.dataset.send) await run(() => sendInvoice(visitOf(v.id) || { ...v, paid: true })); return; }
    if (el.dataset.send) await run(() => sendInvoice(v)); else toast('Saved. Send the invoice anytime.');
  },
  async sendInvoice(el) { const v = visitOf(el.dataset.id); if (v) await run(() => sendInvoice(v)); },
  adminSkip(el) { closeMowReqs(el.dataset.cid); store.update('stops', el.dataset.id, { customerId: el.dataset.cid, weekId: state.week, type: 'grass', status: 'skipped', skippedBy: 'admin', skippedAt: Date.now() }); },
  unskip(el) { store.update('stops', el.dataset.id, { status: 'scheduled', skippedBy: null, skippedAt: null }); },
  openReminders() { state.sheet = { kind: 'remind' }; renderSheet(); },
  reminded(el) { store.update('stops', el.dataset.id, { customerId: el.dataset.cid, weekId: state.week, type: 'grass', status: stopOf(el.dataset.id)?.status || 'scheduled', reminded: Date.now() }); },
  openOncall() { state.sheet = { kind: 'oncall' }; renderSheet(); },
  openAddWeek() { state.sheet = { kind: 'addWeek' }; renderSheet(); },
  addWeek(el) { const id = `${state.week}_${el.dataset.cid}`, old = stopOf(id), c = cust(el.dataset.cid);
    const extra = c?.grassPlan === 'biweekly' && !dueGrass(c, state.week);
    store.set('stops', id, { customerId: el.dataset.cid, weekId: state.week, type: 'grass', status: 'scheduled', manual: true, ...(extra ? { extra: true, addedBy: 'admin' } : {}), ...(old?.day != null ? { day: old.day } : {}) });
    toast('Added to this week'); renderSheet(); },
  oncallYes(el) { store.set('stops', `${state.week}_${el.dataset.cid}`, { customerId: el.dataset.cid, weekId: state.week, type: 'grass', status: 'scheduled' }); toast('Added to this week'); },
  startSnow() {
    const date = state.snowDate, inches = dayInchesOf(date);
    let n = 0;
    // Everyone signed up for snow (per snow and seasonal), plus anyone who asked in the app.
    const ids = new Set(state.customers.filter((x) => x.active && x.snow).map((x) => x.id));
    state.requests.filter((x) => x.type === 'snow' && x.status !== 'done').forEach((r) => { ids.add(r.customerId); store.update('requests', r.id, { status: 'done', handledAt: Date.now() }); });
    for (const cid of ids) {
      if (!cust(cid) || snowStops(cid, date).length) continue;
      store.set('stops', dayStopId(date, cid), { customerId: cid, type: 'snow', status: 'scheduled', date, visit: 1, visits: 0, addonCounts: {}, weekId: weekStart(parseYmd(date)), ...(inches !== '' ? { inches } : {}) });
      n++;
    }
    toast(n ? `${n} added to the snow list` : 'Everyone is already on the list');
  },
  snowCount(el) {
    const st = stopOf(el.dataset.id); if (!st) return;
    const k = el.dataset.k, d = Number(el.dataset.d);
    {
      const n = Math.max(0, num(st.addonCounts?.[k]) + d);
      const addonCounts = { ...(st.addonCounts || {}), [k]: n };
      store.update('stops', st.id, { addonCounts });
      autoBillSnow({ ...st, addonCounts });
    }
  },
  snowPassAdd(el) {
    const st = stopOf(el.dataset.id); if (!st) return;
    const d = dayInchesOf(st.date);
    savePasses(st, [...passesOf(st), d === '' ? 0 : d]);
  },
  snowPassUndo(el) { const st = stopOf(el.dataset.id); if (!st) return; const p = passesOf(st); if (!p.length) return; p.pop(); savePasses(st, p); },
  snowPassDel(el) { const st = stopOf(el.dataset.id); if (!st) return; const p = passesOf(st); p.splice(Number(el.dataset.i), 1); savePasses(st, p); },
  snowRemove(el) { if (!confirm('Take them off today\'s snow list?')) return; store.remove('stops', el.dataset.id); },
  async billSnow(el) { await run(() => billSnowStop(el.dataset.id)); toast('Invoice ready. Send it from the card or Money.'); },
  async billSnowAll() {
    const ids = state.stops.filter((s) => s.type === 'snow' && s.date === state.snowDate).map((s) => s.id);
    let n = 0; for (const id of ids) if (await billSnowStop(id)) n++;
    toast(n ? `${n} invoice${n === 1 ? '' : 's'} ready. Send them from Money.` : 'Nothing new to bill');
  },
  snowAgain(el) { addSnowStop(el.dataset.cid, state.snowDate); toast('Added another visit'); },
  reqToSnow(el) { state.routeSeg = 'snow'; const r = state.requests.find((x) => x.id === el.dataset.id); const date = state.snowDate;
    addSnowStop(r.customerId, date);
    store.update('requests', r.id, { status: 'done', handledAt: Date.now() }); toast('Added to snow day ' + shortDate(date)); },
  reqToWeek(el) { const r = state.requests.find((x) => x.id === el.dataset.id); const wk = weekStart(new Date());
    store.set('stops', `${wk}_${r.customerId}`, { customerId: r.customerId, weekId: wk, type: 'grass', status: 'scheduled' });
    store.update('requests', r.id, { status: 'done', handledAt: Date.now() }); toast('Added to this week'); },
  openReply(el) { state.sheet = { kind: 'reply', id: el.dataset.id || '', cid: el.dataset.cid || '' }; renderSheet(); document.getElementById('rp_text')?.focus(); },
  async sendReply() {
    const sh = state.sheet, text = val('rp_text').trim();
    if (!text) return toast('Type a message first');
    const admin = isAdmin(), at = Date.now();
    const msg = { by: admin ? 'admin' : 'customer', name: admin ? (state.account.name || 'Jace') : (state.customers[0]?.name || ''), text, at };
    const r = sh.id && state.requests.find((x) => x.id === sh.id);
    if (r) {
      // Jace answering a plain message handles it; the customer writing back puts it in Jace's inbox again.
      const upd = { replies: [...replies(r), msg], ...(admin ? { custHidden: false, ...(r.type === 'message' ? { status: 'done', handledAt: at } : {}) } : { status: 'open', custSeenAt: at }) };
      await store.update('requests', r.id, upd);
    } else {
      const c = cust(sh.cid);
      store.add('requests', { customerId: c.id, customerName: c.name, type: 'message', fromAdmin: true, text: '', replies: [msg], at, status: 'done' });
    }
    const phone = admin && textTo(cust(r?.customerId || sh.cid));
    state.sheet = null; renderSheet(); toast(admin ? 'Sent. They’ll see it in their app.' : 'Sent to Jace');
    if (phone) { openText('Message sent in the app', `Hi ${first(cust(r?.customerId || sh.cid)?.name)}, I sent you a message in the Precision Cut app: ${appLink()}`, phone); state.sheet.title = 'Sent in the app. Text them too?'; renderSheet(); }
  },
  custSeen(el) { store.update('requests', el.dataset.id, { custSeenAt: Date.now() }); },
  custHide(el) { if (!confirm('Delete this message from your app?')) return; store.update('requests', el.dataset.id, { custHidden: true, custSeenAt: Date.now() }); toast('Deleted'); },
  reqDel(el) { if (!confirm('Delete this for good?')) return; store.remove('requests', el.dataset.id); toast('Deleted'); },
  reqClearDone() {
    const done = state.requests.filter((r) => r.status === 'done'), seen = inboxAlerts().filter((a) => a.seen), n = done.length + seen.length;
    if (!confirm(`Delete ${n} old item${n === 1 ? '' : 's'} from your inbox (handled requests and messages, and alerts you’ve seen)?`)) return;
    done.forEach((r) => store.remove('requests', r.id)); seen.forEach(hideAlert); toast('Deleted');
  },
  alertDel(el) { hideAlert({ kind: el.dataset.kind, id: el.dataset.id }); toast('Deleted'); },
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
    const data = { name, name2: val('c_name2').trim(), phone: val('c_phone'), textAll: checked('c_textAll'), ...addrData('c'), email: val('c_email').trim().toLowerCase(), deck: val('c_deck'), active: checked('c_active'),
      grass: checked('c_grass'), grassPlan: val('c_grassPlan'), snow: checked('c_snow'), snowPlan: val('c_snowPlan'), needsDetails: false };
    // Read every field before writing: a write can redraw the screen.
    const pricing = { grass: num(val('c_pGrass')), snow: num(val('c_pSnow')), season: num(val('c_pSeason')) };
    const notes = { text: val('c_notes') };
    const id = existing ? existing.id : store.add('customers', { ...data, createdAt: Date.now() });
    if (existing) store.update('customers', id, data);
    store.set('pricing', id, pricing);
    store.set('notes', id, notes);
    // Keep the main person's login name in step; a second person's login keeps their own name.
    usersForCustomer(id).filter((u) => !existing || !u.name || u.name === existing.name).forEach((u) => store.update('users', u.id, { name }));
    if (store.mode === 'local') syncDemoCustomers();
    state.custId = id; state.editing = false; toast('Saved'); render();
  },
  async mergeCust() {
    const keep = cust(state.custId), dup = cust(val('merge_pick'));
    if (!keep) return; if (!dup) return toast('Pick the duplicate first');
    const has = (n) => state[n].filter((x) => x.customerId === dup.id);
    const logins = usersForCustomer(dup.id), visits = has('visits'), stops = has('stops'), reqs = has('requests');
    if (!confirm(`Merge “${bothNames(dup)}” into “${bothNames(keep)}”?\n\nMoves ${logins.length} login(s), ${visits.length} invoice(s), ${stops.length} route stop(s) and ${reqs.length} message(s)/request(s) to ${keep.name}, then deletes “${dup.name}”. This can't be undone.`)) return;
    await run(async () => {
      const k = keep.id, d = dup.id;
      for (const u of logins) await store.update('users', u.id, { customerId: k });
      for (const v of visits) await store.update('visits', v.id, { customerId: k, customerName: keep.name });
      for (const r of reqs) await store.update('requests', r.id, { customerId: k, customerName: keep.name });
      for (const i of state.invites.filter((x) => x.customerId === d)) await store.update('invites', i.id, { customerId: k });
      // Route stop ids include the customer id: re-file them under the kept customer (keep theirs if both have one).
      for (const st of stops) {
        const { id, ...data } = st;
        const nid = id.includes(d) ? id.split(d).join(k) : id;
        if (nid !== id) {
          if (!state.stops.some((x) => x.id === nid)) {
            await store.set('stops', nid, { ...data, customerId: k });
            for (const v of state.visits.filter((x) => x.stopId === id)) await store.update('visits', v.id, { stopId: nid });
          }
          await store.remove('stops', id);
        } else await store.update('stops', id, { customerId: k });
      }
      // Fill anything the kept customer is missing from the duplicate.
      const fill = {};
      ['phone', 'address', 'city', 'state', 'zip', 'email', 'deck'].forEach((f) => { if (!keep[f] && dup[f]) fill[f] = dup[f]; });
      if (!keep.name2 && dup.name.trim().toLowerCase() !== keep.name.trim().toLowerCase()) fill.name2 = dup.name2 || dup.name;
      if (!keep.grass && dup.grass) Object.assign(fill, { grass: true, grassPlan: dup.grassPlan });
      if (!keep.snow && dup.snow) Object.assign(fill, { snow: true, snowPlan: dup.snowPlan });
      if (Object.keys(fill).length) await store.update('customers', k, fill);
      const pk = priceOf(k), pd = priceOf(d), pf = {};
      ['grass', 'snow', 'season'].forEach((f) => { if (!num(pk[f]) && num(pd[f])) pf[f] = num(pd[f]); });
      if (Object.keys(pf).length) await store.update('pricing', k, pf);
      const nd = noteOf(d); if (nd) await store.set('notes', k, { text: [noteOf(k), nd].filter(Boolean).join('\n') });
      for (const n of ['customers', 'pricing', 'notes']) await store.remove(n, d);
      if (store.mode === 'local') syncDemoCustomers();
      toast(`Merged into ${keep.name}`); render();
    });
  },
  async deleteCust() {
    const c = cust(state.custId); if (!c) return;
    const logins = usersForCustomer(c.id);
    const upcoming = state.stops.filter((x) => x.customerId === c.id && x.status === 'scheduled');
    const invites = state.invites.filter((i) => i.customerId === c.id && !i.usedBy);
    if (!confirm(`Delete ${bothNames(c)} completely?\n\nRemoves their customer record, prices and notes, ${logins.length} app login${logins.length === 1 ? '' : 's'}, ${upcoming.length} upcoming route stop${upcoming.length === 1 ? '' : 's'} and ${invites.length} unused invite link${invites.length === 1 ? '' : 's'}.\n\nTheir past invoices stay in your money totals (you need them for taxes). This can't be undone.`)) return;
    ['customers', 'pricing', 'notes'].forEach((n) => store.remove(n, c.id));
    logins.forEach((u) => store.remove('users', u.id));
    upcoming.forEach((x) => store.remove('stops', x.id));
    invites.forEach((i) => store.remove('invites', i.id));
    state.custId = null; state.editing = false; toast(`${c.name} deleted`); render();
  },
  // Invite links (no email needed up front)
  inviteCustomer(el) { makeInvite('customer', el.dataset.cid); },
  inviteSecond(el) {
    const c = cust(el.dataset.cid); if (!c) return;
    const ans = c.name2 || prompt(`Who else on ${first(c.name)}'s account is this for?`, ''); if (ans === null) return;
    if (!c.name2 && ans.trim()) store.update('customers', c.id, { name2: ans.trim() });
    makeInvite('customer', c.id, ans.trim(), true);
  },
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
    openText('Welcome text', fill(tpl, { first: first(u.name), link: appLink(), email: u.id }), textTo(c));
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
    await store.update('visits', v.id, { paid: true, paidAt: Date.now(), paidVia: v.customerSaysPaid ? 'zelle-venmo' : 'cash' });
    toast('Marked paid');
    const s = settings(), c = cust(v.customerId);
    if (s.receiptEnabled && c?.phone) openText('Receipt for ' + first(v.customerName), fill(s.receiptMsg, { first: first(v.customerName), total: money(v.total), date: shortDate(v.date) }), textTo(c));
  },
  markUnpaid(el) { store.update('visits', el.dataset.id, { paid: false, paidAt: null, paidVia: null, payGroup: null, creditFrom: null }); },
  async markAllPaid(el) {
    const c = cust(el.dataset.cid), owed = state.visits.filter((v) => v.customerId === c.id && !v.paid);
    const total = owed.reduce((a, v) => a + num(v.total), 0);
    if (!confirm(`Mark all ${owed.length} of ${first(c.name)}'s invoices paid (${money(total)})?`)) return;
    const at = Date.now();
    for (const v of owed) await store.update('visits', v.id, { paid: true, paidAt: at, paidVia: v.customerSaysPaid ? 'zelle-venmo' : 'cash' });
    toast(`Marked ${owed.length} paid`);
  },
  async delVisit(el) {
    const v = visitOf(el.dataset.id); if (!v) return;
    if (!confirm(`Delete “${chargeLabel(v)}” on ${shortDate(v.date)} (${money(v.total)})${v.paid && !v.creditFrom ? ', and the payment recorded with it' : ''}? This can't be undone.`)) return;
    await store.remove('visits', v.id);
    if (v.stopId) store.update('stops', v.stopId, { visitId: null });
    // If it was paid from credit, that credit is free again for anything still owed.
    if (v.creditFrom) applyCredit(v.customerId, { visits: state.visits.filter((x) => x.customerId === v.customerId && x.id !== v.id) });
    toast('Deleted');
  },
  undoPayGroup(el) {
    const ids = (el.dataset.ids || '').split(',').filter(Boolean), vs = ids.map(visitOf).filter(Boolean);
    if (!vs.length || !confirm(`Delete this payment (${money(vs.reduce((a, v) => a + num(v.total), 0))})? The ${vs.length === 1 ? 'charge it paid goes' : vs.length + ' charges it paid go'} back to unpaid.`)) return;
    vs.forEach((v) => store.update('visits', v.id, { paid: false, paidAt: null, paidVia: null, payGroup: null, cardFeePaid: null }));
    toast('Payment deleted');
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
    state.visits.forEach((v) => rows.push(['Income', v.date, v.customerName, chargeLabel(v), v.total, v.invoiceNo, v.paidAt ? ymd(new Date(v.paidAt)) + ' ' + paidLabel(v.paidVia) : 'UNPAID']));
    (state.payments || []).forEach((p) => rows.push(['Payment received', p.date, cust(p.customerId)?.name || '', p.note || paidLabel(p.via), p.amount, '', paidLabel(p.via)]));
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
    const id = store.add('quotes', { ...d, ...(state.quoteDraft?.customerId ? { customerId: state.quoteDraft.customerId } : {}), date: today(), number: String(Date.now()).slice(-5), status: 'Draft', createdAt: Date.now() });
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
  openQuote(el) { const q = state.quotes.find((x) => x.id === el.dataset.id); if (q?.acceptedAt && !q.acceptedSeen) store.update('quotes', q.id, { acceptedSeen: true }); state.quoteId = el.dataset.id; render(); scrollTo(0, 0); },
  quoteBack() { state.quoteId = null; resetQuoteForm(); render(); },
  async sendQuote(el) {
    let q = state.quotes.find((x) => x.id === el.dataset.id); const s = settings();
    // Every quote gets its own private Accept link (saved before sending so it works right away).
    if (!q.token) { q = { ...q, token: (newId() + newId()).slice(0, 24) }; await store.update('quotes', q.id, { token: q.token }); }
    const text = fill(s.quoteMsg, { first: first(q.name), phone: s.businessPhone }) + (q.acceptedAt ? '' : `\n\nTo accept, tap here: ${quoteLink(q)}`);
    await run(async () => { if (await sharePdf(await quoteFile(q), text, q.phone)) { if (!q.acceptedAt) store.update('quotes', q.id, { status: 'Sent' }); } });
  },
  quoteToCustomer(el) {
    const q = state.quotes.find((x) => x.id === el.dataset.id);
    if (q.customerId && cust(q.customerId)) { state.tab = 'customers'; state.custId = q.customerId; state.quoteId = null; render(); scrollTo(0, 0); return; }
    const plan = { Weekly: 'weekly', 'Every 2 weeks': 'biweekly' }[q.freq] || 'oncall';
    const id = store.add('customers', { name: q.name, phone: q.phone, address: q.address || '', city: q.city || '', state: q.state || '', zip: q.zip || '', email: '', deck: '', active: true, grass: !!q.grassPrice, grassPlan: plan, snow: !!q.snowPrice, snowPlan: q.snowPlan, createdAt: Date.now() });
    store.set('pricing', id, { grass: q.grassPrice || 0, snow: q.snowPlan === 'perSnow' ? q.snowPrice || 0 : 0, season: q.snowPlan === 'seasonal' ? q.snowPrice || 0 : 0 });
    store.set('notes', id, { text: q.notes || '' });
    store.update('quotes', q.id, { status: 'Accepted', customerId: id });
    if (store.mode === 'local') syncDemoCustomers();
    state.tab = 'customers'; state.custId = id; state.quoteId = null; toast('Customer added'); render();
  },
  delQuote(el) { if (!confirm('Delete this quote?')) return; store.remove('quotes', el.dataset.id); state.quoteId = null; render(); },

  // Settings
  addAddon() { const name = val('a_name').trim(); if (!name) return toast('Give the add-on a name'); store.add('addons', { name, price: num(val('a_price')), kind: val('a_kind') || 'grass' }); toast('Add-on created'); },
  addonKind(el) { store.update('addons', el.dataset.id, { kind: el.dataset.k }); },
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
    const data = {}; ['customers', 'notes', 'pricing', 'stops', 'visits', 'requests', 'expenses', 'addons', 'quotes', 'users', 'payments'].forEach((k) => { data[k] = state[k]; });
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
  custExtra() {
    const c = state.customers[0], wk = weekStart(new Date());
    if (!confirm('Add an extra cut this week? It’s added to your bill. Your regular every-2-weeks schedule stays the same.')) return;
    store.set('stops', `${wk}_${c.id}`, { customerId: c.id, weekId: wk, type: 'grass', status: 'scheduled', extra: true, addedBy: 'customer', addedAt: Date.now() });
    toast('Extra cut added. See you this week!');
  },
  custExtraCancel() {
    const c = state.customers[0], wk = weekStart(new Date());
    if (!confirm('Cancel the extra cut this week?')) return;
    store.remove('stops', `${wk}_${c.id}`); toast('Extra cut cancelled');
  },
  custRequest(el) {
    const c = state.customers[0], s = settings(), type = el.dataset.type;
    const text = type === 'message' ? val('m_text').trim() : '';
    if (type === 'message' && !text) return toast('Type a message first');
    store.add('requests', { customerId: c.id, customerName: c.name, type, text, at: Date.now(), status: 'open' });
    if (type === 'message') { document.getElementById('m_text').value = ''; toast('Sent to Jace'); return; }
    const body = type === 'snow' ? `Hi Jace, it's ${c.name} at ${fullAddr(c)}. Could you clear my snow? (requested in the app)` : `Hi Jace, it's ${c.name} at ${fullAddr(c)}. Could you mow my lawn this week? (requested in the app)`;
    openText(type === 'snow' ? 'Snow removal requested' : 'Mow requested', body, s.businessPhone);
    state.sheet.title = (type === 'snow' ? 'Snow removal requested!' : 'Mow requested!') + ' Want to text Jace too?';
    renderSheet();
  },
  acceptQuote(el) { acceptQuotePage(el); },
  async sendStatement(el) { await run(() => sendInvoice(null, el.dataset.cid)); },
  yearCsv(el) { const y = el.dataset.y; download(`precision-cut-${y}.csv`, yearCsv(y), 'text/csv'); },
  alertSeen(el) { if (el.dataset.kind === 'quote') store.update('quotes', el.dataset.id, { acceptedSeen: true }); else store.update('invites', el.dataset.id, { seenAt: Date.now() }); },
  inboxQuote(el) { const q = state.quotes.find((x) => x.id === el.dataset.id); if (q && !q.acceptedSeen) store.update('quotes', q.id, { acceptedSeen: true }); state.tab = 'quotes'; state.quoteId = el.dataset.id; render(); scrollTo(0, 0); },
  custAddon(el) {
    const c = cust(el.dataset.cid); if (!c) return;
    const cur = Array.isArray(c.addons) ? c.addons : [], id = el.dataset.id;
    store.update('customers', c.id, { addons: cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id) });
  },
  custAddonNew(el) {
    const name = val('ca_name').trim(), price = num(val('ca_price')); if (!name) return toast('Name the add-on');
    const c = cust(el.dataset.cid), id = store.add('addons', { name, price, kind: 'grass' });
    store.update('customers', c.id, { addons: (Array.isArray(c.addons) ? c.addons : []).concat(id) }); toast(`${name} added (also saved in Settings)`);
  },
  quoteForCust(el) {
    const c = cust(el.dataset.cid); if (!c) return;
    const p = priceOf(c.id), a = splitAddr(c);
    resetQuoteForm();
    state.quoteDraft = { customerId: c.id, name: bothNames(c) || c.name, ...a, phone: c.phone || '', grassPrice: c.grass ? num(p.grass) : 0,
      freq: { weekly: 'Weekly', biweekly: 'Every 2 weeks', oncall: 'On call' }[c.grassPlan] || 'Weekly',
      snowPrice: c.snow ? num(c.snowPlan === 'seasonal' ? p.season : p.snow) : 0, snowPlan: c.snowPlan || 'perSnow', notes: '' };
    state.quoteSel = builtIns(c).map((x) => x.id);
    state.tab = 'quotes'; state.quoteId = null; render(); scrollTo(0, 0);
  },
  quoteDraftClear() { resetQuoteForm(); render(); },
  custSeg(el) { state.custSeg = el.dataset.v; render(); },
  openPayment(el) { state.sheet = { kind: 'payment', cid: el.dataset.cid }; renderSheet(); },
  async savePayment() {
    const cid = state.sheet.cid, amount = Math.round(num(val('pay_amt')) * 100) / 100;
    if (!(amount > 0)) return toast('Type the amount');
    const p = { customerId: cid, amount, via: val('pay_via'), date: val('pay_date') || today(), note: val('pay_note').trim(), at: Date.now() };
    const id = store.add('payments', p);
    state.sheet = null; renderSheet();
    await run(async () => {
      const n = await applyCredit(cid, { payments: [...paymentsOf(cid), { id, ...p }] });
      toast(`Payment saved${n ? ` · paid ${n} visit${n === 1 ? '' : 's'}` : ''}`);
    });
  },
  async delPayment(el) {
    const p = (state.payments || []).find((x) => x.id === el.dataset.id); if (!p) return;
    if (!confirm(`Remove the ${money(p.amount)} payment from ${shortDate(p.date)}? Visits it paid go back to unpaid (any other credit is reapplied).`)) return;
    await run(async () => {
      const cid = p.customerId;
      await store.remove('payments', p.id);
      const vs = state.visits.filter((v) => v.customerId === cid).map((v) => ({ ...v }));
      for (const v of vs) if (v.creditFrom && v.paid) { await store.update('visits', v.id, { paid: false, paidAt: null, paidVia: null, creditFrom: null }); v.paid = false; v.creditFrom = null; }
      await applyCredit(cid, { payments: paymentsOf(cid).filter((x) => x.id !== p.id), visits: vs });
      toast('Payment removed');
    });
  },
  extraCut(el) {
    const { cid, wk } = el.dataset;
    store.set('stops', `${wk}_${cid}`, { customerId: cid, weekId: wk, type: 'grass', status: 'scheduled', manual: true, extra: true, addedBy: 'admin' });
    toast(`Extra cut added for the week of ${weekLabel(wk)}`);
  },
  extraCutDel(el) { const { cid, wk } = el.dataset; store.remove('stops', `${wk}_${cid}`); toast('Extra cut removed'); },
  biSwitch(el) {
    const c = cust(el.dataset.cid), wk = el.dataset.wk; if (!c) return;
    if (!confirm(`Switch ${first(c.name)} to the week of ${weekLabel(wk)}? They’ll be mowed that week and every 2 weeks after.`)) return;
    store.update('customers', c.id, { biStart: wk, biFrom: weekStart(new Date()) }); toast(`${first(c.name)} now goes the week of ${weekLabel(wk)}`);
  },
  freshStatement(el) {
    const c = cust(el.dataset.cid); if (!c) return;
    if (statementBreaks(c).includes(today())) return toast('A statement already starts today');
    if (!confirm(`Start a separate statement for ${first(c.name)} from today? The one before stays saved and you can still open it. Anything owed carries over as one line.`)) return;
    store.update('customers', c.id, { statementBreaks: [...statementBreaks(c), today()].sort(), statementFrom: '' }); toast('New statement starts today');
  },
  joinStatement(el) {
    const c = cust(el.dataset.cid); if (!c || !confirm('Merge this statement back into the one before it?')) return;
    store.update('customers', c.id, { statementBreaks: statementBreaks(c).filter((d) => d !== el.dataset.d), statementFrom: '' }); toast('Merged');
  },
  async custPdf(el) { await run(async () => { const cid = el.dataset.cid, p = statementPeriods(cid).find((x) => x.start === el.dataset.start) || currentPeriod(cid); const f = await statementFile(cid, p); const url = URL.createObjectURL(f); window.open(url, '_blank') || (location.href = url); }); },
  payCard(el) {
    if (settings().cardFeeOption === false) return A.payCardGo(el);
    state.sheet = { kind: 'payCard', cid: el.dataset.cid }; renderSheet();
  },
  async payCardGo(el) {
    toast('Opening secure checkout…');
    await run(async () => { const { url } = await store.call('payBalance', { customerId: el.dataset.cid, coverFee: el.dataset.fee === '1' }); location.href = url; });
  },
  custPaid(el) {
    if (!confirm('Let Jace know you sent the payment?')) return;
    const at = Date.now();
    state.visits.filter((v) => v.customerId === el.dataset.cid && !v.paid && !v.customerSaysPaid).forEach((v) => store.update('visits', v.id, { customerSaysPaid: true, customerSaysPaidAt: at }));
    toast('Thanks! Jace will confirm.');
  },
  copyZelle() { navigator.clipboard?.writeText(settings().zelle).then(() => toast('Copied Zelle number')); },
  moneyPeriod(el) { state.moneyPeriod = el.dataset.v; render(); },
  togglePaid() { state.showPaidHistory = !state.showPaidHistory; render(); },

  // Auth
  async google() { await authRun(() => store.signInGoogle()); },
  async signIn() { const e = cleanEmail(val('au_email')), bad = emailProblem(e, val('au_email')); if (bad) { state.authMsg = bad; return render(); } await authRun(() => store.signIn(e, val('au_pw'))); },
  async signUp() {
    const e = cleanEmail(val('au_email')), pw = val('au_pw'), bad = emailProblem(e, val('au_email'));
    if (bad) { state.authMsg = bad; return render(); }
    if (pw.length < 6) { state.authMsg = 'Pick a password with at least 6 characters.'; return render(); }
    await authRun(() => store.signUp(e, pw));
  },
  authMode() { state.authModeSet = true; state.authMode = state.authMode === 'up' ? 'in' : 'up'; state.authMsg = ''; render(); },
  async joinApp() {
    const name = val('join_name').trim();
    if (!name) { state.authMsg = 'Type your name first.'; return render(); }
    let joinedRole;
    try {
      state.authMsg = '';
      if (store.mode === 'shared') {
        // The server connects them to the record Jace already made (by email or name), or asks Jace when unsure.
        const r = await store.call('joinInvite', { code: joinCode(), name });
        if (r.pending) {
          localStorage.removeItem(JOIN_KEY);
          state.waiting = { name }; state.access = 'none'; waitForApproval(); render();
          return;
        }
        joinedRole = r.role;
      } else joinedRole = await store.redeemInvite(joinCode(), state.user.email, name);
    } catch (e) {
      // The link was already used, cancelled, or couldn't be matched: send their name to Jace to approve.
      console.error(e);
      const code = joinCode();
      localStorage.removeItem(JOIN_KEY);
      try { await askToJoin(name, code); } catch (e2) { console.error(e2); state.authMsg = 'Something went wrong. Text Jace and he’ll get you in.'; checkAccess(); }
      return;
    }
    // Joined. Start the app fresh so their account opens the same way it does every other time.
    localStorage.removeItem(JOIN_KEY);
    app.innerHTML = '<p class="center muted" style="padding:40px">You’re in! Opening your account…</p>';
    if (store.mode === 'shared') await Promise.race([notifyJoined(name, state.user.email, joinedRole), new Promise((r) => setTimeout(r, 3000))]);
    location.replace(location.pathname);
  },
  async sendJoin() {
    const name = val('wait_name').trim();
    if (!name) { state.authMsg = 'Type your name first.'; return render(); }
    try { await askToJoin(name, ''); } catch (e) { console.error(e); state.authMsg = 'Something went wrong. Text Jace and he’ll get you in.'; render(); }
  },
  async approvePending(el) {
    const p = state.pending.find((x) => x.id === el.dataset.id); if (!p) return;
    const pick = document.getElementById('pend_' + p.id)?.value || 'new';
    await run(async () => {
      let cid = pick;
      if (pick === 'new') {
        cid = newId();
        await store.set('customers', cid, { name: p.name, email: p.id, phone: '', address: '', deck: '', active: true,
          grass: false, grassPlan: 'weekly', snow: false, snowPlan: 'perSnow', createdAt: Date.now(), joinedViaInvite: true });
      }
      await store.set('users', p.id, { name: p.name, role: 'customer', customerId: cid });
      const inv = p.invite && state.invites.find((i) => i.id === p.invite && !i.usedBy);
      if (inv) await store.update('invites', inv.id, { usedBy: p.id, usedAt: Date.now(), name: p.name });
      await store.remove('pending', p.id);
      toast(pick === 'new' ? `${p.name} is in. Add their address and plan.` : `${p.name} is in`);
      if (pick === 'new') { state.tab = 'customers'; state.custId = cid; state.editing = true; render(); }
    });
  },
  dismissPending(el) { if (!confirm('Remove this sign-up? They won’t get in.')) return; store.remove('pending', el.dataset.id); toast('Removed'); },
  async resetPw() { const e = cleanEmail(val('au_email')), bad = emailProblem(e, val('au_email')); if (bad) { state.authMsg = bad; return render(); } await authRun(async () => { await store.resetPassword(e); state.authMsg = 'Password reset email sent.'; }); },
  async claimSetup() { await authRun(async () => { await store.claimSetup(state.user.email, val('setup_name').trim() || 'Jace'); await checkAccess(); }); },
  async signOut() { localStorage.removeItem('pc_demo_as'); state.locked = false; await store.signOut(); if (store.mode === 'local') location.reload(); },
};
async function run(fn) { try { await fn(); } catch (e) { console.error(e); toast(e.message || 'Something went wrong'); } }
async function authRun(fn) {
  try { state.authMsg = ''; await fn(); }
  catch (e) { state.authMsg = ({ 'auth/invalid-credential': 'Wrong email or password.', 'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/weak-password': 'Use at least 6 characters.', 'auth/invalid-email': 'That email address isn’t complete. It should look like name@gmail.com.', 'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.' })[e.code] || e.message; }
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
    const sh = state.sheet;
    if (el.id === 'sh_inches') sh.inches = el.value; else sh.price = el.value;
    document.getElementById('sh_total').textContent = money(sheetTotal(sh));
    const ex = document.getElementById('sh_extra'); if (ex) ex.textContent = snowExtra(sh.inches) ? ` Extra: ${money(snowExtra(sh.inches))}` : '';
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
  if (k === 'snowInches') { const v = el.value === '' ? '' : wholeInches(el.value); state.stops.filter((x) => x.type === 'snow' && x.date === state.snowDate).forEach((x) => store.update('stops', x.id, { inches: v })); }
  if (k === 'passInches') { const st = stopOf(el.dataset.id); if (st) { const p = passesOf(st); p[Number(el.dataset.i)] = wholeInches(el.value); savePasses(st, p); } }
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
// Back from Square checkout: thank them (Square tells the app it's paid a moment later).
if (location.hash === '#paid') { history.replaceState(null, '', location.pathname); setTimeout(() => toast('Thank you! Your payment went through. It shows as paid in a minute.'), 1500); }
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
/* ---------- Public quote page (#quote=<token>): no account needed ---------- */
const quoteToken = (() => { const m = location.hash.match(/quote=([A-Za-z0-9]+)/); return m ? m[1] : ''; })();
let pubQuote = null;
// Demo mode has no server: read and write this browser's saved quotes instead.
async function quoteCall(fn, data) {
  if (store.mode !== 'local') return store.call(fn, data);
  const all = JSON.parse(localStorage.getItem('pc_quotes') || '{}'), id = Object.keys(all).find((k) => all[k].token === data.token);
  if (!id) throw new Error('This quote is no longer available. Please text Jace for a new one.');
  let q = all[id];
  const until = ymd(new Date(parseYmd(q.date).getTime() + 30 * 864e5));
  if (fn === 'acceptQuote' && !q.acceptedAt) {
    if (today() > until) throw new Error('This quote has expired.');
    const cid = q.customerId || store.add('customers', { name: data.name, phone: data.phone, address: q.address || '', city: q.city || '', state: q.state || '', zip: q.zip || '', email: '', deck: '', active: true, grass: !!q.grassPrice,
      grassPlan: { Weekly: 'weekly', 'Every 2 weeks': 'biweekly' }[q.freq] || 'oncall', snow: !!q.snowPrice, snowPlan: q.snowPlan || 'perSnow', createdAt: Date.now(), fromQuote: id, needsDetails: true });
    if (!q.customerId) store.set('pricing', cid, { grass: q.grassPrice || 0, snow: q.snowPlan === 'perSnow' ? q.snowPrice || 0 : 0, season: q.snowPlan === 'seasonal' ? q.snowPrice || 0 : 0 });
    q = { ...q, status: 'Accepted', acceptedAt: Date.now(), acceptedName: data.name, acceptedPhone: data.phone, acceptedSeen: false, customerId: cid };
    await store.update('quotes', id, q);
  }
  const st = settings();
  return { ...q, until, expired: !q.acceptedAt && today() > until, business: { name: st.businessName, phone: st.businessPhone, email: st.businessEmail } };
}
function renderQuotePage(err = '') {
  const q = pubQuote, b = q?.business || {};
  const head = `<header class="top"><div class="top-row">${brand()}</div>${q ? `<h1>Your quote</h1><div class="sub">For ${esc(q.name)}${fullAddr(q) ? ' · ' + esc(fullAddr(q)) : ''}</div>` : ''}</header>`;
  if (!q) { app.innerHTML = `${head}<main class="no-tabs">${err ? `<div class="card"><div class="warnbar">${esc(err)}</div></div>` : '<p class="center muted" style="padding:40px">Loading your quote…</p>'}</main>`; return; }
  const lines = quoteLinesOf(q), total = quoteTotal(lines);
  let action;
  if (q.acceptedAt) action = `<div class="okbar">✓ Accepted ${shortDate(ymd(new Date(q.acceptedAt)))}${q.acceptedName ? ' by ' + esc(q.acceptedName) : ''}. Thank you! Precision Cut Lawns will contact you soon.</div>`;
  else if (q.expired) action = `<div class="warnbar">This quote expired ${shortDate(q.until)}. Text ${esc(b.phone)} for an updated one.</div>`;
  else action = `<div class="b">Accept this quote</div>
      <label class="f"><span class="lbl">Your name</span><input class="inp" id="qa_name" autocomplete="name" value="${esc(q.name)}"></label>
      <label class="f"><span class="lbl">Your phone number</span><input class="inp" id="qa_phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(q.phone || '')}"></label>
      ${err ? `<div class="warnbar">${esc(err)}</div>` : ''}
      <button class="btn btn-lime" data-a="acceptQuote">Accept quote</button>
      <div class="muted small">No account needed. Precision Cut Lawns will contact you soon to get you on the schedule.</div>`;
  app.innerHTML = `${head}<main class="no-tabs">
    <div class="card"><div class="between"><div class="muted small">Quote Q-${esc(q.number)} · ${shortDate(q.date)}</div><div class="muted small">Good until ${shortDate(q.until)}</div></div>
      <div class="list">${lines.map((l) => `<div class="line"><span${l.optional || l.perUnit ? ' class="muted"' : ''}>${esc(l.desc)}</span><b>${money(l.amount)}</b></div>`).join('')}
      ${q.grassPrice && q.snowPrice ? '' : `<div class="line b"><span>Estimated total</span><span>${money(total)}</span></div>`}</div>
      ${lines.some((l) => l.optional) ? `<div class="muted small">${OPTIONAL_NOTE}</div>` : ''}
      ${q.notes ? `<div style="white-space:pre-line">${esc(q.notes)}</div>` : ''}</div>
    <div class="card">${action}</div>
    <div class="muted small center">Questions? Call or text <a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></div></main>`;
}
async function openQuotePage() {
  renderQuotePage();
  try { pubQuote = await quoteCall('getQuote', { token: quoteToken }); renderQuotePage(); }
  catch (e) { console.error(e); renderQuotePage(e.message || 'Couldn’t load the quote. Check your signal and try again.'); }
}
async function acceptQuotePage(btn) {
  const name = val('qa_name').trim(), phone = val('qa_phone').trim();
  if (name.length < 2) return renderQuotePage('Type your name.');
  if (phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '').length !== 10) return renderQuotePage('Type a 10-digit phone number.');
  btn.disabled = true; btn.textContent = 'Accepting…';
  try {
    pubQuote = await quoteCall('acceptQuote', { token: quoteToken, name, phone }); renderQuotePage();
    // Same alert emails as sign-ups (FormSubmit): one for the quote, one for the new customer.
    const al = pubQuote.alert;
    if (al?.to) {
      const when = new Date().toLocaleString('en-US');
      await sendAlert(al.to, `Quote accepted: ${name}`, { Name: name, Phone: phone, Address: al.address || '(not on the quote)', Quote: `Q-${al.number}`, Prices: al.lines.join(' · '), Notes: al.notes || '-', When: when })
        .catch((e) => console.error('Quote alert NOT sent:', e?.message || e));
      if (al.isNew) await sendAlert(al.to, `New customer: ${name}`, { Name: name, Phone: phone, Address: al.address || '(add it)', From: `Accepted quote Q-${al.number}`, When: when,
        'Next step': 'Open the app > Customers > ' + name + ' > Edit to add their email, deck height and notes.' })
        .catch((e) => console.error('New customer alert NOT sent:', e?.message || e));
    }
  }
  catch (e) { console.error(e); renderQuotePage(e.message || 'Couldn’t accept. Check your signal and try again.'); }
}

(async function start() {
  checkForUpdate({ auto: true });
  // On a weak signal, say so instead of sitting on "Loading…" forever.
  const slow = setTimeout(() => { if (!store) app.innerHTML = '<p class="center muted" style="padding:40px">Still loading… weak signal? <button class="link" onclick="location.reload()">Try again</button></p>'; }, 12000);
  try { store = await createStore(showError); }
  catch (e) { console.error(e); clearTimeout(slow); return renderStartFail(); }
  clearTimeout(slow);
  if (quoteToken) return openQuotePage();
  store.onAuth((u) => {
    unsubs.forEach((x) => typeof x === 'function' && x()); unsubs = [];
    state.user = u; state.account = null; state.access = null; state.need = null;
    if (u) checkAccess(); else render();
  });
})();
