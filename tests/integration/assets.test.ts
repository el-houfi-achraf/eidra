import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
it('validates authored and optimized GLBs, preserving the collision proxy', () => {
  for (const path of ['assets/environments/fixtures', 'public/assets/fixtures'])
    expect(
      execFileSync(process.execPath, ['tools/validate-assets/index.mjs', path], {
        encoding: 'utf8',
      }),
    ).toContain('passed');
  const bytes = readFileSync('public/assets/fixtures/laboratory_reliquary_a_lod0.glb');
  const raw: unknown = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  expect(JSON.stringify(raw)).toContain('COL_reliquary');
});
it('fails the asset gate on a corrupt GLB or empty audio file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'eidra-invalid-assets-'));
  try {
    writeFileSync(join(directory, 'corrupt_lod0.glb'), 'invalid');
    expect(() =>
      execFileSync(process.execPath, ['tools/validate-assets/index.mjs', directory], {
        stdio: 'pipe',
      }),
    ).toThrow();
    rmSync(join(directory, 'corrupt_lod0.glb'));
    writeFileSync(join(directory, 'empty.ogg'), '');
    expect(() =>
      execFileSync(process.execPath, ['tools/validate-assets/index.mjs', directory], {
        stdio: 'pipe',
      }),
    ).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
