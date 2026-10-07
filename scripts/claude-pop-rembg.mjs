// 去背：node scripts/claude-pop-rembg.mjs 名稱...（用 assets-src/claude-pop/index.json 裡的 imageId）
// 走 sync 端點，輸出 PNG（保留透明），存成「名稱-cut.png」；印出每張的花費
import { readFileSync, writeFileSync } from 'node:fs';
const key = process.env.LEONARDO_API_KEY;
if (!key) { console.log('no key'); process.exit(1); }
const outDir = 'assets-src/claude-pop';
const names = process.argv.slice(2);
const index = JSON.parse(readFileSync(`${outDir}/index.json`, 'utf8'));
const H = { authorization: `Bearer ${key}`, accept: 'application/json', 'content-type': 'application/json' };
const balance = async () => (await (await fetch('https://cloud.leonardo.ai/api/rest/v1/me', { headers: H })).json())?.user_details?.[0]?.apiPaidTokens;
const start = await balance();
for (const name of names) {
  const it = index[name];
  if (!it) { console.log('missing', name); continue; }
  const body = {
    model: 'remove-bg',
    public: false,
    parameters: { format: 'png', guidances: { image_reference: [{ image: { id: it.imageId, type: 'GENERATED' } }] } },
  };
  let done = false;
  for (let attempt = 0; attempt < 2 && !done; attempt++) {
    const r = await fetch('https://cloud.leonardo.ai/api/rest/v2/generationssync', { method: 'POST', headers: H, body: JSON.stringify(body) });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    const sync = j?.generateSync || j;
    const res = sync?.results?.[0];
    // 只有在真的出錯時才重試（避免重複扣款）
    if (!res) { console.log(name, 'HTTP', r.status, t.slice(0, 300)); if (sync?.id) break; continue; }
    const buf = res.dataB64 ? Buffer.from(res.dataB64, 'base64') : Buffer.from(await (await fetch(res.url)).arrayBuffer());
    writeFileSync(`${outDir}/${name}-cut.png`, buf);
    index[name].cut = `${name}-cut.png`;
    console.log('cut', name, buf.length, 'bytes', res.contentType, 'cost', JSON.stringify(sync.cost));
    done = true;
  }
}
writeFileSync(`${outDir}/index.json`, JSON.stringify(index, null, 2));
console.log('balance', start, '->', await balance());
