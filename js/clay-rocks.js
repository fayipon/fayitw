import * as THREE from 'three';

// A small grid reduction keeps repeated bank stones light. UV islands remain
// separate, so the supplied clay texture stays attached to the original shape.
function compactRock(geometry, cell = .012) {
  const attributes = Object.entries(geometry.attributes), cells = new Map(), positions = new Map();
  const remap = new Uint32Array(geometry.attributes.position.count), samples = [];
  const p = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const spatial = `${Math.round(p.getX(i) / cell)},${Math.round(p.getY(i) / cell)},${Math.round(p.getZ(i) / cell)}`;
    if (!positions.has(spatial)) positions.set(spatial, { sum: new THREE.Vector3(), count: 0 });
    const point = positions.get(spatial); point.sum.add(new THREE.Vector3().fromBufferAttribute(p, i)); point.count++;
    const key = `${spatial},${Math.floor(uv.getX(i) * 96)},${Math.floor(uv.getY(i) * 96)}`;
    if (!cells.has(key)) { cells.set(key, samples.length); samples.push({ spatial, count: 0, sums: attributes.map(([, a]) => Array(a.itemSize).fill(0)) }); }
    const j = cells.get(key), sample = samples[j]; remap[i] = j; sample.count++;
    attributes.forEach(([, a], k) => { for (let axis = 0; axis < a.itemSize; axis++) sample.sums[k][axis] += a.array[i * a.itemSize + axis]; });
  }
  const result = new THREE.BufferGeometry(), indices = [], input = geometry.index.array;
  attributes.forEach(([name, a], k) => {
    const data = new Float32Array(samples.length * a.itemSize);
    samples.forEach((sample, i) => {
      for (let axis = 0; axis < a.itemSize; axis++) data[i * a.itemSize + axis] = name === 'position'
        ? positions.get(sample.spatial).sum.getComponent(axis) / positions.get(sample.spatial).count
        : sample.sums[k][axis] / sample.count;
    });
    result.setAttribute(name, new THREE.BufferAttribute(data, a.itemSize));
  });
  for (let i = 0; i < input.length; i += 3) {
    const a = remap[input[i]], b = remap[input[i + 1]], c = remap[input[i + 2]];
    if (a !== b && b !== c && c !== a) indices.push(a, b, c);
  }
  result.setIndex(indices); result.normalizeNormals(); return result;
}

function extractRock(geometry, selected) {
  // Drop disconnected leaves left on the far side of the cut. The grasses
  // still attached to each stone stay with that stone.
  const position = geometry.attributes.position, welded = new Map();
  const parents = Int32Array.from({ length: position.count }, (_, i) => i);
  const representative = new Int32Array(position.count);
  function root(i) { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; }
  function join(a, b) { a = root(a); b = root(b); if (a !== b) parents[b] = a; }
  for (const i of new Set(selected)) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)].map(v => v.toFixed(5)).join(',');
    if (!welded.has(key)) welded.set(key, i);
    representative[i] = welded.get(key);
  }
  for (let i = 0; i < selected.length; i += 3) {
    join(representative[selected[i]], representative[selected[i + 1]]);
    join(representative[selected[i]], representative[selected[i + 2]]);
  }
  const components = new Map();
  for (let i = 0; i < selected.length; i += 3) {
    const id = root(representative[selected[i]]);
    if (!components.has(id)) components.set(id, []);
    components.get(id).push(selected[i], selected[i + 1], selected[i + 2]);
  }
  const largest = [...components.values()].sort((a, b) => b.length - a.length)[0];
  const remap = new Map(), vertices = [], indices = [];
  for (const i of largest) {
    if (!remap.has(i)) { remap.set(i, vertices.length); vertices.push(i); }
    indices.push(remap.get(i));
  }
  const part = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const data = new Float32Array(vertices.length * attribute.itemSize);
    vertices.forEach((i, j) => {
      for (let axis = 0; axis < attribute.itemSize; axis++) data[j * attribute.itemSize + axis] = attribute.array[i * attribute.itemSize + axis];
    });
    part.setAttribute(name, new THREE.BufferAttribute(data, attribute.itemSize));
  }
  part.setIndex(indices);
  return part;
}

function sealRockBase(geometry, material, shapes) {
  const p = geometry.attributes.position, uv = geometry.attributes.uv, normal = geometry.attributes.normal;
  const vertices = new Map(), representative = [], edges = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(5)).join(',');
    if (!vertices.has(key)) vertices.set(key, i);
    representative[i] = vertices.get(key);
  }
  const indices = geometry.index.array;
  for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = representative[indices[i + j]], b = representative[indices[i + (j + 1) % 3]];
    if (a === b) continue;
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    if (edges.has(key)) edges.delete(key); else edges.set(key, [a, b]);
  }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const paint = canvas.getContext('2d', { willReadFrequently: true });
  paint.drawImage(material.map.image, 0, 0, 512, 512);
  const pixels = paint.getImageData(0, 0, 512, 512).data;
  function colour(i) {
    const x = THREE.MathUtils.clamp(Math.round(uv.getX(i) * 511), 0, 511);
    const y = THREE.MathUtils.clamp(Math.round(uv.getY(i) * 511), 0, 511), at = (y * 512 + x) * 4;
    return new THREE.Color().setRGB(pixels[at] / 255, pixels[at + 1] / 255, pixels[at + 2] / 255, THREE.SRGBColorSpace);
  }
  const positions = [], normals = [], colours = [], neighbours = new Map(), tips = new Map();
  const bounds = geometry.boundingBox, center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  for (const [a, b] of edges.values()) {
    if (!neighbours.has(a)) neighbours.set(a, []);
    if (!neighbours.has(b)) neighbours.set(b, []);
    neighbours.get(a).push(b); neighbours.get(b).push(a);
  }
  // Close each contact separately with a shallow convex patch, instead of
  // drawing every opening into one low point and leaving an indented back.
  for (const [start] of neighbours) {
    if (tips.has(start)) continue;
    const members = [], pending = [start], seen = new Set([start]), tip = new THREE.Vector3();
    while (pending.length) {
      const i = pending.pop(); members.push(i); tip.add(new THREE.Vector3().fromBufferAttribute(p, i));
      for (const next of neighbours.get(i)) if (!seen.has(next)) { seen.add(next); pending.push(next); }
    }
    tip.divideScalar(members.length);
    const shape = shapes.reduce((best, s) => {
      const score = s.center.reduce((sum, v, axis) => sum + ((tip.getComponent(axis) - v) / s.radius[axis]) ** 2, 0);
      return score < best.score ? { ...s, score } : best;
    }, { score: Infinity });
    const origin = new THREE.Vector3(...shape.center), direction = tip.clone().sub(origin);
    const distance = Math.sqrt(direction.toArray().reduce((sum, v, axis) => sum + (v / shape.radius[axis]) ** 2, 0));
    if (tip.y > bounds.min.y + size.y * .06 && distance > .01) tip.copy(origin).addScaledVector(direction, 1 / distance);
    tip.clamp(bounds.min, bounds.max);
    const outward = tip.clone().sub(origin).divide(new THREE.Vector3(...shape.radius).multiply(new THREE.Vector3(...shape.radius))).normalize();
    const colourAverage = new THREE.Color(0, 0, 0); let colourCount = 0;
    for (const i of members) { const c = colour(i); if (c.r > c.g && c.b > c.g * .65 && c.r + c.g + c.b > .2) { colourAverage.add(c); colourCount++; } }
    if (colourCount) colourAverage.multiplyScalar(1 / colourCount); else colourAverage.set('#999387');
    for (const i of members) tips.set(i, { position: tip, normal: outward, colour: colourAverage });
  }
  for (const [a, b] of edges.values()) {
    const ca = colour(a), cb = colour(b), tip = tips.get(a);
    positions.push(p.getX(a), p.getY(a), p.getZ(a), p.getX(b), p.getY(b), p.getZ(b), ...tip.position.toArray());
    normals.push(normal.getX(a), normal.getY(a), normal.getZ(a), normal.getX(b), normal.getY(b), normal.getZ(b), ...tip.normal.toArray());
    colours.push(...ca.toArray(), ...cb.toArray(), ...tip.colour.toArray());
  }
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  cap.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  cap.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return cap;
}

// The two large stones touch along a broad seam. Keep that pair intact and
// detach the small front stone at its recessed contact with the pair.
export function splitLandscapeRocks(source) {
  const pieces = [];
  const shapes = [
    { center: [-.34, -.075, -.10], radius: [.37, .31, .53] },
    { center: [.38, -.035, -.055], radius: [.47, .39, .67] },
    { center: [-.005, -.205, .625], radius: [.305, .20, .325] },
  ];
  source.updateMatrixWorld(true);
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const position = geometry.attributes.position, index = geometry.index;
    const selections = [[], []], total = index ? index.count : position.count;
    const at = i => index ? index.getX(i) : i;
    for (let i = 0; i < total; i += 3) {
      const a = at(i), b = at(i + 1), c = at(i + 2);
      const point = [(position.getX(a) + position.getX(b) + position.getX(c)) / 3,
        (position.getY(a) + position.getY(b) + position.getY(c)) / 3,
        (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3];
      let selected = 0, minimum = Infinity;
      shapes.forEach((shape, j) => {
        const distance = point.reduce((sum, value, axis) => sum + ((value - shape.center[axis]) / shape.radius[axis]) ** 2, 0);
        if (distance < minimum) { minimum = distance; selected = j; }
      });
      selections[selected === 2 ? 1 : 0].push(a, b, c);
    }
    const material = mesh.material.clone(); material.metalness = 0; material.roughness = .96;
    if (material.normalScale) material.normalScale.set(.65, .65);
    for (const [i, selected] of selections.entries()) {
      const extracted = extractRock(geometry, selected), part = compactRock(extracted, i === 0 ? .015 : .009);
      extracted.dispose(); part.computeBoundingBox();
      const bounds = part.boundingBox, size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const bodyShapes = i === 0 ? shapes.slice(0, 2) : shapes.slice(2);
      const cap = sealRockBase(part, material, bodyShapes);
      const normalizedShapes = bodyShapes.map(s => ({ radius: s.radius, center: [s.center[0] - center.x, s.center[1] - bounds.min.y, s.center[2] - center.z] }));
      cap.translate(-center.x, -bounds.min.y, -center.z); cap.computeBoundingSphere();
      part.translate(-center.x, -bounds.min.y, -center.z); part.computeBoundingSphere();
      pieces.push({ geometry: part, material, cap, shapes: normalizedShapes, capMaterial: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, side: THREE.DoubleSide }), count: i === 0 ? 2 : 1, diameter: Math.max(size.x, size.z), height: size.y });
    }
    geometry.dispose();
  });
  return pieces;
}

// Every placement uses a uniform scale. Sharing geometry and instancing keep
// the full riverbank affordable while varying the count, size and orientation.
export function addRockInstances(parent, pieces, placements, { submerged = false } = {}) {
  const group = new THREE.Group(); group.name = submerged ? 'Split clay riverbed stones' : 'Split clay stones — pairs and singles';
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), axis = new THREE.Vector3(0, 1, 0);
  for (const piece of pieces) {
    const points = placements.filter(p => (p.count || 1) === piece.count);
    if (!points.length) continue;
    let geometry = piece.geometry, cap = piece.cap;
    if (submerged) {
      geometry = compactRock(piece.geometry, .035); geometry.computeBoundingBox();
      cap = sealRockBase(geometry, piece.material, piece.shapes);
    }
    for (const [surface, material] of [[geometry, piece.material], [cap, piece.capMaterial]]) {
      if (!surface.attributes.position.count) continue;
      const batch = new THREE.InstancedMesh(surface, material, points.length);
      batch.name = `${piece.count}-stone ${surface === geometry ? 'surfaces' : 'closed bases'}`;
      points.forEach((p, i) => {
        const scale = p.width / piece.diameter;
        rotation.setFromAxisAngle(axis, p.angle || 0);
        matrix.compose(new THREE.Vector3(p.x, p.y - piece.height * scale * .14, p.z), rotation, new THREE.Vector3(scale, scale, scale));
        batch.setMatrixAt(i, matrix);
        if (submerged) batch.setColorAt(i, new THREE.Color('#aec5ba'));
      });
      batch.castShadow = !submerged; batch.receiveShadow = true;
      batch.computeBoundingBox(); batch.computeBoundingSphere(); group.add(batch);
    }
  }
  parent.add(group); return group;
}
