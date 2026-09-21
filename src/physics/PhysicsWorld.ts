import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import HavokPhysics from '@babylonjs/havok';
import havokUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';
import { GameError } from '../core/errors';
let havokPromise: ReturnType<typeof HavokPhysics> | undefined;
export async function initializePhysics(scene: Scene): Promise<void> {
  try {
    havokPromise ??= HavokPhysics({ locateFile: () => havokUrl });
    const havok = await havokPromise;
    const enabled = scene.enablePhysics(new Vector3(0, -28, 0), new HavokPlugin(true, havok));
    if (!enabled) throw new GameError('Havok initialization returned false');
    scene.getPhysicsEngine()?.setTimeStep(1 / 60);
  } catch (cause) {
    havokPromise = undefined;
    throw new GameError('La physique de Nhalis n’a pas pu être chargée. Réessayez.', { cause });
  }
}
