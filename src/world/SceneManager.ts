import type { ChunkData } from '../../game-data/zones/laboratory';
import { routeChunks } from '../../game-data/zones/laboratory';
import { neighbours, trackRoom } from './Rooms';
export interface DisposableChunk {
  dispose(): void;
  setMemory(active: boolean): void;
  /** Drawn and alive (enemies, vents), or only solid, waiting behind a door. */
  setShown(shown: boolean): void;
}
/** Metres around Eidra within which the route rooms along x are streamed. */
export const ROUTE_REACH = 24;
/**
 * Streams the rooms around Eidra (D036). In a route room, the route rooms within
 * reach along x are shown, as one continuous corridor; in a chamber, only the
 * chamber is. Rooms one doorway away stay loaded but hidden, so their ground is
 * there the moment she steps through.
 */
export class SceneManager<T extends DisposableChunk> {
  readonly loaded = new Map<string, T>();
  /** Rooms drawn and simulated. */
  readonly shown = new Map<string, T>();
  /** Data of the rooms drawn and simulated: their enemies and vents are live. */
  shownRooms: ChunkData[] = [];
  /** The room Eidra is in. */
  room: ChunkData = routeChunks[0]!;
  constructor(private create: (data: ChunkData) => T) {}
  update(x: number, y: number, memory: boolean): void {
    this.room = trackRoom(x, y, this.room) ?? this.room;
    const visible =
      this.room.kind === 'route'
        ? routeChunks.filter((data) => x >= data.start - ROUTE_REACH && x <= data.end + ROUTE_REACH)
        : [this.room];
    if (!visible.includes(this.room)) visible.push(this.room);
    const selected = [...visible, ...neighbours(this.room)];
    const desired = new Set(selected.map((data) => data.id));
    for (const [id, chunk] of this.loaded)
      if (!desired.has(id)) {
        chunk.dispose();
        this.loaded.delete(id);
      }
    for (const data of selected)
      if (!this.loaded.has(data.id)) this.loaded.set(data.id, this.create(data));
    this.shown.clear();
    for (const data of visible) this.shown.set(data.id, this.loaded.get(data.id)!);
    this.shownRooms = visible;
    for (const [id, chunk] of this.loaded) {
      chunk.setShown(this.shown.has(id));
      chunk.setMemory(memory);
    }
  }
  get zoneId(): string {
    return this.room.id;
  }
  dispose(): void {
    for (const chunk of this.loaded.values()) chunk.dispose();
    this.loaded.clear();
    this.shown.clear();
    this.shownRooms = [];
  }
}
