// Data + sign-in layer: Firebase (shared, live, real logins) when configured,
// localStorage demo mode (no login, this device only) otherwise.
import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function createStore(onError) {
  if (firebaseConfig.apiKey) return firebaseStore(onError);
  return localStore();
}

async function firebaseStore(onError) {
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-firestore.js'),
    import(FB + 'firebase-auth.js'),
  ]);
  const app = initializeApp(firebaseConfig);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  const fail = (e) => { console.error(e); onError?.(e); };
  const toUser = (u) => u && { email: (u.email || '').toLowerCase(), verified: u.emailVerified, name: u.displayName || '' };
  const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return {
    mode: 'shared',

    // ---- sign-in ----
    onAuth(cb) { au.onAuthStateChanged(auth, (u) => cb(toUser(u))); },
    signInGoogle() { return au.signInWithPopup(auth, new au.GoogleAuthProvider()); },
    signIn(email, pw) { return au.signInWithEmailAndPassword(auth, email, pw); },
    // continueUrl puts a "Continue" button on the "email confirmed" page that brings them back to the app.
    async signUp(email, pw, continueUrl) {
      const cred = await au.createUserWithEmailAndPassword(auth, email, pw);
      await au.sendEmailVerification(cred.user, continueUrl ? { url: continueUrl } : undefined);
    },
    resendVerification(continueUrl) { return au.sendEmailVerification(auth.currentUser, continueUrl ? { url: continueUrl } : undefined); },
    async reloadUser() {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true); // refresh so the database sees "verified"
      return toUser(auth.currentUser);
    },
    resetPassword(email) { return au.sendPasswordResetEmail(auth, email); },
    signOut() { return au.signOut(auth); },

    // ---- data ----
    watch(name, cb) { return fs.onSnapshot(fs.collection(db, name), (s) => cb(docs(s)), fail); },
    watchWhere(name, field, value, cb) {
      return fs.onSnapshot(fs.query(fs.collection(db, name), fs.where(field, '==', value)), (s) => cb(docs(s)), fail);
    },
    watchDoc(name, id, cb, onErr) {
      return fs.onSnapshot(fs.doc(db, name, id), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), onErr || fail);
    },
    async getDoc(name, id) {
      const s = await fs.getDoc(fs.doc(db, name, id));
      return s.exists() ? { id: s.id, ...s.data() } : null;
    },
    async claimSetup(email, name) {
      const b = fs.writeBatch(db);
      b.set(fs.doc(db, 'users', email), { name, role: 'admin' });
      b.set(fs.doc(db, 'meta', 'setup'), { owner: email, ts: Date.now() });
      await b.commit();
    },
    // Join from an invite link: creates their login record (and a new customer
    // record if the link wasn't for an existing customer) and marks the link used.
    async redeemInvite(code, email, name) {
      const inv = await this.getDoc('invites', code);
      if (!inv || inv.usedBy) throw Object.assign(new Error('This invite link was already used or cancelled. Ask Jace for a new one.'), { code: 'invite/used' });
      const b = fs.writeBatch(db);
      let cid = inv.customerId || null;
      if (inv.role === 'customer' && !cid) {
        cid = newId();
        b.set(fs.doc(db, 'customers', cid), { name, email, phone: '', address: '', deck: '', active: true,
          grass: false, grassPlan: 'weekly', snow: false, snowPlan: 'perSnow', createdAt: Date.now(), joinedViaInvite: true });
      }
      b.set(fs.doc(db, 'users', email), { name, role: inv.role, invite: code, ...(cid ? { customerId: cid } : {}) });
      b.update(fs.doc(db, 'invites', code), { usedBy: email, usedAt: Date.now(), name });
      await b.commit();
    },
    add(name, data) {
      const ref = fs.doc(fs.collection(db, name));
      fs.setDoc(ref, data).catch(fail);
      return ref.id;
    },
    set(name, id, data) { return fs.setDoc(fs.doc(db, name, id), data).catch(fail); },
    update(name, id, data) { return fs.setDoc(fs.doc(db, name, id), data, { merge: true }).catch(fail); },
    remove(name, id) { return fs.deleteDoc(fs.doc(db, name, id)).catch(fail); },
  };
}

// Demo mode: everything in this browser's localStorage. A switcher lets you view as admin, crew or a customer.
function localStore() {
  const key = (n) => 'pc_' + n;
  const subs = {};
  const read = (n) => { try { return JSON.parse(localStorage.getItem(key(n))) || {}; } catch { return {}; } };
  const list = (n) => Object.entries(read(n)).map(([id, v]) => ({ id, ...v }));
  const emit = (n) => (subs[n] || []).forEach((s) => s());
  const write = (n, obj) => { localStorage.setItem(key(n), JSON.stringify(obj)); emit(n); };
  window.addEventListener('storage', (e) => { if (e.key?.startsWith('pc_')) emit(e.key.slice(3)); });
  const sub = (n, fn) => { (subs[n] ??= []).push(fn); queueMicrotask(fn); };
  const set = (n, id, data) => { const o = read(n); o[id] = data; write(n, o); };
  const demoEmail = () => localStorage.getItem('pc_demo_as') || 'admin@demo';
  return {
    mode: 'local',
    onAuth(cb) { cb({ email: demoEmail(), verified: true, name: 'Demo' }); },
    signOut() { return Promise.resolve(); },
    watch(n, cb) { sub(n, () => cb(list(n))); },
    watchWhere(n, field, value, cb) { sub(n, () => cb(list(n).filter((d) => d[field] === value))); },
    watchDoc(n, id, cb) { sub(n, () => cb(list(n).find((d) => d.id === id) || null)); },
    async getDoc(n, id) { const v = read(n)[id]; return v ? { id, ...v } : null; },
    async claimSetup(email, name) { set('users', email, { name, role: 'admin' }); set('meta', 'setup', { owner: email }); },
    add(n, data) { const id = newId(); set(n, id, data); return id; },
    set: async (n, id, data) => set(n, id, data),
    async update(n, id, data) { const o = read(n); o[id] = { ...o[id], ...data }; write(n, o); },
    async remove(n, id) { const o = read(n); delete o[id]; write(n, o); },
  };
}
