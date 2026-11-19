/**
 * 大日開發｜線上顧客意見箱 → 寄到指定信箱，並記錄到 Google 試算表（v3）
 *
 * 第一次設定：
 * 1. 到 script.google.com 建立「新專案」（不要貼到官網洽詢表單的專案），把原本的程式碼刪掉，貼上本檔全部內容後儲存。
 * 2. 上方函式選單選「setup」→ 執行 → 依畫面完成授權。
 *    它會建立「顧客意見箱紀錄」試算表、「顧客意見箱照片」資料夾、每小時補寄一次的排程，並寄一封測試信到 TO。
 * 3. 部署 → 新增部署作業 → 網頁應用程式；執行身分：我；誰可以存取：所有人 → 部署，把網址交給 Claude。
 *
 * 更新程式碼時：貼上新程式碼 → 儲存 → 再執行一次 setup（新功能可能需要重新授權）
 * → 部署 → 管理部署作業 → 鉛筆圖示 → 版本選「新版本」→ 部署。網址不會改變。
 */
const TO = __TO__;

// 個別場站另外副本給場站主管（選填）。例：'minquan': 'manager@example.com'
const SITE_CC = {
};

const TYPES = ['收費／繳費', '設備故障', '服務態度', '環境清潔', '安全問題', '建議或讚美', '其他'];

const SITES = __SITES__;

const SHEET_NAME = '意見紀錄';
const HEAD = ['送出時間', '案件編號', '場站代碼', '停車場', '縣市', '意見類型', '發生時間', '意見內容', '需要回覆', '稱呼', '手機', '電子郵件', '處理狀態', '處理說明', '照片', '通知狀態', '送出代碼'];
const COL = { caseNo: 2, photo: 15, notify: 16, sid: 17 };
const MAX_PHOTO_CHARS = 2900000;   // 單張 base64 字元上限（約 2MB）
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const HOURLY_LIMIT = 30;           // 同一場每小時最多收件數

function doPost(e) {
  try {
    return out(handle(e));
  } catch (err) {
    console.error(err);
    return out({ ok: false, error: 'server' });
  }
}

function handle(e) {
  const p = (e && e.parameter) || {};
  if (e && e.postData && e.postData.length > 9500000) return { ok: false, error: 'size' };
  const get = (k, n) => String(p[k] || '').trim().slice(0, n || 200);
  if (get('website')) return { ok: false, error: 'bot' };          // 機器人填了隱藏欄位

  let sid = get('sid', 40);
  if (!sid) sid = 'srv-' + Utilities.getUuid().replace(/-/g, '');   // 舊版頁面沒有送出代碼：照常收件
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(sid)) return { ok: false, error: 'sid' };
  const siteId = get('site', 40);
  if (!Object.prototype.hasOwnProperty.call(SITES, siteId)) return { ok: false, error: 'site' };
  const site = SITES[siteId];
  const type = get('type', 20), msg = get('msg', 2000);
  if (TYPES.indexOf(type) < 0) return { ok: false, error: 'type' };
  if (msg.length < 5) return { ok: false, error: 'msg' };

  const reply = get('reply', 4) === '需要';
  const name = reply ? get('name', 10) : '';
  const tel = reply ? get('tel', 20).replace(/[\s\-()]/g, '') : '';
  const mail = reply ? get('mail', 120) : '';
  if (reply && !name) return { ok: false, error: 'contact' };
  if (reply && !tel && !mail) return { ok: false, error: 'contact' };
  if (tel && !/^(\+?886|0)9\d{8}$/.test(tel)) return { ok: false, error: 'tel' };
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { ok: false, error: 'mail' };
  const whenRaw = get('when', 16);
  if (whenRaw && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(whenRaw)) return { ok: false, error: 'when' };
  const when = whenRaw.replace('T', ' ');

  // 先做便宜的檢查：重送直接回原案號；超過每小時上限就不再處理照片
  const cache = CacheService.getScriptCache();
  const early = cache.get('s_' + sid);
  if (early) return { ok: true, caseNo: early, dup: true };
  const hourKey = 'h_' + siteId + '_' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  if (Number(cache.get(hourKey) || 0) >= HOURLY_LIMIT) return { ok: false, error: 'rate' };

  // 照片：最多 3 張，必須是網頁端壓縮後的 JPEG
  if (p.p4) return { ok: false, error: 'photo' };
  const photos = [];
  for (let i = 1; i <= 3; i++) {
    const d = String(p['p' + i] || '');
    if (!d) continue;
    if (d.length > MAX_PHOTO_CHARS) return { ok: false, error: 'photo' };
    const m = d.match(/^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/);
    if (!m) return { ok: false, error: 'photo' };
    let bytes;
    try { bytes = Utilities.base64Decode(m[1]); } catch (err) { return { ok: false, error: 'photo' }; }
    if (bytes.length > MAX_PHOTO_BYTES || bytes.length < 4 || bytes[0] !== -1 || bytes[1] !== -40 || bytes[2] !== -1) return { ok: false, error: 'photo' };
    photos.push(bytes);
  }

  // 同一個送出代碼只建立一次案件；同一場每小時有上限
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return { ok: false, error: 'busy' };
  let caseNo;
  const sh = sheet();
  try {
    const seen = findBySid(sh, sid);
    if (seen) return { ok: true, caseNo: seen, dup: true };
    const n = Number(cache.get(hourKey) || 0);
    if (n >= HOURLY_LIMIT) return { ok: false, error: 'rate' };
    caseNo = nextCaseNo();
    const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm');
    sh.appendRow([now, caseNo, siteId, site.name, site.city, type, when, msg, reply ? '需要' : '不需要', name, tel, mail, '未處理', '', photos.length ? '上傳中' : '', '寄送中 ' + now, sid].map(safe));
    SpreadsheetApp.flush();
    cache.put('s_' + sid, caseNo, 21600);
    cache.put(hourKey, String(n + 1), 3600);
  } finally {
    lock.releaseLock();
  }

  // 照片存雲端（逐張記錄結果），再寄信
  const blobs = photos.map((b, i) => Utilities.newBlob(b, 'image/jpeg', caseNo + '_' + (i + 1) + '.jpg'));
  if (blobs.length) {
    const links = blobs.map((b, i) => {
      try { return folder().createFile(b).getUrl(); } catch (err) { console.error(err); return '第 ' + (i + 1) + ' 張未存雲端（見信件附件）'; }
    });
    setBySid(sh, sid, COL.photo, links.join('\n'));
  }
  let notify = '已寄';
  try {
    MailApp.sendEmail(mailOptions({ caseNo, siteId, site, type, when, msg, reply, name, tel, mail, photoCount: blobs.length }, blobs));
  } catch (err) {
    console.error(err);
    notify = '待補寄';
  }
  setBySid(sh, sid, COL.notify, notify);
  return { ok: true, caseNo: caseNo };
}

function mailOptions(c, blobs) {
  const lines = [
    '案件編號：' + c.caseNo,
    c.siteId === 'general' ? '意見對象：一般意見（非特定停車場）' : '停車場：' + c.site.name + '（' + c.site.city + '）',
    '意見類型：' + c.type,
    '發生時間：' + (c.when || '（未填）'),
    '',
    '意見內容：',
    c.msg,
    '',
    '需要回覆：' + (c.reply ? '需要' : '不需要')
  ];
  if (c.reply) {
    lines.push('稱呼：' + (c.name || '（未填）'), '手機：' + (c.tel || '（未留）'), '電子郵件：' + (c.mail || '（未留）'));
  }
  if (c.photoCount === -1) lines.push('照片：有，但雲端存檔失敗，請查看試算表「照片」欄說明');
  else if (c.photoCount) lines.push('照片：' + c.photoCount + ' 張' + (blobs && blobs.length ? '（見附件）' : '（見試算表「照片」欄連結）'));
  lines.push('', '來源：線上顧客意見箱。' + (c.mail ? '直接回覆這封信，就會寄給顧客。' : ''), '所有意見都記錄在「顧客意見箱紀錄」試算表，處理後請更新「處理狀態」欄。');
  const o = { to: TO, subject: '【顧客意見】' + c.site.name.replace(/停車場$/, '') + '｜' + c.type + '｜' + c.caseNo, body: lines.join('\n'), name: '大日開發顧客意見箱' };
  if (SITE_CC[c.siteId]) o.cc = SITE_CC[c.siteId];
  if (c.mail) o.replyTo = c.mail;
  if (blobs && blobs.length) o.attachments = blobs;
  return o;
}

// 每小時自動執行：補寄「待補寄」，以及卡在「寄送中」超過 20 分鐘的案件（照片改附雲端連結）
// 依「送出代碼」定位每一列，承辦人排序或篩選試算表也不會寫錯列
function retryMail() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;            // 已有補寄在跑
  try {
    const sh = sheet();
    const last = sh.getLastRow();
    if (last < 2) return;
    const rows = sh.getRange(2, 1, last - 1, HEAD.length).getValues();
    const now = Date.now();
    rows.forEach(function (r) {
      const st = String(r[COL.notify - 1]), sid = String(r[COL.sid - 1]);
      const stuck = /^寄送中 (\d{4}-\d{2}-\d{2} \d{2}:\d{2})$/.exec(st);
      const due = st === '待補寄' || (stuck && now - new Date(stuck[1].replace(' ', 'T') + ':00+08:00').getTime() > 20 * 60 * 1000);
      if (!due || !sid) return;
      const siteId = String(r[2]);
      const cc = SITE_CC[siteId] ? 1 : 0;
      if (MailApp.getRemainingDailyQuota() < 1 + cc) return;
      const site = SITES[siteId] || { name: String(r[3]), city: String(r[4]) };
      const pc = String(r[COL.photo - 1] || '');
      const links = pc.split('\n').filter(function (x) { return /^https?:/.test(x); }).length;
      const photoCount = links || (pc && pc !== '上傳中' ? -1 : 0);
      setBySid(sh, sid, COL.notify, '補寄中');
      try {
        MailApp.sendEmail(mailOptions({ caseNo: r[1], siteId, site, type: r[5], when: r[6], msg: r[7], reply: r[8] === '需要', name: r[9], tel: String(r[10]).replace(/^'/, ''), mail: r[11], photoCount }, null));
        setBySid(sh, sid, COL.notify, stuck ? '已補寄（原狀態不明，可能重複）' : '已補寄');
      } catch (err) {
        console.error(err);
        setBySid(sh, sid, COL.notify, '待補寄');   // 這一筆下次再試，不影響其他案件
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function setBySid(sh, sid, col, value) {
  const last = sh.getLastRow();
  if (last < 2) return;
  const hit = sh.getRange(2, COL.sid, last - 1, 1).createTextFinder(sid).matchEntireCell(true).findNext();
  if (hit) sh.getRange(hit.getRow(), col).setValue(safe(value));
}

function findBySid(sh, sid) {
  const last = sh.getLastRow();
  if (last < 2) return '';
  const hit = sh.getRange(2, COL.sid, last - 1, 1).createTextFinder(sid).matchEntireCell(true).findNext();
  return hit ? String(sh.getRange(hit.getRow(), COL.caseNo).getValue()) : '';
}

// 外部輸入不讓試算表當成公式
function safe(v) {
  return (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) ? "'" + v : v;
}

function doGet() {
  return out({ ok: true, service: '大日開發顧客意見箱' });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// 案件編號：FB-年月日-當日流水號（呼叫端已持有鎖）
function nextCaseNo() {
  const props = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd');
  const n = props.getProperty('day') === day ? Number(props.getProperty('seq') || 0) + 1 : 1;
  props.setProperties({ day: day, seq: String(n) });
  return 'FB-' + day + '-' + ('000' + n).slice(-4);
}

function sheet() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('sheetId'));
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function folder() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('folderId')) props.setProperty('folderId', DriveApp.createFolder('顧客意見箱照片').getId());
  return DriveApp.getFolderById(props.getProperty('folderId'));
}

// 第一次設定或更新程式碼後執行：建立／升級紀錄試算表、照片資料夾、補寄排程，並寄測試信
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('sheetId')) {
    const ss = SpreadsheetApp.create('顧客意見箱紀錄');
    ss.getSheets()[0].setName(SHEET_NAME);
    props.setProperty('sheetId', ss.getId());
  }
  const sh = sheet();
  if (sh.getName() !== SHEET_NAME) sh.setName(SHEET_NAME);
  sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange('K:K').setNumberFormat('@');
  const f = folder();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'retryMail')) {
    ScriptApp.newTrigger('retryMail').timeBased().everyHours(1).create();
  }
  MailApp.sendEmail(TO, '【測試】顧客意見箱設定成功', '收到這封信，代表顧客意見箱已可寄信。\n紀錄試算表：' + SpreadsheetApp.openById(props.getProperty('sheetId')).getUrl() + '\n照片資料夾：' + f.getUrl());
}
