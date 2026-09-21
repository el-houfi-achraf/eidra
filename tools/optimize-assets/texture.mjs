import { spawnSync } from 'node:child_process';
import path from 'node:path';
const [input, output] = process.argv.slice(2);
if (
  !input ||
  !output ||
  path.extname(output) !== '.ktx2' ||
  path.resolve(input) === path.resolve(output)
)
  throw new Error('Usage: node tools/optimize-assets/texture.mjs texture.png texture.ktx2');
const result = spawnSync(
  'toktx',
  ['--t2', '--encode', 'uastc', '--genmipmap', '--assign_oetf', 'srgb', output, input],
  { stdio: 'inherit' },
);
if (result.error)
  throw new Error(
    'KTX-Software / toktx is required for production texture compression. The original texture has not been changed.',
    { cause: result.error },
  );
if (result.status !== 0) process.exitCode = result.status ?? 1;
