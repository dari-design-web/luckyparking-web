/**
 * 大日開發｜線上顧客意見箱 → 寄到指定信箱，並記錄到 Google 試算表
 *
 * 設定步驟（只要做一次）：
 * 1. 到 script.google.com 建立新專案，把原本的程式碼刪掉，貼上本檔全部內容後儲存。
 * 2. 修改下方 TO（收件信箱）；若某幾場要另外通知場站主管，填在 SITE_CC。
 * 3. 上方函式選單選「setup」→ 執行 → 依畫面完成授權。
 *    它會在您的雲端硬碟建立「顧客意見箱紀錄」試算表與「顧客意見箱照片」資料夾，並寄一封測試信到 TO。
 *
 * 更新程式碼時（例如新增照片功能）：貼上新程式碼 → 儲存 → 再執行一次 setup（新功能需要重新授權）
 * → 部署 → 管理部署作業 → 鉛筆圖示 → 版本選「新版本」→ 部署。網址不會改變。
 * 4. 收到測試信後：部署 → 新增部署作業 → 類型選「網頁應用程式」
 *    執行身分：我；誰可以存取：所有人 → 部署，把「網頁應用程式網址」交給 Claude。
 */
const TO = 'dari25420001@gmail.com';

// 個別場站另外副本給場站主管（選填）。例：'minquan': 'manager@example.com'
const SITE_CC = {
};

const TYPES = ['收費／繳費', '設備故障', '服務態度', '環境清潔', '安全問題', '建議或讚美', '其他'];

const SITES = {
  'general': { name: '一般意見', city: '—' },
  'tpmc': { name: '臺北流行音樂中心地下停車場', city: '臺北市' },
  'rongxing': { name: '榮星花園地下停車場', city: '臺北市' },
  'minquan': { name: '民權公園地下停車場', city: '臺北市' },
  'yonghe': { name: '雍和園區地下停車場', city: '臺北市' },
  'shezi': { name: '社子國小地下停車場', city: '臺北市' },
  'jinan': { name: '進安公園地下停車場', city: '臺北市' },
  'ntsec': { name: '國立臺灣科學教育館地下停車場', city: '臺北市' },
  'binjiang': { name: '濱江國中地下停車場', city: '臺北市' },
  'guangci1': { name: '廣慈1區社會住宅地下停車場', city: '臺北市' },
  'guangci2': { name: '廣慈2區社會住宅地下停車場', city: '臺北市' },
  'shipai': { name: '石牌國小地下停車場', city: '臺北市' },
  'zhonghe': { name: '中和國小地下停車場', city: '新北市' },
  'tucheng-central': { name: '土城中央公園地下停車場', city: '新北市' },
  'ruifang': { name: '瑞芳立體停車場', city: '新北市' },
  'jinhe': { name: '錦和運動公園地下停車場', city: '新北市' },
  'xinggu': { name: '興榖國小操場地下停車場', city: '新北市' },
  'archives': { name: '國家檔案館地下停車場', city: '新北市' },
  'xiulang': { name: '秀朗國小地下停車場', city: '新北市' },
  'fengshu': { name: '楓樹腳公園地下停車場', city: '新北市' },
  'fuhe': { name: '福和國中地下停車場', city: '新北市' },
  'lujiang': { name: '鷺江立體停車場', city: '新北市' },
  'ruifang-back': { name: '瑞芳後火車站平面停車場', city: '新北市' },
  'tucheng-yanji': { name: '土城延吉立體停車場', city: '新北市' },
  'tucheng-yusheng': { name: '土城裕生立體停車場', city: '新北市' },
  'banqiao-hs': { name: '板橋高中地下停車場', city: '新北市' },
  'siliconvalley': { name: '臺北矽谷大樓地下停車場', city: '新北市' },
  'guangrong': { name: '光榮國小地下停車場', city: '新北市' },
  'xiufeng': { name: '秀峰段平面停車場', city: '新北市' },
  'yangguang': { name: '陽光段平面停車場', city: '新北市' },
  'jinhe-flat': { name: '錦和平面停車場', city: '新北市' },
  'linkou-j1': { name: '林口機一平面停車場', city: '新北市' },
  'tongxing': { name: '同興平面停車場', city: '新北市' },
  'tw64': { name: '台64橋下平面停車場', city: '新北市' },
  'shuidui': { name: '水碓三路平面停車場', city: '新北市' },
  'xinwu': { name: '新五平面停車場', city: '新北市' },
  'hean': { name: '合安路停車場', city: '新北市' },
  'nanlin': { name: '南林段平面停車場', city: '新北市' },
  'yixue': { name: '義學立體停車場', city: '新北市' },
  'taoyuan': { name: '桃園國際原住民族文化創意產業園區地下停車場', city: '桃園市' },
  'xinguang': { name: '新光國際金融中心地下停車場', city: '桃園市' },
  'tyc-youth': { name: '北區青少年活動中心地下停車場', city: '桃園市' },
  'keelung-e34': { name: '基隆港東三東四停車場', city: '基隆市' }
};

function doPost(e) {
  const p = (e && e.parameter) || {};
  const get = (k, n) => String(p[k] || '').trim().slice(0, n || 200);
  if (get('website')) return out({ ok: true, caseNo: '' });       // 機器人填了隱藏欄位：不處理
  if (Number(get('t')) < 4000) return out({ ok: true, caseNo: '' }); // 開頁 4 秒內就送出，多半是機器人

  const siteId = get('site', 40), site = SITES[siteId];
  const type = get('type', 20), msg = get('msg', 2000);
  if (!site) return out({ ok: false, error: 'site' });
  if (TYPES.indexOf(type) < 0) return out({ ok: false, error: 'type' });
  if (msg.length < 5) return out({ ok: false, error: 'msg' });

  const reply = get('reply', 4) === '需要';
  const name = reply ? get('name', 50) : '';
  const tel = reply ? get('tel', 20).replace(/[\s\-()]/g, '') : '';
  const mail = reply ? get('mail', 120) : '';
  if (reply && !tel && !mail) return out({ ok: false, error: 'contact' });
  if (tel && !/^(\+?886|0)9\d{8}$/.test(tel)) return out({ ok: false, error: 'tel' });
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return out({ ok: false, error: 'mail' });
  const when = get('when', 20).replace('T', ' ');

  // 照片：最多 3 張，只收 JPEG（網頁端已壓縮），每張解碼後不超過 2MB
  const photos = [];
  for (let i = 1; i <= 3; i++) {
    const d = String(p['p' + i] || '');
    if (!d) continue;
    const m = d.match(/^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/);
    if (!m) return out({ ok: false, error: 'photo' });
    const bytes = Utilities.base64Decode(m[1]);
    if (bytes.length > 2 * 1024 * 1024) return out({ ok: false, error: 'photo' });
    photos.push(bytes);
  }

  // 防灌爆：同內容 10 分鐘內只收一次；同一場每小時最多 30 件
  const cache = CacheService.getScriptCache();
  const dupKey = 'd_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, siteId + msg));
  if (cache.get(dupKey)) return out({ ok: false, error: 'rate' });
  const hourKey = 'h_' + siteId + '_' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  const n = Number(cache.get(hourKey) || 0);
  if (n >= 30) return out({ ok: false, error: 'rate' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let caseNo;
  try {
    caseNo = nextCaseNo();
  } finally {
    lock.releaseLock();
  }
  const blobs = photos.map((b, i) => Utilities.newBlob(b, 'image/jpeg', caseNo + '_' + (i + 1) + '.jpg'));
  let photoLinks = '';
  if (blobs.length) {
    try {   // 存雲端失敗（例如尚未重新授權）時，照片仍會以附件寄出
      const props = PropertiesService.getScriptProperties();
      if (!props.getProperty('folderId')) props.setProperty('folderId', DriveApp.createFolder('顧客意見箱照片').getId());
      const folder = DriveApp.getFolderById(props.getProperty('folderId'));
      photoLinks = blobs.map(b => folder.createFile(b).getUrl()).join('\n');
    } catch (err) {
      photoLinks = '（照片只在信件附件，未存雲端）';
    }
  }
  {
    const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm');
    sheet().appendRow([now, caseNo, siteId, site.name, site.city, type, when, msg, reply ? '需要' : '不需要', name, tel ? "'" + tel : '', mail, '未處理', '', photoLinks]);
  }
  cache.put(dupKey, '1', 600);
  cache.put(hourKey, String(n + 1), 3600);

  const body = [
    '案件編號：' + caseNo,
    siteId === 'general' ? '意見對象：一般意見（非特定停車場）' : '停車場：' + site.name + '（' + site.city + '）',
    '意見類型：' + type,
    '發生時間：' + (when || '（未填）'),
    '',
    '意見內容：',
    msg,
    '',
    '需要回覆：' + (reply ? '需要' : '不需要'),
    reply ? '稱呼：' + (name || '（未填）') : '',
    reply ? '手機：' + (tel || '（未留）') : '',
    reply ? '電子郵件：' + (mail || '（未留）') : '',
    blobs.length ? '照片：' + blobs.length + ' 張（見附件，也存在雲端硬碟「顧客意見箱照片」資料夾）' : '',
    '',
    '來源：線上顧客意見箱（掃描場站 QR Code）。' + (mail ? '直接回覆這封信，就會寄給顧客。' : ''),
    '所有意見都記錄在「顧客意見箱紀錄」試算表，處理後請更新「處理狀態」欄。'
  ].filter(function (l, i, a) { return l !== '' || a[i - 1] !== ''; }).join('\n');

  const opts = { to: TO, subject: '【顧客意見】' + site.name.replace(/停車場$/, '') + '｜' + type + '｜' + caseNo, body: body, name: '大日開發顧客意見箱' };
  if (SITE_CC[siteId]) opts.cc = SITE_CC[siteId];
  if (mail) opts.replyTo = mail;
  if (blobs.length) opts.attachments = blobs;
  MailApp.sendEmail(opts);
  return out({ ok: true, caseNo: caseNo });
}

function doGet() {
  return out({ ok: true, service: '大日開發顧客意見箱' });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// 案件編號：FB-年月日-當日流水號
function nextCaseNo() {
  const props = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd');
  const n = props.getProperty('day') === day ? Number(props.getProperty('seq') || 0) + 1 : 1;
  props.setProperties({ day: day, seq: String(n) });
  return 'FB-' + day + '-' + ('000' + n).slice(-4);
}

function sheet() {
  const id = PropertiesService.getScriptProperties().getProperty('sheetId');
  return SpreadsheetApp.openById(id).getSheets()[0];
}

// 第一次設定時執行：建立紀錄試算表，並寄測試信
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('sheetId')) {
    const ss = SpreadsheetApp.create('顧客意見箱紀錄');
    const sh = ss.getSheets()[0];
    sh.setName('意見紀錄');
    sh.appendRow(['送出時間', '案件編號', '場站代碼', '停車場', '縣市', '意見類型', '發生時間', '意見內容', '需要回覆', '稱呼', '手機', '電子郵件', '處理狀態', '處理說明', '照片']);
    sh.setFrozenRows(1);
    sh.getRange('A1:O1').setFontWeight('bold');
    props.setProperty('sheetId', ss.getId());
  }
  const sh = sheet();
  if (sh.getRange('O1').getValue() !== '照片') sh.getRange('O1').setValue('照片').setFontWeight('bold');
  if (!props.getProperty('folderId')) props.setProperty('folderId', DriveApp.createFolder('顧客意見箱照片').getId());
  MailApp.sendEmail(TO, '【測試】顧客意見箱設定成功', '收到這封信，代表顧客意見箱已可寄信。\n紀錄試算表：' + SpreadsheetApp.openById(props.getProperty('sheetId')).getUrl() + '\n照片資料夾：' + DriveApp.getFolderById(props.getProperty('folderId')).getUrl());
}
