/**
 * 大日開發｜文字求助 管理後端（Google Apps Script）
 *
 * 1. 管理員頁面的帳號管理：建立各場管理室帳號、修改名稱與場站、重設密碼、停用／啟用
 * 2. 備援通知設定：逾時分鐘數、預設備援信箱、各場備援信箱（存在本程式的「指令碼屬性」，不放進資料庫）
 * 3. 每分鐘檢查一次：待接手的案件超過設定時間、或該場按了「暫時離開」，就寄信通知備援信箱（每輪只寄一次）
 *
 * 安裝（只需做一次，詳見「文字求助_管理後端_安裝步驟」）：
 *   a. 專案設定 → 勾選「在編輯器中顯示 appsscript.json」，貼上同資料夾的 appsscript.json
 *   b. 貼上本檔 → 執行 setup → 依畫面授權（需用 Firebase 專案擁有者的 Google 帳號）
 *   c. 部署 → 新增部署作業 → 網頁應用程式：執行身分「我」、存取權「所有人」→ 複製網址交給 Claude
 *
 * 安全：每個請求都要附上管理員登入後的 Firebase ID token；本程式先在本機驗證簽章（不耗用外部呼叫額度），
 * 再確認 staff/{uid} 的 role 為 admin、active 為 true，且登入時間晚於最近一次重設密碼／停用，才會執行。
 * 不會接管已存在的帳號；同一身分短時間內呼叫過多次會被暫時拒絕。
 */

var PROJECT = 'wedding-seating-37b71';
var API_KEY = 'AIzaSyDUoIG3FCxiyzixCDwM1m-5w5MF7-Ak4qs';   // Firebase 網頁設定中的公開金鑰，只用來驗證登入 token
var DOMAIN = 'staff.dari-help.tw';                         // 管理室帳號的固定網域（使用者只輸入前面的帳號）
var STAFF_URL = 'https://dari-design-web.github.io/luckyparking-web/help/staff/';
var SENDER_NAME = '大日開發 文字求助';

var FS = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
var DOC_ROOT = 'projects/' + PROJECT + '/databases/(default)/documents';
var IDT = 'https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT;
var MAX_EMAILS = 10;   // 每份清單最多幾個信箱
var TIMEOUTS = [1, 2, 3, 5, 10, 15];

/* ───────── 網頁請求 ───────── */

function doGet() {
  return json_({ ok: true, service: 'dari-help-admin' });
}

function doPost(e) {
  var out;
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var who = verifyAdmin_(b.idToken);
    out = route_(String(b.action || ''), b, who);
    out.ok = true;
  } catch (x) {
    out = { ok: false, error: (x && x.code) || 'error' };
    if (!x || !x.code) console.error(x && x.stack || x);
  }
  return json_(out);
}

function route_(action, b, who) {
  switch (action) {
    case 'whoami': return { name: who.name };
    case 'listAccounts': return { accounts: listAccounts_() };
    case 'getSettings': return settingsView_();
    case 'testEmail': return testEmail_(b, who);
    case 'createAccount': return locked_(function () { return createAccount_(b, who); });
    case 'updateAccount': return locked_(function () { return updateAccount_(b, who); });
    case 'setPassword': return locked_(function () { return setPassword_(b, who); });
    case 'setActive': return locked_(function () { return setActive_(b, who); });
    case 'saveSettings': return locked_(function () { return saveSettings_(b.settings, who); });
  }
  throw err_('bad_action');
}

// 帳號與設定的修改一次只處理一件，避免同時修改造成開放場站清單不一致
function locked_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw err_('busy');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ───────── 身分驗證 ───────── */

function verifyAdmin_(idToken) {
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 4096) throw err_('no_login');
  var p = verifyToken_(idToken);
  // 每個身分每 5 分鐘最多 120 次，避免有人用有效 token 大量呼叫耗盡每日額度
  var cache = CacheService.getScriptCache(), slot = 'rl:' + p.sub + ':' + Math.floor(Date.now() / 300000);
  var n = Number(cache.get(slot) || 0) + 1; cache.put(slot, String(n), 600);
  if (n > 120) throw err_('too_many');
  if (!p.firebase || p.firebase.sign_in_provider !== 'password') throw err_('not_admin');
  var key = 'adm:' + p.sub + ':' + (p.auth_time || 0), hit = cache.get(key);
  if (hit === 'no') throw err_('not_admin');
  if (hit) return JSON.parse(hit);
  var s = getDoc_('staff/' + p.sub);
  var ok = s && s.role === 'admin' && s.active === true && Number(p.auth_time || 0) >= Number(s.validAfter || 0);
  if (!ok) { cache.put(key, 'no', 60); throw err_('not_admin'); }
  var who = { uid: p.sub, name: s.name || '管理員' };
  cache.put(key, JSON.stringify(who), 60);
  return who;
}

// 驗證 Firebase ID token：RS256 簽章、發行者、對象、有效期限。公鑰每小時更新一次。
// 執行環境不支援 BigInt 時，改向 Google 查驗（會用到外部呼叫額度）。
function verifyToken_(tok) {
  var parts = tok.split('.');
  if (parts.length !== 3) throw err_('no_login');
  var h, p;
  try { h = JSON.parse(b64s_(parts[0])); p = JSON.parse(b64s_(parts[1])); } catch (e) { throw err_('no_login'); }
  var now = Date.now() / 1000;
  if (h.alg !== 'RS256' || typeof h.kid !== 'string' || p.aud !== PROJECT || p.iss !== 'https://securetoken.google.com/' + PROJECT
    || !(p.exp > now) || !(p.iat < now + 300) || typeof p.sub !== 'string' || !/^[A-Za-z0-9]{1,128}$/.test(p.sub)) throw err_('no_login');
  if (typeof BigInt === 'undefined') {
    var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + API_KEY, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({ idToken: tok }) });
    var u = r.getResponseCode() === 200 ? (JSON.parse(r.getContentText()).users || [])[0] : null;
    if (!u || u.disabled || u.localId !== p.sub) throw err_('no_login');
    return p;
  }
  var key = jwks_(h.kid);
  if (!key || !rsaOk_(parts[0] + '.' + parts[1], parts[2], key)) throw err_('no_login');
  return p;
}

function jwks_(kid) {
  var cache = CacheService.getScriptCache(), raw = cache.get('jwks'), keys = raw ? JSON.parse(raw) : null;
  if ((!keys || !keys[kid]) && !cache.get('jwks-wait')) {
    cache.put('jwks-wait', '1', 30);
    var r = UrlFetchApp.fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) {
      keys = {};
      (JSON.parse(r.getContentText()).keys || []).forEach(function (k) { if (k.kid && k.n && k.e) keys[k.kid] = { n: k.n, e: k.e }; });
      cache.put('jwks', JSON.stringify(keys), 3600);
    }
  }
  return keys ? keys[kid] : null;
}

// RSASSA-PKCS1-v1_5 + SHA-256 驗章（不寫 BigInt 字面值，避免舊執行環境無法解析整支程式）
function rsaOk_(data, sigB64, key) {
  var EIGHT = BigInt(8), FF = BigInt(255);
  var nb = b64b_(key.n), k = nb.length, sig = b64b_(sigB64);
  if (sig.length !== k) return false;
  var m = modPow_(big_(sig), big_(b64b_(key.e)), big_(nb)), em = [];
  for (var i = 0; i < k; i++) { em.unshift(Number(m & FF)); m = m >> EIGHT; }
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data, Utilities.Charset.UTF_8).map(function (b) { return b & 255; });
  var di = [0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20].concat(hash);
  var ps = k - 3 - di.length;
  if (ps < 8 || em[0] !== 0 || em[1] !== 1 || em[2 + ps] !== 0) return false;
  for (var j = 2; j < 2 + ps; j++) if (em[j] !== 255) return false;
  for (var t = 0; t < di.length; t++) if (em[3 + ps + t] !== di[t]) return false;
  return true;
}
function big_(bytes) { var x = BigInt(0), E = BigInt(8); for (var i = 0; i < bytes.length; i++) x = (x << E) | BigInt(bytes[i]); return x; }
function modPow_(b, e, m) { var Z = BigInt(0), ONE = BigInt(1), r = ONE; b = b % m; while (e > Z) { if ((e & ONE) === ONE) r = (r * b) % m; e = e >> ONE; b = (b * b) % m; } return r; }
function b64raw_(s) { s = String(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); while (s.length % 4) s += '='; return Utilities.base64DecodeWebSafe(s); }
function b64b_(s) { return b64raw_(s).map(function (b) { return b & 255; }); }
function b64s_(s) { return Utilities.newBlob(b64raw_(s)).getDataAsString('UTF-8'); }

/* ───────── 帳號管理 ───────── */

function listAccounts_() {
  var docs = listDocs_('staff');
  var ids = docs.map(function (d) { return d._id; });
  var users = {};
  for (var i = 0; i < ids.length; i += 100) {
    var r = api_('post', IDT + '/accounts:lookup', { localId: ids.slice(i, i + 100) });
    if (r.code !== 200) throw err_('auth_failed');
    (r.json.users || []).forEach(function (u) { users[u.localId] = u; });
  }
  return docs.map(function (d) {
    var u = users[d._id] || {};
    return {
      uid: d._id, account: d.account || String(u.email || '').split('@')[0], name: d.name || '', site: d.site || '', siteName: d.siteName || '',
      role: d.role === 'admin' ? 'admin' : '', active: d.active === true, disabled: !!u.disabled, missing: !users[d._id],
      createdAt: Number(u.createdAt) || 0, lastLoginAt: Number(u.lastLoginAt) || 0
    };
  });
}

function createAccount_(b, who) {
  var acct = String(b.account || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(acct) || acct === 'admin') throw err_('bad_account');
  var site = site_(b.site), siteName = text_(b.siteName, 1, 60, 'bad_site'), name = text_(b.name, 1, 20, 'bad_name'), pw = password_(b.password);
  var r = api_('post', IDT + '/accounts', { email: acct + '@' + DOMAIN, password: pw, displayName: name, emailVerified: true });
  if (r.code !== 200) {
    if (/EMAIL_EXISTS|DUPLICATE_EMAIL/.test(r.text)) throw err_('exists');   // 已存在的帳號不接管
    if (/WEAK_PASSWORD/.test(r.text)) throw err_('weak_password');
    console.error('建立帳號失敗', r.code, r.text);
    throw err_('auth_failed');
  }
  var uid = r.json.localId;
  var w = commit_([{
    update: { name: DOC_ROOT + '/staff/' + uid, fields: fields_({ site: site, siteName: siteName, active: true, name: name, account: acct, validAfter: 0, createdBy: who.uid }) },
    updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { exists: false }
  }]);
  if (!w) { api_('post', IDT + '/accounts:delete', { localId: uid }); throw err_('save_failed'); }
  if (!/^[A-Za-z0-9]{10,128}$/.test(uid)) throw err_('auth_failed');
  log_('帳號', '建立 ' + acct + '（' + site + '）', who);
  return { uid: uid, openSites: syncOpenSites_() };
}

// 只能改一般管理室帳號；管理員帳號一律不經由此處修改
function target_(uid) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9]{10,128}$/.test(uid)) throw err_('notfound');
  var s = getDoc_('staff/' + uid);
  if (!s) throw err_('notfound');
  if (s.role === 'admin') throw err_('protected');
  return s;
}

function updateAccount_(b, who) {
  var s = target_(b.uid), site = site_(b.site), siteName = text_(b.siteName, 1, 60, 'bad_site'), name = text_(b.name, 1, 20, 'bad_name');
  if (!commit_([{ update: { name: DOC_ROOT + '/staff/' + b.uid, fields: fields_({ site: site, siteName: siteName, name: name }) }, updateMask: { fieldPaths: ['site', 'siteName', 'name'] }, currentDocument: { exists: true } }])) throw err_('save_failed');
  api_('post', IDT + '/accounts:update', { localId: b.uid, displayName: name });
  log_('帳號', '修改 ' + (s.account || b.uid) + '：' + name + '（' + site + '）', who);
  return { openSites: syncOpenSites_() };
}

function setPassword_(b, who) {
  var s = target_(b.uid), pw = password_(b.password), now = Math.floor(Date.now() / 1000);
  var r = api_('post', IDT + '/accounts:update', { localId: b.uid, password: pw, validSince: String(now) });
  if (r.code !== 200) { if (/WEAK_PASSWORD/.test(r.text)) throw err_('weak_password'); throw err_('auth_failed'); }
  // 舊的登入（重設前登入的裝置）立即失效：安全規則比對登入時間與 validAfter
  commit_([{ update: { name: DOC_ROOT + '/staff/' + b.uid, fields: fields_({ validAfter: now }) }, updateMask: { fieldPaths: ['validAfter'] }, currentDocument: { exists: true } }]);
  log_('帳號', '重設密碼 ' + (s.account || b.uid), who);
  return {};
}

function setActive_(b, who) {
  var s = target_(b.uid), on = b.active === true, now = Math.floor(Date.now() / 1000);
  var doc = function () {
    var f = { active: on }, mask = ['active'];
    if (!on) { f.validAfter = now; mask.push('validAfter'); }
    return commit_([{ update: { name: DOC_ROOT + '/staff/' + b.uid, fields: fields_(f) }, updateMask: { fieldPaths: mask }, currentDocument: { exists: true } }]);
  };
  var auth = function () {
    var body = { localId: b.uid, disableUser: !on };
    if (!on) body.validSince = String(now);
    return api_('post', IDT + '/accounts:update', body).code === 200;
  };
  // 停用：先關資料庫權限（安全規則以此為準，立即生效）再停用登入；啟用：先恢復登入再開權限
  if (on) { if (!auth()) throw err_('auth_failed'); if (!doc()) throw err_('save_failed'); }
  else { if (!doc()) throw err_('save_failed'); if (!auth()) { log_('帳號', '停用 ' + (s.account || b.uid) + '：已關閉權限，但停用登入失敗', who); return { openSites: syncOpenSites_(), partial: true }; } }
  log_('帳號', (on ? '啟用 ' : '停用 ') + (s.account || b.uid), who);
  return { openSites: syncOpenSites_() };
}

// 已開放文字求助的場站＝有啟用中一般帳號的場站；寫到 config/public 讓客人頁面讀取
function syncOpenSites_() {
  var sites = [], names = {};
  listDocs_('staff').forEach(function (d) {
    if (d.role === 'admin' || d.active !== true || !d.site) return;
    if (sites.indexOf(d.site) < 0) sites.push(d.site);
    if (d.siteName && !names[d.site]) names[d.site] = d.siteName;
  });
  sites.sort();
  if (!commit_([{ update: { name: DOC_ROOT + '/config/public', fields: fields_({ openSites: sites, siteNames: names }) }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] }])) throw err_('save_failed');
  return sites;
}

function site_(v) { if (typeof v !== 'string' || !/^[a-z0-9-]{1,40}$/.test(v)) throw err_('bad_site'); return v; }
function text_(v, min, max, code) { v = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim(); if (v.length < min || v.length > max) throw err_(code); return v; }
function password_(v) { if (typeof v !== 'string' || v.length < 8 || v.length > 64 || /\s/.test(v)) throw err_('weak_password'); return v; }

/* ───────── 備援通知設定 ───────── */

// 設定分開存放：cfg＝逾時與預設信箱；site:{場站}＝各場設定（單一屬性有 9KB 上限）
function settings_() {
  var all = props_().getProperties(), cfg = {}, sites = {};
  try { cfg = JSON.parse(all.cfg || '{}'); } catch (e) {}
  Object.keys(all).forEach(function (k) { if (k.indexOf('site:') === 0) { try { sites[k.slice(5)] = JSON.parse(all[k]); } catch (e) {} } });
  return { timeoutMin: TIMEOUTS.indexOf(cfg.timeoutMin) >= 0 ? cfg.timeoutMin : 3, defaultEmails: cfg.defaultEmails || [], sites: sites };
}

function settingsView_() {
  var trig = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'checkEscalations'; });
  return {
    settings: settings_(), quota: MailApp.getRemainingDailyQuota(), triggerOk: trig,
    lastRun: Number(props_().getProperty('lastRun')) || 0, lastError: props_().getProperty('lastError') || '',
    log: readLog_()
  };
}

function emails_(list) {
  if (!Array.isArray(list)) throw err_('bad_email');
  var out = [];
  list.forEach(function (x) {
    x = String(x || '').trim().toLowerCase();
    if (!x) return;
    if (x.length > 120 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(x)) throw err_('bad_email');
    if (out.indexOf(x) < 0) out.push(x);
  });
  if (out.length > MAX_EMAILS) throw err_('too_many_emails');
  return out;
}

function saveSettings_(s, who) {
  if (!s || typeof s !== 'object') throw err_('bad_settings');
  var t = Number(s.timeoutMin);
  if (TIMEOUTS.indexOf(t) < 0) throw err_('bad_settings');
  var keys = Object.keys(s.sites || {});
  if (keys.length > 200) throw err_('bad_settings');
  var put = { cfg: JSON.stringify({ timeoutMin: t, defaultEmails: emails_(s.defaultEmails || []) }) };
  keys.forEach(function (k) {
    site_(k);
    var v = s.sites[k] || {};
    if (v.mode === 'custom') put['site:' + k] = JSON.stringify({ mode: 'custom', emails: emails_(v.emails || []) });
  });
  var pr = props_();
  Object.keys(pr.getProperties()).forEach(function (k) { if (k.indexOf('site:') === 0 && !put[k]) pr.deleteProperty(k); });
  pr.setProperties(put, false);
  log_('設定', '更新備援通知設定（逾時 ' + t + ' 分鐘）', who);
  return {};
}

function emailsFor_(st, site) {
  var v = st.sites[site];
  return v && v.mode === 'custom' ? v.emails : st.defaultEmails;
}

function testEmail_(b, who) {
  var to = emails_(b.to || []);
  if (!to.length) throw err_('no_emails');
  if (MailApp.getRemainingDailyQuota() < to.length) throw err_('quota');
  var site = text_(b.siteName || '', 0, 40, 'bad_site');
  MailApp.sendEmail({
    to: to.join(','), name: SENDER_NAME,
    subject: '【文字求助】備援通知測試' + (site ? '｜' + site : ''),
    body: '這是備援通知的測試信，由管理員頁面送出。\n收到這封信，表示' + (site || '此清單') + '的備援通知可以寄達這個信箱。\n\n管理室頁面：' + STAFF_URL + '\n（此信由系統自動寄出，請勿直接回覆）'
  });
  log_('測試', '寄送測試信給 ' + to.length + ' 人' + (site ? '（' + site + '）' : ''), who);
  return { sent: to.length };
}

/* ───────── 每分鐘檢查：逾時或暫離時通知備援 ───────── */

var HOURLY_CAP = 6;   // 每場每小時最多寄幾封（防止大量假求助耗盡寄信額度）

function checkEscalations() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    props_().setProperty('lastRun', String(Date.now()));
    // 只查「待接手、尚未通知」的案件（多個等值條件可直接使用內建索引）；平常 0 件，只算 1 次讀取
    var cand = runQuery_({
      from: [{ collectionId: 'cases' }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'new' } } },
        { fieldFilter: { field: { fieldPath: 'escalated' }, op: 'EQUAL', value: { booleanValue: false } } },
        { fieldFilter: { field: { fieldPath: 'escalateFailed' }, op: 'EQUAL', value: { booleanValue: false } } }
      ] } },
      limit: 40
    });
    if (cand.length) {
      var st = settings_(), now = Date.now(), bySite = {}, names = null;
      cand.forEach(function (c) { (bySite[c.site] = bySite[c.site] || []).push(c); });
      Object.keys(bySite).forEach(function (site) {
        var pres = getDoc_('presence/' + site) || {}, away = pres.away === true;
        var due = bySite[site].filter(function (c) { return away || now - (c.queuedAt || now) >= st.timeoutMin * 60000; });
        if (!due.length) return;
        if (!names) names = (getDoc_('config/public') || {}).siteNames || {};
        // 場名以後台設定為準；尚未設定時才用案件上的場名（客人端送來，只用於信件顯示）
        notifySite_(site, names[site] || String(due[0].siteName || site).slice(0, 40), due, away, emailsFor_(st, site));
      });
    }
    props_().deleteProperty('lastError');
  } catch (e) {
    props_().setProperty('lastError', new Date().toISOString() + ' ' + String(e && e.message || e).slice(0, 200));
    console.error(e && e.stack || e);
  } finally {
    lock.releaseLock();
  }
}

// 同一場、同一次檢查的到期案件合併成一封信；寄出後才標記「已通知」（客人端此時才顯示已通知）
function notifySite_(site, siteName, due, away, to) {
  var cache = CacheService.getScriptCache(), now = Date.now();
  // 寄信前重新讀取：剛被接手、已重開新一輪或已處理過的不寄
  var list = [];
  due.forEach(function (c) {
    var f = getDoc_('cases/' + c._id);
    if (!f || f.status !== 'new' || f.escalated === true || f.escalateFailed === true || f.cycle !== c.cycle) return;
    if (cache.get('sent:' + c._id + ':' + f.cycle)) { markSent_(f); return; }   // 已寄過但上次沒標記成功
    list.push(f);
  });
  if (!list.length) return;
  var hourKey = 'cap:' + site + ':' + Math.floor(now / 3600000), sentThisHour = Number(cache.get(hourKey) || 0);
  var why = '';
  if (!to.length) why = '未設定備援信箱';
  else if (MailApp.getRemainingDailyQuota() < to.length) why = '今日寄信額度已用完';
  else if (sentThisHour >= HOURLY_CAP) why = '本場本小時通知次數已達上限';
  if (!why) {
    try {
      var first = list[0];
      var lines = [siteName + ' 有 ' + list.length + ' 件文字求助尚未接手。', '', '原因：' + (away ? '管理室目前為「暫時離開」' : '超過設定時間無人接手'), ''];
      list.slice(0, 10).forEach(function (c, i) {
        lines.push((list.length > 1 ? (i + 1) + '. ' : '') + '位置：' + (c.device || '未填位置') + '｜狀況：' + (c.category || ''));
        lines.push('   等候：約 ' + Math.max(1, Math.round((now - c.queuedAt) / 60000)) + ' 分鐘｜案件編號：' + (c.code || ''));
        lines.push('   客人留言（未經查證）：' + String(c.lastCustomerText || '').replace(/\s+/g, ' ').slice(0, 200));
      });
      if (list.length > 10) lines.push('…另有 ' + (list.length - 10) + ' 件');
      lines.push('', '請開啟管理室頁面接手：' + STAFF_URL, '若無法使用頁面，請盡快到現場或聯絡該場管理室。', '', '（此信由系統自動寄出；同一次求助只通知一次，請勿直接回覆）');
      MailApp.sendEmail({
        to: to.join(','), name: SENDER_NAME,
        subject: '【文字求助・待接手】' + siteName + (list.length > 1 ? '｜' + list.length + ' 件' : '｜' + (first.device || '未填位置') + '｜' + (first.category || '')),
        body: lines.join('\n')
      });
      cache.put(hourKey, String(sentThisHour + 1), 3700);
      list.forEach(function (c) { cache.put('sent:' + c._id + ':' + c.cycle, '1', 21600); markSent_(c); });
      log_('備援', '已寄給 ' + to.length + ' 人（' + (away ? '暫離' : '逾時') + '）｜' + siteName + '｜' + list.map(function (c) { return (c.device || '未填位置') + ' ' + (c.code || ''); }).join('、'));
      return;
    } catch (e) {
      console.error(e);
      // 寄信失敗：同一件最多重試 3 次（每分鐘一次），之後標記失敗，讓客人改用現場求助
      var retry = list.filter(function (c) { var k = 'try:' + c._id + ':' + c.cycle, n = Number(cache.get(k) || 0) + 1; cache.put(k, String(n), 3600); return n < 3; });
      if (retry.length === list.length) { log_('備援', '寄信失敗，稍後重試｜' + siteName); return; }
      why = '寄信失敗';
    }
  }
  list.forEach(function (c) {
    commit_([{ update: { name: DOC_ROOT + '/cases/' + c._id, fields: fields_({ escalateFailed: true }) }, updateMask: { fieldPaths: ['escalateFailed'] }, currentDocument: { updateTime: c._updateTime } }]);
  });
  log_('備援', '未送出（' + why + '）｜' + siteName + '｜' + list.map(function (c) { return (c.device || '未填位置') + ' ' + (c.code || ''); }).join('、'));
}

// 標記已通知＋系統訊息（訊息 ID 固定，重試不會重複）；案件剛好被更新時重新讀取再試，換了一輪就不標
function markSent_(c) {
  for (var i = 0; i < 3; i++) {
    var ok = commit_([
      { update: { name: DOC_ROOT + '/cases/' + c._id, fields: fields_({ escalated: true }) }, updateMask: { fieldPaths: ['escalated'] }, currentDocument: { updateTime: c._updateTime } },
      { update: { name: DOC_ROOT + '/cases/' + c._id + '/messages/esc' + c.cycle + 'x' + c._id.slice(-12), fields: fields_({ from: 'system', text: '已通知備援人員', cycle: c.cycle, uid: 'system' }) },
        updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }
    ]);
    if (ok) return true;
    var f = getDoc_('cases/' + c._id);
    if (!f || f.cycle !== c.cycle || f.status === 'closed' || f.escalated === true) return false;
    c = f;
  }
  return false;
}

/* ───────── 安裝 ───────── */

// 在編輯器執行一次：建立每分鐘排程，並測試是否能連到 Firebase
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'checkEscalations') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkEscalations').timeBased().everyMinutes(1).create();
  var r = api_('get', FS + '/staff?pageSize=1');
  var a = api_('post', IDT + '/accounts:query', { returnUserInfo: false });
  Logger.log('Firestore 連線：' + (r.code === 200 ? '正常' : '失敗 ' + r.code + ' ' + r.text.slice(0, 300)));
  Logger.log('帳號服務連線：' + (a.code === 200 ? '正常' : '失敗 ' + a.code + ' ' + a.text.slice(0, 300)));
  Logger.log('今日剩餘寄信額度：' + MailApp.getRemainingDailyQuota());
  if (r.code === 200) Logger.log('已開放場站：' + syncOpenSites_().join('、'));
  Logger.log('已建立每分鐘檢查排程。');
}

/* ───────── Firebase REST 小工具 ───────── */

function api_(method, url, body) {
  var o = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Goog-User-Project': PROJECT } };
  if (body !== undefined) { o.contentType = 'application/json'; o.payload = JSON.stringify(body); }
  var r = UrlFetchApp.fetch(url, o), t = r.getContentText(), j = null;
  try { j = t ? JSON.parse(t) : {}; } catch (e) {}
  return { code: r.getResponseCode(), json: j || {}, text: t || '' };
}

function getDoc_(path) {
  var r = api_('get', FS + '/' + path);
  if (r.code === 404) return null;
  if (r.code !== 200) throw err_('db_failed');
  return docOut_(r.json);
}

function listDocs_(col) {
  var out = [], token = '';
  do {
    var r = api_('get', FS + '/' + col + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
    if (r.code !== 200) throw err_('db_failed');
    (r.json.documents || []).forEach(function (d) { out.push(docOut_(d)); });
    token = r.json.nextPageToken || '';
  } while (token && out.length < 2000);
  return out;
}

function runQuery_(q) {
  var r = api_('post', FS + ':runQuery', { structuredQuery: q });
  if (r.code !== 200) throw new Error('runQuery ' + r.code + ' ' + r.text.slice(0, 200));
  return (Array.isArray(r.json) ? r.json : []).filter(function (x) { return x.document; }).map(function (x) { return docOut_(x.document); });
}

// 成功回傳 true；前提條件不符（例如案件剛被接手）回傳 false
function commit_(writes) {
  var r = api_('post', FS + ':commit', { writes: writes });
  if (r.code === 200) return true;
  if (r.code !== 400 && r.code !== 409 && r.code !== 404) console.error('commit', r.code, r.text.slice(0, 300));
  return false;
}

function docOut_(d) {
  var o = {};
  Object.keys(d.fields || {}).forEach(function (k) { o[k] = val_(d.fields[k]); });
  o._id = String(d.name || '').split('/').pop();
  o._updateTime = d.updateTime;
  return o;
}

function val_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val_);
  if ('mapValue' in v) { var o = {}; Object.keys(v.mapValue.fields || {}).forEach(function (k) { o[k] = val_(v.mapValue.fields[k]); }); return o; }
  return null;
}

function enc_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Math.floor(v) === v ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc_) } };
  if (typeof v === 'object') return { mapValue: { fields: fields_(v) } };
  return { stringValue: String(v) };
}

function fields_(o) { var f = {}; Object.keys(o).forEach(function (k) { f[k] = enc_(o[k]); }); return f; }

/* ───────── 其他 ───────── */

function props_() { return PropertiesService.getScriptProperties(); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function err_(code) { var e = new Error(code); e.code = code; return e; }
function rid_() { var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = ''; for (var i = 0; i < 20; i++) s += c.charAt(Math.floor(Math.random() * c.length)); return s; }

// 紀錄只留最近 40 筆，不含客人留言內容
function readLog_() { try { return JSON.parse(props_().getProperty('log') || '[]'); } catch (e) { return []; } }
function log_(kind, text, who) {
  var l = readLog_();
  l.unshift({ t: Date.now(), kind: kind, text: text + (who ? '（' + who.name + '）' : '') });
  props_().setProperty('log', JSON.stringify(l.slice(0, 40)));
}
