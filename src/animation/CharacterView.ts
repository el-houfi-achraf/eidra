import '@babylonjs/core/Rendering/outlineRenderer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Material } from '@babylonjs/core/Materials/material';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from '../world/Palette';
import { appearances } from '../../game-data/characters/appearance';
import type { Appearance, CharacterKind } from '../../game-data/characters/appearance';
import { PuppetGeometry, hexToRgb } from './PuppetGeometry';
import type { RGB } from './PuppetGeometry';
import { SecondaryChain } from './SecondaryChain';
export type { CharacterKind };
/** Purely visual state derived from the simulation each frame. */
export interface Pose {
  /** Vertical speed; stretches the silhouette in the air. */
  vy?: number;
  grounded?: boolean;
  /** 0..1 landing squash, decayed by the presentation. */
  land?: number;
  /** Seconds of white hit flash left. */
  hit?: number;
  /** 0..1 progress of a Recueillement channel. */
  channel?: number;
  /** Telegraphing an attack: eyes flare and the ink outline turns amber. */
  warning?: boolean;
  /** 0..1 progress of the defeat dissolve. */
  dying?: number;
  /** Golden blade of an empowered riposte. */
  empowered?: boolean;
}
interface Ribbon {
  chain: SecondaryChain;
  mesh: Mesh;
  anchor: TransformNode;
  width: number;
  positions: Float32Array;
}
const INK = Color3.FromHexString('#050b0c');
const WARNING = Color3.FromHexString('#ff914d');
const GOLD = Color3.FromHexString('#e3c47a');
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
/** Radius of the bell cloak at a given height, following the lathe profile. */
const cloakRadius = (look: Appearance, y: number): number => {
  const c = look.cloak;
  if (!c) return 0.2;
  const t = Math.max(0, Math.min(1, (c.shoulder - y) / (c.shoulder - c.bottom)));
  return c.top + (c.hem - c.top) * t ** 0.75;
};
// TODO_ART: stylised procedural puppets; rigged Blender characters are a production gate.
export class CharacterView {
  readonly root: TransformNode;
  readonly meshes: Mesh[] = [];
  private body: Mesh;
  private eyes: Mesh | null = null;
  private core: Mesh | null = null;
  private hand: TransformNode;
  private weapon: Mesh | null = null;
  private legs: TransformNode[] = [];
  private ribbons: Ribbon[] = [];
  private materials: (Material | null)[] = [];
  private look: Appearance;
  private flashing = false;
  private lastTime = Number.NaN;
  private lastX = Number.NaN;
  private stride = 0;
  private seed: number;
  constructor(
    private scene: Scene,
    private p: Palette,
    readonly kind: CharacterKind,
  ) {
    this.look = appearances[kind];
    const look = this.look;
    this.seed = [...kind].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 7;
    this.root = new TransformNode(kind, scene);
    this.body = this.adopt(this.buildBody().build(scene, `${kind}-body`));
    this.body.material = look.ghost ? p.ghost : p.puppet;
    if (!look.ghost) {
      this.body.renderOutline = true;
      this.body.outlineWidth = 0.03;
      this.body.outlineColor = INK;
    }
    const glow: StandardMaterial = look.glow === 'amber' ? p.danger : p.crystal;
    const eyes = this.buildEyes();
    if (eyes.triangles) {
      this.eyes = this.adopt(eyes.build(scene, `${kind}-eyes`, undefined, false));
      this.eyes.position.set(0.05, look.mask.y, 0);
      this.eyes.material = glow;
    }
    if (look.cloak) {
      const core = new PuppetGeometry();
      core.ellipsoid([0, 0, 0], [0.055, 0.075, 0.04], [1, 1, 1], 2, 4);
      this.core = this.adopt(core.build(scene, `${kind}-heart`, undefined, false));
      const y = look.cloak.shoulder - 0.1;
      this.core.position.set(0.02, y, -cloakRadius(look, y) * 1.08 - 0.05);
      this.core.material = glow;
    }
    this.hand = new TransformNode(`${kind}-hand`, scene);
    this.hand.parent = this.root;
    this.hand.position.set(0.34, -0.04, -0.2);
    const weapon = this.buildWeapon();
    if (weapon.triangles) {
      this.weapon = this.adopt(weapon.build(scene, `${kind}-weapon`), this.hand);
      this.weapon.material = look.ghost ? p.ghost : p.puppet;
      if (!look.ghost) {
        this.weapon.renderOutline = true;
        this.weapon.outlineWidth = 0.02;
        this.weapon.outlineColor = INK;
      }
    }
    if (look.legs)
      for (const side of [-1, 1]) {
        const pivot = new TransformNode(`${kind}-hip`, scene);
        pivot.parent = this.root;
        pivot.position.set(side * 0.08, -0.85 + look.legs.length, 0.03 * side);
        const leg = new PuppetGeometry();
        const color = hexToRgb(look.legs.color);
        leg.box([0, -look.legs.length / 2, 0], [0.075, look.legs.length, 0.075], color);
        leg.box([0.035, -look.legs.length + 0.02, 0], [0.14, 0.05, 0.085], shade(color, 1.4));
        const mesh = this.adopt(leg.build(scene, `${kind}-leg`), pivot);
        mesh.material = look.ghost ? p.ghost : p.puppet;
        this.legs.push(pivot);
      }
    if (look.scarf)
      this.addRibbon(
        [-0.14, (look.cloak?.shoulder ?? 0.3) - 0.02, -0.02],
        look.scarf.length,
        look.scarf.width,
        look.scarf.color,
      );
    if (look.accessory === 'veil')
      for (const [side, length] of [
        [-1, 0.75],
        [0, 0.95],
        [1, 0.6],
      ] as const)
        this.addRibbon(
          [side * 0.12, look.mask.y - look.mask.height * 0.6, 0.04],
          length,
          0.26,
          '#bfe8da',
          true,
        );
    // Ribbons live in world space; keep them in step with the root's visibility.
    this.root.onEnabledStateChangedObservable.add((enabled) => {
      for (const ribbon of this.ribbons) ribbon.mesh.setEnabled(enabled);
    });
    this.root.scaling.setAll(look.scale);
    this.materials = this.meshes.map((m) => m.material);
  }
  private adopt(mesh: Mesh, parent: TransformNode = this.root): Mesh {
    mesh.parent = parent;
    mesh.isPickable = false;
    this.meshes.push(mesh);
    return mesh;
  }
  private buildBody(): PuppetGeometry {
    const look = this.look;
    const g = new PuppetGeometry();
    const mask = look.mask;
    const c = look.cloak;
    if (c) {
      const color = hexToRgb(c.color);
      const segments = c.pleats * 4;
      const rings = [0, 0.22, 0.5, 0.78, 1].map(
        (t) =>
          [c.top + (c.hem - c.top) * t ** 0.75, c.shoulder - (c.shoulder - c.bottom) * t] as const,
      );
      // Valleys between pleats are darker so the folds read even in flat colour.
      const fold = (j: number): number =>
        0.84 + 0.16 * (0.5 + 0.5 * Math.cos(c.pleats * ((j + 0.5) / segments) * Math.PI * 2));
      g.lathe(rings, {
        segments,
        pleats: c.pleats,
        pleatDepth: 0.09,
        hemDepth: c.hemDepth,
        color: (_i, j) => shade(color, fold(j)),
      });
      g.lathe(
        rings.slice(2).map(([r, y]) => [r * 0.95, y] as const),
        {
          segments,
          pleats: c.pleats,
          pleatDepth: 0.09,
          hemDepth: c.hemDepth,
          inward: true,
          color: () => hexToRgb(c.lining),
        },
      );
      if (look.collar) {
        const edge = cloakRadius(look, c.shoulder - 0.2) + 0.07;
        g.lathe(
          [
            [0.12, c.shoulder + 0.06],
            [c.top + 0.06, c.shoulder - 0.02],
            [edge, c.shoulder - 0.2],
          ],
          {
            segments: look.collar.points * 4,
            pleats: look.collar.points,
            pleatDepth: 0.05,
            hemDepth: 0.07,
            color: () => hexToRgb(look.collar!.color),
          },
        );
      }
      if (look.studs) {
        const studs = look.studs;
        for (let k = 0; k < studs.count; k++) {
          const t = (k + 0.5) / studs.count;
          const y = c.shoulder - 0.2 - t * (c.shoulder - c.bottom - 0.3);
          const r = cloakRadius(look, y) * 1.09 + 0.015;
          const angle = -Math.PI / 2 + 0.5;
          g.box(
            [Math.cos(angle) * r, y, Math.sin(angle) * r],
            [0.045, 0.045, 0.045],
            hexToRgb(studs.color),
            Math.PI / 4,
          );
        }
      }
    }
    const hood = look.hood;
    const maskZ = hood ? -hood.radius * 0.9 - 0.02 : -0.2;
    if (hood) {
      const r = hood.radius;
      const base = (c?.shoulder ?? 0.3) - 0.06;
      const brow = mask.y + 0.27;
      g.lathe(
        [
          [0.015, hood.tip],
          [r * 0.38, (brow + hood.tip) / 2],
          [r * 0.68, brow],
          [r * 0.92, mask.y + 0.14],
          [r, mask.y],
          [r * 0.98, mask.y - 0.16],
          [r * 0.7, base],
        ],
        {
          segments: 16,
          color: () => hexToRgb(hood.color),
          // The point sweeps backwards: t = 0 at the tip.
          lean: (t) => -hood.lean * (1 - t) ** 2,
        },
      );
      // Shadowed opening of the hood around the mask.
      g.ellipsoid(
        [0.04, mask.y - 0.01, -r * 0.82],
        [mask.width * 1.14, mask.height * 1.1, 0.07],
        [0.03, 0.05, 0.06],
        5,
        12,
      );
      if (hood.trim)
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          g.box(
            [
              0.04 + Math.cos(a) * mask.width * 1.2,
              mask.y - 0.01 + Math.sin(a) * mask.height * 1.16,
              -r * 0.9 - 0.02,
            ],
            [0.07, 0.022, 0.03],
            hexToRgb(hood.trim),
            a + Math.PI / 2,
          );
        }
    } else {
      // Hoodless figures carry the mask on a dark head.
      g.ellipsoid(
        [0, mask.y, 0.02],
        [mask.width * 0.95, mask.height * 0.95, mask.width * 0.85],
        hexToRgb(c?.color ?? '#1a1f1f'),
        5,
        10,
      );
    }
    g.ellipsoid(
      [0.05, mask.y, maskZ],
      [mask.width, mask.height, 0.075],
      hexToRgb(mask.color),
      6,
      12,
    );
    if (mask.crack && mask.eyes !== 'none') {
      const x = 0.05 + mask.width * 0.35,
        top = mask.y + mask.height * 0.85,
        z = maskZ - 0.078;
      g.plate(
        [
          [x - 0.01, top],
          [x + 0.012, top],
          [x - 0.02, top - mask.height * 0.4],
          [x + 0.004, top - mask.height * 0.75],
          [x - 0.012, top - mask.height * 0.75],
          [x - 0.036, top - mask.height * 0.4],
        ],
        z,
        [0.2, 0.19, 0.17],
      );
    }
    this.buildAccessory(g);
    return g;
  }
  private buildAccessory(g: PuppetGeometry): void {
    const look = this.look;
    const accent = hexToRgb(look.collar?.color ?? look.accent);
    const ring = (cx: number, cy: number, cz: number, radius: number, gap: number, color: RGB) => {
      const pieces = 18;
      for (let k = 0; k < pieces; k++) {
        if (k >= pieces - gap) continue;
        const a = (k / pieces) * Math.PI * 2 + 0.6;
        g.box(
          [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cz],
          [((Math.PI * 2 * radius) / pieces) * 1.05, 0.04, 0.04],
          color,
          a + Math.PI / 2,
        );
      }
    };
    switch (look.accessory) {
      case 'halo':
        ring(0, look.mask.y + 0.08, 0.16, 0.44, 3, hexToRgb(look.accent));
        break;
      case 'rings':
        ring(0, 0.3, 0.3, 0.82, 4, accent);
        ring(0, 0.55, 0.36, 0.62, 3, shade(accent, 0.8));
        for (const side of [-1, 1])
          g.box([side * 0.42, 0.34, -0.02], [0.34, 0.15, 0.42], [0.43, 0.4, 0.33], side * 0.38);
        break;
      case 'urn': {
        const bronze = hexToRgb('#9c7a45');
        g.lathe(
          [
            [0.02, 1.05],
            [0.1, 1.0],
            [0.08, 0.92],
            [0.2, 0.8],
            [0.22, 0.62],
            [0.14, 0.45],
            [0.02, 0.42],
          ],
          { segments: 10, center: [-0.3, 0, 0.22], color: (i) => shade(bronze, i % 2 ? 0.9 : 1) },
        );
        g.box([-0.12, 0.5, 0.05], [0.05, 0.6, 0.05], [0.25, 0.2, 0.15], -0.6);
        break;
      }
      case 'banner': {
        const pole: RGB = [0.33, 0.27, 0.19];
        g.box([-0.34, 0.62, 0.2], [0.05, 2.1, 0.05], pole);
        g.box([-0.34, 1.7, 0.2], [0.09, 0.09, 0.09], hexToRgb('#e0bf73'), Math.PI / 4);
        const cloth = hexToRgb(look.cloak?.color ?? '#3a2427');
        g.plate(
          [
            [-0.36, 1.58],
            [-0.36, 0.86],
            [-0.58, 1.0],
            [-0.8, 0.86],
            [-0.8, 1.58],
          ],
          0.18,
          shade(cloth, 1.25),
        );
        g.plate(
          [
            [-0.58, 1.42],
            [-0.52, 1.28],
            [-0.58, 1.14],
            [-0.64, 1.28],
          ],
          0.17,
          hexToRgb('#e0bf73'),
        );
        break;
      }
      default:
        break;
    }
  }
  private buildEyes(): PuppetGeometry {
    const look = this.look;
    const g = new PuppetGeometry();
    const m = look.mask;
    // Eyes are drawn a little larger than life so they read at gameplay distance.
    const k = (m.width / 0.2) * 1.35;
    // Coordinates relative to the eye mesh origin (the mask centre), facing the camera.
    const z = (look.hood ? -look.hood.radius * 0.9 - 0.02 : -0.2) - 0.08;
    const white: RGB = [1, 1, 1];
    const diamond = (x: number, y: number, r: number) =>
      g.plate(
        [
          [x, y + r],
          [x + r * 0.8, y],
          [x, y - r],
          [x - r * 0.8, y],
        ],
        z,
        white,
      );
    switch (m.eyes) {
      case 'twin':
        for (const s of [-1, 1]) {
          const ex = s * 0.062 * k,
            ey = 0.01;
          // The top edge slopes down towards the nose: a resolute, slightly stern gaze.
          const pts: [number, number][] = [
            [ex + s * 0.048 * k, ey + 0.03 * k],
            [ex - s * 0.042 * k, ey + 0.004 * k],
            [ex - s * 0.036 * k, ey - 0.022 * k],
            [ex + s * 0.04 * k, ey - 0.012 * k],
          ];
          g.plate(s > 0 ? pts : [...pts].reverse(), z, white);
        }
        break;
      case 'single':
        g.plate(
          [
            [-0.018, 0.08],
            [0.018, 0.08],
            [0.011, -0.08],
            [-0.011, -0.08],
          ],
          z,
          white,
        );
        break;
      case 'triple':
        diamond(-0.07 * k, 0.0, 0.026);
        diamond(0.07 * k, 0.0, 0.026);
        diamond(0, 0.07, 0.022);
        break;
      case 'hollow':
        for (const s of [-1, 1])
          g.plate(
            Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return [s * 0.08 * k + Math.cos(a) * 0.05, 0.015 + Math.sin(a) * 0.06] as [
                number,
                number,
              ];
            }),
            z,
            white,
          );
        break;
      case 'closed':
        for (const s of [-1, 1]) {
          const ex = s * 0.07 * k;
          g.plate(
            [
              [ex - 0.045, 0.012],
              [ex, -0.012],
              [ex, -0.026],
              [ex - 0.045, 0.0],
            ],
            z,
            white,
          );
          g.plate(
            [
              [ex, -0.012],
              [ex + 0.045, 0.012],
              [ex + 0.045, 0.0],
              [ex, -0.026],
            ],
            z,
            white,
          );
        }
        break;
      case 'none': {
        // A faceless mask: only a glowing fault runs from brow to chin.
        const h = m.height;
        const zig: [number, number][] = [
          [0.02, h * 0.9],
          [-0.03, h * 0.45],
          [0.025, h * 0.05],
          [-0.02, -h * 0.4],
          [0.01, -h * 0.85],
        ];
        for (let i = 0; i < zig.length - 1; i++) {
          const [x0, y0] = zig[i]!,
            [x1, y1] = zig[i + 1]!;
          g.plate(
            [
              [x0 - 0.012, y0],
              [x0 + 0.012, y0],
              [x1 + 0.012, y1],
              [x1 - 0.012, y1],
            ],
            z,
            white,
          );
        }
        break;
      }
    }
    return g;
  }
  private buildWeapon(): PuppetGeometry {
    const g = new PuppetGeometry();
    const ivory = hexToRgb('#e7e2cf'),
      gold = hexToRgb('#d7ad69'),
      dark: RGB = [0.12, 0.1, 0.09];
    switch (this.look.weapon) {
      case 'blade':
        g.box([0, 0.07, 0], [0.035, 0.14, 0.035], dark);
        g.box([0, -0.01, 0], [0.17, 0.035, 0.05], gold);
        g.box([0, -0.38, 0], [0.055, 0.7, 0.025], ivory);
        g.box([0, -0.76, 0], [0.039, 0.039, 0.025], ivory, Math.PI / 4);
        break;
      case 'halberd':
        g.box([0, -0.1, 0], [0.04, 1.7, 0.04], [0.3, 0.24, 0.17]);
        g.box([0.1, 0.6, 0], [0.2, 0.16, 0.03], [0.72, 0.7, 0.62]);
        g.box([0, 0.86, 0], [0.03, 0.26, 0.03], [0.72, 0.7, 0.62]);
        break;
      case 'greatblade':
        g.box([0, 0.12, 0], [0.05, 0.22, 0.05], dark);
        g.box([0, -0.02, 0], [0.32, 0.05, 0.07], hexToRgb('#9c7a45'));
        g.box([0, -0.56, 0], [0.13, 1.0, 0.04], [0.55, 0.61, 0.59]);
        break;
      case 'none':
        break;
    }
    return g;
  }
  private addRibbon(
    anchor: readonly [number, number, number],
    length: number,
    width: number,
    hex: string,
    translucent = this.look.ghost,
  ): void {
    const nodes = 7;
    const node = new TransformNode(`${this.kind}-ribbon-anchor`, this.scene);
    node.parent = this.root;
    node.position.set(...anchor);
    const positions = new Float32Array(nodes * 2 * 3);
    const indices: number[] = [];
    for (let i = 0; i < nodes - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const [r, g, b] = hexToRgb(hex);
    const colors: number[] = [];
    for (let i = 0; i < nodes * 2; i++) {
      const tone = i % 2 ? 0.78 : 1;
      colors.push(r * tone, g * tone, b * tone, 1);
    }
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.colors = colors;
    data.normals = Array.from({ length: nodes * 2 }, () => [0, 0, -1]).flat();
    const mesh = new Mesh(`${this.kind}-ribbon`, this.scene);
    data.applyToMesh(mesh, true);
    mesh.material = translucent ? this.p.ghostDouble : this.p.puppetDouble;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.isPickable = false;
    this.meshes.push(mesh);
    this.ribbons.push({
      chain: new SecondaryChain(nodes, length / (nodes - 1)),
      mesh,
      anchor: node,
      width,
      positions,
    });
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
    pose: Pose = {},
  ): void {
    const dt = Number.isFinite(this.lastTime)
      ? Math.max(0, Math.min(0.1, time - this.lastTime))
      : 0;
    this.lastTime = time;
    const motion = reducedMotion ? 0 : 1;
    const side = facing < 0 ? -1 : 1;
    // Squash and stretch: stretched by vertical speed, squashed by landings.
    const stretch = pose.grounded === false ? Math.min(0.16, Math.abs(pose.vy ?? 0) / 90) : 0;
    const land = (pose.land ?? 0) * motion;
    const crouch = (pose.channel ?? 0) * 0.12;
    const dying = pose.dying ?? 0;
    const sy = (1 + stretch * motion - land * 0.24 - crouch) * (1 - dying * 0.85);
    const sx = (1 - stretch * 0.45 * motion + land * 0.2) * (1 + dying * 0.4);
    const s = this.look.scale;
    // Mirroring on x turns the authored right-facing puppet towards the left.
    this.root.scaling.set(side * s * sx, s * sy, s * sx);
    this.root.position.set(x, y - 0.8 * s * (1 - sy), 0);
    this.root.rotation.y = -0.3 * side;
    this.root.rotation.z = -side * Math.min(1, Math.abs(speed) / 7) * 0.09 * motion;
    // Walk cycle driven by the distance actually travelled.
    const moved = Number.isFinite(this.lastX) ? Math.abs(x - this.lastX) : 0;
    this.lastX = x;
    if (moved < 1) this.stride += (moved / (0.95 * s)) * Math.PI * 2;
    const walk = Math.min(1, Math.abs(speed) / 4) * motion;
    this.legs.forEach((leg, i) => {
      const sign = i === 0 ? 1 : -1;
      leg.rotation.z =
        pose.grounded === false
          ? (sign > 0 ? 0.55 : -0.3) * motion
          : Math.sin(this.stride + (i === 0 ? 0 : Math.PI)) * 0.65 * walk;
    });
    const swing = Math.sin(this.stride) * walk;
    this.body.rotation.z = swing * 0.035 + Math.sin(time * 1.7 + this.seed) * 0.01 * motion;
    this.body.position.y = Math.abs(Math.cos(this.stride)) * 0.03 * walk;
    // Blade: resting low, raised then swept forward over the attack.
    const raised = Math.max(0, Math.min(1, (attack - 0.05) / 0.27));
    this.hand.rotation.z = attack > 0 ? 0.45 + 2.9 * raised : 0.3 + swing * 0.12;
    this.hand.position.y = -0.04 + this.body.position.y;
    if (this.core) {
      const glow = 1 + (pose.channel ?? 0) * 1.6;
      this.core.scaling.setAll((1 + Math.sin(time * (pose.channel ? 14 : 2)) * 0.1) * glow);
    }
    if (this.eyes) {
      // Blink every few seconds; flare while telegraphing an attack.
      const cycle = (time + this.seed * 0.9) % (3.2 + this.seed * 0.35);
      const blink = cycle < 0.11 ? 0.12 : 1;
      const flare = pose.warning ? 1.35 : 1;
      this.eyes.scaling.set(flare, blink * flare, 1);
    }
    const outline = pose.warning ? WARNING : pose.empowered ? GOLD : INK;
    if (!this.look.ghost) {
      this.body.outlineColor = outline;
      this.body.outlineWidth = pose.warning ? 0.045 : 0.03;
    }
    this.root.setEnabled(true);
    this.root.computeWorldMatrix(true);
    for (const ribbon of this.ribbons) this.updateRibbon(ribbon, dt, time, side, speed, s);
    const white = (pose.hit ?? 0) > 0 || dying > 0;
    if (white !== this.flashing || white) {
      this.flashing = white;
      this.meshes.forEach((mesh, i) => {
        mesh.material = white ? this.p.flash : (this.materials[i] ?? null);
      });
    }
    if (!white && this.weapon) {
      const index = this.meshes.indexOf(this.weapon);
      this.weapon.material = pose.empowered ? this.p.gold : (this.materials[index] ?? null);
    }
    const alpha = flash ? 0.35 : 1 - dying;
    for (const mesh of this.meshes) mesh.visibility = alpha;
  }
  private updateRibbon(
    ribbon: Ribbon,
    dt: number,
    time: number,
    side: number,
    speed: number,
    scale: number,
  ): void {
    ribbon.anchor.computeWorldMatrix(true);
    const anchor = ribbon.anchor.getAbsolutePosition();
    const chain = ribbon.chain;
    if (dt === 0) chain.reset(anchor.x, anchor.y);
    // Trails behind the character, flutters, and streams further when running.
    chain.step(dt, anchor.x, anchor.y, {
      gravity: 4,
      wind: -side * (3.4 + Math.abs(speed) * 0.35) + Math.sin(time * 2.3 + this.seed) * 1.8,
      damping: 0.88,
    });
    const nodes = chain.nodes;
    const out = ribbon.positions;
    for (let i = 0; i < nodes.length; i++) {
      const prev = nodes[Math.max(0, i - 1)]!,
        next = nodes[Math.min(nodes.length - 1, i + 1)]!;
      const tx = next.x - prev.x,
        ty = next.y - prev.y;
      const length = Math.hypot(tx, ty) || 1;
      const t = i / (nodes.length - 1);
      const half =
        (ribbon.width * scale * (1 - 0.55 * t) * (1 + 0.15 * Math.sin(time * 9 - i))) / 2;
      const nx = (-ty / length) * half,
        ny = (tx / length) * half;
      const node = nodes[i]!;
      out.set([node.x + nx, node.y + ny, anchor.z, node.x - nx, node.y - ny, anchor.z], i * 6);
    }
    ribbon.mesh.updateVerticesData(VertexBuffer.PositionKind, out, false, false);
  }
  dispose(): void {
    for (const ribbon of this.ribbons) ribbon.mesh.dispose();
    this.root.dispose(false);
  }
}
