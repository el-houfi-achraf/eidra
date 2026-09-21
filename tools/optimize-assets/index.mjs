import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { validateGLB } from '../validate-assets/index.mjs';
const [input, output] = process.argv.slice(2);
if (!input || !output || path.resolve(input) === path.resolve(output))
  throw new Error(
    'Usage: node tools/optimize-assets/index.mjs input_lod0.glb output_lod0.glb (distinct paths)',
  );
await validateGLB(input);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const document = await io.read(input);
await document.transform(
  dedup(),
  weld(),
  prune({ keepLeaves: true, keepExtras: true }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await mkdir(path.dirname(output), { recursive: true });
await io.write(output, document);
console.log(await validateGLB(output));
