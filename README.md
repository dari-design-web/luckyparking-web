# 大日開發官網（luckyparking-web）

大日開發有限公司 DARI GROUP／Lucky Parking 官方網站原始碼。純靜態網站，沒有後台與資料庫；內容改在 `src/data/*.json`，跑一次產生器後推上 GitHub 即更新。

## 網址
- 正式網址：https://www.dari.com.tw/（GitHub Pages 自訂網域；舊的 https://dari-design-web.github.io/luckyparking-web/ 會自動轉過來）
- 正式網域：待購買後設定（`docs/CNAME`）。

## 檔案結構
| 位置 | 內容 |
|---|---|
| `src/data/site.json` | 公司名稱、地址、電話、商業合作信箱、Facebook、ESG 報告書連結 |
| `src/data/parking.json` | 停車場清單（名稱、公司、縣市、區、類型、狀態、地圖連結、照片代號） |
| `src/data/venues.json` | 多元化經營場域（國家檔案館、叁肆行、TYAC、舟日咖啡、深澳鐵道自行車） |
| `src/data/awards.json` | 榮譽獎項；`highlight: true` 會出現在首頁 |
| `src/data/news.json` | 最新消息（日期、分類、標題、內文、連結） |
| `assets/css/style.css` | 版型與品牌色（藍 #2561a9、橘 #ef7836，取自 Logo） |
| `assets/js/main.js` | 手機選單、停車場篩選、合作洽詢表單（開啟郵件程式，不經伺服器） |
| `assets/img/` | Logo、ESG QR Code、獎項與場站照片 |
| `build.mjs` | 產生器：讀 JSON，輸出 9 個頁面到 `docs/` |
| `docs/` | 產出的網站（GitHub Pages 發布這個資料夾，勿手動修改） |

## 更新內容
1. 修改 `src/data/` 裡的 JSON，或把照片放進 `assets/img/sites/`（檔名＝`parking.json` 的 `img` 代號＋`.jpg`）。
2. 執行 `node build.mjs`（Node 18 以上，不需安裝套件）。
3. 提交並推上 `main`；GitHub Pages 約 1 分鐘後更新。

## 首次啟用 GitHub Pages
Settings → Pages → Build and deployment → Source 選「Deploy from a branch」→ Branch 選 `main`、資料夾選 `/docs` → Save。免費方案需將 repo 設為 Public。

## 原則
- 數字與年份只放有出處的；不確定的標「資料補充中」。
- 照片不放可辨識人臉（除非已取得同意）與他人商標。
- 不使用中國品牌的服務與素材。

## 線上顧客意見箱（`docs/feedback/`）
- 網址：`https://www.dari.com.tw/feedback/?s=場站代碼`（已印的 QR 立牌是舊的 github.io 網址，GitHub 會自動轉到新網域，所以 repo 名稱與帳號不可更改）；只透過各場 QR Code 進入，不放選單、不列入 sitemap、`noindex`。
- 場站代碼＝`parking.json` 的 `code`，一場一個，不可重複；**已印在 QR 立牌上，發布後不可更改**，新場站只能新增代碼。
- 頁面原始檔：`src/apps/feedback.html`；Apps Script 原始檔：`src/apps/feedback.gs`。執行 `node build.mjs` 會產生 `docs/feedback/index.html` 與 `apps-script/feedback.gs`（已帶入 42 場代碼與收件信箱）。
- `site.json` 的 `feedbackTo`＝收件信箱；`feedbackEndpoint`＝Apps Script 網頁應用程式網址。尚未填網址時，頁面為「試用版」，送出不會寄信。
- 新增或改名停車場後，要重新執行 `node build.mjs`，並**先**把新的 `apps-script/feedback.gs` 貼回 Apps Script、執行 setup、重新部署（管理部署作業 → 編輯 → 新版本），再推上網頁。
- 後端行為：內容相同的重送帶同一個送出代碼（欄位名 reqid；不能用 sid，Google 會直接回 400），不會重複建立案件；內容改過就算新的一則。寄信失敗標「待補寄」、卡在「寄送中」超過 20 分鐘的也會補寄（標示可能重複），每小時自動處理，一筆失敗不影響其他案件。狀態更新依「送出代碼」定位，承辦人排序試算表不會寫錯列（建議用篩選檢視）。外部輸入以文字寫入，不會被當成公式。

## Google 地圖更新進度（`docs/tools/gmaps/`，內部用、noindex）
- 網址：`https://www.dari.com.tw/tools/gmaps/`；頁面原始檔 `src/tools/gmaps.html`，資料 `src/data/gmaps.json`（各場 Google 地點的 cid、目前名稱 `gname`、網站 `web`、申請狀態 `edits`、讀取時間 `asOf`／`editsAsOf`）。
- 判定：名稱以「大日」（大日開發）或「千斗」（千斗開發）開頭；網站等於 `https://www.dari.com.tw/parking.html?s=場站代碼`。每個欄位顯示「待處理／已完成／未接受／已接受／未申請」，有「未接受」的場站列為需重新申請。
- 不用 API 金鑰。Dari 說「更新 Google 地圖狀態」時，由 Claude 用內建瀏覽器（登入 Google 帳號「大日開發DARI」）：
  1. 開 `https://www.google.com/maps/contrib/@25.05,121.49,12z/data=!4m2!8m1!1e4?hl=zh-TW`（你的貢獻＞編輯），捲到底，對每個 `div[data-factual-edit-index]:not([role=button])` 取「地點名稱|提交日期|狀態|欄位」存成文字檔，執行 `python3 scripts/gmaps_edits.py 檔案 "讀取時間ISO"`。
  2. 狀態變成「已接受」的場站，再開 `https://maps.google.com/?cid=…` 讀 `h1` 名稱與 `a[data-item-id=authority]` 網站，更新 `gname`／`web`（舊名稱放進 `names` 以便對應），改 `asOf`。
  3. `node build.mjs` 後推上。
