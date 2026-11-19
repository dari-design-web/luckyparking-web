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
  var bc = ('BroadcastChannel' in global) ? new BroadcastChannel(KEY) : null;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { seq: 0, cases: {} }; }
    catch (e) { return { seq: 0, cases: {} }; }
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
        c.messages.push({ id: uid(), from: from, text: String(text).slice(0, 500), at: Date.now(), cycle: c.cycle, clientMsgId: clientMsgId });
        if (from === 'staff' && c.status === 'accepted') { c.status = 'working'; c.workingAt = Date.now(); }
        return true;
      });
    },
    // 管理室：試用版選場站即可、不驗證密碼；正式版為帳號密碼登入，場站由後台指定
    staffLogin: function (site, name) { return Promise.resolve({ site: site === '*' ? '' : site, name: name || '值班人員', role: site === '*' ? 'admin' : 'site' }); },
    staffSession: function () { return Promise.resolve(null); },
    staffLogout: function () { return Promise.resolve(); },
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
        sys(c, '管理室已接手');
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
        sys(c, '已改由其他管理員協助');
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
        return true;
      });
    },
    resetDemo: function () { try { localStorage.removeItem(KEY); } catch (e) {} if (bc) bc.postMessage('changed'); notify(); }
  };

  // 沒有 Firebase 設定、或網址加上 ?demo=1 時使用試用版
  global.HelpDemo = demo;
  if (!global.HELP_FB || /[?&]demo=1/.test(location.search)) {
    global.HelpAPI = demo;
    setTimeout(function () { global.dispatchEvent(new Event('helpapi')); }, 0);
  }
})(window);
