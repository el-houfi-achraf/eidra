import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { AssetLoadError } from '../core/errors';
// Lazy GLB path used when a procedural sector is replaced with approved art.
export async function loadGLB(
  url: string,
  scene: Scene,
  signal?: AbortSignal,
): Promise<AssetContainer> {
  let container: AssetContainer | undefined;
  try {
    signal?.throwIfAborted();
    await import('@babylonjs/loaders/glTF');
    const { MeshoptCompression } =
      await import('@babylonjs/core/Meshes/Compression/meshoptCompression');
    MeshoptCompression.Configuration.decoder.url = `${import.meta.env.BASE_URL}decoders/meshopt_decoder.js`;
    const { LoadAssetContainerAsync } = await import('@babylonjs/core/Loading/sceneLoader');
    container = await LoadAssetContainerAsync(url, scene, { pluginExtension: '.glb' });
    signal?.throwIfAborted();
    return container;
  } catch (cause) {
    container?.dispose();
    throw new AssetLoadError(`Impossible de charger le secteur ${url}.`, { cause });
  }
}
