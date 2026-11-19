/* 大日開發｜文字求助 正式版資料介面（Firebase Firestore）
 * 與試用版 help-api.js 同樣的 HelpAPI 函式；由 tools/bundle-help.mjs 以 esbuild 打包成 docs/help/api-fb.js。
 * 頁面需先設定 window.HELP_FB（Firebase 設定）與 window.HELP_ROLE（customer／staff）。
 *
 * 資料結構
 *   staff/{uid}                      管理室帳號對應的場站：{ site, active, name }（只在主控台建立）
 *   gates/{uid}                      客人建案頻率：{ lastCaseAt }
 *   cases/{uid_clientId}             案件（欄位見 CASE_FIELDS）
 *   cases/{id}/messages/{msgId}      訊息：{ from, text, at, cycle, uid, dev? }，建立後不可修改
 * 所有狀態轉換都在 transaction 內「重新讀取 → 檢查 → 寫入」，並由 firestore.rules 再驗一次。
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, doc, collection, query, where, orderBy, onSnapshot, runTransaction, serverTimestamp, getDoc
} from 'firebase/firestore';

(function () {
  const cfg = window.HELP_FB;
  if (!cfg || /[?&]demo=1/.test(location.search)) return;
  const role = window.HELP_ROLE === 'staff' ? 'staff' : 'customer';
  // 客人端與管理室端用不同的 app 名稱，同一個瀏覽器測試時兩邊的登入狀態不會互相覆蓋
  const app = initializeApp(cfg, 'dari-help-' + role);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const TS = ['createdAt', 'queuedAt', 'acceptedAt', 'workingAt', 'closedAt', 'lastCustomerAt', 'lastStaffAt'];

  function fail(code, cause) { const e = new Error(code); e.code = code; e.mine = true; if (cause) e.cause = cause; return e; }
  const OWN = ['notfound', 'closed', 'not_new', 'not_assignee', 'changed', 'expired', 'too_fast', 'no_login', 'no_staff'];
  function wrap(e) {
    const c = (e && e.code) || '';
    if (e && e.mine) return e;
    if (c === 'permission-denied' || c.endsWith('/permission-denied')) return fail('denied', e);
    if (c === 'unavailable' || c === 'failed-precondition' || c === 'deadline-exceeded' || c.includes('network')) return fail('offline', e);
    if (/wrong-password|invalid-credential|user-not-found|invalid-email|missing-password/.test(c)) return fail('bad_login', e);
    if (c.includes('too-many-requests')) return fail('too_many', e);
    if (OWN.indexOf(c) >= 0) return e;
    return fail('error', e);
  }
  const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (v || 0);
  function taipeiDay(t) { return new Date((t || Date.now()) + 8 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ''); }
  function toCase(s) {
    const d = s.data({ serverTimestamps: 'estimate' });
    const c = Object.assign({ id: s.id }, d);
    TS.forEach(k => { c[k] = ms(d[k]); });
    return c;
  }
  let ready = null;
  function authReady() {
    if (!ready) ready = new Promise(res => { const off = onAuthStateChanged(auth, u => { off(); res(u); }); });
    return ready.then(() => auth.currentUser);
  }
  async function me() {
    const u = await authReady();
    if (role === 'customer') {
      if (u && u.isAnonymous) return u;
      if (u) await signOut(auth);
      return (await signInAnonymously(auth)).user;
    }
    if (!u || u.isAnonymous) throw fail('no_login');
    return u;
  }
  const caseRef = id => doc(db, 'cases', id);
  const msgRef = (id, mid) => doc(db, 'cases', id, 'messages', mid);
  const sysMsg = (t, id, c, uid, text) => t.set(doc(collection(db, 'cases', id, 'messages')), { from: 'system', text: text, at: serverTimestamp(), cycle: c.cycle, uid: uid });
  const active = c => c.status === 'accepted' || c.status === 'working';
  const clip = (s, n) => String(s || '').trim().slice(0, n);

  const api = {
    mode: 'firebase',

    // 客人建立案件：案件 ID＝匿名身分＋clientId，重送同一次操作不會多建
    createCase: async function (o) {
      try {
        const u = await me();
        const id = u.uid + '_' + o.clientId;
        const text = clip(o.text, 500);
        let code = 'AH-' + taipeiDay() + '-' + o.clientId.slice(0, 4).toUpperCase();
        await runTransaction(db, async t => {
          const cs = await t.get(caseRef(id));
          if (cs.exists()) { code = cs.data().code; return; }
          const gate = doc(db, 'gates', u.uid);
          const gs = await t.get(gate);
          if (gs.exists() && Date.now() - ms(gs.data().lastCaseAt) < 30000) throw fail('too_fast');
          const now = serverTimestamp();
          t.set(caseRef(id), {
            customerUid: u.uid, clientId: o.clientId, code: code,
            site: o.site, siteName: clip(o.siteName, 60), device: clip(o.device, 30), category: o.category,
            status: 'new', open: true, cycle: 1, createdAt: now, queuedAt: now,
            acceptedAt: null, acceptedBy: '', acceptedUid: '', acceptedDev: '', assignVer: 0,
            workingAt: null, closedAt: null, closedDay: '', result: '',
            escalated: false, escalateFailed: false,
            custCount: 1, lastCustomerText: text, lastCustomerAt: now, lastCustomerMsg: o.clientId, lastStaffAt: null, lastStaffMsg: ''
          });
          t.set(msgRef(id, o.clientId), { from: 'customer', text: text, at: now, cycle: 1, uid: u.uid });
          t.set(gate, { lastCaseAt: now });
        });
        return { id: id, code: code };
      } catch (e) { throw wrap(e); }
    },

    // 監看單一案件（含訊息）；看不到（不是自己的案件）回傳 null；其他錯誤交給 onErr
    watchCase: function (id, cb, onErr) {
      let c, msgs = null, offs = [], stopped = false;
      const emit = () => { if (c === null) cb(null); else if (c && msgs) cb(Object.assign({}, c, { messages: msgs })); };
      const bad = e => { const w = wrap(e); if (w.code === 'denied') { c = null; emit(); } else if (onErr) onErr(w); };
      me().then(() => {
        if (stopped) return;
        offs.push(onSnapshot(caseRef(id), s => { c = s.exists() ? toCase(s) : null; emit(); }, bad));
        offs.push(onSnapshot(query(collection(db, 'cases', id, 'messages'), orderBy('at')), s => {
          msgs = s.docs.map(d => { const m = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, from: m.from, text: m.text, at: ms(m.at), cycle: m.cycle, clientMsgId: d.id }; });
          emit();
        }, e => { if (c !== null) bad(e); }));
      }).catch(bad);
      return () => { stopped = true; offs.forEach(f => f()); };
    },

    // 傳訊息：訊息 ID＝clientMsgId，已存在就當作成功；已結案拒收；管理室只有目前接手的裝置能回覆
    sendMessage: async function (id, from, text, clientMsgId, dev) {
      try {
        const u = await me();
        text = clip(text, 500);
        await runTransaction(db, async t => {
          const cs = await t.get(caseRef(id));
          if (!cs.exists()) throw fail('notfound');
          const m = await t.get(msgRef(id, clientMsgId));
          if (m.exists()) return;
          const c = cs.data();
          if (c.status === 'closed') throw fail('closed');
          if (from === 'staff') {
            if (c.status === 'new') throw fail('not_new');
            if (c.acceptedDev !== dev || c.acceptedUid !== u.uid) throw fail('not_assignee');
          }
          const doc_ = { from: from, text: text, at: serverTimestamp(), cycle: c.cycle, uid: u.uid };
          if (from === 'staff') doc_.dev = dev;
          t.set(msgRef(id, clientMsgId), doc_);
          if (from === 'customer') {
            t.update(caseRef(id), { custCount: (c.custCount || 0) + 1, lastCustomerText: text, lastCustomerAt: serverTimestamp(), lastCustomerMsg: clientMsgId });
          } else {
            const upd = { lastStaffAt: serverTimestamp(), lastStaffMsg: clientMsgId };
            if (c.status === 'accepted') { upd.status = 'working'; upd.workingAt = serverTimestamp(); }
            t.update(caseRef(id), upd);
          }
        });
        return true;
      } catch (e) { throw wrap(e); }
    },

    // 管理室登入：帳號必須在 staff 集合中、且 active＝true；場站由後台決定，不能自己選
    staffLogin: async function (email, password) {
      try {
        const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
        ready = Promise.resolve(cred.user);
        return await api.staffSession();
      } catch (e) { throw wrap(e); }
    },
    staffSession: async function () {
      const u = await authReady();
      if (!u || u.isAnonymous) return null;
      let s;
      try { s = await getDoc(doc(db, 'staff', u.uid)); } catch (e) { throw wrap(e); }
      if (!s.exists() || s.data().active !== true) { await signOut(auth); throw fail('no_staff'); }
      return { uid: u.uid, email: u.email, site: s.data().site || '', name: s.data().name || '', role: s.data().role === 'admin' ? 'admin' : 'site' };
    },
    staffLogout: function () { ready = Promise.resolve(null); return signOut(auth); },

    // 管理室清單：本場進行中的案件＋今天結案的案件（兩個查詢都只用等值條件，不需要另建索引）
    // 兩個清單各自更新：其中一個出錯，另一個照常運作；跨過臺北午夜時重新訂閱「今日結案」
    watchSite: function (site, cb, onErr) {
      let open = null, closed = [], offOpen = null, offClosed = null, timer = null, stopped = false, day = '';
      const emit = () => { if (!open) return; const map = {}; open.concat(closed).forEach(c => { map[c.id] = c; }); cb(Object.keys(map).map(k => map[k])); };
      const bad = e => { if (onErr) onErr(wrap(e)); };
      const col = collection(db, 'cases');
      function subClosed() {
        if (stopped) return;
        if (offClosed) offClosed();
        day = taipeiDay(); closed = [];
        offClosed = onSnapshot(query(col, where('site', '==', site), where('closedDay', '==', day)), s => { closed = s.docs.map(toCase); emit(); }, bad);
        const now = Date.now() + 8 * 3600e3, next = Math.floor(now / 864e5 + 1) * 864e5;
        clearTimeout(timer); timer = setTimeout(subClosed, next - now + 2000);
      }
      const vis = () => { if (!document.hidden && day && day !== taipeiDay()) subClosed(); };
      document.addEventListener('visibilitychange', vis);
      me().then(() => {
        if (stopped) return;
        offOpen = onSnapshot(query(col, where('site', '==', site), where('open', '==', true)), s => { open = s.docs.map(toCase); emit(); }, bad);
        subClosed();
      }).catch(bad);
      return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', vis); if (offOpen) offOpen(); if (offClosed) offClosed(); };
    },

    // 管理員：各場進行中的案件＋今天結案的案件（只讀）
    watchAll: function (cb, onErr) {
      let open = null, closed = [], offOpen = null, offClosed = null, timer = null, stopped = false;
      const emit = () => { if (!open) return; const map = {}; open.concat(closed).forEach(c => { map[c.id] = c; }); cb(Object.keys(map).map(k => map[k])); };
      const bad = e => { if (onErr) onErr(wrap(e)); };
      const col = collection(db, 'cases');
      function subClosed() {
        if (stopped) return;
        if (offClosed) offClosed();
        closed = [];
        offClosed = onSnapshot(query(col, where('closedDay', '==', taipeiDay())), s => { closed = s.docs.map(toCase); emit(); }, bad);
        const now = Date.now() + 8 * 3600e3, next = Math.floor(now / 864e5 + 1) * 864e5;
        clearTimeout(timer); timer = setTimeout(subClosed, next - now + 2000);
      }
      me().then(() => {
        if (stopped) return;
        offOpen = onSnapshot(query(col, where('open', '==', true)), s => { open = s.docs.map(toCase); emit(); }, bad);
        subClosed();
      }).catch(bad);
      return () => { stopped = true; clearTimeout(timer); if (offOpen) offOpen(); if (offClosed) offClosed(); };
    },

    accept: async function (id, by, dev) {
      try {
        const u = await me();
        return await runTransaction(db, async t => {
          const cs = await t.get(caseRef(id));
          if (!cs.exists()) throw fail('notfound');
          const c = cs.data();
          if (c.status !== 'new') return { ok: false, by: c.acceptedBy };
          t.update(caseRef(id), { status: 'accepted', acceptedAt: serverTimestamp(), acceptedBy: clip(by, 20) || '管理室', acceptedUid: u.uid, acceptedDev: dev, assignVer: (c.assignVer || 0) + 1 });
          sysMsg(t, id, c, u.uid, '管理室已接手');
          return { ok: true, by: by, ver: (c.assignVer || 0) + 1 };
        });
      } catch (e) { throw wrap(e); }
    },

    takeover: async function (id, by, dev, ver) {
      try {
        const u = await me();
        return await runTransaction(db, async t => {
          const cs = await t.get(caseRef(id));
          if (!cs.exists()) throw fail('notfound');
          const c = cs.data();
          if (!active(c)) return { ok: false, reason: 'state' };
          if (ver != null && c.assignVer !== ver) return { ok: false, reason: 'changed', by: c.acceptedBy };
          t.update(caseRef(id), { acceptedBy: clip(by, 20) || '管理室', acceptedUid: u.uid, acceptedDev: dev, assignVer: c.assignVer + 1 });
          sysMsg(t, id, c, u.uid, '已改由其他管理員協助');
          return { ok: true, ver: c.assignVer + 1 };
        });
      } catch (e) { throw wrap(e); }
    },

    close: async function (id, result, dev, ver) {
      try {
        const u = await me();
        await runTransaction(db, async t => {
          const cs = await t.get(caseRef(id));
          if (!cs.exists()) throw fail('notfound');
          const c = cs.data();
          if (!active(c)) throw fail(c.status === 'closed' ? 'closed' : 'not_new');
          if (c.acceptedDev !== dev || c.acceptedUid !== u.uid || (ver != null && c.assignVer !== ver)) throw fail('not_assignee');
          t.update(caseRef(id), { status: 'closed', open: false, closedAt: serverTimestamp(), closedDay: taipeiDay(), result: clip(result, 100) });
          sysMsg(t, id, c, u.uid, /^(問題已排除|已於現場確認問題排除)/.test(result) ? '本次協助已完成' : '本次對話已結束');
        });
        return true;
      } catch (e) { throw wrap(e); }
    },

    // 客人「仍需要協助」：結案 30 分鐘內、同一輪才有效，開新的一輪並重算等待時間
    reopen: async function (id, text, cycle, clientMsgId) {
      try {
        const u = await me();
        text = clip(text || '我仍需要協助', 500);
        await runTransaction(db, async t => {
          const cs = await t.get(caseRef(id));
          if (!cs.exists()) throw fail('notfound');
          const m = await t.get(msgRef(id, clientMsgId));
          if (m.exists()) return;
          const c = cs.data();
          if (c.status !== 'closed' || (cycle != null && c.cycle !== cycle)) throw fail('changed');
          if (Date.now() - ms(c.closedAt) >= 30 * 60 * 1000) throw fail('expired');
          const now = serverTimestamp();
          t.update(caseRef(id), {
            status: 'new', open: true, cycle: c.cycle + 1, queuedAt: now,
            acceptedAt: null, acceptedBy: '', acceptedUid: '', acceptedDev: '', workingAt: null, closedAt: null, closedDay: '', result: '',
            escalated: false, escalateFailed: false,
            custCount: (c.custCount || 0) + 1, lastCustomerText: text, lastCustomerAt: now, lastCustomerMsg: clientMsgId
          });
          t.set(msgRef(id, clientMsgId), { from: 'customer', text: text, at: now, cycle: c.cycle + 1, uid: u.uid });
        });
        return true;
      } catch (e) { throw wrap(e); }
    },

    // 逾時通知備援由伺服器排程負責，瀏覽器不能寫入
    markEscalated: function () { return Promise.resolve(false); },
    resetDemo: function () {}
  };

  window.HelpAPI = api;
  window.dispatchEvent(new Event('helpapi'));
})();
