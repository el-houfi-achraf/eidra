import type { ChunkData } from '../../game-data/zones/laboratory';
import { chunks } from '../../game-data/zones/laboratory';
export interface DisposableChunk {
  dispose(): void;
  setMemory(active: boolean): void;
}
export class SceneManager<T extends DisposableChunk> {
  readonly loaded = new Map<string, T>();
  constructor(private create: (data: ChunkData) => T) {}
  update(x: number, memory: boolean): void {
    const selected = chunks.filter((data) => x >= data.start - 24 && x <= data.end + 24);
    const desired = new Set(selected.map((data) => data.id));
    for (const [id, chunk] of this.loaded)
      if (!desired.has(id)) {
        chunk.dispose();
        this.loaded.delete(id);
      }
    for (const data of selected)
      if (!this.loaded.has(data.id)) this.loaded.set(data.id, this.create(data));
    for (const chunk of this.loaded.values()) chunk.setMemory(memory);
  }
  get zoneId(): string {
    return [...this.loaded.keys()][0] ?? 'awakening';
  }
  dispose(): void {
    for (const chunk of this.loaded.values()) chunk.dispose();
    this.loaded.clear();
  }
}
