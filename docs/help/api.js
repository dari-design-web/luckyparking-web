/* 大日開發｜文字求助 資料介面
 * 客人端與管理室端只透過 HelpAPI 存取資料；試用版存在本機（同一台裝置、同一個瀏覽器的分頁之間即時同步），
 * 正式版改接 Firebase Firestore（同樣的函式介面）。
 *
 * 案件 case：{ id, code, site, siteName, device, category, status, escalated, createdAt, acceptedAt, acceptedBy,
 *              workingAt, closedAt, result, reopened, messages: [{ id, from, text, at }] }
 *   status：new（已送出、待接手）→ accepted（已接手）→ working（處理中）→ closed（已完成）
 *   from：customer／staff／system
 *   escalated：逾時無人接手、已成功通知備援；escalateFailed：通知備援失敗（客人端改提示使用現場求助）
 */
(function (global) {
  'use strict';
  var KEY = 'dari-help-demo-v1';
  var listeners = [];
  var bc = ('BroadcastChannel' in global) ? new BroadcastChannel(KEY) : null;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { seq: 0, cases: {} }; }
    catch (e) { return { seq: 0, cases: {} }; }
  }
  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
    if (bc) bc.postMessage('changed');
    notify();
  }
  function notify() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  global.addEventListener('storage', function (e) { if (e.key === KEY) notify(); });
  if (bc) bc.onmessage = notify;
  function on(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function today() { var d = new Date(); return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function delay(v) { return new Promise(function (ok) { setTimeout(function () { ok(v); }, 250 + Math.random() * 250); }); }

  var demo = {
    mode: 'demo',
    // 客人建立案件；clientId 相同的重送只建立一次
    createCase: function (o) {
      var db = load();
      var dup = Object.keys(db.cases).map(function (k) { return db.cases[k]; }).filter(function (c) { return c.clientId === o.clientId; })[0];
      if (dup) return delay(clone(dup));
      db.seq += 1;
      var now = Date.now();
      var c = {
        id: uid(), code: 'AH-' + today() + '-' + ('000' + db.seq).slice(-4), clientId: o.clientId,
        site: o.site, siteName: o.siteName, device: o.device || '', category: o.category || '其他',
        status: 'new', escalated: false, createdAt: now, acceptedAt: 0, acceptedBy: '', workingAt: 0, closedAt: 0, result: '', reopened: 0,
        messages: [{ id: uid(), from: 'customer', text: o.text, at: now, clientMsgId: o.clientId }]
      };
      db.cases[c.id] = c; save(db);
      return delay(clone(c));
    },
    watchCase: function (id, cb) {
      var last = '';
      function run() { var c = load().cases[id]; var s = JSON.stringify(c || null); if (s !== last) { last = s; cb(c ? clone(c) : null); } }
      run(); return on(run);
    },
    sendMessage: function (id, from, text, clientMsgId) {
      var db = load(), c = db.cases[id];
      if (!c) return Promise.reject(new Error('notfound'));
      if (c.messages.some(function (m) { return m.clientMsgId && m.clientMsgId === clientMsgId; })) return delay(true);
      if (from === 'staff' && c.status === 'new') return Promise.reject(new Error('not_accepted'));
      c.messages.push({ id: uid(), from: from, text: text, at: Date.now(), clientMsgId: clientMsgId });
      if (from === 'staff' && c.status === 'accepted') { c.status = 'working'; c.workingAt = Date.now(); }
      save(db); return delay(true);
    },
    // 管理室：試用版不驗證密碼，正式版改為各場帳號登入，由後端只回傳本場案件
    staffLogin: function (site, name) { return delay({ site: site, name: name || '值班人員' }); },
    watchSite: function (site, cb) {
      var last = '';
      function run() {
        var db = load(), list = Object.keys(db.cases).map(function (k) { return db.cases[k]; }).filter(function (c) { return c.site === site; });
        var s = JSON.stringify(list); if (s !== last) { last = s; cb(clone(list)); }
      }
      run(); return on(run);
    },
    // 接手：只有「待接手」的案件可以接，先接先贏；dev 是這台裝置的代號，用來分辨誰接的
    accept: function (id, by, dev) {
      var db = load(), c = db.cases[id];
      if (!c) return Promise.reject(new Error('notfound'));
      if (c.status !== 'new') return delay({ ok: false, by: c.acceptedBy });
      c.status = 'accepted'; c.acceptedAt = Date.now(); c.acceptedBy = by; c.acceptedDev = dev || '';
      c.messages.push({ id: uid(), from: 'system', text: '管理室已接手', at: Date.now() });
      save(db); return delay({ ok: true, by: by });
    },
    // 改由我接手（原接手人員手機沒電、離開時用）
    takeover: function (id, by, dev) {
      var db = load(), c = db.cases[id];
      if (!c) return Promise.reject(new Error('notfound'));
      if (c.status === 'new' || c.status === 'closed') return delay({ ok: false, by: c.acceptedBy });
      c.acceptedBy = by; c.acceptedDev = dev || '';
      c.messages.push({ id: uid(), from: 'system', text: '已改由其他管理員協助', at: Date.now() });
      save(db); return delay({ ok: true, by: by });
    },
    close: function (id, result) {
      var db = load(), c = db.cases[id];
      if (!c) return Promise.reject(new Error('notfound'));
      c.status = 'closed'; c.closedAt = Date.now(); c.result = result;
      c.messages.push({ id: uid(), from: 'system', text: '本次協助已完成', at: Date.now() });
      save(db); return delay(true);
    },
    reopen: function (id, text) {
      var db = load(), c = db.cases[id];
      if (!c) return Promise.reject(new Error('notfound'));
      c.status = 'new'; c.reopened += 1; c.acceptedAt = 0; c.acceptedBy = ''; c.acceptedDev = ''; c.escalated = false; c.escalateFailed = false;
      c.messages.push({ id: uid(), from: 'customer', text: text || '我仍需要協助', at: Date.now() });
      save(db); return delay(true);
    },
    // 試用版用來模擬「逾時通知備援」；正式版由伺服器排程判斷
    markEscalated: function (id) {
      var db = load(), c = db.cases[id];
      if (!c || c.status !== 'new' || c.escalated) return Promise.resolve(false);
      c.escalated = true; c.messages.push({ id: uid(), from: 'system', text: '已通知備援人員', at: Date.now() });
      save(db); return Promise.resolve(true);
    },
    resetDemo: function () { localStorage.removeItem(KEY); if (bc) bc.postMessage('changed'); notify(); }
  };

  global.HelpAPI = demo;
})(window);
