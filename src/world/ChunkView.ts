import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Scene } from '@babylonjs/core/scene';
import type { ChunkData } from '../../game-data/zones/laboratory';
import { checkpoints, landmarks, shortcuts } from '../../game-data/zones/laboratory';
import type { Palette } from './Palette';
import type { DisposableChunk } from './SceneManager';
import { paintScenery } from './Scenery';
import type { PaintedGeometry } from './PaintedGeometry';
// TODO_ART: original procedural blockout. Replace through the validated Blender → GLB pipeline.
export class ChunkView implements DisposableChunk {
  private farLayers: Mesh | null = null;
  private memoryView: Mesh | null = null;
  private glowLayer: Mesh | null = null;
  readonly root: TransformNode;
  readonly meshes: Mesh[] = [];
  private bodies: PhysicsAggregate[] = [];
  private memoryMeshes: Mesh[] = [];
  private memoryBodies: PhysicsAggregate[] = [];
  private activeMemory = false;
  private crystals: Mesh[] = [];
  private passages: Mesh[] = [];
  private markerMeshes = new Map<string, Mesh[]>();
  private shaftMeshes: Mesh[] = [];
  constructor(
    readonly data: ChunkData,
    private scene: Scene,
    p: Palette,
  ) {
    this.root = new TransformNode(`chunk-${data.id}`, scene);
    for (const platform of data.platforms) {
      const mesh = this.box(
        'floor',
        platform.x,
        platform.y,
        0,
        platform.w,
        platform.h,
        4.8,
        platform.memory ? p.memory : p.stone,
      );
      if (platform.memory) {
        // Colliders only: the scenery paints the remembered slabs.
        this.memoryMeshes.push(mesh);
        mesh.isVisible = false;
      } else {
        // Solid slabs are painted by the scenery; the box only carries the collider.
        mesh.isVisible = false;
        this.bodies.push(
          new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0 }, scene),
        );
      }
    }
    for (const c of checkpoints)
      if (c.x >= data.start && c.x < data.end) {
        this.box('anchor-base', c.x, 0.15, 1.1, 2, 0.3, 2, p.dark);
        const ring = MeshBuilder.CreateTorus(
          'anchor-ring',
          { diameter: 2.3, thickness: 0.07, tessellation: 40 },
          scene,
        );
        ring.position.set(c.x, 1.7, 1);
        ring.rotation.x = Math.PI / 2;
        ring.material = p.gold;
        this.add(ring);
        const gem = this.crystal(c.x, 1.7, 1, 0.32, p.crystal);
        this.crystals.push(gem);
      }
    for (const marker of landmarks)
      if (marker.x >= data.start && marker.x < data.end && marker.kind !== 'npc') {
        const gem = this.crystal(
          marker.x,
          marker.y,
          0,
          marker.kind === 'memory' ? 0.38 : 0.48,
          marker.kind === 'memory' ? p.gold : p.crystal,
        );
        this.crystals.push(gem);
        this.markerMeshes.set(marker.id, [gem]);
        const base = this.box('reliquary', marker.x, marker.y - 0.7, 0.7, 1.1, 0.28, 1.3, p.trim);
        this.markerMeshes.get(marker.id)?.push(base);
      }
    for (const passage of shortcuts)
      if (passage.x >= data.start && passage.x < data.end) {
        const ring = MeshBuilder.CreateTorus(
          'maintenance-door',
          { diameter: 2.4, thickness: 0.12, tessellation: 32 },
          scene,
        );
        ring.position.set(passage.x, passage.y, 1.7);
        ring.rotation.x = Math.PI / 2;
        ring.material = p.trim;
        this.add(ring);
        this.passages.push(ring);
      }
    if (data.id === 'awakening') {
      const ring = MeshBuilder.CreateTorus(
        'awakening-aperture',
        { diameter: 9, thickness: 0.28, tessellation: 64 },
        scene,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(10, 5, 6);
      ring.material = p.trim;
      this.add(ring);
      const inner = MeshBuilder.CreateTorus(
        'aperture-light',
        { diameter: 7.4, thickness: 0.035, tessellation: 64 },
        scene,
      );
      inner.rotation.x = Math.PI / 2;
      inner.position.set(10, 5, 5.8);
      inner.material = p.crystal;
      this.add(inner);
      for (let i = 0; i < 7; i++) {
        const a = (i * Math.PI * 2) / 7;
        const shard = this.crystal(10 + Math.cos(a) * 3, 5 + Math.sin(a) * 3, 5.5, 0.36, p.ivory);
        shard.rotation.z = a;
      }
      this.box('left-bound', -0.7, 3, 0, 1, 10, 5, p.dark);
      this.bodies.push(
        new PhysicsAggregate(this.meshes.at(-1)!, PhysicsShapeType.BOX, { mass: 0 }, scene),
      );
    }
    if (data.id === 'counterweight') {
      this.box('memory-seal', 130, 0.035, 0, 2.4, 0.05, 3.6, p.gold);
      this.box('seal-line', 135, 0.01, -1.8, 10, 0.05, 0.07, p.trim);
    }
    if (data.id === 'obedience') {
      this.box('exit', 199, 3, 0, 1, 7, 5, p.dark);
      this.bodies.push(
        new PhysicsAggregate(this.meshes.at(-1)!, PhysicsShapeType.BOX, { mass: 0 }, scene),
      );
    }
    const dynamic = new Set([
      ...this.memoryMeshes,
      ...this.crystals,
      ...this.passages,
      ...[...this.markerMeshes.values()].flat(),
    ]);
    const groups = new Map<StandardMaterial, Mesh[]>();
    for (const mesh of this.meshes) {
      if (mesh.physicsBody || dynamic.has(mesh)) continue;
      const material = mesh.material as StandardMaterial;
      const list = groups.get(material) ?? [];
      list.push(mesh);
      groups.set(material, list);
    }
    for (const group of groups.values())
      if (group.length > 1) {
        const merged = Mesh.MergeMeshes(group, true, true);
        if (merged) {
          merged.name = `${data.id}-merged-static`;
          merged.parent = this.root;
          merged.receiveShadows = true;
          this.meshes.push(merged);
        }
      }
    for (let i = this.meshes.length - 1; i >= 0; i--)
      if (this.meshes[i]!.isDisposed()) this.meshes.splice(i, 1);
    // Painted layers, one draw call each, built after the merge so quality can toggle them.
    const scenery = paintScenery(data);
    const paint = (
      geometry: PaintedGeometry,
      name: string,
      material: StandardMaterial,
    ): Mesh | null => {
      const mesh = geometry.build(scene, `${data.id}-${name}`);
      if (!mesh) return null;
      mesh.material = material;
      return this.add(mesh);
    };
    paint(scenery.near, 'painted-near', p.painted);
    this.farLayers = paint(scenery.far, 'painted-far', p.painted);
    const front = paint(scenery.front, 'painted-front', p.paintedSoft);
    if (front) front.hasVertexAlpha = true;
    this.glowLayer = paint(scenery.glow, 'light-pools', p.halo);
    const shafts = paint(scenery.shafts, 'light-shafts', p.shaft);
    this.memoryView = paint(scenery.memory, 'painted-memory', p.paintedMemory);
    if (this.memoryView) {
      this.memoryView.hasVertexAlpha = true;
      this.memoryView.visibility = 0.14;
    }
    this.shaftMeshes = shafts ? [shafts] : [];
    for (const mesh of this.meshes) {
      mesh.isPickable = false;
      if (!this.crystals.includes(mesh)) mesh.freezeWorldMatrix();
    }
  }
  private add(mesh: Mesh): Mesh {
    mesh.parent = this.root;
    this.meshes.push(mesh);
    return mesh;
  }
  private box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: StandardMaterial,
  ): Mesh {
    const m = MeshBuilder.CreateBox(
      `${this.data.id}-${name}`,
      { width: w, height: h, depth: d },
      this.scene,
    );
    m.position.set(x, y, z);
    m.material = material;
    m.receiveShadows = true;
    return this.add(m);
  }
  private crystal(x: number, y: number, z: number, size: number, material: StandardMaterial): Mesh {
    const m = MeshBuilder.CreatePolyhedron('memory-shard', { type: 1, size }, this.scene);
    m.position.set(x, y, z);
    m.scaling.y = 1.8;
    m.material = material;
    return this.add(m);
  }
  update(time: number, collected: ReadonlySet<string>, flags: ReadonlySet<string>): void {
    for (const passage of this.passages)
      passage.visibility = flags.has('echo-gate-open') ? 1 : 0.25;
    for (const m of this.crystals) m.rotation.y = time * 0.5;
    for (const [id, meshes] of this.markerMeshes)
      for (const m of meshes) m.setEnabled(!collected.has(id));
  }
  setMemory(active: boolean): void {
    if (this.activeMemory === active) return;
    this.activeMemory = active;
    for (const body of this.memoryBodies) body.dispose();
    this.memoryBodies = [];
    if (this.memoryView) this.memoryView.visibility = active ? 1 : 0.14;
    for (const mesh of this.memoryMeshes) {
      if (active)
        this.memoryBodies.push(
          new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0 }, this.scene),
        );
    }
  }
  setQuality(preset: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA'): void {
    // LOW keeps the near layers only: the fog colour stands in for the far ones.
    for (const mesh of this.shaftMeshes) mesh.setEnabled(preset !== 'LOW');
    this.farLayers?.setEnabled(preset !== 'LOW');
    this.glowLayer?.setEnabled(preset !== 'LOW');
  }
  get bodyCount(): number {
    return this.bodies.length + this.memoryBodies.length;
  }
  dispose(): void {
    for (const b of [...this.bodies, ...this.memoryBodies]) b.dispose();
    this.bodies = [];
    this.memoryBodies = [];
    this.root.dispose(false);
  }
}
