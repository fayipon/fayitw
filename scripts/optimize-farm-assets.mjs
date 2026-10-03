// 把 assets-src/ 的農場原始素材壓成網頁用的版本，輸出到 assets/ 的同一路徑
// 用法：npm install 後執行 npm run optimize:farm（可加檔名只處理部分模型，例如 cottage fence）
// 模型：減面（只刪頂點、不搬動座標）→ 貼圖縮小轉 WebP → Draco 壓縮
// 不做量化與節點合併：clay-farm.js 等程式會直接讀模型的局部座標與頂點連通性來切割幾何
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, prune, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { readdir, stat, mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'assets-src');

// triangles：減面後的目標三角面數（省略則不減面）；texture：貼圖最長邊（金屬粗糙度貼圖再減半）
const MODELS = {
  'cottage': { triangles: 120000 },
  'windmill-tower': { triangles: 100000 },
  'apple-tree': { triangles: 120000 },
  'grass-tile': { triangles: 120000 },
  'windmill-sails': { triangles: 60000 },
  'dirt-path': { triangles: 80000 },
  'dock': { triangles: 60000 },
  'river-reeds': { triangles: 60000 },
  'landscape-rocks': { triangles: 60000 },
  'water-plants': { triangles: 60000 },
  // 欄杆會被複製成整圈圍籬，面數直接影響每一幀的繪製量
  'fence': { triangles: 25000 },
  'river-tile': { triangles: 40000 },
  'lily-pads': { triangles: 40000 },
  'fish-01': { triangles: 12000, texture: 512 },
  'cottage-flowers': { triangles: 20000 },
};
// 作物在田格裡很小：每個階段最多 25000 面、貼圖 512
const CROP = { triangles: 25000, texture: 512 };
const DEFAULT = { texture: 1024 };

const IMAGES = [
  { file: 'backgrounds/clay-loading-garden.png', quality: 82 },
  // 標誌最寬顯示 360px，作物圖示表每格只顯示幾十 px
  { file: 'ui/clay-farm/logo.png', width: 768, quality: 88 },
  { file: 'ui/clay-farm/crop-icons.png', width: 1024, quality: 88 },
];

const isCrop = name => /-(sprout|growing|mature)$/.test(name);
const settingsFor = name => ({ ...DEFAULT, ...(isCrop(name) ? CROP : MODELS[name]) });
const megabytes = bytes => `${(bytes / 1e6).toFixed(2)}MB`;
const countTriangles = doc => Math.round(doc.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())
  .reduce((sum, prim) => sum + (prim.getIndices() ?? prim.getAttribute('POSITION')).getCount() / 3, 0));

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

const only = process.argv.slice(2);
const modelDir = join(source, 'models/clay-farm');
for (const file of (await readdir(modelDir)).filter(file => file.endsWith('.glb')).sort()) {
  const name = basename(file, '.glb');
  if (only.length && !only.includes(name)) continue;
  const { triangles, texture } = settingsFor(name);
  const input = join(modelDir, file), output = join(root, 'assets/models/clay-farm', file);
  const doc = await io.read(input);
  const before = countTriangles(doc);
  const steps = [weld()];
  if (triangles && before > triangles) {
    steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: triangles / before, error: 0.002 }));
  }
  steps.push(
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [texture / 2, texture / 2], slots: /^metallicRoughness/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [texture, texture], slots: /^(?!metallicRoughness)/ }),
    prune({ keepLeaves: true }),
    draco(),
  );
  await doc.transform(...steps);
  await mkdir(dirname(output), { recursive: true });
  await io.write(output, doc);
  console.log(`${file.padEnd(26)} ${String(before).padStart(8)} → ${String(countTriangles(doc)).padStart(7)} 面  ${megabytes((await stat(input)).size).padStart(8)} → ${megabytes((await stat(output)).size)}`);
}

if (!only.length) for (const { file, width, quality } of IMAGES) {
  const input = join(source, file), output = join(root, 'assets', file.replace(/\.png$/, '.webp'));
  await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality, alphaQuality: 90, effort: 6 }).toFile(output);
  console.log(`${file.padEnd(36)} ${megabytes((await stat(input)).size).padStart(8)} → ${megabytes((await stat(output)).size)}`);
}
