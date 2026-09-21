// Original test asset used to exercise GLB validation and compression without Blender.
import { Document, NodeIO } from '@gltf-transform/core';
import { mkdir } from 'node:fs/promises';
const doc = new Document();
const buffer = doc.createBuffer();
const material = doc
  .createMaterial('ivory')
  .setBaseColorFactor([0.7, 0.85, 0.78, 1])
  .setRoughnessFactor(0.9);
const vertices = new Float32Array([
  0, 1, 0, -0.5, 0, 0, 0, 0, -0.5, 0.5, 0, 0, 0, 0, 0.5, 0, -1, 0,
]);
const indices = new Uint16Array([
  0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 1, 4, 5, 1, 2, 5, 2, 3, 5, 3, 4, 5, 4, 1,
]);
const primitive = doc
  .createPrimitive()
  .setAttribute(
    'POSITION',
    doc.createAccessor().setType('VEC3').setArray(vertices).setBuffer(buffer),
  )
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
  .setMaterial(material);
const mesh = doc.createMesh('reliquary_lod0').addPrimitive(primitive);
const scene = doc.createScene('laboratory');
scene.addChild(doc.createNode('laboratory_reliquary_a_lod0').setMesh(mesh));
scene.addChild(
  doc.createNode('COL_reliquary').setExtras({ shape: 'capsule', radius: 0.5, height: 2 }),
);
await mkdir('assets/environments/fixtures', { recursive: true });
await new NodeIO().write('assets/environments/fixtures/laboratory_reliquary_a_lod0.glb', doc);
