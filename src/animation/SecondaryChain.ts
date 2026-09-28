interface Node {
  x: number;
  y: number;
  px: number;
  py: number;
}
export interface ChainForces {
  gravity?: number;
  /** Horizontal push, e.g. a breeze or the drag of running. */
  wind?: number;
  /** Velocity kept each step, 0..1. */
  damping?: number;
}
/**
 * Verlet chain in the play plane for secondary motion (scarves, veils). It is
 * purely visual: nothing in the simulation reads it, and it never affects gameplay.
 */
export class SecondaryChain {
  readonly nodes: Node[];
  constructor(
    count: number,
    readonly segment: number,
  ) {
    if (!Number.isInteger(count) || count < 2) throw new Error('A chain needs at least two nodes');
    this.nodes = Array.from({ length: count }, () => ({ x: 0, y: 0, px: 0, py: 0 }));
  }
  /** Hangs the chain straight down from an anchor, at rest. */
  reset(x: number, y: number): void {
    this.nodes.forEach((node, i) => {
      node.x = node.px = x;
      node.y = node.py = y - i * this.segment;
    });
  }
  step(dt: number, anchorX: number, anchorY: number, forces: ChainForces = {}): void {
    if (!(dt > 0) || !Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return;
    const h = Math.min(dt, 1 / 30);
    const damping = forces.damping ?? 0.9;
    const ax = forces.wind ?? 0,
      ay = -(forces.gravity ?? 7);
    const head = this.nodes[0]!;
    head.px = head.x = anchorX;
    head.py = head.y = anchorY;
    // Velocity is capped so a sudden jump of the anchor drags the strip instead of whipping it.
    const limit = this.segment * 0.6;
    for (let i = 1; i < this.nodes.length; i++) {
      const node = this.nodes[i]!;
      const vx = Math.max(-limit, Math.min(limit, (node.x - node.px) * damping)),
        vy = Math.max(-limit, Math.min(limit, (node.y - node.py) * damping));
      node.px = node.x;
      node.py = node.y;
      node.x += vx + ax * h * h;
      node.y += vy + ay * h * h;
    }
    // A teleport or a respawn would stretch the chain across the map: snap it back.
    const tail = this.nodes.at(-1)!;
    if (Math.hypot(tail.x - anchorX, tail.y - anchorY) > this.segment * this.nodes.length * 1.6) {
      this.reset(anchorX, anchorY);
      return;
    }
    for (let iteration = 0; iteration < 4; iteration++)
      for (let i = 1; i < this.nodes.length; i++) {
        const a = this.nodes[i - 1]!,
          b = this.nodes[i]!;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1e-6;
        const correction = (distance - this.segment) / distance;
        if (i === 1) {
          b.x -= dx * correction;
          b.y -= dy * correction;
        } else {
          a.x += dx * correction * 0.5;
          a.y += dy * correction * 0.5;
          b.x -= dx * correction * 0.5;
          b.y -= dy * correction * 0.5;
        }
      }
  }
}
