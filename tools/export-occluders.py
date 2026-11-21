# Gera server/src/occluders.js (relevo + paredes/telhados/pedras do mapa) pro anti-wallhack do servidor.
# Rode de novo sempre que o mapa mudar (terreno, casas, pedras ou LS.MAP_SEED):
#   pip install playwright && playwright install chromium
#   python tools/export-occluders.py . server/src/occluders.js [caminho/do/three.min.js]
import sys, json, subprocess, time
from playwright.sync_api import sync_playwright
root = sys.argv[1]; out = sys.argv[2]; three = sys.argv[3] if len(sys.argv) > 3 else None
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '-d', root], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        pg = b.new_page()
        pg.on('pageerror', lambda e: print('PAGEERR', e))
        if three: pg.route('**/three.min.js', lambda r: r.fulfill(path=three, content_type='application/javascript'))
        pg.goto('http://localhost:8765/index.html')
        pg.wait_for_function('window.LS && LS.Game && LS.World', timeout=60000)
        pg.evaluate('LS.Game.build(()=>{window.__built=1})')
        pg.wait_for_function('window.__built===1', timeout=300000)
        data = pg.evaluate('''() => {
          const W = LS.World, S = W.SEG, H = W.heights;
          const h = Array.from(H, v => Math.round(v * 10));
          const boxes = [];
          let skipped = {glass:0, thin:0};
          for (const b of W.boxes) {
            if (b.glass) { skipped.glass++; continue; }
            const ex = b.maxX - b.minX, ez = b.maxZ - b.minZ;
            if (Math.max(ex, ez) < 1.0 && !b.roof) { skipped.thin++; continue; }
            let sh = b.rockTris ? 0.35 : 0;
            if (ex - 2*sh < 0.2 || ez - 2*sh < 0.2) sh = 0;
            const r = v => Math.round(v * 100) / 100;
            const e = [r(b.minX + sh), r(b.minY), r(b.minZ + sh), r(b.maxX - sh), r(b.maxY), r(b.maxZ - sh)];
            if (b.roof) e.push(b.roof.alongX ? 1 : 0, r(b.roof.cx), r(b.roof.cz), r(b.roof.ridgeY), Math.round(b.roof.tanA * 10000) / 10000);
            boxes.push(e);
          }
          return { seg: S, size: LS.MAP_SIZE, seed: LS.MAP_SEED, h, boxes, skipped, total: W.boxes.length };
        }''')
        b.close()
finally:
    srv.terminate()
import array, base64
a = array.array('h', [int(v) for v in data['h']])
assert a.itemsize == 2
if sys.byteorder != 'little': a.byteswap()
occ = {'seg': data['seg'], 'size': data['size'], 'seed': data['seed'], 'h': base64.b64encode(a.tobytes()).decode(), 'boxes': data['boxes']}
with open(out, 'w') as f:
    f.write('// Gerado por tools/export-occluders.py: relevo (decímetros, Int16 little-endian em base64) e paredes/telhados/pedras\n')
    f.write('// do mapa fixo (LS.MAP_SEED). Usado pelo servidor pra saber quem pode ver quem (anti-wallhack).\n')
    f.write('// Se o mapa mudar (terreno, casas, pedras ou MAP_SEED), rode o script de novo.\n')
    f.write('export default ' + json.dumps(occ, separators=(',', ':')) + ';\n')
print('boxes', len(data['boxes']), 'of', data['total'], data['skipped'])
