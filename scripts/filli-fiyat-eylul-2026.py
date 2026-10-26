# Filli Eylül 2026 maliyet analizi → canlı Supabase (26 Ekim 2026 uygulandı, 133 satır).
# FİLLİ/FAWORİ sütun H = KDV hariç liste → plate_prices.base_price ve accessories.base_price; PW50 paket m² (YÜKLEME).
# Satır numaraları bu dosyaya özeldir; yeni listede önce kuru çalıştırıp ad eşleşmesini kontrol et.
# Kullanım: uv run --with openpyxl python -I scripts/filli-fiyat-eylul-2026.py <xlsx> <yedek-klasörü> [apply]
import json, sys, re, urllib.request, datetime, openpyxl
X, OUT = sys.argv[1], sys.argv[2]; APPLY = len(sys.argv) > 3 and sys.argv[3] == 'apply'
env = {}
for l in open('/home/emrah/projeler/aktif/tasyunufiyatlari/.env.local'):
    if '=' in l and not l.strip().startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
URL, KEY = env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']
def req(method, path, body=None):
    r = urllib.request.Request(f'{URL}/rest/v1/{path}', method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json', 'Prefer': 'return=representation'})
    with urllib.request.urlopen(r) as f: return json.loads(f.read() or b'null')
wb = openpyxl.load_workbook(X, data_only=True)
def cell(sh, row): r = wb[sh]; return str(r.cell(row=row, column=2).value).strip(), float(r.cell(row=row, column=8).value)
def th(name): m = re.search(r'(\d+)\s*cm', name); return int(m.group(1))
# Levhalar: plate_id → (sayfa, ilk satır, son satır)
PLATES = {37: ('FİLLİ', 5, 18), 38: ('FİLLİ', 19, 32), 39: ('FİLLİ', 90, 103), 40: ('FİLLİ', 104, 117), 41: ('FİLLİ', 118, 131), 42: ('FAWORİ', 5, 18)}
# Aksesuarlar: accessory_id → (sayfa, satır)
ACC = {1: ('FİLLİ', 33), 2: ('FİLLİ', 34), 92: ('FİLLİ', 35), 93: ('FİLLİ', 36), 3: ('FİLLİ', 37), 4: ('FİLLİ', 38), 94: ('FİLLİ', 39), 95: ('FİLLİ', 41),
       15: ('FİLLİ', 43), 97: ('FİLLİ', 44), 98: ('FİLLİ', 45), 99: ('FİLLİ', 46), 101: ('FİLLİ', 48), 102: ('FİLLİ', 49), 103: ('FİLLİ', 50), 104: ('FİLLİ', 51),
       14: ('FİLLİ', 52), 123: ('FİLLİ', 79), 13: ('FİLLİ', 81), 125: ('FİLLİ', 82), 126: ('FİLLİ', 83), 127: ('FİLLİ', 84), 128: ('FİLLİ', 85), 129: ('FİLLİ', 86),
       130: ('FİLLİ', 87), 131: ('FİLLİ', 88), 132: ('FİLLİ', 89), 16: ('FİLLİ', 132), 17: ('FİLLİ', 133), 27: ('FİLLİ', 137), 26: ('FİLLİ', 139), 135: ('FİLLİ', 144),
       29: ('FAWORİ', 47), 30: ('FAWORİ', 48), 40: ('FAWORİ', 52), 39: ('FAWORİ', 68), 147: ('FAWORİ', 69), 148: ('FAWORİ', 70), 149: ('FAWORİ', 71), 150: ('FAWORİ', 72),
       140: ('FAWORİ', 60), 141: ('FAWORİ', 61), 142: ('FAWORİ', 62), 143: ('FAWORİ', 63)}
PW50 = {5: 4.8, 6: 3.6, 8: 2.4, 9: 2.4, 10: 2.4}  # YÜKLEME: 50 mm 8 adet, 60 mm 6, 70–100 mm 4 adet
pp = req('GET', 'plate_prices?plate_id=in.(35,37,38,39,40,41,42)&select=*')
acc = req('GET', f'accessories?id=in.({",".join(map(str, ACC))})&select=id,name,base_price,unit_content')
ts = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
json.dump({'plate_prices': pp, 'accessories': acc}, open(f'{OUT}/fiyat-eylul-yedek-{ts}.json', 'w'), ensure_ascii=False, indent=1)
ops = []
ppk = {(r['plate_id'], int(r['thickness'])): r for r in pp}
for pid, (sh, a, b) in PLATES.items():
    for row in range(a, b + 1):
        name, price = cell(sh, row); t = th(name); r = ppk.get((pid, t))
        if not r: print('DB SATIRI YOK', pid, t, name); continue
        if abs(float(r['base_price']) - price) > 0.005:
            ops.append(('plate_prices', f'id=eq.{r["id"]}', {'base_price': round(price, 2)}, f'#{pid} {t} cm · {name} · {r["base_price"]} → {round(price, 2)}'))
for t, m2 in PW50.items():
    r = ppk[(35, t)]
    if abs(float(r['package_m2'] or 0) - m2) > 0.001:
        ops.append(('plate_prices', f'id=eq.{r["id"]}', {'package_m2': m2}, f'PW50 {t} cm paket m² {r["package_m2"]} → {m2}'))
acck = {a['id']: a for a in acc}
for aid, (sh, row) in ACC.items():
    name, price = cell(sh, row); a = acck[aid]
    if abs(float(a['base_price']) - price) > 0.005:
        ops.append(('accessories', f'id=eq.{aid}', {'base_price': round(price, 2)}, f'#{aid} {a["name"][:42]:42} ← Excel "{name[:42]}" · {a["base_price"]} → {round(price, 2)}'))
print(f'yedek: fiyat-eylul-yedek-{ts}.json · değişecek satır: {len(ops)}')
for t, path, body, label in ops:
    if APPLY:
        res = req('PATCH', f'{t}?{path}', body)
        assert len(res) == 1, (path, res)
    print(('OK ' if APPLY else 'KURU ') + label)
