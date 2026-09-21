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
// TODO_ART: original procedural blockout. Replace through the validated Blender → GLB pipeline.
export class ChunkView implements DisposableChunk {
  private lodMeshes: Mesh[] = [];
  readonly root: TransformNode;
  readonly meshes: Mesh[] = [];
  private bodies: PhysicsAggregate[] = [];
  private memoryMeshes: Mesh[] = [];
  private memoryBodies: PhysicsAggregate[] = [];
  private activeMemory = false;
  private crystals: Mesh[] = [];
  private passages: Mesh[] = [];
  private markerMeshes = new Map<string, Mesh[]>();
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
        this.memoryMeshes.push(mesh);
        mesh.visibility = 0.12;
      } else
        this.bodies.push(
          new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0 }, scene),
        );
      if (!platform.memory) {
        this.box(
          'floor-trim',
          platform.x,
          platform.y + platform.h / 2 - 0.12,
          -2.48,
          platform.w,
          0.13,
          0.12,
          p.trim,
        );
        for (let x = platform.x - platform.w / 2 + 1; x < platform.x + platform.w / 2; x += 2)
          this.box('seam', x, platform.y + platform.h / 2 + 0.005, 0, 0.025, 0.015, 4.9, p.dark);
      }
    }
    // Background parallax layers: monumental ribs, broken windows and receding arcades.
    for (let i = 0; i < 5; i++) {
      const x = data.start + i * 8 + 2;
      const h = 11 + Math.sin(data.seed + i * 3) * 3;
      this.box('rear-column', x, h / 2 - 2, 7, 1.5, h, 2.6, p.distant);
      this.box('capital', x, h - 2, 7, 2.2, 0.45, 3, p.trim);
      this.box('plinth', x, 0.4, 6.5, 2.5, 0.8, 3, p.dark);
      this.arch(x + 4, h - 2, 7, 3.4, p.distant);
      this.box('window-core', x + 4, 5.5, 11, 0.12, 8, 0.15, p.crystal);
      this.box('far-tower', x + 1, 8, 22, 5, 23, 3, p.dark);
      this.arch(x + 4, 15, 22, 5, p.distant);
      for (let r = 0; r < 3; r++) {
        const rock = this.box(
          'rubble',
          x + r * 1.2 - 2,
          -0.1,
          3.2,
          0.6 + r * 0.3,
          0.7,
          1.2,
          p.dark,
        );
        rock.rotation.z = (i + r) * 0.3;
      }
      const ribbon = this.box('hanging-memorial', x + 0.3, h - 5, 5, 0.36, 3.5, 0.06, p.trim);
      ribbon.rotation.z = 0.08;
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
      for (let i = 0; i < 7; i++) {
        const x = 167 + i * 4;
        this.box('king-vessel', x, 7, 9, 0.6, 14, 1, p.trim);
      }
      this.arch(182, 7, 5, 6.7, p.trim);
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
          if (merged.material === p.distant) this.lodMeshes.push(merged);
        }
      }
    for (let i = this.meshes.length - 1; i >= 0; i--)
      if (this.meshes[i]!.isDisposed()) this.meshes.splice(i, 1);
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
  private arch(x: number, y: number, z: number, r: number, material: StandardMaterial): void {
    for (let i = 0; i < 11; i++) {
      const angle = (i / 10) * Math.PI;
      const m = this.box(
        'arch',
        x + Math.cos(angle) * r,
        y + Math.sin(angle) * r,
        z,
        0.65,
        r * 0.32,
        1.1,
        material,
      );
      m.rotation.z = angle - Math.PI / 2;
    }
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
    for (const mesh of this.memoryMeshes) {
      mesh.visibility = active ? 1 : 0.12;
      if (active)
        this.memoryBodies.push(
          new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0 }, this.scene),
        );
    }
  }
  setQuality(preset: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA'): void {
    for (const mesh of this.lodMeshes) {
      mesh.removeLODLevel(null);
      mesh.addLODLevel({ LOW: 50, MEDIUM: 75, HIGH: 100, ULTRA: 150 }[preset], null);
    }
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
