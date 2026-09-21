import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import validator from 'gltf-validator';
export async function filesBelow(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(file)));
    else files.push(file);
  }
  return files;
}
export async function validateGLB(file) {
  const bytes = await readFile(file);
  const report = await validator.validateBytes(new Uint8Array(bytes), {
    uri: path.basename(file),
    maxIssues: 100,
  });
  if (report.issues.numErrors)
    throw new Error(
      `${file}: Khronos validation failed: ${JSON.stringify(report.issues.messages)}`,
    );
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  if (!/^[a-z0-9]+(?:[a-z0-9_-]+)_lod[0-3]\.glb$/.test(path.basename(file)))
    throw new Error(`${file}: invalid naming convention`);
  let triangles = 0;
  for (const mesh of gltf.meshes ?? [])
    for (const primitive of mesh.primitives) {
      const accessor = gltf.accessors[primitive.indices ?? primitive.attributes.POSITION];
      triangles += (accessor?.count ?? 0) / 3;
    }
  if (triangles > 100000) throw new Error(`${file}: triangle budget exceeded (${triangles})`);
  if ((gltf.materials?.length ?? 0) > 16) throw new Error(`${file}: material budget exceeded`);
  if (!(gltf.nodes ?? []).some((node) => node.name?.startsWith('COL_')))
    throw new Error(`${file}: missing simple COL_ collision proxy`);
  for (const node of gltf.nodes ?? []) {
    if (node.scale?.some((value) => Math.abs(value - 1) > 0.0001))
      throw new Error(`${file}: apply node scale before export`);
    if (node.matrix) throw new Error(`${file}: matrix transform must be decomposed and reviewed`);
  }
  const maxSize = 2048;
  for (const image of gltf.images ?? []) {
    if (image.mimeType === 'image/png' && image.bufferView !== undefined) {
      const view = gltf.bufferViews[image.bufferView];
      const binStart = 20 + jsonLength + 8;
      const png = bytes.subarray(binStart + (view.byteOffset ?? 0));
      if (png.readUInt32BE(16) > maxSize || png.readUInt32BE(20) > maxSize)
        throw new Error(`${file}: texture exceeds ${maxSize}px`);
    }
  }
  return {
    file,
    triangles,
    materials: gltf.materials?.length ?? 0,
    warnings: report.issues.numWarnings,
    bytes: bytes.length,
  };
}
export async function validateAssets(root = 'public') {
  const report = [];
  for (const file of await filesBelow(root)) {
    const size = (await stat(file)).size;
    if (size > 25 * 1024 * 1024)
      throw new Error(`${file}: exceeds Cloudflare Pages 25 MiB per-file limit; use R2`);
    if (file.endsWith('.glb')) report.push(await validateGLB(file));
    if (file.endsWith('.ogg')) {
      const bytes = await readFile(file);
      if (bytes.subarray(0, 4).toString() !== 'OggS')
        throw new Error(`${file}: invalid OGG header`);
    }
  }
  return report;
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  try {
    const report = await validateAssets(process.argv[2] ?? 'public');
    console.log(JSON.stringify({ status: 'passed', assets: report }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
