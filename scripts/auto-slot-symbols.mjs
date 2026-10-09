// HG-Fable01 -小紅帽 符號去背：node scripts/auto-slot-symbols.mjs [id...]
// 把 assets-src/auto-slot/sym-<id>.png（auto-slot-ui.py 從符號磚原圖切出來的）上傳到 Leonardo，走 remove-bg，
// 存成 sym-<id>-cut.png（只留符號本身，背景透明）；遊戲裡所有符號再統一畫同一種底。已經去過背的會跳過
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const key = process.env.LEONARDO_API_KEY;
if (!key) { console.log('no key'); process.exit(1); }
const dir = 'assets-src/auto-slot';
const ALL = ['wolf', 'raven', 'lantern', 'potion', 'basket', 'key', 'hood', 'ten', 'jack', 'queen', 'king', 'ace'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const H = { authorization: `Bearer ${key}`, accept: 'application/json', 'content-type': 'application/json' };
const balance = async () => (await (await fetch('https://cloud.leonardo.ai/api/rest/v1/me', { headers: H })).json())?.user_details?.[0]?.apiPaidTokens;

async function upload(file) {
  const r = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', { method: 'POST', headers: H, body: JSON.stringify({ extension: 'png' }) });
  const u = (await r.json())?.uploadInitImage;
  if (!u) return null;
  const form = new FormData();
  for (const [k, v] of Object.entries(JSON.parse(u.fields))) form.append(k, v);
  form.append('file', new Blob([readFileSync(file)]), file.split('/').pop());
  const put = await fetch(u.url, { method: 'POST', body: form });
  return put.ok ? u.id : null;
}

const start = await balance();
for (const id of ids) {
  const out = `${dir}/sym-${id}-cut.png`;
  if (existsSync(out)) { console.log('skip', id); continue; }
  const imageId = await upload(`${dir}/sym-${id}.png`);
  if (!imageId) { console.log(id, 'upload failed'); continue; }
  const body = { model: 'remove-bg', public: false, parameters: { format: 'png', guidances: { image_reference: [{ image: { id: imageId, type: 'UPLOADED' } }] } } };
  const r = await fetch('https://cloud.leonardo.ai/api/rest/v2/generationssync', { method: 'POST', headers: H, body: JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  const res = (j?.generateSync || j)?.results?.[0];
  // 失敗不重試，避免重複扣款
  if (!res) { console.log(id, 'cut failed', r.status, t.slice(0, 300)); continue; }
  const buf = res.dataB64 ? Buffer.from(res.dataB64, 'base64') : Buffer.from(await (await fetch(res.url)).arrayBuffer());
  writeFileSync(out, buf);
  console.log('cut', id, buf.length, 'bytes');
}
const end = await balance();
console.log('balance', start, '->', end, 'spent', start - end);
