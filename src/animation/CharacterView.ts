import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from '../world/Palette';
// TODO_ART: original ceramic-and-Lumérite puppet; rigged Blender animation is a production gate.
export class CharacterView {
  readonly root: TransformNode;
  readonly meshes: Mesh[] = [];
  private cloak: Mesh;
  private arm: Mesh;
  private head: Mesh;
  private core: Mesh;
  private ring: Mesh;
  constructor(
    scene: Scene,
    p: Palette,
    kind: 'eidra' | 'echo' | 'mira' | 'watcher' | 'wisp' | 'sentinel' | 'keeper' | 'boss',
  ) {
    this.root = new TransformNode(kind, scene);
    const add = (mesh: Mesh, y: number, z = 0): Mesh => {
      mesh.parent = this.root;
      mesh.position.set(0, y, z);
      this.meshes.push(mesh);
      return mesh;
    };
    const friendly = ['eidra', 'echo', 'mira'].includes(kind),
      ghost = kind === 'echo' || kind === 'mira',
      boss = kind === 'boss';
    this.cloak = add(
      MeshBuilder.CreateCylinder(
        'mantle',
        { height: 1.1, diameterTop: 0.42, diameterBottom: 1.02, tessellation: 5 },
        scene,
      ),
      -0.25,
    );
    this.cloak.material = ghost ? p.memory : friendly ? p.ink : p.dark;
    this.head = add(
      MeshBuilder.CreatePolyhedron('ceramic-mask', { type: 1, size: 0.33 }, scene),
      0.65,
    );
    this.head.scaling.set(0.7, 1.2, 0.75);
    this.head.material = ghost ? p.memory : p.ivory;
    this.core = add(
      MeshBuilder.CreatePolyhedron('heart', { type: 1, size: 0.17 }, scene),
      0.06,
      -0.3,
    );
    this.core.material = friendly ? p.crystal : p.danger;
    this.arm = add(
      MeshBuilder.CreateBox('resonance-blade', { width: 0.08, height: 1.28, depth: 0.15 }, scene),
      0.03,
      -0.15,
    );
    this.arm.position.x = 0.5;
    this.arm.rotation.z = -0.25;
    this.arm.material = friendly ? p.ivory : p.trim;
    this.ring = add(
      MeshBuilder.CreateTorus(
        'broken-halo',
        { diameter: kind === 'mira' ? 1.2 : 0.65, thickness: 0.03, tessellation: 24 },
        scene,
      ),
      0.7,
      0.05,
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.material = friendly ? p.gold : p.trim;
    if (!friendly) {
      for (const sign of [-1, 1]) {
        const plate = add(
          MeshBuilder.CreateBox('shoulder', { width: 0.45, height: 0.25, depth: 0.5 }, scene),
          0.33,
        );
        plate.position.x = sign * 0.45;
        plate.rotation.z = sign * 0.3;
        plate.material = p.stone;
      }
    }
    if (boss) {
      this.root.scaling.setAll(2.8);
      this.cloak.scaling.x = 1.5;
      this.head.scaling.y = 1.8;
      this.ring.scaling.setAll(2.2);
    }
    if (kind === 'sentinel' || kind === 'keeper')
      this.root.scaling.setAll(kind === 'keeper' ? 1.65 : 1.3);
    if (kind === 'wisp') {
      this.cloak.setEnabled(false);
      this.arm.setEnabled(false);
      this.ring.scaling.setAll(2);
    }
    for (const m of this.meshes) m.isPickable = false;
  }
  update(
    x: number,
    y: number,
    facing: number,
    time: number,
    speed: number,
    attack: number,
    flash: boolean,
    reducedMotion: boolean,
  ): void {
    this.root.position.set(x, y, 0);
    this.root.rotation.y = facing < 0 ? 0.25 : -0.25;
    const swing = reducedMotion ? 0 : Math.sin(time * 12) * Math.min(1, Math.abs(speed) / 5);
    this.cloak.rotation.z = swing * 0.08;
    this.head.position.y = 0.65 + Math.abs(swing) * 0.035;
    this.arm.position.x = facing * 0.47;
    this.arm.rotation.z = attack > 0 ? -facing * (1.5 + Math.sin(attack * 18)) : -facing * 0.25;
    this.core.scaling.setAll(1 + Math.sin(time * 2) * 0.08);
    this.root.setEnabled(true);
    for (const mesh of this.meshes) mesh.visibility = flash ? 0.35 : 1;
  }
  dispose(): void {
    this.root.dispose(false);
  }
}
