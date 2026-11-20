/* 大日開發｜文字求助 資料介面
 * 客人端與管理室端只透過 HelpAPI 存取資料。試用版存在本機（同一個瀏覽器的分頁之間即時同步），
 * 正式版改接 Firebase Firestore，函式介面相同，畫面不必改。
 *
 * 案件 case：{ id, code, clientId, site, siteName, device, category,
 *   status, cycle, createdAt, queuedAt, acceptedAt, acceptedBy, acceptedDev, assignVer, workingAt, closedAt, result,
 *   escalated, escalateFailed, history: [{ cycle, closedAt, result }], messages: [{ id, from, text, at, cycle, clientMsgId }] }
 *   status：new（已送出、待接手）→ accepted（已接手）→ working（處理中）→ closed（已完成）
 *   cycle：第幾輪求助；結案後客人按「仍需要協助」會開新的一輪，queuedAt 重新起算
 *   assignVer：接手版本；每次接手或改由他人接手都會加 1，舊版本的回覆與結案會被拒絕
 *   escalated：逾時無人接手、已成功通知備援；escalateFailed：通知備援失敗
 * 失敗一律以 Promise reject(Error(code)) 回傳：notfound／closed／not_new／not_assignee／changed／storage
 */
(function (global) {
  'use strict';
  var KEY = 'dari-help-demo-v1';
  var listeners = [];
  var curRole = '';   // 試用版：這個分頁登入的是跨場管理員（admin）或場站管理室
  var bc = ('BroadcastChannel' in global) ? new BroadcastChannel(KEY) : null;

  function load() {
    var db; try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    db = db || { seq: 0, cases: {} };
    db.presence = db.presence || {};
    db.accounts = db.accounts || [{ uid: 'demo-minquan', account: 'minquan', name: '民權公園管理室', site: 'minquan', role: '', active: true, disabled: false, createdAt: Date.now(), lastLoginAt: 0 }];
    db.settings = db.settings || { timeoutMin: 3, defaultEmails: [], sites: {} };
    db.log = db.log || [];
    return db;
  }
  function notify() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  global.addEventListener('storage', function (e) { if (e.key === KEY) notify(); });
  if (bc) bc.onmessage = notify;
  function on(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function today() { var d = new Date(); return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  // 與正式版相同的摘要欄位：open（未結案）、custCount（客人訊息數）、lastCustomerText（最後一則客人訊息）
  function derive(c) {
    var cm = c.messages.filter(function (m) { return m.from === 'customer'; });
    c.open = c.status !== 'closed'; c.custCount = cm.length; c.lastCustomerText = cm.length ? cm[cm.length - 1].text : '';
    return c;
  }
  function fail(code) { var e = new Error(code); e.code = code; throw e; }
  // 每個寫入都「重新讀取 → 檢查 → 寫回」，錯誤一律轉成被拒絕的 Promise（含本機空間不足）
  function tx(fn) {
    return new Promise(function (ok, no) {
      setTimeout(function () {
        try {
          var db = load(), r = fn(db);
          try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { fail('storage'); }
          if (bc) bc.postMessage('changed');
          notify(); ok(r);
        } catch (e) { no(e); }
      }, 200 + Math.random() * 250);
    });
  }
  function get(db, id) { var c = db.cases[id]; if (!c) fail('notfound'); return c; }
  function sys(c, text) { c.messages.push({ id: uid(), from: 'system', text: text, at: Date.now(), cycle: c.cycle }); }
  function active(c) { return c.status === 'accepted' || c.status === 'working'; }

  var demo = {
    mode: 'demo',
    // 客人建立案件；同一場站、同一個 clientId 的重送只建立一次
    createCase: function (o) {
      return tx(function (db) {
        var dup = Object.keys(db.cases).map(function (k) { return db.cases[k]; })
          .filter(function (c) { return c.clientId === o.clientId && c.site === o.site; })[0];
        if (dup) return clone(dup);
        db.seq += 1;
        var now = Date.now();
        var c = {
          id: uid(), code: 'AH-' + today() + '-' + ('000' + db.seq).slice(-4), clientId: o.clientId,
          site: o.site, siteName: o.siteName, device: o.device || '', category: o.category || '其他',
          status: 'new', cycle: 1, createdAt: now, queuedAt: now, acceptedAt: 0, acceptedBy: '', acceptedDev: '', assignVer: 0,
          workingAt: 0, closedAt: 0, result: '', escalated: false, escalateFailed: false, history: [],
          messages: [{ id: uid(), from: 'customer', text: String(o.text).slice(0, 500), at: now, cycle: 1, clientMsgId: o.clientId }]
        };
        db.cases[c.id] = c;
        return clone(c);
      });
    },
    watchCase: function (id, cb) {
      var last = '';
      function run() { var c = load().cases[id]; var s = JSON.stringify(c || null); if (s !== last) { last = s; cb(c ? derive(clone(c)) : null); } }
      run(); return on(run);
    },
    // 傳訊息：同一個 clientMsgId 只收一次（已收過就直接回成功）；已結案拒收；管理室只有目前的接手裝置能回覆
    sendMessage: function (id, from, text, clientMsgId, dev) {
      return tx(function (db) {
        var c = get(db, id);
        if (c.messages.some(function (m) { return m.clientMsgId && m.clientMsgId === clientMsgId; })) return true;
        if (c.status === 'closed') fail('closed');
        if (from === 'staff') {
          if (c.status === 'new') fail('not_new');
          if (c.acceptedDev !== dev) fail('not_assignee');
        }
        c.messages.push({ id: uid(), from: from, role: from === 'staff' && curRole === 'admin' ? 'admin' : '', text: String(text).slice(0, 500), at: Date.now(), cycle: c.cycle, clientMsgId: clientMsgId });
        if (from === 'staff' && c.status === 'accepted') { c.status = 'working'; c.workingAt = Date.now(); }
        return true;
      });
    },
    // 管理室：試用版選場站即可、不驗證密碼；正式版為帳號密碼登入，場站由後台指定
    staffLogin: function (site, name) { curRole = site === '*' ? 'admin' : 'site'; return Promise.resolve({ site: site === '*' ? '' : site, name: name || '值班人員', role: site === '*' ? 'admin' : 'site' }); },
    staffSession: function () { return Promise.resolve(null); },
    staffLogout: function () { curRole = ''; return Promise.resolve(); },
    // 試用版重新整理後恢復角色（正式版由登入身分決定）
    demoRole: function (r) { curRole = r === 'admin' ? 'admin' : 'site'; },
    watchSite: function (site, cb) {
      var last = '';
      function run() {
        var db = load(), list = Object.keys(db.cases).map(function (k) { return db.cases[k]; }).filter(function (c) { return c.site === site; });
        var s = JSON.stringify(list); if (s !== last) { last = s; cb(clone(list).map(derive)); }
      }
      run(); return on(run);
    },
    watchAll: function (cb) {
      var last = '';
      function run() {
        var db = load(), list = Object.keys(db.cases).map(function (k) { return db.cases[k]; });
        var s = JSON.stringify(list); if (s !== last) { last = s; cb(clone(list).map(derive)); }
      }
      run(); return on(run);
    },
    // 接手：只有待接手的案件能接，先接先贏；輸的一方拿到目前接手者
    accept: function (id, by, dev) {
      return tx(function (db) {
        var c = get(db, id);
        if (c.status !== 'new') return { ok: false, by: c.acceptedBy };
        c.status = 'accepted'; c.acceptedAt = Date.now(); c.acceptedBy = by; c.acceptedDev = dev; c.assignVer += 1;
        sys(c, curRole === 'admin' ? '跨場管理員已接手' : '管理室已接手');
        return { ok: true, by: by, ver: c.assignVer };
      });
    },
    // 改由我接手（原接手人員手機沒電、離開時用）；ver 是畫面上看到的接手版本，期間有變動就不執行
    takeover: function (id, by, dev, ver) {
      return tx(function (db) {
        var c = get(db, id);
        if (!active(c)) return { ok: false, reason: 'state' };
        if (ver != null && c.assignVer !== ver) return { ok: false, reason: 'changed', by: c.acceptedBy };
        c.acceptedBy = by; c.acceptedDev = dev; c.assignVer += 1;
        sys(c, curRole === 'admin' ? '已改由跨場管理員協助' : '已改由其他管理員協助');
        return { ok: true, ver: c.assignVer };
      });
    },
    // 結案：只有目前接手裝置、且版本相符才能結案（接手後可直接結案，現場處理不一定要打字）
    close: function (id, result, dev, ver) {
      return tx(function (db) {
        var c = get(db, id);
        if (!active(c)) fail(c.status === 'closed' ? 'closed' : 'not_new');
        if (c.acceptedDev !== dev || (ver != null && c.assignVer !== ver)) fail('not_assignee');
        c.status = 'closed'; c.closedAt = Date.now(); c.result = String(result).slice(0, 100);
        sys(c, /^(問題已排除|已於現場確認問題排除)/.test(result) ? '本次協助已完成' : '本次對話已結束');
        return true;
      });
    },
    // 客人「仍需要協助」：只對已結案、且是同一輪的案件有效，開新的一輪
    reopen: function (id, text, cycle, clientMsgId) {
      return tx(function (db) {
        var c = get(db, id);
        if (clientMsgId && c.messages.some(function (m) { return m.clientMsgId === clientMsgId; })) return true;
        if (c.status !== 'closed' || (cycle != null && c.cycle !== cycle)) fail('changed');
        c.history.push({ cycle: c.cycle, closedAt: c.closedAt, result: c.result });
        c.cycle += 1; c.status = 'new'; c.queuedAt = Date.now();
        c.acceptedAt = 0; c.acceptedBy = ''; c.acceptedDev = ''; c.workingAt = 0; c.closedAt = 0; c.result = '';
        c.escalated = false; c.escalateFailed = false;
        c.messages.push({ id: uid(), from: 'customer', text: String(text || '我仍需要協助').slice(0, 500), at: Date.now(), cycle: c.cycle, clientMsgId: clientMsgId });
        return true;
      });
    },
    // 試用版模擬「逾時通知備援」；正式版由伺服器排程判斷並寫入結果，瀏覽器不能改
    markEscalated: function (id, cycle) {
      return tx(function (db) {
        var c = get(db, id);
        if (c.status !== 'new' || c.escalated || (cycle != null && c.cycle !== cycle)) return false;
        c.escalated = true; sys(c, '備援通知模擬，未實際通知人員');
        db.log.unshift({ t: Date.now(), text: '備援通知（模擬）｜' + c.siteName + '｜' + (c.device || '未填位置') }); db.log = db.log.slice(0, 30);
        return true;
      });
    },
    // 值守狀態（試用版存在本機）
    watchPresence: function (site, cb) {
      var last = '';
      function run() { var p = load().presence[site] || { away: false, since: 0, by: '' }; var s = JSON.stringify(p); if (s !== last) { last = s; cb(clone(p)); } }
      run(); return on(run);
    },
    watchAllPresence: function (cb) {
      var last = '';
      function run() { var p = load().presence; var s = JSON.stringify(p); if (s !== last) { last = s; cb(clone(p)); } }
      run(); return on(run);
    },
    setPresence: function (site, away, by) {
      return tx(function (db) { db.presence[site] = { away: !!away, since: Date.now(), by: String(by || '管理室').slice(0, 20) }; return true; });
    },
    // 試用版模擬管理後端：帳號與備援設定只存在這個瀏覽器，不會真的建立帳號或寄信
    admin: function (action, d) {
      d = d || {};
      return tx(function (db) {
        var acc = function (uid) { var a = db.accounts.filter(function (x) { return x.uid === uid; })[0]; if (!a) fail('notfound'); if (a.role === 'admin') fail('protected'); return a; };
        var log = function (t) { db.log.unshift({ t: Date.now(), text: t }); db.log = db.log.slice(0, 30); };
        var pwOk = function (p) { if (typeof p !== 'string' || p.length < 8 || p.length > 64) fail('weak_password'); };
        if (action === 'whoami') return { ok: true, demo: true };
        if (action === 'listAccounts') return { ok: true, accounts: clone(db.accounts) };
        if (action === 'createAccount') {
          var a = String(d.account || '').trim().toLowerCase();
          if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(a) || a === 'admin') fail('bad_account');
          if (db.accounts.some(function (x) { return x.account === a; })) fail('exists');
          pwOk(d.password);
          var n = { uid: 'demo-' + uid(), account: a, name: String(d.name || '').slice(0, 20), site: d.site, role: '', active: true, disabled: false, createdAt: Date.now(), lastLoginAt: 0 };
          db.accounts.push(n); log('建立帳號 ' + a); return { ok: true, uid: n.uid };
        }
        if (action === 'updateAccount') { var u = acc(d.uid); u.name = String(d.name || u.name).slice(0, 20); u.site = d.site || u.site; log('修改帳號 ' + u.account); return { ok: true }; }
        if (action === 'setPassword') { var u2 = acc(d.uid); pwOk(d.password); log('重設密碼 ' + u2.account); return { ok: true }; }
        if (action === 'setActive') { var u3 = acc(d.uid); u3.active = !!d.active; u3.disabled = !d.active; log((d.active ? '啟用' : '停用') + '帳號 ' + u3.account); return { ok: true }; }
        if (action === 'getSettings') return { ok: true, settings: clone(db.settings), quota: 100, lastRun: Date.now(), triggerOk: true, log: clone(db.log), demo: true };
        if (action === 'saveSettings') { db.settings = clone(d.settings); log('更新備援通知設定'); return { ok: true }; }
        if (action === 'testEmail') { log('寄送測試信（模擬）'); return { ok: true, sent: (d.to || []).length, demo: true }; }
        fail('bad_action');
      });
    },
    openSites: function () { return Promise.resolve(null); },
    demoTimeoutMin: function () { return load().settings.timeoutMin || 3; },
    resetDemo: function () { try { localStorage.removeItem(KEY); } catch (e) {} if (bc) bc.postMessage('changed'); notify(); }
  };

  // 沒有 Firebase 設定、或網址加上 ?demo=1 時使用試用版
  global.HelpDemo = demo;
  if (!global.HELP_FB || /[?&]demo=1/.test(location.search)) {
    global.HelpAPI = demo;
    setTimeout(function () { global.dispatchEvent(new Event('helpapi')); }, 0);
  }
})(window);
