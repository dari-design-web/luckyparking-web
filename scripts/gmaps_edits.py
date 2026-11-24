"""把 Google 地圖「你的貢獻 > 編輯」頁讀到的清單併入 src/data/gmaps.json。
輸入每行：序號|地點名稱|提交日期|狀態|欄位,欄位,...（頁面由新到舊）
用法：python3 scripts/gmaps_edits.py 清單.txt "2026-11-24T17:45:00+08:00"
"""
import json, sys, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
P = ROOT / 'src/data/gmaps.json'
data = json.loads(P.read_text(encoding='utf-8'))
lots = data['lots']
# 名稱對應：目前 Google 名稱＋歷史名稱
alias = {}
for code, l in lots.items():
    for n in [l.get('gname', '')] + l.get('names', []):
        if n: alias.setdefault(n, code)
FIELD = {'名稱': 'name', '網站': 'web'}
seen, unmatched = {}, set()
for ln in pathlib.Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    parts = ln.split('|')
    if len(parts) < 5: continue
    _, title, date, status, fields = parts[:5]
    code = alias.get(title.strip())
    if not code: unmatched.add(title.strip()); continue
    for f in [x.strip() for x in fields.split(',') if x.strip()]:
        k = FIELD.get(f)
        if not k: continue
        key = (code, k)
        if key in seen: continue          # 只取每個欄位最新的一筆
        seen[key] = {'status': status.strip(), 'date': date.strip()}
for code, l in lots.items():
    l['edits'] = {k: v for (c, k), v in seen.items() if c == code}
data['editsAsOf'] = sys.argv[2]
P.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print('對應到', len({c for c, _ in seen}), '場；未對應：', sorted(unmatched))
