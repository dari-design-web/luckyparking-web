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
 * 安全：每個請求都要附上管理員登入後的 Firebase ID token；本程式向 Google 驗證 token，
 * 再確認 staff/{uid} 的 role 為 admin 且 active 為 true，才會執行。不會接管已存在的帳號。
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
    case 'listAccounts': return { accounts: listAccounts_(), openSites: syncOpenSites_() };
    case 'createAccount': return createAccount_(b, who);
    case 'updateAccount': return updateAccount_(b, who);
    case 'setPassword': return setPassword_(b, who);
    case 'setActive': return setActive_(b, who);
    case 'getSettings': return settingsView_();
    case 'saveSettings': return saveSettings_(b.settings, who);
    case 'testEmail': return testEmail_(b, who);
  }
  throw err_('bad_action');
}

/* ───────── 身分驗證 ───────── */

function verifyAdmin_(idToken) {
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 4096) throw err_('no_login');
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + API_KEY, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ idToken: idToken })
  });
  if (r.getResponseCode() !== 200) throw err_('no_login');
  var u = (JSON.parse(r.getContentText()).users || [])[0];
  if (!u || u.disabled || !u.localId) throw err_('no_login');
  var s = getDoc_('staff/' + u.localId);
  if (!s || s.role !== 'admin' || s.active !== true) throw err_('not_admin');
  return { uid: u.localId, name: s.name || '管理員' };
}

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
      uid: d._id, account: d.account || String(u.email || '').split('@')[0], name: d.name || '', site: d.site || '',
      role: d.role === 'admin' ? 'admin' : '', active: d.active === true, disabled: !!u.disabled, missing: !users[d._id],
      createdAt: Number(u.createdAt) || 0, lastLoginAt: Number(u.lastLoginAt) || 0
    };
  });
}

function createAccount_(b, who) {
  var acct = String(b.account || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(acct) || acct === 'admin') throw err_('bad_account');
  var site = site_(b.site), name = text_(b.name, 1, 20, 'bad_name'), pw = password_(b.password);
  var r = api_('post', IDT + '/accounts', { email: acct + '@' + DOMAIN, password: pw, displayName: name, emailVerified: true });
  if (r.code !== 200) {
    if (/EMAIL_EXISTS|DUPLICATE_EMAIL/.test(r.text)) throw err_('exists');   // 已存在的帳號不接管
    if (/WEAK_PASSWORD/.test(r.text)) throw err_('weak_password');
    console.error('建立帳號失敗', r.code, r.text);
    throw err_('auth_failed');
  }
  var uid = r.json.localId;
  var w = commit_([{
    update: { name: DOC_ROOT + '/staff/' + uid, fields: fields_({ site: site, active: true, name: name, account: acct, createdBy: who.uid }) },
    updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { exists: false }
  }]);
  if (!w) { api_('post', IDT + '/accounts:delete', { localId: uid }); throw err_('save_failed'); }
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
  var s = target_(b.uid), site = site_(b.site), name = text_(b.name, 1, 20, 'bad_name');
  if (!commit_([{ update: { name: DOC_ROOT + '/staff/' + b.uid, fields: fields_({ site: site, name: name }) }, updateMask: { fieldPaths: ['site', 'name'] }, currentDocument: { exists: true } }])) throw err_('save_failed');
  api_('post', IDT + '/accounts:update', { localId: b.uid, displayName: name });
  log_('帳號', '修改 ' + (s.account || b.uid) + '：' + name + '（' + site + '）', who);
  return { openSites: syncOpenSites_() };
}

function setPassword_(b, who) {
  var s = target_(b.uid), pw = password_(b.password);
  var r = api_('post', IDT + '/accounts:update', { localId: b.uid, password: pw, validSince: String(Math.floor(Date.now() / 1000)) });
  if (r.code !== 200) { if (/WEAK_PASSWORD/.test(r.text)) throw err_('weak_password'); throw err_('auth_failed'); }
  log_('帳號', '重設密碼 ' + (s.account || b.uid), who);
  return {};
}

function setActive_(b, who) {
  var s = target_(b.uid), on = b.active === true;
  // 先改資料庫（安全規則以此為準，立即生效），再停用／啟用登入
  if (!commit_([{ update: { name: DOC_ROOT + '/staff/' + b.uid, fields: fields_({ active: on }) }, updateMask: { fieldPaths: ['active'] }, currentDocument: { exists: true } }])) throw err_('save_failed');
  var body = { localId: b.uid, disableUser: !on };
  if (!on) body.validSince = String(Math.floor(Date.now() / 1000));
  var r = api_('post', IDT + '/accounts:update', body);
  if (r.code !== 200) console.error('停用／啟用登入失敗', r.code, r.text);
  log_('帳號', (on ? '啟用 ' : '停用 ') + (s.account || b.uid), who);
  return { openSites: syncOpenSites_() };
}

// 已開放文字求助的場站＝有啟用中一般帳號的場站；寫到 config/public 讓客人頁面讀取
function syncOpenSites_() {
  var sites = [];
  listDocs_('staff').forEach(function (d) { if (d.role !== 'admin' && d.active === true && d.site && sites.indexOf(d.site) < 0) sites.push(d.site); });
  sites.sort();
  commit_([{ update: { name: DOC_ROOT + '/config/public', fields: fields_({ openSites: sites }) }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] }]);
  return sites;
}

function site_(v) { if (typeof v !== 'string' || !/^[a-z0-9-]{1,40}$/.test(v)) throw err_('bad_site'); return v; }
function text_(v, min, max, code) { v = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim(); if (v.length < min || v.length > max) throw err_(code); return v; }
function password_(v) { if (typeof v !== 'string' || v.length < 8 || v.length > 64 || /\s/.test(v)) throw err_('weak_password'); return v; }

/* ───────── 備援通知設定 ───────── */

function settings_() {
  var s = {};
  try { s = JSON.parse(props_().getProperty('settings') || '{}'); } catch (e) {}
  return { timeoutMin: TIMEOUTS.indexOf(s.timeoutMin) >= 0 ? s.timeoutMin : 3, defaultEmails: s.defaultEmails || [], sites: s.sites || {} };
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
  var sites = {}, keys = Object.keys(s.sites || {});
  if (keys.length > 200) throw err_('bad_settings');
  keys.forEach(function (k) {
    site_(k);
    var v = s.sites[k] || {};
    sites[k] = { mode: v.mode === 'custom' ? 'custom' : 'default', emails: emails_(v.emails || []) };
  });
  var clean = { timeoutMin: t, defaultEmails: emails_(s.defaultEmails || []), sites: sites };
  props_().setProperty('settings', JSON.stringify(clean));
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

function checkEscalations() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    props_().setProperty('lastRun', String(Date.now()));
    var open = runQuery_({ from: [{ collectionId: 'cases' }], where: { fieldFilter: { field: { fieldPath: 'open' }, op: 'EQUAL', value: { booleanValue: true } } } });
    var now = Date.now();
    var cand = open.filter(function (c) { return c.status === 'new' && c.escalated !== true && c.escalateFailed !== true; });
    if (!cand.length) { props_().deleteProperty('lastError'); return; }
    var st = settings_(), pres = {};
    cand.forEach(function (c) {
      if (!(c.site in pres)) pres[c.site] = getDoc_('presence/' + c.site) || {};
      var away = pres[c.site].away === true;
      var waited = now - (c.queuedAt || now);
      if (!away && waited < st.timeoutMin * 60000) return;
      escalate_(c, away, waited, emailsFor_(st, c.site));
    });
    props_().deleteProperty('lastError');
  } catch (e) {
    props_().setProperty('lastError', new Date().toISOString() + ' ' + String(e && e.message || e).slice(0, 200));
    console.error(e && e.stack || e);
  } finally {
    lock.releaseLock();
  }
}

function escalate_(c, away, waited, to) {
  var path = DOC_ROOT + '/cases/' + c._id;
  // 先以「文件未被改過」為前提標記已通知：若管理室剛好接手，標記會失敗，就不寄信，也不會重複寄
  if (!commit_([{ update: { name: path, fields: fields_({ escalated: true }) }, updateMask: { fieldPaths: ['escalated'] }, currentDocument: { updateTime: c._updateTime } }])) return;
  var why = '', mins = Math.max(1, Math.round(waited / 60000));
  if (!to.length) why = '未設定備援信箱';
  else if (MailApp.getRemainingDailyQuota() < to.length) why = '今日寄信額度已用完';
  else {
    try {
      var reason = away ? '管理室目前為「暫時離開」' : '已超過 ' + mins + ' 分鐘無人接手';
      var lines = [
        (c.siteName || c.site) + ' 有一件文字求助尚未接手。', '',
        '原因：' + reason,
        '位置：' + (c.device || '未填位置'),
        '狀況：' + (c.category || ''),
        '客人留言：' + String(c.lastCustomerText || '').slice(0, 300),
        '等候時間：約 ' + mins + ' 分鐘',
        '案件編號：' + (c.code || ''), '',
        '請開啟管理室頁面接手：' + STAFF_URL,
        '若無法使用頁面，請盡快到現場或聯絡該場管理室。', '',
        '（此信由系統自動寄出；同一次求助只通知一次，請勿直接回覆）'
      ];
      MailApp.sendEmail({
        to: to.join(','), name: SENDER_NAME,
        subject: '【文字求助・待接手】' + (c.siteName || c.site) + '｜' + (c.device || '未填位置') + '｜' + (c.category || ''),
        body: lines.join('\n')
      });
    } catch (e) { why = '寄信失敗'; console.error(e); }
  }
  if (why) {
    commit_([{ update: { name: path, fields: fields_({ escalated: false, escalateFailed: true }) }, updateMask: { fieldPaths: ['escalated', 'escalateFailed'] } }]);
    log_('備援', '未送出（' + why + '）｜' + (c.siteName || c.site) + '｜' + (c.device || '未填位置') + '｜' + (c.code || ''));
    return;
  }
  commit_([{
    update: { name: path + '/messages/' + rid_(), fields: fields_({ from: 'system', text: '已通知備援人員', cycle: c.cycle || 1, uid: 'system' }) },
    updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { exists: false }
  }]);
  log_('備援', '已寄給 ' + to.length + ' 人（' + (away ? '暫離' : '逾時 ' + mins + ' 分') + '）｜' + (c.siteName || c.site) + '｜' + (c.device || '未填位置') + '｜' + (c.code || ''));
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
