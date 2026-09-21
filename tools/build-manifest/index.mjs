import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { filesBelow, validateAssets } from '../validate-assets/index.mjs';
await validateAssets('public');
const assets = [];
for (const file of (await filesBelow('public')).sort()) {
  if (file.endsWith('asset-manifest.json') || file.includes('/_')) continue;
  const bytes = await readFile(file);
  assets.push({
    url: file.replace(/^public\//, ''),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
await writeFile(
  'public/asset-manifest.json',
  JSON.stringify({ version: 1, assets }, null, 2) + '\n',
);
console.log(`Manifest built: ${assets.length} validated assets.`);
