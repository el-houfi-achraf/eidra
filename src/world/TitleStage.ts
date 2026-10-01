import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from './Palette';
import { PaintedGeometry, random } from './PaintedGeometry';
import type { Paint, Point, RGBA } from './PaintedGeometry';
import { arch, column, layerPaint, LAYERS, tree, vine } from './Scenery';
import type { Rng } from './Scenery';
import { hexToRgb, mixRgb, toTint } from './Mood';
import type { RGB, Tint } from './Mood';
import { proceduralTexture } from '../vfx/textures';
import { titleColors, titleMood } from '../../game-data/ui/title';
/** The title vista stands west of the route, where no sector ever streams. */
export const TITLE_X = -90;
/** What the title camera frames: centre and half height of the view, metres. */
export const TITLE_FRAME = { x: TITLE_X, y: 3.6, halfHeight: 7.4 } as const;
/** Where Eidra stands, on the outcrop under the ring. */
export const TITLE_HERO = { x: TITLE_X + 0.45, y: 1.13 } as const;
const RING = { x: TITLE_X + 0.35, y: 5.8, radius: 2.7, z: 1.4 };
const WATER = -1.45;
const WATER_SIZE = { width: 60, height: 22 } as const;
const rgba = (c: RGB, a = 1): RGBA => [c[0], c[1], c[2], a];
/**
 * Key art behind the title screen, built from the game's own pieces: Eidra on a
 * flowering outcrop under a golden ring of Lumérite shards, a beam of light
 * through it, dawn through broken arches overgrown with leaves, still water below.
 * It lives only while the menus show and is released when the journey starts.
 * TODO_ART: procedural stand-in for a painted key art.
 */
export class TitleStage {
  readonly tint: Tint = toTint(titleMood);
  private root: TransformNode;
  private meshes: Mesh[] = [];
  private materials: StandardMaterial[] = [];
  private orbit: TransformNode;
  private shards: InstancedMesh[] = [];
  private beam: Mesh | null = null;
  private star: Mesh;
  constructor(scene: Scene, p: Palette) {
    this.root = new TransformNode('title-stage', scene);
    const tint = (): Tint => this.tint;
    const depth = (d: number, lift = 0): Paint => layerPaint(d, lift, tint);
    const rng = random(4242);
    const near = new PaintedGeometry(),
      far = new PaintedGeometry(),
      front = new PaintedGeometry(),
      glow = new PaintedGeometry(),
      shafts = new PaintedGeometry();
    this.paintRuins(near, far, rng, depth);
    this.paintOutcrop(near, rng, depth);
    this.paintForeground(front, rng);
    this.paintLight(glow, shafts);
    const add = (g: PaintedGeometry, name: string, material: StandardMaterial): Mesh | null => {
      const mesh = g.build(scene, `title-${name}`);
      if (!mesh) return null;
      mesh.material = material;
      mesh.parent = this.root;
      mesh.isPickable = false;
      this.meshes.push(mesh);
      return mesh;
    };
    add(far, 'far', p.painted);
    add(near, 'near', p.painted);
    const soft = add(front, 'front', p.paintedSoft);
    if (soft) soft.hasVertexAlpha = true;
    add(glow, 'glow', p.halo);
    this.beam = add(shafts, 'shafts', p.shaft);
    this.buildWater(scene);
    // The ring: two gold circles, an ornament above and a pendant over Eidra.
    const gold = this.material(scene, 'title-gold', titleColors.ring, 1.15);
    const ice = this.material(scene, 'title-ice', titleColors.crystal, 1.25);
    const ring = MeshBuilder.CreateTorus(
      'title-ring',
      { diameter: RING.radius * 2, thickness: 0.17, tessellation: 72 },
      scene,
    );
    const inner = MeshBuilder.CreateTorus(
      'title-ring-inner',
      { diameter: RING.radius * 2 - 0.42, thickness: 0.035, tessellation: 64 },
      scene,
    );
    for (const mesh of [ring, inner]) {
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(RING.x, RING.y, RING.z);
      mesh.material = gold;
      this.adopt(mesh);
    }
    const ornament = MeshBuilder.CreatePolyhedron('title-ornament', { type: 1, size: 0.2 }, scene);
    ornament.scaling.set(0.8, 1.6, 0.5);
    ornament.position.set(RING.x, RING.y + RING.radius + 0.28, RING.z);
    ornament.material = gold;
    this.adopt(ornament);
    const stem = MeshBuilder.CreateBox(
      'title-stem',
      { width: 0.035, height: 0.5, depth: 0.035 },
      scene,
    );
    stem.position.set(RING.x, RING.y - RING.radius - 0.25, RING.z);
    stem.material = gold;
    this.adopt(stem);
    const pendant = MeshBuilder.CreatePolyhedron('title-pendant', { type: 1, size: 0.11 }, scene);
    pendant.scaling.set(0.8, 1.5, 0.5);
    pendant.position.set(RING.x, RING.y - RING.radius - 0.6, RING.z);
    pendant.material = gold;
    this.adopt(pendant);
    // Shards of Lumérite orbit along the ring; one source, instanced.
    this.orbit = new TransformNode('title-orbit', scene);
    this.orbit.parent = this.root;
    this.orbit.position.set(RING.x, RING.y, RING.z - 0.1);
    const source = MeshBuilder.CreatePolyhedron('title-shard', { type: 1, size: 0.34 }, scene);
    source.material = ice;
    source.isVisible = false;
    this.adopt(source);
    const count = 7;
    for (let i = 0; i < count; i++) {
      const a = Math.PI / 2 + ((i + 0.5) / count) * Math.PI * 2;
      const shard = source.createInstance(`title-shard-${i}`);
      const r = RING.radius + (i % 2 ? 0.12 : -0.1);
      shard.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      shard.scaling.set(0.7, 1.45 + (i % 3) * 0.15, 0.45);
      shard.rotation.z = a + Math.PI / 2 + (i % 2 ? 0.35 : -0.35);
      shard.parent = this.orbit;
      shard.isPickable = false;
      this.shards.push(shard);
    }
    // Tiny motes of the same light drifting in the beam.
    for (let i = 0; i < 9; i++) {
      const mote = source.createInstance(`title-mote-${i}`);
      mote.parent = this.root;
      mote.position.set(RING.x + (rng() - 0.5) * 6, 1.5 + rng() * 9, RING.z - 0.4 - rng() * 0.6);
      mote.scaling.setAll(0.08 + rng() * 0.08);
      mote.isPickable = false;
      this.shards.push(mote);
    }
    // The star at the top of the ring.
    this.star = MeshBuilder.CreatePlane('title-star', { size: 2.6 }, scene);
    this.star.material = p.halo;
    this.star.position.set(RING.x, RING.y + RING.radius + 0.28, RING.z - 0.3);
    this.adopt(this.star);
  }
  private adopt(mesh: Mesh): void {
    mesh.parent = this.root;
    mesh.isPickable = false;
    this.meshes.push(mesh);
  }
  private material(scene: Scene, name: string, hex: string, emission: number): StandardMaterial {
    const m = new StandardMaterial(name, scene);
    const color = Color3.FromHexString(hex);
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.emissiveColor = color.scale(emission);
    m.disableLighting = true;
    m.fogEnabled = false;
    this.materials.push(m);
    return m;
  }
  /** Overgrown ruins in depth: towers far away, arches near, the sky through a doorway. */
  private paintRuins(
    near: PaintedGeometry,
    far: PaintedGeometry,
    rng: Rng,
    depth: (d: number, lift?: number) => Paint,
  ): void {
    const t = this.tint;
    const leaves = (d: number, light = false): Paint => {
      const base = hexToRgb(light ? titleColors.foliageLight : titleColors.foliage);
      return (_x, y) => {
        const hazy = mixRgb(base, t.horizon, d * d * 0.55);
        return rgba(mixRgb(hazy, t.mist, Math.max(0, 0.35 - y * 0.02) * d));
      };
    };
    const X = TITLE_X;
    // Distant spires, pale against the dawn.
    for (const [u, top, w] of [
      [-15, 21, 1.4],
      [-9.5, 16, 1.1],
      [-3, 23, 1.6],
      [5.5, 19, 1.2],
      [10, 24, 1.8],
      [16, 17, 1.2],
    ] as const) {
      column(far, rng, X + u, LAYERS.distant, -6, top, w, depth(0.97), depth(0.97, 0.06));
      far.triangle(
        [X + u - w * 0.6, top - 0.2],
        [X + u + w * 0.6, top - 0.2],
        [X + u, top + 2.2],
        LAYERS.distant,
        depth(0.97),
      );
    }
    // Far towers and arches, with trees on their crowns.
    for (const u of [-14, 9.5]) {
      column(
        far,
        rng,
        X + u - 2.6,
        LAYERS.far,
        -5,
        15 + rng() * 3,
        1.5,
        depth(0.75),
        depth(0.75, 0.08),
      );
      column(
        far,
        rng,
        X + u + 2.6,
        LAYERS.far,
        -5,
        14 + rng() * 3,
        1.5,
        depth(0.75),
        depth(0.75, 0.08),
      );
      arch(far, rng, X + u, 11.5, LAYERS.far, 2.6, 0.9, depth(0.75), true);
      this.foliage(far, rng, X + u + 2.6, 15.5, 2.2, LAYERS.far - 0.1, leaves(0.75));
    }
    // Middle towers behind the ring, half veiled in mist.
    column(near, rng, X - 4.8, LAYERS.mid, -5, 17, 2.7, depth(0.6), depth(0.6, 0.1));
    column(near, rng, X + 5.5, LAYERS.mid, -5, 16, 2.5, depth(0.6), depth(0.6, 0.1));
    arch(near, rng, X + 0.35, 12.5, LAYERS.mid, 5.1, 1.2, depth(0.6), true);
    // Courses of stone, and the dawn from the doorway grazing their right edges.
    this.masonry(near, X - 4.8, 2.7, 17, LAYERS.mid - 0.03, rng);
    this.masonry(near, X + 5.5, 2.5, 16, LAYERS.mid - 0.03, rng);
    // Tall windows still catch the dawn.
    for (const [u, y] of [
      [-4.8, 4.5],
      [-4.8, 9.5],
      [5.5, 6],
    ] as const)
      this.window(near, X + u, y, LAYERS.mid - 0.05, 1.1, 2.8);
    this.foliage(near, rng, X - 4.6, 16.4, 2.6, LAYERS.mid - 0.1, leaves(0.5));
    this.foliage(near, rng, X + 5.3, 15.8, 2.4, LAYERS.mid - 0.1, leaves(0.5, true));
    for (let i = 0; i < 6; i++)
      vine(near, rng, X - 6 + i * 2.4 + rng(), 15, LAYERS.mid - 0.2, 2 + rng() * 4, leaves(0.5));
    // Left: dark pillars and an arch behind the title.
    column(near, rng, X - 12.3, LAYERS.back, -4, 14, 1.5, depth(0.16), depth(0.16, 0.14));
    column(near, rng, X - 8.4, LAYERS.back, -4, 12.5, 1.3, depth(0.16), depth(0.16, 0.14));
    arch(near, rng, X - 10.35, 9.6, LAYERS.back, 1.95, 0.75, depth(0.16), false);
    for (let i = 0; i < 5; i++)
      vine(
        near,
        rng,
        X - 12.8 + i * 1.2,
        12 + rng() * 2,
        LAYERS.back - 0.2,
        2 + rng() * 5,
        leaves(0.18),
      );
    this.foliage(near, rng, X - 10.6, 13.4, 2.4, LAYERS.back - 0.1, leaves(0.18));
    // Right: a great doorway open on the dawn, a young tree growing from its sill.
    column(near, rng, X + 7.4, LAYERS.back, -4, 9.6, 1.5, depth(0.16), depth(0.16, 0.14));
    column(near, rng, X + 12.8, LAYERS.back, -4, 10.4, 1.5, depth(0.16), depth(0.16, 0.14));
    arch(near, rng, X + 10.1, 5.6, LAYERS.back, 2.65, 0.9, depth(0.16), false);
    // The wall above the doorway, broken along its top.
    near.band(
      [X + 6.6, X + 8, X + 10.1, X + 12, X + 13.6],
      [7.6, 8.2, 8.3, 8.2, 7.6],
      [9.4, 10.3, 9.6, 10.8, 10.1],
      LAYERS.back,
      depth(0.16),
    );
    this.foliage(near, rng, X + 12.4, 10.6, 2.6, LAYERS.back - 0.1, leaves(0.2, true));
    this.foliage(near, rng, X + 8, 10, 1.8, LAYERS.back - 0.1, leaves(0.22));
    for (let i = 0; i < 4; i++)
      vine(near, rng, X + 8 + i * 1.4, 9.6, LAYERS.back - 0.2, 2 + rng() * 3, leaves(0.2));
    tree(near, rng, X + 7.6, 9.6, LAYERS.back - 0.15, 3, depth(0.18));
  }
  /** Mortar courses and staggered joints on a tower, a warm rim on its lit side. */
  private masonry(
    g: PaintedGeometry,
    x: number,
    width: number,
    top: number,
    z: number,
    rng: Rng,
  ): void {
    const mortar = mixRgb(this.tint.near, this.tint.mid, 0.35);
    const ink: Paint = () => rgba(mortar, 1);
    const half = width * 0.44;
    for (let y = -1, row = 0; y < top - 1.5; y += 1.15 + rng() * 0.2, row++) {
      g.band([x - half, x + half], [y, y], [y + 0.06, y + 0.06], z, ink);
      for (let j = x - half + (row % 2 ? 0.45 : 0.9); j < x + half - 0.2; j += 0.9 + rng() * 0.3)
        g.band([j, j + 0.05], [y + 0.06, y + 0.06], [y + 1.1, y + 1.1], z, ink);
    }
    const warm = this.tint.light;
    g.band(
      [x + width * 0.4, x + width * 0.5],
      [-1, -1],
      [top - 1, top - 1],
      z - 0.01,
      (_px, py) => {
        const k = 0.42 * (1 - Math.max(0, Math.min(1, (py - 2) / (top - 2))) * 0.6);
        return rgba(mixRgb(this.tint.mid, warm, k));
      },
    );
  }
  /** A lancet window lit from behind, its pane warm at the sill. */
  private window(g: PaintedGeometry, x: number, y: number, z: number, w: number, h: number): void {
    const light = this.tint.light;
    const xs = [-0.5, -0.35, -0.2, 0, 0.2, 0.35, 0.5].map((k) => x + k * w);
    const tops = xs.map((px) => y + h - (Math.abs(px - x) / (w / 2)) ** 1.6 * h * 0.35);
    g.band(
      xs,
      xs.map(() => y),
      tops,
      z,
      (_px, py) => {
        const k = 0.62 - 0.3 * Math.max(0, Math.min(1, (py - y) / h));
        return [light[0] * k, light[1] * k, light[2] * k, 1];
      },
    );
  }
  /** Leaves: overlapping discs, lighter and hazier with distance. */
  private foliage(
    g: PaintedGeometry,
    rng: Rng,
    cx: number,
    cy: number,
    size: number,
    z: number,
    paint: Paint,
  ): void {
    for (let k = 0; k < 7; k++) {
      const x = cx + (rng() - 0.5) * size * 1.4,
        y = cy + (rng() - 0.3) * size * 0.7;
      const r = size * (0.3 + rng() * 0.3);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2,
          a1 = ((i + 1) / n) * Math.PI * 2;
        const wobble = 0.85 + rng() * 0.3;
        g.triangle(
          [x, y],
          [x + Math.cos(a0) * r * wobble, y + Math.sin(a0) * r * 0.8],
          [x + Math.cos(a1) * r, y + Math.sin(a1) * r * 0.8 * wobble],
          z,
          paint,
        );
      }
    }
  }
  /** The outcrop Eidra stands on, mossy, starred with small white flowers. */
  private paintOutcrop(
    g: PaintedGeometry,
    rng: Rng,
    depth: (d: number, lift?: number) => Paint,
  ): void {
    const X = TITLE_X;
    const stone = hexToRgb(titleColors.stone);
    const moss = hexToRgb(titleColors.foliage);
    const rock: Paint = (_x, y) => {
      const lit = Math.max(0, Math.min(1, (y + 1.5) / 2));
      return rgba(
        mixRgb(mixRgb(stone, [0.02, 0.04, 0.05], 0.4), mixRgb(stone, moss, 0.45), lit * lit),
      );
    };
    const outline: Point[][] = [
      [
        [-3.2, WATER],
        [-2.9, -0.2],
        [-2.2, 0.15],
        [-1, 0.28],
        [0.4, 0.32],
        [1.6, 0.26],
        [2.5, 0.05],
        [3, -0.5],
        [3.4, WATER],
      ],
      [
        [-6.5, WATER],
        [-6, -0.75],
        [-4.8, -0.55],
        [-3.6, -0.7],
        [-3, WATER],
      ],
      [
        [3, WATER],
        [3.6, -0.9],
        [5, -0.75],
        [6.4, -1],
        [6.9, WATER],
      ],
    ];
    for (const shape of outline) {
      const xs = shape.map(([u]) => X + u);
      g.band(
        xs,
        xs.map(() => WATER - 0.3),
        shape.map(([, y]) => y),
        0.35,
        rock,
      );
    }
    // Moss, grass and flowers along the top of the main rock.
    const flowers = hexToRgb(titleColors.flowers);
    for (let u = -2.9; u < 2.9; u += 0.18 + rng() * 0.15) {
      const top = 0.12 + 0.18 * Math.cos((u / 3) * Math.PI * 0.5);
      const h = 0.15 + rng() * 0.3;
      g.triangle(
        [X + u - 0.07, top],
        [X + u + 0.07, top],
        [X + u + (rng() - 0.5) * 0.2, top + h],
        0.2,
        () => rgba(mixRgb(moss, [0.5, 0.6, 0.4], rng() * 0.4)),
      );
      if (rng() < 0.45) {
        const fx = X + u + (rng() - 0.5) * 0.3,
          fy = top + 0.05 + rng() * 0.2;
        const s = 0.05 + rng() * 0.04;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.triangle(
            [fx, fy],
            [fx + Math.cos(a) * s, fy + Math.sin(a) * s],
            [fx + Math.cos(a + 0.6) * s, fy + Math.sin(a + 0.6) * s],
            0.1,
            () => rgba(flowers),
          );
        }
      }
    }
    // Low rubble at the waterline, just behind the play plane.
    for (const u of [-9, -7.5, 7.8, 9.6]) {
      const w = 0.8 + rng();
      g.band(
        [X + u - w, X + u, X + u + w],
        [WATER - 0.3, WATER - 0.3, WATER - 0.3],
        [WATER + 0.1, WATER + 0.5 + rng() * 0.5, WATER + 0.1],
        LAYERS.rear,
        depth(0.08),
      );
    }
  }
  /** Dark, out-of-focus leaves and stones framing the corners. */
  private paintForeground(g: PaintedGeometry, rng: Rng): void {
    const X = TITLE_X;
    const ink: Paint = () => [0.012, 0.022, 0.024, 0.95];
    for (const [u, y, r] of [
      [-16, -3.6, 3.2],
      [-13, -4.5, 2.4],
      [15.5, -3.8, 3],
      [12.5, -4.8, 2.2],
    ] as const) {
      const xs: number[] = [],
        tops: number[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI - (i / 10) * Math.PI;
        xs.push(X + u + Math.cos(a) * r);
        tops.push(y + Math.sin(a) * r * 0.7 + (rng() - 0.5) * 0.3);
      }
      g.band(
        xs,
        xs.map(() => y - 4),
        tops,
        LAYERS.front,
        ink,
      );
    }
    // Leaves hanging into the top left corner.
    for (let i = 0; i < 6; i++) {
      const x = X - 17 + i * 1.3 + rng(),
        len = 2 + rng() * 3.5;
      const spine: Point[] = [],
        widths: number[] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        spine.push([x + Math.sin(t * 3 + i) * 0.4, 13 - len * t]);
        widths.push(0.7 * (1 - t) + 0.05);
      }
      g.ribbon(spine, widths, LAYERS.front, ink, 0.3);
    }
  }
  /** Shafts of dawn light and the glow of the ring. */
  private paintLight(glow: PaintedGeometry, shafts: PaintedGeometry): void {
    const light = this.tint.light;
    const warm = (k: number): RGBA => [light[0] * k, light[1] * k, light[2] * k, 1];
    const cold = (k: number): RGBA => {
      const c = hexToRgb(titleColors.crystal);
      return [c[0] * k, c[1] * k, c[2] * k, 1];
    };
    glow.sprite(RING.x, RING.y, RING.radius * 2.4, RING.radius * 2.4, RING.z + 0.4, cold(0.3));
    glow.sprite(
      RING.x,
      RING.y + 0.2,
      RING.radius * 1.2,
      RING.radius * 1.2,
      RING.z + 0.3,
      cold(0.38),
    );
    glow.sprite(TITLE_HERO.x, 0.6, 3.2, 1.6, 0.2, cold(0.35));
    glow.sprite(TITLE_X + 10.1, 7, 9, 9, LAYERS.back + 0.5, warm(0.45));
    // The beam falls through the ring onto Eidra (its reflection is in the water texture).
    shafts.sprite(RING.x, 9.5, 1.5, 16, RING.z + 0.2, cold(1.2));
    shafts.sprite(RING.x, 6.5, 0.55, 12, RING.z + 0.15, cold(1.4));
    for (let i = 0; i < 3; i++)
      shafts.sprite(TITLE_X + 6 + i * 3.5, 9, 2.4 + i, 22, 5 - i, warm(0.55), -0.42 - i * 0.05);
  }
  private buildWater(scene: Scene): void {
    const t = this.tint;
    const near = mixRgb(t.near, t.mid, 0.35),
      far = mixRgb(t.fog, t.horizon, 0.22);
    const crystal = hexToRgb(titleColors.crystal);
    // Where the ring and the doorway stand along the pool (u), and how wide they reflect.
    const streaks = [
      { u: 0.5 + (RING.x - TITLE_X) / WATER_SIZE.width, width: 0.018, color: crystal, k: 0.85 },
      { u: 0.5 + 10.1 / WATER_SIZE.width, width: 0.035, color: t.light, k: 0.55 },
    ];
    const texture = proceduralTexture(scene, 128, 128, (u, v) => {
      // Darker under the camera, catching the dawn towards the horizon, with faint ripples.
      const k = v ** 1.6;
      const ripple = 0.04 * Math.sin(v * 90) * (1 - v);
      let c = mixRgb(near, far, Math.min(1, Math.max(0, k + ripple)));
      // The ring and the dawn break into trembling dashes of light on the surface.
      for (const s of streaks) {
        const across = Math.exp(-(((u - s.u) / s.width) ** 2));
        const dashes = Math.max(0, Math.sin(v * 260 + Math.sin(u * 140) * 2));
        c = mixRgb(c, s.color, Math.min(1, across * dashes * s.k * (0.4 + v)));
      }
      return [c[0], c[1], c[2], 1];
    });
    const material = new StandardMaterial('title-water', scene);
    // Unlit: the emissive texture is added to the emissive colour, which stays black.
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.emissiveTexture = texture;
    material.emissiveColor = Color3.Black();
    material.disableLighting = true;
    this.materials.push(material);
    // A pool around the outcrop: the ruins stand in it further back.
    const water = MeshBuilder.CreateGround('title-water', WATER_SIZE, scene);
    water.position.set(TITLE_X, WATER, -3);
    water.material = material;
    this.adopt(water);
  }
  /** The shards orbit slowly along the ring, the star breathes, the beam shimmers. */
  update(time: number, reducedMotion: boolean): void {
    const motion = reducedMotion ? 0.15 : 1;
    this.orbit.rotation.z = time * 0.09 * motion;
    this.shards.forEach((shard, i) => {
      if (i < 7) shard.rotation.y = time * 0.6 * motion + i;
      else shard.position.y += Math.sin(time * 0.7 + i) * 0.002 * motion;
    });
    const breathe = 1 + Math.sin(time * 1.3) * 0.08 * motion;
    this.star.scaling.setAll(breathe);
    if (this.beam) this.beam.visibility = 0.85 + Math.sin(time * 2.1) * 0.08 * motion;
  }
  setEnabled(enabled: boolean): void {
    this.root.setEnabled(enabled);
  }
  dispose(): void {
    this.root.dispose(false, false);
    for (const material of this.materials) material.dispose(true, true);
  }
}
