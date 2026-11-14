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

function layout({ file, title, desc, body, base, noindex }) {
  const t = title ? `${title}｜大日開發 DARI GROUP` : '大日開發 DARI GROUP｜Lucky Parking 停車場經營';
  const menu = NAV.map(([href, label]) => `<a href="${href}"${href === file ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
${base ? `<base href="${base}">` : ''}<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t)}</title>
<meta name="description" content="${esc(desc || '大日開發（DARI GROUP）自民國 88 年起經營停車場，並經營商業空間與休閒場域。')}">
<meta property="og:title" content="${esc(t)}">
<meta property="og:description" content="${esc(desc || '')}">
<meta property="og:type" content="website">
<meta property="og:image" content="${SITE.baseUrl}assets/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="zh_TW">
<meta name="twitter:card" content="summary_large_image">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE.baseUrl}${file === 'index.html' ? '' : file}">`}
<meta name="theme-color" content="#2561a9">
<link rel="icon" href="assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Noto+Sans+TC:wght@400;500;700;900&display=swap">
<link rel="stylesheet" href="assets/css/style.css">
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="skip" href="#main">跳到主要內容</a>
<header class="nav">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="大日開發 首頁"><img src="assets/img/logo-dari.png" alt="大日 DARI GROUP" width="130" height="34"></a>
    <nav class="menu" id="menu" aria-label="主選單">${menu}<div class="menu-extra"><a href="careers.html"${file === 'careers.html' ? ' aria-current="page"' : ''}>人才招募</a><div class="menu-actions"><a class="btn primary" href="contact.html">合作洽詢</a><a class="btn ghost" href="tel:${SITE.phone.replace(/[^0-9]/g, '')}">撥打 ${esc(SITE.phone)}</a></div></div></nav>
    <a class="nav-cta" href="contact.html">合作洽詢</a>
    <button class="burger" type="button" id="burger" aria-label="開啟選單" aria-expanded="false" aria-controls="menu"><span></span><span></span><span></span></button>
  </div>
</header>
<main id="main">
${body}
</main>
<nav class="tabbar" aria-label="快速功能">
  <a href="parking.html"${file === 'parking.html' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.pin}</svg>查停車</a>
  <a href="venues.html"${file === 'venues.html' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.heart}</svg>多元場域</a>
  <a href="tel:${SITE.phone.replace(/[^0-9]/g, '')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>來電</a>
  <a href="contact.html"${file === 'contact.html' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>合作洽詢</a>
</nav>
<footer>
  <div class="fband" aria-hidden="true"></div>
  <div class="wrap">
    <div class="fgrid">
      <div>
        <img class="flogo" src="assets/img/logo-dari-full.png" alt="大日開發有限公司 DARI GROUP" width="186" height="30">
        <p>${esc(SITE.address)}<br><a class="num" href="tel:${SITE.phone.replace(/[^0-9]/g, '')}">${esc(SITE.phone)}</a><br><a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a></p>
      </div>
      <div><h4>關於</h4><a href="about.html">關於大日</a><a href="awards.html">榮譽獎項</a><a href="esg.html">永續 ESG</a><a href="careers.html">人才招募</a></div>
      <div><h4>事業</h4><a href="parking.html">停車場經營</a><a href="venues.html">多元化經營</a><a href="services.html">智慧服務</a></div>
      <div><h4>聯絡</h4><a href="contact.html">合作洽詢</a><a href="news.html">最新消息</a><a href="${esc(SITE.facebook)}" target="_blank" rel="noopener">Facebook</a></div>
    </div>
    <div class="copy"><span>© ${new Date().getFullYear()} 大日開發有限公司 DARI GROUP・<a href="privacy.html">隱私權聲明</a></span><span>Lucky Parking 為大日開發停車品牌</span></div>
  </div>
</footer>
<dialog class="vdialog" id="vdialog" aria-label="影片播放"><button class="vclose" type="button" aria-label="關閉影片">✕</button><video controls playsinline preload="none"></video></dialog>
<script src="assets/js/main.js" defer onerror="document.documentElement.classList.remove('js')"></script>
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
  ['pin', '車位在席與尋車', '設有空位顯示或尋車設備的場站，可依現場指引查詢。'],
  ['eye', '智慧巡檢', '電子化巡場與案件管理，問題即時派工處理。'],
  ['exit', '智慧逃生引導', '緊急時以燈號與標示引導疏散。'],
  ['plug', '電動車充電', '依場站條件設置充電格位與管理。'],
  ['heart', '友善停車', '無障礙停車位，以及孕婦及育有六歲以下兒童者停車位，依各場公告與現場標示使用。'],
  ['palette', '主題式場域設計', '連鎖不複製：每座停車場依在地特色設計導引與色彩。']
];
const svc = s => `<article><div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[s[0]]}</svg></div><h3>${s[1]}</h3><p>${s[2]}</p></article>`;

const withImg = PARKING.filter(p => p.img);
const fmtDate = d => d.length === 4 ? d : d;
const NEWS_IMG = { '公告': 'notice', '獲獎': 'award', '場域': 'venue' };
const newsCard = n => `<a href="news.html#n-${n.date}"><img class="nimg" src="assets/img/news-${NEWS_IMG[n.cat] || 'notice'}.jpg" alt="" loading="lazy"><span class="chip ${n.cat === '獲獎' ? 'o' : 'b'}">${esc(n.cat)}</span><h3>${esc(n.title)}</h3><time class="num">${esc(fmtDate(n.date))}</time></a>`;
const sortedNews = [...NEWS].sort((a, b) => b.date.localeCompare(a.date));

const R = SITE.esgReport;
const reportCard = () => `<div class="report"><img src="${R.qr}" alt="掃描開啟 ${esc(R.title)}" width="150" height="150"><div><b>${esc(R.title)}</b><small>${esc(R.subtitle)}</small><div class="rbtns"><a class="btn primary" href="${esc(R.url)}" target="_blank" rel="noopener">線上閱讀</a><a class="btn ghost" href="${esc(R.download)}">下載 PDF</a></div></div></div>`;
const sunBand = () => `<section class="sunband" id="sun-breakfast" aria-label="太陽早餐計畫">
  <video class="sunbg bgv" data-mobile="1" muted loop playsinline preload="none" poster="assets/img/sun-poster.jpg" data-src="assets/video/sun-bg.mp4" aria-hidden="true"></video>
  <div class="wrap suntext">
    <p class="eyebrow">公益計畫</p>
    <h2>太陽早餐計畫<span class="yr num">2016–2026</span></h2>
    <p class="sub">一份早餐・十年陪伴・持續前行</p>
    <p class="lead">我們想做的很簡單：讓孩子吃飽，再去上學。大日開發自 2016 年起支持基隆市太陽早餐計畫。</p>
    <button class="btn light" type="button" data-video="assets/video/sun-full.mp4" data-title="太陽早餐計畫｜有人記得你"><span aria-hidden="true">▶</span> 觀看影片（有聲・65 秒）</button>
  </div>
</section>`;
const DEPTS = ['營運管理部', '工程管理部', '財務管理及計畫預算部', '行銷企劃部', '人力資源部', '商業開發部', '廣告設計部', '資訊管理部', '法務部'];

const pages = {};

pages['index.html'] = {
  title: '', desc: '大日開發（DARI GROUP）經營公有與民間停車場，並跨足商業空間、休閒遊憩等多元化場域。',
  body: `
<section class="vhero" aria-label="主視覺">
  <div class="vmedia">${SITE.hero.video ? `<video id="hero-video" class="bgv" data-mobile="1" muted loop playsinline preload="none" poster="${SITE.hero.poster}" data-src="${SITE.hero.video}" aria-hidden="true"></video>` : `<img src="${SITE.hero.poster}" alt="">`}</div>
  <div class="wrap vtext">
    <p class="eyebrow">${esc(SITE.tagline)}</p>
    <h1>讓停車與到訪，<br>都更順路。</h1>
    <p class="lead">大日開發經營公有與民間停車場，也經營旅客服務中心、戶外學習園區與觀光遊憩場域。從入口到離場，把導引、繳費與現場協助做好，讓人容易抵達、安心停留。</p>
    <div class="ctas"><a class="btn primary" href="parking.html">查停車據點</a><a class="btn light" href="venues.html">看多元化經營</a></div>
  </div>
</section>
<section class="band alt tight statband">
  <div class="wrap">
    <div class="stats">
      <div class="stat"><i class="si"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.car}</svg></i><b class="num"><span class="cu" data-to="${PARKING.length}">${PARKING.length}</span><sub>處</sub></b><span>停車場據點，遍及臺北、新北、桃園、基隆</span></div>
      <div class="stat"><i class="si"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.heart}</svg></i><b class="num"><span class="cu" data-to="${VENUES.length}">${VENUES.length}</span><sub>處</sub></b><span>多元化經營場域</span></div>
      <div class="stat"><i class="si"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.shield}</svg></i><b class="num"><span class="cu" data-to="3">3</span><sub>座</sub></b><span>財政部金擘獎優等</span></div>
      <div class="stat"><i class="si"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.pin}</svg></i><b class="num"><span class="cu" data-to="15">15</span><sub>場</sub></b><span>114 年度新北市金停獎（3 特優、12 優等）</span></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="head"><div><p class="eyebrow">我們的事業</p><h2 style="margin-top:8px">停車場，<br>也是城市的生活場域。</h2></div></div>
    <div class="pillars">
      <a class="pillar" href="parking.html"><img src="assets/img/pillar-parking.jpg" alt=""><span class="k">PARKING</span><h3>停車場經營</h3><p>公有與民間停車場委外經營，涵蓋臺北、新北、桃園、基隆。</p><span class="go">${PARKING.length} 處停車場</span></a>
      <a class="pillar brand" href="venues.html"><img src="assets/img/venues/railbike.jpg" alt=""><span class="k">BEYOND PARKING</span><h3>多元化經營</h3><p>結合商業空間、餐飲與休閒遊憩，讓停車延伸成完整的到訪體驗。</p><div class="names">${VENUES.map(v => `<span>${esc(v.name.split('｜')[0])}</span>`).join('')}</div><span class="go">了解多元化經營</span></a>
    </div>
  </div>
</section>

<section class="band alt">
  <div class="wrap">
    <div class="head"><div><p class="eyebrow">連鎖不複製</p><h2 style="margin-top:8px">每一座停車場，<br>都有自己的主題。</h2></div><a class="link" href="parking.html">全部停車場</a></div>
    <div class="bento">
      <a class="tile photo c4 tall" href="parking.html?q=科學教育館"><img src="assets/img/sites/ntsec-gate.jpg" alt=""><h3>國立臺灣科學教育館</h3><p>「科學之森・友善 START」，讓停車成為科學互動的第一步。</p></a>
      <a class="tile photo c2 tall" href="parking.html?q=秀朗"><img src="assets/img/sites/xiulang.jpg" alt=""><h3>永和秀朗國小</h3><p>Show Long 行歸處。</p></a>
      <a class="tile photo c2" href="parking.html?q=進安"><img src="assets/img/sites/jinan.jpg" alt=""><h3>進安公園</h3><p>科技與安全並行。</p></a>
      <a class="tile photo c2" href="parking.html?q=社子"><img src="assets/img/sites/shezi.jpg" alt=""><h3>社子國小</h3><p>全面同行，有愛通學。</p></a>
      <a class="tile photo c2" href="parking.html?q=楓樹腳"><img src="assets/img/sites/fengshu-in.jpg" alt=""><h3>泰山楓樹腳公園</h3><p>多年新北評鑑特優。</p></a>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="head"><div><p class="eyebrow">多元化經營</p><h2 style="margin-top:8px">從停車入口，<br>走進不同的場域。</h2></div><a class="link" href="venues.html">五個場域</a></div>
    <div class="vtiles">
      ${VENUES.map((v, i) => `<a class="tile photo" href="venues.html#${v.id}"><img src="${v.img.replace('.jpg', '-800.jpg')}" alt="" loading="lazy"><span class="tag">${esc(v.imgNote || '場域意象')}</span><h3>${esc(v.name.split('｜')[0])}</h3><p>${esc(v.kind)}・${esc(v.city)}</p></a>`).join('')}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="head"><div><p class="eyebrow">智慧及貼心服務</p><h2 style="margin-top:8px">從辨識、導引到繳費，<br>讓停車更順暢。</h2></div><a class="link" href="services.html">了解服務</a></div>
    <div class="svc">${SERVICES.slice(0, 4).map(svc).join('')}</div>
  </div>
</section>

<section class="band dark awardband">
  <div class="abg" aria-hidden="true"><video class="abv bgv" muted loop playsinline preload="none" poster="assets/img/awards-poster.jpg" data-src="assets/video/awards.mp4"></video></div>
  <div class="wrap awards">
    <div class="atext">
      <p class="eyebrow">榮譽獎項</p>
      <h2 style="margin-top:8px;font-size:clamp(28px,4vw,44px);line-height:1.18">3 座金擘獎優等，<br>15 場金停獎肯定。</h2>
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

${sunBand()}

<section class="band alt">
  <div class="wrap esg">
    <div>
      <p class="eyebrow">永續 ESG</p>
      <h2 style="margin-top:8px;font-size:clamp(28px,4vw,44px);line-height:1.18">取之於社會，<br>用之於社會。</h2>
      <p class="muted" style="margin-top:14px;max-width:44ch">2024 年起依 ISO 14064-1 自願盤查溫室氣體，並持續投入公益：贊助基層球隊、希望工程課後照顧與公益捐血。</p>
      <a class="link" href="esg.html" style="display:inline-block;margin-top:16px">前往永續 ESG</a>
    </div>
    ${reportCard()}
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
<section class="ph"><div class="wrap"><p class="eyebrow">關於大日</p><h1>深入在地，<br>便利停車，智慧生活。</h1><p class="lead">大日開發成立於${esc(SITE.founded)}，資本額${esc(SITE.capital)}，${esc(SITE.employees)}同仁。以停車場經營為基礎，跨足商業空間、旅遊景點與遊憩產業，目標是「創造一個政府、民眾與企業三贏的未來」。</p></div></section>
<section class="band tight"><div class="wrap">
  <div class="group">
    <article><p class="eyebrow">民國 88 年成立</p><h3 style="margin-top:6px">大日開發有限公司</h3><p>集團核心。經營公有與民間停車場，也在國家檔案館經營附屬商業空間與地下停車場。多元化經營場域包括東三東四旅客服務中心「叁肆行」、桃園青年體驗學習園區、後湖溪親水園區與舟日咖啡，以及深澳鐵道自行車。</p></article>
    <article><p class="eyebrow">民國 93 年成立</p><h3 style="margin-top:6px">千斗開發有限公司</h3><p>關係企業。承襲大日開發的經營經驗，導入智慧停車管理設備，經營臺北、新北多處公有地下與平面停車場。</p></article>
  </div>
</div></section>
<section class="band alt"><div class="wrap">
  <div class="head"><h2>經營理念</h2></div>
  <div class="svc three">
    <article class="imgcard"><img src="assets/img/about-1.jpg" alt="" loading="lazy"><p class="eyebrow">深入在地</p><h3 style="margin-top:6px">了解每個社區的需求</h3><p>從周邊生活、通學、商圈出發，規劃停車動線與服務。</p></article>
    <article class="imgcard"><img src="assets/img/about-2.jpg" alt="" loading="lazy"><p class="eyebrow">便利停車</p><h3 style="margin-top:6px">從進場到離場一路順暢</h3><p>車牌辨識、多元支付與清楚導引，減少等待。</p></article>
    <article class="imgcard"><img src="assets/img/about-3.jpg" alt="" loading="lazy"><p class="eyebrow">智慧生活</p><h3 style="margin-top:6px">用科技讓停車更簡單</h3><p>在席偵測、尋車、電子化巡檢，持續導入新技術。</p></article>
  </div>
</div></section>
<section class="band"><div class="wrap">
  <div class="head"><h2>重要歷程</h2><p>年份依公司資料與公開紀錄整理。</p></div>
  <div class="tl-wrap"><div class="tl">
    <div><b class="num">1999</b><p>大日開發成立（民國 88 年）</p></div>
    <div><b class="num">2004</b><p>千斗開發成立（民國 93 年）</p></div>
    <div><b class="num">2015</b><p>與資策會合作開發 MoBuy 智慧停車 App</p></div>
    <div><b class="num">2016</b><p>智慧運輸產業創新獎；開始支持基隆市太陽早餐計畫</p></div>
    <div><b class="num">2017</b><p>金擘獎優等、兩項導航發明專利</p></div>
    <div><b class="num">2018</b><p>金擘獎優等</p></div>
    <div><b class="num">2019</b><p>臺灣建築獎首獎（E-square 基隆東岸廣場，過往營運實績）</p></div>
    <div><b class="num">2021</b><p>金擘獎優等（桃園青年體驗學習園區）</p></div>
    <div><b class="num">2024</b><p>叁肆行好食城開幕；依 ISO 14064-1 完成首次溫室氣體盤查</p></div>
    <div><b class="num">2025</b><p>新北市金停獎 3 場特優、12 場優等</p></div>
  </div></div>
</div></section>
<section class="band alt"><div class="wrap">
  <div class="head"><div><h2>部門分工</h2><p style="margin-top:8px">依 2024 年溫室氣體盤查報告書所列組織。</p></div><a class="link" href="careers.html">加入我們</a></div>
  <div class="pill-list">${DEPTS.map(d => `<span>${d}</span>`).join('')}</div>
</div></section>`
};

const SITE_TYPE = { '地下': 'underground', '立體': 'multistorey', '平面': 'surface' };
const siteCard = x => {
  let img, cap = '';
  if (x.img) { img = `<img src="assets/img/sites/${x.img}.jpg" alt="${esc(x.name)}" loading="lazy">`; if (x.imgNote === '暫用') cap = '<span class="imcap">暫用照片</span>'; }
  else if (SITE_TYPE[x.type]) { img = `<img src="assets/img/sites/type-${SITE_TYPE[x.type]}.jpg" alt="" loading="lazy">`; cap = '<span class="imcap"><span>場型示意</span><span class="sep">｜</span><span>非現場照片</span></span>'; }
  else img = '';
  const im = img ? `<div class="im">${img}${cap}</div>` : '<div class="im ph-img"><span class="imcap">照片準備中</span></div>';
  const map = x.map ? `<a class="map" href="${esc(x.map)}" target="_blank" rel="noopener" aria-label="在地圖上查看${esc(x.name)}${x.mapLabel ? '周邊' : ''}">${esc(x.mapLabel || '地圖')}</a>` : '';
  return `<article class="site"><div class="bd"><h3>${esc(x.name)}</h3><div class="meta"><span class="chip">${esc(x.city)}${x.district ? ' ' + esc(x.district) : ''}</span><span class="chip b">${esc(x.type)}</span>${x.status === '營運中' ? '<span class="chip g">營運中</span>' : ''}</div><span class="co">${esc(x.company)}</span>${x.imgCredit ? `<a class="credit" href="${esc(x.imgCredit.url)}" target="_blank" rel="noopener">${esc(x.imgCredit.label)}</a>` : ''}${(x.address || map) ? `<div class="loc">${x.address ? `<span class="addr">${esc(x.address)}</span>` : ''}${map}</div>` : ''}</div>${im}</article>`;
};
const cities = ['全部', ...new Set(PARKING.map(p => p.city))];
pages['parking.html'] = {
  title: '停車場經營', desc: `大日開發與千斗開發的 ${PARKING.length} 處停車場據點。`,
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">停車場經營</p><h1>${PARKING.length} 處停車場，<br>遍及北北桃基。</h1><p class="lead">公有地下停車場、立體與平面停車場的委外經營。瀏覽各地停車據點，點「地圖」查看位置。</p></div></section>
<section class="band tight" style="padding-top:8px"><div class="wrap">
  <p class="note nojs-note">以下可直接瀏覽 ${PARKING.length} 處停車據點，點「地圖」查看位置。搜尋與篩選功能需要瀏覽器啟用 JavaScript。</p>
  <div class="search pk-ctl"><label for="q" class="sr">搜尋停車場</label><input id="q" type="search" placeholder="搜尋名稱、行政區或路名，例如：中和、榮星" autocomplete="off" aria-describedby="qhint"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></div>
  <div class="qhint pk-ctl" id="qhint"><span id="qhint-t" role="status"></span><a href="#results" id="qhint-go" hidden>看結果 ↓</a><button type="button" class="linkbtn" id="qhint-clear" hidden>清除關鍵字</button></div>
  <div class="citymap" aria-label="依縣市分布">${cities.filter(c => c !== '全部').map(c => `<button type="button" class="cm" data-city="${c}"><b class="num">${PARKING.filter(p => p.city === c).length}</b><span>${c}</span></button>`).join('')}</div>
  <div class="filters pk-ctl" role="group" aria-label="依縣市篩選">${cities.map(c => `<button type="button" data-f="city" data-v="${c}" aria-pressed="${c === '全部'}">${c}</button>`).join('')}</div>
  <div class="filters pk-ctl" role="group" aria-label="依經營公司篩選">${['全部', '大日開發', '千斗開發'].map(c => `<button type="button" data-f="company" data-v="${c}" aria-pressed="${c === '全部'}">${c === '全部' ? '全部公司' : c}</button>`).join('')}</div>
  <h2 class="count" id="results" tabindex="-1">共 ${PARKING.length} 處</h2>
  <div class="zero pk-ctl" id="zero" hidden><button type="button" class="btn ghost" id="clear-f">清除縣市與公司篩選</button></div>
  <div class="sites" id="sites-grid">${PARKING.map(siteCard).join('')}</div>
  <script type="application/json" id="parking-data">${JSON.stringify(PARKING).replace(/</g, '\\u003c')}</script>
</div></section>`
};

pages['venues.html'] = {
  title: '多元化經營', desc: '國家檔案館、叁肆行、桃園青年體驗學習園區、後湖溪親水園區與舟日咖啡、深澳鐵道自行車。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">多元化經營</p><h1>不只停車，<br>還有值得停留的地方。</h1><p class="lead">把停車場經營的經驗延伸到商業空間、餐飲與休閒遊憩，讓到訪者從停好車開始，就有完整的體驗。</p></div></section>
<section class="band tight" style="padding-top:8px"><div class="wrap"><div class="vcards">
  ${VENUES.map(v => `<article class="vcard" id="${v.id}">
    <div class="vimg">${v.img ? `<img src="${v.img}" srcset="${v.img.replace('.jpg', '-800.jpg')} 800w, ${v.img} 1600w" sizes="(max-width:640px) 100vw, (max-width:980px) 50vw, 400px" alt="${esc(v.name)}（${esc(v.imgNote || '照片')}）" loading="lazy">${v.imgNote ? `<span class="tag">${esc(v.imgNote)}</span>` : ''}` : '<span>照片準備中</span>'}</div>
    <div class="vb">
      <p class="eyebrow">${esc(v.kind)}</p>
      <h2>${esc(v.name)}</h2>
      <p class="addr">${esc(v.address || v.city)}</p>
      <p class="muted">${esc(v.summary)}</p>
      ${v.points.length ? `<ul>${v.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${v.brands ? `<details class="brands"><summary class="bt">進駐品牌（${v.brands.reduce((a, g) => a + g.items.length, 0)}）</summary><div class="bpanel">${v.brands.map(g => `<p class="bg">${esc(g.group)}</p><div class="pill-list sm">${g.items.map(b => `<span>${esc(b)}</span>`).join('')}</div>`).join('')}${v.brandsNote ? `<p class="bn">${esc(v.brandsNote)}${v.brandsSrc ? ` <a href="${esc(v.brandsSrc)}" target="_blank" rel="noopener">基隆港好食城店家資訊</a>` : ''}</p>` : ''}</div></details>` : ''}
      <div class="vlinks">${v.link ? `<a class="link" href="${esc(v.link)}" target="_blank" rel="noopener">${esc(v.linkLabel || '前往官網')}</a>` : ''}${v.todo ? '<span class="todo" style="margin-left:0">資料補充中</span>' : ''}</div>
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
  title: '智慧服務', desc: '從入場、導引與找車、付款、離場到現場管理的停車服務。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">智慧及貼心服務</p><h1>從進場到離場，<br>每一步都有清楚指引。</h1><p class="lead">依各場的空間、設備與車流安排停車服務。實際提供的功能與付款方式，以各場公告為準。</p></div></section>
<section class="band tight" style="padding-top:0"><div class="wrap">
  ${[
    ['01', '入場辨識', '依場站設備採車牌辨識或其他入場方式。遇辨識異常時，依現場指示聯繫服務人員。', 'svc-01'],
    ['02', '導引與找車', '利用車道標線、樓層與分區標示辨認方向。設有空位顯示或尋車設備的場站，可依介面查詢。', 'svc-02'],
    ['03', '付款', '依各場公告選用現金、電子支付或其他方式。完成繳費後，請按場站指示於期限內離場。', 'svc-03'],
    ['04', '離場', '請依出口標示離場。若設備未顯示繳費完成，或出口設備異常，請依現場指示聯繫服務人員。', 'svc-04'],
    ['05', '現場管理', '透過巡檢、設備維護與事件通報處理異常，並依場站條件提供民眾諮詢與協助。', 'svc-05']
  ].map(([n, t, d, img]) => `<div class="venue"><div class="vimg" style="position:relative"><img src="assets/img/svc/${img}.jpg" alt="" loading="lazy"><span class="tag">服務意象</span></div><div><p class="eyebrow num">STEP ${n}</p><h2>${t}</h2><p class="muted" style="margin-top:12px;font-size:18px">${d}</p></div></div>`).join('')}
</section>
<section class="band alt"><div class="wrap">
  <div class="head"><div><h2>依場站條件提供的設備與服務</h2><p style="margin-top:8px">各場實際提供項目不同，請以現場與各場公告為準。</p></div><a class="link" href="parking.html">查各場資訊</a></div>
  <ul class="svlist">${SERVICES.map(x => `<li><i><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[x[0]]}</svg></i><div><b>${x[1]}</b><span>${x[2]}</span></div></li>`).join('')}</ul>
</div></section>`
};

pages['awards.html'] = {
  title: '榮譽獎項', desc: '財政部金擘獎優等三座、新北市金停獎等榮譽。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">榮譽獎項</p><h1>被肯定的經營品質</h1></div></section>
<section class="band tight"><div class="wrap"><div class="bento">
  <div class="tile c4 tall imgtile" style="background:#fff;padding:0;border:1px solid var(--line)"><img src="assets/img/awards/award-jinbi.jpg" alt="金擘獎優等獎座" style="position:static;width:100%;height:100%;object-fit:contain"></div>
  <div class="tile c2 tall"><p class="eyebrow">財政部</p><h3 style="margin-top:8px">3 座金擘獎優等</h3><p class="muted">106、107、110 年度民間經營團隊</p></div>
  <div class="tile c3 imgtile" style="background:#fff;padding:0;min-height:220px;border:1px solid var(--line)"><img src="assets/img/awards/award-jinting.jpg" alt="114 年度新北市金停獎獎狀" style="position:static;width:100%;height:100%;object-fit:contain"></div>
  <div class="tile c3"><p class="eyebrow">新北市政府 114 年度</p><h3 style="margin-top:8px">金停獎 3 場特優、12 場優等</h3><p class="muted">特優：三重光榮國小、中和錦和運動公園、碧潭東岸平面停車場</p></div>
</div></div></section>
<section class="band alt"><div class="wrap">
  <div class="tbl"><table><thead><tr><th>年份</th><th>獎項</th><th>說明</th></tr></thead><tbody>
  ${AWARDS.map(a => `<tr><td class="n">${a.year}</td><td class="t"><b>${esc(a.title)}</b></td><td class="d">${esc(a.detail)}</td></tr>`).join('')}
  </tbody></table></div>
</div></section>`
};

pages['esg.html'] = {
  title: '永續 ESG', desc: '大日開發 2025 永續報告書（2024 年溫室氣體盤查）與公益足跡。',
  body: `
${sunBand()}
<section class="ph"><div class="wrap"><p class="eyebrow">永續 ESG</p><h1>取之於社會，<br>用之於社會。</h1><p class="lead">從總公司的溫室氣體盤查開始，掌握自己的排放，再擬定減量做法；同時持續投入在地公益。</p><nav class="anchors" aria-label="本頁導覽"><a href="#report">報告書下載</a><a href="#ghg">環境盤查</a><a href="#footprint">公益足跡</a><a href="#sun-breakfast">太陽早餐計畫</a></nav></div></section>
<section class="band tight" id="report"><div class="wrap esg">
  ${reportCard()}
  <div><h2 style="font-size:28px">手機掃描即可開啟</h2><p class="muted" style="margin-top:10px">QR Code 連到報告書線上閱讀頁；「下載 PDF」直接下載同一份檔案（約 6.6 MB）。</p></div>
</div></section>
<section class="band alt" id="ghg"><div class="wrap">
  <div class="head"><div><p class="eyebrow">E 環境</p><h2 style="margin-top:8px">2024 年溫室氣體盤查</h2></div><p>依 ISO/CNS 14064-1:2018，自願盤查臺北總公司（基準年 2024）。</p></div>
  <div class="ghg">
    <div class="ghg-total" role="group" aria-label="臺北總公司 2024 年總排放量 64.0 公噸二氧化碳當量"><b class="num" aria-hidden="true">64.0</b><span aria-hidden="true">公噸 CO₂e<br>臺北總公司 2024 年總排放量</span></div>
    <div class="ghg-bar" role="img" aria-label="排放占比：直接排放 45.3%、使用產品 20.0%、外購電力 19.7%、運輸 15.0%">
      <span style="flex:45.32;background:var(--blue)"></span><span style="flex:20;background:#6f9bd1"></span><span style="flex:19.68;background:var(--orange)"></span><span style="flex:15.01;background:#f4b088"></span>
    </div>
    <ul class="ghg-legend">
      <li><i style="background:var(--blue)"></i>類別一　直接排放（公務車等）<b class="num">45.3%</b></li>
      <li><i style="background:#6f9bd1"></i>類別四　使用產品（採購物品等）<b class="num">20.0%</b></li>
      <li><i style="background:var(--orange)"></i>類別二　外購電力<b class="num">19.7%</b></li>
      <li><i style="background:#f4b088"></i>類別三　運輸（員工通勤、商務差旅）<b class="num">15.0%</b></li>
    </ul>
  </div>
  <div class="svc three" style="margin-top:28px">
    <article><h3>持續推動節能減碳</h3><p>依盤查結果提出可行的減量方案並執行。</p></article>
    <article><h3>全員參與</h3><p>成立溫室氣體盤查小組，由總經理擔任主席，成員皆完成培訓。</p></article>
    <article><h3>遵循法規與標準</h3><p>遵行環保法規，以國內外標準作為自我提升的依據。</p></article>
  </div>
</div></section>
<section class="band"><div class="wrap">
  <div class="svc three">
    <article><p class="eyebrow">S 社會</p><h3 style="margin-top:6px">公益與在地</h3><p>2016 年起支持基隆市太陽早餐計畫；每年提撥營餘投入公益：贊助基層球隊、希望工程課後照顧與公益捐血；108 年獲頒華人公益大使。</p></article>
    <article><p class="eyebrow">S 社會</p><h3 style="margin-top:6px">${esc(SITE.employees)}同仁</h3><p>總公司與各停車場、場域的服務團隊，部門涵蓋營運、工程、商業開發、資訊與法務。</p></article>
    <article><p class="eyebrow">G 治理</p><h3 style="margin-top:6px">盤查管理程序</h3><p>訂有溫室氣體盤查管理與內部查證程序，報告每年製作一次，紀錄保存 6 年。</p></article>
  </div>
</div></section>
<section class="band alt" id="footprint"><div class="wrap">
  <div class="head"><h2>公益足跡</h2></div>
  <div class="tl-wrap"><div class="tl">
    <div><b class="num">2016 起</b><p>支持基隆市太陽早餐計畫</p></div>
    <div><b class="num">長期</b><p>公益贊助棒球隊、壘球隊、籃球隊</p></div>
    <div><b class="num">長期</b><p>希望工程課業輔導延長照顧計畫</p></div>
    <div><b class="num">2019</b><p>獲頒華人公益大使（108 年）</p></div>
    <div><b class="num">2024</b><p>公益捐血活動</p></div>
  </div></div>
  <p class="muted" style="margin-top:18px;font-size:14px">活動照片整理中。</p>
</div></section>`
};

pages['careers.html'] = {
  title: '人才招募', desc: '加入大日開發：停車場營運、場域經營、工程、行銷與資訊等職務。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">人才招募</p><h1>一起把每一處場域，<br>經營得更好。</h1><p class="lead">大日開發${esc(SITE.employees)}同仁，在總公司與北北桃基的停車場、商業空間與遊憩場域工作。我們需要願意在現場解決問題的人。</p><nav class="anchors" aria-label="本頁導覽"><a href="#fields">工作領域</a><a href="#apply">應徵方式</a></nav></div></section>
<section class="band tight" id="fields"><div class="wrap reorder">
  <div class="intro-img"><img src="assets/img/img-careers.jpg" alt="" loading="lazy"><p>從停車場的每日巡檢、設備維護，到商業空間與遊憩場域的營運，每個職務都在協助民眾順利到訪、安心使用場域。</p></div>
  <div class="head"><h2>工作領域</h2></div>
  <div class="svc three">
    <article><div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.car}</svg></div><h3>停車場營運</h3><p>場站服務、巡場與現場協助，維持停車場每天順暢運作。</p></article>
    <article><div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.heart}</svg></div><h3>場域經營</h3><p>商業空間、咖啡、體驗園區與觀光設施的營運與服務。</p></article>
    <article><div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.plug}</svg></div><h3>工程與設備</h3><p>停管設備、機電與場站設施的維護、改善與導入。</p></article>
    <article><div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.palette}</svg></div><h3>行銷與設計</h3><p>場域活動企劃、廣告設計、社群與品牌經營。</p></article>
    <article><div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.eye}</svg></div><h3>資訊管理</h3><p>停車系統、資料管理與數位服務開發。</p></article>
    <article><div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.shield}</svg></div><h3>行政與管理</h3><p>財務、人資、法務與商業開發。</p></article>
  </div>
</div></section>
<section class="band alt" id="apply"><div class="wrap">
  <div class="head"><div><h2>目前職缺</h2><p style="margin-top:8px">職缺資訊整理中。歡迎來信自我推薦。</p></div></div>
  <div class="coop">
    <article><p class="eyebrow">怎麼應徵</p><h3>來信附上履歷</h3><ul><li>信件主旨寫「應徵：職務名稱」</li><li>附上履歷與可聯絡時間</li><li>收到後由人資與您聯繫</li></ul><p style="margin-top:16px"><a class="btn primary" href="mailto:${esc(SITE.jobsEmail)}?subject=${encodeURIComponent('應徵：')}">寄送履歷</a></p></article>
    <article><p class="eyebrow">工作地點</p><h3>總公司與各場站</h3><ul><li>總公司：${esc(SITE.address)}</li><li>停車場：臺北、新北、桃園、基隆</li><li>場域：林口、基隆港、桃園新屋、瑞芳</li></ul></article>
  </div>
  <p class="muted" style="margin-top:16px;font-size:14px">履歷僅用於招募聯繫，請勿附身分證件影本。寄送履歷前，請先閱讀<a href="privacy.html">隱私權聲明</a>。</p>
</div></section>`
};

pages['news.html'] = {
  title: '最新消息', desc: '大日開發公告與動態。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">最新消息</p><h1>公告與動態</h1></div></section>
<section class="band tight" style="padding-top:8px"><div class="wrap"><div class="nlist">
  ${sortedNews.map((n, i) => `<article id="n-${n.date}"${i && sortedNews[i - 1].cat === n.cat ? ' class="compact"' : ''}><time class="num muted" datetime="${esc(n.date)}">${esc(n.date)}</time>${i && sortedNews[i - 1].cat === n.cat ? '<span class="nimg-ph" aria-hidden="true"></span>' : `<img class="nimg" src="assets/img/news-${NEWS_IMG[n.cat] || 'notice'}.jpg" alt="" loading="lazy">`}<div><span class="chip ${n.cat === '獲獎' ? 'o' : 'b'}">${esc(n.cat)}</span><h3 style="margin-top:6px">${esc(n.title)}</h3>${n.body ? `<p>${esc(n.body)}</p>` : ''}${n.link ? `<p><a class="link" href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.linkLabel || '相關連結')}</a></p>` : ''}</div></article>`).join('')}
</div></div></section>`
};

pages['contact.html'] = {
  title: '合作洽詢', desc: '停車場委外經營與商業空間多元化合作洽詢。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">合作洽詢</p><h1>兩種合作方式，<br>找到適合您的。</h1><nav class="anchors" aria-label="本頁導覽"><a href="#modes">看合作方式</a><a href="#cform">直接洽詢</a></nav></div></section>
<section class="band tight" id="modes"><div class="wrap reorder"><div class="intro-img"><img src="assets/img/img-contact.jpg" alt="" loading="lazy"><p>不論是公有停車場委外、民間停車場代管，或商業空間與遊憩場域的整體經營，我們會先了解場域條件與目標，再提出可行的經營規劃。</p></div><div class="coop">
  <article><p class="eyebrow">PARKING</p><h3>停車場委外經營</h3><ul><li>公有停車場標案與營運移轉</li><li>民間大樓、園區、社宅停車場代管</li><li>智慧停管設備導入與場域改善</li></ul></article>
  <article><p class="eyebrow">BEYOND PARKING</p><h3>商業空間與多元化合作</h3><ul><li>商業空間＋停車場整合經營</li><li>餐飲、休閒遊憩場域營運</li><li>場域規劃與活動合作</li></ul></article>
</div></div></section>
<section class="band alt"><div class="wrap contact">
  <dl>
    <div><dt>商業合作信箱</dt><dd><a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a></dd></div>
    <div><dt>電話</dt><dd class="num"><a href="tel:${SITE.phone.replace(/[^0-9]/g, '')}">${esc(SITE.phone)}</a></dd></div>
    <div><dt>地址</dt><dd>${esc(SITE.address)}</dd></div>
    <div><dt>社群</dt><dd><a href="${esc(SITE.facebook)}" target="_blank" rel="noopener">Facebook 粉絲專頁</a></dd></div>
  </dl>
  <p class="note nojs-note">目前請直接來信 <a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a> 或來電 <a href="tel:${SITE.phone.replace(/[^0-9]/g, '')}">${esc(SITE.phone)}</a> 洽詢（聯絡資訊見本頁）。</p>
  <form class="f js-only" id="cform" aria-describedby="cform-intro" data-to="${esc(SITE.email)}" data-tel="${esc(SITE.phone)}" novalidate onsubmit="return false">
    <p class="note" id="cform-intro" style="margin:0 0 4px">也可以直接來信 <a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a> 或來電 <a href="tel:${SITE.phone.replace(/[^0-9]/g, '')}">${esc(SITE.phone)}</a>。姓名、電子郵件與內容為必填。</p>
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
    <p class="note">姓名、電子郵件與洽詢內容供回覆使用；未填寫必要項目，將無法完成草稿或回覆。電話、單位可依需要提供。選擇「開啟郵件草稿」後，請在郵件程式確認內容再寄出；本網站不會儲存表單內容，請勿填寫身分證字號、車牌等非必要資料。詳見<a href="privacy.html">隱私權聲明</a>。</p>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><button class="btn primary" type="submit" disabled>開啟郵件草稿</button><span class="status" id="cstatus" role="status"></span></div>
  </form>
</div></section>`
};

pages['privacy.html'] = {
  title: '隱私權聲明', desc: '大日開發官方網站隱私權聲明。',
  body: `
<section class="ph"><div class="wrap"><p class="eyebrow">隱私權聲明</p><h1>我們怎麼處理<br>您提供的資料</h1><p class="lead">本網站不設會員、不設線上表單資料庫，也不使用廣告追蹤。</p></div></section>
<section class="band tight" style="padding-top:0"><div class="wrap"><div class="prose">
  <h2>一、適用範圍</h2>
  <p>本聲明適用於大日開發有限公司（以下稱本公司）官方網站，以及您透過本網站寄送給本公司的電子郵件。網站中連結的其他網站（例如場域官網、政府網站、Google 雲端硬碟），依各該網站的隱私權政策處理。</p>
  <h2>二、蒐集的資料與目的</h2>
  <p>本網站不會自動儲存您輸入的內容。「合作洽詢」表單與「寄送履歷」按鈕，是開啟您自己的郵件程式，由您確認後寄到 ${esc(SITE.email)}。本公司只會收到您寄出的郵件內容，例如姓名、單位、電話、電子郵件、洽詢內容或履歷。</p>
  <ul><li>合作洽詢：用於回覆與聯繫合作事宜。</li><li>應徵：用於招募評估與面試聯繫。</li></ul>
  <p>姓名、電子郵件與洽詢內容是回覆所需；未提供時，本公司將無法回覆。電話、單位可依需要提供。</p>
  <h2>三、利用期間、地區、對象與方式</h2>
  <p>您寄來的郵件由本公司使用的電子郵件服務收存，並由本公司相關承辦人員為上述目的使用。資料保存至達成目的所需期間，之後依本公司規定刪除或銷毀；除法令另有規定或經您同意外，不作其他用途。利用地區、對象與保存期間的細節，可來信 ${esc(SITE.email)} 查詢。</p>
  <h2>四、您的權利</h2>
  <p>依個人資料保護法第 3 條，您可以請求查詢、閱覽、製給複製本、補充或更正、停止蒐集、處理或利用，或請求刪除個人資料。請來信 ${esc(SITE.email)}，本公司將於確認身分後處理。</p>
  <h2>五、Cookie 與外部服務</h2>
  <p>本網站不使用追蹤型 Cookie。網頁字體由 Google Fonts 提供，影片與圖片由本網站直接提供；連到外部網站時，該網站可能依其政策記錄瀏覽資訊。</p>
  <h2>六、聲明修訂</h2>
  <p>本聲明如有修訂，將公告於本頁。最後更新：2026 年 11 月 14 日。</p>
  <h2>七、聯絡方式</h2>
  <p>大日開發有限公司｜${esc(SITE.address)}｜<span class="num">${esc(SITE.phone)}</span>｜${esc(SITE.email)}</p>
</div></div></section>`
};

pages['404.html'] = {
  title: '找不到頁面', desc: '找不到這個頁面。', base: SITE.basePath, noindex: true,
  body: `
<section class="ph" style="min-height:52vh"><div class="wrap"><p class="eyebrow num">404</p><h1>這個頁面不在這裡。</h1><p class="lead">網址可能已經變更，或頁面已移除。可以回首頁，或直接查停車據點。</p><div class="ctas" style="justify-content:flex-start"><a class="btn primary" href="index.html">回首頁</a><a class="btn ghost" href="parking.html">查停車據點</a></div><div class="e404"><img src="assets/img/img-404.jpg" alt=""></div></div></section>`
};

// build
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true });
const PH = { 'about.html': 'about', 'parking.html': 'parking', 'venues.html': 'venues', 'services.html': 'services', 'awards.html': 'awards', 'esg.html': 'esg', 'news.html': 'news', 'contact.html': 'contact', 'careers.html': 'careers' };
const PH_DARK = new Set(['awards']);
const PH_SHORT = new Set(['parking', 'news']);
const PH_VIDEO = {
  parking: { src: 'assets/video/parking.mp4', poster: 'assets/img/ph/parking-poster.jpg' },
  venues: { src: 'assets/video/venues.mp4', poster: 'assets/img/ph/venues-poster.jpg' },
  esg: { src: 'assets/video/esg.mp4', poster: 'assets/img/ph/esg-poster.jpg' },
  about: { src: 'assets/video/about.mp4', poster: 'assets/img/ph/about-poster.jpg' },
  services: { src: 'assets/video/services.mp4', poster: 'assets/img/ph/services-poster.jpg' },
  awards: { src: 'assets/video/awards-ph.mp4', poster: 'assets/img/ph/awards-poster.jpg' },
};
for (const [file, p] of Object.entries(pages)) {
  const n = PH[file];
  const vid = PH_VIDEO[n];
  if (n) p.body = p.body.replace('<section class="ph"><div class="wrap">', `<section class="ph has-img${PH_DARK.has(n) ? ' dark' : ''}${vid ? ' has-vid' : ''}${PH_SHORT.has(n) ? ' short' : ''}"><picture class="phimg"><source media="(max-width:700px)" srcset="assets/img/ph/${n}-m.jpg"><img src="${vid ? vid.poster : `assets/img/ph/${n}.jpg`}" alt="" fetchpriority="high"></picture>${vid ? `<video class="bgv" muted loop playsinline preload="none" poster="${vid.poster}" data-src="${vid.src}" aria-hidden="true"></video>` : ''}<div class="wrap">`);
  fs.writeFileSync(path.join(OUT, file), layout({ file, ...p }));
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(pages).filter(f => f !== '404.html').map(f => `  <url><loc>${SITE.baseUrl}${f === 'index.html' ? '' : f}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE.baseUrl}sitemap.xml\n`);
console.log('built', Object.keys(pages).length, 'pages →', OUT);
