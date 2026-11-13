// 大日開發官網｜靜態網站產生器（無外部套件）
// 用法：node build.mjs  → 輸出到 docs/（GitHub Pages 從 main 分支的 /docs 發布）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'docs');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8'));
const SITE = read('site.json');
const PARKING = read('parking.json');
const VENUES = read('venues.json');
const AWARDS = read('awards.json');
const NEWS = read('news.json');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const NAV = [
  ['about.html', '關於大日'],
  ['parking.html', '停車場經營'],
  ['venues.html', '多元化經營'],
  ['services.html', '智慧服務'],
  ['awards.html', '榮譽獎項'],
  ['esg.html', '永續 ESG'],
  ['news.html', '最新消息'],
];

const operating = PARKING.filter(p => p.status === '營運中').length;
const upcoming = PARKING.length - operating;

function layout({ file, title, desc, body }) {
  const t = title ? `${title}｜大日開發 DARI GROUP` : '大日開發 DARI GROUP｜Lucky Parking 停車場經營';
  const menu = NAV.map(([href, label]) => `<a href="${href}"${href === file ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t)}</title>
<meta name="description" content="${esc(desc || '大日開發（DARI GROUP）自民國 88 年起經營停車場，並經營商業空間與休閒場域。')}">
<meta property="og:title" content="${esc(t)}">
<meta property="og:description" content="${esc(desc || '')}">
<meta property="og:type" content="website">
<link rel="icon" href="assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Noto+Sans+TC:wght@400;500;700;900&display=swap">
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
<a class="skip" href="#main">跳到主要內容</a>
<header class="nav">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="大日開發 首頁"><img src="assets/img/logo-dari.png" alt="大日 DARI GROUP" width="130" height="34"></a>
    <nav class="menu" id="menu" aria-label="主選單">${menu}</nav>
    <a class="nav-cta" href="contact.html">合作洽詢</a>
    <button class="burger" type="button" id="burger" aria-label="開啟選單" aria-expanded="false" aria-controls="menu">≡</button>
  </div>
</header>
<main id="main">
${body}
</main>
<footer>
  <div class="wrap">
    <div class="fgrid">
      <div>
        <img class="flogo" src="assets/img/logo-dari-full.png" alt="大日開發有限公司 DARI GROUP" width="186" height="30">
        <p>${esc(SITE.address)}<br><span class="num">${esc(SITE.phone)}</span><br>${esc(SITE.email)}</p>
      </div>
      <div><h4>關於</h4><a href="about.html">關於大日</a><a href="awards.html">榮譽獎項</a><a href="esg.html">永續 ESG</a></div>
      <div><h4>事業</h4><a href="parking.html">停車場經營</a><a href="venues.html">多元化經營</a><a href="services.html">智慧服務</a></div>
      <div><h4>聯絡</h4><a href="contact.html">合作洽詢</a><a href="news.html">最新消息</a><a href="${esc(SITE.facebook)}" target="_blank" rel="noopener">Facebook</a></div>
    </div>
    <div class="copy"><span>© ${new Date().getFullYear()} 大日開發有限公司 DARI GROUP</span><span>Lucky Parking 為大日開發停車品牌</span></div>
  </div>
</footer>
<script src="assets/js/main.js" defer></script>
</body>
</html>
`;
}

const ICON = {
  car: '<path d="M5 16h14M6 16l1.5-5h9L18 16M7 16v2M17 16v2"/><circle cx="8.5" cy="13.5" r=".6"/><circle cx="15.5" cy="13.5" r=".6"/>',
  pin: '<path d="M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  pay: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  exit: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0zM12 17v4"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/><path d="M12 21a2.5 2.5 0 0 1 0-5h2"/>'
};
const SERVICES = [
  ['car', '車牌辨識・免取票', '進出場自動辨識車牌，減少排隊與票卡遺失。'],
  ['pay', '多元支付', '行動支付、電子票證與車牌綁定扣款，依場站提供。'],
  ['pin', '車位在席與尋車', '即時顯示空位，輸入車牌即可查詢停放區位。'],
  ['eye', '智慧巡檢', '電子化巡場與案件管理，問題即時派工處理。'],
  ['exit', '智慧逃生引導', '緊急時以燈號與標示引導疏散。'],
  ['plug', '電動車充電', '依場站條件設置充電格位與管理。'],
  ['heart', '友善停車', '無障礙、婦幼與親子停車格及設施。'],
  ['palette', '主題式場域設計', '連鎖不複製：每座停車場依在地特色設計導引與色彩。']
];
const svc = s => `<article><div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[s[0]]}</svg></div><h3>${s[1]}</h3><p>${s[2]}</p></article>`;

const withImg = PARKING.filter(p => p.img);
const fmtDate = d => d.length === 4 ? d : d;
const newsCard = n => `<a href="news.html"><span class="chip ${n.cat === '獲獎' ? 'o' : 'b'}">${esc(n.cat)}</span><h3>${esc(n.title)}</h3><time class="num">${esc(fmtDate(n.date))}</time></a>`;
const sortedNews = [...NEWS].sort((a, b) => b.date.localeCompare(a.date));

const pages = {};

pages['index.html'] = {
  title: '', desc: '大日開發（DARI GROUP）經營公有與民間停車場，並跨足商業空間、休閒遊憩等多元化場域。',
  body: `
<section class="hero">
  <div class="wrap">
    <p class="eyebrow">${esc(SITE.tagline)}</p>
    <h1 style="margin-top:16px">讓每一次停車，<br><span class="hl">都更安心。</span></h1>
    <p class="lead">大日開發自${esc(SITE.founded)}起經營停車場，從公有地下停車場到商業空間與休閒場域，用智慧設備與在地服務照顧每一位用路人。</p>
    <div class="ctas"><a class="btn primary" href="parking.html">查停車據點</a><a class="btn ghost" href="venues.html">看多元化經營</a></div>
  </div>
  <div class="strip" aria-label="經營場站照片">
    ${['ntsec', 'jinhe', 'yonghe', 'taoyuan', 'xiulang', 'tpmc'].map(id => { const p = PARKING.find(x => x.img === id); return `<figure><img src="assets/img/sites/${id}.jpg" alt="${esc(p.name)}"><figcaption>${esc(p.name.replace(/(地下|立體|平面)?停車場$/, ''))}</figcaption></figure>`; }).join('')}
  </div>
</section>

<section class="band alt tight">
  <div class="wrap">
    <div class="stats">
      <div class="stat"><b class="num">${PARKING.length}<sub>處</sub></b><span>經營停車場（${operating} 處營運中、${upcoming} 處即將啟用）</span></div>
      <div class="stat"><b class="num">${VENUES.length}<sub>處</sub></b><span>多元化經營場域</span></div>
      <div class="stat"><b class="num">3<sub>座</sub></b><span>財政部金擘獎優等</span></div>
      <div class="stat"><b class="num">15<sub>場</sub></b><span>114 年度新北市金停獎（3 特優、12 優等）</span></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="head"><div><p class="eyebrow">我們的事業</p><h2 style="margin-top:8px">停車場，<br>也是城市的生活場域。</h2></div></div>
    <div class="pillars">
      <a class="pillar" href="parking.html"><img src="assets/img/sites/rongxing.jpg" alt=""><span class="k">PARKING</span><h3>停車場經營</h3><p>公有與民間停車場委外經營，涵蓋臺北、新北、桃園、基隆。</p><span class="go">${PARKING.length} 處停車場</span></a>
      <a class="pillar brand" href="venues.html"><span class="k">BEYOND PARKING</span><h3>多元化經營</h3><p>結合商業空間、餐飲與休閒遊憩，讓停車延伸成完整的到訪體驗。</p><div class="names">${VENUES.map(v => `<span>${esc(v.name.split('｜')[0])}</span>`).join('')}</div><span class="go">了解多元化經營</span></a>
    </div>
  </div>
</section>

<section class="band alt">
  <div class="wrap">
    <div class="head"><div><p class="eyebrow">連鎖不複製</p><h2 style="margin-top:8px">每一座停車場，<br>都有自己的主題。</h2></div><a class="link" href="parking.html">全部停車場</a></div>
    <div class="bento">
      <a class="tile photo c4 tall" href="parking.html"><img src="assets/img/sites/ntsec-gate.jpg" alt=""><h3>國立臺灣科學教育館</h3><p>「科學之森・友善 START」，讓停車成為科學互動的第一步。</p></a>
      <a class="tile photo c2 tall" href="parking.html"><img src="assets/img/sites/xiulang.jpg" alt=""><h3>永和秀朗國小</h3><p>Show Long 行歸處。</p></a>
      <a class="tile photo c2" href="parking.html"><img src="assets/img/sites/jinan.jpg" alt=""><h3>進安公園</h3><p>科技與安全並行。</p></a>
      <a class="tile photo c2" href="parking.html"><img src="assets/img/sites/shezi.jpg" alt=""><h3>社子國小</h3><p>全面同行，有愛通學。</p></a>
      <a class="tile photo c2" href="parking.html"><img src="assets/img/sites/fengshu-in.jpg" alt=""><h3>泰山楓樹腳公園</h3><p>多年新北評鑑特優。</p></a>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="head"><div><p class="eyebrow">智慧及貼心服務</p><h2 style="margin-top:8px">科技做得到的，<br>我們先做。</h2></div><a class="link" href="services.html">了解服務</a></div>
    <div class="svc">${SERVICES.slice(0, 4).map(svc).join('')}</div>
  </div>
</section>

<section class="band dark">
  <div class="wrap awards">
    <div class="pic"><img src="assets/img/awards/award-jinbi.jpg" alt="財政部金擘獎優等獎座三座：106、107、110 年度"></div>
    <div>
      <p class="eyebrow">榮譽獎項</p>
      <h2 style="margin-top:8px;font-size:clamp(28px,4vw,44px);line-height:1.18">三座金擘獎優等，<br>15 場金停獎肯定。</h2>
      <ul class="alist" style="margin-top:24px">
        ${AWARDS.filter(a => a.highlight).map(a => `<li><span class="y num">${a.year}</span><div><b>${esc(a.title)}</b><span>${esc(a.detail)}</span></div></li>`).join('')}
      </ul>
      <a class="link" href="awards.html" style="display:inline-block;margin-top:20px;color:#ffb380">全部獎項</a>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="head"><div><p class="eyebrow">最新消息</p><h2 style="margin-top:8px">公告與動態</h2></div><a class="link" href="news.html">全部消息</a></div>
    <div class="news">${sortedNews.slice(0, 3).map(newsCard).join('')}</div>
  </div>
</section>

<section class="band alt">
  <div class="wrap esg">
    <div>
      <p class="eyebrow">永續 ESG</p>
      <h2 style="margin-top:8px;font-size:clamp(28px,4vw,44px);line-height:1.18">取之於社會，<br>用之於社會。</h2>
      <p class="muted" style="margin-top:14px;max-width:44ch">每年提撥營餘投入公益：贊助基層球隊、希望工程課後照顧與公益捐血，108 年獲頒華人公益大使。</p>
      <a class="link" href="esg.html" style="display:inline-block;margin-top:16px">前往永續 ESG</a>
    </div>
    <div class="report"><img src="${SITE.esgReport.qr}" alt="掃描下載 ${esc(SITE.esgReport.title)}" width="150" height="150"><div><b>${esc(SITE.esgReport.title)}</b><small>掃描 QR Code 或點按鈕下載 PDF</small><a class="btn primary" href="${esc(SITE.esgReport.url)}" target="_blank" rel="noopener">下載報告書</a></div></div>
  </div>
</section>

<section class="band tight">
  <div class="wrap"><div class="head" style="margin:0">
    <div><h2>想把停車場或商業空間交給我們？</h2><p style="margin-top:8px">停車場委外經營，或商業空間、休閒場域等多元化合作，都歡迎聯繫。</p></div>
    <a class="btn orange" href="contact.html">合作洽詢</a>
  </div></div>
</section>`
};

pages['about.html'] = {
  title: '關於大日', desc: '大日開發成立於民國 88 年，經營停車場與多元化場域。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">關於大日</p><h1>深入在地，<br>便利停車，智慧生活。</h1><p class="lead">大日開發成立於${esc(SITE.founded)}，資本額${esc(SITE.capital)}。以停車場經營為核心，結合場域規劃、商業空間與休閒遊憩，打造新型態的智慧停車模式。</p></div></section>
<section class="band tight"><div class="wrap">
  <div class="group">
    <article><p class="eyebrow">民國 88 年成立</p><h3 style="margin-top:6px">大日開發有限公司</h3><p>集團核心。經營公有與民間停車場，並經營國家檔案館、東三東四旅客服務中心「叁肆行」、桃園青年體驗學習園區、後湖溪親水園區與舟日咖啡、深澳鐵道自行車等多元化場域。</p></article>
    <article><p class="eyebrow">民國 93 年成立</p><h3 style="margin-top:6px">千斗開發有限公司</h3><p>關係企業。承襲大日開發的經營經驗，導入智慧停車管理設備，經營臺北、新北多處公有地下與平面停車場。</p></article>
  </div>
</div></section>
<section class="band alt"><div class="wrap">
  <div class="head"><h2>經營理念</h2></div>
  <div class="svc three">
    <article><p class="eyebrow">深入在地</p><h3 style="margin-top:6px">了解每個社區的需求</h3><p>從周邊生活、通學、商圈出發，規劃停車動線與服務。</p></article>
    <article><p class="eyebrow">便利停車</p><h3 style="margin-top:6px">從進場到離場一路順暢</h3><p>車牌辨識、多元支付與清楚導引，減少等待。</p></article>
    <article><p class="eyebrow">智慧生活</p><h3 style="margin-top:6px">用科技讓停車更簡單</h3><p>在席偵測、尋車、電子化巡檢，持續導入新技術。</p></article>
  </div>
</div></section>
<section class="band"><div class="wrap">
  <div class="head"><h2>重要歷程</h2><p>年份依公司資料與公開紀錄整理。</p></div>
  <div class="tl-wrap"><div class="tl">
    <div><b class="num">1999</b><p>大日開發成立（民國 88 年）</p></div>
    <div><b class="num">2004</b><p>千斗開發成立（民國 93 年）</p></div>
    <div><b class="num">2015</b><p>與資策會合作開發 MoBuy 智慧停車 App</p></div>
    <div><b class="num">2016</b><p>智慧運輸產業創新獎</p></div>
    <div><b class="num">2017</b><p>金擘獎優等、兩項導航發明專利</p></div>
    <div><b class="num">2018</b><p>金擘獎優等</p></div>
    <div><b class="num">2021</b><p>金擘獎優等</p></div>
    <div><b class="num">2025</b><p>新北市金停獎 3 場特優、12 場優等</p></div>
  </div></div>
</div></section>`
};

const cities = ['全部', ...new Set(PARKING.map(p => p.city))];
pages['parking.html'] = {
  title: '停車場經營', desc: `大日開發與千斗開發經營的 ${PARKING.length} 處停車場。`,
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">停車場經營</p><h1>${PARKING.length} 處停車場，<br>遍及北北桃基。</h1><p class="lead">公有地下停車場、立體與平面停車場的委外經營。依縣市或經營公司篩選，點「地圖」查看位置。</p></div></section>
<section class="band tight" style="padding-top:8px"><div class="wrap">
  <div class="filters" role="group" aria-label="依縣市篩選">${cities.map(c => `<button type="button" data-f="city" data-v="${c}" aria-pressed="${c === '全部'}">${c}</button>`).join('')}</div>
  <div class="filters" role="group" aria-label="依經營公司篩選">${['全部', '大日開發', '千斗開發'].map(c => `<button type="button" data-f="company" data-v="${c}" aria-pressed="${c === '全部'}">${c === '全部' ? '全部公司' : c}</button>`).join('')}</div>
  <p class="count" id="count" role="status">共 ${PARKING.length} 處</p>
  <div class="sites" id="sites-grid">${PARKING.map(s => `<article class="site">${s.img ? `<div class="im"><img src="assets/img/sites/${s.img}.jpg" alt="${esc(s.name)}" loading="lazy"></div>` : '<div class="im ph-img">照片準備中</div>'}<div class="bd"><h3>${esc(s.name)}</h3></div></article>`).join('')}</div>
  <script type="application/json" id="parking-data">${JSON.stringify(PARKING).replace(/</g, '\\u003c')}</script>
</div></section>`
};

pages['venues.html'] = {
  title: '多元化經營', desc: '國家檔案館、叁肆行、桃園青年體驗學習園區、後湖溪親水園區與舟日咖啡、深澳鐵道自行車。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">多元化經營</p><h1>不只停車，<br>還有值得停留的地方。</h1><p class="lead">把停車場經營的經驗延伸到商業空間、餐飲與休閒遊憩，讓到訪者從停好車開始，就有完整的體驗。</p></div></section>
<section class="band tight" style="padding-top:8px"><div class="wrap"><div class="vcards">
  ${VENUES.map(v => `<article class="vcard" id="${v.id}">
    <div class="vimg">${v.img ? `<img src="${v.img}" alt="${esc(v.name)}" loading="lazy">` : '<span>場域意象・照片準備中</span>'}</div>
    <div class="vb">
      <p class="eyebrow">${esc(v.kind)}</p>
      <h2>${esc(v.name)}</h2>
      <p class="addr">${esc(v.address || v.city)}</p>
      <p class="muted">${esc(v.summary)}</p>
      ${v.points.length ? `<ul>${v.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      <div class="vlinks">${v.link ? `<a class="link" href="${esc(v.link)}" target="_blank" rel="noopener">前往官網</a>` : ''}${v.todo ? '<span class="todo" style="margin-left:0">資料補充中</span>' : ''}</div>
    </div></article>`).join('')}
</div></div></section>
<section class="band alt"><div class="wrap">
  <div class="head"><div><p class="eyebrow">合作模式</p><h2 style="margin-top:8px">單純停車場，<br>或整個場域一起經營。</h2></div><a class="btn orange" href="contact.html">合作洽詢</a></div>
  <div class="coop">
    <article><p class="eyebrow">PARKING</p><h3>停車場委外經營</h3><ul><li>公有停車場標案與營運移轉</li><li>民間大樓、園區停車場代管</li><li>智慧停管設備導入與場域改善</li></ul></article>
    <article><p class="eyebrow">BEYOND PARKING</p><h3>商業空間與多元化合作</h3><ul><li>商業空間＋停車場整合經營</li><li>餐飲、休閒遊憩與體驗場域營運</li><li>場域規劃與活動合作</li></ul></article>
  </div>
</div></section>`
};

pages['services.html'] = {
  title: '智慧服務', desc: '車牌辨識、多元支付、車位在席與尋車、智慧巡檢等服務。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">智慧及貼心服務</p><h1>從進場到離場，<br>每一步都想好了。</h1></div></section>
<section class="band tight"><div class="wrap"><div class="svc">${SERVICES.map(svc).join('')}</div></div></section>
<section class="band alt"><div class="wrap"><div class="bento">
  <div class="tile photo c3 tall"><img src="assets/img/sites/jinan.jpg" alt=""><h3>車牌辨識・免取票</h3><p>進出場自動辨識，搭配多元支付。</p></div>
  <div class="tile photo c3 tall"><img src="assets/img/sites/yonghe-b1.jpg" alt=""><h3>清楚的場內導引</h3><p>色彩分區、樓層標示與尋車資訊。</p></div>
</div></div></section>`
};

pages['awards.html'] = {
  title: '榮譽獎項', desc: '財政部金擘獎優等三座、新北市金停獎等榮譽。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">榮譽獎項</p><h1>被肯定的經營品質</h1></div></section>
<section class="band tight"><div class="wrap"><div class="bento">
  <div class="tile c4 tall" style="background:#fff;padding:0;border:1px solid var(--line)"><img src="assets/img/awards/award-jinbi.jpg" alt="金擘獎優等獎座" style="position:static;width:100%;height:100%;object-fit:contain"></div>
  <div class="tile c2 tall"><p class="eyebrow">財政部</p><h3 style="margin-top:8px">金擘獎優等 ×3</h3><p class="muted">106、107、110 年度民間經營團隊</p></div>
  <div class="tile c3" style="background:#fff;padding:0;min-height:220px;border:1px solid var(--line)"><img src="assets/img/awards/award-jinting.jpg" alt="114 年度新北市金停獎獎狀" style="position:static;width:100%;height:100%;object-fit:contain"></div>
  <div class="tile c3"><p class="eyebrow">新北市政府 114 年度</p><h3 style="margin-top:8px">金停獎 3 場特優、12 場優等</h3><p class="muted">特優：三重光榮國小、中和錦和運動公園、碧潭東岸平面停車場</p></div>
</div></div></section>
<section class="band alt"><div class="wrap">
  <div class="tbl"><table><thead><tr><th>年份</th><th>獎項</th><th>說明</th></tr></thead><tbody>
  ${AWARDS.map(a => `<tr><td class="n">${a.year}</td><td><b>${esc(a.title)}</b></td><td>${esc(a.detail)}</td></tr>`).join('')}
  </tbody></table></div>
</div></section>`
};

pages['esg.html'] = {
  title: '永續 ESG', desc: '大日開發 2025 永續報告書下載與公益足跡。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">永續 ESG</p><h1>取之於社會，<br>用之於社會。</h1><p class="lead">環境、社會與公司治理的做法與成果，完整內容請見永續報告書。</p></div></section>
<section class="band tight"><div class="wrap esg">
  <div class="report"><img src="${SITE.esgReport.qr}" alt="掃描下載 ${esc(SITE.esgReport.title)}" width="150" height="150"><div><b>${esc(SITE.esgReport.title)}</b><small>大日開發有限公司・PDF</small><a class="btn primary" href="${esc(SITE.esgReport.url)}" target="_blank" rel="noopener">下載報告書</a></div></div>
  <div><h2 style="font-size:28px">手機掃描即可下載</h2><p class="muted" style="margin-top:10px">QR Code 連到 Google 雲端硬碟上的報告書檔案，開啟後可直接下載。</p></div>
</div></section>
<section class="band alt"><div class="wrap">
  <div class="svc three">
    <article><p class="eyebrow">E 環境</p><h3 style="margin-top:6px">場站環境</h3><p>場站維護與綠美化，依場站條件設置電動車充電。<span class="todo">依報告書補充</span></p></article>
    <article><p class="eyebrow">S 社會</p><h3 style="margin-top:6px">公益與友善停車</h3><p>每年提撥營餘投入公益：贊助基層球隊、希望工程課後照顧、公益捐血。</p></article>
    <article><p class="eyebrow">G 治理</p><h3 style="margin-top:6px">品質管理</h3><p>以電子化案件管理追蹤各場站營運與設施維修。</p></article>
  </div>
</div></section>
<section class="band"><div class="wrap">
  <div class="head"><h2>公益足跡</h2></div>
  <div class="tl-wrap"><div class="tl">
    <div><b class="num">長期</b><p>公益贊助棒球隊、壘球隊、籃球隊</p></div>
    <div><b class="num">長期</b><p>希望工程課業輔導延長照顧計畫</p></div>
    <div><b class="num">2019</b><p>獲頒華人公益大使（108 年）</p></div>
    <div><b class="num">2024</b><p>公益捐血活動</p></div>
  </div></div>
</div></section>`
};

pages['news.html'] = {
  title: '最新消息', desc: '大日開發公告與動態。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">最新消息</p><h1>公告與動態</h1></div></section>
<section class="band tight" style="padding-top:8px"><div class="wrap"><div class="nlist">
  ${sortedNews.map(n => `<article><time class="num muted">${esc(n.date)}</time><div><span class="chip ${n.cat === '獲獎' ? 'o' : 'b'}">${esc(n.cat)}</span><h3 style="margin-top:6px">${esc(n.title)}</h3>${n.body ? `<p>${esc(n.body)}</p>` : ''}${n.link ? `<p><a class="link" href="${esc(n.link)}" target="_blank" rel="noopener">相關連結</a></p>` : ''}</div></article>`).join('')}
</div></div></section>`
};

pages['contact.html'] = {
  title: '合作洽詢', desc: '停車場委外經營與商業空間多元化合作洽詢。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">合作洽詢</p><h1>兩種合作方式，<br>找到適合您的。</h1></div></section>
<section class="band tight"><div class="wrap"><div class="coop">
  <article><p class="eyebrow">PARKING</p><h3>停車場委外經營</h3><ul><li>公有停車場標案與營運移轉</li><li>民間大樓、園區、社宅停車場代管</li><li>智慧停管設備導入與場域改善</li></ul></article>
  <article><p class="eyebrow">BEYOND PARKING</p><h3>商業空間與多元化合作</h3><ul><li>商業空間＋停車場整合經營</li><li>餐飲、休閒遊憩場域營運</li><li>場域規劃與活動合作</li></ul></article>
</div></div></section>
<section class="band alt"><div class="wrap contact">
  <dl>
    <div><dt>商業合作信箱</dt><dd>${esc(SITE.email)}</dd></div>
    <div><dt>電話</dt><dd class="num">${esc(SITE.phone)}</dd></div>
    <div><dt>地址</dt><dd>${esc(SITE.address)}</dd></div>
    <div><dt>社群</dt><dd><a href="${esc(SITE.facebook)}" target="_blank" rel="noopener">Facebook 粉絲專頁</a></dd></div>
  </dl>
  <form class="f" id="cform" data-to="${esc(SITE.email)}" novalidate>
    <div class="row">
      <label for="c-name">姓名<input id="c-name" name="name" required autocomplete="name"></label>
      <label for="c-org">單位<input id="c-org" name="org" autocomplete="organization"></label>
    </div>
    <div class="row">
      <label for="c-mail">電子郵件<input id="c-mail" name="mail" type="email" required autocomplete="email"></label>
      <label for="c-tel">電話<input id="c-tel" name="tel" type="tel" autocomplete="tel"></label>
    </div>
    <label for="c-type">合作類別<select id="c-type" name="type"><option>停車場委外經營</option><option>商業空間與多元化合作</option><option>場站服務意見</option><option>其他</option></select></label>
    <label for="c-msg">內容<textarea id="c-msg" name="msg" rows="5" required></textarea></label>
    <p class="note">按「寄出」會開啟您的郵件程式並帶入內容，由您確認後寄出；本網站不另外儲存您的資料。</p>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><button class="btn primary" type="submit">寄出</button><span class="status" id="cstatus" role="status"></span></div>
  </form>
</div></section>`
};

// build
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true });
for (const [file, p] of Object.entries(pages)) {
  fs.writeFileSync(path.join(OUT, file), layout({ file, ...p }));
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log('built', Object.keys(pages).length, 'pages →', OUT);
